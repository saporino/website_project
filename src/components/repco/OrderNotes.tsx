import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

interface Note { id: string; note: string; author_name: string | null; created_at: string; }

export default function OrderNotes({ orderId }: { orderId: string }) {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('representative_order_notes')
      .select('id,note,author_name,created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setNotes(data || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const { error } = await supabase.from('representative_order_notes').insert({
      order_id: orderId, note: t,
      author_user_id: user?.id ?? null,
      author_name: (profile as any)?.full_name ?? null,
    });
    setBusy(false);
    if (!error) { setText(''); load(); }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5" /> Observações {notes.length > 0 && `(${notes.length})`}
      </p>
      {notes.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {notes.map(n => (
            <div key={n.id} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-gray-700 whitespace-pre-wrap">{n.note}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {n.author_name || 'Usuário'} · {new Date(n.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Adicionar observação ao pedido…"
          rows={1}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#8B2214] resize-y"
        />
        <button onClick={add} disabled={busy || !text.trim()}
          className="text-xs px-3 py-1.5 rounded bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-40 whitespace-nowrap">
          {busy ? '...' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}
