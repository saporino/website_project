// Credenciais do Mercado Pago por CONTA (05/09/2026).
//
// O ecossistema tem mais de uma empresa e cada uma tem a própria conta no Mercado
// Pago. Antes existia um único par de secrets global, o que impedia saber de quem
// era o dinheiro. A auditoria de 05/09/2026 mostrou que o token global pertence à
// conta PJ da Café Saporino (CNPJ terminado em 94), não a uma conta pessoal e não
// à COFICO (CNPJ terminado em 36).
//
// Nomes de secret usados:
//   COFICO    MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN / _WEBHOOK_SECRET / _PUBLIC_KEY
//             MERCADO_PAGO_COFICO_TEST_*            (opcional, ambiente de teste)
//   Saporino  MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN / _WEBHOOK_SECRET / _PUBLIC_KEY
//
// Compatibilidade: enquanto os secrets nomeados da Saporino não existirem, o par
// legado MERCADO_PAGO_ACCESS_TOKEN / MERCADO_PAGO_WEBHOOK_SECRET é aceito COMO
// credencial da Saporino. Isso é transitório e declarado — o campo `source` diz
// exatamente de qual secret a credencial veio, e o log registra isso. Não é
// fallback silencioso: some assim que os secrets nomeados forem criados.

export type MpAccount = "cofico" | "saporino";

export interface MpCredential {
  account: MpAccount;
  token: string;
  source: string;      // nome do secret de onde veio, para log e auditoria
  environment: "producao" | "teste" | "indeterminado";
}

const env = (n: string) => Deno.env.get(n) ?? undefined;

const ambienteDe = (t: string): MpCredential["environment"] =>
  t.startsWith("TEST-") ? "teste" : t.startsWith("APP_USR-") ? "producao" : "indeterminado";

/** Ordem de nomes de secret para o access token de cada conta. */
const TOKEN_NAMES: Record<MpAccount, string[]> = {
  cofico: ["MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN", "MERCADO_PAGO_COFICO_TEST_ACCESS_TOKEN"],
  saporino: ["MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN"],
};

/** Ordem de nomes de secret para o segredo de webhook de cada conta. */
const WEBHOOK_NAMES: Record<MpAccount, string[]> = {
  cofico: ["MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_COFICO_TEST_WEBHOOK_SECRET"],
  saporino: ["MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_WEBHOOK_SECRET"],
};

/** Access token de uma conta, ou null se aquela conta não estiver configurada. */
export function mpAccessToken(account: MpAccount): MpCredential | null {
  for (const name of TOKEN_NAMES[account]) {
    const token = env(name);
    if (token) return { account, token, source: name, environment: ambienteDe(token) };
  }
  return null;
}

/** Todos os segredos de webhook configurados, para verificar a assinatura de qualquer conta. */
export function mpWebhookSecrets(): Array<{ account: MpAccount; secret: string; source: string }> {
  const out: Array<{ account: MpAccount; secret: string; source: string }> = [];
  for (const account of ["cofico", "saporino"] as MpAccount[]) {
    for (const name of WEBHOOK_NAMES[account]) {
      const secret = env(name);
      if (secret) { out.push({ account, secret, source: name }); break; }
    }
  }
  return out;
}

/**
 * Conta responsável por uma empresa do ecossistema.
 * A COFICO é a empresa operadora (is_operator). Qualquer outra usa a conta da Saporino
 * até ter conta própria. Recebe o prefixo de pedido da empresa, que já existe em companies.
 */
export function accountForCompanyPrefix(prefix?: string | null): MpAccount {
  return (prefix ?? "").toUpperCase() === "CO" ? "cofico" : "saporino";
}

/** Resumo sem segredo, para log e diagnóstico. */
export function mpConfigSummary() {
  return {
    cofico: {
      token: mpAccessToken("cofico")?.source ?? null,
      webhook: mpWebhookSecrets().find(w => w.account === "cofico")?.source ?? null,
    },
    saporino: {
      token: mpAccessToken("saporino")?.source ?? null,
      webhook: mpWebhookSecrets().find(w => w.account === "saporino")?.source ?? null,
    },
  };
}
