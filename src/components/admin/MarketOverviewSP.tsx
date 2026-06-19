import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Coffee, Store } from 'lucide-react';

const BRAND = '#8B2214';
const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const median = (arr: number[]) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const weightFromName = (name: string) => { const t = name.toLowerCase().replace(/\./g, ','); let m = t.match(/(\d+(?:,\d+)?)\s*kg/); if (m) return parseFloat(m[1].replace(',', '.')) * 1000; m = t.match(/(\d+(?:,\d+)?)\s*g(?![a-z])/); if (m) return parseFloat(m[1].replace(',', '.')); return 500; };

const SEGS = [{ key: 'torrado_moido', label: 'Torrado e moído' }, { key: 'graos', label: 'Em grãos' }, { key: 'soluvel', label: 'Solúvel' }];

interface Row { id: number; marketplace: string; title: string; price: number; price_per_kg: number | null; unit_type: string | null; is_suspect: boolean; discount_pct: number | null; }
interface Prod { id: string; name: string; price: number; }

// Visão geral: todos os supermercados SP juntos + onde cada café Saporino se posiciona.
export default function MarketOverviewSP() {
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [seg, setSeg] = useState('torrado_moido');

  useEffect(() => { (async () => {
    setLoading(true);
    const { data: srcs } = await supabase.from('ecommerce_sources').select('marketplace,label').eq('kind', 'supermercado_sp');
    const keys = (srcs || []).map((s: any) => s.marketplace);
    setLabels(Object.fromEntries((srcs || []).map((s: any) => [s.marketplace, s.label])));
    const [{ data: snaps }, { data: products }] = await Promise.all([
      keys.length ? supabase.from('vw_ecommerce_latest').select('id,marketplace,title,price,price_per_kg,unit_type,is_suspect,discount_pct').in('marketplace', keys) : Promise.resolve({ data: [] }),
      supabase.from('products').select('id,name,price').eq('is_active', true).order('name'),
    ]);
    setRows((snaps as Row[]) || []);
    setProds((products as Prod[]) || []);
    setLoading(false);
  })(); }, []);

  const segRows = useMemo(() => rows
    .filter(r => r.unit_type === seg && !r.is_suspect && r.price_per_kg != null)
    .sort((a, b) => (b.price_per_kg || 0) - (a.price_per_kg || 0)), [rows, seg]);

  const spks = segRows.map(r => r.price_per_kg!).filter(Boolean);
  const med = median(spks);
  const lo = spks.length ? Math.min(...spks) : 0;
  const hi = spks.length ? Math.max(...spks) : 0;
  const redes = new Set(segRows.map(r => r.marketplace)).size;
  const pos = (v: number) => hi > lo ? Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)) : 50;

  // só faz sentido comparar nossos cafés com o segmento torrado e moído (padrão Saporino)
  const sapItems = useMemo(() => prods.map(p => {
    const w = weightFromName(p.name);
    const spk = w ? +(p.price / (w / 1000)).toFixed(2) : 0;
    const vsMed = med && spk ? Math.round(((spk - med) / med) * 100) : 0;
    return { ...p, w, spk, vsMed };
  }).filter(p => p.spk > 0).sort((a, b) => a.spk - b.spk), [prods, med]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin" style={{ color: BRAND }} /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Visão geral — Supermercados SP</h3>
        <p className="text-sm text-gray-500">Todas as redes coletadas juntas · {rows.length} anúncios · {redes} rede(s) no segmento</p>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
        {SEGS.map(s => <button key={s.key} onClick={() => setSeg(s.key)} className={`px-3 py-1.5 text-sm ${seg === s.key ? 'text-white' : 'text-gray-600'}`} style={seg === s.key ? { background: BRAND } : {}}>{s.label}</button>)}
      </div>

      {segRows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">Nenhum dado neste segmento ainda. Colete alguma rede (Atacadão, Sam's…) e volte aqui.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Anúncios" value={String(segRows.length)} />
            <Kpi label="Redes" value={String(redes)} />
            <Kpi label="Mediana R$/kg" value={brl(med)} />
            <Kpi label="Faixa R$/kg" value={`${brl(lo)} – ${brl(hi)}`} small />
          </div>

          {/* Régua com a mediana de mercado + cada café Saporino */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Onde nossos cafés caem no mercado (R$/kg)</p>
            <div className="relative" style={{ height: 16 + sapItems.length * 16 }}>
              <div className="absolute left-0 right-0 h-1.5 rounded-full bg-gradient-to-r from-green-300 via-amber-300 to-red-400" style={{ top: 6 }} />
              {med > 0 && <div className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold text-gray-500" style={{ left: `${pos(med)}%` }}>mediana</div>}
              {med > 0 && <div className="absolute rounded-full border-2 border-white bg-gray-500" style={{ left: `${pos(med)}%`, top: 2, width: 11, height: 11, transform: 'translateX(-50%)' }} />}
              {sapItems.map((p, i) => (
                <div key={p.id} className="absolute rounded-full border-2 border-white" style={{ left: `${pos(p.spk)}%`, top: 2, width: 13, height: 13, background: BRAND, transform: 'translateX(-50%)', zIndex: 2 }} title={`${p.name} · ${brl(p.spk)}/kg`}>
                  <span className="absolute left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap font-medium" style={{ top: 14 + i * 0, color: BRAND }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1"><span>{brl(lo)}/kg</span><span>{brl(hi)}/kg</span></div>
          </div>

          {/* Lista: nossos cafés vs mediana */}
          {sapItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Coffee className="w-4 h-4" style={{ color: BRAND }} /> Nossos cafés Saporino vs mercado</p>
              <div className="space-y-1.5">
                {sapItems.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-gray-800">{p.name} <span className="text-gray-400">({p.w}g)</span></span>
                    <span className="text-gray-500">{brl(p.price)}</span>
                    <span className="font-semibold text-gray-900 w-24 text-right">{brl(p.spk)}/kg</span>
                    <span className={`w-28 text-right font-semibold ${p.vsMed > 0 ? 'text-red-600' : 'text-green-600'}`}>{p.vsMed > 0 ? '+' : ''}{p.vsMed}% vs mediana</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Peso lido do nome do produto (padrão 500g). Verde = mais barato que a mediana do mercado; vermelho = mais caro.</p>
            </div>
          )}

          {/* Ranking caro -> barato com a rede */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-700">Ranking do mercado (caro → barato)</p>
            {segRows.slice(0, 80).map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 flex-shrink-0"><Store className="w-3 h-3" /> {labels[r.marketplace] || r.marketplace}</span>
                <span className="flex-1 min-w-0 truncate text-xs text-gray-800">{r.title}</span>
                {(r.discount_pct || 0) > 0 && <span className="rounded-full bg-green-100 text-green-700 px-1.5 text-[10px] flex-shrink-0">-{r.discount_pct}%</span>}
                <span className="text-xs text-gray-400 flex-shrink-0">{brl(r.price)}</span>
                <span className="text-sm font-bold text-gray-900 w-24 text-right flex-shrink-0">{brl(r.price_per_kg || 0)}/kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`font-bold text-gray-900 ${small ? 'text-xs' : 'text-lg'}`}>{value}</p>
    </div>
  );
}
