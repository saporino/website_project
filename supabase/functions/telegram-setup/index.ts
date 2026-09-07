// Descobre e cadastra quem recebe aviso no Telegram.
//
// Existe porque o `chat_id` não é uma informação que a pessoa saiba dizer: ele é
// gerado pelo Telegram e só aparece depois que ela dá START no bot. Esta função
// lê essa lista e grava.
//
// Só administrador. A chave do bot fica nos secrets e nunca sai daqui.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { conversasConhecidas, enviarTelegram, temToken, quemEhOBot } from '../_shared/telegram.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "apenas administrador" }, 403);

    if (!temToken()) {
      return json({ error: "TELEGRAM_BOT_TOKEN nao configurado nos secrets.", code: "SEM_TOKEN" }, 503);
    }

    const db = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao ?? "listar");

    if (acao === "listar") {
      const bot = await quemEhOBot();
      const conversas = await conversasConhecidas();
      const { data: jaCadastrados } = await db.from("telegram_recipients").select("chat_id, label, is_active");
      return json({
        bot,
        conversas,
        ja_cadastrados: jaCadastrados ?? [],
        aviso: conversas.length === 0
          ? "Nenhuma conversa encontrada. Abra o bot no Telegram e toque em START — sem isso o Telegram nao mostra a conversa."
          : null,
      });
    }

    if (acao === "cadastrar") {
      const chatId = String(body.chat_id ?? "");
      if (!chatId) return json({ error: "chat_id obrigatorio" }, 400);

      const { error } = await db.from("telegram_recipients").upsert({
        chat_id: chatId,
        label: String(body.label ?? "").slice(0, 80) || null,
        company_id: body.company_id ?? null,
        is_active: true,
      }, { onConflict: "chat_id" });
      if (error) return json({ error: error.message }, 500);

      // Confirma na prática: se a mensagem não chegar, o cadastro não serve.
      const ok = await enviarTelegram(chatId,
        "✅ <b>Pronto.</b>\nVocê vai receber aqui os avisos de pedido pago.");
      return json({ ok: true, mensagem_de_teste: ok });
    }

    if (acao === "testar") {
      const { data: alvos } = await db.from("telegram_recipients").select("chat_id").eq("is_active", true);
      let enviados = 0;
      for (const a of alvos ?? []) {
        if (await enviarTelegram(a.chat_id, "🔔 Teste de aviso — está funcionando.")) enviados++;
      }
      return json({ enviados, destinatarios: (alvos ?? []).length });
    }

    return json({ error: `acao desconhecida: ${acao}` }, 400);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
