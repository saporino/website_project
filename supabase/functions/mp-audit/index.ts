// Auditoria de credenciais do Mercado Pago — TEMPORÁRIA, do ciclo de migração COFICO.
//
// Existe para responder UMA pergunta sem que ninguém precise ver o segredo:
// a credencial configurada pertence à conta pessoal ou à conta PJ da COFICO?
//
// Nunca devolve o valor do token. Devolve só identificadores não sensíveis
// (id da conta, apelido, site, tipo de pessoa, CNPJ mascarado) e o PREFIXO do
// token, que já diz se é de teste (TEST-) ou de produção (APP_USR-).
//
// Exige administrador. Deve ser REMOVIDA ao fim da migração.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const mascarar = (v?: string | null) => {
  if (!v) return null;
  const s = String(v);
  return s.length <= 4 ? "***" : `${s.slice(0, 2)}***${s.slice(-2)}`;
};

async function inspecionar(nome: string, token: string | undefined) {
  if (!token) return { secret: nome, configurado: false };
  const ambiente = token.startsWith("TEST-") ? "teste"
    : token.startsWith("APP_USR-") ? "producao" : "indeterminado";
  const base = { secret: nome, configurado: true, ambiente, prefixo: token.split("-")[0], tamanho: token.length };
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ...base, valido: false, http: r.status, detalhe: (await r.text()).slice(0, 160) };
    const u = await r.json();
    return {
      ...base,
      valido: true,
      conta_id: u.id,
      apelido: u.nickname,
      site: u.site_id,
      tipo_pessoa: u.identification?.type ?? null,          // CPF (pessoal) ou CNPJ (PJ)
      documento_mascarado: mascarar(u.identification?.number),
      email_mascarado: u.email ? `${mascarar(u.email.split("@")[0])}@${u.email.split("@")[1]}` : null,
      nome_mascarado: mascarar([u.first_name, u.last_name].filter(Boolean).join(" ")),
      tipo_usuario: u.user_type ?? null,
      tags: Array.isArray(u.tags) ? u.tags : null,
      status_conta: u.status?.site_status ?? null,
    };
  } catch (e) {
    return { ...base, valido: false, erro: String(e instanceof Error ? e.message : e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "apenas administrador" }, 403);

    const body = await req.json().catch(() => ({}));

    // Sondagem SOMENTE LEITURA da conta Saporino, para tentar provar a origem do
    // segredo de webhook. Usa exclusivamente MERCADO_PAGO_ACCESS_TOKEN; nenhuma
    // credencial da COFICO é tocada aqui. Nada é alterado no Mercado Pago.
    if (body?.action === "saporino_probe") {
      const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
      if (!token) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN nao configurado" }, 400);
      const clientId = String(body.client_id ?? "");

      const ler = async (url: string) => {
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const txt = await r.text();
          return { url, http: r.status, corpo: txt.slice(0, 900) };
        } catch (e) {
          return { url, http: 0, corpo: String(e instanceof Error ? e.message : e) };
        }
      };

      const alvos = [
        "https://api.mercadopago.com/users/me",
        "https://api.mercadopago.com/v1/webhooks",
        "https://api.mercadopago.com/webhooks",
        "https://api.mercadopago.com/notifications/settings",
      ];
      if (clientId) {
        alvos.push(`https://api.mercadopago.com/applications/${clientId}`);
        alvos.push(`https://api.mercadopago.com/applications/${clientId}/webhooks`);
      }

      const respostas = [];
      for (const a of alvos) respostas.push(await ler(a));
      return json({ conta: "saporino", respostas });
    }

    // Autoteste do webhook: assina uma notificação COM O SEGREDO REAL e a envia ao
    // endpoint, para provar que assinatura válida é aceita — sem mover dinheiro.
    // Usa type "test" de propósito: o webhook autentica e devolve 200 dizendo que
    // não é notificação de pagamento, sem chamar a API do Mercado Pago.
    if (body?.action === "webhook_selftest") {
      const contas: Record<string, string[]> = {
        cofico: ["MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_COFICO_TEST_WEBHOOK_SECRET"],
        saporino: ["MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET", "MERCADO_PAGO_WEBHOOK_SECRET"],
      };
      const alvo = String(body.account ?? "cofico");
      const nomeSecret = (contas[alvo] ?? []).find(n => Deno.env.get(n));
      if (!nomeSecret) return json({ error: `sem segredo de webhook para a conta ${alvo}` }, 400);
      const secret = Deno.env.get(nomeSecret)!;

      const dataId = String(body.data_id ?? "999999999");
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = crypto.randomUUID();
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;  // grafia COM ponto e virgula (documentacao do MP)
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
      const v1 = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      const payload = JSON.stringify({
        id: 1, live_mode: false, type: body.type ?? "test", date_created: new Date().toISOString(),
        user_id: "0", api_version: "v1", action: "test.created", data: { id: dataId },
      });

      const alvoUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`;
      const chamar = async (headers: Record<string, string>) => {
        const r = await fetch(alvoUrl, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: payload });
        return { http: r.status, corpo: (await r.text()).slice(0, 140) };
      };

      return json({
        conta_testada: alvo,
        secret_usado: nomeSecret,          // nome, nunca valor
        assinatura_valida: await chamar({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId }),
        assinatura_invalida: await chamar({ "x-signature": `ts=${ts},v1=${"0".repeat(64)}`, "x-request-id": requestId }),
        sem_assinatura: await chamar({}),
        repeticao_mesma_assinatura: await chamar({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId }),
      });
    }

    const nomes = [
      "MERCADO_PAGO_ACCESS_TOKEN",
      "MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN",
      "MERCADO_PAGO_COFICO_TEST_ACCESS_TOKEN",
    ];
    const tokens = await Promise.all(nomes.map(n => inspecionar(n, Deno.env.get(n))));

    // Segredos de webhook: só dizemos se existem e o tamanho. Nunca o valor.
    const webhooks = ["MERCADO_PAGO_WEBHOOK_SECRET", "MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET",
      "MERCADO_PAGO_COFICO_TEST_WEBHOOK_SECRET"].map(n => {
        const v = Deno.env.get(n);
        return { secret: n, configurado: !!v, tamanho: v ? v.length : 0 };
      });

    // Compara os segredos de webhook por HASH, para dizer se sao o MESMO valor sem revelar nenhum.
    const sha = async (v: string) => {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('').slice(0, 12);
    };
    for (const w of webhooks) {
      const v = Deno.env.get(w.secret);
      (w as Record<string, unknown>).impressao = v ? await sha(v) : null;
    }

    const chavesPublicas = ["MERCADO_PAGO_COFICO_PROD_PUBLIC_KEY", "MERCADO_PAGO_COFICO_TEST_PUBLIC_KEY"]
      .map(n => {
        const v = Deno.env.get(n);
        return { secret: n, configurado: !!v, ambiente: v?.startsWith("TEST-") ? "teste" : v ? "producao" : null };
      });

    return json({ tokens, webhooks, chaves_publicas: chavesPublicas });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
