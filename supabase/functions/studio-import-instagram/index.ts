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

    const { action, handle, company_id, created_by, limit, mediaFilter } = await req.json();
    if (!handle) return json({ error: "handle é obrigatório." }, 400);
    const user = String(handle).replace(/^@/, "").trim().replace(/\/+$/, "").split("/").pop();
    const profileUrl = `https://www.instagram.com/${user}/`;
    const COST_PER_POST = 0.066; // ~Claude + Whisper por post analisado
    const HARD_CAP = 50;         // trava de segurança de custo

    // ===== PREVIEW: quantos posts tem + estimativa de custo (antes de raspar de verdade) =====
    if (action === "preview") {
      const dres = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 }),
      });
      if (!dres.ok) return json({ error: "apify_error", message: (await dres.text()).slice(0, 200) }, 502);
      const d = (await dres.json())[0] || {};
      if (d.private) return json({ error: "privado", message: `@${user} é privado — não dá pra raspar.` }, 403);
      const postsCount = Number(d.postsCount) || null;
      return json({ ok: true, profile: `@${user}`, postsCount, followers: d.followersCount || null, cost_per_post: COST_PER_POST });
    }

    if (!company_id) return json({ error: "company_id é obrigatório." }, 400);
    const wantAll = limit === "all" || limit === "todos";
    const topN = wantAll ? HARD_CAP : Math.max(1, Math.min(Number(limit) || 5, HARD_CAP));
    const filter = mediaFilter === "video" || mediaFilter === "image" ? mediaFilter : "all"; // all|video|image

    const db = createClient(url, service);

    // 1) roda o scraper (sync). Se filtra por tipo, raspa mais pra ter o suficiente daquele tipo.
    const scrapeLimit = Math.min(150, Math.max(24, topN * (filter === "all" ? 3 : 5)));
    const input = { directUrls: [profileUrl], resultsType: "posts", resultsLimit: scrapeLimit, addParentData: false };
    const run = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    if (!run.ok) {
      const txt = await run.text();
      const noCredit = run.status === 402 || /usage|limit|credit|quota/i.test(txt);
      return json({ error: noCredit ? "no_credit" : "apify_error", message: noCredit ? "Crédito Apify esgotado." : txt.slice(0, 300) }, noCredit ? 402 : 502);
    }
    const items = await run.json();
    const posts = (Array.isArray(items) ? items : []).filter((p: any) => p && (p.displayUrl || p.videoUrl));
    if (!posts.length) return json({ error: "sem_posts", message: `Nenhum post público encontrado em @${user}. O perfil pode ser privado ou o Instagram bloqueou.` }, 404);

    // 2) ranqueia por engajamento (views de reel / curtidas) e pega os top N
    const score = (p: any) => (Number(p.videoViewCount) || 0) + (Number(p.likesCount) || 0) + (Number(p.commentsCount) || 0);
    const top = posts.sort((a: any, b: any) => score(b) - score(a)).slice(0, topN);

    // 3) baixa cada mídia, sobe no storage, cria studio_videos e dispara a análise
    let imported = 0;
    for (const p of top) {
      try {
        const isVideo = p.type === "Video" || !!p.videoUrl;
        const mediaUrl = isVideo ? p.videoUrl : p.displayUrl;
        if (!mediaUrl) continue;
        const mres = await fetch(mediaUrl);
        if (!mres.ok) continue;
        const blob = await mres.blob();
        const ext = isVideo ? "mp4" : "jpg";
        const ts = Date.now() + "_" + imported;
        const path = `${company_id}/ig_${user}_${ts}.${ext}`;
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

    return json({ ok: true, imported, ranked: top.length, profile: `@${user}` });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
