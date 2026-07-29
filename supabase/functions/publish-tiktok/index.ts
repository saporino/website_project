// Studio — publica UMA campanha no TikTok via Content Posting API (PULL_FROM_URL).
// Recebe { campaign_id }. Gate: admin OU x-internal-secret = service role (cron).
// Só vídeo (TikTok não posta imagem por esta rota). A mídia sai de studio_campaigns.media_path (signed URL 1h).
// Requer: conexão TikTok conectada (scope video.publish, após auditoria) + domínio do storage verificado no app TikTok.
// privacy_level: sandbox exige SELF_ONLY; produção usa PUBLIC_TO_EVERYONE (env TIKTOK_PRIVACY). Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TT = "https://open.tiktokapis.com/v2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function publishCampaign(db: any, campaignId: string) {
  const { data: c } = await db.from("studio_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!c) throw new Error("Campanha não encontrada.");
  if (c.platform !== "tiktok") throw new Error("Esta campanha não é do TikTok.");
  if (!c.media_path) throw new Error("Anexe a arte final da Saporino (vídeo MP4 9:16) na campanha antes de publicar.");
  const isVideo = c.media_type === "video" || /\.(mp4|mov|m4v)$/i.test(c.media_path);
  if (!isVideo) throw new Error("O TikTok só publica vídeo por aqui. Anexe um vídeo (MP4 9:16).");

  const { data: conn } = await db.from("studio_social_connections")
    .select("*").eq("company_id", c.company_id).eq("platform", "tiktok").maybeSingle();
  if (!conn || conn.status !== "connected" || !conn.access_token)
    throw new Error("TikTok não está conectado para esta empresa (aba Conexões).");

  const token = conn.access_token as string;

  // baixa os bytes do vídeo do nosso storage (envio direto = FILE_UPLOAD, sem verificar domínio)
  const { data: file, error: dErr } = await db.storage.from("studio-videos").download(c.media_path);
  if (dErr || !file) throw new Error("Falha ao baixar o vídeo do storage.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = bytes.length;
  if (size > 64 * 1024 * 1024) throw new Error(`Vídeo de ${(size / 1048576).toFixed(0)}MB — neste modo o limite é 64MB. Comprima o vídeo.`);

  // 1) init: envia pros RASCUNHOS do TikTok (inbox) com FILE_UPLOAD — usa o escopo video.upload (sem auditoria)
  const initRes = await fetch(`${TT}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  });
  const initJson = await initRes.json().catch(() => ({}));
  const publishId = initJson?.data?.publish_id;
  const uploadUrl = initJson?.data?.upload_url;
  if (!initRes.ok || !uploadUrl) throw new Error("TikTok (init): " + JSON.stringify(initJson).slice(0, 250));

  // 2) sobe os bytes do vídeo direto pro TikTok
  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size), "Content-Range": `bytes 0-${size - 1}/${size}` },
    body: bytes,
  });
  if (!up.ok) throw new Error("TikTok (upload): " + (await up.text()).slice(0, 200));

  // 3) confere se não falhou de cara (o vídeo vai pros rascunhos; o post final é dado no app)
  await sleep(3000);
  try {
    const stRes = await fetch(`${TT}/post/publish/status/fetch/`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const stJson = await stRes.json().catch(() => ({}));
    if (stJson?.data?.status === "FAILED") throw new Error("TikTok falhou: " + JSON.stringify(stJson?.data?.fail_reason || stJson).slice(0, 200));
  } catch (e) { if (String(e).includes("TikTok falhou")) throw e; /* status opcional */ }

  await db.from("studio_campaigns").update({
    status: "published", published_at: new Date().toISOString(),
    platform_post_id: publishId, publish_error: null,
  }).eq("id", campaignId);
  return { ok: true, publish_id: publishId, message: "Vídeo enviado pros RASCUNHOS do TikTok! Abra o app do TikTok → Rascunhos pra finalizar e postar." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const internal = req.headers.get("x-internal-secret");
    if (internal !== service) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }
    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id é obrigatório." }, 400);

    const db = createClient(url, service);
    try {
      return json(await publishCampaign(db, campaign_id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("studio_campaigns").update({ publish_error: msg }).eq("id", campaign_id);
      return json({ error: "publish_failed", message: msg }, 502);
    }
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
