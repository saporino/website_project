// PESQUISA DE GÔNDOLA — lê a etiqueta de preço nas fotos tiradas na loja (ou nas páginas
// de um PDF de outra fonte) e grava os itens para o Vlademir conferir antes do PDF.
//
// Regra dura: a IA NÃO INVENTA. Quando não dá para ler o preço, o peso ou o nome, ela
// devolve null e diz o motivo em `nao_li`. Preço de gôndola errado no PDF vira proposta
// errada para a rede — por isso todo item nasce `revisado = false`.
//
// Recebe { pesquisa_id, paths: string[] } (fotos já no bucket privado `gondola`).
// Gate: admin logado. Deploy: --no-verify-jwt (a função confere o admin por conta própria).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLAUDE_MODEL = "claude-sonnet-5";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `Você lê FOTOS DE GÔNDOLA de supermercado brasileiro e extrai os cafés visíveis com o preço da etiqueta.

REGRAS (a mais importante primeiro):
1. NUNCA invente. Se não dá para ler com segurança, devolva null no campo e explique em "nao_li".
2. Só inclua CAFÉ (torrado e moído, em grãos, solúvel, cápsula). Ignore achocolatado, chá, filtro, açúcar e outros produtos.
3. Preço: use o preço que o consumidor paga hoje. Se a etiqueta tem promoção e preço normal, coloque o promocional em "preco", o normal em "preco_regular" e "em_promocao": true.
4. Etiqueta de "leve 3 pague 2", "preço no app" ou "preço por kg" NÃO é preço unitário: nesse caso preco = null e explique em "nao_li".
5. Peso em GRAMAS (500 g = 500; 1 kg = 1000). Se o pacote não mostra o peso, peso_g = null.
6. Uma linha por PRODUTO visível com etiqueta legível. Se o mesmo produto aparece duas vezes na foto, devolva uma vez só.
7. confianca: "alta" quando leu nome, peso e preço com clareza; "media" quando deduziu algo; "baixa" quando está borrado ou parcialmente coberto.
8. Nome do produto como está na embalagem (ex.: "Pilão Tradicional", "3 Corações Extraforte"). Marca separada em "marca".

Responda SOMENTE um JSON:
{"itens":[{"produto":"...","marca":"...","peso_g":500,"preco":14.89,"preco_regular":null,"em_promocao":false,"confianca":"alta","nao_li":null}]}
Se a foto não tiver nenhum café com etiqueta legível, devolva {"itens":[]}.`;

const tipoDaImagem = (p: string) => {
  const s = p.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  if (s.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
};

const base64 = (bytes: Uint8Array) => {
  let bin = ""; const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC) return json({ error: "Configurar ANTHROPIC_API_KEY nos secrets." }, 500);

    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { pesquisa_id, paths } = await req.json();
    if (!pesquisa_id || !Array.isArray(paths) || !paths.length) return json({ error: "Faltou a pesquisa ou as fotos." }, 400);

    const db = createClient(url, service);
    const { data: pesquisa } = await db.from("gondola_pesquisas").select("id").eq("id", pesquisa_id).maybeSingle();
    if (!pesquisa) return json({ error: "Pesquisa não encontrada." }, 404);

    const { data: jaTem } = await db.from("gondola_itens").select("ordem").eq("pesquisa_id", pesquisa_id).order("ordem", { ascending: false }).limit(1);
    let ordem = (jaTem?.[0]?.ordem ?? 0) + 1;

    const resultado: any[] = [];
    for (const path of paths.slice(0, 40)) {
      try {
        const { data: arquivo, error: eBaixar } = await db.storage.from("gondola").download(path);
        if (eBaixar || !arquivo) throw new Error("não consegui abrir o arquivo");
        const bytes = new Uint8Array(await arquivo.arrayBuffer());
        const media = tipoDaImagem(path);
        const bloco = media === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64(bytes) } }
          : { type: "image", source: { type: "base64", media_type: media, data: base64(bytes) } };

        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: CLAUDE_MODEL, max_tokens: 4000, system: SYSTEM,
            messages: [{ role: "user", content: [bloco, { type: "text", text: "Extraia os cafés com etiqueta legível. Só o JSON." }] }],
          }),
        });
        const texto = await r.text();
        if (!r.ok) throw new Error("IA: " + texto.slice(0, 160));
        const cJson = JSON.parse(texto);
        const bruto = (cJson.content || []).find((b: any) => b.type === "text")?.text ?? "";
        const m = bruto.match(/\{[\s\S]*\}/);
        const saida = JSON.parse((m ? m[0] : bruto).replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
        const itens = Array.isArray(saida.itens) ? saida.itens : [];

        const linhas = itens.map((it: any) => ({
          pesquisa_id,
          foto_path: path,
          produto: it.produto ?? null,
          marca: it.marca ?? null,
          peso_g: Number.isFinite(Number(it.peso_g)) ? Number(it.peso_g) : null,
          preco: Number.isFinite(Number(it.preco)) ? Number(it.preco) : null,
          preco_regular: Number.isFinite(Number(it.preco_regular)) ? Number(it.preco_regular) : null,
          em_promocao: !!it.em_promocao,
          lido_pela_ia: true,
          nao_li: it.nao_li ?? null,
          confianca: ["alta", "media", "baixa"].includes(it.confianca) ? it.confianca : "baixa",
          revisado: false,
          ordem: ordem++,
        }));

        // Foto sem nenhum café legível também vira linha, para você ver que ela foi lida.
        if (!linhas.length) {
          linhas.push({
            pesquisa_id, foto_path: path, produto: null, marca: null, peso_g: null, preco: null,
            preco_regular: null, em_promocao: false, lido_pela_ia: true,
            nao_li: "nenhum café com etiqueta legível nesta foto", confianca: "baixa", revisado: false, ordem: ordem++,
          });
        }
        const { error: eGravar } = await db.from("gondola_itens").insert(linhas);
        if (eGravar) throw new Error(eGravar.message);
        resultado.push({ path, itens: linhas.length });
      } catch (e) {
        resultado.push({ path, erro: String(e instanceof Error ? e.message : e) });
      }
    }

    await db.from("gondola_pesquisas").update({ updated_at: new Date().toISOString() }).eq("id", pesquisa_id);
    return json({ ok: true, fotos: resultado });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
