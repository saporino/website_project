import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { priceCheckout, round2, type ProductInfo, type CartLineInput } from '../_shared/pricing.ts';
import { checkRateLimit, clientKey } from '../_shared/rateLimit.ts';
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

    // Frete: preço oficial da transportadora (nunca do browser).
    let shippingCost = 0;
    let carrierName: string | null = null;
    const carrierId = str(c.shipping_carrier_id || body?.shipping_carrier_id, 64);
    if (carrierId) {
      const { data: carrier } = await supabase.from('shipping_carriers').select('name, price').eq('id', carrierId).maybeSingle();
      if (carrier) { shippingCost = round2(Number(carrier.price) || 0); carrierName = carrier.name; }
    }

    // Endereço (composto, com limites).
    const address = [
      `${str(c.street, 120)}, ${str(c.number, 20)}`,
      str(c.complement, 60) ? str(c.complement, 60) : null,
      `${str(c.neighborhood, 80)}, ${str(c.city, 80)}/${str(c.state, 20)}`,
      str(c.cep, 20) ? `CEP ${str(c.cep, 20)}` : null,
    ].filter(Boolean).join(' — ');

    const { token, hash } = await makeToken();
    const total = round2(priced.itemsTotal + shippingCost);

    // Cria o pedido (SERVICE ROLE — o browser não insere direto).
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      user_id: null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      shipping_address: address,
      shipping_recipient: str(c.recipient_name, 120) || name,
      is_gift: !!c.is_gift,
      shipping_carrier_id: carrierId || null,
      shipping_carrier_name: carrierName,
      shipping_cost: shippingCost,
      total_amount: total,
      status: 'pending',
      order_type: 'single',
      order_public_token_hash: hash,
    }).select('id, order_number, total_amount').single();
    if (orderErr) throw orderErr;

    // Itens (SERVICE ROLE) com preços oficiais.
    const itemRows = priced.lines.map((l) => ({
      order_id: order.id, product_id: l.product_id, product_name: l.name,
      quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'info', status: 200, meta: { order: order.id, items: itemRows.length } });
    return json({ order_id: order.id, public_token: token, order_number: order.order_number, total_amount: order.total_amount });
  } catch (error) {
    await logEdge(supabase, { function_name: FN, request_id: rid, level: 'error', status: 500, error_text: (error as Error).message });
    return json({ error: 'Erro ao criar pedido' }, 500);
  }
});
