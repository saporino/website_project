import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { APIFY_KEYWORD_GROUPS } from '../../constants/prospectKeywords';
import type { ClientSegment } from '../../constants/segments';
import { SEGMENT_LABEL } from '../../constants/segments';
import { X, Loader2, Search } from 'lucide-react';

const COST_PER_PLACE = 0.004;

export interface ApifyStartParams {
  category: string; segment: ClientSegment | null; keywords: string[];
  uf: string; municipio: string; bairro: string | null;
  maxPlaces: number; representativeId: string | null;
}

export default function ApifyRunModal({ uf, municipio, onStart, onClose, busy }: {
  uf: string; municipio: string; busy: boolean;
  onStart: (p: ApifyStartParams) => void; onClose: () => void;
}) {
  const [catIdx, setCatIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bairro, setBairro] = useState('');
  const [maxPlaces, setMaxPlaces] = useState(100);

  const group = APIFY_KEYWORD_GROUPS[catIdx];

  useEffect(() => {
    // por padrão seleciona as 3 primeiras keywords da categoria (controle de custo)
    setSelected(new Set(group.keywords.slice(0, 3)));
  }, [catIdx]);

  const places = maxPlaces * selected.size;
  const cost = (places * COST_PER_PLACE).toFixed(2);

  function toggle(k: string) {
    setSelected(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  return createPortal((
    <div className="fixed inset-0 z-[9999] transform-gpu flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Search className="w-5 h-5 text-[#8B2214]" /> Buscar leads reais (Apify)</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">Área: <strong className="text-gray-800">{municipio}/{uf}</strong>. O Google Maps traz endereço e contatos reais para visita.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Setor (categoria de busca)</label>
            <select value={catIdx} onChange={e => setCatIdx(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {APIFY_KEYWORD_GROUPS.map((g, i) => <option key={g.category} value={i}>{g.category}{g.segment ? ` → ${SEGMENT_LABEL[g.segment]}` : ''}</option>)}
            </select>
            {group.note && <p className="text-[11px] text-gray-400 mt-1">{group.note}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Palavras-chave ({selected.size} selecionadas — cada uma multiplica o custo)</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {group.keywords.map(k => {
                const on = selected.has(k);
                return <button key={k} onClick={() => toggle(k)} className={`rounded-full px-2.5 py-1 text-xs border ${on ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'border-gray-300 text-gray-600'}`}>{k}</button>;
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Bairro (opcional)</label>
              <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="ex.: Itaquera" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantidade (teto por palavra-chave)</label>
              <input type="number" min={10} max={500} value={maxPlaces} onChange={e => setMaxPlaces(Math.max(10, Math.min(500, Number(e.target.value) || 10)))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-1 mt-1">
                {[100, 300, 500].map(n => (
                  <button key={n} type="button" onClick={() => setMaxPlaces(n)}
                    className={`flex-1 rounded-md py-1 text-xs border ${maxPlaces === n ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'border-gray-300 text-gray-600'}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">O resultado vira um <strong>pool não-atribuído</strong> em Prospecção — você distribui aos reps por bairro/quantidade depois.</p>

          <div className="rounded-lg bg-[#f5f0ef] p-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Estimativa</span><span className="font-semibold text-gray-900">~{places} places</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Custo aproximado</span><span className="font-bold text-[#8B2214]">≈ US$ {cost}</span></div>
            <p className="text-[11px] text-gray-400 mt-1">Plano free ≈ 1.200 places/mês. O cap é aplicado no servidor.</p>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button disabled={busy || selected.size === 0} onClick={() => onStart({ category: group.category, segment: group.segment, keywords: [...selected], uf, municipio, bairro: bairro.trim() || null, maxPlaces, representativeId: null })}
            className="flex-1 flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Disparar busca
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
