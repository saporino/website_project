// TikTok OAuth (Login Kit) — recebe o ?code após o usuário autorizar, troca por
// access_token + refresh_token e guarda em studio_social_connections (platform tiktok).
// O state leva a MARCA (aba do Studio): cada marca tem a sua conta.
// Redirect URI a registrar no app TikTok:
//   https://<ref>.supabase.co/functions/v1/tiktok-oauth
// Secrets necessários: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth`;
// URL pra onde devolvemos o usuário no fim (o admin/Studio)
const APP_RETURN = "https://www.cafesaporino.com.br/admin";

// Volta pro Studio (aba Conexões da marca) com o resultado na URL. Página HTML própria não
// serve: o gateway do Supabase entrega HTML de função como texto puro.
function html(msg: string, marca?: string) {
  const u = new URL(APP_RETURN);
  u.searchParams.set("studio_conexao", msg.startsWith("✅") ? "ok" : "erro");
  u.searchParams.set("studio_msg", msg.replace(/<[^>]+>/g, "").replace(/^(✅|❌|⚠️)\s*/u, ""));
  if (marca) u.searchParams.set("studio_marca", marca);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

const SCOPES = "user.info.basic,video.upload"; // video.publish só depois da auditoria

// state "b:<brand_id>" → a marca; state antigo (company_id) → marca principal da empresa.
async function marcaDoState(db: any, state: string | null) {
  if (!state) return null;
  const cols = "id, name, company_id, organization_id";
  if (state.startsWith("b:")) {
    const { data } = await db.from("studio_brand_profiles").select(cols).eq("id", state.slice(2)).maybeSingle();
    return data;
  }
  const { data } = await db.from("studio_brand_profiles").select(cols).eq("company_id", state)
    .order("is_primary", { ascending: false }).order("ordem").limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
  const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
  if (!CLIENT_KEY || !CLIENT_SECRET) return html("❌ Configurar TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nos secrets do Supabase.");

  // INÍCIO do fluxo: ?start=1&brand=<id> (ou &company=<id>, legado) → manda o usuário pro TikTok autorizar
  if (url.searchParams.get("start")) {
    const brand = url.searchParams.get("brand");
    const alvo = brand ? `b:${brand}` : (url.searchParams.get("company") || "");
    const auth = new URL("https://www.tiktok.com/v2/auth/authorize/");
    auth.searchParams.set("client_key", CLIENT_KEY);
    auth.searchParams.set("scope", SCOPES);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("state", alvo);
    return new Response(null, { status: 302, headers: { Location: auth.toString() } });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // b:<brand_id> ou company_id (legado)
  const err = url.searchParams.get("error");
  if (err) return html(`❌ TikTok recusou: ${err}`);
  if (!code) return html("❌ Faltou o código de autorização do TikTok.");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const marca = await marcaDoState(supabase, state);
    if (!marca) return html("❌ Não sei a qual marca ligar esta conta. Volte ao Studio e clique em Conectar na aba da marca.");

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

    const expiresAt = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
    const { error } = await supabase.from("studio_social_connections").upsert({
      brand_id: marca.id, company_id: marca.company_id, organization_id: marca.organization_id, platform: "tiktok",
      account_id: j.open_id || null, access_token: j.access_token, refresh_token: j.refresh_token || null,
      expires_at: expiresAt, status: "connected", updated_at: new Date().toISOString(),
      meta: { scope: j.scope || null },
    }, { onConflict: "brand_id,platform" });
    if (error) throw new Error(error.message);

    return html(`✅ TikTok conectado à marca ${marca.name}.`, marca.id);
  } catch (e) {
    return html(`❌ Erro ao conectar o TikTok: ${(e as Error).message}`);
  }
});
