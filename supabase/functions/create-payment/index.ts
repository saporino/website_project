import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { priceCheckout, round2, type ProductInfo, type CartLineInput } from '../_shared/pricing.ts';
import { checkRateLimit, clientKey } from '../_shared/rateLimit.ts';
import { logEdge, newRequestId } from '../_shared/log.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FN = 'create-payment';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const rid = newRequestId(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Rate limit — FAIL-CLOSED (endpoint financeiro). Requer a migration
  // edge_rate_limits aplicada antes do deploy.
  const allowed = await checkRateLimit(supabase, clientKey(req, FN), 20, 60, { failClosed: true });
  if (!allowed) {
    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'warn', status: 429, error_text: 'rate limited' });
    return json({ error: 'Too many requests' }, 429);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const externalReference: string | undefined = body?.external_reference;
    if (!externalReference) return json({ error: 'external_reference (order id) obrigatório' }, 400);

    // 1) Ler o pedido real (o browser NÃO dita preço).
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, order_type, shipping_cost, mercadopago_preference_id, order_public_token_hash')
      .eq('id', externalReference)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ error: 'Pedido não encontrado' }, 404);
    if (order.status !== 'pending') return json({ error: 'Pedido não está pendente' }, 409);
    // Só opera pedidos avulsos criados pelo fluxo válido (create-checkout-order,
    // que grava o token hash). Impede criar preferência para um UUID arbitrário.
    if (order.order_type === 'single' && !order.order_public_token_hash) {
      return json({ error: 'Pedido inválido' }, 400);
    }

    // Idempotência: se já existe preferência para este pedido pendente, reusar.
    if (order.mercadopago_preference_id) {
      await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { idempotent: true, order: order.id } });
      return json({ id: order.mercadopago_preference_id, idempotent: true });
    }

    // 2) Itens reais do pedido.
    const { data: itemRows, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, product_id, quantity, unit_price, product_name')
      .eq('order_id', order.id);
    if (itemsErr) throw itemsErr;
    if (!itemRows || itemRows.length === 0) return json({ error: 'Pedido sem itens' }, 400);

    const shippingCost = round2(Number(order.shipping_cost) || 0);
    let mpItems: { title: string; quantity: number; unit_price: number; currency_id: string }[] = [];

    if (order.order_type === 'single') {
      // ---- B2C avulso: servidor RECALCULA tudo a partir de products.price ----
      const ids = [...new Set(itemRows.map((r) => r.product_id).filter(Boolean))];
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, is_active')
        .in('id', ids);
      if (prodErr) throw prodErr;
      const byId = new Map<string, ProductInfo>();
      for (const p of prods || []) byId.set(p.id, { id: p.id, name: p.name, price: Number(p.price), is_active: !!p.is_active });

      const input: CartLineInput[] = itemRows.map((r) => ({ product_id: r.product_id, quantity: r.quantity }));
      const priced = priceCheckout(input, byId);
      if (!priced.ok) {
        await logEdge(supabase, { function_name: FN, request_id: rid, level: 'warn', status: 400, error_text: `${priced.code}: ${priced.error}`, meta: { order: order.id } });
        return json({ error: priced.error, code: priced.code }, 400);
      }

      // Persistir os valores OFICIAIS (snapshot) — corrige qualquer adulteração do browser.
      for (let i = 0; i < itemRows.length; i++) {
        const line = priced.lines[i];
        await supabase.from('order_items')
          .update({ unit_price: line.unit_price, subtotal: line.subtotal })
          .eq('id', itemRows[i].id);
      }
      const serverTotal = round2(priced.itemsTotal + shippingCost);
      await supabase.from('orders').update({ total_amount: serverTotal }).eq('id', order.id);

      mpItems = priced.lines.map((l) => ({ title: l.name, quantity: l.quantity, unit_price: l.unit_price, currency_id: 'BRL' }));
    } else {
      // ---- Assinatura: desconto por tier é legítimo. Validação ESTRUTURAL apenas;
      //      preço/total mantidos (a autoridade server-side do desconto vs tiers é
      //      uma pendência documentada). ----
      const ids = [...new Set(itemRows.map((r) => r.product_id).filter(Boolean))];
      const { data: prods, error: prodErr } = await supabase
        .from('products').select('id, name, is_active').in('id', ids);
      if (prodErr) throw prodErr;
      const active = new Set((prods || []).filter((p) => p.is_active).map((p) => p.id));
      for (const r of itemRows) {
        if (!r.product_id || !active.has(r.product_id)) return json({ error: 'Produto inválido ou inativo na assinatura', code: 'PRODUCT_INVALID' }, 400);
        if (!Number.isInteger(r.quantity) || r.quantity <= 0) return json({ error: 'Quantidade inválida', code: 'BAD_QTY' }, 400);
        if (!(Number(r.unit_price) > 0)) return json({ error: 'Preço inválido', code: 'BAD_PRICE' }, 400);
      }
      mpItems = itemRows.map((r) => ({ title: r.product_name || 'Assinatura', quantity: r.quantity, unit_price: round2(Number(r.unit_price)), currency_id: 'BRL' }));
    }

    if (shippingCost > 0) mpItems.push({ title: 'Frete', quantity: 1, unit_price: shippingCost, currency_id: 'BRL' });

    // 3) Access token — resiliente (env é a fonte; admin_settings NÃO guarda secret).
    let dbAccessToken: string | null = null;
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings').select('mercado_pago_access_token').maybeSingle();
    if (settingsError) console.error('admin_settings indisponível, usando env secret:', settingsError.message);
    else dbAccessToken = settings?.mercado_pago_access_token ?? null;
    const accessToken = dbAccessToken || Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) return json({ error: 'Mercado Pago não configurado' }, 503);

    // 4) Criar a preferência com os VALORES DO SERVIDOR.
    const preferenceData = {
      items: mpItems,
      back_urls: body?.back_urls,
      auto_return: body?.auto_return,
      payer: body?.payer,
      external_reference: order.id,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(preferenceData),
    });
    if (!response.ok) {
      const errText = await response.text();
      await logEdge(supabase, { function_name: FN, request_id: rid, level: 'error', status: 502, error_text: `MP ${response.status}: ${errText.slice(0, 300)}`, meta: { order: order.id } });
      return json({ error: 'Falha ao criar preferência de pagamento' }, 502);
    }
    const data = await response.json();

    // Guardar a preferência no pedido (idempotência em retries).
    if (data?.id) await supabase.from('orders').update({ mercadopago_preference_id: data.id }).eq('id', order.id);

    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { order: order.id, items: mpItems.length } });
    return json(data);
  } catch (error) {
    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'error', status: 500, error_text: (error as Error).message });
    return json({ error: 'Erro interno ao processar pagamento' }, 500);
  }
});
