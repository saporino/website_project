// Camada de dados do chat interno (admin<->rep, rep<->rep, grupos).
// Tempo real via Supabase Realtime. Anexos via Edge Function chat-upload (service role).
import { supabase } from './supabase';

export interface Contact { user_id: string; full_name: string; is_admin: boolean; is_online: boolean; }
export interface Conversation {
  id: string; type: 'direct' | 'group'; name: string | null;
  last_message_at: string; last_message_preview: string | null;
  unread: number; other_user_id: string | null;
}
export interface ChatMessage {
  id: string; conversation_id: string; sender_id: string; body: string | null;
  attachment_url: string | null; attachment_type: 'image' | 'audio' | 'file' | null;
  attachment_name: string | null; attachment_size: number | null; created_at: string;
}

export async function getContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.rpc('chat_contacts');
  if (error) throw error;
  return (data || []) as Contact[];
}

export async function listConversations(companyId: string): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('chat_my_conversations', { p_company: companyId });
  if (error) throw error;
  return (data || []) as Conversation[];
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages').select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data || []) as ChatMessage[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string, attachment?: {
  url: string; type: 'image' | 'audio' | 'file'; name?: string; size?: number;
}): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    conversation_id: conversationId, sender_id: senderId,
    body: body || null,
    attachment_url: attachment?.url ?? null,
    attachment_type: attachment?.type ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_size: attachment?.size ?? null,
  });
  if (error) throw error;
}

export async function startDirect(otherUserId: string, companyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('chat_start_direct', { other: otherUserId, p_company: companyId });
  if (error) throw error;
  return data as string;
}

export async function createGroup(name: string, memberIds: string[], companyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('chat_create_group', { gname: name, members: memberIds, p_company: companyId });
  if (error) throw error;
  return data as string;
}

export async function markRead(conversationId: string): Promise<void> {
  await supabase.rpc('chat_mark_read', { conv: conversationId });
}

// upload de anexo via Edge Function (contorna RLS do storage). Retorna URL pública.
export async function uploadAttachment(file: Blob, filename: string): Promise<string> {
  const b64: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej; r.readAsDataURL(file);
  });
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ file_base64: b64, filename, content_type: file.type || 'application/octet-stream' }),
  });
  const j = await resp.json();
  if (!resp.ok || !j.url) throw new Error(j.error || 'falha no upload');
  return j.url as string;
}

// tempo real: novas mensagens de UMA conversa
export function subscribeToMessages(conversationId: string, onInsert: (m: ChatMessage) => void) {
  const ch = supabase.channel(`chat:${conversationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as ChatMessage))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// tempo real: qualquer mensagem nova (pra atualizar a lista de conversas / badges)
export function subscribeToAllMessages(onAny: () => void) {
  const ch = supabase.channel('chat:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => onAny())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
