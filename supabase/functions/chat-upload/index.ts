// Upload de anexo do chat (foto/áudio/documento) via service role — contorna RLS do storage.
// Gate: usuário autenticado E participante da conversa.
// Salva em chat-media/<conversation_id>/<user_id>/<uuid>-<arquivo> e devolve o CAMINHO.
// O caminho carrega a conversa de propósito: é ele que a policy de storage usa para
// liberar a leitura só a quem participa (public.is_chat_member).
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

    const { file_base64, filename, content_type, conversation_id } = await req.json().catch(() => ({}));
    if (!file_base64 || !filename) return json({ error: "arquivo ausente" }, 400);
    if (!conversation_id) return json({ error: "conversation_id ausente" }, 400);

    const db = createClient(url, service);

    // Só participante da conversa envia anexo para ela.
    const { data: membro } = await db.from("chat_participants")
      .select("user_id").eq("conversation_id", conversation_id).eq("user_id", user.id).maybeSingle();
    if (!membro) return json({ error: "voce nao participa desta conversa" }, 403);

    const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX) return json({ error: "Arquivo muito grande (máx 15 MB)." }, 413);

    const safe = String(filename).replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${conversation_id}/${user.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await db.storage.from("chat-media").upload(path, bytes, {
      contentType: content_type || "application/octet-stream", upsert: false,
    });
    if (error) return json({ error: error.message }, 500);

    // chat-media é bucket PRIVADO desde a Fase D (04/09/2026). Devolvemos o CAMINHO
    // do objeto, não uma URL pública: quem exibe gera uma signed URL de curta duração
    // (src/lib/storageUrl.ts). O campo continua se chamando "url" por compatibilidade
    // com o cliente já publicado, que grava o valor em chat_messages.attachment_url.
    return json({ url: path });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
