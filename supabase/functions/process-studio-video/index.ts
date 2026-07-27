// Saporino Studio — processa um vídeo: transcreve (Whisper) e analisa (Claude).
// Recebe { video_id }. Roda com service role (secrets do projeto).
// PENDENTE DE LIGAR: precisa dos secrets OPENAI_API_KEY e ANTHROPIC_API_KEY.
// Deploy: npx supabase functions deploy process-studio-video --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Modelos (troque aqui se quiser outro tier). Whisper transcreve; Claude analisa o texto.
const WHISPER_MODEL = "whisper-1";
const CLAUDE_MODEL = "claude-sonnet-5";
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // limite da API do Whisper (25MB)

const SYSTEM_PROMPT = `Você é um especialista em marketing digital e engenharia reversa de conteúdo.
Analise o vídeo (a partir da transcrição e metadados fornecidos) e retorne JSON puro (sem markdown) com esta estrutura exata:
{
  "resumo": "", "objetivo": "", "publico_alvo": "", "gancho": "", "estrutura_narrativa": "",
  "estrategia": "", "copywriting": "", "gatilhos_psicologicos": [], "pontos_fortes": [], "pontos_fracos": [],
  "como_reproduzir": "", "como_melhorar": "", "como_vender": "", "workflow": "", "nivel_dificuldade": "",
  "tempo_estimado": "", "marca_identificada": "",
  "prompt_claude": "", "prompt_gpt": "", "prompt_veo": "", "prompt_runway": "", "prompt_midjourney": "", "prompt_capcut": "",
  "legenda_instagram": "", "legenda_tiktok": "", "titulo_youtube": "", "hashtags": []
}`;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let videoId: string | null = null;
  try {
    const body = await req.json();
    videoId = body.video_id;
    if (!videoId) throw new Error("video_id ausente");

    const OPENAI = Deno.env.get("OPENAI_API_KEY");
    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
    if (!OPENAI || !ANTHROPIC) throw new Error("Configurar OPENAI_API_KEY e ANTHROPIC_API_KEY nos secrets do Supabase.");

    const { data: video, error: vErr } = await supabase.from("studio_videos").select("*").eq("id", videoId).single();
    if (vErr || !video) throw new Error("Vídeo não encontrado");
    await supabase.from("studio_videos").update({ status: "processing" }).eq("id", videoId);

    // 1) baixa o vídeo do storage
    const { data: file, error: dlErr } = await supabase.storage.from("studio-videos").download(video.storage_path);
    if (dlErr || !file) throw new Error("Falha ao baixar o vídeo do storage");
    if (file.size > WHISPER_MAX_BYTES) {
      throw new Error(`Vídeo com ${(file.size / 1048576).toFixed(0)}MB excede o limite de 25MB da transcrição. Envie um vídeo menor (por enquanto).`);
    }

    // 2) transcreve com Whisper (verbose_json → texto + segmentos + idioma + duração)
    const fd = new FormData();
    fd.append("file", file, video.filename);
    fd.append("model", WHISPER_MODEL);
    fd.append("response_format", "verbose_json");
    const wRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI}` }, body: fd,
    });
    if (!wRes.ok) throw new Error("Whisper: " + (await wRes.text()).slice(0, 200));
    const tr = await wRes.json();
    await supabase.from("studio_transcriptions").insert({
      video_id: videoId, full_text: tr.text || "", segments: tr.segments || null,
    });

    // 3) analisa com Claude (texto + metadados → JSON estruturado)
    const userMsg = `Transcrição do vídeo "${video.filename}" (idioma ${tr.language || "?"}, ${Math.round(tr.duration || 0)}s):\n\n${tr.text || "(sem fala detectada)"}`;
    const cRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMsg }] }),
    });
    if (!cRes.ok) throw new Error("Claude: " + (await cRes.text()).slice(0, 200));
    const cJson = await cRes.json();
    const raw = (cJson.content?.[0]?.text || "{}").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const a = JSON.parse(raw);

    // 4) salva a análise (mapeando pro schema das colunas)
    await supabase.from("studio_analyses").insert({
      video_id: videoId,
      resumo: a.resumo, objetivo: a.objetivo, publico_alvo: a.publico_alvo, gancho: a.gancho,
      estrategia: a.estrategia, gatilhos: a.gatilhos_psicologicos || [],
      pontos_fortes: a.pontos_fortes || [], pontos_fracos: a.pontos_fracos || [],
      como_reproduzir: a.como_reproduzir, como_melhorar: a.como_melhorar, como_vender: a.como_vender,
      workflow: a.workflow, nivel_dificuldade: a.nivel_dificuldade,
      analise_visual: { estrutura_narrativa: a.estrutura_narrativa, copywriting: a.copywriting, tempo_estimado: a.tempo_estimado },
      prompts: { claude: a.prompt_claude, gpt: a.prompt_gpt, veo: a.prompt_veo, runway: a.prompt_runway, midjourney: a.prompt_midjourney, capcut: a.prompt_capcut },
      legendas: { instagram: a.legenda_instagram, tiktok: a.legenda_tiktok, youtube: a.titulo_youtube },
      hashtags: a.hashtags || [],
    });

    // 5) conclui
    await supabase.from("studio_videos").update({
      status: "completed", processed_at: new Date().toISOString(),
      duration: tr.duration || null, language: tr.language || null, brand_detected: a.marca_identificada || null,
    }).eq("id", videoId);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (videoId) await supabase.from("studio_videos").update({ status: "error", error_text: msg }).eq("id", videoId);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
