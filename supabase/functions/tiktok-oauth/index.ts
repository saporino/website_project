// TikTok OAuth (Login Kit) — recebe o ?code após o usuário autorizar, troca por
// access_token + refresh_token e guarda em studio_social_connections (platform tiktok).
// Redirect URI a registrar no app TikTok:
//   https://<ref>.supabase.co/functions/v1/tiktok-oauth
// Secrets necessários: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth`;
// URL pra onde devolvemos o usuário no fim (o admin/Studio)
const APP_RETURN = "https://www.cafesaporino.com.br/admin";

function html(msg: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:40px;text-align:center">${msg}<p><a href="${APP_RETURN}">Voltar ao Studio</a></p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const SCOPES = "user.info.basic,video.upload"; // video.publish só depois da auditoria

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
  const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
  if (!CLIENT_KEY || !CLIENT_SECRET) return html("❌ Configurar TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nos secrets do Supabase.");

  // INÍCIO do fluxo: ?start=1&company=<id> → manda o usuário pro TikTok autorizar
  if (url.searchParams.get("start")) {
    const company = url.searchParams.get("company") || "";
    const auth = new URL("https://www.tiktok.com/v2/auth/authorize/");
    auth.searchParams.set("client_key", CLIENT_KEY);
    auth.searchParams.set("scope", SCOPES);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("state", company);
    return new Response(null, { status: 302, headers: { Location: auth.toString() } });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // company_id
  const err = url.searchParams.get("error");
  if (err) return html(`❌ TikTok recusou: ${err}`);
  if (!code) return html("❌ Faltou o código de autorização do TikTok.");

  try {
    // troca o code por token
    const body = new URLSearchParams({
      client_key: CLIENT_KEY, client_secret: CLIENT_SECRET,
      code, grant_type: "authorization_code", redirect_uri: REDIRECT_URI,
    });
    const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(JSON.stringify(j).slice(0, 300));

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
    await supabase.from("studio_social_connections").upsert({
      company_id: state || null, platform: "tiktok",
      account_id: j.open_id || null, access_token: j.access_token, refresh_token: j.refresh_token || null,
      expires_at: expiresAt, status: "connected", updated_at: new Date().toISOString(),
      meta: { scope: j.scope || null },
    }, { onConflict: "company_id,platform" });

    return html("✅ TikTok conectado! Pode fechar esta aba e voltar ao Studio.");
  } catch (e) {
    return html(`❌ Erro ao conectar o TikTok: ${(e as Error).message}`);
  }
});
