// Edge Function: DISCOVERY RUN — dispara actors Apify SOB DEMANDA para a camada de descoberta.
// Reutiliza o padrão da apify-places: token (APIFY_TOKEN) só no env do Supabase, gate is_admin(),
// registro em prospect_runs (estendido). NÃO substitui apify-places (que segue no fluxo de leads).
// Adapters por source: whatsapp_group (lofomachines), whatsapp_channel (memo23), google_places (compass).
// Normalização/dedupe/score dos itens é feita no frontend (importDiscoveryResults.ts).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const APIFY = "https://api.apify.com/v2";

// Registry de adapters: source lógico -> actor + montagem de input + tipo/tento de resultado.
// Só as sources com actor real aqui aparecem como "operacionais" no MVP.
type Adapter = {
  actor: string;                          // username~actor-name
  resultType: string;                     // tipo normalizado do resultado
  buildInput: (p: RunParams) => Record<string, unknown>;
  capField?: string;                      // campo do input que limita resultados (p/ log)
};
type RunParams = { keywords: string[]; country: string; state?: string; city?: string; maxResults: number };

const ADAPTERS: Record<string, Adapter> = {
  whatsapp_group: {
    actor: "lofomachines~whatsapp-group-search",
    resultType: "PUBLIC_WHATSAPP_GROUP",
    capField: "maxGroups",
    buildInput: (p) => ({ keywords: p.keywords, country: (p.country || "BR").toUpperCase(), maxGroups: p.maxResults }),
  },
  whatsapp_channel: {
    actor: "memo23~whatsapp-channel-search",
    resultType: "PUBLIC_WHATSAPP_CHANNEL",
    capField: "maxItems",
    buildInput: (p) => ({ keywords: p.keywords, country: (p.country || "BR").toUpperCase(), maxItems: p.maxResults }),
  },
  google_places: {
    actor: "compass~crawler-google-places",
    resultType: "BUSINESS",
    capField: "maxCrawledPlacesPerSearch",
    buildInput: (p) => ({
      searchStringsArray: p.keywords,
      locationQuery: [p.city, p.state, "Brasil"].filter(Boolean).join(", "),
      maxCrawledPlacesPerSearch: p.maxResults,
      language: "pt-BR",
      countryCode: "br",
    }),
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const token = Deno.env.get("APIFY_TOKEN");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Gate: só admin
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets do Supabase." }, 500);

    const db = createClient(url, service);
    const body = await req.json();
    const action = body?.action;

    // ===================== ACCOUNT / BUDGET =====================
    // Diagnóstico de conta Apify (tier, uso mensal, saldo, faturas em aberto). NÃO expõe o token.
    if (action === "account") {
      const me = await fetch(`${APIFY}/users/me?token=${token}`);
      const meJson = await me.json().catch(() => ({}));
      if (!me.ok) {
        const txt = JSON.stringify(meJson).slice(0, 400);
        const blocked = /invoice|overdue|payment|suspend/i.test(txt);
        return json({ ok: false, blocked, message: txt }, 200);
      }
      const u = meJson?.data ?? {};
      // limites/uso mensal
      const lim = await fetch(`${APIFY}/users/me/limits?token=${token}`);
      const limJson = await lim.json().catch(() => ({}));
      const l = limJson?.data ?? {};
      return json({
        ok: true,
        username: u.username ?? null,
        plan: u.plan?.id ?? u.plan ?? null,
        monthlyUsageUsd: l.current?.monthlyUsageUsd ?? l.monthlyUsageUsd ?? null,
        maxMonthlyUsageUsd: l.limits?.maxMonthlyUsageUsd ?? l.maxMonthlyUsageUsd ?? null,
        raw: { plan: u.plan ?? null, limits: l },
      });
    }

    // ===================== START =====================
    if (action === "start") {
      const { source, keywords, country, state, city, maxResults, campaignId } = body;
      const adapter = ADAPTERS[source as string];
      if (!adapter) return json({ error: `source inválido. Operacionais: ${Object.keys(ADAPTERS).join(", ")}` }, 400);
      if (!Array.isArray(keywords) || keywords.length === 0) return json({ error: "keywords[] obrigatório." }, 400);

      const cap = Math.max(1, Math.min(Number(maxResults) || 10, 50)); // cap server-side
      const params: RunParams = { keywords, country: country || "BR", state, city, maxResults: cap };
      const input = adapter.buildInput(params);

      // registra o run (prospect_runs estendido)
      const { data: runRow, error: insErr } = await db.from("prospect_runs").insert({
        source_type: source, provider: "apify", actor_id: adapter.actor,
        keywords, country: country || "BR", uf: state || null, municipio: city || null,
        max_places: cap, keyword_count: keywords.length, places_estimate: cap * keywords.length,
        campaign_id: campaignId || null, status: "queued",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      const runId = runRow!.id;

      const start = await fetch(`${APIFY}/acts/${adapter.actor}/runs?token=${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      if (!start.ok) {
        const txt = await start.text();
        const blocked = start.status === 402 || /invoice|usage|limit|credit|quota|payment/i.test(txt);
        await db.from("prospect_runs").update({
          status: blocked ? "no_credit" : "failed", error_message: txt.slice(0, 500), finished_at: new Date().toISOString(),
        }).eq("id", runId);
        return json({ error: blocked ? "no_credit" : "apify_error", message: txt.slice(0, 300), runId }, start.status === 402 ? 402 : 502);
      }
      const started = await start.json();
      await db.from("prospect_runs").update({
        apify_run_id: started?.data?.id, apify_dataset_id: started?.data?.defaultDatasetId, status: "running",
      }).eq("id", runId);
      return json({ runId, apifyRunId: started?.data?.id, source, actor: adapter.actor, input });
    }

    // ===================== STATUS =====================
    if (action === "status") {
      const { runId } = body;
      if (!runId) return json({ error: "runId obrigatório." }, 400);
      const { data: run } = await db.from("prospect_runs").select("*").eq("id", runId).single();
      if (!run) return json({ error: "run não encontrado." }, 404);
      if (run.status === "done") return json({ status: "done", run, items: [] });
      if (!run.apify_run_id) return json({ status: run.status });

      const r = await fetch(`${APIFY}/actor-runs/${run.apify_run_id}?token=${token}`);
      const rj = await r.json();
      const st = rj?.data?.status;
      const costUsd = rj?.data?.usageTotalUsd ?? null;
      if (st === "READY" || st === "RUNNING") return json({ status: "running" });

      if (st === "SUCCEEDED") {
        const ds = run.apify_dataset_id || rj?.data?.defaultDatasetId;
        const itemsResp = await fetch(`${APIFY}/datasets/${ds}/items?token=${token}&clean=true`);
        const items = await itemsResp.json();
        const arr = Array.isArray(items) ? items : [];
        await db.from("prospect_runs").update({ places_returned: arr.length, cost_actual_usd: costUsd }).eq("id", runId);
        return json({ status: "succeeded", run, items: arr, source: run.source_type, actor: run.actor_id, costUsd });
      }

      const msg = rj?.data?.statusMessage || st;
      const blocked = /invoice|usage|limit|credit|quota|payment/i.test(String(msg));
      await db.from("prospect_runs").update({ status: blocked ? "no_credit" : "failed", error_message: String(msg).slice(0, 500), finished_at: new Date().toISOString() }).eq("id", runId);
      return json({ status: blocked ? "no_credit" : "failed", message: String(msg) });
    }

    return json({ error: "action inválida (account|start|status)." }, 400);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
