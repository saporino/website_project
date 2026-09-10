// Registro de uso de IA — best-effort, sempre.
//
// Regra que não pode ser quebrada: falhar ao gravar o custo NUNCA pode
// derrubar uma geração que funcionou. O cliente não perde a imagem dele
// porque a nossa contabilidade teve um soluço. Por isso tudo aqui está dentro
// de try/catch e a função nunca lança.

// deno-lint-ignore no-explicit-any
type Db = any;

export interface EventoDeUso {
  company_id?: string | null;
  user_id?: string | null;
  operation: string;                 // image_generation | analise | legenda | transcricao
  provider: string;                  // openai | anthropic
  model: string;
  prompt_version?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cached_tokens?: number | null;
  audio_seconds?: number | null;
  image_count?: number | null;
  quality?: string | null;
  width?: number | null;
  height?: number | null;
  cost_usd?: number | null;
  request_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  status?: "ok" | "erro";
  error_text?: string | null;
  duration_ms?: number | null;
}

/**
 * Grava uma linha por CHAMADA de API. Uma peça pode ter várias.
 *
 * `fx_rate` e `cost_brl` ficam nulos de propósito: ainda não há fonte de
 * câmbio no sistema, e gravar uma cotação inventada contaminaria todo cálculo
 * de margem depois. O `cost_usd` é o número conferível contra a fatura.
 */
export async function registrarUsoDeIA(db: Db, e: EventoDeUso): Promise<void> {
  try {
    await db.from("ai_usage_events").insert({
      company_id: e.company_id ?? null,
      user_id: e.user_id ?? null,
      operation: e.operation,
      provider: e.provider,
      model: e.model,
      prompt_version: e.prompt_version ?? null,
      input_tokens: e.input_tokens ?? null,
      output_tokens: e.output_tokens ?? null,
      cached_tokens: e.cached_tokens ?? null,
      audio_seconds: e.audio_seconds ?? null,
      image_count: e.image_count ?? null,
      quality: e.quality ?? null,
      width: e.width ?? null,
      height: e.height ?? null,
      cost_usd: e.cost_usd ?? null,
      request_id: e.request_id ?? null,
      subject_type: e.subject_type ?? null,
      subject_id: e.subject_id ?? null,
      status: e.status ?? "ok",
      // Mensagem cortada: log de erro não é lugar para carregar corpo de
      // resposta inteiro, e provedor às vezes ecoa o payload enviado.
      error_text: e.error_text ? String(e.error_text).slice(0, 500) : null,
      duration_ms: e.duration_ms ?? null,
    });
  } catch (err) {
    // Só registra no log da função. Nunca propaga.
    console.error("falha ao gravar ai_usage_events:", String(err).slice(0, 200));
  }
}
