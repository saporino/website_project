// Instagram OAuth (Instagram API with Instagram Login / IGAA) — recebe o ?code após o usuário autorizar,
// troca por token de curta duração → longa duração (60 dias) e guarda em studio_social_connections (platform instagram).
// Cada conta (ex.: @cafesaporino, @coficobrasil) autoriza a SI mesma; o company_id vem no state.
// Redirect URI a registrar no app da Meta (Instagram business login):
//   https://<ref>.supabase.co/functions/v1/instagram-oauth
// Secrets necessários: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram-oauth`;
const APP_RETURN = "https://www.cafesaporino.com.br/admin";
// escopos da Instagram API with Instagram Login: ler o básico + publicar conteúdo
const SCOPES = "instagram_business_basic,instagram_business_content_publish";

function html(msg: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:40px;text-align:center">${msg}<p><a href="${APP_RETURN}">Voltar ao Studio</a></p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
  const APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
  if (!APP_ID || !APP_SECRET) return html("❌ Configurar INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET nos secrets do Supabase.");

  // INÍCIO do fluxo: ?start=1&company=<id> → manda o usuário pro Instagram autorizar
  if (url.searchParams.get("start")) {
    const company = url.searchParams.get("company") || "";
    const auth = new URL("https://www.instagram.com/oauth/authorize");
    auth.searchParams.set("client_id", APP_ID);
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", SCOPES);
    auth.searchParams.set("state", company);
    return new Response(null, { status: 302, headers: { Location: auth.toString() } });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // company_id
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return html(`❌ Instagram recusou: ${err}`);
  if (!code) return html("❌ Faltou o código de autorização do Instagram.");

  try {
    // 1) troca o code por token de CURTA duração (~1h)
    const form = new URLSearchParams({
      client_id: APP_ID, client_secret: APP_SECRET,
      grant_type: "authorization_code", redirect_uri: REDIRECT_URI,
      code: code.replace(/#_$/, ""), // o IG às vezes anexa "#_" no fim do code
    });
    const sRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    const sJson = await sRes.json().catch(() => ({}));
    if (!sRes.ok || !sJson.access_token) throw new Error("curta duração: " + JSON.stringify(sJson).slice(0, 250));
    const shortToken = sJson.access_token as string;

    // 2) troca por token de LONGA duração (60 dias) — depois o cron renova sozinho
    const lRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${shortToken}`);
    const lJson = await lRes.json().catch(() => ({}));
    if (!lRes.ok || !lJson.access_token) throw new Error("longa duração: " + JSON.stringify(lJson).slice(0, 250));
    const longToken = lJson.access_token as string;
    const expiresAt = lJson.expires_in ? new Date(Date.now() + lJson.expires_in * 1000).toISOString() : null;

    // 3) descobre id + @ da conta (id é o que o publish usa em /{id}/media)
    const meRes = await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${longToken}`);
    const me = await meRes.json().catch(() => ({}));
    const accountId = String(me.user_id || sJson.user_id || "");
    const username = me.username ? `@${me.username}` : null;
    if (!accountId) throw new Error("não consegui identificar a conta do Instagram.");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("studio_social_connections").upsert({
      company_id: state || null, platform: "instagram",
      account_id: accountId, account_name: username, access_token: longToken,
      expires_at: expiresAt, status: "connected", updated_at: new Date().toISOString(),
      meta: { scope: SCOPES, connected_via: "oauth" },
    }, { onConflict: "company_id,platform" });

    return html(`✅ Instagram conectado (${username || accountId})! Pode fechar esta aba e voltar ao Studio.`);
  } catch (e) {
    return html(`❌ Erro ao conectar o Instagram: ${(e as Error).message}`);
  }
});
