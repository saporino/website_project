// Studio — assistente de LEGENDA. A partir da ARTE anexada + a IDEIA/rascunho do usuário + os BRAND GUARDRAILS
// da marca ativa, a IA escreve/refina a legenda pronta pra postar (com hashtags focadas). Não inventa claim/preço/promo.
// Recebe { company_id, media_path?, notes?, network, current? }. Gate: admin logado. Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLAUDE_MODEL = "claude-sonnet-5";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const NET_GUIDE: Record<string, string> = {
  instagram: "Instagram: legenda envolvente, 1-3 parágrafos curtos, pode usar emojis com moderação, CTA claro. Ao final, 8 a 12 hashtags FOCADAS (nunca 20+), específicas do tema/nicho.",
  tiktok: "TikTok: legenda curta e direta (1-2 linhas), tom mais solto, 3 a 6 hashtags.",
  facebook: "Facebook: legenda um pouco mais descritiva, CTA claro, poucas hashtags (0 a 4).",
  youtube: "YouTube: um TÍTULO curto e chamativo (até ~70 caracteres). Sem hashtags no título.",
};

const normT = (s: unknown) => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// VERIFICAÇÃO DE MARCA na LEGENDA FINAL (o texto que vai pro post — seu OU o da IA). Mesma disciplina da análise.
function checkCaption(text: string, g: any): any[] {
  const w: any[] = []; const push = (severity: string, code: string, message: string) => w.push({ severity, code, message });
  const t = normT(text); if (!t.trim() || !g || typeof g !== "object") return w;
  // invenções comerciais (preço/promo/cupom/combo/kit/edição limitada)
  const commercial: [string, RegExp][] = [
    ["preço", /\br\$|\breais\b|por apenas|\bgratis\b|de graca/], ["promoção", /promoc/], ["combo", /\bcombo\b/],
    ["cupom/desconto", /\bcupom\b|codigo de desconto|\bdesconto\b|\d+\s*%\s*off|\boff\b/], ["edição limitada", /edicao limitada/],
    ["brinde", /\bbrinde\b/], ["kit", /\bkit\b/],
  ];
  for (const [label, re] of commercial) if (re.test(t)) push("critical", "invented_commercial", `Possível ${label} na legenda — não use oferta/preço sem aprovação.`);
  // claim proibido
  for (const c of (g.prohibited_claims || [])) if (c && t.includes(normT(c))) push("critical", "prohibited_claim", `Claim proibido detectado: "${c}".`);
  // produto futuro / não lançado
  for (const p of (g.future_products || [])) if (p?.name && t.includes(normT(p.name))) push("critical", "future_product", `Produto futuro "${p.name}" apareceu na legenda.`);
  // termo que exige aprovação manual (ex.: Minas/Cerrado Mineiro p/ Saporino) — vem dos guardrails da marca
  for (const term of (g.requires_manual_approval || [])) if (term && t.includes(normT(term))) push("warning", "requires_manual_approval", `"${term}" exige aprovação prévia — confirme antes de publicar.`);
  return w;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC) return json({ error: "Configurar ANTHROPIC_API_KEY nos secrets." }, 500);

    // gate: admin logado
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { company_id, media_path, notes, network = "instagram", current, action = "generate" } = body;
    const db = createClient(url, service);

    // guardrails da marca ativa
    const { data: brand } = await db.from("studio_brand_profiles")
      .select("name, tone, guardrails").eq("company_id", company_id).order("is_primary", { ascending: false }).limit(1).maybeSingle();

    // AÇÃO 'verify': só confere o texto (seu OU o da IA) contra os guardrails — sem gerar nada.
    if (action === "verify") {
      const text = String(body.text ?? current ?? "");
      return json({ ok: true, warnings: checkCaption(text, brand?.guardrails), has_guardrails: !!(brand?.guardrails && Object.keys(brand.guardrails).length) });
    }
    const brandName = brand?.name || "a marca";
    const guardrailsBlock = brand?.guardrails && Object.keys(brand.guardrails).length
      ? `BRAND GUARDRAILS de ${brandName} (OBEDEÇA — não invente nada fora disto):\n${JSON.stringify(brand.guardrails)}`
      : `ATENÇÃO: esta marca (${brandName}) ainda NÃO tem Brand Guardrails cadastrados. Seja conservador: NÃO invente claims de produto (origem, torra, prêmios, saúde), preço, promoção, cupom ou edição limitada. Fale de forma institucional e verdadeira.`;

    // imagem anexada (opcional) — Claude Vision
    let imageBlock: any = null;
    if (media_path) {
      const { data: img } = await db.storage.from("studio-videos").download(media_path);
      if (img) {
        const bytes = new Uint8Array(await img.arrayBuffer());
        let bin = ""; const CH = 8192; for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
        const p = String(media_path).toLowerCase();
        const mt = p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg";
        imageBlock = { type: "image", source: { type: "base64", media_type: mt, data: btoa(bin) } };
      }
    }

    const system = `Você é o REDATOR OFICIAL de ${brandName}. Escreve legendas para redes sociais em português do Brasil, na voz da marca, RESPEITANDO os Brand Guardrails. Você NÃO inventa claims de produto, preço, promoção, cupom, edição limitada ou dados sem fonte. Se a arte for uma peça institucional/recrutamento, escreva como tal. Você é um COLABORADOR: parte da IDEIA do usuário e da ARTE; refina, não ignora.\n\n${guardrailsBlock}\n\nRegras da rede — ${NET_GUIDE[network] || NET_GUIDE.instagram}\n\nResponda SOMENTE um JSON: {"caption": "legenda pronta pra postar (já com as hashtags no fim, quando a rede pedir)", "hashtags": ["#..."], "notes_ia": "1 frase curta explicando escolhas ou avisando se algo do rascunho não pôde ser afirmado por falta de guardrail"}`;

    const parts: any[] = [];
    if (imageBlock) parts.push(imageBlock);
    parts.push({ type: "text", text:
      `Rede: ${network}\n` +
      (notes ? `IDEIA / RASCUNHO do usuário (base do texto — respeite a intenção):\n"""${String(notes).slice(0, 4000)}"""\n\n` : "Sem rascunho do usuário — proponha a partir da arte e da marca.\n\n") +
      (current ? `Legenda atual (para refinar, se fizer sentido):\n"""${String(current).slice(0, 4000)}"""\n\n` : "") +
      `Escreva a legenda final pra ${network}. ${imageBlock ? "Considere o que aparece na ARTE anexada." : "Não há arte anexada — não descreva imagem inexistente."} Retorne só o JSON.` });

    const cRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2000, system, messages: [{ role: "user", content: parts }] }),
    });
    const cText = await cRes.text();
    if (!cRes.ok) return json({ error: "Claude: " + cText.slice(0, 200) }, 502);
    const cJson = JSON.parse(cText);
    const rawText = (cJson.content || []).find((b: any) => b.type === "text")?.text ?? "";
    const m = rawText.match(/\{[\s\S]*\}/);
    let out: any = {};
    try { out = JSON.parse((m ? m[0] : rawText).replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()); } catch { out = { caption: rawText.trim(), hashtags: [] }; }
    const caption = out.caption || "";
    // já devolve a verificação de marca da legenda gerada (mesma checagem que o botão "Verificar")
    return json({ ok: true, caption, hashtags: out.hashtags || [], notes_ia: out.notes_ia || null, warnings: checkCaption(caption, brand?.guardrails) });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
