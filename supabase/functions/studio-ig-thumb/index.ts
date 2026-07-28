// Studio — proxy de miniatura do Instagram. O CDN do IG bloqueia hotlink direto do nosso site,
// então o servidor busca a imagem (sem bloqueio) e devolve os bytes. GET ?url=<cdn do IG>.
// Só aceita hosts de CDN do Instagram/Facebook (evita SSRF). Deploy: --no-verify-jwt.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const ALLOW = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const u = new URL(req.url).searchParams.get("url");
    if (!u) return new Response("faltou url", { status: 400, headers: cors });
    let host: string;
    try { host = new URL(u).host; } catch { return new Response("url inválida", { status: 400, headers: cors }); }
    if (!ALLOW.test(host)) return new Response("host não permitido", { status: 403, headers: cors });

    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" } });
    if (!r.ok) return new Response("falha ao buscar", { status: 502, headers: cors });
    const ct = r.headers.get("content-type") || "image/jpeg";
    return new Response(r.body, {
      status: 200,
      headers: { ...cors, "Content-Type": ct, "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    return new Response(String(e instanceof Error ? e.message : e), { status: 500, headers: cors });
  }
});
