import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { priceCheckout, round2, type ProductInfo, type CartLineInput } from '../_shared/pricing.ts';
import { checkRateLimit, clientKey } from '../_shared/rateLimit.ts';
import { empresaPorDominio } from '../_shared/mpCredentials.ts';
import { logEdge, newRequestId } from '../_shared/log.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const FN = 'create-checkout-order';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Gera token público aleatório (48 hex) + hash SHA-256 (hex).
async function makeToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { token, hash };
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Confere os dígitos verificadores do CPF.
 * O navegador já valida, mas quem cobra é o servidor: CPF errado só aparece
 * quando a nota fiscal é recusada, e aí o pedido já foi pago.
 */
function cpfValido(bruto: string): boolean {
  const d = (bruto || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/**
 * Normaliza o telefone brasileiro para o formato internacional.
 * O cliente digita só DDD e número; o +55 é fixo na tela.
 * Celular tem 9 dígitos e começa com 9; fixo tem 8. Essa diferença importa:
 * campanha por WhatsApp em telefone fixo não chega a lugar nenhum.
 */
function normalizarTelefone(bruto: string): { e164: string | null; ddd: string | null; numero: string | null; celular: boolean } {
  const so = (bruto || '').replace(/\D/g, '');
  const sem55 = so.startsWith('55') && so.length > 11 ? so.slice(2) : so;
  if (sem55.length !== 10 && sem55.length !== 11) return { e164: null, ddd: null, numero: null, celular: false };
  const ddd = sem55.slice(0, 2);
  const numero = sem55.slice(2);
  const celular = numero.length === 9 && numero.startsWith('9');
  return { e164: `+55${ddd}${numero}`, ddd, numero, celular };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const rid = newRequestId(req);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Rate limit fail-open: evita criação massiva de pedidos pendentes.
  const allowed = await checkRateLimit(supabase, clientKey(req, FN), 15, 300);
  if (!allowed) return json({ error: 'Muitas solicitações. Aguarde um momento.' }, 429);

  try {
    const body = await req.json().catch(() => ({}));
    const items: CartLineInput[] = Array.isArray(body?.items)
      ? body.items.map((i: any) => ({ product_id: String(i?.product_id || ''), quantity: Number(i?.quantity) }))
      : [];
    const c = body?.customer || {};

    // Dados mínimos do cliente (validação server-side + limites).
    const name = str(c.name, 120);
    const email = str(c.email, 160);
    const phone = str(c.phone, 30);
    if (!name || name.length < 2) return json({ error: 'Nome obrigatório' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400);

    // CPF: a nota fiscal de pessoa física não sai sem ele, e a compra agora é
    // liberada sem cadastro — não há perfil de onde puxar depois.
    const cpf = str(c.cpf, 20).replace(/\D/g, '');
    if (!cpfValido(cpf)) return json({ error: 'CPF inválido. Confira os números.', code: 'BAD_CPF' }, 400);

    const telefone = normalizarTelefone(phone);
    if (!telefone.e164) return json({ error: 'Telefone inválido. Informe DDD e número.', code: 'BAD_PHONE' }, 400);
    const aceitaPromo = (c.accepts_whatsapp_promos === true || body?.accepts_whatsapp_promos === true) && telefone.celular;

    // Preço/produtos: autoridade do servidor.
    const ids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    if (ids.length === 0) return json({ error: 'Pedido vazio' }, 400);
    const { data: prods, error: prodErr } = await supabase
      .from('products').select('id, name, price, is_active').in('id', ids);
    if (prodErr) throw prodErr;
    const byId = new Map<string, ProductInfo>();
    for (const p of prods || []) byId.set(p.id, { id: p.id, name: p.name, price: Number(p.price), is_active: !!p.is_active });

    const priced = priceCheckout(items, byId);
    if (!priced.ok) {
      await logEdge(supabase, { function_name: FN, request_id: rid, level: 'warn', status: 400, error_text: `${priced.code}` });
      return json({ error: priced.error, code: priced.code }, 400);
    }

    // Empresa faturadora: decidida AQUI, antes de qualquer cálculo, a partir do
    // domínio de onde a compra veio. Depois de gravada, é ela que manda —
    // nenhum passo posterior volta a olhar o domínio.
    //
    // O domínio vem do header Origin, posto pelo navegador, e não do corpo da
    // requisição, que o cliente controla. Sem domínio reconhecido, o pedido não
    // nasce: melhor recusar do que gravar a empresa errada e faturar no CNPJ errado.
    //
    // Fica antes do frete porque a cotação precisa saber de que empresa é a
    // regra de desconto e a tabela de origem.
    const prefixoEmpresa = empresaPorDominio(req.headers.get('origin') ?? req.headers.get('referer'));
    if (!prefixoEmpresa) {
      return json({ error: 'Origem da compra nao reconhecida.', code: 'UNKNOWN_SALES_CHANNEL' }, 400);
    }
    const { data: empresa } = await supabase
      .from('companies').select('id, name, payment_account').eq('order_prefix', prefixoEmpresa).maybeSingle();
    if (!empresa) {
      return json({ error: 'Empresa vendedora nao cadastrada.', code: 'SELLER_COMPANY_NOT_FOUND' }, 400);
    }
    if (!empresa.payment_account) {
      return json({ error: `A empresa ${empresa.name} nao tem meio de recebimento configurado.`, code: 'SELLER_WITHOUT_CREDENTIAL' }, 503);
    }

    // Frete: preço oficial da transportadora (nunca do browser).
    // Retirada no local é o caso especial: sem transportadora e sem frete.
    let shippingCost = 0;
    let carrierName: string | null = null;
    // Qual serviço do agregador o cliente escolheu. Sem isto não há como emitir
    // a etiqueta certa depois — o pedido saberia o preço, mas não a transportadora.
    let servicoFrete: { id: number; nome: string } | null = null;
    let carrierId = str(c.shipping_carrier_id || body?.shipping_carrier_id, 64);
    const isPickup = carrierId === 'pickup' || body?.is_pickup === true;
    if (isPickup) {
      carrierId = '';
      carrierName = 'Retirada no local';
      shippingCost = 0;
    } else if (carrierId.startsWith('sf:')) {
      // Frete do agregador. O preço é cotado AQUI de novo, nunca aceito do
      // navegador: quem cobra é o servidor, e um preço vindo do cliente é um
      // preço que o cliente pode escolher.
      const servicoId = Number(carrierId.slice(3));
      const pacotes = priced.lines.reduce((s, l) => s + l.quantity, 0);
      const cotacao = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/superfrete-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY')! },
        body: JSON.stringify({
          cep: str(c.cep, 20), pacotes, valor: priced.itemsTotal, empresa: prefixoEmpresa,
        }),
      }).then((r) => r.ok ? r.json() : null).catch(() => null);

      const escolhido = (cotacao?.opcoes ?? []).find((o: { id: number }) => o.id === servicoId);
      if (!escolhido) {
        return json({
          error: 'A opcao de frete escolhida nao esta mais disponivel. Escolha outra.',
          code: 'FRETE_INDISPONIVEL',
        }, 409);
      }
      shippingCost = round2(Number(escolhido.preco) || 0);
      // `nome` já vem com a transportadora dentro; concatenar de novo dava
      // "Correios Correios SEDEX".
      carrierName = String(escolhido.nome ?? '').trim();
      servicoFrete = { id: servicoId, nome: carrierName };
      carrierId = '';   // não é uma transportadora da nossa tabela

    } else if (carrierId === 'cofico') {
      // Transportadora própria: preço vem da tabela por faixa de CEP, cotada
      // aqui de novo. É ela que atende acima de 20 kg, onde o agregador recusa.
      const pacotes = priced.lines.reduce((s, l) => s + l.quantity, 0);
      const { data: tabela } = await supabase.from('shipping_rate_tables')
        .select('id').eq('is_active', true).limit(1).maybeSingle();
      const { data: pesoBruto } = await supabase.rpc('peso_bruto_kg', { p_unidades: pacotes });
      const { data: emp } = await supabase.from('companies')
        .select('shipping_subsidy_per_kg, shipping_discount_active, shipping_discount_unit, shipping_discount_min_packs, shipping_discount_max')
        .eq('id', empresa.id).maybeSingle();

      const vale = emp?.shipping_discount_active !== false
        && pacotes >= Number(emp?.shipping_discount_min_packs ?? 1);
      let base = Number(emp?.shipping_subsidy_per_kg ?? 0)
        * (emp?.shipping_discount_unit === 'pacote' ? pacotes : pacotes * 0.5);
      const teto = Number(emp?.shipping_discount_max ?? 0);
      if (teto > 0) base = Math.min(base, teto);
      const peso = Number(pesoBruto ?? 0);

      const { data: cot } = await supabase.rpc('cotar_frete', {
        p_table_id: tabela?.id,
        p_cep: str(c.cep, 20),
        p_peso_kg: peso,
        p_valor: priced.itemsTotal,
        p_subsidio_kg: vale && peso > 0 ? base / peso : 0,
      });
      const q = cot?.[0];
      if (!q?.atendido) {
        return json({ error: 'Nao atendemos esse CEP com entrega propria.', code: 'COFICO_SEM_COBERTURA' }, 409);
      }
      shippingCost = round2(Number(q.preco) || 0);
      carrierName = 'COFICO';
      carrierId = '';

    } else if (carrierId) {
      // A tabela guarda `fixed_price` e `price_per_kg` — não existe coluna `price`.
      // Enquanto o nome errado esteve aqui, a consulta falhava, o erro era engolido
      // e TODO frete saía zerado: quem escolhia transportadora não pagava nada, e o
      // nome dela nem era gravado no pedido.
      const { data: carrier, error: carrierErr } = await supabase.from('shipping_carriers')
        .select('name, fixed_price, price_per_kg').eq('id', carrierId).maybeSingle();

      // Transportadora escolhida que não pode ser precificada não vira frete grátis
      // por acidente: o pedido não nasce.
      if (carrierErr || !carrier) {
        return json({ error: 'Nao foi possivel calcular o frete. Tente novamente.', code: 'CARRIER_LOOKUP_FAILED' }, 400);
      }

      // 1 pacote = 500 g (regra do produto, ver CLAUDE.md §7). O peso só entra na
      // conta quando a transportadora cobra por quilo.
      const fixo = Number(carrier.fixed_price) || 0;
      const porKg = Number(carrier.price_per_kg) || 0;
      const pesoKg = porKg > 0 ? priced.lines.reduce((s, l) => s + l.quantity * 0.5, 0) : 0;
      shippingCost = round2(fixo + porKg * pesoKg);
      carrierName = carrier.name;
    }

    // Endereço (composto, com limites).
    const address = [
      `${str(c.street, 120)}, ${str(c.number, 20)}`,
      str(c.complement, 60) ? str(c.complement, 60) : null,
      `${str(c.neighborhood, 80)}, ${str(c.city, 80)}/${str(c.state, 20)}`,
      str(c.cep, 20) ? `CEP ${str(c.cep, 20)}` : null,
    ].filter(Boolean).join(' — ');

    // Cupom: validado AQUI de novo, mesmo que a tela já tenha validado. A tela
    // mostra; o servidor decide. Cupom vindo do navegador é cupom que o cliente
    // pode inventar.
    let descontoCupom = 0;      // quanto o cupom tirou, para a nota e o relatório
    let descontoNosProdutos = 0; // parte que sai do subtotal, não do frete
    let cupomAplicado: string | null = null;
    const codigoCupom = str(body?.cupom ?? c.cupom, 40);
    if (codigoCupom) {
      const { data: v } = await supabase.rpc('validar_cupom', {
        p_codigo: codigoCupom,
        p_cpf: cpf,
        p_subtotal: priced.itemsTotal,
        p_frete: shippingCost,
        p_empresa: prefixoEmpresa,
      });
      const r = v?.[0];
      if (!r?.valido) {
        return json({ error: r?.motivo ?? 'Cupom inválido.', code: 'CUPOM_INVALIDO' }, 400);
      }
      cupomAplicado = codigoCupom.toUpperCase();
      descontoCupom = round2(Number(r.desconto) || 0);

      if (r.zera_frete) {
        // Frete grátis: o desconto É o frete, e some do total zerando o frete.
        shippingCost = 0;
      } else {
        // Percentual ou valor fixo: sai dos produtos, nunca abaixo de zero.
        descontoNosProdutos = Math.min(descontoCupom, priced.itemsTotal);
      }
    }

    const { token, hash } = await makeToken();
    const total = round2(Math.max(priced.itemsTotal - descontoNosProdutos + shippingCost, 0));

    // Cria o pedido (SERVICE ROLE — o browser não insere direto).

    // Dono do pedido: quem estava logado na hora da compra.
    //
    // Antes gravava sempre nulo, mesmo com o cliente logado. Resultado: o pedido
    // não aparecia para ninguém — nem para o comprador na conta dele, nem para o
    // administrador, que só enxergava "os próprios pedidos". Compra sem dono é
    // compra invisível.
    // Visitante sem conta continua podendo comprar: aí o dono fica nulo mesmo, e o
    // acesso ao pedido é pelo token público.
    let compradorId: string | null = null;
    const auth = req.headers.get('Authorization') ?? '';
    if (auth) {
      const asUser = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data: { user } } = await asUser.auth.getUser();
      compradorId = user?.id ?? null;
    }

    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      user_id: compradorId,
      seller_company_id: empresa.id,
      // Canal da venda, para leitura humana e conciliacao. A autoridade sobre o
      // recebedor e seller_company_id, nao este campo.
      channel: prefixoEmpresa === 'CO' ? 'casa-cofico' : 'site-saporino',
      customer_name: name,
      customer_email: email,
      customer_cpf: cpf,
      customer_phone: phone,
      shipping_address: address,
      // Campos separados além do endereço em texto. O painel mostra estes; gravar
      // só o texto composto fazia o endereço aparecer em branco para quem opera,
      // mesmo com o cliente tendo preenchido tudo.
      shipping_street: str(c.street, 120) || null,
      shipping_number: str(c.number, 20) || null,
      shipping_complement: str(c.complement, 60) || null,
      shipping_neighborhood: str(c.neighborhood, 80) || null,
      shipping_city: str(c.city, 80) || null,
      shipping_state: str(c.state, 20) || null,
      shipping_postal_code: str(c.cep, 20) || null,
      shipping_recipient: str(c.recipient_name, 120) || name,
      is_gift: !!c.is_gift,
      shipping_carrier_id: carrierId || null,
      shipping_carrier_name: carrierName,
      shipping_service_id: servicoFrete?.id ?? null,
      shipping_service_name: servicoFrete?.nome ?? null,
      shipping_cost: shippingCost,
      coupon_code: cupomAplicado,
      discount_amount: descontoCupom,
      is_pickup: isPickup,
      total_amount: total,
      status: 'pending',
      order_type: 'single',
      order_public_token_hash: hash,
      phone_e164: telefone.e164,
      phone_is_mobile: telefone.celular,
      // Opt-in: só é verdadeiro se a pessoa marcou E o número é celular.
      // Promoção por WhatsApp em telefone fixo não chega a lugar nenhum.
      accepts_whatsapp_promos: aceitaPromo,
    }).select('id, order_number, total_amount').single();
    if (orderErr) throw orderErr;

    // Lista de campanha: entra quem autorizou, com data e origem registradas.
    // Sem consentimento, nada é gravado aqui.
    if (aceitaPromo && telefone.e164) {
      const { error: mcErr } = await supabase.from('marketing_contacts').upsert({
        phone_e164: telefone.e164,
        ddd: telefone.ddd,
        numero: telefone.numero,
        is_mobile: telefone.celular,
        name, email,
        segment: 'b2c',
        company_id: empresa.id,
        source: 'checkout-b2c',
        consent: true,
        consent_at: new Date().toISOString(),
        opted_out_at: null,
        last_order_at: new Date().toISOString(),
      }, { onConflict: 'phone_e164,segment,company_id' });
      if (mcErr) console.error('Falha ao registrar consentimento de campanha:', mcErr.message);
    }

    // Itens (SERVICE ROLE) com preços oficiais.
    const itemRows = priced.lines.map((l) => ({
      order_id: order.id, product_id: l.product_id, product_name: l.name,
      quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    // Registra o uso do cupom e incrementa o contador. Sem isto o limite de
    // usos nunca chegaria ao fim, e não haveria como auditar quem usou o quê.
    if (cupomAplicado) {
      const { data: cup } = await supabase.from('coupons')
        .select('id, uses').eq('code', cupomAplicado).eq('company_id', empresa.id).maybeSingle();
      if (cup) {
        await supabase.from('coupon_redemptions').insert({
          coupon_id: cup.id, order_id: order.id, cpf, amount: descontoCupom,
        });
        await supabase.from('coupons').update({ uses: (cup.uses ?? 0) + 1 }).eq('id', cup.id);
      }
    }

    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { order: order.id, items: itemRows.length } });
    return json({ order_id: order.id, public_token: token, order_number: order.order_number, total_amount: order.total_amount });
  } catch (error) {
    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'error', status: 500, error_text: (error as Error).message });
    return json({ error: 'Erro ao criar pedido' }, 500);
  }
});
