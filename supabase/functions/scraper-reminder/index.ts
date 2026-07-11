// Lembrete quinzenal (dia 6 e dia 20) por e-mail: hora de rodar os scrapers pagos
// (ML/Amazon/Shopee/TikTok) — cai no timing de pagamento/promoção no Brasil.
// Disparado pelo pg_cron (service role). E-mail via Resend (RESEND_API_KEY nos secrets).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const FROM = "Café Saporino <nao-responda@cafesaporino.com.br>";
const TO = ["mitiqtoq@gmail.com"]; // destinatário(s) do lembrete
const PANEL = "https://www.cafesaporino.com.br/admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    // gate: só service role (cron) pode disparar
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (bearer !== service) return json({ error: "forbidden" }, 403);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "RESEND_API_KEY ausente" }, 500);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#2b2b2b">
        <div style="background:#8B2214;padding:20px 24px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:18px">☕ Café Saporino — Inteligência de Preços</h1>
        </div>
        <div style="border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:15px">Olá, Vlademir! É <strong>semana de pagamento</strong> — hora em que as redes soltam promoção e mexem no preço do café.</p>
          <p style="font-size:15px">Bom momento para <strong>atualizar os preços dos concorrentes</strong> no painel:</p>
          <ul style="font-size:14px;line-height:1.7">
            <li><strong>Robôs pagos</strong> (rode se quiser — ~US$ 4 a rodada): Mercado Livre, Amazon, Shopee, TikTok.</li>
            <li><strong>Supermercados de SP</strong> (grátis, pode rodar à vontade): Atacadão, Sam's, Savegnago, Mambo, Muffato, Covabra, Oba, Natural da Terra, Giga, Hortifruti, Casa Santa Luzia.</li>
          </ul>
          <p style="text-align:center;margin:24px 0">
            <a href="${PANEL}" style="background:#8B2214;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:15px">Abrir painel de preços</a>
          </p>
          <p style="font-size:12px;color:#888">Você recebe este lembrete dia 6 e dia 20 de cada mês. Se não quiser mais, é só me avisar.</p>
        </div>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: TO,
        subject: "☕ Hora de atualizar os preços dos concorrentes (semana de pagamento)",
        html,
      }),
    });
    if (!r.ok) return json({ error: "resend_error", detail: (await r.text()).slice(0, 300) }, 502);
    return json({ ok: true, sent_to: TO });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
