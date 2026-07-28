// Studio — agendador: publica campanhas do Instagram cujo scheduled_at já chegou.
// Chamado pelo pg_cron (a cada 5 min) com header x-internal-secret = service role.
// Delega a publicação pra função publish-instagram (mesma lógica). Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-internal-secret" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (req.headers.get("x-internal-secret") !== service) return json({ error: "forbidden" }, 403);

    const db = createClient(url, service);
    const nowIso = new Date().toISOString();
    // campanhas do IG agendadas, com hora vencida e mídia anexada
    const { data: due } = await db.from("studio_campaigns")
      .select("id")
      .eq("platform", "instagram").eq("status", "scheduled")
      .not("media_path", "is", null)
      .lte("scheduled_at", nowIso)
      .limit(10);

    const ids = (due || []).map((r: any) => r.id);
    const results: any[] = [];
    for (const id of ids) {
      const r = await fetch(`${url}/functions/v1/publish-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": service },
        body: JSON.stringify({ campaign_id: id }),
      });
      const j = await r.json().catch(() => ({}));
      results.push({ id, ok: !!j.ok, error: j.message || null });
    }
    return json({ ok: true, processed: ids.length, results });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
