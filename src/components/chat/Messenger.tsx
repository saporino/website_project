import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Send, Paperclip, Mic, Square, ArrowLeft, Users, X, Check, FileText, Loader2,
} from 'lucide-react';
import {
  Contact, Conversation, ChatMessage, getContacts, listConversations, getMessages, sendMessage,
  startDirect, createGroup, markRead, uploadAttachment, subscribeToMessages, subscribeToAllMessages,
} from '../../lib/chat';
import { useCompany } from '../../contexts/CompanyContext';

const BRAND = '#8B2214';
const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const timeShort = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const same = d.toDateString() === t.toDateString();
  const yest = new Date(t.getTime() - 86400000).toDateString() === d.toDateString();
  return same ? 'Hoje' : yest ? 'Ontem' : d.toLocaleDateString('pt-BR');
};
const fileKind = (mime: string): 'image' | 'audio' | 'file' =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'file';

export default function Messenger({ currentUserId, initialConversationId }: { currentUserId: string; initialConversationId?: string | null }) {
  const { activeCompanyId } = useCompany();
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameOf = useCallback((uid: string | null) => uid ? (contacts[uid]?.full_name || 'Usuário') : 'Usuário', [contacts]);
  const convTitle = useCallback((c: Conversation) => c.type === 'group' ? (c.name || 'Grupo') : nameOf(c.other_user_id), [nameOf]);

  const loadConvs = useCallback(async () => {
    if (!activeCompanyId) return;
    try { setConvs(await listConversations(activeCompanyId)); } catch { /* ignore */ }
  }, [activeCompanyId]);

  // Chat é por empresa: ao trocar de empresa, fecha a conversa aberta e recarrega a lista.
  useEffect(() => {
    setActiveId(null); setMobileThread(false); setMessages([]); setConvs([]);
    loadConvs();
  }, [activeCompanyId, loadConvs]);

  // Abrir direto numa conversa específica (ex.: alerta de ruptura → "Abrir conversa")
  useEffect(() => {
    if (initialConversationId) { setActiveId(initialConversationId); setMobileThread(true); loadConvs(); }
  }, [initialConversationId, loadConvs]);

  useEffect(() => {
    (async () => {
      try {
        const cs = await getContacts();
        setContacts(Object.fromEntries(cs.map(c => [c.user_id, c])));
      } catch { /* ignore */ }
      loadConvs();
    })();
  }, [loadConvs]);

  // tempo real: qualquer mensagem nova -> atualiza lista/badges
  useEffect(() => subscribeToAllMessages(loadConvs), [loadConvs]);

  // abrir conversa: carrega mensagens, marca lido, assina tempo real
  useEffect(() => {
    if (!activeId) return;
    let unsub = () => {};
    (async () => {
      try { setMessages(await getMessages(activeId)); } catch { setMessages([]); }
      markRead(activeId).then(loadConvs);
      unsub = subscribeToMessages(activeId, (m) => {
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_id !== currentUserId) markRead(activeId).then(loadConvs);
      });
    })();
    return () => unsub();
  }, [activeId, currentUserId, loadConvs]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openConv = (id: string) => { setActiveId(id); setMobileThread(true); };

  async function handleSendText() {
    const body = text.trim();
    if (!body || !activeId || sending) return;
    setSending(true); setText('');
    try { await sendMessage(activeId, currentUserId, body); } catch { setText(body); }
    setSending(false);
  }

  async function handleFile(file: File) {
    if (!activeId) return;
    setUploading(true);
    try {
      const url = await uploadAttachment(file, file.name);
      await sendMessage(activeId, currentUserId, '', { url, type: fileKind(file.type), name: file.name, size: file.size });
    } catch (e) { alert('Falha ao enviar anexo: ' + (e instanceof Error ? e.message : e)); }
    setUploading(false);
  }

  const active = convs.find(c => c.id === activeId) || null;
  const filtered = useMemo(() =>
    convs.filter(c => convTitle(c).toLowerCase().includes(q.toLowerCase())), [convs, q, convTitle]);

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[520px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* LISTA */}
      <div className={`${mobileThread ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[340px] min-w-0 border-r border-gray-200`}>
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar conversa…"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm" />
          </div>
          <button onClick={() => setShowNew(true)} title="Nova conversa"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white flex-shrink-0" style={{ background: BRAND }}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="text-center text-sm text-gray-400 mt-8 px-4">Nenhuma conversa ainda. Toque em <strong>+</strong> para começar.</p>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => openConv(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left ${activeId === c.id ? 'bg-gray-50' : ''}`}>
              <Avatar name={convTitle(c)} group={c.type === 'group'} online={c.other_user_id ? contacts[c.other_user_id]?.is_online : false} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">{convTitle(c)}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{c.last_message_at ? timeShort(c.last_message_at) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">{c.last_message_preview || 'Nova conversa'}</span>
                  {c.unread > 0 && <span className="flex-shrink-0 text-[10px] font-bold text-white rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center" style={{ background: BRAND }}>{c.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* THREAD */}
      <div className={`${mobileThread ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 bg-[#f8f7f5]`}>
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Selecione uma conversa</div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
              <button onClick={() => setMobileThread(false)} className="md:hidden text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
              <Avatar name={convTitle(active)} group={active.type === 'group'} online={active.other_user_id ? contacts[active.other_user_id]?.is_online : false} />
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{convTitle(active)}</p>
                <p className="text-[11px] text-gray-400">{active.type === 'group' ? 'Grupo' : (active.other_user_id && contacts[active.other_user_id]?.is_online ? 'online' : 'offline')}</p>
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3 space-y-1.5">
              {messages.map((m, i) => {
                const mine = m.sender_id === currentUserId;
                const showDay = i === 0 || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at);
                return (
                  <div key={m.id}>
                    {showDay && <div className="text-center my-2"><span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{dayLabel(m.created_at)}</span></div>}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm'}`} style={mine ? { background: BRAND } : {}}>
                        {active.type === 'group' && !mine && <p className="text-[10px] font-bold mb-0.5" style={{ color: BRAND }}>{nameOf(m.sender_id)}</p>}
                        <Attachment m={m} mine={mine} />
                        {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                        <p className={`text-[9px] mt-0.5 text-right ${mine ? 'text-white/70' : 'text-gray-400'}`}>{timeShort(m.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* COMPOSER */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-gray-200">
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-gray-500 hover:text-gray-700 disabled:opacity-50" title="Anexar foto/documento">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                placeholder="Mensagem…" className="flex-1 min-w-0 border border-gray-300 rounded-full px-4 py-2 text-sm" />
              {/* Estilo WhatsApp: microfone quando vazio, botão de enviar quando há texto */}
              {text.trim()
                ? <button onClick={handleSendText} disabled={sending} className="w-10 h-10 flex items-center justify-center rounded-full text-white disabled:opacity-40 flex-shrink-0" style={{ background: BRAND }} title="Enviar">
                    <Send className="w-5 h-5" />
                  </button>
                : <div className="min-w-[40px] h-10 flex items-center justify-center flex-shrink-0">
                    <AudioRecorder onRecorded={(blob) => handleFile(new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' }))} />
                  </div>}
            </div>
          </>
        )}
      </div>

      {showNew && <NewChatModal contacts={Object.values(contacts)} companyId={activeCompanyId} onClose={() => setShowNew(false)}
        onStarted={(id) => { setShowNew(false); loadConvs(); openConv(id); }} />}
    </div>
  );
}

function Avatar({ name, group, online }: { name: string; group?: boolean; online?: boolean }) {
  return (
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: group ? '#6b7280' : BRAND }}>
        {group ? <Users className="w-5 h-5" /> : initials(name)}
      </div>
      {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
    </div>
  );
}

function Attachment({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (!m.attachment_url) return null;
  if (m.attachment_type === 'image')
    return <a href={m.attachment_url} target="_blank" rel="noreferrer"><img src={m.attachment_url} className="rounded-lg max-w-full max-h-64 mb-1" loading="lazy" /></a>;
  if (m.attachment_type === 'audio')
    return <audio controls src={m.attachment_url} className="w-full max-w-[240px] mb-1" style={{ minWidth: 0 }} />;
  return (
    <a href={m.attachment_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 mb-1 underline ${mine ? 'text-white' : 'text-gray-700'}`}>
      <FileText className="w-4 h-4" /> <span className="text-xs truncate">{m.attachment_name || 'Documento'}</span>
    </a>
  );
}

function AudioRecorder({ onRecorded }: { onRecorded: (b: Blob) => void }) {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      m.ondataavailable = e => chunks.current.push(e.data);
      m.onstop = () => { stream.getTracks().forEach(t => t.stop()); onRecorded(new Blob(chunks.current, { type: 'audio/webm' })); };
      m.start(); mr.current = m; setRec(true); setSecs(0);
      timer.current = window.setInterval(() => setSecs(s => s + 1), 1000);
    } catch { alert('Não consegui acessar o microfone.'); }
  }
  function stop() {
    mr.current?.stop(); setRec(false);
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }
  if (rec) return (
    <button onClick={stop} className="flex items-center gap-1 text-red-600 font-semibold text-sm" title="Parar e enviar">
      <Square className="w-5 h-5 fill-red-600" /> {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
    </button>
  );
  return <button onClick={start} className="text-gray-500 hover:text-gray-700" title="Gravar áudio"><Mic className="w-5 h-5" /></button>;
}

function NewChatModal({ contacts, companyId, onClose, onStarted }: { contacts: Contact[]; companyId: string | null; onClose: () => void; onStarted: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [gname, setGname] = useState('');
  const [busy, setBusy] = useState(false);
  const list = contacts.filter(c => c.full_name.toLowerCase().includes(q.toLowerCase()));

  async function pickDirect(uid: string) {
    if (!companyId) return;
    setBusy(true);
    try { onStarted(await startDirect(uid, companyId)); } catch (e) { alert('Erro: ' + (e instanceof Error ? e.message : e)); setBusy(false); }
  }
  function toggle(uid: string) { setSel(p => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n; }); }
  async function makeGroup() {
    if (!gname.trim() || sel.size === 0 || !companyId) return;
    setBusy(true);
    try { onStarted(await createGroup(gname.trim(), [...sel], companyId)); } catch (e) { alert('Erro: ' + (e instanceof Error ? e.message : e)); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{groupMode ? 'Novo grupo' : 'Nova conversa'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-3 space-y-2 border-b border-gray-100">
          <button onClick={() => setGroupMode(g => !g)} className="text-sm font-semibold" style={{ color: BRAND }}>
            {groupMode ? '← Conversa individual' : '+ Criar um grupo'}
          </button>
          {groupMode && <input value={gname} onChange={e => setGname(e.target.value)} placeholder="Nome do grupo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contato…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map(c => (
            <button key={c.user_id} onClick={() => groupMode ? toggle(c.user_id) : pickDirect(c.user_id)} disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left disabled:opacity-50">
              <Avatar name={c.full_name} online={c.is_online} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.full_name}</p>
                <p className="text-[11px] text-gray-400">{c.is_admin ? 'Administrador' : 'Representante'}{c.is_online ? ' · online' : ''}</p>
              </div>
              {groupMode && sel.has(c.user_id) && <Check className="w-5 h-5" style={{ color: BRAND }} />}
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-sm text-gray-400 py-6">Nenhum contato.</p>}
        </div>
        {groupMode && (
          <div className="p-3 border-t border-gray-100">
            <button onClick={makeGroup} disabled={busy || !gname.trim() || sel.size === 0}
              className="w-full py-2.5 rounded-lg text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: BRAND }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Criar grupo ({sel.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
