import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Search, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

interface Article { id: string; question: string; answer: string; category: string; sort_order: number; }

// Central de Ajuda: FAQ (editável pelo admin) + atalho pro suporte (chat interno).
// audience = qual público vê. Cada um vê as suas perguntas + as marcadas como "ambos".
export default function RepCoHelp({ onContactSupport, audience = 'representante' }: { onContactSupport?: () => void; audience?: 'representante' | 'promotor' }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('repco_help_articles')
        .select('id,question,answer,category,sort_order')
        .eq('is_active', true)
        .in('audience', [audience, 'ambos'])
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      setArticles((data as Article[]) || []);
      setLoading(false);
    })();
  }, [audience]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return articles;
    return articles.filter(a => a.question.toLowerCase().includes(t) || a.answer.toLowerCase().includes(t));
  }, [articles, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Article[]>();
    filtered.forEach(a => { const k = a.category || 'Geral'; map.set(k, [...(map.get(k) || []), a]); });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-[#a4240e]" />
        <h2 className="text-lg font-semibold text-gray-800">Central de Ajuda</h2>
      </div>

      {/* Suporte direto */}
      <div className="bg-[#a4240e] text-white rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Não achou o que procurava?</p>
          <p className="text-xs opacity-90">Fale direto com o suporte pelo chat do app.</p>
        </div>
        {onContactSupport && (
          <button onClick={onContactSupport} className="flex items-center gap-1.5 bg-white text-[#a4240e] text-sm font-semibold px-3 py-2 rounded-lg hover:bg-gray-100">
            <MessageCircle className="w-4 h-4" /> Falar com o suporte
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar uma dúvida..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]" /></div>
      ) : byCategory.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Nenhuma pergunta encontrada.</div>
      ) : (
        byCategory.map(([cat, list]) => (
          <div key={cat} className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{cat}</p>
            {list.map(a => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setOpen(open === a.id ? null : a.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="text-sm font-medium text-gray-800">{a.question}</span>
                  {open === a.id ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {open === a.id && <div className="px-4 pb-4 -mt-1 text-sm text-gray-600 whitespace-pre-line">{a.answer}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
