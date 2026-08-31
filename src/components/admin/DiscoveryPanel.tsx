// TASK INTEL-1 — Subaba "Descobrir" (Discovery Intelligence).
// Descobre grupos/canais/comunidades PÚBLICAS e empresas por keyword+região via Apify (edge
// discovery-run). Resultados TIPADOS em discovery_results (≠ leads). Reutiliza o padrão da Prospecção.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DISCOVERY_SOURCES, type DiscoverySource, startRun, pollStatus, importResults, checkAccount, priorityLabel,
} from '../../lib/discoveryClient';
import {
  Search, Plus, X, ExternalLink, Check, Trash2, Loader2, AlertTriangle, MessageCircle, Store, Radio,
} from 'lucide-react';

const WINE = '#8B2214';
const CITY_PRESETS = ['Estado de São Paulo', 'Grande São Paulo', 'Jundiaí', 'Campinas', 'Sorocaba', 'Circuito das Águas'];

type KwGroup = { group_name: string; n: number };
type DResult = {
  id: string; source: string; result_type: string; title: string | null; description: string | null;
  public_url: string | null; keyword: string | null; city: string | null; state: string | null;
  score: number | null; status: string; member_count: number | null; created_at: string;
};
type Run = {
  id: string; source_type: string | null; keywords: string[] | null; country: string | null; uf: string | null;
  municipio: string | null; status: string; result_count: number | null; cost_actual_usd: number | null;
  actor_id: string | null; created_at: string; campaign_id: string | null;
};

const STATUS_PT: Record<string, string> = { new: 'Novo', reviewing: 'Em análise', approved: 'Aprovado', dismissed: 'Descartado', duplicate: 'Duplicado', stale: 'Desatualizado' };
const TYPE_ICON: Record<string, React.ReactNode> = {
  PUBLIC_WHATSAPP_GROUP: <MessageCircle className="w-3.5 h-3.5" />, PUBLIC_WHATSAPP_CHANNEL: <Radio className="w-3.5 h-3.5" />, BUSINESS: <Store className="w-3.5 h-3.5" />,
};

export default function DiscoveryPanel() {
  const [campaign, setCampaign] = useState('WHATSAPP — CAFÉ & VENDAS SP — TESTE');
  const [chips, setChips] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [groups, setGroups] = useState<KwGroup[]>([]);
  const [country] = useState('BR');
  const [state, setState] = useState('SP');
  const [city, setCity] = useState('');
  const [sources, setSources] = useState<DiscoverySource[]>(['whatsapp_group']);
  const [maxResults, setMaxResults] = useState(10);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [results, setResults] = useState<DResult[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [account, setAccount] = useState<{ ok: boolean; blocked?: boolean; message?: string; plan?: string; monthlyUsageUsd?: number } | null>(null);

  async function loadGroups() {
    const { data } = await supabase.from('discovery_keywords').select('group_name').eq('active', true);
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => { if (r.group_name) counts[r.group_name] = (counts[r.group_name] || 0) + 1; });
    setGroups(Object.entries(counts).map(([group_name, n]) => ({ group_name, n })).sort((a, b) => a.group_name.localeCompare(b.group_name)));
  }
  async function loadResults() {
    const { data } = await supabase.from('discovery_results').select('id,source,result_type,title,description,public_url,keyword,city,state,score,status,member_count,created_at').order('score', { ascending: false }).limit(300);
    setResults((data || []) as DResult[]);
  }
  async function loadRuns() {
    const { data } = await supabase.from('prospect_runs').select('id,source_type,keywords,country,uf,municipio,status,result_count,cost_actual_usd,actor_id,created_at,campaign_id').not('source_type', 'is', null).order('created_at', { ascending: false }).limit(50);
    setRuns((data || []) as Run[]);
  }
  useEffect(() => { loadGroups(); loadResults(); loadRuns(); checkAccount().then(setAccount).catch(() => {}); }, []);

  function addChips(text: string) {
    const parts = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setChips(prev => Array.from(new Set([...prev, ...parts])));
    setKwInput('');
  }
  async function loadGroupKeywords(g: string) {
    const { data } = await supabase.from('discovery_keywords').select('term').eq('group_name', g).eq('active', true);
    setChips(prev => Array.from(new Set([...prev, ...(data || []).map((r: any) => r.term)])));
  }
  const toggleSource = (s: DiscoverySource) => setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  async function run() {
    if (!chips.length) { setMsg('Adicione ao menos 1 palavra-chave.'); return; }
    if (!sources.length) { setMsg('Selecione ao menos 1 fonte.'); return; }
    setRunning(true); setMsg('Criando campanha…');
    // 1 campanha para o conjunto
    const { data: camp, error: cErr } = await supabase.from('discovery_campaigns').insert({
      name: campaign.trim() || 'Campanha sem nome', country, region_state: state || null, region_city: city || null,
      sources, keywords: chips,
    }).select('id').single();
    if (cErr) { setMsg('Erro ao criar campanha: ' + cErr.message); setRunning(false); return; }
    const campaignId = camp!.id as string;

    let totalIns = 0;
    for (const source of sources) {
      setMsg(`Disparando busca (${source})…`);
      const started = await startRun({ source, keywords: chips, country, state, city, maxResults, campaignId });
      if ('error' in started) {
        setMsg(`Fonte ${source}: ${started.error === 'no_credit' ? 'conta Apify sem crédito / faturas em aberto.' : started.message || started.error}`);
        continue;
      }
      // polling
      let done = false, tries = 0;
      while (!done && tries < 40) {
        await new Promise(r => setTimeout(r, 4000)); tries++;
        const st = await pollStatus(started.runId);
        setMsg(`(${source}) ${st.status}… tentativa ${tries}`);
        if (st.status === 'succeeded') {
          const imp = await importResults(started.runId, campaignId, { source, keywords: chips, country, state, city, maxResults }, st.items || []);
          totalIns += imp.inserted;
          setMsg(`(${source}) ${imp.inserted} novos, ${imp.duplicates} duplicados${st.costUsd != null ? ` · custo $${st.costUsd}` : ''}`);
          done = true;
        } else if (['failed', 'no_credit', 'error'].includes(st.status)) {
          setMsg(`(${source}) ${st.status === 'no_credit' ? 'conta Apify sem crédito / faturas em aberto.' : (st.message || st.status)}`);
          done = true;
        }
      }
      if (!done) setMsg(`(${source}) tempo esgotado — verifique o histórico.`);
    }
    setMsg(`Concluído: ${totalIns} novos resultados.`);
    setRunning(false);
    loadResults(); loadRuns();
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('discovery_results').update({ status }).eq('id', id);
    setResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  const metrics = useMemo(() => {
    const total = results.length;
    const approved = results.filter(r => r.status === 'approved').length;
    const dismissed = results.filter(r => r.status === 'dismissed').length;
    const cost = runs.reduce((s, r) => s + (r.cost_actual_usd || 0), 0);
    return { total, approved, dismissed, cost };
  }, [results, runs]);

  return (
    <div className="space-y-6">
      {/* Banner de conta Apify (billing) */}
      {account && account.ok === false && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div><strong>Conta Apify indisponível.</strong> {account.blocked ? 'Faturas em aberto — quite no painel Apify para executar buscas pagas.' : (account.message || 'Verifique a conta.')}</div>
        </div>
      )}
      {account && account.ok && (
        <p className="text-xs text-gray-400">Conta Apify: {account.plan || 'plano'} {account.monthlyUsageUsd != null ? `· uso do mês $${account.monthlyUsageUsd}` : ''}</p>
      )}

      <div>
        <h3 className="text-lg font-bold text-gray-900">Inteligência de Prospecção</h3>
        <p className="text-sm text-gray-500">Descubra empresas, comunidades e oportunidades públicas por nicho, região e palavras-chave. Resultados não viram leads automaticamente — você aprova.</p>
      </div>

      {/* Campanha */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Campanha</label>
        <input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Ex.: Representantes Café SP"
          className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" />
      </div>

      {/* Palavras-chave */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Palavras-chave</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chips.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-[#f5f0ef] text-[#8B2214] text-xs font-semibold px-2 py-1 rounded-full">
              {c} <button onClick={() => setChips(chips.filter(x => x !== c))}><X className="w-3 h-3" /></button>
            </span>
          ))}
          {chips.length > 0 && <button onClick={() => setChips([])} className="text-xs text-gray-400 hover:text-gray-600 underline">limpar</button>}
        </div>
        <div className="flex gap-2">
          <textarea value={kwInput} onChange={e => setKwInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addChips(kwInput); } }}
            rows={1} placeholder="Digite e Enter, ou cole várias linhas / separadas por vírgula"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" />
          <button onClick={() => addChips(kwInput)} className="flex items-center gap-1 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700"><Plus className="w-4 h-4" /> Adicionar</button>
        </div>
        {/* Grupos/presets */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grupos de palavras-chave</p>
          <div className="flex flex-wrap gap-1.5">
            {groups.map(g => (
              <button key={g.group_name} onClick={() => loadGroupKeywords(g.group_name)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-[#8B2214] hover:text-[#8B2214]">
                {g.group_name} <span className="text-gray-400">({g.n})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Região */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">País</label>
          <input value="Brasil" disabled className="w-full h-10 px-3 text-sm border border-gray-200 bg-gray-50 rounded-lg text-gray-500" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Estado</label>
          <input value={state} onChange={e => setState(e.target.value)} placeholder="SP" className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" /></div>
        <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">Cidade / Região (opcional)</label>
          <input list="city-presets" value={city} onChange={e => setCity(e.target.value)} placeholder="Ex.: Campinas" className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" />
          <datalist id="city-presets">{CITY_PRESETS.map(c => <option key={c} value={c} />)}</datalist></div>
      </div>

      {/* Fontes */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fontes</label>
        <div className="flex flex-wrap gap-2">
          {DISCOVERY_SOURCES.map(s => (
            <button key={s.id} onClick={() => toggleSource(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${sources.includes(s.id) ? 'border-[#8B2214] bg-[#f5f0ef] text-[#8B2214]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${sources.includes(s.id) ? 'bg-[#8B2214] border-[#8B2214]' : 'border-gray-400'}`}>{sources.includes(s.id) && <Check className="w-3 h-3 text-white" />}</span>
              {s.label}{s.note && <span className="text-[10px] text-gray-400">({s.note})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Execução */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Máx. resultados</label>
          <input type="number" min={1} max={50} value={maxResults} onChange={e => setMaxResults(Math.min(50, Math.max(1, Number(e.target.value) || 10)))}
            className="w-20 h-10 px-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <button onClick={run} disabled={running}
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60" style={{ background: WINE }}>
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</> : <><Search className="w-4 h-4" /> Buscar oportunidades</>}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['Encontrados', metrics.total], ['Aprovados', metrics.approved], ['Descartados', metrics.dismissed], ['Custo total', `$${metrics.cost.toFixed(2)}`]].map(([k, v]) => (
          <div key={k as string} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-black text-[#8B2214] tabular-nums">{v as any}</div>
            <div className="text-xs text-gray-500 mt-1">{k as string}</div>
          </div>
        ))}
      </div>

      {/* Resultados */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Resultados ({results.length})</h4>
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['Resultado', 'Tipo', 'Keyword', 'Local', 'Prioridade', 'Status', 'Ações'].map(h => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Nenhum resultado ainda. Rode uma busca acima.</td></tr>}
              {results.map(r => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2"><div className="font-medium text-gray-900 line-clamp-1">{r.title || '(sem título)'}</div>{r.description && <div className="text-xs text-gray-400 line-clamp-1">{r.description}</div>}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1 text-xs text-gray-600">{TYPE_ICON[r.result_type] || null}{r.result_type.replace('PUBLIC_', '').replace('_', ' ').toLowerCase()}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.keyword || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{[r.city, r.state].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-3 py-2">
                    {r.score != null && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.score >= 70 ? 'bg-red-50 text-red-700' : r.score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{priorityLabel(r.score)} · {r.score}</span>}
                  </td>
                  <td className="px-3 py-2"><span className="text-xs font-medium text-gray-600">{STATUS_PT[r.status] || r.status}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {r.public_url && <a href={r.public_url} target="_blank" rel="noopener noreferrer" title="Abrir link" className="p-1 text-gray-400 hover:text-[#8B2214]"><ExternalLink className="w-4 h-4" /></a>}
                      <button onClick={() => setStatus(r.id, 'approved')} title="Aprovar" className="p-1 text-gray-400 hover:text-green-600"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setStatus(r.id, 'dismissed')} title="Descartar" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de buscas */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Histórico de buscas</h4>
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['Data', 'Fonte', 'Actor', 'Região', 'Keywords', 'Status', 'Resultados', 'Custo'].map(h => <th key={h} className="text-left font-semibold px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {runs.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Sem buscas ainda.</td></tr>}
              {runs.map(r => (
                <tr key={r.id} className="border-t border-gray-100 text-xs">
                  <td className="px-3 py-2 text-gray-500">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2">{r.source_type || '—'}</td>
                  <td className="px-3 py-2 text-gray-400">{r.actor_id || '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{[r.municipio, r.uf, r.country].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{(r.keywords || []).join(', ')}</td>
                  <td className="px-3 py-2"><span className={`font-medium ${r.status === 'done' ? 'text-green-600' : r.status === 'no_credit' || r.status === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>{r.status}</span></td>
                  <td className="px-3 py-2 text-gray-700">{r.result_count ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{r.cost_actual_usd != null ? `$${r.cost_actual_usd}` : 'n/d'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
