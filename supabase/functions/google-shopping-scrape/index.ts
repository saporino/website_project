// Coleta preços de café das redes que NÃO têm API pública (bloqueiam scraping direto):
// Pão de Açúcar, Carrefour, Extra, Assaí, Tenda, Dia, St Marche.
// Fonte: Google Shopping via Apify (actor automation-lab/google-shopping-scraper).
// UMA busca "café" traz as ofertas de vários mercados juntas -> distribuímos por rede.
// Gate: admin (botão) OU service role (cron). Token Apify SÓ no env do Supabase.
// Normaliza igual ao VTEX/e-commerce (R$/kg + sanidade).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalize } from '../_shared/normalize.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const ACTOR = "automation-lab~google-shopping-scraper";
const APIFY = "https://api.apify.com/v2";

// merchant do Google Shopping -> nossa rede (só as bloqueadas). Ordem = prioridade.
const MERCHANT_MAP: [RegExp, string][] = [
  [/p[ãa]o\s*de\s*a[çc][úu]car/i, "super_pao"],
  [/assa[íi]/i,                   "super_assai"],
  [/carrefour/i,                  "super_carrefour"],
  [/tenda/i,                      "super_tenda"],
  [/\bst\.?\s*marche\b|saint\s*marche/i, "super_stmarche"],
  [/\bextra\b/i,                  "super_extra"],
  [/\bdia\b/i,                    "super_dia"],
];
function matchMerchant(merchant: string): string | null {
  const m = merchant || "";
  for (const [re, mk] of MERCHANT_MAP) if (re.test(m)) return mk;
  return null;
}

// preço: o campo "price" vem "R$ 25,90" (confiável). priceNumeric vem em CENTAVOS (2590).
function toPrice(item: any): number | null {
  const s = String(item.price ?? item.priceText ?? "");
  const m = s.replace(/[^\d,]/g, "").replace(",", "."); // "R$ 1.234,56" -> "1234.56"
  const n = parseFloat(m);
  if (isFinite(n) && n > 0) return n;
  if (typeof item.priceNumeric === "number" && item.priceNumeric > 0) return +(item.priceNumeric / 100).toFixed(2);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = Deno.env.get("APIFY_TOKEN");
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");

    let ok = bearer === service;
    if (!ok) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      ok = !!isAdmin;
    }
    if (!ok) return json({ error: "forbidden" }, 403);
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets do Supabase." }, 500);

    const body = await req.json().catch(() => ({}));
    const requested: string | undefined = body?.marketplace; // pra reportar contagem daquela aba
    const terms: string[] = Array.isArray(body?.terms) && body.terms.length ? body.terms : ["café"];
    const maxResults: number = Math.min(Math.max(body?.maxResults ?? 100, 20), 200);

    const db = createClient(url, service);
    const { data: comp } = await db.from("companies").select("id").order("created_at").limit(1).single();
    const company_id = comp?.id;
    if (!company_id) return json({ error: "sem company_id" }, 500);

    // dispara o actor SÍNCRONO e já pega os itens do dataset
    const runUrl = `${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`;
    const resp = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: terms, country: "br", language: "pt", maxResults }),
    });
    if (resp.status === 402) return json({ error: "no_credit", message: "Crédito Apify do mês esgotado." }, 402);
    if (resp.status === 403 || resp.status === 401) return json({ error: "actor_locked", message: "O actor de Google Shopping precisa ser alugado/habilitado na sua conta Apify (deu só uns runs grátis de teste)." }, 402);
    if (!resp.ok) return json({ error: "apify_error", message: `Apify retornou ${resp.status}.` }, 502);
    const items: any[] = await resp.json().catch(() => []);
    if (!Array.isArray(items) || !items.length) return json({ inserted: 0, message: "Google Shopping não retornou itens." });

    const captured_at = new Date().toISOString();
    const perMk: Record<string, Set<string>> = {}; // dedup por rede
    const merchantsSeen: Record<string, number> = {}; // diagnóstico: quais lojas o Google trouxe (café)
    const rows: any[] = [];
    for (const item of items) {
      const title: string = item.title ?? item.name ?? "";
      if (!title) continue;
      const t = title.toLowerCase();
      const isCoffee = /caf[ée]/.test(t);
      const isNotCoffee = /caf[ée] da manh[ãa]|biscoito|bolo|iogurte|cereal|wafer|cookie|torta|p[ãa]o de|bebida l[áa]ctea|achocolatado|sorvete|gelatina|pudim|barra de|sand[áa]lia|chinelo|pote|caneca|x[íi]cara|coador|suporte|garrafa|moedor|bebedouro|leiteira|prateleira|organizador|tapete|capacho|caneco|bule|filtro de papel/.test(t);
      if (!isCoffee || isNotCoffee) continue;
      const mName = (item.merchant ?? item.seller ?? item.store ?? "?");
      merchantsSeen[mName] = (merchantsSeen[mName] ?? 0) + 1;

      const marketplace = matchMerchant(item.merchant ?? item.seller ?? item.store ?? "");
      if (!marketplace) continue; // só as redes bloqueadas nos interessam

      const price = toPrice(item);
      if (price == null) continue;

      // productUrl costuma vir "" (string vazia) -> usa || para cair no fallback por título
      const sku = String(item.productId || item.productUrl || item.link || `${marketplace}:${title}`).slice(0, 300);
      (perMk[marketplace] ??= new Set());
      if (perMk[marketplace].has(sku)) continue;
      perMk[marketplace].add(sku);

      rows.push({
        company_id, captured_at, marketplace,
        search_term: terms.join(","),
        listing_sku: sku, title,
        thumb_url: item.thumbnail ?? item.imageUrl ?? item.image ?? (Array.isArray(item.images) ? item.images[0] : null) ?? null,
        url: item.productUrl ?? item.link ?? null,
        domain_id: item.merchant ?? null,
        price, price_before: null, discount_pct: null, currency: "BRL",
        search_position: item.position ?? null, is_sponsored: false,
        ...normalize({ title, price, category: null }), raw: item,
      });
    }

    const topMerchants = Object.entries(merchantsSeen).sort((a, b) => b[1] - a[1]).slice(0, 25);
    if (!rows.length) return json({ inserted: 0, total: 0, captured_at, merchantsSeen: topMerchants, message: "Nenhuma oferta das redes bloqueadas no resultado." });
    const { error } = await db.from("ecommerce_price_snapshots").insert(rows);
    if (error) return json({ error: error.message }, 500);

    const byMk = Object.fromEntries(Object.entries(perMk).map(([k, v]) => [k, v.size]));
    const inserted = requested && byMk[requested] != null ? byMk[requested] : rows.length;
    return json({ inserted, total: rows.length, byMarketplace: byMk, merchantsSeen: topMerchants, captured_at });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
