// Send Email Hook — todo e-mail de autenticação passa por aqui.
//
// Por que existe: o Supabase tem UM remetente por projeto, e nós temos duas lojas
// no mesmo projeto. Sem isto, quem se cadastra na COFICO recebe um e-mail assinado
// "Café Saporino" — o que parece golpe e derruba a confirmação de cadastro.
//
// O que faz: recebe o pedido de envio, descobre de qual loja a pessoa veio, monta
// o e-mail com a marca certa e envia pelo Resend. O Supabase deixa de enviar por
// SMTP quando este hook está ligado.
//
// Precisa ser deployado com --no-verify-jwt: quem chama é o serviço de
// autenticação, que assina com o segredo do hook, não com um JWT de usuário.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { marcaPorUrl, identidade, montarEmail } from "../_shared/brandEmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

/** Erro no formato que o Supabase mostra a quem estava se cadastrando. */
const erro = (msg: string, s = 500) =>
  json({ error: { http_code: s, message: msg } }, s);

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** Comparação em tempo constante: evita descobrir a assinatura por tentativa. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Confere a assinatura no padrão Standard Webhooks, que é o que o Supabase usa.
 * Conteúdo assinado: "<id>.<timestamp>.<corpo>". O cabeçalho pode trazer várias
 * assinaturas separadas por espaço; basta uma bater.
 */
async function assinaturaConfere(req: Request, corpo: string, segredoBruto: string): Promise<boolean> {
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const assinaturas = req.headers.get("webhook-signature");
  if (!id || !ts || !assinaturas) return false;

  // Rejeita mensagem velha: limita reenvio de um pedido interceptado.
  const idade = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(idade) || idade > 300) return false;

  // O segredo vem como "v1,whsec_BASE64"; o que assina é o BASE64 decodificado.
  const b64 = segredoBruto.replace(/^v1,/, "").replace(/^whsec_/, "");
  const chave = await crypto.subtle.importKey(
    "raw", base64ParaBytes(b64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const esperado = bytesParaBase64(
    await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${id}.${ts}.${corpo}`)),
  );

  return assinaturas.split(" ").some((a) => iguais(a.replace(/^v1,/, ""), esperado));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("metodo nao suportado", 405);

  const segredo = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!segredo) return erro("hook sem segredo configurado");
  if (!resendKey) return erro("RESEND_API_KEY ausente");

  const corpo = await req.text();
  if (!(await assinaturaConfere(req, corpo, segredo))) {
    // Sem assinatura válida não é o serviço de autenticação chamando.
    return erro("assinatura invalida", 401);
  }

  try {
    const payload = JSON.parse(corpo);
    const destino: string = payload?.user?.email;
    const d = payload?.email_data ?? {};
    const tipo: string = String(d.email_action_type ?? "");
    const tokenHash: string = String(d.token_hash ?? "");
    const token: string = String(d.token ?? "");
    const redirect: string = String(d.redirect_to ?? "");
    const siteUrl: string = String(d.site_url ?? "");
    if (!destino) return erro("payload sem destinatario", 400);

    // Marca: primeiro o endereço de retorno (de onde a pessoa veio); se vier vazio,
    // o que ficou gravado no cadastro. Sem nenhum dos dois, cai na Saporino.
    const marcaGravada = payload?.user?.user_metadata?.brand;
    const marca = redirect
      ? marcaPorUrl(redirect)
      : (marcaGravada === "CO" ? "CO" : "CS");
    const id = identidade(marca);

    // O link que o botão abre. É o mesmo que o Supabase montaria sozinho.
    const base = Deno.env.get("SUPABASE_URL") ?? siteUrl;
    const link = `${base}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}` +
      `&type=${encodeURIComponent(tipo)}` +
      (redirect ? `&redirect_to=${encodeURIComponent(redirect)}` : "");

    const montado = montarEmail(tipo, id, link, token);
    if (!montado) return erro(`tipo de e-mail nao previsto: ${tipo}`, 400);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: id.remetente, to: [destino],
        subject: montado.assunto, html: montado.html,
      }),
    });

    if (!r.ok) {
      const detalhe = (await r.text()).slice(0, 300);
      console.error("resend recusou:", r.status, detalhe);
      // Devolve erro de propósito: e-mail perdido em silêncio deixa a pessoa
      // esperando uma confirmação que nunca chega.
      return erro("nao foi possivel enviar o e-mail agora", 502);
    }

    return json({});
  } catch (e) {
    console.error("falha no hook:", e);
    return erro(String(e instanceof Error ? e.message : e));
  }
});
