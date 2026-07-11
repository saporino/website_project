import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Loader2, Search, Coffee, ExternalLink, Settings, Check, Smartphone } from 'lucide-react';

const BRAND = '#B03220';
const SEGS: { key: string; label: string }[] = [
  { key: 'torrado_moido', label: 'Torrado e moído' },
  { key: 'graos', label: 'Em grãos' },
  { key: 'soluvel', label: 'Solúvel' },
];
const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const median = (arr: number[]) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

interface Row {
  id: number; listing_sku: string; title: string; thumb_url: string | null; url: string | null;
  price: number; price_before: number | null; discount_pct: number | null;
  weight_g: number | null; unit_type: string | null; is_arabica: boolean; price_per_kg: number | null;
  is_suspect: boolean; is_sponsored: boolean; captured_at: string;
}

export default function EcommercePriceIntel({ marketplace, label, readOnly = false }: { marketplace: string; label: string; readOnly?: boolean }) {
  const isSuper = marketplace.startsWith('super_'); // supermercado VTEX (não Apify)
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [seg, setSeg] = useState('torrado_moido');
  const [onlyArabica, setOnlyArabica] = useState(false);
  const [q, setQ] = useState('');
  // Preço Saporino persistido: digita 1x e vale pra TODOS os marketplaces (e ao recarregar).
  const [sapPrice, setSapPrice] = useState(() => localStorage.getItem('saporino-eprice') || '');
  const [sapWeight, setSapWeight] = useState(() => localStorage.getItem('saporino-eweight') || '500');
  useEffect(() => { localStorage.setItem('saporino-eprice', sapPrice); }, [sapPrice]);
  useEffect(() => { localStorage.setItem('saporino-eweight', sapWeight); }, [sapWeight]);
  // config da fonte (ator + input) — editável pelo admin
  const [showCfg, setShowCfg] = useState(false);
  const [cfgActor, setCfgActor] = useState('');
  const [cfgInput, setCfgInput] = useState('');
  const [cfgVtex, setCfgVtex] = useState(''); // domínio VTEX (supermercado)
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');
  // liga/desliga: o representante vê (ou não) esta fonte no app do celular
  const [visibleToReps, setVisibleToReps] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data }, { data: src }] = await Promise.all([
      supabase.from('vw_ecommerce_latest').select('*').eq('marketplace', marketplace),
      supabase.from('ecommerce_sources').select('*').eq('marketplace', marketplace).maybeSingle(),
    ]);
    setRows((data as Row[]) || []);
    if (src) {
      setCfgActor((src as any).actor_id || '');
      setCfgInput((src as any).default_input ? JSON.stringify((src as any).default_input, null, 2) : '');
      setCfgEnabled(!!(src as any).enabled);
      setVisibleToReps(!!(src as any).visible_to_reps);
      setCfgVtex((src as any).default_input?.vtex_base || '');
    }
    setLoading(false);
  }

  async function toggleVisibleToReps() {
    setTogglingVis(true);
    const next = !visibleToReps;
    const { error } = await supabase.from('ecommerce_sources')
      .update({ visible_to_reps: next, updated_at: new Date().toISOString() }).eq('marketplace', marketplace);
    if (!error) setVisibleToReps(next);
    setTogglingVis(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [marketplace]);

  async function saveConfig() {
    setSavingCfg(true); setCfgMsg('');
    if (isSuper) {
      if (!cfgVtex.trim()) { setCfgMsg('Informe o domínio VTEX da rede (ex.: https://www.atacadao.com.br).'); setSavingCfg(false); return; }
      const { error } = await supabase.from('ecommerce_sources').update({
        default_input: { vtex_base: cfgVtex.trim().replace(/\/+$/, ''), terms: ['café'], pages: 6 },
        enabled: cfgEnabled, updated_at: new Date().toISOString(),
      }).eq('marketplace', marketplace);
      setCfgMsg(error ? 'Erro: ' + error.message : 'Domínio salvo! Agora clique em "Atualizar agora".');
      setSavingCfg(false); return;
    }
    let parsed: any = null;
    if (cfgInput.trim()) {
      try { parsed = JSON.parse(cfgInput); } catch { setCfgMsg('O Input não é um JSON válido — copie certinho da aba "Input" do Apify.'); setSavingCfg(false); return; }
    }
    const { error } = await supabase.from('ecommerce_sources').update({
      actor_id: cfgActor.trim() || null, default_input: parsed, enabled: cfgEnabled, updated_at: new Date().toISOString(),
    }).eq('marketplace', marketplace);
    setCfgMsg(error ? 'Erro: ' + error.message : 'Fonte salva! Agora clique em "Atualizar agora".');
    setSavingCfg(false);
  }

  async function refresh() {
    setRefreshing(true); setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = isSuper ? 'vtex-scrape' : 'ecommerce-scrape';
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ marketplace }),
      });
      const r = await res.json();
      if (r.error === 'not_configured') setMsg(isSuper ? 'Rede sem domínio VTEX configurado. Clique em "Fonte" e cole o domínio.' : 'Fonte ainda sem ator/input configurado. Me passe o Actor ID + Input do Apify que eu ligo.');
      else if (r.error === 'no_credit') setMsg('Crédito Apify esgotado este mês.');
      else if (r.inserted === 0) setMsg('Nenhum produto retornado (confira o domínio/termos).');
      else if (r.error) setMsg('Erro: ' + (r.message || r.error));
      else { setMsg(`Coletados ${r.inserted} anúncios.`); await load(); }
    } catch (e) { setMsg('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setRefreshing(false);
  }

  const lastCapture = rows[0]?.captured_at ? new Date(rows[0].captured_at).toLocaleString('pt-BR') : null;

  // ranking do segmento: exclui suspeitos e filtro; cápsula tratada à parte
  const segRows = useMemo(() => rows
    .filter(r => r.unit_type === seg && !r.is_suspect && r.price_per_kg != null)
    .filter(r => !onlyArabica || r.is_arabica)
    .filter(r => !q || r.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.price_per_kg || 0) - (a.price_per_kg || 0)), [rows, seg, onlyArabica, q]);

  const spks = segRows.map(r => r.price_per_kg!).filter(Boolean);
  const med = median(spks);
  const lo = spks.length ? Math.min(...spks) : 0;
  const hi = spks.length ? Math.max(...spks) : 0;
  const promoPct = segRows.length ? Math.round(100 * segRows.filter(r => (r.discount_pct || 0) > 0).length / segRows.length) : 0;

  const sapP = parseFloat(sapPrice.replace(',', '.')) || 0;
  const sapW = parseFloat(sapWeight.replace(',', '.')) || 0;
  const sapSpk = sapP && sapW ? +(sapP / (sapW / 1000)).toFixed(2) : 0;
  const pos = (v: number) => hi > lo ? Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)) : 50;
  const sapVsMed = med && sapSpk ? Math.round(((sapSpk - med) / med) * 100) : 0;

  const counts = useMemo(() => ({
    total: rows.length, sponsored: rows.filter(r => r.is_sponsored).length,
    capsula: rows.filter(r => r.unit_type === 'capsula').length, suspect: rows.filter(r => r.is_suspect).length,
  }), [rows]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin" style={{ color: BRAND }} /></div>;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Inteligência de preços — {label}</h3>
          <p className="text-sm text-gray-500">{rows.length} anúncios no último lote{lastCapture ? ` · coletado ${lastCapture}` : ' · nenhuma coleta ainda'}</p>
        </div>
        {!readOnly && (
        <div className="flex items-center gap-2">
          <button onClick={toggleVisibleToReps} disabled={togglingVis} title="Liga/desliga: o representante vê estes preços no app do celular"
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border disabled:opacity-50 ${visibleToReps ? 'bg-green-600 border-green-600 text-white hover:bg-green-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {togglingVis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} {visibleToReps ? 'Rep vê ✓' : 'Rep não vê'}
          </button>
          <button onClick={() => setShowCfg(v => !v)} className="inline-flex items-center gap-1.5 text-gray-600 border border-gray-300 hover:bg-gray-50 text-sm font-semibold px-3 py-2 rounded-lg">
            <Settings className="w-4 h-4" /> Fonte {cfgEnabled ? '✓' : ''}
          </button>
          <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar agora
          </button>
        </div>
        )}
      </div>
      {msg && <p className="text-xs p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">{msg}</p>}

      {/* Configuração da fonte (Apify) — cole o Actor ID + Input e ligue */}
      {showCfg && isSuper && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Configurar fonte do {label} (VTEX)</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Domínio VTEX <span className="text-gray-400">(ex.: https://www.atacadao.com.br)</span></label>
            <input value={cfgVtex} onChange={e => setCfgVtex(e.target.value)} placeholder="https://www.rede.com.br" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={cfgEnabled} onChange={e => setCfgEnabled(e.target.checked)} /> Ativar coleta desta rede
          </label>
          <div className="flex items-center gap-2">
            <button onClick={saveConfig} disabled={savingCfg} className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>
              {savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar fonte
            </button>
            {cfgMsg && <span className="text-xs text-gray-600">{cfgMsg}</span>}
          </div>
          <p className="text-[11px] text-gray-400">Usa a <strong>API pública de catálogo da VTEX</strong> (sem Apify, sem token). Funciona só em redes na plataforma VTEX.</p>
        </div>
      )}
      {showCfg && !isSuper && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Configurar fonte do {label} (Apify)</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Actor ID <span className="text-gray-400">(formato dono~nome — ex.: viralanalyzer~amazon-brazil-intelligence)</span></label>
            <input value={cfgActor} onChange={e => setCfgActor(e.target.value)} placeholder="dono~nome" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Input (JSON da aba "Input" do Apify)</label>
            <textarea value={cfgInput} onChange={e => setCfgInput(e.target.value)} rows={6} placeholder='{ "search": "café", ... }' className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={cfgEnabled} onChange={e => setCfgEnabled(e.target.checked)} /> Ativar coleta deste marketplace
          </label>
          <div className="flex items-center gap-2">
            <button onClick={saveConfig} disabled={savingCfg} className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>
              {savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar fonte
            </button>
            {cfgMsg && <span className="text-xs text-gray-600">{cfgMsg}</span>}
          </div>
          <p className="text-[11px] text-gray-400">O <strong>token do Apify</strong> NÃO vai aqui — ele já está guardado em segredo no servidor. Aqui é só o ator e os termos de busca.</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          {readOnly
            ? <>Ainda sem preços coletados para {label}. Assim que houver dados, eles aparecem aqui.</>
            : isSuper
              ? <>Nenhuma coleta ainda. Clique em <strong>Atualizar agora</strong> (precisa do domínio VTEX configurado em <strong>Fonte</strong> para {label}).</>
              : <>Nenhuma coleta ainda. Clique em <strong>Atualizar agora</strong> (precisa do ator do Apify configurado para {label}).</>}
        </div>
      ) : (
        <>
          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              {SEGS.map(s => <button key={s.key} onClick={() => setSeg(s.key)} className={`px-3 py-1.5 text-sm ${seg === s.key ? 'text-white' : 'text-gray-600'}`} style={seg === s.key ? { background: BRAND } : {}}>{s.label}</button>)}
            </div>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={onlyArabica} onChange={e => setOnlyArabica(e.target.checked)} /> Só 100% arábica</label>
            <div className="relative ml-auto">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm" />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Kpi label="Anúncios" value={String(segRows.length)} />
            <Kpi label="Mediana R$/kg" value={brl(med)} />
            <Kpi label="Faixa R$/kg" value={`${brl(lo)} – ${brl(hi)}`} small />
            <Kpi label="Em promoção" value={`${promoPct}%`} />
            <Kpi label="Saporino vs mediana" value={sapSpk ? `${sapVsMed > 0 ? '+' : ''}${sapVsMed}%` : '—'} color={sapVsMed > 0 ? '#b45309' : '#16a34a'} />
          </div>

          {/* Régua R$/kg com Saporino editável */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">Seu preço Saporino:</span>
              <input value={sapPrice} onChange={e => setSapPrice(e.target.value)} placeholder="R$ pacote" className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
              <span className="text-xs text-gray-400">por</span>
              <input value={sapWeight} onChange={e => setSapWeight(e.target.value)} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
              <span className="text-xs text-gray-400">g</span>
              {sapSpk > 0 && <span className="text-sm font-bold" style={{ color: BRAND }}>= {brl(sapSpk)}/kg</span>}
            </div>
            <div className="relative h-10">
              <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-green-300 via-amber-300 to-red-400" />
              {med > 0 && <Mark pct={pos(med)} color="#6b7280" labelTop="mediana" labelBottom={brl(med)} />}
              {sapSpk > 0 && <Mark pct={pos(sapSpk)} color={BRAND} labelTop="Saporino" labelBottom={brl(sapSpk)} big />}
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1"><span>{brl(lo)}/kg</span><span>{brl(hi)}/kg</span></div>
          </div>

          {/* Ranking caro -> barato */}
          <div className="space-y-1.5">
            {segRows.slice(0, 60).map(r => {
              const here = sapSpk > 0 && (r.price_per_kg || 0) <= sapSpk;
              return (
                <div key={r.id}>
                  {here && sapSpk > 0 && !segRows.slice(0, segRows.indexOf(r)).some(x => (x.price_per_kg || 0) <= sapSpk) && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-1.5 text-white text-sm font-bold" style={{ background: BRAND }}>
                      <Coffee className="w-4 h-4" /> Saporino aqui · {brl(sapSpk)}/kg
                    </div>
                  )}
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2">
                    {r.thumb_url ? <img src={r.thumb_url} referrerPolicy="no-referrer" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} className="w-10 h-10 rounded object-cover flex-shrink-0" /> : <span className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">☕</span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                        {r.is_arabica && <span className="rounded-full bg-amber-100 text-amber-800 px-1.5">arábica</span>}
                        {r.is_sponsored && <span className="rounded-full bg-gray-100 text-gray-500 px-1.5">patrocinado</span>}
                        {(r.discount_pct || 0) > 0 && <span className="rounded-full bg-green-100 text-green-700 px-1.5">-{r.discount_pct}%</span>}
                        <span className="text-gray-400">{brl(r.price)} · {r.weight_g ? `${r.weight_g}g` : '?'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{brl(r.price_per_kg || 0)}</p>
                      <p className="text-[10px] text-gray-400">/kg</p>
                    </div>
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-gray-600"><ExternalLink className="w-4 h-4" /></a>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé de qualidade */}
          <p className="text-[11px] text-gray-400">Lote: {counts.total} anúncios · {counts.sponsored} patrocinados · {counts.capsula} cápsulas (fora da régua) · {counts.suspect} com peso suspeito (excluídos).</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, small, color }: { label: string; value: string; small?: boolean; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`font-bold text-gray-900 ${small ? 'text-xs' : 'text-lg'}`} style={color ? { color } : {}}>{value}</p>
    </div>
  );
}
function Mark({ pct, color, labelTop, labelBottom, big }: { pct: number; color: string; labelTop: string; labelBottom: string; big?: boolean }) {
  return (
    <div className="absolute top-0 bottom-0" style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}>
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap font-semibold" style={{ color }}>{labelTop}</div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ width: big ? 16 : 11, height: big ? 16 : 11, background: color }} />
      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ color }}>{labelBottom}</div>
    </div>
  );
}
