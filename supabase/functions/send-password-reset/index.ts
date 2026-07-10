// Recuperação de senha via Resend (independe de SMTP no painel do Supabase).
// Gera o link de recovery pelo admin API e envia um e-mail bonito pelo Resend.
// Público (sem JWT): qualquer visitante pode pedir "esqueci a senha".
// Se o e-mail não existe, responde ok SEM enviar (não vaza quem tem conta).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const FROM = "Café Saporino <nao-responda@cafesaporino.com.br>";
const DEFAULT_REDIRECT = "https://www.cafesaporino.com.br/reset-password";

function emailHtml(link: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8f7f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #e4dbd7;border-radius:16px;padding:32px 28px">
      <div style="display:inline-block;background:#8B2214;color:#fff;font-weight:700;letter-spacing:.5px;padding:8px 16px;border-radius:999px;font-size:15px">SAPORINO</div>
      <h1 style="color:#2a211f;font-size:22px;margin:22px 0 10px">Redefinir sua senha</h1>
      <p style="color:#6f625e;font-size:15px;line-height:1.6;margin:0 0 22px">Recebemos um pedido para redefinir a senha da sua conta na Café Saporino. Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.</p>
      <a href="${link}" style="display:inline-block;background:#8B2214;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">Criar nova senha</a>
      <p style="color:#9a8f8b;font-size:12.5px;line-height:1.6;margin:24px 0 0">Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
    </div>
    <p style="color:#a99f9b;font-size:11px;text-align:center;margin:16px 0 0">Café Saporino Ltda · enviado por nao-responda@cafesaporino.com.br</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const { email, redirectTo } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") return json({ error: "email ausente" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY ausente" }, 500);

    // só aceita redirect do próprio domínio (ou localhost em dev)
    let redirect = DEFAULT_REDIRECT;
    if (typeof redirectTo === "string" &&
      (/^https?:\/\/([a-z0-9-]+\.)?cafesaporino\.com\.br\//i.test(redirectTo) || /^http:\/\/localhost/.test(redirectTo))) {
      redirect = redirectTo;
    }

    const db = createClient(url, service);
    const { data, error } = await db.auth.admin.generateLink({
      type: "recovery", email, options: { redirectTo: redirect },
    });
    // e-mail inexistente / erro: responde ok sem enviar (não revela se tem conta)
    if (error || !data?.properties?.action_link) return json({ ok: true });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [email],
        subject: "Redefinir sua senha — Café Saporino",
        html: emailHtml(data.properties.action_link),
      }),
    });
    if (!r.ok) return json({ error: "falha no envio", detail: (await r.text()).slice(0, 200) }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
