// Coleta de preços de café em supermercados na plataforma VTEX (API pública de catálogo).
// Config por rede em ecommerce_sources.default_input = { vtex_base, terms?, pages? }.
// Sem Apify, sem token: é a API pública /api/catalog_system/pub/products/search.
// Gate: admin (botão) OU service role (cron). Normaliza igual ao e-commerce (R$/kg + sanidade).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalize } from '../_shared/normalize.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson(u: string): Promise<any> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, "Accept": "application/json" }, signal: ctrl.signal });
    if (!r.ok && r.status !== 206) return null;
    if (!(r.headers.get("content-type") || "").includes("json")) return null;
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(tid); }
}

// CEP -> regionId (necessario para precos regionais na Intelligent Search).
async function getRegionId(base: string, cep: string): Promise<string | null> {
  const j = await getJson(`${base}/api/checkout/pub/regions?country=BRA&postalCode=${encodeURIComponent(cep)}`);
  return Array.isArray(j) && j[0]?.id ? j[0].id : null;
}

// Busca antiga (catalog_system) — usada quando nao ha CEP configurado.
async function catalogPage(base: string, term: string, from: number, to: number): Promise<any[]> {
  const j = await getJson(`${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=${from}&_to=${to}`);
  return Array.isArray(j) ? j : [];
}

// Busca NOVA (Intelligent Search) + regionId — traz o catalogo regional completo (com preco),
// igual ao site. Resolve redes como o Atacadao que zeram o preco na API antiga.
async function isPage(base: string, term: string, from: number, to: number, regionId: string | null): Promise<any[]> {
  const rid = regionId ? `&regionId=${encodeURIComponent(regionId)}` : "";
  const u = `${base}/api/io/_v/api/intelligent-search/product_search/trade-policy/1?query=${encodeURIComponent(term)}&locale=pt-BR&hideUnavailableItems=true&from=${from}&to=${to}${rid}`;
  const j = await getJson(u);
  return Array.isArray(j?.products) ? j.products : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");

    let ok = bearer === service;
    if (!ok) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      ok = !!isAdmin;
    }
    if (!ok) return json({ error: "forbidden" }, 403);

    const db = createClient(url, service);
    const { marketplace } = await req.json().catch(() => ({}));
    if (!marketplace) return json({ error: "marketplace ausente" }, 400);

    const { data: src } = await db.from("ecommerce_sources").select("*").eq("marketplace", marketplace).single();
    const base: string | undefined = src?.default_input?.vtex_base;
    if (!src || !base) {
      return json({ error: "not_configured", message: `Rede "${marketplace}" sem domínio VTEX configurado.` }, 409);
    }
    const terms: string[] = Array.isArray(src.default_input?.terms) && src.default_input.terms.length ? src.default_input.terms : ["café"];
    const pages: number = Math.min(Math.max(src.default_input?.pages ?? 5, 1), 10);
    // CEP configurado -> usa a Intelligent Search com regionId (catalogo regional completo).
    const cep: string | undefined = src.default_input?.cep;
    const baseUrl = base.replace(/\/+$/, "");
    const regionId = cep ? await getRegionId(baseUrl, cep) : null;
    const useIS = !!regionId;

    const { data: comp } = await db.from("companies").select("id").order("created_at").limit(1).single();
    const company_id = comp?.id;
    if (!company_id) return json({ error: "sem company_id" }, 500);

    // coleta paginada por termo; dedup por productId no lote
    const seen = new Set<string>();
    const products: any[] = [];
    for (const term of terms) {
      for (let p = 0; p < pages; p++) {
        const from = p * 50, to = from + 49;
        const page = useIS
          ? await isPage(baseUrl, term, from, to, regionId)
          : await catalogPage(baseUrl, term, from, to);
        if (!page.length) break;
        for (const prod of page) {
          const id = String(prod.productId ?? prod.productReference ?? prod.linkText ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id); products.push(prod);
        }
        if (page.length < 50) break;
      }
    }
    if (!products.length) return json({ inserted: 0, message: "Nenhum produto retornado pela VTEX (domínio/termo?)." });

    const captured_at = new Date().toISOString();
    const rows = products.map((prod) => {
      const item = prod.items?.[0];
      const offer = item?.sellers?.find((s: any) => s?.commertialOffer?.Price > 0)?.commertialOffer ?? item?.sellers?.[0]?.commertialOffer;
      const price = offer?.Price ?? null;
      const listPrice = offer?.ListPrice ?? null;
      const price_before = (listPrice && price && listPrice > price) ? listPrice : null;
      const discount_pct = price_before ? Math.round((1 - price / price_before) * 100) : null;
      const title: string = prod.productName ?? "";
      const category = Array.isArray(prod.categories) ? prod.categories[0] : null;
      // a busca ft=café traz muito não-café: exige "café" no TÍTULO e exclui acessórios
      // (sandália/caneca cor café, coador, pote, etc.). Preço 0 = indisponível -> filtrado abaixo.
      const t = title.toLowerCase();
      const isCoffee = /caf[ée]/.test(t);
      const isAccessory = /sand[áa]lia|chinelo|pote|caneca|x[íi]cara|coador|suporte|garrafa|moedor|bebedouro|leiteira|prateleira|organizador|tapete|capacho|caneco|bule|filtro de papel/.test(t);
      if (!isCoffee || isAccessory) return null;
      return {
        company_id, captured_at, marketplace,
        search_term: terms.join(","),
        listing_sku: String(prod.productId ?? prod.linkText ?? ""),
        title,
        thumb_url: item?.images?.[0]?.imageUrl ?? null,
        url: prod.link ?? (prod.linkText ? `${base.replace(/\/+$/, "")}/${prod.linkText}/p` : null),
        domain_id: category, price, price_before, discount_pct, currency: "BRL",
        search_position: null, is_sponsored: false,
        ...normalize({ title, price, category }), raw: prod,
      };
    }).filter((r) => r && r.price != null && r.price > 0 && r.listing_sku && r.title);

    if (!rows.length) return json({ inserted: 0, captured_at, message: "Sem itens com preço válido." });
    const { error } = await db.from("ecommerce_price_snapshots").insert(rows);
    if (error) return json({ error: error.message }, 500);
    return json({ inserted: rows.length, captured_at, terms, pages });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
