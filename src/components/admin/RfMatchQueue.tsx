import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, Loader2, Link2 } from 'lucide-react';

const maskCnpj = (v: string | null) => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (v || '');
};

interface Candidate {
  id: string; lead_id: string; rf_cnpj: string; rf_razao: string | null; rf_fantasia: string | null;
  rf_bairro: string | null; rf_municipio: string | null; score: number | null; reason: string | null;
  prospect_leads: { company_name: string; trade_name: string | null; district: string | null; city: string | null } | null;
}

export default function RfMatchQueue() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('lead_rf_candidates')
      .select('*, prospect_leads(company_name,trade_name,district,city)')
      .eq('status', 'pending').order('score', { ascending: false }).limit(300);
    setItems((data as Candidate[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function confirm(c: Candidate) {
    setBusy(c.id);
    await supabase.from('prospect_leads').update({
      rf_cnpj: c.rf_cnpj, rf_razao: c.rf_razao || c.rf_fantasia || null, rf_match_status: 'confirmed',
    }).eq('id', c.lead_id);
    await supabase.from('prospects_b2b').update({
      covered_at: new Date().toISOString(), covered_by_lead_id: c.lead_id,
    }).eq('cnpj', c.rf_cnpj);
    await supabase.from('lead_rf_candidates').update({ status: 'confirmed', resolved_at: new Date().toISOString() }).eq('id', c.id);
    setItems(prev => prev.filter(x => x.id !== c.id)); setBusy(null);
  }
  async function reject(c: Candidate) {
    setBusy(c.id);
    await supabase.from('prospect_leads').update({ rf_match_status: 'none' }).eq('id', c.lead_id);
    await supabase.from('lead_rf_candidates').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', c.id);
    setItems(prev => prev.filter(x => x.id !== c.id)); setBusy(null);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>;
  if (!items.length) return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
      <Link2 className="w-9 h-9 mx-auto mb-2 text-gray-300" />
      Nenhum match pendente. Quando um lead do scraper casar com a Receita de forma ambígua (nome forte sem bairro, ou nome médio), ele aparece aqui pra você confirmar.
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-1">{items.length} possível(is) match(es) entre lead do scraper e CNPJ da Receita — confirme se é a mesma empresa.</p>
      {items.map(c => {
        const lead = c.prospect_leads;
        return (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-100 p-2">
                <p className="text-[10px] uppercase text-gray-400 font-semibold">Lead (scraper)</p>
                <p className="text-sm font-medium text-gray-900 truncate">{lead?.trade_name || lead?.company_name || '—'}</p>
                <p className="text-xs text-gray-500">{lead?.district || 'sem bairro'} · {lead?.city || ''}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                <p className="text-[10px] uppercase text-gray-400 font-semibold">Receita (CNPJ)</p>
                <p className="text-sm font-medium text-gray-900 truncate">{c.rf_razao || c.rf_fantasia || '—'}</p>
                <p className="text-xs text-gray-500">{maskCnpj(c.rf_cnpj)} · {c.rf_bairro || 'sem bairro'}</p>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 sm:w-28">{c.reason}{c.score != null && ` · ${Math.round(c.score * 100)}%`}</div>
            <div className="flex gap-2">
              <button disabled={busy === c.id} onClick={() => confirm(c)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2">
                {busy === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} É a mesma
              </button>
              <button disabled={busy === c.id} onClick={() => reject(c)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-semibold px-3 py-2">
                <X className="w-3.5 h-3.5" /> Não é
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
