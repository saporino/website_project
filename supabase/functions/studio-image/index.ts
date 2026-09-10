// COFICO Studio — motor de geração de imagem.
//
// O cliente escreve em português comum ("faça uma oferta deste café") e recebe
// a imagem dentro do Studio. Ele nunca vê nem escreve prompt técnico: o prompt
// é montado aqui, no servidor, a partir do briefing + guardrails da marca +
// formato. A chave da OpenAI nunca sai daqui.
//
// Deploy: npx supabase functions deploy studio-image
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { custoDaImagemUSD, decomporEntrada, FORMATOS, type FormatoId } from "../_shared/aiPricing.ts";
import { registrarUsoDeIA } from "../_shared/aiUsage.ts";

// Dois modelos, um critério: `sunburst` é o que a OpenAI indica para fluxos
// "onde a precisão de edição importa mais" — é o que usamos quando há um ativo
// de referência a respeitar. `flare` é o de geração rápida do dia a dia.
const MODELO_LIVRE = "gpt-image-2.5-flare";
const MODELO_COM_REFERENCIA = "gpt-image-2.5-sunburst";
const PROMPT_VERSION = "img-v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

/**
 * Monta o prompt técnico a partir do que a pessoa escreveu.
 *
 * Duas disciplinas herdadas do Studio de análise: não inventar fato sobre a
 * marca, e não gerar sinteticamente um ativo oficial. A segunda vira instrução
 * explícita quando há referência anexada — mas ver a nota de honestidade no
 * retorno: instrução não é garantia.
 */
function montarPrompt(brief: string, formato: FormatoId, guardrails: unknown, marca: string, temReferencia: boolean): string {
  const f = FORMATOS[formato];
  const g = guardrails && Object.keys(guardrails as object).length
    ? `\n\nIDENTIDADE DA MARCA (obedeça; não invente nada fora disto):\n${JSON.stringify(guardrails).slice(0, 4000)}`
    : `\n\nATENÇÃO: esta marca ainda não tem identidade cadastrada. Seja conservador: NÃO invente prêmio, origem, certificação, preço, promoção ou selo.`;

  const referencia = temReferencia
    ? `\n\nUSO DA IMAGEM DE REFERÊNCIA: a imagem anexada mostra um produto/embalagem REAL da marca. Mantenha o produto fiel ao que está na referência — mesma embalagem, mesmas cores, mesmos textos e mesmo logotipo. NÃO redesenhe o rótulo, NÃO traduza nem reescreva palavras da embalagem, NÃO altere o peso indicado e NÃO crie uma variação "parecida". Você pode criar livremente o cenário, a luz, a superfície, o fundo e os elementos ao redor.`
    : `\n\nSEM ATIVO OFICIAL: não desenhe logotipo, marca, rótulo com texto legível ou embalagem identificável. Se a composição pedir um pacote, mostre-o desfocado, cortado ou de costas. Texto inventado numa embalagem é o erro mais caro que você pode cometer aqui.`;

  return (
    `Fotografia publicitária profissional para ${f.rotulo} (${f.proporcao}), marca de café ${marca}.\n\n` +
    `PEDIDO DE QUEM ENCOMENDOU:\n"""${brief.slice(0, 1500)}"""` +
    g + referencia +
    `\n\nPADRÃO: qualidade comercial, luz natural e crível, composição limpa com respiro para texto ser aplicado depois. ` +
    `Evite estética genérica de banco de imagens, evite aparência de render 3D e evite texto artificial na imagem.`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const inicio = Date.now();

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI = Deno.env.get("OPENAI_API_KEY");
  const db = createClient(url, service);

  let geracaoId: string | null = null;
  let companyId: string | null = null;
  let userId: string | null = null;
  let modelo = MODELO_LIVRE;

  try {
    if (!OPENAI) return json({ error: "Configurar OPENAI_API_KEY nos secrets." }, 500);

    // ---- Portaria: precisa estar logado E ser administrador ----
    // Quando existir organização do COFICO Studio, é aqui que a checagem passa
    // a ser "pertence a esta organização" em vez de is_admin().
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await asUser.auth.getUser();
    if (!userData?.user) return json({ error: "Faça login para gerar imagens." }, 401);
    userId = userData.user.id;

    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json();

    // ---- Ações leves sobre uma geração que já existe ----
    // Ficam aqui, e não no navegador, porque o bucket é privado: só o service
    // role assina URL. Toda ação confere que a geração é da empresa pedida.
    const acao = String(body?.action ?? "gerar");
    if (acao === "url" || acao === "outcome" || acao === "listar") {
      const empresa = body?.company_id ? String(body.company_id) : null;
      if (!empresa) return json({ error: "Escolha a marca." }, 400);

      if (acao === "listar") {
        const { data: linhas } = await db.from("studio_generations")
          .select("id, format, brief, status, outcome, created_at, storage_path, width, height, parent_id")
          .eq("company_id", empresa).eq("status", "pronta")
          .order("created_at", { ascending: false }).limit(24);
        const comUrl = await Promise.all((linhas ?? []).map(async (g: Record<string, unknown>) => {
          const { data: s } = await db.storage.from("studio-generations")
            .createSignedUrl(String(g.storage_path), 3600);
          return { ...g, url: s?.signedUrl ?? null };
        }));
        return json({ ok: true, geracoes: comUrl });
      }

      const id = String(body?.generation_id ?? "");
      const { data: g } = await db.from("studio_generations")
        .select("id, company_id, storage_path").eq("id", id).maybeSingle();
      // Mesma resposta para "não existe" e "é de outra empresa": conferir a
      // existência de um id alheio já é informação demais.
      if (!g || g.company_id !== empresa) return json({ error: "Geração não encontrada." }, 404);

      if (acao === "url") {
        const { data: s } = await db.storage.from("studio-generations")
          .createSignedUrl(String(g.storage_path), 3600);
        if (body?.download) {
          await db.from("studio_generations").update({ downloaded_at: new Date().toISOString() }).eq("id", id);
        }
        return json({ ok: true, url: s?.signedUrl ?? null });
      }

      const decisao = String(body?.outcome ?? "");
      if (decisao !== "aprovada" && decisao !== "rejeitada") return json({ error: "Decisão inválida." }, 400);
      await db.from("studio_generations")
        .update({ outcome: decisao, outcome_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }

    const brief = String(body?.brief ?? "").trim();
    const formato = (String(body?.format ?? "feed") as FormatoId);
    const referencePath = body?.reference_path ? String(body.reference_path) : null;
    const parentId = body?.parent_id ? String(body.parent_id) : null;
    companyId = body?.company_id ? String(body.company_id) : null;

    if (!companyId) return json({ error: "Escolha a marca antes de gerar." }, 400);
    if (brief.length < 5) return json({ error: "Descreva o que você quer na imagem." }, 400);
    if (!FORMATOS[formato]) return json({ error: "Formato inválido." }, 400);

    // ---- Ativo de referência: só o da própria empresa ----
    // O caminho vem do navegador, então não dá para confiar nele. O bucket
    // studio-videos guarda arte de todas as marcas; sem esta checagem, alguém
    // poderia passar o caminho da embalagem de outra empresa.
    if (referencePath) {
      const donoDoCaminho = referencePath.split("/")[0];
      if (donoDoCaminho !== companyId) {
        return json({ error: "Esse ativo não pertence a esta marca." }, 403);
      }
    }

    // ---- Contexto da marca ----
    const { data: brand } = await db
      .from("studio_brand_profiles")
      .select("name, guardrails")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    const marca = brand?.name || "sem nome cadastrado";

    const f = FORMATOS[formato];
    modelo = referencePath ? MODELO_COM_REFERENCIA : MODELO_LIVRE;
    const prompt = montarPrompt(brief, formato, brand?.guardrails, marca, !!referencePath);

    // ---- Nasce a tentativa, ANTES da chamada ----
    // Assim uma chamada que falha continua existindo no histórico: tentativa
    // perdida também consumiu tempo e, às vezes, dinheiro.
    const { data: ger, error: gErr } = await db
      .from("studio_generations")
      .insert({
        company_id: companyId, created_by: userId,
        format: formato, brief, prompt, reference_path: referencePath,
        provider: "openai", model: modelo,
        width: f.largura, height: f.altura,
        status: "pendente", parent_id: parentId,
      })
      .select("id").single();
    if (gErr) return json({ error: "Não foi possível registrar a geração." }, 500);
    geracaoId = ger.id as string;

    // ---- Chamada à OpenAI ----
    const size = `${f.largura}x${f.altura}`;
    let resp: Response;

    if (referencePath) {
      // Com referência: /images/edits, que aceita a imagem como base.
      const { data: arquivo, error: dlErr } = await db.storage.from("studio-videos").download(referencePath);
      if (dlErr || !arquivo) throw new Error("Não foi possível ler o ativo de referência.");

      // O tipo do arquivo TEM que ir no Blob. `new Blob([bytes])` sem `type`
      // nasce com tipo vazio, o FormData manda como application/octet-stream e
      // a OpenAI recusa — ela olha o MIME, não a extensão do nome:
      //   "Invalid file 'image': unsupported mimetype ('application/octet-stream')"
      // O Blob que vem do storage já traz o tipo; a extensão é só a rede de
      // segurança para quando ele vier vazio.
      const nomeRef = referencePath.split("/").pop() || "ref.png";
      const porExtensao = nomeRef.toLowerCase().endsWith(".webp") ? "image/webp"
        : (nomeRef.toLowerCase().endsWith(".jpg") || nomeRef.toLowerCase().endsWith(".jpeg")) ? "image/jpeg"
        : "image/png";
      const mimeRef = arquivo.type && arquivo.type.startsWith("image/") ? arquivo.type : porExtensao;

      const fd = new FormData();
      fd.append("model", modelo);
      fd.append("prompt", prompt);
      fd.append("size", size);
      fd.append("quality", "high");
      fd.append("output_format", "png");
      fd.append("image", new Blob([new Uint8Array(await arquivo.arrayBuffer())], { type: mimeRef }), nomeRef);
      resp = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST", headers: { Authorization: `Bearer ${OPENAI}` }, body: fd,
      });
    } else {
      resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, prompt, size, quality: "high", output_format: "png", n: 1 }),
      });
    }

    // O id da requisição vem no cabeçalho e é o que permite contestar uma
    // cobrança com o provedor depois.
    const requestId = resp.headers.get("x-request-id");
    const texto = await resp.text();

    if (!resp.ok) {
      // Erro DEPOIS do processamento também é cobrado. Registra assim mesmo.
      await db.from("studio_generations")
        .update({ status: "erro", error_text: texto.slice(0, 500) }).eq("id", geracaoId);
      await registrarUsoDeIA(db, {
        company_id: companyId, user_id: userId, operation: "image_generation",
        provider: "openai", model: modelo, prompt_version: PROMPT_VERSION,
        quality: "high", width: f.largura, height: f.altura,
        request_id: requestId, subject_type: "generation", subject_id: geracaoId,
        status: "erro", error_text: texto.slice(0, 500), duration_ms: Date.now() - inicio,
      });
      // A mensagem genérica escondia a causa: as duas primeiras tentativas com
      // embalagem falharam por MIME e a tela só dizia "tente de novo". Quem
      // opera precisa do motivo — sem ele, tentar de novo é chutar.
      let detalhe = "";
      try { detalhe = JSON.parse(texto)?.error?.message ?? ""; } catch { /* resposta não-JSON */ }
      return json({
        error: "A geração falhou.",
        detalhe: detalhe ? String(detalhe).slice(0, 300) : null,
        generation_id: geracaoId,
      }, 502);
    }

    const out = JSON.parse(texto);
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) throw new Error("A API não devolveu imagem.");

    // ---- Guarda o arquivo ----
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const agora = new Date();
    const caminho = `${companyId}/${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, "0")}/${geracaoId}.png`;
    const { error: upErr } = await db.storage.from("studio-generations")
      .upload(caminho, bin, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error("Imagem gerada, mas falhou ao salvar: " + upErr.message);

    await db.from("studio_generations")
      .update({ status: "pronta", storage_path: caminho }).eq("id", geracaoId);

    // ---- Custo, do usage REAL ----
    const uso = out?.usage ?? null;
    const custo = custoDaImagemUSD(modelo, uso);
    // O total já era gravado; a decomposição é o que diz quanto a imagem de
    // referência acrescentou — texto e imagem custam preços diferentes.
    const entrada = decomporEntrada(uso);
    await registrarUsoDeIA(db, {
      company_id: companyId, user_id: userId, operation: "image_generation",
      provider: "openai", model: modelo, prompt_version: PROMPT_VERSION,
      input_tokens: uso?.input_tokens ?? null,
      input_text_tokens: entrada.texto,
      input_image_tokens: entrada.imagem,
      cached_tokens: entrada.cache,
      output_tokens: uso?.output_tokens ?? null,
      image_count: 1, quality: "high", width: f.largura, height: f.altura,
      cost_usd: custo, request_id: requestId,
      subject_type: "generation", subject_id: geracaoId,
      status: "ok", duration_ms: Date.now() - inicio,
    });

    // URL assinada, curta: o bucket é privado e o navegador nunca fala com ele.
    const { data: assinada } = await db.storage.from("studio-generations").createSignedUrl(caminho, 3600);

    return json({
      ok: true,
      generation_id: geracaoId,
      url: assinada?.signedUrl ?? null,
      width: f.largura, height: f.altura, format: formato,
      // Honestidade obrigatória na interface: instrução ao modelo não é
      // garantia de preservação. Quem decide se a embalagem saiu certa é a
      // pessoa que conhece a embalagem.
      aviso_ativo: referencePath
        ? "A imagem foi gerada a partir do seu ativo como referência. Confira a embalagem antes de publicar — a IA pode alterar detalhes do rótulo."
        : null,
    });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).slice(0, 500);
    if (geracaoId) {
      await db.from("studio_generations").update({ status: "erro", error_text: msg }).eq("id", geracaoId).then(() => {}, () => {});
      await registrarUsoDeIA(db, {
        company_id: companyId, user_id: userId, operation: "image_generation",
        provider: "openai", model: modelo, prompt_version: PROMPT_VERSION,
        subject_type: "generation", subject_id: geracaoId,
        status: "erro", error_text: msg, duration_ms: Date.now() - inicio,
      });
    }
    return json({ error: msg }, 500);
  }
});
