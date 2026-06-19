import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import EcommercePriceIntel from '../admin/EcommercePriceIntel';
import { Loader2, Store, ShoppingBag, TrendingUp } from 'lucide-react';

interface Source { marketplace: string; label: string; kind: string; sort_order: number; }

// Preços de mercado que o ADMIN liberou para o representante ver (somente leitura).
// O RLS garante que o rep só recebe as fontes com visible_to_reps = true.
export default function RepCoMarketPrices() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('ecommerce_sources')
        .select('marketplace,label,kind,sort_order')
        .eq('visible_to_reps', true)
        .order('kind').order('sort_order');
      const list = (data as Source[]) || [];
      setSources(list);
      setSel(list[0]?.marketplace ?? null);
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => ({
    marketplace: sources.filter(s => s.kind === 'marketplace'),
    supermercado_sp: sources.filter(s => s.kind === 'supermercado_sp'),
  }), [sources]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-[#a4240e]" /></div>;

  if (!sources.length) return (
    <div className="text-center py-12 text-gray-500">
      <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="font-medium text-gray-700">Preços de mercado em breve</p>
      <p className="text-sm mt-1">Nenhuma fonte liberada ainda. Quando a empresa ativar, os preços da concorrência aparecem aqui.</p>
    </div>
  );

  const cur = sources.find(s => s.marketplace === sel);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Preços do Mercado</h3>
        <p className="text-sm text-gray-500">Como a concorrência está vendendo café — use na negociação.</p>
      </div>

      {groups.marketplace.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Marketplaces</p>
          <div className="flex flex-wrap gap-2">
            {groups.marketplace.map(s => (
              <button key={s.marketplace} onClick={() => setSel(s.marketplace)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sel === s.marketplace ? 'bg-purple-700 text-white' : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.supermercado_sp.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Supermercados SP</p>
          <div className="flex flex-wrap gap-2">
            {groups.supermercado_sp.map(s => (
              <button key={s.marketplace} onClick={() => setSel(s.marketplace)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sel === s.marketplace ? 'bg-teal-700 text-white' : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {cur && (
        <div className="border border-gray-200 rounded-xl p-4 bg-[#f8f7f5]">
          <EcommercePriceIntel marketplace={cur.marketplace} label={cur.label} readOnly />
        </div>
      )}
    </div>
  );
}
