// Studio — renova os tokens do TikTok antes de expirarem (access token dura só 24h;
// vem com refresh_token de ~1 ano). Igual o do IG, mas pro TikTok. Sem isso, publicar quebra em 1 dia.
// Chamado pelo pg_cron (a cada 2h) com x-internal-secret = service role, OU por um admin.
// Deploy: npx supabase functions deploy refresh-tiktok-token --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TT = "https://open.tiktokapis.com/v2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    if (!CLIENT_KEY || !CLIENT_SECRET) return json({ error: "Configurar TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nos secrets." }, 500);

    // gate: cron (x-internal-secret) OU admin logado
    if (req.headers.get("x-internal-secret") !== service) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const db = createClient(url, service);
    const { data: conns } = await db.from("studio_social_connections")
      .select("*").eq("platform", "tiktok").eq("status", "connected").not("refresh_token", "is", null);

    const soon = Date.now() + 8 * 60 * 60 * 1000; // renova se expira em < 8h (ou sem data)
    const results: any[] = [];
    for (const c of conns || []) {
      if (c.expires_at && new Date(c.expires_at).getTime() > soon) { results.push({ id: c.id, skipped: "ainda válido" }); continue; }
      try {
        const body = new URLSearchParams({
          client_key: CLIENT_KEY, client_secret: CLIENT_SECRET,
          grant_type: "refresh_token", refresh_token: c.refresh_token,
        });
        const r = await fetch(`${TT}/oauth/token/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error || !j.access_token) {
          await db.from("studio_social_connections").update({
            meta: { ...(c.meta || {}), refresh_error: JSON.stringify(j).slice(0, 200), refresh_tried_at: new Date().toISOString() },
          }).eq("id", c.id);
          results.push({ id: c.id, ok: false, error: (j?.error_description || j?.error || "falha ao renovar").toString().slice(0, 120) });
          continue;
        }
        const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
        await db.from("studio_social_connections").update({
          access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, expires_at: expiresAt, status: "connected",
          meta: { ...(c.meta || {}), refresh_error: null, refreshed_at: new Date().toISOString(), scope: j.scope || (c.meta || {}).scope },
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);
        results.push({ id: c.id, ok: true, expires_at: expiresAt });
      } catch (e) {
        results.push({ id: c.id, ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 120) });
      }
    }
    return json({ ok: true, checked: (conns || []).length, results });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
