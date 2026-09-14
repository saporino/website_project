// Coffee LiVRE — bancada de PEDIDOS (Unidade 8), só no staging.
//
// Prova no banco, com JWT real de cada papel, o que o checkout promete:
//   escada do SQL = escada.ts · transições do SQL = estados.ts
//   multiloja: 1 checkout → 1 pedido pai → 2 subpedidos, com snapshot e política congelada
//   RLS: comprador vê a compra inteira; vendedor A só o A; B só o B; admin tudo; anônimo nada
//   reserva FEFO sob trava, concorrência sem overselling, expiração que devolve estoque
//   idempotência do checkout, da confirmação e do evento de pagamento
//   estados: passo permitido anda, transição absurda é recusada, dinheiro não muda
//   cancelamento antes e depois do pagamento
//
// Tudo o que cria leva a marca `teste-pedido` / `@coffeelivre.test` e é apagado.
// Não usa o catálogo de demonstração: o estoque controlado dele é usado pelos
// testes de navegador.
//
// Uso:
//   node scripts/coffeelivre-pedidos.mjs            ciclo completo (cria, testa, apaga)
//   node scripts/coffeelivre-pedidos.mjs cenarios   deixa pedidos fictícios de demonstração no staging
//   node scripts/coffeelivre-pedidos.mjs limpar     apaga tudo o que a bancada e os cenários criaram

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';
import { unitarioNaQuantidade } from '../src/pages/coffeelivre/escada.ts';
import {
  STATUS_DO_PEDIDO, STATUS_DO_SUBPEDIDO, STATUS_DO_PAGAMENTO,
  transicaoDoPedidoValida, transicaoDoSubpedidoValida, transicaoDoPagamentoValida,
} from '../src/pages/coffeelivre/checkout/estados.ts';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
const anonimo = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-pedido';
const EMAIL = r => `${MARCA}-${r}@coffeelivre.test`;

let falhas = 0;
let criterios = 0;
const ok = t => { criterios++; console.log('  ok  ' + t); };
const erro = t => { criterios++; falhas++; console.log('  !!  ' + t); };
const checar = (rotulo, cond, detalhe = '') => (cond ? ok(rotulo) : erro(`${rotulo} ${detalhe}`));
const secao = t => console.log(`\n=== ${t} ===`);
const chave = () => crypto.randomUUID();
const senhaAleatoria = () => crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const futuro = dias => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
async function acharUsuario(email) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    const achado = data?.users?.find(u => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

async function criarUsuario(rotulo, { admin: ehAdmin = false } = {}) {
  const email = EMAIL(rotulo);
  const senha = senhaAleatoria();
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`usuário ${rotulo}: ${error.message}`);
  if (ehAdmin) {
    const { error: ep } = await admin.from('user_profiles').upsert({ id: data.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
    if (ep) throw new Error('perfil admin: ' + ep.message);
  }
  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`entrar como ${rotulo}: ${el.message}`);
  return { id: data.user.id, email, cliente };
}

async function lote(id) {
  return (await admin.from('lv_inventory_lots').select('qtd_disponivel, qtd_reservada').eq('id', id).single()).data;
}

const vendavel = async variante => (await admin.rpc('lv_vendavel_da_variante', { p_variant: variante })).data;

async function limpar() {
  const { data: pedidos } = await admin.from('lv_orders').select('id').or(`comprador_email.like.${MARCA}%,comprador_email.like.teste-cenario%`);
  if (pedidos?.length) await admin.from('lv_orders').delete().in('id', pedidos.map(p => p.id));
  const { data: lojas } = await admin.from('lv_stores').select('id, seller_id').or(`slug.like.${MARCA}%,slug.like.teste-cenario%`);
  for (const l of lojas ?? []) {
    await admin.from('lv_products').delete().eq('store_id', l.id);
    await admin.from('lv_stores').delete().eq('id', l.id);
    await admin.from('lv_sellers').delete().eq('id', l.seller_id);
  }
  for (const prefixo of [MARCA, 'teste-cenario']) {
    for (let pagina = 1; pagina <= 20; pagina++) {
      const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      const alvo = (data?.users ?? []).filter(u => u.email?.startsWith(prefixo));
      for (const u of alvo) await admin.auth.admin.deleteUser(u.id);
      if (!data?.users || data.users.length < 200) break;
    }
  }
}

// ---------------------------------------------------------------------
// Catálogo de teste
// ---------------------------------------------------------------------
async function criarVendedor(letra, prefixo = MARCA) {
  const { data: s, error: es } = await admin.from('lv_sellers')
    .insert({ nome_fantasia: `${prefixo} Torrefação ${letra}`, tipo: 'torrefacao', status: 'aprovado', is_demo: true })
    .select('id').single();
  if (es) throw new Error('vendedor: ' + es.message);
  const { data: l, error: el } = await admin.from('lv_stores')
    .insert({ seller_id: s.id, slug: `${prefixo}-loja-${letra.toLowerCase()}`, nome: `Torrefação ${letra} (teste)`, cor: '#35506B', iniciais: 'T' + letra, ativa: true, is_demo: true })
    .select('id').single();
  if (el) throw new Error('loja: ' + el.message);
  return { sellerId: s.id, lojaId: l.id };
}

async function criarProduto(v, { slug, titulo, preco, piso, peso, faixas = [], lotes = [], variantesExtras = [], categoria }) {
  const { data: p, error } = await admin.from('lv_products').insert({
    store_id: v.lojaId, seller_id: v.sellerId, category_id: categoria, slug, titulo, marca: 'Teste',
    preco_cents: preco, preco_minimo_cents: piso, peso_g: peso, venda_por_quantidade: faixas.length > 0,
    status: 'ativo', is_demo: true, sku: slug.toUpperCase().slice(0, 30),
  }).select('id').single();
  if (error) throw new Error(`produto ${slug}: ${error.message}`);
  if (faixas.length) await admin.from('lv_price_tiers').insert(faixas.map(f => ({ product_id: p.id, ...f })));
  const { data: padrao } = await admin.from('lv_product_variants').select('id').eq('product_id', p.id).eq('padrao', true).single();
  await admin.from('lv_product_variants').update({ gramatura_g: peso, ean: '789' + String(Date.now()).slice(-10) }).eq('id', padrao.id);
  const variantes = { padrao: padrao.id };
  for (const x of variantesExtras) {
    const { data: vv, error: ev } = await admin.from('lv_product_variants').insert({
      product_id: p.id, nome: x.nome, gramatura_g: x.gramatura, preco_cents: x.preco, padrao: false, ativa: true, ordem: 2, is_demo: true,
    }).select('id').single();
    if (ev) throw new Error(`variante ${x.nome}: ${ev.message}`);
    variantes[x.chave] = vv.id;
  }
  const lotesCriados = {};
  for (const l of lotes) {
    const { data: lt, error: elt } = await admin.from('lv_inventory_lots').insert({
      variant_id: variantes[l.variante ?? 'padrao'], lote: l.lote, validade: l.validade, entrada_em: futuro(-10),
      qtd_disponivel: l.qtd, is_demo: true,
    }).select('id').single();
    if (elt) throw new Error(`lote ${l.lote}: ${elt.message}`);
    lotesCriados[l.lote] = lt.id;
  }
  return { id: p.id, variantes, lotes: lotesCriados };
}

async function montarCatalogo(prefixo = MARCA) {
  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();
  const A = await criarVendedor('A', prefixo);
  const B = await criarVendedor('B', prefixo);
  const tradicional = await criarProduto(A, {
    slug: `${prefixo}-tradicional-500g`, titulo: 'Café Tradicional 500 g', preco: 2490, piso: 2000, peso: 500, categoria: cat.id,
    faixas: [{ min_qty: 2, tipo: 'reais', valor: 100 }, { min_qty: 3, tipo: 'reais', valor: 150 }],
    lotes: [
      { lote: 'A-LONGE', validade: futuro(300), qtd: 10 },
      { lote: 'A-PERTO', validade: futuro(30), qtd: 5 },
      { lote: 'A-VENCIDO', validade: futuro(-1), qtd: 50 },
    ],
  });
  const especial = await criarProduto(B, {
    slug: `${prefixo}-especial-250g`, titulo: 'Café Especial 250 g', preco: 3990, piso: 3000, peso: 250, categoria: cat.id,
    faixas: [{ min_qty: 3, tipo: 'percentual', valor: 500 }],
    variantesExtras: [{ chave: 'kg', nome: 'Especial 1 kg', gramatura: 1000, preco: 13900 }],
    lotes: [{ lote: 'B-250', validade: futuro(200), qtd: 20 }, { lote: 'B-1KG', validade: futuro(100), qtd: 4, variante: 'kg' }],
  });
  const disputado = await criarProduto(A, {
    slug: `${prefixo}-disputado`, titulo: 'Café Disputado', preco: 1990, piso: null, peso: 500, categoria: cat.id,
    lotes: [{ lote: 'D-2', validade: futuro(90), qtd: 2 }],
  });
  const quatro = await criarProduto(A, {
    slug: `${prefixo}-quatro`, titulo: 'Café Quatro Unidades', preco: 2190, piso: null, peso: 500, categoria: cat.id,
    lotes: [{ lote: 'Q-4', validade: futuro(90), qtd: 4 }],
  });
  return { A, B, tradicional, especial, disputado, quatro };
}

const COMPRADOR = { nome: 'Comprador de Teste', telefone: '11999990000', cpf: '' };
const ENDERECO = {
  destinatario: 'Comprador de Teste', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: 'conj. 1',
  bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', referencia: '',
};

async function comprar(cliente, itens, { frete = 'demo_padrao', pagamento = 'pix' } = {}) {
  const ini = await cliente.rpc('lv_checkout_iniciar', { p_itens: itens, p_chave: chave() });
  if (ini.error) return { erro: ini.error };
  const conf = await cliente.rpc('lv_checkout_confirmar', {
    p_checkout: ini.data.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: frete, p_pagamento: pagamento,
  });
  if (conf.error) return { erro: conf.error, checkout: ini.data };
  return { checkout: ini.data, pedido: conf.data };
}

const simular = (cliente, orderId, resultado = 'aprovado', k = chave()) =>
  cliente.rpc('lv_pagamento_simular', { p_order: orderId, p_resultado: resultado, p_chave: k });

// ---------------------------------------------------------------------
// Ciclo
// ---------------------------------------------------------------------
async function ciclo() {
  secao('PREPARANDO CATÁLOGO E USUÁRIOS DE TESTE');
  await limpar();
  const cat = await montarCatalogo();
  const [c1, c2, vA, vB, adm] = await Promise.all([
    criarUsuario('comprador1'), criarUsuario('comprador2'), criarUsuario('vendedor-a'), criarUsuario('vendedor-b'),
    criarUsuario('admin', { admin: true }),
  ]);
  await admin.from('lv_seller_users').insert([{ seller_id: cat.A.sellerId, user_id: vA.id }, { seller_id: cat.B.sellerId, user_id: vB.id }]);
  ok('2 vendedores, 4 produtos, lotes com validades diferentes, 2 compradores, 2 usuários de vendedor e 1 admin temporário');

  const vTrad = cat.tradicional.variantes.padrao;
  const vEsp = cat.especial.variantes.padrao;
  const vKg = cat.especial.variantes.kg;

  // ------------------------------------------------------------------
  secao('ESCADA: SQL = escada.ts');
  const faixasA = [{ min_qty: 2, tipo: 'reais', valor: 100 }, { min_qty: 3, tipo: 'reais', valor: 150 }];
  const faixasB = [{ min_qty: 3, tipo: 'percentual', valor: 500 }];
  let iguais = true;
  for (let q = 1; q <= 6; q++) {
    const [a, b] = await Promise.all([
      admin.rpc('lv_unitario_na_quantidade', { p_preco: 2490, p_product: cat.tradicional.id, p_qtd: q }),
      admin.rpc('lv_unitario_na_quantidade', { p_preco: 3990, p_product: cat.especial.id, p_qtd: q }),
    ]);
    if (Number(a.data?.[0]?.unitario_cents) !== unitarioNaQuantidade(2490, faixasA, q)) iguais = false;
    if (Number(b.data?.[0]?.unitario_cents) !== unitarioNaQuantidade(3990, faixasB, q)) iguais = false;
  }
  checar('1 a 6 unidades, faixa em reais e percentual: banco e escada.ts dão o mesmo unitário', iguais);

  // ------------------------------------------------------------------
  secao('ESTADOS: SQL = estados.ts');
  const pares = (lista, fn, validaTs) => lista.flatMap(de => lista.map(para => ({ de, para, fn, esperado: validaTs(de, para) })));
  const todos = [
    ...pares(STATUS_DO_PEDIDO, 'lv_transicao_pedido_valida', transicaoDoPedidoValida),
    ...pares(STATUS_DO_SUBPEDIDO, 'lv_transicao_subpedido_valida', transicaoDoSubpedidoValida),
    ...pares(STATUS_DO_PAGAMENTO, 'lv_transicao_pagamento_valida', transicaoDoPagamentoValida),
  ];
  const respostas = await Promise.all(todos.map(t => admin.rpc(t.fn, { p_de: t.de, p_para: t.para })));
  const diferentes = todos.filter((t, i) => respostas[i].data !== t.esperado);
  checar(`${todos.length} pares de status: banco e estados.ts concordam`, diferentes.length === 0,
    `(${diferentes.slice(0, 3).map(d => `${d.de}→${d.para}`).join(', ')})`);

  // ------------------------------------------------------------------
  secao('MULTILOJA: A 2 × Tradicional 500 g + B 3 × Especial 250 g');
  const antesPerto = await lote(cat.tradicional.lotes['A-PERTO']);
  const antesLonge = await lote(cat.tradicional.lotes['A-LONGE']);
  const antesVencido = await lote(cat.tradicional.lotes['A-VENCIDO']);
  const antesB = await lote(cat.especial.lotes['B-250']);
  const chaveMulti = chave();
  const ini = await c1.cliente.rpc('lv_checkout_iniciar', {
    p_itens: [{ variant_id: vTrad, quantidade: 2, unitario_cents: 2390 }, { variant_id: vEsp, quantidade: 3, unitario_cents: 3790 }],
    p_chave: chaveMulti,
  });
  checar('checkout aberto', !ini.error && !!ini.data?.checkout_id, `(${ini.error?.message})`);
  const ck = ini.data;
  checar('2 vendedores no mesmo checkout', ck?.vendedores?.length === 2);
  checar('escada aplicada pelo banco: R$ 23,90 (2 un.) e R$ 37,90 (3 un., 5%)',
    ck?.itens?.find(i => i.variant_id === vTrad)?.unitario_cents === 2390 && ck?.itens?.find(i => i.variant_id === vEsp)?.unitario_cents === 3790);
  checar('nenhuma divergência com o preço que a tela mostrou', ck?.divergencias_de_tela?.length === 0);
  checar('FEFO: saiu do lote com validade mais próxima', (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_disponivel === antesPerto.qtd_disponivel - 2
    && (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_reservada === antesPerto.qtd_reservada + 2);
  checar('lote de validade distante e lote vencido intactos',
    (await lote(cat.tradicional.lotes['A-LONGE'])).qtd_disponivel === antesLonge.qtd_disponivel
    && (await lote(cat.tradicional.lotes['A-VENCIDO'])).qtd_disponivel === antesVencido.qtd_disponivel);
  checar('estoque do vendedor B reservado separadamente (20 → 17)', (await lote(cat.especial.lotes['B-250'])).qtd_disponivel === antesB.qtd_disponivel - 3);
  checar('vendável da vitrine já desconta a reserva', (await vendavel(vEsp)) === antesB.qtd_disponivel - 3);

  const repetido = await c1.cliente.rpc('lv_checkout_iniciar', {
    p_itens: [{ variant_id: vTrad, quantidade: 2 }, { variant_id: vEsp, quantidade: 3 }], p_chave: chaveMulti,
  });
  checar('idempotência: mesma chave devolve o mesmo checkout sem reservar de novo',
    repetido.data?.checkout_id === ck.checkout_id && repetido.data?.repetido === true
    && (await lote(cat.especial.lotes['B-250'])).qtd_disponivel === antesB.qtd_disponivel - 3);

  const fretes = await c1.cliente.rpc('lv_frete_cotar', { p_checkout: ck.checkout_id });
  checar('frete: 3 opções, cada uma com uma entrega por vendedor',
    fretes.data?.length === 3 && fretes.data.every(o => o.entregas.length === 2 && o.total_cents > 0));

  const resumo = await c1.cliente.rpc('lv_checkout_resumo', { p_checkout: ck.checkout_id, p_frete: 'demo_padrao', p_pagamento: 'pix' });
  const t = resumo.data?.totais;
  checar('resumo: subtotal, desconto e total batem (4980+11970 − 200−600 + frete)',
    t?.subtotal_produtos_cents === 2 * 2490 + 3 * 3990 && t?.desconto_produtos_cents === 200 + 600
    && t?.total_cents === t.subtotal_produtos_cents - t.desconto_produtos_cents + t.frete_cents, `(${JSON.stringify(t)})`);
  checar('resumo de outro comprador é recusado',
    !!(await c2.cliente.rpc('lv_checkout_resumo', { p_checkout: ck.checkout_id, p_frete: 'demo_padrao', p_pagamento: 'pix' })).error);

  const conf = await c1.cliente.rpc('lv_checkout_confirmar', {
    p_checkout: ck.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: 'pix',
  });
  checar('pedido gerado com número público LV-', !conf.error && /^LV-\d{6}$/.test(conf.data?.numero ?? ''), `(${conf.error?.message})`);
  const orderId = conf.data?.order_id;
  const conf2 = await c1.cliente.rpc('lv_checkout_confirmar', {
    p_checkout: ck.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: 'pix',
  });
  checar('idempotência: confirmar de novo devolve o MESMO pedido', conf2.data?.order_id === orderId && conf2.data?.repetido === true);

  const { data: subs } = await admin.from('lv_seller_orders').select('*').eq('order_id', orderId).order('numero');
  const { data: itens } = await admin.from('lv_order_items').select('*').eq('order_id', orderId);
  const { data: ordem } = await admin.from('lv_orders').select('*').eq('id', orderId).single();
  const { count: pedidosDoCheckout } = await admin.from('lv_orders').select('id', { count: 'exact', head: true }).eq('checkout_id', ck.checkout_id);
  checar('1 checkout → 1 pedido pai', pedidosDoCheckout === 1);
  checar('2 subpedidos, um por vendedor, numerados LV-xxxxxx-1 e -2',
    subs?.length === 2 && subs.every(s => s.numero.startsWith(conf.data.numero + '-')) && new Set(subs.map(s => s.seller_id)).size === 2);
  const subA = subs?.find(s => s.seller_id === cat.A.sellerId);
  const subB = subs?.find(s => s.seller_id === cat.B.sellerId);
  const itemA = itens?.find(i => i.variant_id === vTrad);
  checar('snapshot do item: título, marca, gramatura, SKU, EAN, loja, preço cheio, unitário e desconto',
    itemA?.titulo === 'Café Tradicional 500 g' && itemA?.marca === 'Teste' && itemA?.gramatura_g === 500 && !!itemA?.sku && !!itemA?.ean
    && itemA?.loja_nome === 'Torrefação A (teste)' && Number(itemA?.preco_cheio_cents) === 2490 && Number(itemA?.unitario_cents) === 2390
    && Number(itemA?.desconto_cents) === 200 && itemA?.faixa_min_qty === 2);
  checar('política congelada: plano zero, comissão 12%, tarifa por pacote e taxa Pix 0,99%',
    itemA?.comissao_bps === 1200 && Number(itemA?.comissao_cents) === Math.floor((4780 * 1200 + 5000) / 10000)
    && itemA?.tarifa_unidade_cents != null && itemA?.pagamento_bps === 99 && subA?.politica_comercial?.plano === 'zero');
  checar('auditoria de piso: piso R$ 20,00 e distância R$ 3,90; líquido estimado registrado',
    Number(itemA?.piso_cents) === 2000 && Number(itemA?.distancia_piso_cents) === 390 && itemA?.liquido_estimado_cents != null);
  checar('lote usado registrado no item (A-PERTO)', itemA?.lotes?.[0]?.lote === 'A-PERTO' && itemA.lotes[0].quantidade === 2);
  const repasseA = Number(subA?.subtotal_produtos_cents) - Number(subA?.desconto_produtos_cents) - Number(subA?.comissao_plataforma_cents)
    - Number(subA?.tarifa_operacional_cents) - Number(subA?.taxa_pagamento_cents);
  checar('repasse conceitual de cada vendedor = produtos − comissão − tarifa − taxa',
    subA?.politica_completa && Number(subA?.repasse_seller_cents) === repasseA && subB?.repasse_seller_cents != null);
  checar('pedido pai soma os subpedidos',
    Number(ordem?.total_cents) === Number(subA?.total_cents) + Number(subB?.total_cents)
    && Number(ordem?.repasse_sellers_cents) === Number(subA?.repasse_seller_cents) + Number(subB?.repasse_seller_cents));
  const { data: eventos } = await admin.from('lv_order_events').select('tipo').eq('order_id', orderId);
  const tipos = (eventos ?? []).map(e => e.tipo);
  checar('eventos: pedido_criado, estoque_reservado, pagamento_pendente e subpedido_criado ×2',
    ['pedido_criado', 'estoque_reservado', 'pagamento_pendente'].every(x => tipos.includes(x)) && tipos.filter(x => x === 'subpedido_criado').length === 2);
  checar('entrega (1 por subpedido) e pagamento simulado aguardando',
    (await admin.from('lv_shipments').select('id').eq('order_id', orderId)).data?.length === 2
    && (await admin.from('lv_payments').select('status, provedor').eq('order_id', orderId).single()).data?.status === 'aguardando_pagamento');

  // ------------------------------------------------------------------
  secao('RLS PELA API');
  const ler = async (cliente, tabela) => { const r = await cliente.from(tabela).select('*').eq('order_id', orderId); return r.error ? null : r.data; };
  const [sa, sb, sc, sd] = await Promise.all(['lv_seller_orders', 'lv_order_items'].flatMap(tb => [ler(vA.cliente, tb), ler(vB.cliente, tb)]));
  checar('vendedor A vê só o subpedido e o item dele', sa?.length === 1 && sa[0].seller_id === cat.A.sellerId && sc?.length === 1 && sc[0].seller_id === cat.A.sellerId);
  checar('vendedor B vê só o subpedido e o item dele', sb?.length === 1 && sb[0].seller_id === cat.B.sellerId && sd?.length === 1 && sd[0].seller_id === cat.B.sellerId);
  checar('vendedor não lê pedido pai, pagamento nem dados do comprador',
    (await vA.cliente.from('lv_orders').select('id').eq('id', orderId)).data?.length === 0
    && (await ler(vA.cliente, 'lv_payments'))?.length === 0);
  checar('antes do pagamento, vendedor não vê o endereço', (await ler(vA.cliente, 'lv_order_addresses'))?.length === 0);
  checar('comprador vê a compra consolidada: 1 pedido, 2 subpedidos, 2 itens, pagamento, endereço',
    (await c1.cliente.from('lv_orders').select('id').eq('id', orderId)).data?.length === 1
    && (await ler(c1.cliente, 'lv_seller_orders'))?.length === 2 && (await ler(c1.cliente, 'lv_order_items'))?.length === 2
    && (await ler(c1.cliente, 'lv_payments'))?.length === 1 && (await ler(c1.cliente, 'lv_order_addresses'))?.length === 1);
  checar('outro comprador não vê nada', (await c2.cliente.from('lv_orders').select('id').eq('id', orderId)).data?.length === 0
    && (await ler(c2.cliente, 'lv_order_items'))?.length === 0);
  const anon = await anonimo.from('lv_orders').select('id').limit(1);
  checar('anônimo não lê pedido', !!anon.error || anon.data?.length === 0);
  checar('admin vê pedido, subpedidos, pagamento e eventos',
    (await adm.cliente.from('lv_orders').select('id').eq('id', orderId)).data?.length === 1
    && (await ler(adm.cliente, 'lv_seller_orders'))?.length === 2 && (await ler(adm.cliente, 'lv_order_events'))?.length >= 5);
  const escritas = await Promise.all([
    c1.cliente.from('lv_orders').update({ total_cents: 1 }).eq('id', orderId).select('id'),
    vA.cliente.from('lv_seller_orders').update({ repasse_seller_cents: 999999 }).eq('id', subA.id).select('id'),
    c1.cliente.from('lv_orders').insert({ numero: 'LV-HACK', pagamento_metodo: 'pix', comprador_nome: 'x', comprador_email: 'x', subtotal_produtos_cents: 0, total_cents: 0 }),
    vA.cliente.from('lv_payments').update({ status: 'aprovado' }).eq('order_id', orderId).select('id'),
  ]);
  checar('ninguém escreve direto: comprador não muda total, vendedor não muda repasse nem pagamento',
    escritas.every(r => !!r.error || (Array.isArray(r.data) && r.data.length === 0))
    && Number((await admin.from('lv_seller_orders').select('repasse_seller_cents').eq('id', subA.id).single()).data.repasse_seller_cents) === repasseA);
  const processar = await c1.cliente.rpc('lv_pagamento_processar', { p_provedor: 'x', p_chave: 'y', p_order: orderId, p_status: 'aprovado', p_payload: {} });
  checar('porta do webhook (lv_pagamento_processar) fechada para usuário logado', !!processar.error);
  const eventosA = await vA.cliente.from('lv_order_events').select('seller_order_id').eq('order_id', orderId);
  checar('vendedor vê só eventos do subpedido dele', (eventosA.data ?? []).length > 0 && eventosA.data.every(e => e.seller_order_id === subA.id));

  // ------------------------------------------------------------------
  secao('PAGAMENTO SIMULADO E IDEMPOTÊNCIA');
  const antesdeSeparar = await vA.cliente.rpc('lv_subpedido_mudar_status', { p_seller_order: subA.id, p_status: 'separacao' });
  checar('antes de pagar, vendedor não separa (aguardando_pagamento → separacao recusado)', !!antesdeSeparar.error);
  const kPag = chave();
  const pag1 = await simular(c1.cliente, orderId, 'aprovado', kPag);
  const pag2 = await simular(c1.cliente, orderId, 'aprovado', kPag);
  checar('pagamento aprovado: pedido pago', !pag1.error && pag1.data?.status_pedido === 'pago', `(${pag1.error?.message})`);
  checar('mesmo evento de pagamento de novo: marcado duplicado, sem efeito', pag2.data?.duplicado === true);
  const { data: evPag } = await admin.from('lv_order_events').select('tipo').eq('order_id', orderId).eq('tipo', 'pagamento_aprovado');
  const { count: evGravados } = await admin.from('lv_payment_events').select('id', { count: 'exact', head: true }).eq('order_id', orderId);
  checar('um único pagamento_aprovado e um único evento gravado', evPag?.length === 1 && evGravados === 1);
  checar('reserva virou baixa definitiva (A-PERTO: reservado volta ao que era)',
    (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_reservada === antesPerto.qtd_reservada
    && (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_disponivel === antesPerto.qtd_disponivel - 2);
  const { data: subsPagos } = await admin.from('lv_seller_orders').select('status').eq('order_id', orderId);
  checar('subpedidos confirmados e vendedores notificados',
    subsPagos.every(s => s.status === 'confirmado')
    && (await admin.from('lv_order_events').select('id').eq('order_id', orderId).eq('tipo', 'seller_notificado')).data?.length === 2);
  checar('pago: vendedor passa a ver o endereço de entrega', (await ler(vA.cliente, 'lv_order_addresses'))?.length === 1);

  // ------------------------------------------------------------------
  secao('STATUS DOS SUBPEDIDOS');
  const mudar = (cliente, id, status) => cliente.rpc('lv_subpedido_mudar_status', { p_seller_order: id, p_status: status });
  checar('vendedor A inicia separação; pedido pai em processamento',
    (await mudar(vA.cliente, subA.id, 'separacao')).data?.status_pedido === 'em_processamento');
  checar('vendedor A não mexe no subpedido do B', !!(await mudar(vA.cliente, subB.id, 'separacao')).error);
  checar('vendedor não cancela subpedido', !!(await mudar(vA.cliente, subA.id, 'cancelado')).error);
  checar('pular etapa é recusado (separacao → entregue)', !!(await mudar(vA.cliente, subA.id, 'entregue')).error);
  await mudar(vA.cliente, subA.id, 'pronto_para_envio');
  checar('A enviado, B não: parcialmente enviado', (await mudar(vA.cliente, subA.id, 'enviado')).data?.status_pedido === 'parcialmente_enviado');
  await mudar(vA.cliente, subA.id, 'entregue');
  checar('entregue → separação é impossível', !!(await mudar(vA.cliente, subA.id, 'separacao')).error);
  for (const s of ['separacao', 'pronto_para_envio', 'enviado']) await mudar(vB.cliente, subB.id, s);
  checar('B enviado com A entregue: pedido enviado', (await admin.from('lv_orders').select('status').eq('id', orderId).single()).data.status === 'enviado');
  checar('B entregue: pedido entregue', (await mudar(vB.cliente, subB.id, 'entregue')).data?.status_pedido === 'entregue');
  const absurdo = await admin.from('lv_orders').update({ status: 'aguardando_pagamento' }).eq('id', orderId);
  checar('nem a chave de serviço volta um pedido entregue para aguardando pagamento', !!absurdo.error && /inválida/.test(absurdo.error.message));
  const dinheiro = await admin.from('lv_orders').update({ total_cents: 1 }).eq('id', orderId);
  checar('nem a chave de serviço altera valor congelado do pedido', !!dinheiro.error);
  checar('comprador não cancela pedido entregue', !!(await c1.cliente.rpc('lv_pedido_cancelar', { p_order: orderId, p_motivo: 'teste' })).error);
  checar('eventos de operação registrados (em_separacao, enviado, entregue)',
    ['em_separacao', 'enviado', 'entregue'].every(async () => true)
    && (await admin.from('lv_order_events').select('tipo').eq('order_id', orderId).in('tipo', ['em_separacao', 'enviado', 'entregue'])).data?.length === 6);

  // ------------------------------------------------------------------
  secao('SNAPSHOT E POLÍTICA NÃO MUDAM DEPOIS');
  const { data: regraZero } = await admin.from('lv_tarifas_simulacao').select('id, percentual_bps')
    .eq('plataforma', 'coffeelivre').eq('modalidade', 'zero').eq('componente', 'comissao').single();
  await admin.from('lv_products').update({ titulo: 'Café Tradicional RENOMEADO', preco_cents: 2990 }).eq('id', cat.tradicional.id);
  await admin.from('lv_tarifas_simulacao').update({ percentual_bps: 1500 }).eq('id', regraZero.id);
  const itemDepois = (await admin.from('lv_order_items').select('titulo, preco_cheio_cents, unitario_cents, comissao_bps, comissao_cents').eq('id', itemA.id).single()).data;
  const subDepois = (await admin.from('lv_seller_orders').select('politica_comercial, comissao_plataforma_cents').eq('id', subA.id).single()).data;
  checar('produto renomeado e com novo preço: item do pedido continua com o original',
    itemDepois.titulo === 'Café Tradicional 500 g' && Number(itemDepois.preco_cheio_cents) === 2490 && Number(itemDepois.unitario_cents) === 2390);
  checar('comissão do plano mudou para 15%: pedido de ontem segue com 12%',
    itemDepois.comissao_bps === 1200 && subDepois.politica_comercial.comissao_bps === 1200
    && Number(subDepois.comissao_plataforma_cents) === Number(subA.comissao_plataforma_cents));
  await admin.from('lv_tarifas_simulacao').update({ percentual_bps: regraZero.percentual_bps }).eq('id', regraZero.id);
  await admin.from('lv_products').update({ titulo: 'Café Tradicional 500 g', preco_cents: 2490 }).eq('id', cat.tradicional.id);

  // ------------------------------------------------------------------
  secao('PREÇO QUE MUDA NO CAMINHO');
  const iniDiv = await c2.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vTrad, quantidade: 1, unitario_cents: 1990 }], p_chave: chave() });
  checar('tela mostrou R$ 19,90, banco calcula R$ 24,90: divergência devolvida antes de confirmar',
    iniDiv.data?.divergencias_de_tela?.length === 1 && iniDiv.data.divergencias_de_tela[0].unitario_cents === 2490);
  await admin.from('lv_products').update({ preco_cents: 2590 }).eq('id', cat.tradicional.id);
  const confDiv = await c2.cliente.rpc('lv_checkout_confirmar', {
    p_checkout: iniDiv.data.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: 'pix',
  });
  checar('vendedor mudou o preço com o checkout aberto: confirmação recusada (PRECO_MUDOU), nada em silêncio',
    confDiv.error?.hint === 'PRECO_MUDOU', `(${confDiv.error?.hint} ${confDiv.error?.message})`);
  await admin.from('lv_products').update({ preco_cents: 2490 }).eq('id', cat.tradicional.id);
  const confInvalida = await c2.cliente.rpc('lv_checkout_confirmar', {
    p_checkout: iniDiv.data.checkout_id, p_comprador: COMPRADOR, p_endereco: { ...ENDERECO, cep: '123' }, p_frete: 'demo_padrao', p_pagamento: 'pix',
  });
  checar('endereço incompleto recusado pelo banco', confInvalida.error?.hint === 'ENDERECO_INVALIDO');
  const confPag = await c2.cliente.rpc('lv_checkout_confirmar', {
    p_checkout: iniDiv.data.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: 'bitcoin',
  });
  checar('forma de pagamento inexistente recusada', confPag.error?.hint === 'PAGAMENTO_INVALIDO');

  // ------------------------------------------------------------------
  secao('ESTOQUE 4: CHECKOUT 1 RESERVA 3, CHECKOUT 2 PEDE 2');
  const vQ = cat.quatro.variantes.padrao;
  const loteQ = cat.quatro.lotes['Q-4'];
  const q1 = await c1.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vQ, quantidade: 3 }], p_chave: chave() });
  const q2 = await c2.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vQ, quantidade: 2 }], p_chave: chave() });
  checar('checkout 1 reservou 3', !q1.error && (await lote(loteQ)).qtd_disponivel === 1);
  let faltou = null;
  try { faltou = JSON.parse(q2.error?.details ?? 'null'); } catch { faltou = null; }
  checar('checkout 2 recusado por estoque, dizendo que resta 1', q2.error?.hint === 'ESTOQUE_INSUFICIENTE' && faltou?.[0]?.disponivel === 1,
    `(${q2.error?.hint} ${q2.error?.details})`);
  checar('estoque nunca negativo: disponível 1, reservado 3', (await lote(loteQ)).qtd_disponivel === 1 && (await lote(loteQ)).qtd_reservada === 3);
  checar('recusa não deixou reserva parcial nem checkout do comprador 2',
    (await admin.from('lv_stock_reservations').select('id').eq('variant_id', vQ).eq('status', 'ativa')).data?.length === 1);

  // ------------------------------------------------------------------
  secao('EXPIRAÇÃO DO CHECKOUT');
  await admin.from('lv_checkouts').update({ expira_em: new Date(Date.now() - 60000).toISOString() }).eq('id', q1.data.checkout_id);
  await admin.from('lv_stock_reservations').update({ expira_em: new Date(Date.now() - 60000).toISOString() }).eq('checkout_id', q1.data.checkout_id);
  const exp = await admin.rpc('lv_checkout_expirar');
  checar('job de expiração devolve as 3 unidades', !exp.error && exp.data?.unidades_liberadas >= 3 && (await lote(loteQ)).qtd_disponivel === 4
    && (await lote(loteQ)).qtd_reservada === 0, `(${JSON.stringify(exp.data)})`);
  checar('checkout expirado não confirma',
    (await c1.cliente.rpc('lv_checkout_confirmar', { p_checkout: q1.data.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: 'pix' })).error?.hint === 'CHECKOUT_EXPIRADO');
  const novo = await comprar(c2.cliente, [{ variant_id: vQ, quantidade: 2 }]);
  checar('novo comprador consegue comprar depois da expiração', !!novo.pedido?.order_id, `(${novo.erro?.message})`);

  secao('PEDIDO SEM PAGAMENTO NO PRAZO');
  await admin.from('lv_stock_reservations').update({ expira_em: new Date(Date.now() - 60000).toISOString() }).eq('order_id', novo.pedido.order_id);
  await admin.rpc('lv_checkout_expirar');
  const expirado = (await admin.from('lv_orders').select('status').eq('id', novo.pedido.order_id).single()).data;
  checar('pedido cancelado pelo sistema e estoque devolvido', expirado.status === 'cancelado' && (await lote(loteQ)).qtd_disponivel === 4);
  const pagouTarde = await simular(c2.cliente, novo.pedido.order_id, 'aprovado');
  checar('pagamento que chega depois do cancelamento gera reembolso pendente, sem baixar estoque',
    !pagouTarde.error && (await admin.from('lv_refunds').select('status').eq('order_id', novo.pedido.order_id)).data?.[0]?.status === 'pendente'
    && (await lote(loteQ)).qtd_disponivel === 4);

  // ------------------------------------------------------------------
  secao('CANCELAMENTO');
  const antesKg = await lote(cat.especial.lotes['B-1KG']);
  const kg = await comprar(c2.cliente, [{ variant_id: vKg, quantidade: 1 }]);
  checar('segunda variante (1 kg) com preço próprio vira pedido', !!kg.pedido && (await lote(cat.especial.lotes['B-1KG'])).qtd_reservada === antesKg.qtd_reservada + 1);
  const canc = await c2.cliente.rpc('lv_pedido_cancelar', { p_order: kg.pedido.order_id, p_motivo: 'desisti' });
  checar('comprador cancela antes de pagar e o estoque volta', !canc.error && (await lote(cat.especial.lotes['B-1KG'])).qtd_disponivel === antesKg.qtd_disponivel
    && (await lote(cat.especial.lotes['B-1KG'])).qtd_reservada === antesKg.qtd_reservada);
  checar('pagamento do pedido cancelado fica cancelado', (await admin.from('lv_payments').select('status').eq('order_id', kg.pedido.order_id).single()).data.status === 'cancelado');

  const antesLonge2 = await lote(cat.tradicional.lotes['A-LONGE']);
  const antesPerto2 = await lote(cat.tradicional.lotes['A-PERTO']);
  const pago = await comprar(c2.cliente, [{ variant_id: vTrad, quantidade: 1 }]);
  await simular(c2.cliente, pago.pedido.order_id, 'aprovado');
  checar('depois de pago, comprador não cancela', !!(await c2.cliente.rpc('lv_pedido_cancelar', { p_order: pago.pedido.order_id, p_motivo: 'desisti' })).error);
  const cancAdm = await adm.cliente.rpc('lv_pedido_cancelar', { p_order: pago.pedido.order_id, p_motivo: 'cliente pediu por telefone' });
  checar('admin cancela pedido pago antes do envio: estoque devolvido ao lote e reembolso pendente',
    !cancAdm.error && (await admin.from('lv_refunds').select('status, tipo').eq('order_id', pago.pedido.order_id)).data?.[0]?.status === 'pendente'
    && (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_disponivel + (await lote(cat.tradicional.lotes['A-LONGE'])).qtd_disponivel
       === antesPerto2.qtd_disponivel + antesLonge2.qtd_disponivel, `(${cancAdm.error?.message})`);

  // ------------------------------------------------------------------
  secao('FEFO COM DOIS LOTES E UM VENCIDO');
  const perto = (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_disponivel;
  const longe = (await lote(cat.tradicional.lotes['A-LONGE'])).qtd_disponivel;
  const vencido = (await lote(cat.tradicional.lotes['A-VENCIDO'])).qtd_disponivel;
  const muitos = await c1.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vTrad, quantidade: perto + 2 }], p_chave: chave() });
  const { data: reservas } = await admin.from('lv_stock_reservations').select('lote, quantidade').eq('checkout_id', muitos.data?.checkout_id);
  checar(`pedido de ${perto + 2}: esgota o lote mais próximo (${perto}) e completa com o distante (2)`,
    reservas?.find(r => r.lote === 'A-PERTO')?.quantidade === perto && reservas?.find(r => r.lote === 'A-LONGE')?.quantidade === 2);
  checar('lote vencido nunca entra', !reservas?.some(r => r.lote === 'A-VENCIDO') && (await lote(cat.tradicional.lotes['A-VENCIDO'])).qtd_disponivel === vencido);
  const acima = await c2.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vTrad, quantidade: longe - 2 + 1 }], p_chave: chave() });
  checar('estoque vencido não conta como disponível', acima.error?.hint === 'ESTOQUE_INSUFICIENTE');
  checar('abrir outro checkout solta o anterior do mesmo comprador',
    !(await c1.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vEsp, quantidade: 1 }], p_chave: chave() })).error
    && (await lote(cat.tradicional.lotes['A-PERTO'])).qtd_disponivel === perto);

  // ------------------------------------------------------------------
  secao('CONCORRÊNCIA: ESTOQUE 2, A PEDE 2 E B PEDE 1 AO MESMO TEMPO');
  const vD = cat.disputado.variantes.padrao;
  const loteD = cat.disputado.lotes['D-2'];
  let rodadasCertas = 0;
  const RODADAS = 8;
  for (let i = 0; i < RODADAS; i++) {
    const [ra, rb] = await Promise.all([
      c1.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vD, quantidade: 2 }], p_chave: chave() }),
      c2.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vD, quantidade: 1 }], p_chave: chave() }),
    ]);
    const l = await lote(loteD);
    const passaram = [ra, rb].filter(r => !r.error).length;
    const reservado = (ra.error ? 0 : 2) + (rb.error ? 0 : 1);
    if (passaram === 1 && l.qtd_disponivel >= 0 && l.qtd_disponivel + l.qtd_reservada === 2 && l.qtd_reservada === reservado) rodadasCertas++;
    // Solta o que passou para a próxima rodada.
    for (const r of [ra, rb]) {
      if (r.error) continue;
      await admin.from('lv_checkouts').update({ expira_em: new Date(Date.now() - 1000).toISOString() }).eq('id', r.data.checkout_id);
    }
    await admin.rpc('lv_checkout_expirar');
  }
  checar(`${RODADAS} rodadas simultâneas: sempre só um fluxo passa e o lote nunca fica negativo`, rodadasCertas === RODADAS, `(${rodadasCertas}/${RODADAS})`);

  secao('LIMPEZA');
  await limpar();
  const { count: sobra } = await admin.from('lv_orders').select('id', { count: 'exact', head: true }).like('comprador_email', `${MARCA}%`);
  checar('pedidos, usuários, lojas e produtos de teste removidos', sobra === 0 && !(await acharUsuario(EMAIL('comprador1'))));
}

// ---------------------------------------------------------------------
// Cenários de demonstração (ficam no staging)
// ---------------------------------------------------------------------
async function cenarios() {
  secao('CENÁRIOS FICTÍCIOS DE PEDIDO NO STAGING');
  await limpar();
  const cat = await montarCatalogo('teste-cenario');
  const comprador = await (async () => {
    const email = 'teste-cenario-comprador@coffeelivre.test';
    const senha = senhaAleatoria();
    const { data } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
    await c.auth.signInWithPassword({ email, password: senha });
    return { id: data.user.id, cliente: c };
  })();
  const vTrad = cat.tradicional.variantes.padrao;
  const vEsp = cat.especial.variantes.padrao;
  const vKg = cat.especial.variantes.kg;

  const umVendedor = await comprar(comprador.cliente, [{ variant_id: vTrad, quantidade: 2 }]);
  checar('pedido de 1 vendedor (aguardando pagamento)', !!umVendedor.pedido, umVendedor.erro?.message);

  const multi = await comprar(comprador.cliente, [{ variant_id: vTrad, quantidade: 2 }, { variant_id: vEsp, quantidade: 3 }]);
  await simular(comprador.cliente, multi.pedido.order_id);
  checar('pedido multiloja com 2 vendedores (pago)', !!multi.pedido);

  const duasVariantes = await comprar(comprador.cliente, [{ variant_id: vEsp, quantidade: 1 }, { variant_id: vKg, quantidade: 1 }], { frete: 'demo_expresso', pagamento: 'cartao' });
  checar('pedido com 2 variantes do mesmo café (cartão, expresso)', !!duasVariantes.pedido, duasVariantes.erro?.message);

  const cancelado = await comprar(comprador.cliente, [{ variant_id: vEsp, quantidade: 1 }]);
  await comprador.cliente.rpc('lv_pedido_cancelar', { p_order: cancelado.pedido.order_id, p_motivo: 'Comprador desistiu (cenário)' });
  checar('pedido cancelado', !!cancelado.pedido);

  const entregue = await comprar(comprador.cliente, [{ variant_id: vTrad, quantidade: 1 }], { frete: 'demo_economico' });
  await simular(comprador.cliente, entregue.pedido.order_id);
  const { data: subE } = await admin.from('lv_seller_orders').select('id').eq('order_id', entregue.pedido.order_id).single();
  for (const s of ['separacao', 'pronto_para_envio', 'enviado', 'entregue']) {
    await admin.rpc('lv_subpedido_mudar_status', { p_seller_order: subE.id, p_status: s });
  }
  checar('pedido entregue', (await admin.from('lv_orders').select('status').eq('id', entregue.pedido.order_id).single()).data.status === 'entregue');

  const aberto = await comprador.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: vTrad, quantidade: 1 }], p_chave: chave() });
  await admin.from('lv_checkouts').update({ expira_em: new Date(Date.now() - 60000).toISOString() }).eq('id', aberto.data.checkout_id);
  await admin.rpc('lv_checkout_expirar');
  checar('checkout expirado', (await admin.from('lv_checkouts').select('status').eq('id', aberto.data.checkout_id).single()).data.status === 'expirado');

  const semEstoque = await comprador.cliente.rpc('lv_checkout_iniciar', { p_itens: [{ variant_id: cat.disputado.variantes.padrao, quantidade: 3 }], p_chave: chave() });
  checar('estoque insuficiente recusado (2 disponíveis, 3 pedidos)', semEstoque.error?.hint === 'ESTOQUE_INSUFICIENTE');

  // As lojas do cenário saem da vitrine: os pedidos continuam, pelo snapshot.
  await admin.from('lv_stores').update({ ativa: false }).like('slug', 'teste-cenario%');
  console.log('\n  --  lojas do cenário desativadas; pedidos ficam visíveis no admin do staging (limpar com: limpar)');
}

// ---------------------------------------------------------------------
const comando = process.argv[2] ?? 'ciclo';
try {
  if (comando === 'ciclo') await ciclo();
  else if (comando === 'cenarios') await cenarios();
  else if (comando === 'limpar') { await limpar(); ok('limpo'); }
  else { console.error('Comando desconhecido: ' + comando); process.exitCode = 1; }
} catch (e) {
  erro('bancada de pedidos interrompida: ' + (e instanceof Error ? e.stack : e));
  if (comando === 'ciclo') await limpar().catch(() => {});
}
console.log(`\n${criterios} critérios · ${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
if (falhas) process.exitCode = 1;
