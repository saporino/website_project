// Limpeza de arquivos órfãos no Storage.
//
// Órfão = objeto que nenhuma linha do banco referencia (public.storage_orphans).
// Existe porque apagar um pedido, cliente ou visita remove as linhas mas não os
// arquivos: ON DELETE CASCADE não alcança o Storage.
//
// Regras desta função, propositalmente conservadoras:
//   - exige ADMINISTRADOR (verificado com o JWT de quem chama, não com service role);
//   - roda em DRY-RUN por padrão: só apaga com dry_run:false explícito;
//   - ignora arquivo recente (min_age_days, padrão 7), porque o upload acontece
//     ANTES da linha que o referencia;
//   - registra toda execução em public.storage_cleanup_log, inclusive a simulação;
//   - apaga no máximo max_delete objetos por chamada (padrão 100).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(url, service);

  try {
    // ---- gate: só administrador ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "apenas administrador pode rodar a limpeza" }, 403);

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run !== false;          // padrão: simulação
    const bucket: string | null = body.bucket ?? null;
    const minAge: number = Number.isFinite(body.min_age_days) ? Number(body.min_age_days) : 7;
    const maxDelete: number = Number.isFinite(body.max_delete) ? Number(body.max_delete) : 100;

    // ---- detecção ----
    const { data: orfaos, error: errOrf } = await db.rpc("storage_orphans", {
      p_bucket: bucket, p_min_age_days: minAge,
    });
    if (errOrf) return json({ error: errOrf.message }, 500);

    const candidatos = (orfaos ?? []) as Array<{ bucket_id: string; name: string; size_bytes: number; age_days: number }>;
    const alvo = candidatos.slice(0, maxDelete);

    // ---- remoção (só fora do dry-run) ----
    let removidos = 0;
    const falhas: string[] = [];
    if (!dryRun) {
      const porBucket = new Map<string, string[]>();
      for (const o of alvo) {
        if (!porBucket.has(o.bucket_id)) porBucket.set(o.bucket_id, []);
        porBucket.get(o.bucket_id)!.push(o.name);
      }
      for (const [b, nomes] of porBucket) {
        const { data, error } = await db.storage.from(b).remove(nomes);
        if (error) falhas.push(`${b}: ${error.message}`);
        else removidos += (data?.length ?? 0);
      }
    }

    // ---- log (sempre, inclusive dry-run) ----
    await db.from("storage_cleanup_log").insert({
      executed_by: user.id,
      bucket_id: bucket,
      dry_run: dryRun,
      min_age_days: minAge,
      candidates: candidatos.length,
      deleted: removidos,
      objects: alvo.map(o => ({ bucket: o.bucket_id, name: o.name, size: o.size_bytes, age_days: o.age_days })),
      error: falhas.length ? falhas.join(" | ") : null,
    });

    return json({
      dry_run: dryRun,
      bucket: bucket ?? "todos",
      min_age_days: minAge,
      candidatos: candidatos.length,
      considerados_nesta_execucao: alvo.length,
      removidos,
      falhas,
      amostra: alvo.slice(0, 20).map(o => `${o.bucket_id}/${o.name}`),
      aviso: dryRun ? "SIMULACAO: nada foi apagado. Envie dry_run:false para remover." : undefined,
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
