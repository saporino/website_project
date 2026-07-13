// Upload de anexo do chat (foto/áudio/documento) via service role — contorna RLS do storage.
// Gate: qualquer usuário autenticado. Salva em chat-media/<uid>/<uuid>-<arquivo> e devolve URL pública.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX = 15 * 1024 * 1024; // 15 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // exige usuário autenticado
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);

    const { file_base64, filename, content_type } = await req.json().catch(() => ({}));
    if (!file_base64 || !filename) return json({ error: "arquivo ausente" }, 400);

    const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX) return json({ error: "Arquivo muito grande (máx 15 MB)." }, 413);

    const safe = String(filename).replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${user.id}/${crypto.randomUUID()}-${safe}`;

    const db = createClient(url, service);
    const { error } = await db.storage.from("chat-media").upload(path, bytes, {
      contentType: content_type || "application/octet-stream", upsert: false,
    });
    if (error) return json({ error: error.message }, 500);

    const { data: pub } = db.storage.from("chat-media").getPublicUrl(path);
    return json({ url: pub.publicUrl });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
