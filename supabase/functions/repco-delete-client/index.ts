// Exclusão FORÇADA de cliente RepCo com pedidos vinculados (cascata + storage).
// Só funciona se: (1) usuário é admin E (2) a trava "allow_delete_clients_with_orders"
// está LIGADA em site_settings. Protege o histórico de vendas real por padrão.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Extrai o caminho dentro do bucket "invoices" a partir de URL completa ou caminho relativo.
function invoicePath(v: string | null): string | null {
  if (!v) return null;
  const marker = "/invoices/";
  const i = v.indexOf(marker);
  if (i >= 0) return v.slice(i + marker.length);
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, ""); // já é caminho relativo
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) precisa ser admin
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden", message: "Apenas o administrador pode excluir cliente com pedidos." }, 403);

    const db = createClient(url, service);

    // 2) trava precisa estar liberada
    const { data: flag } = await db.from("site_settings").select("value").eq("key", "allow_delete_clients_with_orders").maybeSingle();
    if (!flag?.value) return json({ error: "locked", message: "A trava de segurança está ligada. Libere em Configurações para excluir clientes com pedidos." }, 409);

    const { client_id } = await req.json().catch(() => ({}));
    if (!client_id) return json({ error: "client_id ausente" }, 400);

    // Coleta pedidos do cliente
    const { data: orders } = await db.from("representative_orders").select("id, invoice_pdf_url, invoice_xml_url, payment_proof_url").eq("representative_client_id", client_id);
    const orderIds = (orders || []).map((o: any) => o.id);

    // Arquivos de storage (bucket invoices) de pedidos + parcelas + payouts
    const paths: string[] = [];
    for (const o of orders || []) {
      for (const f of [o.invoice_pdf_url, o.invoice_xml_url, o.payment_proof_url]) { const p = invoicePath(f); if (p) paths.push(p); }
    }
    if (orderIds.length) {
      const { data: insts } = await db.from("representative_order_installments").select("boleto_url, proof_url").in("order_id", orderIds);
      for (const it of insts || []) { for (const f of [it.boleto_url, it.proof_url]) { const p = invoicePath(f); if (p) paths.push(p); } }
      const { data: comms } = await db.from("representative_commissions").select("id").in("order_id", orderIds);
      const commIds = (comms || []).map((c: any) => c.id);
      if (commIds.length) {
        const { data: payouts } = await db.from("representative_commission_payouts").select("proof_url").in("commission_id", commIds);
        for (const p of payouts || []) { const pp = invoicePath(p.proof_url); if (pp) paths.push(pp); }
        await db.from("representative_commission_payouts").delete().in("commission_id", commIds);
      }
      await db.from("representative_commissions").delete().in("order_id", orderIds);
      await db.from("representative_order_items").delete().in("order_id", orderIds);
      await db.from("representative_order_notes").delete().in("order_id", orderIds);
      await db.from("representative_order_installments").delete().in("order_id", orderIds);
    }
    if (paths.length) { try { await db.storage.from("invoices").remove(paths); } catch { /* arquivos podem já não existir */ } }
    if (orderIds.length) await db.from("representative_orders").delete().in("id", orderIds);

    // Lead de prospecção volta para a lista
    const { data: leads } = await db.from("prospect_leads").select("id").eq("representative_client_id", client_id);
    const leadIds = (leads || []).map((l: any) => l.id);
    if (leadIds.length) await db.from("prospect_leads").update({ representative_client_id: null, status: "assigned", converted_at: null }).in("id", leadIds);

    // Finalmente o cliente
    const { error: delErr } = await db.from("representative_clients").delete().eq("id", client_id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true, deleted_orders: orderIds.length, deleted_files: paths.length, freed_leads: leadIds.length });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
