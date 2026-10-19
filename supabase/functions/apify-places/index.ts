// Edge Function: dispara o actor compass/crawler-google-places (Apify) SOB DEMANDA.
// O token (APIFY_TOKEN) vive SO no env do Supabase — nunca no frontend/repo.
// Acoes: { action: 'start' } e { action: 'status' }. So admin (valida via is_admin()).
// O IMPORT/dedup dos leads e feito no frontend (importApifyLeads.ts); aqui so falamos com a Apify.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ACTOR = "compass~crawler-google-places";
const COST_PER_PLACE = 0.002;          // compass/crawler-google-places = US$1,50/1000 real; US$2/1000 c/ folga
const MONTHLY_PLACES_CAP = 1000;       // teto mensal (plano FREE ~1200; folga de seguranca)
const APIFY = "https://api.apify.com/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const token = Deno.env.get("APIFY_TOKEN");
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) Gate: so admin
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    if (!token) return json({ error: "APIFY_TOKEN ausente nos secrets do Supabase." }, 500);

    const db = createClient(url, service);
    const body = await req.json();
    const action = body?.action;

    // ===================== START =====================
    if (action === "start") {
      const { keywords, uf, municipio, bairro, maxPlaces, category, representativeId } = body;
      if (!Array.isArray(keywords) || keywords.length === 0 || !uf || !municipio)
        return json({ error: "Parametros: keywords[], uf, municipio." }, 400);

      const cap = Math.max(1, Math.min(Number(maxPlaces) || 100, 300)); // cap server-side
      // GEO-BOUND: locationQuery prende a busca à cidade (senão o Google devolve PDVs de outras
      // cidades). searchStrings ficam só com a keyword; a área entra no locationQuery.
      const locationQuery = [bairro, municipio, uf, "Brasil"].filter(Boolean).join(", ");
      const searchStringsArray = keywords.map((k: string) => String(k));
      const placesEstimate = cap * keywords.length;
      const cost = +(placesEstimate * COST_PER_PLACE).toFixed(2);

      // ── Orçamento mensal ──────────────────────────────────────────────
      //
      // Antes isto BARRAVA o run. Deixou de barrar a pedido do Vlademir
      // (19/10/2026): "não tem problema de cobrar, eu só quero um aviso até
      // onde vai o limite e o que vai cobrar depois".
      //
      // Então agora AVISA e espera confirmação. Nada é gasto sem ele ver o
      // valor antes — a primeira chamada devolve os números, e só a segunda,
      // com `confirmado: true`, dispara.
      //
      // E há um motivo concreto para ter afrouxado: a estimativa conta
      // `teto × palavras-chave` e assume que tudo volta cheio. Em outubro ela
      // contou 1090 enquanto o custo REAL do mês foi US$ 0,20. Estava barrando
      // por centavos.
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { data: usedRows } = await db.from("prospect_runs")
        .select("places_estimate, places_returned, cost_estimate_usd, cost_actual_usd")
        .gte("created_at", monthStart.toISOString())
        .in("status", ["running", "done", "queued"]);
      const linhas = usedRows ?? [];
      const soma = (campo: string) => linhas.reduce((s: number, r: any) => s + (Number(r[campo]) || 0), 0);
      const used = soma("places_estimate");
      const usedReal = soma("places_returned");
      const custoMesEstimado = +soma("cost_estimate_usd").toFixed(2);
      const custoMesReal = +soma("cost_actual_usd").toFixed(2);

      const passaDoTeto = used + placesEstimate > MONTHLY_PLACES_CAP;
      if (passaDoTeto && body?.confirmado !== true) {
        return json({
          error: "confirmar_custo",
          message:
            `Este run passa do teto mensal de ~${MONTHLY_PLACES_CAP} lugares.`,
          teto: MONTHLY_PLACES_CAP,
          usado_estimado: used,
          usado_real: usedReal,
          este_run: placesEstimate,
          custo_deste_run_usd: cost,
          custo_mes_estimado_usd: custoMesEstimado,
          custo_mes_real_usd: custoMesReal,
          // O número que importa para decidir: a conta até agora costuma sair
          // MUITO abaixo da estimativa, porque nem toda busca volta cheia.
          explicacao:
            `A estimativa é o pior caso (${placesEstimate} lugares = US$ ${cost.toFixed(2)}). ` +
            `Este mês o estimado foi ${used} e o cobrado de verdade foi US$ ${custoMesReal.toFixed(2)}. ` +
            `Para rodar assim mesmo, confirme.`,
        }, 409);
      }

      // registra o run
      const { data: runRow, error: insErr } = await db.from("prospect_runs").insert({
        uf, municipio, bairro: bairro || null, category: category || null, keywords,
        max_places: cap, keyword_count: keywords.length, places_estimate: placesEstimate,
        cost_estimate_usd: cost, representative_id: representativeId || null, status: "queued",
      }).select("id").single();
      if (insErr) return json({ error: insErr.message }, 500);
      const runId = runRow!.id;

      // dispara o actor (assincrono)
      const input = { searchStringsArray, locationQuery, maxCrawledPlacesPerSearch: cap, language: "pt-BR", countryCode: "br" };
      const start = await fetch(`${APIFY}/acts/${ACTOR}/runs?token=${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      if (!start.ok) {
        const txt = await start.text();
        const noCredit = start.status === 402 || /usage|limit|credit|quota/i.test(txt);
        await db.from("prospect_runs").update({
          status: noCredit ? "no_credit" : "failed", error_message: txt.slice(0, 500), finished_at: new Date().toISOString(),
        }).eq("id", runId);
        return json({ error: noCredit ? "no_credit" : "apify_error", message: noCredit ? "Credito Apify do mes esgotado." : "Falha ao iniciar o run.", runId }, start.status === 402 ? 402 : 502);
      }
      const started = await start.json();
      const apifyRunId = started?.data?.id;
      const datasetId = started?.data?.defaultDatasetId;
      await db.from("prospect_runs").update({ apify_run_id: apifyRunId, apify_dataset_id: datasetId, status: "running" }).eq("id", runId);
      return json({ runId, apifyRunId, placesEstimate, cost });
    }

    // ===================== STATUS =====================
    if (action === "status") {
      const { runId } = body;
      if (!runId) return json({ error: "runId obrigatorio." }, 400);
      const { data: run } = await db.from("prospect_runs").select("*").eq("id", runId).single();
      if (!run) return json({ error: "run nao encontrado." }, 404);
      if (run.status === "done") return json({ status: "done", run, items: [] }); // ja importado pelo front
      if (!run.apify_run_id) return json({ status: run.status });

      const r = await fetch(`${APIFY}/actor-runs/${run.apify_run_id}?token=${token}`);
      const rj = await r.json();
      const st = rj?.data?.status; // READY|RUNNING|SUCCEEDED|FAILED|ABORTED|TIMED-OUT
      if (st === "READY" || st === "RUNNING") return json({ status: "running" });

      if (st === "SUCCEEDED") {
        // NAO marca 'done' aqui: o frontend importa e seta 'done' (permite reimport idempotente
        // se a tela tiver sido fechada). Aqui so devolvemos os itens crus + atualizamos a contagem.
        const ds = run.apify_dataset_id || rj?.data?.defaultDatasetId;
        const itemsResp = await fetch(`${APIFY}/datasets/${ds}/items?token=${token}&clean=true`);
        const items = await itemsResp.json();
        const arr = Array.isArray(items) ? items : [];
        await db.from("prospect_runs").update({ places_returned: arr.length }).eq("id", runId);
        return json({ status: "succeeded", run, items: arr });
      }

      // FAILED / ABORTED / TIMED-OUT
      const msg = rj?.data?.statusMessage || st;
      const noCredit = /usage|limit|credit|quota/i.test(String(msg));
      await db.from("prospect_runs").update({ status: noCredit ? "no_credit" : "failed", error_message: String(msg).slice(0, 500), finished_at: new Date().toISOString() }).eq("id", runId);
      return json({ status: noCredit ? "no_credit" : "failed", message: String(msg) });
    }

    return json({ error: "action invalida (use start|status)." }, 400);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
