// Atualiza o indicador de café cru (CEPEA/ESALQ) automaticamente.
// O CEPEA bloqueia bots; o Notícias Agrícolas republica o indicador e NÃO bloqueia.
// Pode ser chamada por: admin (botão) ou pelo cron (service role) -> upsert em coffee_market_index.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SRC = "https://www.noticiasagricolas.com.br/cotacoes/cafe";

function firstRow(html: string, anchor: string): string[] | null {
  const i = html.toLowerCase().indexOf(anchor);
  if (i < 0) return null;
  const tb = html.toLowerCase().indexOf("<tbody", i);
  if (tb < 0) return null;
  const seg = html.slice(tb, tb + 1000);
  const row = seg.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
  if (!row) return null;
  return [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
}
const toNum = (s?: string) => s ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : null;
const toIso = (s?: string) => { if (!s) return null; const [d, m, y] = s.split("/"); return (d && m && y) ? `${y}-${m}-${d}` : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");

    // gate: admin (botão) OU service role (cron)
    let ok = bearer === service;
    if (!ok) {
      const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
      const { data: isAdmin } = await asUser.rpc("is_admin");
      ok = !!isAdmin;
    }
    if (!ok) return json({ error: "forbidden" }, 403);

    const res = await fetch(SRC, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36", "Accept-Language": "pt-BR" } });
    if (!res.ok) return json({ error: "fonte indisponivel", status: res.status }, 502);
    const html = await res.text();

    const ar = firstRow(html, "cafe-arabica");      // [data, "1.495,05", "-0,67"]
    const co = firstRow(html, "cafe-conillon");      // robusta/conilon (anchor com 2 L na fonte)
    const arabica = toNum(ar?.[1]);
    const conilon = toNum(co?.[1]);
    const ref_date = toIso(ar?.[0]) || toIso(co?.[0]);
    if (!ref_date || (arabica == null && conilon == null))
      return json({ error: "parse_falhou", message: "Layout da fonte pode ter mudado." }, 502);

    const db = createClient(url, service);
    const { error } = await db.from("coffee_market_index")
      .upsert({ ref_date, arabica, conilon, source: "cepea_auto", note: "via noticiasagricolas" }, { onConflict: "ref_date" });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, ref_date, arabica, conilon });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
