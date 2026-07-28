// Studio — renova os tokens do Instagram (Instagram Login, IGAA...) antes de expirarem.
// Token long-lived dura 60 dias e pode ser renovado por mais 60. Sem isso, o "Publicar" quebra.
// Chamado pelo pg_cron (a cada 30 min) com x-internal-secret = service role, OU por um admin.
// Usa a tabela studio_social_connections (nao cria social_tokens). Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const IG = "https://graph.instagram.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // gate: cron (x-internal-secret) OU admin logado
    const internal = req.headers.get("x-internal-secret");
    if (internal !== service) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const db = createClient(url, service);
    // pega conexões do IG conectadas (renova as que expiram em < 10 dias, ou sem data conhecida)
    const { data: conns } = await db.from("studio_social_connections")
      .select("*").eq("platform", "instagram").eq("status", "connected").not("access_token", "is", null);

    const soon = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 dias
    const results: any[] = [];
    for (const c of conns || []) {
      // se ainda falta muito pra expirar, não gasta chamada
      if (c.expires_at && new Date(c.expires_at).getTime() > soon) { results.push({ id: c.id, skipped: "ainda válido" }); continue; }
      try {
        const r = await fetch(`${IG}/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.access_token}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.access_token) {
          await db.from("studio_social_connections").update({
            meta: { ...(c.meta || {}), refresh_error: JSON.stringify(j).slice(0, 200), refresh_tried_at: new Date().toISOString() },
          }).eq("id", c.id);
          results.push({ id: c.id, ok: false, error: (j?.error?.message || "falha ao renovar").slice(0, 120) });
          continue;
        }
        const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
        await db.from("studio_social_connections").update({
          access_token: j.access_token, expires_at: expiresAt, status: "connected",
          meta: { ...(c.meta || {}), refresh_error: null, refreshed_at: new Date().toISOString() }, updated_at: new Date().toISOString(),
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
