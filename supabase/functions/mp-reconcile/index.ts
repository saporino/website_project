// Reconciliação de pagamentos do Mercado Pago.
//
// Existe porque webhook falha. Falhou de verdade em 06/09/2026: o primeiro
// pagamento real da loja foi cobrado do cliente e a notificação quebrou ao gravar
// no banco, deixando o pedido "pendente" para sempre. O dinheiro tinha saído.
//
// Esta função pergunta ao Mercado Pago se existe pagamento para os pedidos
// pendentes e aplica o resultado. Serve para recuperar o que se perdeu e como
// rede de segurança permanente: nenhum pagamento fica invisível porque uma
// notificação se perdeu no caminho.
//
// Exige administrador. Não cria nem altera nada no Mercado Pago — só lê.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapMpStatus, decideOrderUpdate, mapPaymentMethod, mapOrderStage } from '../_shared/mpWebhook.ts';
import { mpAccessToken } from '../_shared/mpCredentials.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(url, service);

  try {
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "apenas administrador" }, 403);

    const body = await req.json().catch(() => ({}));
    const dias: number = Number.isFinite(body.dias) ? Number(body.dias) : 7;
    const aplicar: boolean = body.aplicar === true;   // sem isto, é só diagnóstico

    let q = db.from("orders")
      .select("id, order_number, status, paid_at, seller_company_id, total_amount, mercadopago_preference_id")
      .eq("status", "pending")
      .not("mercadopago_preference_id", "is", null)
      .gte("created_at", new Date(Date.now() - dias * 86400000).toISOString());
    if (body.order_id) q = q.eq("id", body.order_id);

    const { data: pedidos, error: errPed } = await q;
    if (errPed) return json({ error: errPed.message }, 500);

    const resultado = [];
    for (const p of pedidos ?? []) {
      const { data: empresa } = await db.from("companies")
        .select("id, name, payment_account").eq("id", p.seller_company_id).maybeSingle();
      const cred = mpAccessToken(empresa?.payment_account);
      if (!cred) { resultado.push({ pedido: p.order_number, situacao: "empresa sem credencial" }); continue; }

      // Procura o pagamento pelo identificador do pedido.
      const r = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(p.id)}`,
        { headers: { Authorization: `Bearer ${cred.token}` } },
      );
      if (!r.ok) { resultado.push({ pedido: p.order_number, situacao: `busca falhou (HTTP ${r.status})` }); continue; }

      const busca = await r.json();
      const pagamentos = (busca?.results ?? []) as Array<Record<string, unknown>>;
      if (pagamentos.length === 0) { resultado.push({ pedido: p.order_number, situacao: "nenhum pagamento encontrado" }); continue; }

      // O que vale é o pagamento aprovado; sem aprovado, o mais recente.
      const pago = pagamentos.find(x => x.status === "approved") ?? pagamentos[pagamentos.length - 1];
      const novoStatus = mapMpStatus(String(pago.status));
      const decisao = decideOrderUpdate({ status: p.status, paid_at: p.paid_at }, novoStatus);

      const item: Record<string, unknown> = {
        pedido: p.order_number,
        empresa: empresa?.name,
        valor: p.total_amount,
        status_no_mp: pago.status,
        viraria: novoStatus,
        pagamento_id: pago.id,
        meio: mapPaymentMethod(String(pago.payment_type_id ?? ""), String(pago.payment_method_id ?? "")),
      };

      if (!decisao.apply) { item.situacao = `ignorado (${decisao.reason})`; resultado.push(item); continue; }

      if (!aplicar) { item.situacao = "PENDENTE DE APLICAR (envie aplicar:true)"; resultado.push(item); continue; }

      const payload: Record<string, unknown> = {
        status: novoStatus,
        mercadopago_payment_id: String(pago.id),
        mercadopago_collection_status: pago.status,
        payment_method: item.meio,
        order_status: mapOrderStage(novoStatus),
      };
      if (decisao.setPaidAt) payload.paid_at = new Date().toISOString();

      const { error: upErr } = await db.from("orders").update(payload).eq("id", p.id);
      item.situacao = upErr ? `falhou: ${upErr.message}` : "APLICADO";
      resultado.push(item);
    }

    return json({
      modo: aplicar ? "aplicando" : "somente diagnostico",
      pedidos_analisados: pedidos?.length ?? 0,
      resultado,
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
