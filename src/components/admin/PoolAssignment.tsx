import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { Loader2, MapPin, Users, ChevronLeft, Check } from 'lucide-react';

interface Pool { id: string; name: string; segment: string | null; total: number; assigned: number; remaining: number; }
interface Lead { id: string; company_name: string; trade_name: string | null; district: string | null; representative_id: string | null; rf_match_status: string | null; status: string | null; representative_client_id: string | null; }
interface Rep { id: string; full_name: string; }

export default function PoolAssignment() {
  const { activeCompanyId } = useCompany();
  const [pools, setPools] = useState<Pool[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Pool | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [repSearch, setRepSearch] = useState('');
  const [repId, setRepId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pickCount, setPickCount] = useState(25); // seleção rápida por quantidade

  async function loadPools() {
    setLoading(true);
    const { data: lists } = await supabase.from('prospect_lists')
      .select('id,name,segment').eq('source_type', 'scraper').eq('company_id', activeCompanyId).order('created_at', { ascending: false });
    const ids = (lists || []).map((l: any) => l.id);
    const counts = new Map<string, { total: number; assigned: number }>();
    // conta leads por pool (paginado)
    for (let from = 0; from < 20000 && ids.length; from += 1000) {
      const { data } = await supabase.from('prospect_leads')
        .select('prospect_list_id,representative_id').in('prospect_list_id', ids).range(from, from + 999);
      const rows = (data as any[]) || [];
      rows.forEach(r => {
        const c = counts.get(r.prospect_list_id) || { total: 0, assigned: 0 };
        c.total++; if (r.representative_id) c.assigned++; counts.set(r.prospect_list_id, c);
      });
      if (rows.length < 1000) break;
    }
    const ps: Pool[] = (lists || []).map((l: any) => {
      const c = counts.get(l.id) || { total: 0, assigned: 0 };
      return { id: l.id, name: l.name, segment: l.segment, total: c.total, assigned: c.assigned, remaining: c.total - c.assigned };
    });
    setPools(ps);
    const { data: r } = await supabase.from('representatives').select('id,full_name').eq('status', 'active').order('full_name');
    setReps((r as Rep[]) || []);
    setLoading(false);
  }
  useEffect(() => { loadPools(); }, [activeCompanyId]);

  async function openPool(p: Pool) {
    setSel(p); setLoadingLeads(true); setPicked(new Set()); setMsg('');
    const all: Lead[] = [];
    for (let from = 0; from < 8000; from += 1000) {
      const { data } = await supabase.from('prospect_leads')
        .select('id,company_name,trade_name,district,representative_id,rf_match_status,status,representative_client_id')
        .eq('prospect_list_id', p.id).range(from, from + 999);
      const rows = (data as Lead[]) || []; all.push(...rows);
      if (rows.length < 1000) break;
    }
    setLeads(all); setLoadingLeads(false);
  }

  // agrupa por bairro
  const byBairro = useMemo(() => {
    const m = new Map<string, Lead[]>();
    leads.forEach(l => { const k = l.district || '— sem bairro —'; (m.get(k) || m.set(k, []).get(k)!).push(l); });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [leads]);

  const filteredReps = reps.filter(r => r.full_name.toLowerCase().includes(repSearch.toLowerCase()));
  const pickedUnassigned = [...picked];

  function toggleLead(id: string) { setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  // Seleção rápida: pega os próximos N não-atribuídos e ainda não selecionados.
  function pickNext(n: number) {
    const next = leads.filter(l => !l.representative_id && !picked.has(l.id)).slice(0, n).map(l => l.id);
    setPicked(s => { const nn = new Set(s); next.forEach(id => nn.add(id)); return nn; });
  }
  function toggleBairro(rows: Lead[]) {
    const unass = rows.filter(l => !l.representative_id).map(l => l.id);
    setPicked(s => { const n = new Set(s); const allIn = unass.every(id => n.has(id)); unass.forEach(id => allIn ? n.delete(id) : n.add(id)); return n; });
  }

  async function assign() {
    if (!repId || !pickedUnassigned.length) return;
    setBusy(true); setMsg('');
    const repName = reps.find(r => r.id === repId)?.full_name || 'rep';
    const ids = pickedUnassigned;
    for (let i = 0; i < ids.length; i += 200) {
      await supabase.from('prospect_leads').update({ representative_id: repId, status: 'assigned' }).in('id', ids.slice(i, i + 200));
    }
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, representative_id: repId } : l));
    setPicked(new Set());
    setMsg(`${ids.length} leads atribuídos a ${repName}. Aparecem na Prospecção dele.`);
    setBusy(false);
    setPools(prev => prev.map(p => p.id === sel?.id ? { ...p, assigned: p.assigned + ids.length, remaining: p.remaining - ids.length } : p));
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>;

  if (!sel) return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-1">Pools de scraper (Apify) por cidade/setor. Atribua porções aos reps por bairro/território — sem re-scrapear.</p>
      {pools.length === 0 && <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">Nenhum pool ainda. Rode uma busca Apify no Mapa de cobertura.</div>}
      {pools.map(p => (
        <button key={p.id} onClick={() => openPool(p)} className="w-full flex items-center justify-between text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50">
          <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
          <span className="text-xs flex-shrink-0 ml-2">
            <span className="font-semibold text-[#8B2214]">{p.remaining}</span><span className="text-gray-400"> a atribuir · {p.assigned}/{p.total} feito</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <button onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-2"><ChevronLeft className="w-4 h-4" /> voltar aos pools</button>
      <h3 className="font-bold text-gray-900">{sel.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{loadingLeads ? 'carregando…' : `${sel.remaining} a atribuir de ${sel.total}`}</p>

      {/* Rep + atribuir */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3 sticky top-2 z-10">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <input value={repSearch} onChange={e => setRepSearch(e.target.value)} placeholder="Buscar representante…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1" />
            <select value={repId} onChange={e => setRepId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— escolher representante —</option>
              {filteredReps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>
          <button disabled={busy || !repId || picked.size === 0} onClick={assign}
            className="flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg sm:w-48">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Atribuir {picked.size}
          </button>
        </div>
        {/* Seleção rápida por quantidade: escolhe quantos vão pra este rep sem clicar um a um */}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          <span className="text-gray-500">Selecionar rápido:</span>
          <input type="number" min={1} value={pickCount} onChange={e => setPickCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 border border-gray-300 rounded-md px-2 py-1" />
          <button onClick={() => pickNext(pickCount)} className="rounded-md border border-gray-300 text-gray-700 px-2 py-1 hover:bg-gray-50 font-semibold">
            + Selecionar próximos {pickCount}
          </button>
          <button onClick={() => setPicked(new Set(leads.filter(l => !l.representative_id).map(l => l.id)))} className="rounded-md border border-gray-300 text-gray-600 px-2 py-1 hover:bg-gray-50">
            todos ({sel.remaining})
          </button>
          {picked.size > 0 && <button onClick={() => setPicked(new Set())} className="text-gray-500 underline">limpar seleção ({picked.size})</button>}
        </div>
        {msg && <p className="text-xs mt-2 text-green-700">{msg}</p>}
      </div>

      {/* Leads por bairro (território contíguo) */}
      <div className="space-y-3">
        {byBairro.map(([bairro, rows]) => {
          const unass = rows.filter(l => !l.representative_id);
          const allPicked = unass.length > 0 && unass.every(l => picked.has(l.id));
          return (
            <div key={bairro} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" /> {bairro}</span>
                <button onClick={() => toggleBairro(rows)} disabled={!unass.length}
                  className={`text-xs rounded-md px-2 py-1 border ${allPicked ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'border-gray-300 text-gray-600'} disabled:opacity-40`}>
                  {allPicked ? <Check className="w-3 h-3 inline" /> : null} bairro inteiro ({unass.length})
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {rows.slice(0, 60).map(l => (
                  <label key={l.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${l.representative_id ? 'opacity-40 border-gray-100' : 'border-gray-100 cursor-pointer hover:bg-gray-50'}`}>
                    <input type="checkbox" disabled={!!l.representative_id} checked={picked.has(l.id)} onChange={() => toggleLead(l.id)} />
                    <span className="truncate">{l.trade_name || l.company_name}</span>
                    {(l.representative_client_id || l.status === 'converted')
                      ? <span className="flex-shrink-0 ml-auto rounded bg-green-100 text-green-700 px-1.5">✓ cliente{l.representative_id ? ` · ${reps.find(r => r.id === l.representative_id)?.full_name || 'rep'}` : ''}</span>
                      : l.representative_id
                        ? <span className="flex-shrink-0 ml-auto text-gray-500">→ {reps.find(r => r.id === l.representative_id)?.full_name || 'rep'}</span>
                        : null}
                  </label>
                ))}
              </div>
              {rows.length > 60 && <p className="text-[11px] text-gray-400 mt-1">+{rows.length - 60} (use "bairro inteiro")</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
