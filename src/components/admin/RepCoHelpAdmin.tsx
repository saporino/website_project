import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Plus, Trash2, Save, Loader2, Eye, EyeOff } from 'lucide-react';

interface Article { id: string; question: string; answer: string; category: string; sort_order: number; is_active: boolean; audience: string; }

const EMPTY = { question: '', answer: '', category: 'Geral', sort_order: 0, is_active: true, audience: 'representante' };
const AUD_LABEL: Record<string, string> = { representante: 'Representante', promotor: 'Promotor', admin: 'Admin', ambos: 'Ambos' };

// Editor da Central de Ajuda do RepCo (FAQ que o representante vê no app).
export default function RepCoHelpAdmin() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('repco_help_articles')
      .select('*').order('category').order('sort_order');
    setArticles((data as Article[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.question || !editing?.answer) { alert('Pergunta e resposta são obrigatórias.'); return; }
    setSaving(true);
    const payload = {
      question: editing.question, answer: editing.answer,
      category: editing.category || 'Geral', sort_order: Number(editing.sort_order) || 0,
      is_active: editing.is_active ?? true, audience: editing.audience || 'representante',
    };
    const { error } = editing.id
      ? await supabase.from('repco_help_articles').update(payload).eq('id', editing.id)
      : await supabase.from('repco_help_articles').insert([payload]);
    setSaving(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta pergunta?')) return;
    const { error } = await supabase.from('repco_help_articles').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    load();
  }

  async function toggleActive(a: Article) {
    await supabase.from('repco_help_articles').update({ is_active: !a.is_active }).eq('id', a.id);
    load();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[#8B2214]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Central de Ajuda do RepCo</h3>
            <p className="text-sm text-gray-500">Perguntas e respostas que o representante vê na aba Ajuda do app.</p>
          </div>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-3 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nova pergunta
        </button>
      </div>

      {editing && (
        <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Pergunta</label>
              <input value={editing.question || ''} onChange={e => setEditing(p => ({ ...p, question: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Categoria</label>
              <input value={editing.category || ''} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))} placeholder="Geral" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Quem vê esta pergunta</label>
            <select value={editing.audience || 'representante'} onChange={e => setEditing(p => ({ ...p, audience: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="representante">Só o Representante</option>
              <option value="promotor">Só o Promotor</option>
              <option value="admin">Só o Admin (você)</option>
              <option value="ambos">Ambos (rep + promotor)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Resposta</label>
            <textarea value={editing.answer || ''} onChange={e => setEditing(p => ({ ...p, answer: e.target.value }))} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500">Ordem</label>
              <input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))} className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} /> Ativa (visível ao rep)
            </label>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#8B2214]" /></div>
      ) : articles.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nenhuma pergunta cadastrada.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {articles.map(a => (
            <div key={a.id} className="flex items-start gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${a.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                  {a.question}
                  <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full align-middle ${a.audience === 'promotor' ? 'bg-blue-100 text-blue-700' : a.audience === 'ambos' ? 'bg-purple-100 text-purple-700' : a.audience === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-[#f5f0ef] text-[#8B2214]'}`}>{AUD_LABEL[a.audience] || a.audience}</span>
                </p>
                <p className="text-xs text-gray-500 truncate">{a.category} · {a.answer}</p>
              </div>
              <button onClick={() => toggleActive(a)} title={a.is_active ? 'Ocultar' : 'Mostrar'} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                {a.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditing(a)} className="text-xs font-medium text-[#8B2214] hover:underline px-2 py-1">Editar</button>
              <button onClick={() => remove(a.id)} className="p-1.5 hover:bg-gray-100 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
