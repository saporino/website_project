// Avisos internos por Telegram.
//
// Canal interno: só a equipe. O cliente é avisado por e-mail, e nunca precisa
// ter Telegram.
//
// O Telegram não deixa um bot escrever para alguém que nunca falou com ele.
// Por isso o fluxo é: a pessoa dá START no bot, o Telegram passa a listar essa
// conversa em getUpdates, e aí guardamos o `chat_id` dela.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const API = (metodo: string) =>
  `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/${metodo}`;

export function temToken(): boolean {
  return !!Deno.env.get('TELEGRAM_BOT_TOKEN');
}

/** Conversas que já falaram com o bot. É daqui que sai o chat_id. */
export async function conversasConhecidas(): Promise<Array<{ chat_id: string; label: string }>> {
  const r = await fetch(API('getUpdates'));
  if (!r.ok) return [];
  const j = await r.json();
  const vistos = new Map<string, string>();
  for (const u of j?.result ?? []) {
    const chat = u?.message?.chat ?? u?.my_chat_member?.chat;
    if (!chat?.id) continue;
    const nome = [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
      chat.title || chat.username || 'sem nome';
    vistos.set(String(chat.id), nome);
  }
  return [...vistos].map(([chat_id, label]) => ({ chat_id, label }));
}

export async function enviarTelegram(chatId: string, texto: string): Promise<boolean> {
  try {
    const r = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) console.error('telegram recusou:', (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('falha ao falar com o telegram:', e);
    return false;
  }
}

/**
 * Avisa a equipe. Nunca lança erro: aviso que falha não pode derrubar o
 * processamento de um pagamento já confirmado.
 */
export async function avisarEquipe(
  supabase: SupabaseClient,
  companyId: string | null,
  texto: string,
): Promise<number> {
  if (!temToken()) return 0;
  try {
    // Recebe quem é daquela empresa e quem não tem empresa marcada (recebe tudo).
    let q = supabase.from('telegram_recipients').select('chat_id, company_id').eq('is_active', true);
    const { data } = await q;
    const alvos = (data ?? []).filter((d) => !d.company_id || d.company_id === companyId);

    let enviados = 0;
    for (const alvo of alvos) {
      if (await enviarTelegram(alvo.chat_id, texto)) enviados++;
    }
    return enviados;
  } catch (e) {
    console.error('falha ao avisar equipe:', e);
    return 0;
  }
}
