// Studio — publica UMA campanha no Instagram via Instagram API with Instagram Login (graph.instagram.com).
// Recebe { campaign_id }. Gate: admin (chamada do app) OU x-internal-secret = service role (chamada do cron/agendador).
// Fluxo: container de mídia (REELS/IMAGE) → aguarda processar (vídeo) → media_publish → pega permalink.
// A mídia sai de studio_campaigns.media_path (arte FINAL da Saporino) via signed URL de 1h. Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const IG = "https://graph.instagram.com/v21.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Faz todo o fluxo de publicação de uma campanha. Retorna { ok, media_id, permalink } ou lança erro.
async function publishCampaign(db: any, url: string, campaignId: string) {
  const { data: c } = await db.from("studio_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.platform !== "instagram") throw new Error("Esta campanha não é do Instagram.");
  if (!c.media_path) throw new Error("Anexe a arte final da Saporino (imagem ou vídeo) na campanha antes de publicar.");

  const { data: conn } = await db.from("studio_social_connections")
    .select("*").eq("company_id", c.company_id).eq("platform", "instagram").maybeSingle();
  if (!conn || conn.status !== "connected" || !conn.access_token || !conn.account_id)
    throw new Error("Instagram não está conectado para esta empresa (aba Conexões).");

  // signed URL público-temporário da arte (o IG precisa BAIXAR a mídia)
  const { data: signed, error: sErr } = await db.storage.from("studio-videos").createSignedUrl(c.media_path, 3600);
  if (sErr || !signed?.signedUrl) throw new Error("Falha ao gerar o link temporário da mídia.");
  const mediaUrl = signed.signedUrl;
  const isVideo = c.media_type === "video" || /\.(mp4|mov|m4v)$/i.test(c.media_path);
  const token = conn.access_token as string;
  const igid = conn.account_id as string;

  // 1) container
  const p = new URLSearchParams();
  p.set("caption", c.content || "");
  p.set("access_token", token);
  if (isVideo) { p.set("media_type", "REELS"); p.set("video_url", mediaUrl); }
  else { p.set("image_url", mediaUrl); }
  const cRes = await fetch(`${IG}/${igid}/media`, { method: "POST", body: p });
  const cJson = await cRes.json().catch(() => ({}));
  if (!cRes.ok || !cJson.id) throw new Error("IG (criar mídia): " + JSON.stringify(cJson).slice(0, 250));
  const containerId = cJson.id as string;

  // 2) vídeo precisa processar → aguarda FINISHED (até ~100s)
  if (isVideo) {
    let ok = false;
    for (let i = 0; i < 25; i++) {
      await sleep(4000);
      const sRes = await fetch(`${IG}/${containerId}?fields=status_code&access_token=${token}`);
      const sJson = await sRes.json().catch(() => ({}));
      if (sJson.status_code === "FINISHED") { ok = true; break; }
      if (sJson.status_code === "ERROR" || sJson.status_code === "EXPIRED")
        throw new Error("IG não processou o vídeo (" + sJson.status_code + "). Verifique se é MP4 9:16.");
    }
    if (!ok) throw new Error("O vídeo demorou demais pra processar no IG. Tente de novo.");
  }

  // 3) publica
  const pp = new URLSearchParams();
  pp.set("creation_id", containerId);
  pp.set("access_token", token);
  const pubRes = await fetch(`${IG}/${igid}/media_publish`, { method: "POST", body: pp });
  const pubJson = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok || !pubJson.id) throw new Error("IG (publicar): " + JSON.stringify(pubJson).slice(0, 250));
  const mediaId = pubJson.id as string;

  // 4) permalink (não crítico)
  let permalink: string | null = null;
  try {
    const lRes = await fetch(`${IG}/${mediaId}?fields=permalink&access_token=${token}`);
    const lJson = await lRes.json();
    permalink = lJson.permalink || null;
  } catch { /* ignora */ }

  await db.from("studio_campaigns").update({
    status: "published", published_at: new Date().toISOString(),
    platform_post_id: mediaId, external_url: permalink, publish_error: null,
  }).eq("id", campaignId);

  return { ok: true, media_id: mediaId, permalink };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // gate: interno (cron) via x-internal-secret == service role, OU admin logado
    const internal = req.headers.get("x-internal-secret");
    const isInternal = internal && internal === service;
    if (!isInternal) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id é obrigatório." }, 400);

    const db = createClient(url, service);
    try {
      const out = await publishCampaign(db, url, campaign_id);
      return json(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("studio_campaigns").update({ publish_error: msg }).eq("id", campaign_id);
      return json({ error: "publish_failed", message: msg }, 502);
    }
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
