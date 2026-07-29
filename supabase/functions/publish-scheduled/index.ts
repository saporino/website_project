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
    // campanhas agendadas (IG ou TikTok), com hora vencida e mídia anexada
    const fn: Record<string, string> = { instagram: "publish-instagram", tiktok: "publish-tiktok" };
    const { data: due } = await db.from("studio_campaigns")
      .select("id, platform")
      .in("platform", ["instagram", "tiktok"]).eq("status", "scheduled")
      .not("media_path", "is", null)
      .lte("scheduled_at", nowIso)
      .limit(20);

    const results: any[] = [];
    for (const c of due || []) {
      const target = fn[c.platform];
      if (!target) continue;
      const r = await fetch(`${url}/functions/v1/${target}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": service },
        body: JSON.stringify({ campaign_id: c.id }),
      });
      const j = await r.json().catch(() => ({}));
      // se falhou, marca 'error' pra NÃO ficar retentando em loop a cada 5 min (o admin corrige e republica na mão)
      if (!j.ok) await db.from("studio_campaigns").update({ status: "error" }).eq("id", c.id).eq("status", "scheduled");
      results.push({ id: c.id, platform: c.platform, ok: !!j.ok, error: j.message || null });
    }
    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
