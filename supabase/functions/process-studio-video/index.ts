// Saporino Studio — processa um vídeo/imagem: transcreve (Whisper) e analisa (Claude) com BRAND GUARDRAILS.
// Recebe { video_id }. Roda com service role (secrets do projeto).
// PENDENTE DE LIGAR: precisa dos secrets OPENAI_API_KEY e ANTHROPIC_API_KEY.
// Deploy: npx supabase functions deploy process-studio-video --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Modelos (troque aqui se quiser outro tier). Whisper transcreve; Claude analisa.
const WHISPER_MODEL = "whisper-1";
const CLAUDE_MODEL = "claude-sonnet-5";
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // limite da API do Whisper (25MB)

const SYSTEM_PROMPT = `Você é um ESTRATEGISTA de marketing que faz engenharia reversa de conteúdo de CONCORRENTES para gerar execuções ORIGINAIS da NOSSA marca. A peça do concorrente é fonte de INSIGHT, NUNCA storyboard.

FILOSOFIA OBRIGATÓRIA (siga nesta ordem):
PASSO 1 — ANALISAR: analise a peça do concorrente de forma neutra (objetivo, público, gancho, mecanismo criativo, emoção, gatilhos, estrutura narrativa, elementos visuais, por que funciona/para a scroll).
PASSO 2 — EXTRAIR O PRINCÍPIO: resuma em UMA frase o PRINCÍPIO CRIATIVO reutilizável (o mecanismo/insight humano), NUNCA a execução. Ex.: NÃO "fundo amarelo, mulher com chapéu, produtos na base"; SIM "associar o café a uma celebração cultural reconhecível para torná-lo parte emocional do ritual e das boas memórias".
PASSO 3 — O QUE NÃO COPIAR: liste os elementos de EXECUÇÃO do concorrente que NÃO podem aparecer na adaptação (headline, estrutura da frase, layout, posição dos objetos, pose, figurino, paleta do concorrente, props, tipografia, cenário, slogan, marca/embalagem do concorrente).
PASSO 4 — CONSULTAR OS BRAND GUARDRAILS (fornecidos abaixo): use SOMENTE produtos/claims/assets APROVADOS. REGRA ABSOLUTA: se algo NÃO estiver explicitamente aprovado, NÃO trate como fato e NÃO invente. Não preencha lacunas com "fatos" sobre a marca. Toda ideia criativa/comercial não confirmada vai em "suggestions_not_facts" (marcada como SUGESTÃO — requer aprovação), nunca como algo que já existe.
PASSO 5 — EXECUÇÃO ORIGINAL: crie uma execução da NOSSA marca baseada SÓ no princípio. Mude no MÍNIMO 4 dimensões entre {headline structure, composition, setting, character/pose, palette, props, typography, product placement}. PROIBIDO: "trocar o logo", "mesma campanha com outras cores", "mesma frase com a nossa marca", usar a imagem do concorrente como storyboard.

REGRAS DE PLACEHOLDER DE ASSET (imagem, vídeo, Veo, Runway, DaVinci — e qualquer gerador futuro): nunca peça para GERAR o logo/embalagem/xícara da nossa marca. Se "assets_required" indicar um asset oficial (logo/cup/package) E o prompt usar ou prever esse asset, o prompt DEVE conter OBRIGATORIAMENTE o TOKEN LITERAL correspondente (pode haver texto descritivo junto, mas o TOKEN precisa aparecer literalmente): [INSERT OFFICIAL SAPORINO LOGO ASSET], [INSERT OFFICIAL SAPORINO CUP ASSET], [INSERT OFFICIAL SAPORINO CLASSICO PACKAGE ASSET]. NÃO é aceitável usar apenas descrição equivalente como "empty space reserved for official cup" ou "space for package composition" — o TOKEN LITERAL é obrigatório. Se o asset oficial não estiver disponível, gere só cenário/composição/luz. NUNCA use "Saporino-style package", "red package labeled Saporino", "Saporino logo", "white cup with Saporino logo" como geração sintética.
REGRAS DE PROMPT DE VÍDEO: se partir de um asset oficial pronto, preserve logo/xícara/embalagem/tipografia EXATAMENTE — nunca morph/redesenhar/distorcer/trocar letras/adicionar marca. Café quente = vapor natural; NUNCA "boiling/bubbling/simmering/artificial liquid agitation".
REGRAS DE PUBLICAÇÃO (legendas/hashtags/título): obedeça aos guardrails. NUNCA invente preço, promoção, combo, cupom, edição limitada, brinde, assinatura, kit. NUNCA use produto "future" nem o nome do concorrente na copy final. Se o concorrente usa promoção, você pode NOTAR o mecanismo ("urgência/promocional") na análise, mas NÃO transforme em promoção nossa — no máximo registre em "suggestions_not_facts" como "SUGESTÃO COMERCIAL — requer aprovação".
REGRAS DE REFERÊNCIA REGIONAL: NÃO conclua que Minas/mineiro/mineira é posicionamento universal da nossa marca. Termos regionais (Minas, mineiro, mineira, tradição mineira, sabor de Minas, café mineiro, origem mineira, Cerrado Mineiro, Patrocínio-MG) EXIGEM aprovação e NÃO podem aparecer na SAÍDA FINAL da nossa marca (adaptacao_marca, como_reproduzir, prompts, legendas, hashtags, títulos) sem aprovação. Você PODE descrever esses elementos livremente quando eles estão NA PEÇA DO CONCORRENTE (competitor_text, do_not_copy e análise do concorrente). Sem aprovação regional, use linguagem NEUTRA e válida: "ritual brasileiro do café", "ritual matinal", "café da manhã", "tradição do cafezinho", "pequenos prazeres do dia", "momento do café".

Retorne JSON puro (sem markdown) com ESTA estrutura EXATA (mantenha TODOS os campos, mesmo vazios):
{
  "resumo":"", "objetivo":"", "publico_alvo":"", "gancho":"", "estrutura_narrativa":"",
  "estrategia":"", "copywriting":"", "gatilhos_psicologicos":[], "pontos_fortes":[], "pontos_fracos":[],
  "como_reproduzir":"", "como_melhorar":"", "como_vender":"", "workflow":"", "nivel_dificuldade":"",
  "tempo_estimado":"", "marca_identificada":"", "competitor_text":"", "adaptacao_marca":"",
  "creative_principle":"", "do_not_copy":[], "originality_changes":[], "suggestions_not_facts":[], "protected_competitor_phrases":[],
  "claims_used":[{"claim":"","scope":"product","product_id":null,"source":"approved_guardrail"}],
  "assets_required":[{"asset":"package","asset_id":"","required":true}],
  "validation_warnings":[{"severity":"info","code":"","message":""}],
  "prompt_claude":"", "prompt_gpt":"", "prompt_veo":"", "prompt_runway":"", "prompt_midjourney":"", "prompt_capcut":"",
  "legenda_instagram":"", "legenda_tiktok":"", "titulo_youtube":"", "hashtags":[]
}
- "marca_identificada" = a marca do CONCORRENTE. "competitor_text" = APENAS as frases legíveis principais da peça do concorrente (para checagem de similaridade) — NUNCA copie essas frases na nossa copy.
- "protected_competitor_phrases" = 3 a 10 EXPRESSÕES DISTINTIVAS (2 a 5 palavras) da peça do concorrente (ex.: "boas histórias", "café e boas histórias"). Essas expressões NÃO podem aparecer na nossa saída (headline, legenda, hashtags, prompts, roteiro de vídeo, CTA). A EXECUÇÃO VERBAL da nossa marca deve ser NOVA — mantenha só o PRINCÍPIO (memória afetiva/encontro/ritual), mas MUDE O TERRITÓRIO VERBAL (ex.: ritual do café, pausa gostosa, começo do dia, momento que aquece, pequenos prazeres, companhia para a rotina). NÃO reutilize as palavras distintivas do concorrente, mesmo parcialmente.
- "creative_principle" = o princípio do PASSO 2 (uma frase). "do_not_copy" = a lista do PASSO 3. "originality_changes" = as dimensões que você mudou (>=4). "claims_used" = só claims aprovados nos guardrails (com origem "approved_guardrail"). "assets_required" = quais assets oficiais precisam ser anexados depois (logo/cup/package). "suggestions_not_facts" = ideias criativas/comerciais que NÃO são fato confirmado.
- "como_reproduzir" agora significa COMO ADAPTAR de forma ORIGINAL (nunca copiar a execução).
- "legenda_instagram" e "legenda_tiktok" TERMINAM com 3 a 6 hashtags (1 da marca + 1-2 de nicho + 1-2 amplas). SEM preço. Preencha "hashtags" com 6 a 10 opções. Idioma pt-BR.
- Se você mesmo detectar violações, registre em "validation_warnings" (severity info|warning|critical).`;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// ------- normalização e checagem determinística (MODE=WARNING, não bloqueia) -------
const norm = (s: unknown) => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ASSET_TOKENS: Record<string, string> = { logo: "[INSERT OFFICIAL SAPORINO LOGO ASSET]", cup: "[INSERT OFFICIAL SAPORINO CUP ASSET]", package: "[INSERT OFFICIAL SAPORINO CLASSICO PACKAGE ASSET]" };
// TERMOS EXPLÍCITOS do asset (não usar palavras genéricas como "official/asset/product" — evita falso positivo).
const ASSET_TERMS: Record<string, RegExp> = { logo: /\blogo\b|logotipo/, cup: /\bcup\b|xicara|caneca/, package: /package|packaging|embalagem|pacote/ };

// V1.2 — injeta o TOKEN LITERAL de asset nos prompts visuais quando o prompt prevê o asset (não depende só do LLM).
function enforceAssetPlaceholders(a: any) {
  const required = new Set((a.assets_required || []).filter((x: any) => x && x.required === true && ASSET_TOKENS[x.asset]).map((x: any) => x.asset));
  if (!required.size) return;
  for (const k of ["prompt_midjourney", "prompt_veo", "prompt_runway", "prompt_capcut"]) {
    let p = a[k]; if (!p || !String(p).trim()) continue;
    for (const asset of required) {
      const token = ASSET_TOKENS[asset]; const term = ASSET_TERMS[asset];
      const pn = norm(p);
      const foresees = pn.includes(norm(token)) || term.test(pn);
      if (foresees && !pn.includes(norm(token))) p = String(p).replace(/\s*$/, "") + ` ${token}`;
    }
    a[k] = p;
  }
}

// V1.2 — expressões distintivas (2-4 palavras) da peça do concorrente que NÃO podem vazar na saída Saporino.
const STOP = new Set(["de", "a", "o", "e", "em", "com", "que", "do", "da", "no", "na", "um", "uma", "os", "as", "pra", "para", "por", "se", "ao", "dos", "das", "the", "and", "of", "to"]);
const GENERIC_WORDS = new Set(["cafe", "coffee", "saporino", "rancheiro", "extra", "forte", "tradicional", "tradicionais", "cafezinho"]);
function protectedPhrases(competitorText: unknown, modelPhrases: any): string[] {
  const isContent = (w: string) => w.length > 2 && !STOP.has(w) && !GENERIC_WORDS.has(w);
  const set = new Set<string>();
  const words = norm(competitorText).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= words.length; i++) {
    const g = words.slice(i, i + n);
    if (g.filter(isContent).length >= 2) set.add(g.join(" "));
  }
  for (const p of (Array.isArray(modelPhrases) ? modelPhrases : [])) {
    const g = norm(p).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    if (g.length >= 2) set.add(g.join(" "));
  }
  return [...set];
}

// Detecta se um MP4 tem faixa de ÁUDIO (walk moov→trak→mdia→hdlr, handler 'soun'). Sem ffmpeg.
function mp4HasAudioTrack(bytes: Uint8Array): boolean {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const t = (p: number) => String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const walk = (start: number, end: number, want: string, cb: (ds: number, de: number) => void) => {
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p); let hs = 8;
        if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hs = 16; } else if (size === 0) { size = end - p; }
        if (size < 8 || p + size > end) break;
        if (t(p) === want) cb(p + hs, p + size);
        p += size;
      }
    };
    let found = false;
    walk(0, bytes.length, "moov", (ds, de) => walk(ds, de, "trak", (ts, te) => walk(ts, te, "mdia", (ms, me) => walk(ms, me, "hdlr", (hs) => {
      const h = String.fromCharCode(bytes[hs + 8], bytes[hs + 9], bytes[hs + 10], bytes[hs + 11]);
      if (h === "soun") found = true;
    }))));
    return found;
  } catch { return false; }
}

function validateBrandCompliance(a: any, g: any): any[] {
  const w: any[] = [];
  const push = (severity: string, code: string, message: string) => w.push({ severity, code, message });
  if (!g || typeof g !== "object") return w;

  const legendsRaw = [a.legenda_instagram, a.legenda_tiktok, a.titulo_youtube, (a.hashtags || []).join(" ")].filter(Boolean).join("  \n  ");
  const finalCopy = norm(legendsRaw);
  const promptsText = norm([a.prompt_gpt, a.prompt_midjourney].filter(Boolean).join("  "));

  // CRITICAL — produto futuro na copy final
  for (const p of (g.future_products || [])) {
    if (p?.name && finalCopy.includes(norm(p.name))) push("critical", "future_product_in_copy", `Produto futuro "${p.name}" apareceu na copy final.`);
  }
  // CRITICAL — claim proibido
  for (const c of (g.prohibited_claims || [])) {
    if (c && (finalCopy.includes(norm(c)) || norm(a.adaptacao_marca).includes(norm(c)))) push("critical", "prohibited_claim", `Claim proibido detectado: "${c}".`);
  }
  // CRITICAL — invenções comerciais na copy final
  const commercial: [string, RegExp][] = [
    ["preço", /\br\$|\breais\b|por apenas|\bgratis\b|de graca/], ["promoção", /promoc/], ["combo", /\bcombo\b/],
    ["cupom/desconto", /\bcupom\b|codigo de desconto|\bdesconto\b|\boff\b/], ["edição limitada", /edicao limitada/],
    ["brinde", /\bbrinde\b/], ["assinatura", /\bassinatura\b/], ["kit", /\bkit\b/],
  ];
  for (const [label, re] of commercial) if (re.test(finalCopy)) push("critical", "invented_commercial", `Possível ${label} inventado na copy final — não use oferta/preço sem aprovação.`);
  // CRITICAL — nome do concorrente na copy final
  const comp = norm((a.marca_identificada || "").replace(/\(@[^)]*\)/g, "").replace(/\b(cafe|coffee|oficial|ltda)\b/g, "").trim());
  if (comp.length >= 3 && finalCopy.includes(comp)) push("critical", "competitor_in_copy", `Nome do concorrente ("${a.marca_identificada}") apareceu na copy final.`);
  // CRITICAL — prompt pedindo GERAR asset da marca (sem placeholder)
  const hasPlaceholder = /\[insert official/i.test((a.prompt_midjourney || "") + (a.prompt_gpt || ""));
  if (/saporino[^.]{0,25}(logo|package|packaging|cup|embalagem|xicara)|(logo|package|packaging|cup|embalagem|xicara)[^.]{0,25}saporino/.test(promptsText) && !hasPlaceholder) {
    push("critical", "prompt_generates_brand_asset", "Prompt de imagem parece pedir para GERAR logo/embalagem/xícara Saporino — use o placeholder [INSERT OFFICIAL SAPORINO ...].");
  }

  // WARNING — termo que exige aprovação manual usado como fato na copy (região tem check próprio)
  const REGION_RE = /\bminas\b|\bmineir[oa]\b|sabor de minas|origem mineir[oa]/;
  for (const t of (g.requires_manual_approval || [])) {
    if (!t || REGION_RE.test(norm(t))) continue;
    if (finalCopy.includes(norm(t))) push("warning", "requires_manual_approval", `"${t}" exige aprovação manual — não usar como fato na copy sem autorizar.`);
  }
  // WARNING — referência regional NÃO aprovada na SAÍDA FINAL da marca (não vale para a descrição do concorrente).
  // NÃO varre prompt_claude/prompt_gpt: são META-PROMPTS (instruções ao LLM, ex. "não use Minas/mineiro"), não execução/copy final.
  const finalOut = norm([a.legenda_instagram, a.legenda_tiktok, a.titulo_youtube, (a.hashtags || []).join(" "), a.adaptacao_marca, a.como_reproduzir, a.prompt_midjourney, a.prompt_capcut, a.prompt_veo, a.prompt_runway].filter(Boolean).join("  \n  "));
  const rm = finalOut.match(REGION_RE);
  if (rm) push("warning", "REGION_POSITIONING_PENDING", `Referência regional não aprovada na saída final ("${rm[0]}"). Sem aprovação regional, use linguagem neutra (ritual matinal, café da manhã, tradição do cafezinho, momento do café).`);
  // WARNING — placeholder literal ausente (rede de segurança; o enforce já injeta). Detecta por TERMO EXPLÍCITO ou token — NUNCA por palavra genérica (official/asset/product).
  const visualPrompts = ([["imagem", a.prompt_midjourney], ["Veo", a.prompt_veo], ["Runway", a.prompt_runway], ["DaVinci", a.prompt_capcut]] as [string, any][]).filter(([, v]) => v && String(v).trim());
  for (const ar of (a.assets_required || [])) {
    if (!ar || ar.required !== true) continue;
    const token = ASSET_TOKENS[ar.asset]; const term = ASSET_TERMS[ar.asset]; if (!token || !term) continue;
    for (const [pl, ptext] of visualPrompts) {
      const ptn = norm(ptext);
      const foresees = ptn.includes(norm(token)) || term.test(ptn);
      if (foresees && !ptn.includes(norm(token))) push("warning", "ASSET_PLACEHOLDER_MISSING", `Prompt "${pl}" prevê o asset "${ar.asset}" mas não contém o token literal ${token}.`);
    }
  }
  // WARNING — vazamento de expressão distintiva do concorrente na saída Saporino (copy distance)
  const prot = protectedPhrases(a.competitor_text, a.protected_competitor_phrases);
  const seen = new Set<string>();
  for (const p of prot) {
    if (p.length < 5 || seen.has(p)) continue;
    if ((" " + finalOut + " ").includes(" " + p + " ")) { seen.add(p); push("warning", "COMPETITOR_PHRASE_LEAK", `Expressão do concorrente "${p}" apareceu na saída Saporino — reescreva a execução verbal (mantenha só o princípio).`); }
    if (seen.size >= 5) break;
  }
  // WARNING — originalidade / campos-chave
  const origN = Array.isArray(a.originality_changes) ? a.originality_changes.length : 0;
  if (origN < 4) push("warning", "low_originality", `Apenas ${origN} dimensões alteradas (mínimo 4).`);
  if (!Array.isArray(a.do_not_copy) || !a.do_not_copy.length) push("warning", "empty_do_not_copy", 'Lista "o que não copiar" está vazia.');
  if (!a.creative_principle) push("warning", "empty_principle", "Princípio criativo vazio.");

  // WARNING — similaridade de copy (sequência contígua de 5+ palavras do concorrente na copy final)
  if (a.competitor_text) {
    const cw = norm(a.competitor_text).split(/\s+/).filter(Boolean);
    const ojoin = " " + finalCopy.split(/\s+/).filter(Boolean).join(" ") + " ";
    for (let n = Math.min(cw.length, 12); n >= 5; n--) {
      let hit = false;
      for (let i = 0; i + n <= cw.length; i++) { if (ojoin.includes(" " + cw.slice(i, i + n).join(" ") + " ")) { hit = true; break; } }
      if (hit) { push("warning", "copy_similarity", `Trecho de ${n}+ palavras muito parecido com a copy do concorrente — adapte mais.`); break; }
    }
  }
  return w;
}

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

    // Perfil da marca (Brand Kit) + Brand Guardrails da empresa
    const { data: brand } = await supabase.from("studio_brand_profiles")
      .select("*").eq("company_id", video.company_id).order("is_primary", { ascending: false }).limit(1).maybeSingle();
    const brandBlock = brand ? `

=== BRIEFING DA NOSSA MARCA ===
Marca: ${brand.name}
Cores: ${JSON.stringify(brand.colors || {})}
Tom de voz: ${brand.tone || "-"}
Público: ${brand.audience || "-"}
Linha de produtos (referência interna): ${brand.product_line || "-"}
SEMPRE: ${brand.dos || "-"}
NUNCA: ${brand.donts || "-"}
${brand.notes ? "Obs.: " + brand.notes : ""}

=== BRAND GUARDRAILS (regra dura — obedeça a este JSON) ===
${JSON.stringify(brand.guardrails || {}, null, 2)}
Regra de ouro: o concorrente é só referência de ESTRATÉGIA. Extraia o PRINCÍPIO e DESCARTE a execução. Use SOMENTE produtos/claims/assets aprovados nos guardrails; nunca invente preço/promo/cupom/edição/brinde/assinatura; nunca reproduza a marca/embalagem/frase do concorrente; nunca use produto "future" na copy final.` : "";
    await supabase.from("studio_videos").update({ status: "processing", error_text: null }).eq("id", videoId);
    // idempotente: limpa resultado anterior deste vídeo antes de reprocessar (evita duplicatas)
    await supabase.from("studio_transcriptions").delete().eq("video_id", videoId);
    await supabase.from("studio_analyses").delete().eq("video_id", videoId);

    // 1+2) prepara a entrada da Claude. IMAGEM = visão direta. VÍDEO = tenta transcrição (Whisper) + usa a THUMBNAIL
    // como referência visual; se não houver áudio OU o Whisper falhar, faz fallback SÓ visual (nunca deixa em erro).
    let userContent: any;
    let trDuration = 0, trLang = "";
    let analysisMode = "";
    let audioStatus = "";

    // baixa a thumbnail (bucket) e devolve bloco de imagem base64 pra Claude (Claude não aceita vídeo)
    const thumbImageBlock = async (): Promise<any | null> => {
      if (!video.thumbnail_path) return null;
      const { data: th } = await supabase.storage.from("studio-videos").download(video.thumbnail_path);
      if (!th) return null;
      const tb = new Uint8Array(await th.arrayBuffer());
      let bin = ""; const CH = 8192; for (let i = 0; i < tb.length; i += CH) bin += String.fromCharCode(...tb.subarray(i, i + CH));
      const tp = video.thumbnail_path.toLowerCase();
      const mt = tp.endsWith(".png") ? "image/png" : tp.endsWith(".webp") ? "image/webp" : "image/jpeg";
      return { type: "image", source: { type: "base64", media_type: mt, data: btoa(bin) } };
    };

    if (video.media_type === "image") {
      const { data: img, error: iErr } = await supabase.storage.from("studio-videos").download(video.storage_path);
      if (iErr || !img) throw new Error("Falha ao baixar a imagem do storage");
      const bytes = new Uint8Array(await img.arrayBuffer());
      let bin = ""; const CH = 8192;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
      const b64 = btoa(bin);
      const fn = video.filename.toLowerCase();
      const mt = fn.endsWith(".png") ? "image/png" : fn.endsWith(".webp") ? "image/webp" : "image/jpeg";
      analysisMode = "image"; audioStatus = "skipped";
      userContent = [
        { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
        { type: "text", text: `Analise esta IMAGEM como REFERÊNCIA ESTRATÉGICA de um concorrente. NÃO recrie uma imagem parecida. Extraia o mecanismo criativo, identifique os elementos de EXECUÇÃO que NÃO devem ser copiados e proponha uma execução visual ORIGINAL para a NOSSA marca usando apenas informações e produtos permitidos pelos Brand Guardrails. A imagem do concorrente é fonte de INSIGHT, não storyboard. Preencha "competitor_text" com as frases legíveis da peça. Retorne o JSON estruturado solicitado.` },
      ];
    } else {
      // ---- VÍDEO ----
      const srcPath = video.audio_path || video.storage_path;
      const { data: file, error: dlErr } = await supabase.storage.from("studio-videos").download(srcPath);
      if (dlErr || !file) throw new Error("Falha ao baixar o vídeo do storage");
      const vbytes = new Uint8Array(await file.arrayBuffer());
      const hasAudio = video.audio_path ? true : mp4HasAudioTrack(vbytes); // áudio já extraído = sim; senão, olha os boxes
      let transcript: string | null = null;
      if (hasAudio) {
        if (file.size > WHISPER_MAX_BYTES) {
          audioStatus = "decode_failed"; // grande demais → fallback visual (não erro)
        } else {
          try {
            const fd = new FormData();
            const waName = video.audio_path ? (video.audio_path.split("/").pop() || "audio.mp4") : (video.storage_path.split("/").pop() || "video.mp4");
            fd.append("file", new Blob([vbytes]), waName);
            fd.append("model", WHISPER_MODEL);
            fd.append("response_format", "verbose_json");
            const wRes = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI}` }, body: fd });
            if (!wRes.ok) throw new Error((await wRes.text()).slice(0, 200));
            const tr = await wRes.json();
            trDuration = tr.duration || 0; trLang = tr.language || "";
            transcript = (tr.text || "").trim() || null; // sem fala útil → null (não fingir texto falado); cai no visual
            if (transcript) await supabase.from("studio_transcriptions").insert({ video_id: videoId, full_text: transcript, segments: tr.segments || null });
            audioStatus = "success"; // Whisper rodou; se transcript==null, foi áudio sem fala (música/ambiente)
          } catch (_e) {
            transcript = null; audioStatus = "decode_failed";
          }
        }
      } else {
        audioStatus = "no_audio";
      }

      const thumb = await thumbImageBlock();
      if (transcript && thumb) {
        analysisMode = "video_visual_plus_audio";
        userContent = [thumb, { type: "text", text: `Esta é uma peça em VÍDEO (Reel) de um CONCORRENTE. A imagem fornecida é uma REFERÊNCIA VISUAL/thumbnail do Reel. A transcrição abaixo representa o áudio/fala disponível. Analise os DOIS em conjunto (visual + fala). NÃO presuma que a thumbnail representa TODAS as cenas. Trate como referência ESTRATÉGICA: extraia estratégia, hook verbal, mensagem e mecanismo criativo SEM copiar a execução/frases, respeitando os Brand Guardrails. Preencha "competitor_text" com as frases-chave do concorrente. Retorne o JSON.\n\nTRANSCRIÇÃO:\n${transcript || "(vazia)"}` }];
      } else if (thumb) {
        analysisMode = (audioStatus === "no_audio") ? "video_visual_no_audio" : "video_visual_fallback";
        userContent = [thumb, { type: "text", text: `Esta peça é um Reel/vídeo de um CONCORRENTE, porém SOMENTE o contexto visual (thumbnail/frame) está disponível para esta análise. Analise a thumbnail/frame como evidência visual. NÃO presuma: fala, narração, música, áudio, sequência de cenas não visíveis, CTA falado, acontecimentos fora do frame. Você PODE analisar: composição, produto, textos visíveis, cenário, personagem, identidade visual, mecanismo visual. Qualquer interpretação além disso deve ser marcada como inferência (em "suggestions_not_facts"). Trate como referência ESTRATÉGICA — extraia o princípio, NÃO copie a execução; respeite os Brand Guardrails. Preencha "competitor_text" com os textos visíveis na peça. Retorne o JSON.` }];
      } else if (transcript) {
        analysisMode = "video_visual_plus_audio";
        userContent = `Transcrição do vídeo do CONCORRENTE "${video.filename}" (idioma ${trLang || "?"}, ${Math.round(trDuration)}s). Trate como REFERÊNCIA ESTRATÉGICA: extraia o princípio, NÃO copie a execução/frases, e proponha algo ORIGINAL para a NOSSA marca respeitando os Brand Guardrails. Preencha "competitor_text" com as frases-chave do concorrente.\n\n${transcript}`;
      } else {
        throw new Error("Vídeo sem áudio e sem thumbnail para análise visual. Reimporte o post (o import agora salva a thumbnail).");
      }
    }

    // 3) analisa com Claude (texto/imagem → JSON estruturado)
    const cRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 12000, system: SYSTEM_PROMPT + brandBlock, messages: [{ role: "user", content: userContent }] }),
    });
    const cText = await cRes.text();
    if (!cRes.ok) throw new Error("Claude: " + cText.slice(0, 200));
    const cJson = JSON.parse(cText);
    // Claude 5 devolve blocos "thinking" antes do texto → pega o bloco type==='text'
    const rawText = (cJson.content || []).find((b: any) => b.type === "text")?.text ?? "";
    // extrai o JSON de dentro do texto (caso venha com prosa/fences em volta)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const raw = (jsonMatch ? jsonMatch[0] : rawText).replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let a: any = {};
    try { a = JSON.parse(raw); } catch { a = {}; }
    if (!a.resumo && !a.gancho) throw new Error("A análise da IA veio vazia — tente Reprocessar.");

    // 3.4) V1.2 — injeta os TOKENS LITERAIS de asset nos prompts (não depende só da obediência do LLM).
    enforceAssetPlaceholders(a);

    // 3.5) VALIDAÇÃO DE MARCA (modo WARNING — não bloqueia). Junta o que a IA marcou + checagem determinística.
    const modelWarns = Array.isArray(a.validation_warnings) ? a.validation_warnings.filter((x: any) => x && x.message) : [];
    const guardWarns = brand?.guardrails ? validateBrandCompliance(a, brand.guardrails) : [];
    const videoWarns: any[] = [];
    if (audioStatus === "no_audio") videoWarns.push({ code: "VIDEO_NO_AUDIO_STREAM", level: "info", message: "Este vídeo não possui faixa de áudio disponível para transcrição. A análise foi feita apenas com o contexto visual (thumbnail/frame). Interpretações sobre fala, narração ou música não se aplicam." });
    if (audioStatus === "decode_failed") videoWarns.push({ code: "VIDEO_AUDIO_FALLBACK", level: "warning", message: "Havia áudio, mas a transcrição falhou. A análise foi concluída apenas com o contexto visual (thumbnail/frame). Reprocessar pode recuperar o áudio." });
    const validation_warnings = [...modelWarns, ...guardWarns, ...videoWarns];

    // 4) salva a análise (mapeando pro schema das colunas — campos antigos + novos aditivos)
    await supabase.from("studio_analyses").insert({
      video_id: videoId,
      resumo: a.resumo, objetivo: a.objetivo, publico_alvo: a.publico_alvo, gancho: a.gancho,
      estrategia: a.estrategia, gatilhos: a.gatilhos_psicologicos || [],
      pontos_fortes: a.pontos_fortes || [], pontos_fracos: a.pontos_fracos || [],
      como_reproduzir: a.como_reproduzir, como_melhorar: a.como_melhorar, como_vender: a.como_vender,
      workflow: a.workflow, nivel_dificuldade: a.nivel_dificuldade, adaptacao_marca: a.adaptacao_marca || null,
      analise_visual: { estrutura_narrativa: a.estrutura_narrativa, copywriting: a.copywriting, tempo_estimado: a.tempo_estimado },
      prompts: { claude: a.prompt_claude, gpt: a.prompt_gpt, veo: a.prompt_veo, runway: a.prompt_runway, midjourney: a.prompt_midjourney, capcut: a.prompt_capcut },
      legendas: { instagram: a.legenda_instagram, tiktok: a.legenda_tiktok, youtube: a.titulo_youtube },
      hashtags: a.hashtags || [],
      // --- Brand Guardrails V1 (aditivo) ---
      creative_principle: a.creative_principle || null,
      do_not_copy: a.do_not_copy || [],
      originality_changes: a.originality_changes || [],
      claims_used: a.claims_used || [],
      assets_required: a.assets_required || [],
      suggestions_not_facts: a.suggestions_not_facts || [],
      validation_warnings,
      competitor_text: a.competitor_text || null,
    });

    // 5) conclui
    await supabase.from("studio_videos").update({
      status: "completed", processed_at: new Date().toISOString(),
      duration: trDuration || null, language: trLang || null, brand_detected: a.marca_identificada || null,
      analysis_mode: analysisMode || null, audio_transcription_status: audioStatus || null,
    }).eq("id", videoId);

    return new Response(JSON.stringify({ ok: true, warnings: validation_warnings.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (videoId) await supabase.from("studio_videos").update({ status: "error", error_text: msg }).eq("id", videoId);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
