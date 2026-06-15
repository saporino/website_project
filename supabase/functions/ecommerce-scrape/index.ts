// Coleta de preços e-commerce via Apify (on-demand). Config por marketplace em ecommerce_sources
// (actor_id + default_input). Adicionar Amazon/Shopee/etc = inserir/editar 1 linha, sem mexer aqui.
// Token APIFY_TOKEN só no env. So admin (is_admin).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalize } from '../_shared/normalize.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const APIFY = "https://api.apify.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = Deno.env.get("APIFY_TOKEN");
    const authHeader = req.headers.get("Authorization") ?? "";

    // gate admin
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets." }, 500);

    const db = createClient(url, service);
    const { marketplace = "mercadolivre" } = await req.json().catch(() => ({}));

    // config do marketplace
    const { data: src } = await db.from("ecommerce_sources").select("*").eq("marketplace", marketplace).single();
    if (!src || !src.enabled || !src.actor_id || !src.default_input) {
      return json({ error: "not_configured", message: `Fonte "${marketplace}" sem ator/input configurado ou desativada.` }, 409);
    }

    // company padrão (Saporino)
    const { data: comp } = await db.from("companies").select("id").order("created_at").limit(1).single();
    const company_id = comp?.id;
    if (!company_id) return json({ error: "sem company_id" }, 500);

    // roda o ator e recebe os itens direto (pay-per-result; o input já limita custo)
    const r = await fetch(`${APIFY}/acts/${src.actor_id}/run-sync-get-dataset-items?token=${token}&format=json&clean=1`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(src.default_input),
    });
    if (!r.ok) {
      const txt = await r.text();
      const noCredit = r.status === 402 || /usage|limit|credit|quota/i.test(txt);
      return json({ error: noCredit ? "no_credit" : "apify_error", message: txt.slice(0, 400) }, noCredit ? 402 : 502);
    }
    const items: any[] = await r.json();
    const captured_at = new Date().toISOString();
    const rows = items.map((raw) => ({
      company_id, captured_at, marketplace,
      search_term: raw.searchTerm ?? null, listing_sku: raw.itemId ?? raw.sku ?? raw.asin ?? null, title: raw.title ?? '',
      thumb_url: raw.thumbnail ?? null, url: raw.url ?? null, domain_id: raw.category ?? null,
      price: typeof raw.price === 'number' ? raw.price : null, price_before: raw.originalPrice ?? null,
      discount_pct: raw.discountPercentage ?? null, currency: raw.currency ?? 'BRL',
      search_position: raw.position ?? null, is_sponsored: !!raw.isSponsored,
      ...normalize(raw), raw,
    })).filter((r) => r.price != null && r.listing_sku && r.title);

    if (!rows.length) return json({ inserted: 0, captured_at, message: "Ator não retornou itens válidos." });
    const { error } = await db.from("ecommerce_price_snapshots").insert(rows);
    if (error) return json({ error: error.message }, 500);
    return json({ inserted: rows.length, captured_at });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
