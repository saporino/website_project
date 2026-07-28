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

    const { handle, company_id, created_by, limit } = await req.json();
    if (!handle || !company_id) return json({ error: "handle e company_id são obrigatórios." }, 400);
    const topN = Math.max(1, Math.min(Number(limit) || 5, 10));
    const user = String(handle).replace(/^@/, "").trim().replace(/\/+$/, "").split("/").pop();
    const profileUrl = `https://www.instagram.com/${user}/`;

    const db = createClient(url, service);

    // 1) roda o scraper (sync) — pega os posts recentes e a gente ranqueia
    const input = { directUrls: [profileUrl], resultsType: "posts", resultsLimit: 24, addParentData: false };
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
