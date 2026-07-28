// Studio — importa os TOP posts de um perfil do Instagram via Apify (apify/instagram-scraper),
// ranqueia por engajamento (views de reels / curtidas), baixa a mídia, cria studio_videos e
// dispara a análise (que já sai adaptada pra marca). SÓ admin. Precisa de APIFY_TOKEN nos secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const APIFY = "https://api.apify.com/v2";
const ACTOR = "apify~instagram-scraper";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = Deno.env.get("APIFY_TOKEN");
    const authHeader = req.headers.get("Authorization") ?? "";

    // gate: só admin
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets do Supabase." }, 500);

    const body = await req.json();
    const { action, handle, company_id, created_by, mediaFilter } = body;
    if (!handle) return json({ error: "handle é obrigatório." }, 400);
    const user = String(handle).replace(/^@/, "").trim().replace(/\/+$/, "").split("/").pop();
    const profileUrl = `https://www.instagram.com/${user}/`;
    const COST_PER_POST = 0.066; // ~Claude + Whisper por post analisado
    // quantos posts trazer pra galeria (raspagem é barata; teto 400 pra não estourar o tempo da função)
    const SCAN_MAX = Math.max(12, Math.min(Number(body?.scanLimit) || 60, 400));

    // ===================== IMPORT: analisa só os posts que o admin escolheu =====================
    if (action === "import") {
      if (!company_id) return json({ error: "company_id é obrigatório." }, 400);
      const chosen: any[] = Array.isArray(body.posts) ? body.posts.slice(0, 50) : [];
      if (!chosen.length) return json({ error: "vazio", message: "Nenhum post selecionado." }, 400);
      const db = createClient(url, service);
      let imported = 0;
      for (const p of chosen) {
        try {
          const isVideo = !!p.video || p.isVideo === true;
          const mediaUrl = isVideo ? p.video : p.thumb;
          if (!mediaUrl) continue;
          const mres = await fetch(mediaUrl);
          if (!mres.ok) continue;
          const blob = await mres.blob();
          const ext = isVideo ? "mp4" : "jpg";
          const path = `${company_id}/ig_${user}_${Date.now()}_${imported}.${ext}`;
          const up = await db.storage.from("studio-videos").upload(path, blob, { contentType: isVideo ? "video/mp4" : "image/jpeg" });
          if (up.error) continue;
          const { data: row } = await db.from("studio_videos").insert({
            company_id, created_by: created_by || null, media_type: isVideo ? "video" : "image",
            filename: `@${user} — ${(p.caption || "post").slice(0, 40)}`, storage_path: path,
            source_url: p.url || profileUrl, status: "pending",
          }).select("id").single();
          if (row?.id) {
            fetch(`${url}/functions/v1/process-studio-video`, {
              method: "POST", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
              body: JSON.stringify({ video_id: row.id }),
            }).catch(() => {});
            imported++;
          }
        } catch { /* pula esse post */ }
      }
      return json({ ok: true, imported, profile: `@${user}` });
    }

    // ===================== SCAN (padrão): raspa e devolve as miniaturas p/ escolher (barato) =====
    const filter = mediaFilter === "video" || mediaFilter === "image" ? mediaFilter : "all";
    const run = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [profileUrl], resultsType: "posts", resultsLimit: SCAN_MAX, addParentData: false }),
    });
    if (!run.ok) {
      const txt = await run.text();
      const noCredit = run.status === 402 || /usage|limit|credit|quota/i.test(txt);
      return json({ error: noCredit ? "no_credit" : "apify_error", message: noCredit ? "Crédito Apify esgotado." : txt.slice(0, 300) }, noCredit ? 402 : 502);
    }
    const items = await run.json();
    let posts = (Array.isArray(items) ? items : []).filter((p: any) => p && (p.displayUrl || p.videoUrl));
    if (!posts.length) return json({ error: "sem_posts", message: `Nenhum post público encontrado em @${user}. O perfil pode ser privado ou o Instagram bloqueou.` }, 404);

    const score = (p: any) => (Number(p.videoViewCount) || 0) + (Number(p.likesCount) || 0) + (Number(p.commentsCount) || 0);
    posts = posts
      .map((p: any) => {
        const isVideo = p.type === "Video" || !!p.videoUrl;
        return { url: p.url || null, thumb: p.displayUrl || null, video: isVideo ? p.videoUrl || null : null, isVideo,
          views: Number(p.videoViewCount) || 0, likes: Number(p.likesCount) || 0, comments: Number(p.commentsCount) || 0,
          caption: (p.caption || "").slice(0, 120), score: score(p) };
      })
      .filter((p: any) => filter === "all" ? true : filter === "video" ? p.isVideo : !p.isVideo)
      .sort((a: any, b: any) => b.score - a.score);

    return json({ ok: true, profile: `@${user}`, count: posts.length, cost_per_post: COST_PER_POST, posts });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
