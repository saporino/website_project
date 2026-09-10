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
import {
  MODELO_DIRETOR, DIRETOR_VERSION, TIPOS, ESTILOS, MODOS_DE_TEXTO, LOCALE_SAIDA,
  systemDoDiretor, custoDoDiretorUSD, pareceEstrangeiro, normalizarHandle,
  marcaEstranhaNoPrompt, type ModoMarca,
  type TipoId, type EstiloId, type ModoTextoId, type PapelDoAtivo,
} from "../_shared/diretorCriativo.ts";

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

/**
 * Impressão digital de uma frase, para a unicidade entre clientes.
 *
 * Normaliza antes de somar: "Bom dia!" e "bom  dia" são a mesma frase, e
 * fingir que não são seria fabricar variedade. Guardamos só o hash — dá para
 * responder "isto já existe" sem saber o que é nem de quem era.
 */
async function impressaoDigital(texto: string): Promise<string> {
  const normal = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const bytes = new TextEncoder().encode(normal);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const inicio = Date.now();

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI = Deno.env.get("OPENAI_API_KEY");
  const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
  const db = createClient(url, service);

  let geracaoId: string | null = null;
  let companyId: string | null = null;
  let organizationId: string | null = null;
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
    // Aceita uma ou várias. A API da OpenAI suporta múltiplas referências, e
    // limitar a uma era limitação nossa: a embalagem diz o que é o produto;
    // junto com uma referência de cenário, diz o que a peça deve virar.
    const listaRef: string[] = Array.isArray(body?.reference_paths)
      ? body.reference_paths.map(String).filter(Boolean).slice(0, 4)
      : (body?.reference_path ? [String(body.reference_path)] : []);
    const referencePath = listaRef[0] ?? null;
    const parentId = body?.parent_id ? String(body.parent_id) : null;
    companyId = body?.company_id ? String(body.company_id) : null;
    // Tipo vem de ATALHO, nunca digitado — é o que permite selecionar só as
    // regras daquele caso em vez de despejar o manual inteiro no prompt.
    const tipo = (TIPOS[String(body?.content_type ?? "livre") as TipoId] ? String(body.content_type) : "livre") as TipoId;
    const usarDiretor = body?.usar_diretor !== false;
    // Escolhas guiadas: o cliente aponta, o servidor traduz.
    const estilo = (ESTILOS[String(body?.style ?? "") as EstiloId] ? String(body.style) : undefined) as EstiloId | undefined;
    const modoTexto = (MODOS_DE_TEXTO[String(body?.text_mode ?? "") as ModoTextoId] ? String(body.text_mode) : "automatico") as ModoTextoId;
    // A arroba é garantida aqui: o cliente digita como quiser e a assinatura
    // sai sempre igual, com @ e sem espaço.
    const handle = normalizarHandle(body?.handle);
    const papeis: PapelDoAtivo[] = Array.isArray(body?.reference_roles)
      ? body.reference_roles.map((r: unknown) => (String(r) === "inspiracao" ? "inspiracao" : "oficial"))
      : [];
    // A marca da peça deixa de vir do seletor de EMPRESA do topo do admin.
    // Era exatamente daí que "Saporino" entrava numa peça da Café Capital.
    const modoMarca: ModoMarca = String(body?.brand_mode ?? "perfil") === "livre" ? "livre" : "perfil";
    const brandIdPedido = body?.brand_id ? String(body.brand_id) : null;
    const nomeLivre = String(body?.brand_name ?? "").trim().slice(0, 60);
    // Levas: o navegador orquestra e manda uma peça por vez, porque sete
    // imagens numa só chamada estouram o tempo da função.
    const batchId = body?.batch_id ? String(body.batch_id) : null;
    const batchIndex = Number.isFinite(Number(body?.batch_index)) ? Number(body.batch_index) : null;

    if (!companyId) return json({ error: "Escolha a marca antes de gerar." }, 400);
    if (brief.length < 5) return json({ error: "Descreva o que você quer na imagem." }, 400);
    if (!FORMATOS[formato]) return json({ error: "Formato inválido." }, 400);

    // ---- Ativo de referência: só o da própria empresa ----
    // O caminho vem do navegador, então não dá para confiar nele. O bucket
    // studio-videos guarda arte de todas as marcas; sem esta checagem, alguém
    // poderia passar o caminho da embalagem de outra empresa.
    // TODOS os caminhos são conferidos, não só o primeiro: bastaria um ativo
    // alheio na lista para vazar a embalagem de outra marca.
    for (const caminho of listaRef) {
      if (caminho.split("/")[0] !== companyId) {
        return json({ error: "Um dos ativos não pertence a esta marca." }, 403);
      }
    }

    // ---- Organização dona desta criação ----
    // O tenant do Studio é a organização, não a empresa faturadora. Enquanto
    // só existem clientes internos, ela é encontrada pela ponte company_id.
    const { data: org } = await db.from("studio_organizations")
      .select("id").eq("company_id", companyId).maybeSingle();
    organizationId = org?.id ?? null;

    // ---- Contexto da marca ----
    // FAIL CLOSED. Antes, isto era `.limit(1)` na primeira marca primária da
    // empresa, e o DNA dessa marca virava a verdade da peça mesmo com a
    // embalagem de outra marca anexada. Agora a marca é escolha explícita, e
    // não haver marca resolvida IMPEDE a geração em vez de adivinhar.
    let brand: { id: string; name: string; guardrails: unknown } | null = null;
    let marca: string;

    if (modoMarca === "livre") {
      // Marca livre: nenhum DNA é carregado, de propósito. A embalagem
      // anexada e o pedido escrito são a única fonte de verdade.
      if (nomeLivre.length < 2) {
        return json({ error: "Escreva o nome da marca desta peça." }, 400);
      }
      if (!listaRef.length) {
        return json({ error: "Em marca livre, anexe a embalagem: ela é o documento da marca." }, 400);
      }
      marca = nomeLivre;
    } else {
      const consulta = db.from("studio_brand_profiles")
        .select("id, name, guardrails").eq("company_id", companyId);
      const { data: achada } = brandIdPedido
        ? await consulta.eq("id", brandIdPedido).maybeSingle()
        : await consulta.order("is_primary", { ascending: false }).limit(1).maybeSingle();
      brand = (achada as typeof brand) ?? null;
      // Marca ausente NÃO cai em marca padrão. Cair silenciosamente para a
      // primeira marca disponível foi a causa raiz do incidente.
      if (!brand) {
        return json({
          error: brandIdPedido
            ? "Marca não encontrada nesta empresa."
            : "Nenhuma marca cadastrada. Escolha Marca livre e anexe a embalagem.",
        }, 400);
      }
      marca = brand.name;
    }

    // ---- Trava: o ativo oficial tem de ser desta marca ----
    // O prefixo do caminho só garante a EMPRESA. Uma empresa com duas marcas
    // passava reto: a embalagem da marca A servia de ativo oficial na peça da
    // marca B. Ativo registrado em outra marca bloqueia, e não custa nada.
    if (listaRef.length) {
      const { data: registrados } = await db.from("studio_reference_assets")
        .select("path, brand_id, brand_name").in("path", listaRef);
      for (const a of registrados ?? []) {
        const donoOutro = a.brand_id && brand?.id && a.brand_id !== brand.id;
        const nomeOutro = a.brand_name && marca && a.brand_name.toLowerCase() !== marca.toLowerCase();
        if (donoOutro || (modoMarca === "livre" && nomeOutro)) {
          return json({
            error: `Este ativo foi enviado para a marca "${a.brand_name ?? "outra"}" e você está gerando para "${marca}". Anexe a embalagem certa ou troque a marca.`,
          }, 409);
        }
      }
    }

    const f = FORMATOS[formato];
    modelo = referencePath ? MODELO_COM_REFERENCIA : MODELO_LIVRE;

    // ---- Diretor Criativo ----
    // O cliente escreveu em português comum. Aqui isso vira direção criativa
    // e um prompt profissional. Se o Diretor falhar, a geração NÃO para: cai
    // no prompt montado por regra, que é pior mas funciona. Perder a imagem
    // porque a etapa de texto tropeçou seria trocar um problema por outro.
    let prompt = montarPrompt(brief, formato, brand?.guardrails, marca, !!referencePath);
    let briefing: Record<string, unknown> | null = null;
    // 'success' | 'fallback'. Precisa aparecer no registro: sem isso, cinco
    // falhas seguidas passaram despercebidas e a imagem saiu do prompt de
    // regra sem ninguem saber que a direcao criativa tinha morrido.
    let diretorStatus = "fallback";

    if (ANTHROPIC && usarDiretor) {
      const t0 = Date.now();
      try {
        // Anti-repetição: as últimas assinaturas estruturais desta marca. Sem
        // isto o modelo repete mesa-xícara-fundo-desfocado para pedidos
        // diferentes — variar o cenário não resolve, o que precisa variar é a
        // estrutura da peça.
        const { data: recentes } = await db.from("studio_generations")
          .select("briefing")
          .eq("organization_id", organizationId)
          .not("briefing", "is", null)
          .order("created_at", { ascending: false }).limit(30);
        const fingerprints = (recentes ?? [])
          .map((r: { briefing?: Record<string, unknown> }) => r.briefing?.creative_fingerprint)
          .filter((x: unknown): x is string => typeof x === "string" && x.length > 3)
          .slice(0, 5);
        // As frases que este cliente já recebeu. Numa leva de sete bom-dias,
        // as anteriores já estão gravadas quando a próxima é pedida — é o que
        // impede sete variações da mesma frase.
        // Frase de OUTRO cliente nunca aparece aqui: a unicidade entre
        // clientes é conferida por hash, adiante, justamente para que um
        // cliente não veja o texto do outro.
        const jaUsadas = (recentes ?? [])
          .map((r: { briefing?: Record<string, unknown> }) => r.briefing?.headline)
          .filter((x: unknown): x is string => typeof x === "string" && x.length > 3);

        const system = systemDoDiretor({
          intencao: brief, tipo, canal: formato, marca,
          dna: modoMarca === "livre" ? null : brand?.guardrails,
          modoMarca,
          temAtivoOficial: !!referencePath,
          qtdAtivos: listaRef.length, fingerprintsRecentes: fingerprints,
          headlinesProibidas: jaUsadas,
          estilo, modoTexto, papeis, handle,
        });
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: MODELO_DIRETOR, max_tokens: 4000, system,
            messages: [{ role: "user", content: `Pedido de quem encomendou:\n"""${brief}"""\n\nTipo: ${TIPOS[tipo]?.rotulo ?? "livre"}. Devolva só o JSON.` }],
          }),
        });
        const txt = await r.text();
        const requestIdDiretor = r.headers.get("request-id");
        if (r.ok) {
          const j = JSON.parse(txt);
          const bruto = (j.content || []).find((b: { type: string }) => b.type === "text")?.text ?? "";
          const achado = bruto.match(/\{[\s\S]*\}/);
          if (!achado) throw new Error("Diretor nao devolveu JSON. Inicio: " + bruto.slice(0, 150));
          {
            // Se o parse falhar, a excecao SOBE e vira registro. Resposta
            // truncada por max_tokens era exatamente este caso: JSON pela
            // metade, parse quebrado, e silencio absoluto.
            try {
              briefing = JSON.parse(achado[0]);
            } catch (_) {
              throw new Error("Diretor devolveu JSON invalido (" + achado[0].length + " chars, provavel truncamento). Fim: ..." + achado[0].slice(-120));
            }
            diretorStatus = "success";
            const dele = (briefing?.final_prompt ?? briefing?.prompt_imagem) as unknown;
            if (typeof dele === "string" && dele.length > 40) prompt = dele;
            // O idioma é regra do produto, e regra não pode depender só de o
            // modelo obedecer. Não bloqueia — heurística erra, e derrubar uma
            // geração paga por falso positivo seria pior. Marca para conferir.
            briefing.output_language = LOCALE_SAIDA;
            const suspeitos = [briefing.headline, briefing.support_text].filter(pareceEstrangeiro);
            if (suspeitos.length) {
              briefing.aviso_idioma = "Texto possivelmente fora do português do Brasil — conferir antes de publicar.";
            }
          }
          // Custo do Diretor é custo do produto. Sem esta linha, o texto viraria
          // exatamente o buraco que a auditoria encontrou na imagem.
          await registrarUsoDeIA(db, {
            company_id: companyId, organization_id: organizationId, user_id: userId,
            operation: "direcao_criativa", provider: "anthropic", model: MODELO_DIRETOR,
            prompt_version: DIRETOR_VERSION,
            input_tokens: j?.usage?.input_tokens ?? null,
            output_tokens: j?.usage?.output_tokens ?? null,
            cached_tokens: j?.usage?.cache_read_input_tokens ?? null,
            cost_usd: custoDoDiretorUSD(j?.usage),
            request_id: requestIdDiretor, subject_type: "generation", subject_id: null,
            status: "ok", duration_ms: Date.now() - t0,
          });
        } else {
          await registrarUsoDeIA(db, {
            company_id: companyId, organization_id: organizationId, user_id: userId,
            operation: "direcao_criativa", provider: "anthropic", model: MODELO_DIRETOR,
            prompt_version: DIRETOR_VERSION, request_id: requestIdDiretor,
            status: "erro", error_text: txt.slice(0, 400), duration_ms: Date.now() - t0,
          });
        }
      } catch (e) {
        // A imagem continua saindo com o prompt de regra — mas a falha DEIXA
        // RASTRO. Silenciosa, custou cinco direcoes criativas pagas e jogadas
        // fora sem ninguem perceber.
        const msg = String(e instanceof Error ? e.message : e).slice(0, 400);
        console.error("diretor criativo falhou:", msg);
        await registrarUsoDeIA(db, {
          company_id: companyId, organization_id: organizationId, user_id: userId,
          operation: "direcao_criativa", provider: "anthropic", model: MODELO_DIRETOR,
          prompt_version: DIRETOR_VERSION, status: "erro", error_text: msg,
          duration_ms: Date.now() - t0,
        });
      }
    }

    // ---- Trava: nenhuma outra marca pode aparecer no prompt ----
    // A verificação que teria impedido o incidente. É determinística e roda
    // ANTES de pagar a imagem: se o texto que vai para o gerador nomeia uma
    // marca que não é a desta peça, a geração não sai.
    const { data: conhecidas } = await db.from("studio_brand_profiles").select("name");
    const nomes = (conhecidas ?? []).map((m: { name: string }) => m.name).filter(Boolean);
    const intrusa = marcaEstranhaNoPrompt(prompt, marca, nomes);
    if (intrusa) {
      console.error(`contaminacao de marca: "${intrusa}" no prompt de "${marca}"`);
      return json({
        error: `A direção criativa citou a marca "${intrusa}" numa peça de "${marca}". A geração foi bloqueada antes de gastar. Tente de novo.`,
        contaminacao: intrusa,
      }, 409);
    }

    // ---- Trava: a frase não pode já existir, em cliente nenhum ----
    // Comparação por hash: responde "já existe" sem que ninguém precise ver o
    // texto do outro cliente.
    const headline = typeof briefing?.headline === "string" ? briefing.headline.trim() : "";
    const headlineHash = headline.length > 3 ? await impressaoDigital(headline) : null;
    if (headlineHash) {
      const { data: repetida } = await db.from("studio_content_fingerprints")
        .select("id").eq("headline_hash", headlineHash).maybeSingle();
      if (repetida) {
        return json({
          error: `A frase "${headline}" já foi entregue antes. A geração foi bloqueada antes de gastar. Peça outra.`,
          repetida: true,
        }, 409);
      }
    }

    // ---- Nasce a tentativa, ANTES da chamada ----
    // Assim uma chamada que falha continua existindo no histórico: tentativa
    // perdida também consumiu tempo e, às vezes, dinheiro.
    const { data: ger, error: gErr } = await db
      .from("studio_generations")
      .insert({
        company_id: companyId, created_by: userId,
        organization_id: organizationId, brand_id: brand?.id ?? null,
        format: formato, content_type: tipo, brief, prompt, briefing,
        creative_director_status: diretorStatus,
        reference_path: referencePath, reference_paths: listaRef.length ? listaRef : null,
        reference_roles: papeis.length ? papeis : null,
        style: estilo ?? null, text_mode: modoTexto, handle,
        brand_mode: modoMarca, brand_name: marca,
        batch_id: batchId, batch_index: batchIndex,
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
      const fd = new FormData();
      fd.append("model", modelo);
      fd.append("prompt", prompt);
      fd.append("size", size);
      fd.append("quality", "high");
      fd.append("output_format", "png");

      // Com mais de uma referência o campo vira `image[]` — é a convenção de
      // array em multipart da OpenAI. Com uma só mantém `image`, que é o
      // formato já validado em produção.
      const campo = listaRef.length > 1 ? "image[]" : "image";
      const baixados = [{ path: referencePath, blob: arquivo }];
      for (const outro of listaRef.slice(1)) {
        const { data: b } = await db.storage.from("studio-videos").download(outro);
        if (b) baixados.push({ path: outro, blob: b });
      }

      for (const item of baixados) {
        const nome = item.path!.split("/").pop() || "ref.png";
        const n = nome.toLowerCase();
        const porExtensao = n.endsWith(".webp") ? "image/webp"
          : (n.endsWith(".jpg") || n.endsWith(".jpeg")) ? "image/jpeg" : "image/png";
        // O tipo TEM que ir no Blob: sem ele o FormData manda
        // application/octet-stream e a OpenAI recusa — ela olha o MIME, não a
        // extensão do nome.
        const mime = item.blob.type && item.blob.type.startsWith("image/") ? item.blob.type : porExtensao;
        fd.append(campo, new Blob([new Uint8Array(await item.blob.arrayBuffer())], { type: mime }), nome);
      }
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
        company_id: companyId, organization_id: organizationId, user_id: userId, operation: "image_generation",
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

    // A frase entra no livro de unicidade só depois de a peça existir de
    // verdade: queimar uma frase numa geração que falhou seria perder frase
    // boa por nada. O índice único é quem garante a regra sob concorrência.
    if (headlineHash) {
      await db.from("studio_content_fingerprints").insert({
        headline_hash: headlineHash,
        structure_hash: typeof briefing?.creative_fingerprint === "string"
          ? await impressaoDigital(briefing.creative_fingerprint) : null,
        organization_id: organizationId, generation_id: geracaoId,
      });
    }

    // ---- Custo, do usage REAL ----
    const uso = out?.usage ?? null;
    const custo = custoDaImagemUSD(modelo, uso);
    // O total já era gravado; a decomposição é o que diz quanto a imagem de
    // referência acrescentou — texto e imagem custam preços diferentes.
    const entrada = decomporEntrada(uso);
    await registrarUsoDeIA(db, {
      company_id: companyId, organization_id: organizationId, user_id: userId, operation: "image_generation",
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
        company_id: companyId, organization_id: organizationId, user_id: userId, operation: "image_generation",
        provider: "openai", model: modelo, prompt_version: PROMPT_VERSION,
        subject_type: "generation", subject_id: geracaoId,
        status: "erro", error_text: msg, duration_ms: Date.now() - inicio,
      });
    }
    return json({ error: msg }, 500);
  }
});
