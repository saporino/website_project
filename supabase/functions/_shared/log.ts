// Fase 0 / P0 — observabilidade mínima, sem serviço externo (grava em edge_logs).
// FAIL-OPEN: se a tabela ainda não existir, só usa console — nunca quebra a função.
//
// Uso (a ligar no passo de deploy):
//   const rid = newRequestId(req);
//   ... try { ... } catch (e) { await logEdge(supabase, { function_name:'x', request_id:rid, level:'error', error_text:String(e) }); }

export function newRequestId(req?: Request): string {
  return req?.headers.get('x-request-id') || crypto.randomUUID();
}

export interface EdgeLog {
  function_name: string;
  request_id?: string;
  level?: 'info' | 'warn' | 'error';
  status?: number;
  duration_ms?: number;
  error_text?: string;
  // deno-lint-ignore no-explicit-any
  meta?: Record<string, any>;
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (t: string) => { insert: (row: any) => Promise<{ error: any }> } };

export async function logEdge(supabase: SupabaseLike, entry: EdgeLog): Promise<void> {
  // console sempre (aparece no painel Supabase mesmo sem a tabela)
  const line = `[${entry.level || 'info'}] ${entry.function_name} rid=${entry.request_id || '-'} ${entry.error_text || ''}`;
  if (entry.level === 'error') console.error(line); else console.log(line);
  try {
    const { error } = await supabase.from('edge_logs').insert({
      function_name: entry.function_name,
      request_id: entry.request_id ?? null,
      level: entry.level ?? 'info',
      status: entry.status ?? null,
      duration_ms: entry.duration_ms ?? null,
      error_text: entry.error_text ?? null,
      meta: entry.meta ?? null,
    });
    if (error) console.warn('logEdge fail-open (insert error):', error.message);
  } catch (e) {
    console.warn('logEdge fail-open (exception):', (e as Error).message);
  }
}
