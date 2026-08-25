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

    // gate: admin (via JWT) OU chamada interna com o service role secret (x-internal-secret)
    const internalSecret = req.headers.get("x-internal-secret") ?? "";
    const isInternal = internalSecret && internalSecret === service;
    if (!isInternal) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
    }
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets do Supabase." }, 500);

    const body = await req.json();
    const { action, handle, company_id, created_by, mediaFilter } = body;
    const db2 = createClient(url, service);

    // ===================== DEBUG_POST: raspa 1 post pela URL, devolve o ITEM CRU do Apify (Parte 2) e
    // opcionalmente recupera a thumbnail de um studio_videos existente (video_id). SÓ interno/admin. =====
    if (action === "debug_post") {
      const postUrl = String(body.postUrl || body.url || "").trim();
      if (!postUrl) return json({ error: "postUrl é obrigatório." }, 400);
      const r = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [postUrl], resultsType: "posts", resultsLimit: 1, addParentData: false }),
      });
      if (!r.ok) return json({ error: "apify_error", message: (await r.text()).slice(0, 400) }, 502);
      const arr = await r.json();
      const item = (Array.isArray(arr) ? arr : [])[0] || null;
      if (!item) return json({ error: "sem_item", message: "Apify não retornou o post." }, 404);

      // top-level keys + amostra dos campos que podem carregar áudio/vídeo progressivo (só leitura)
      const audioVideoKeys = ["videoUrl", "videoUrlBackup", "musicInfo", "audio", "audioUrl", "musicInfoAttachment", "coauthorProducers", "displayUrl", "images", "videoDuration", "productType", "videoResources", "audioResources", "clipsMetadata", "hasAudio", "isMuted"];
      const sample: Record<string, unknown> = {};
      for (const k of audioVideoKeys) if (k in item) sample[k] = (item as any)[k];

      // recupera thumbnail + áudio p/ um registro existente, se pedido (backfill)
      let thumbnail_saved: string | null = null;
      let audio_saved: string | null = null;
      const video_id = body.video_id ? String(body.video_id) : null;
      const cid = company_id || (video_id ? (await db2.from("studio_videos").select("company_id").eq("id", video_id).maybeSingle()).data?.company_id : null);
      const thumbUrl = item.displayUrl || (Array.isArray(item.images) ? item.images[0] : null) || null;
      if (video_id && cid) {
        if (thumbUrl) {
          try {
            const tres = await fetch(thumbUrl);
            if (tres.ok) {
              const tblob = await tres.blob();
              const tpath = `${cid}/recovered_${video_id}_thumb.jpg`;
              const tup = await db2.storage.from("studio-videos").upload(tpath, tblob, { contentType: "image/jpeg", upsert: true });
              if (!tup.error) { thumbnail_saved = tpath; await db2.from("studio_videos").update({ thumbnail_path: tpath }).eq("id", video_id); }
            }
          } catch { /* best-effort */ }
        }
        if (item.audioUrl) {
          try {
            const ares = await fetch(item.audioUrl);
            if (ares.ok) {
              const ablob = await ares.blob();
              const apath = `${cid}/recovered_${video_id}_audio.mp4`;
              const aup = await db2.storage.from("studio-videos").upload(apath, ablob, { contentType: "audio/mp4", upsert: true });
              if (!aup.error) { audio_saved = apath; await db2.from("studio_videos").update({ audio_path: apath }).eq("id", video_id); }
            }
          } catch { /* best-effort */ }
        }
      }

      return json({ ok: true, thumbnail_saved, audio_saved, topLevelKeys: Object.keys(item).sort(), audioVideoSample: sample, item });
    }
    const cleanUser = (h: any) => h ? String(h).replace(/^@/, "").trim().replace(/\/+$/, "").split("/").pop() : null;
    // extrai o @usuario de uma URL do Instagram (ex.: instagram.com/cafepilao/reel/XXX → cafepilao).
    // URLs de post curto (instagram.com/p/SHORTCODE) NÃO têm handle → devolve null. Só parsing, sem scraping.
    const handleFromUrl = (u: any) => {
      const m = String(u || "").match(/instagram\.com\/([^\/?#]+)/i);
      const seg = m && m[1] ? m[1].toLowerCase() : "";
      return seg && !["p", "reel", "reels", "tv", "stories", "explore"].includes(seg) ? seg : null;
    };
    const user = cleanUser(handle);
    const profileUrl = user ? `https://www.instagram.com/${user}/` : "";
    const COST_PER_POST = 0.066; // ~Claude + Whisper por post analisado
    // quantos posts trazer pra galeria (raspagem é barata; teto 400 pra não estourar o tempo da função)
    const SCAN_MAX = Math.max(12, Math.min(Number(body?.scanLimit) || 60, 400));
    const db = createClient(url, service);

    // busca os dados do perfil (seguidores/total de posts) — 1 result do Apify
    async function fetchDetails() {
      const dres = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 }),
      });
      if (!dres.ok) return { error: (await dres.text()).slice(0, 200), status: dres.status };
      const d = (await dres.json())[0] || {};
      return { private: !!d.private, postsCount: Number(d.postsCount) || null, followers: Number(d.followersCount) || null };
    }
    // grava um ponto no histórico (pra medir crescimento de seguidores ao longo do tempo)
    async function saveSnapshot(followers: number | null, postsCount: number | null) {
      if (!company_id || !user) return;
      try { await db.from("studio_profile_snapshots").insert({ company_id, handle: `@${user}`, followers, posts_count: postsCount }); } catch { /* ignora */ }
    }

    // ===================== IMPORT: analisa só os posts que o admin escolheu =====================
    // (os posts podem vir de perfis diferentes — cada um traz seu próprio p.handle)
    if (action === "import") {
      if (!company_id) return json({ error: "company_id é obrigatório." }, 400);
      const chosen: any[] = Array.isArray(body.posts) ? body.posts.slice(0, 50) : [];
      if (!chosen.length) return json({ error: "vazio", message: "Nenhum post selecionado." }, 400);
      let imported = 0;
      for (const p of chosen) {
        try {
          // handle: 1) p.handle  2) handle do body (user)  3) parse da URL do post  4) "ig"
          const uname = cleanUser(p.handle) || user || handleFromUrl(p.url || p.source_url) || "ig";
          const isVideo = !!p.video || p.isVideo === true;
          const mediaUrl = isVideo ? p.video : p.thumb;
          if (!mediaUrl) continue;
          const mres = await fetch(mediaUrl);
          if (!mres.ok) continue;
          const blob = await mres.blob();
          const ext = isVideo ? "mp4" : "jpg";
          const path = `${company_id}/ig_${uname}_${Date.now()}_${imported}.${ext}`;
          const up = await db.storage.from("studio-videos").upload(path, blob, { contentType: isVideo ? "video/mp4" : "image/jpeg" });
          if (up.error) continue;
          // Para VÍDEO: também salva a THUMBNAIL (frame do Reel) — é o que a Claude Vision analisa quando não há áudio.
          let thumbnail_path: string | null = null;
          if (isVideo && p.thumb) {
            try {
              const tres = await fetch(p.thumb);
              if (tres.ok) {
                const tblob = await tres.blob();
                const tpath = `${company_id}/ig_${uname}_${Date.now()}_${imported}_thumb.jpg`;
                const tup = await db.storage.from("studio-videos").upload(tpath, tblob, { contentType: "image/jpeg" });
                if (!tup.error) thumbnail_path = tpath;
              }
            } catch { /* thumbnail é best-effort */ }
          }
          // Para VÍDEO: o Apify entrega o ÁUDIO ISOLADO (AAC/HE-AAC) em p.audioUrl, separado do videoUrl (VP9 video-only).
          // Salvamos esse áudio pra o Whisper transcrever direto (sem ffmpeg/mux). Best-effort: falha aqui NÃO cancela o import.
          let audio_path: string | null = null;
          if (isVideo && p.audioUrl) {
            try {
              const ares = await fetch(p.audioUrl);
              if (ares.ok) {
                const ablob = await ares.blob();
                const apath = `${company_id}/ig_${uname}_${Date.now()}_${imported}_audio.mp4`;
                const aup = await db.storage.from("studio-videos").upload(apath, ablob, { contentType: "audio/mp4" });
                if (!aup.error) audio_path = apath;
              }
            } catch { /* áudio é best-effort — sem ele, cai no fallback visual */ }
          }
          const { data: row } = await db.from("studio_videos").insert({
            company_id, created_by: created_by || null, media_type: isVideo ? "video" : "image",
            filename: `@${uname} — ${(p.caption || "post").slice(0, 40)}`, storage_path: path, thumbnail_path, audio_path,
            source_url: p.url || (uname !== "ig" ? `https://www.instagram.com/${uname}/` : null), status: "pending",
          }).select("id").single();
          if (row?.id) {
            fetch(`${url}/functions/v1/process-studio-video`, {
              method: "POST", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "x-internal-secret": service, "Content-Type": "application/json" },
              body: JSON.stringify({ video_id: row.id }),
            }).catch(() => {});
            imported++;
          }
        } catch { /* pula esse post */ }
      }
      return json({ ok: true, imported });
    }

    // ===================== PREVIEW: só quantos posts/seguidores o perfil tem (antes de raspar tudo) =====
    if (action === "preview") {
      if (!user) return json({ error: "handle é obrigatório." }, 400);
      const d = await fetchDetails();
      if ((d as any).error) {
        const noCredit = (d as any).status === 402 || /usage|limit|credit|quota/i.test((d as any).error);
        return json({ error: noCredit ? "no_credit" : "apify_error", message: noCredit ? "Crédito Apify esgotado." : (d as any).error }, noCredit ? 402 : 502);
      }
      if (d.private) return json({ error: "privado", message: `@${user} é privado — não dá pra raspar.` }, 403);
      await saveSnapshot(d.followers, d.postsCount);
      return json({ ok: true, profile: `@${user}`, postsCount: d.postsCount, followers: d.followers });
    }

    // ===================== SCAN (padrão): raspa e devolve as miniaturas p/ escolher (barato) =====
    if (!user) return json({ error: "handle é obrigatório." }, 400);
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
        return { url: p.url || null, thumb: p.displayUrl || null, video: isVideo ? p.videoUrl || null : null,
          audioUrl: isVideo ? (p.audioUrl || null) : null, isVideo,
          views: Number(p.videoViewCount) || 0, likes: Number(p.likesCount) || 0, comments: Number(p.commentsCount) || 0,
          ts: p.timestamp || null, caption: (p.caption || "").slice(0, 120), score: score(p) };
      })
      .filter((p: any) => filter === "all" ? true : filter === "video" ? p.isVideo : !p.isVideo)
      .sort((a: any, b: any) => b.score - a.score);

    // também pega os dados do perfil (seguidores/total) e grava no histórico
    const det = await fetchDetails();
    const followers = (det as any).error ? null : det.followers;
    const postsCount = (det as any).error ? null : det.postsCount;
    await saveSnapshot(followers, postsCount);

    return json({ ok: true, profile: `@${user}`, count: posts.length, cost_per_post: COST_PER_POST, followers, postsCount, posts });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
