// Fase 0 / P0 — rate limiting leve, sem serviço externo (usa Postgres via RPC).
// FAIL-OPEN: se a RPC/tabela ainda não existir (antes da migration ser aplicada),
// NÃO bloqueia a chamada — apenas registra no console. Assim, ligar o helper nas
// funções nunca as quebra antes do deploy da migration edge_rate_limits.
//
// Uso (a ligar no passo de deploy):
//   const ok = await checkRateLimit(supabase, `create-payment:${ip}`, 30, 60);
//   if (!ok) return json({ error: 'Too many requests' }, 429);

// deno-lint-ignore no-explicit-any
type SupabaseLike = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export async function checkRateLimit(
  supabase: SupabaseLike,
  key: string,
  limit: number,
  windowSeconds: number,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  // failClosed=true para endpoints financeiros (create-payment): se o mecanismo
  // de rate limit estiver indisponível, NÃO liberar (retorna false). A migration
  // edge_rate_limits precisa estar aplicada antes do deploy dessas funções.
  const onError = (msg: string): boolean => {
    if (opts?.failClosed) {
      console.error('rateLimit FAIL-CLOSED (rejecting):', msg);
      return false;
    }
    console.warn('rateLimit fail-open (allowing):', msg);
    return true;
  };
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return onError(error.message);
    return data === true;
  } catch (e) {
    return onError((e as Error).message);
  }
}

// Extrai um identificador de cliente para a chave (IP do proxy do Supabase).
export function clientKey(req: Request, fn: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  return `${fn}:${ip}`;
}
