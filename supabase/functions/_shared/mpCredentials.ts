// Credenciais do Mercado Pago por EMPRESA FATURADORA (06/09/2026).
//
// Quem recebe o dinheiro não é decidido pela marca do produto, e sim pela empresa
// que vende e fatura a operação. O mesmo Café Saporino vendido em
// cafesaporino.com.br fatura pela Saporino; vendido na Casa Cofico, fatura pela
// COFICO. Produto igual, recebedor diferente.
//
// O elo empresa → credencial é `companies.payment_account`, um nome de conjunto
// (ex.: "saporino", "cofico"). O valor do segredo nunca fica no banco.
//
// Nomes de secret usados:
//   cofico    MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN / _WEBHOOK_SECRET / _PUBLIC_KEY
//             MERCADO_PAGO_COFICO_TEST_*            (opcional)
//   saporino  MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN / _WEBHOOK_SECRET / _PUBLIC_KEY
//
// Compatibilidade declarada: enquanto os secrets nomeados da Saporino não
// existirem, o par legado MERCADO_PAGO_ACCESS_TOKEN / MERCADO_PAGO_WEBHOOK_SECRET
// é aceito COMO credencial da Saporino. O campo `source` diz de qual secret veio
// e vai para o log. Some assim que os nomeados forem criados.
//
// NÃO existe conta padrão. Empresa sem `payment_account`, ou conjunto sem
// credencial configurada, faz o pagamento ser recusado. Nunca cai em outra conta.

export interface MpCredential {
  accountKey: string;
  token: string;
  source: string;                                    // nome do secret, para log
  environment: "producao" | "teste" | "indeterminado";
}

const env = (n: string) => Deno.env.get(n) ?? undefined;

const ambienteDe = (t: string): MpCredential["environment"] =>
  t.startsWith("TEST-") ? "teste" : t.startsWith("APP_USR-") ? "producao" : "indeterminado";

/** Nomes de secret do access token, por conjunto de credenciais. */
const TOKEN_NAMES: Record<string, string[]> = {
  cofico: ["MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN", "MERCADO_PAGO_COFICO_TEST_ACCESS_TOKEN"],
  saporino: ["MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN"],
};

/** Nomes de secret do segredo de webhook, por conjunto de credenciais. */
const WEBHOOK_NAMES: Record<string, string[]> = {
  cofico: ["MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_COFICO_TEST_WEBHOOK_SECRET"],
  saporino: ["MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_WEBHOOK_SECRET"],
};

export const contasConhecidas = () => Object.keys(TOKEN_NAMES);

/** Access token de um conjunto de credenciais, ou null se não estiver configurado. */
export function mpAccessToken(accountKey: string | null | undefined): MpCredential | null {
  if (!accountKey) return null;
  for (const name of TOKEN_NAMES[accountKey] ?? []) {
    const token = env(name);
    if (token) return { accountKey, token, source: name, environment: ambienteDe(token) };
  }
  return null;
}

/** Todos os segredos de webhook configurados, para verificar a assinatura de qualquer conta. */
export function mpWebhookSecrets(): Array<{ accountKey: string; secret: string; source: string }> {
  const out: Array<{ accountKey: string; secret: string; source: string }> = [];
  for (const accountKey of Object.keys(WEBHOOK_NAMES)) {
    for (const name of WEBHOOK_NAMES[accountKey]) {
      const secret = env(name);
      if (secret) { out.push({ accountKey, secret, source: name }); break; }
    }
  }
  return out;
}

/**
 * Empresa faturadora a partir do domínio de onde veio a requisição.
 * Serve só para DECIDIR NA CRIAÇÃO do pedido. Depois de criado, vale o que está
 * gravado em `orders.seller_company_id` — nenhum passo posterior confia no domínio.
 * Devolve o prefixo da empresa (`companies.order_prefix`), não a conta de pagamento.
 */
export function empresaPorDominio(origin: string | null | undefined): string | null {
  if (!origin) return null;
  let host = String(origin).toLowerCase();
  try { host = new URL(host.includes("://") ? host : `https://${host}`).hostname; } catch { /* usa como veio */ }
  host = host.replace(/^www\./, "");

  if (host === "coficobrasil.com.br") return "CO";
  if (host === "cafesaporino.com.br") return "CS";
  // Ambiente de desenvolvimento: assume a loja da Saporino, que é a única que
  // vende hoje. É uma decisão explícita, não um padrão escondido.
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app")) return "CS";
  return null;
}

/** Resumo sem segredo, para log e diagnóstico. */
export function mpConfigSummary() {
  const resumo: Record<string, { token: string | null; webhook: string | null }> = {};
  for (const conta of contasConhecidas()) {
    resumo[conta] = {
      token: mpAccessToken(conta)?.source ?? null,
      webhook: mpWebhookSecrets().find(w => w.accountKey === conta)?.source ?? null,
    };
  }
  return resumo;
}
