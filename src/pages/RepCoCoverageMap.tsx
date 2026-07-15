import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Lock, Store, Target, Loader2, Users, Search } from 'lucide-react';
import { normName, distMeters } from '../lib/leadMatch';
import { SEGMENT_LABEL } from '../constants/segments';
import { importApifyLeads } from '../lib/importApifyLeads';
import ApifyRunModal, { type ApifyStartParams } from '../components/repco/ApifyRunModal';

const PRIMARY = '#8B2214';
const GREEN = '#16a34a', GRAY = '#9ca3af';
const REP_PALETTE = ['#8B2214', '#1d6fa4', '#6a1a8a', '#b45309', '#0e5f6b', '#7b2d00', '#1a3a6b', '#9d174d'];
const STATUS_COLOR: Record<string, string> = {
  assigned: '#f59e0b', new: '#f59e0b', pending_visit: '#2563eb', in_progress: '#2563eb',
  visited: '#0891b2', qualified: '#7c3aed',
};
const STATE_UF: Record<string, string> = {
  'sao paulo': 'SP', 'minas gerais': 'MG', 'rio de janeiro': 'RJ', 'parana': 'PR', 'santa catarina': 'SC', 'rio grande do sul': 'RS',
};
const toUf = (s?: string | null) => { const t = (s || '').trim(); if (t.length === 2) return t.toUpperCase(); return STATE_UF[normName(t)] || ''; };
const DEAD = ['rejected', 'invalid', 'duplicate'];

interface City { nome: string; nome_norm: string; lat: number; lng: number; }
interface ClienteGeo { id: string; nome: string | null; municipio: string | null; uf: string | null; lat: number; lng: number; }
interface Lead { id: string; company_name: string; trade_name: string | null; municipio: string | null; state: string | null; lat: number; lng: number; status: string; rep_id: string | null; rep_nome: string | null; prospect_list_id: string; }

function goBack() { window.history.pushState({}, '', '/repco/inteligencia'); window.dispatchEvent(new PopStateEvent('popstate')); }
const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">{children}</div>
);

function MapClicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}
function MapController({ target, home, homeZoom }: { target: [number, number] | null; home: [number, number]; homeZoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 12, { duration: 0.8 });
    else map.flyTo(home, homeZoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target ? target[0] : null, target ? target[1] : null]);
  return null;
}

export default function RepCoCoverageMap() {
  const { profile, loading } = useAuth();
  const [uf] = useState('SP');
  const [cities, setCities] = useState<City[]>([]);
  const [clientes, setClientes] = useState<ClienteGeo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [listSeg, setListSeg] = useState<Record<string, string | null>>({}); // prospect_list_id -> segment
  const [busy, setBusy] = useState(true);
  const [colorMode, setColorMode] = useState<'rep' | 'status'>('rep');
  const [showLeads, setShowLeads] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [enabledReps, setEnabledReps] = useState<Set<string>>(new Set());
  const [sectorFilter, setSectorFilter] = useState('');
  const [selCity, setSelCity] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [msg, setMsg] = useState('');
  const [showApify, setShowApify] = useState(false);
  const [apifyBusy, setApifyBusy] = useState(false);
  const [apifyRun, setApifyRun] = useState<{ runId: string; status: string; params: ApifyStartParams } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let active = true;
    (async () => {
      setBusy(true);
      const fetchLeads = async () => {
        const PAGE = 1000, CAP = 8000; let out: Lead[] = [];
        for (let from = 0; from < CAP; from += PAGE) {
          const { data } = await supabase.from('vw_repco_leads_geo').select('*').range(from, from + PAGE - 1);
          const rows = (data as Lead[]) || []; out = out.concat(rows);
          if (rows.length < PAGE) break;
        }
        return out;
      };
      const [ci, cl, lg, pl] = await Promise.all([
        supabase.from('ibge_municipios').select('nome,nome_norm,lat,lng').eq('uf', uf),
        supabase.from('vw_repco_clientes_geo').select('*').eq('uf', uf),
        fetchLeads(),
        supabase.from('prospect_lists').select('id,segment'),
      ]);
      if (!active) return;
      setCities((ci.data as City[] || []).filter(c => c.lat != null && c.lng != null));
      setClientes((cl.data as ClienteGeo[]) || []);
      const allLeads = (lg || []).filter(l => toUf(l.state) === uf);
      setLeads(allLeads);
      setListSeg(Object.fromEntries(((pl.data as any[]) || []).map(l => [l.id, l.segment])));
      setEnabledReps(new Set(allLeads.map(l => l.rep_id || 'sem').filter(Boolean) as string[]));
      setBusy(false);
    })();
    return () => { active = false; };
  }, [profile?.is_admin, uf, reloadKey]);

  const leadSector = (l: Lead) => listSeg[l.prospect_list_id] || 'outro';

  const reps = useMemo(() => {
    const m = new Map<string, string>();
    leads.forEach(l => { if (l.rep_id) m.set(l.rep_id, l.rep_nome || 'Rep'); });
    return [...m.entries()].map(([id, nome], i) => ({ id, nome, color: REP_PALETTE[i % REP_PALETTE.length] }));
  }, [leads]);
  const repColor = (id: string | null) => reps.find(r => r.id === id)?.color || PRIMARY;
  function leadColor(l: Lead): string {
    if (l.status === 'converted') return GREEN;
    if (DEAD.includes(l.status)) return GRAY;
    return colorMode === 'rep' ? repColor(l.rep_id) : (STATUS_COLOR[l.status] || PRIMARY);
  }

  // setores presentes nos leads (alimenta o filtro)
  const sectorOptions = useMemo<[string, number][]>(() => {
    const m = new Map<string, number>();
    leads.forEach(l => { const s = leadSector(l); m.set(s, (m.get(s) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, listSeg]);

  const shownLeads = useMemo(() => leads.filter(l =>
    showLeads && enabledReps.has(l.rep_id || '') && (!sectorFilter || leadSector(l) === sectorFilter)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, showLeads, enabledReps, sectorFilter, listSeg]);

  const totals = useMemo(() => ({
    leads: shownLeads.length, clientes: clientes.length,
    cidadesComLead: new Set(leads.map(l => normName(l.municipio))).size,
  }), [shownLeads, clientes, leads]);

  // Semáforo por cidade: verde = tem cliente · amarelo = já buscada (tem lead) · vermelho = a buscar
  const cityClientSet = useMemo(() => new Set(clientes.map(c => normName(c.municipio))), [clientes]);
  const cityLeadSet = useMemo(() => new Set(leads.map(l => normName(l.municipio))), [leads]);
  const cityStatus = (c: City) => {
    if (cityClientSet.has(c.nome_norm)) return { color: GREEN, r: 6, label: 'cliente' };
    if (cityLeadSet.has(c.nome_norm)) return { color: '#f59e0b', r: 5, label: 'já buscada' };
    return { color: '#dc2626', r: 3, label: 'a buscar' };
  };

  const center: [number, number] = [-22.5, -48.5];
  const selectedCoords = useMemo<[number, number] | null>(() => {
    if (!selCity) return null;
    const c = cities.find(x => x.nome === selCity);
    return c ? [c.lat, c.lng] : null;
  }, [selCity, cities]);

  const citiesFiltered = useMemo(() => {
    const q = normName(citySearch);
    return q ? cities.filter(c => c.nome_norm.includes(q)).slice(0, 80) : [];
  }, [cities, citySearch]);

  // clique no mapa -> cidade mais próxima (até ~25 km)
  function handleMapPick(lat: number, lng: number) {
    let best: City | null = null, bestD = Infinity;
    for (const c of cities) { const d = distMeters([lat, lng], [c.lat, c.lng]); if (d < bestD) { bestD = d; best = c; } }
    if (best && bestD < 25000) { setSelCity(best.nome); setMsg(''); }
  }

  async function callApify(payload: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apify-places`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function handleApifyStart(params: ApifyStartParams) {
    setApifyBusy(true); setMsg('');
    try {
      const { data: prev } = await supabase.from('prospect_runs')
        .select('id,created_at,leads_created').eq('municipio', params.municipio).eq('category', params.category)
        .eq('status', 'done').order('created_at', { ascending: false }).limit(1);
      if (prev && prev.length) {
        const r0 = prev[0] as any;
        const dt = String(r0.created_at).slice(0, 10).split('-').reverse().join('/');
        if (!confirm(`Já buscamos "${params.category}" em ${params.municipio} (${dt}, ${r0.leads_created ?? '?'} leads).\n\nOs leads já estão na Prospecção. Buscar de novo vai gastar crédito.\n\nQuer buscar de novo mesmo assim?`)) {
          setMsg(`"${params.category}" em ${params.municipio} já foi buscado (${dt}). Os leads estão na Prospecção — sem gastar de novo.`);
          return;
        }
      }
      const r = await callApify({ action: 'start', ...params });
      if (r.error) {
        if (r.error === 'budget') setMsg('Orçamento mensal do Apify atingido — ' + (r.message || ''));
        else if (r.error === 'no_credit') setMsg('Crédito Apify do mês esgotado.');
        else setMsg('Erro ao disparar Apify: ' + (r.message || r.error));
        return;
      }
      setShowApify(false);
      setApifyRun({ runId: r.runId, status: 'running', params });
      setMsg(`Busca disparada (~${r.placesEstimate} lugares ≈ US$ ${r.cost}). Importo e aviso ao terminar — pode continuar usando o mapa.`);
    } finally { setApifyBusy(false); }
  }

  useEffect(() => {
    if (!apifyRun || apifyRun.status !== 'running') return;
    let alive = true;
    const tick = async () => {
      const r = await callApify({ action: 'status', runId: apifyRun.runId });
      if (!alive) return;
      if (r.status === 'running') return;
      if (r.status === 'succeeded') {
        try {
          const res = await importApifyLeads({
            items: r.items, uf: apifyRun.params.uf, municipio: apifyRun.params.municipio,
            category: apifyRun.params.category, segment: apifyRun.params.segment, runId: apifyRun.runId,
          });
          setMsg(`✓ ${res.criados} leads reais de ${apifyRun.params.municipio} no pool${res.ignorados ? ` · ${res.ignorados} repetidos` : ''}${res.fora ? ` · ${res.fora} fora da cidade (descartados)` : ''}. Vá em Prospecção → Atribuir pools pra distribuir aos reps.`);
          setReloadKey(k => k + 1);
        } catch (e) { setMsg('Apify importou com erro: ' + (e instanceof Error ? e.message : String(e))); }
        setApifyRun(null);
      } else if (r.status === 'no_credit') { setMsg('Crédito Apify esgotado durante o run.'); setApifyRun(null); }
      else { setMsg('Run Apify falhou: ' + (r.message || r.status)); setApifyRun(null); }
    };
    const id = setInterval(tick, 6000); tick();
    return () => { alive = false; clearInterval(id); };
  }, [apifyRun]);

  if (loading) return <Center><Loader2 className="w-9 h-9 animate-spin" style={{ color: PRIMARY }} /></Center>;
  if (!profile?.is_admin) return (
    <Center>
      <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm">
        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">Mapa de prospecção</h2>
        <p className="text-sm text-gray-500 mt-1">Acesso restrito a administradores.</p>
      </div>
    </Center>
  );

  const leadsNaCidade = selCity ? leads.filter(l => normName(l.municipio) === normName(selCity)).length : 0;

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Mapa de prospecção</h1>
            <p className="text-sm text-gray-500">Busque leads reais no Google (Apify) por cidade e setor · clientes e leads em trabalho no mapa</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={<Users className="w-4 h-4" style={{ color: PRIMARY }} />} label="Leads em trabalho" value={String(totals.leads)} />
          <Kpi icon={<Target className="w-4 h-4 text-blue-600" />} label="Cidades com lead" value={String(totals.cidadesComLead)} />
          <Kpi icon={<Store className="w-4 h-4 text-green-600" />} label="Clientes ativos" value={String(totals.clientes)} />
        </div>

        {/* Controles */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showLeads} onChange={e => setShowLeads(e.target.checked)} className="rounded" /> Leads no mapa</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showCities} onChange={e => setShowCities(e.target.checked)} className="rounded" /> Pontos de cidade</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Setor:</span>
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
              <option value="">Todos ({leads.length})</option>
              {sectorOptions.map(([s, n]) => <option key={s} value={s}>{SEGMENT_LABEL[s] || s} ({n})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Colorir:</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setColorMode('rep')} className={`px-2.5 py-1 ${colorMode === 'rep' ? 'bg-[#8B2214] text-white' : 'text-gray-600'}`}>por rep</button>
              <button onClick={() => setColorMode('status')} className={`px-2.5 py-1 ${colorMode === 'status' ? 'bg-[#8B2214] text-white' : 'text-gray-600'}`}>por status</button>
            </div>
          </div>
        </div>

        {busy ? <Center><Loader2 className="w-9 h-9 animate-spin" style={{ color: PRIMARY }} /></Center> : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-3">
              <div className="rounded-lg overflow-hidden border border-gray-100" style={{ height: 500 }}>
                <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClicker onPick={handleMapPick} />
                  <MapController target={selectedCoords} home={center} homeZoom={7} />
                  {/* pontos de cidade — semáforo (vermelho=a buscar, amarelo=já buscada, verde=cliente) */}
                  {showCities && cities.map(c => {
                    const st = cityStatus(c); const sel = selCity === c.nome;
                    return (
                      <CircleMarker key={`city-${c.nome}`} center={[c.lat, c.lng]} radius={sel ? st.r + 3 : st.r}
                        pathOptions={{ color: sel ? PRIMARY : st.color, fillColor: st.color, fillOpacity: sel ? 0.9 : 0.55, weight: sel ? 2 : 1 }}
                        eventHandlers={{ click: () => { setSelCity(c.nome); setMsg(''); } }}>
                        <Tooltip>{c.nome} — {st.label}</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* leads em trabalho (cor por rep/status) */}
                  {shownLeads.map(l => {
                    const col = leadColor(l);
                    return (
                      <CircleMarker key={`l-${l.id}`} center={[l.lat, l.lng]} radius={5}
                        pathOptions={{ color: col, fillColor: col, fillOpacity: 0.85, weight: 1 }}>
                        <Tooltip>{l.trade_name || l.company_name} · {SEGMENT_LABEL[leadSector(l)] || leadSector(l)} · {l.rep_nome || 'sem rep'} · {l.status}</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* clientes ativos (verde) */}
                  {clientes.map(cl => (
                    <CircleMarker key={`c-${cl.id}`} center={[cl.lat, cl.lng]} radius={6}
                      pathOptions={{ color: GREEN, fillColor: GREEN, fillOpacity: 0.95, weight: 2 }}>
                      <Tooltip>{cl.nome || 'Cliente'} (cliente ativo)</Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#dc2626' }} /> cidade a buscar</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f59e0b' }} /> já buscada (na prospecção)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: GREEN }} /> cidade com cliente</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: PRIMARY }} /> lead em trabalho</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5"><strong>Clique numa cidade</strong> (ou busque pelo nome) → escolha o setor e a quantidade → <strong>Buscar no Apify</strong>. Os leads reais aparecem no mapa e vão pro pool da Prospecção. © OpenStreetMap contributors.</p>
            </div>

            {/* Painel lateral */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              {!selCity ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-2">Escolha a cidade</h3>
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="Buscar cidade de SP…"
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5 max-h-[430px] overflow-y-auto">
                    {citySearch.trim() === '' && <p className="text-[11px] text-gray-400">Digite o nome da cidade ou clique num ponto no mapa. {cities.length} cidades de SP.</p>}
                    {citiesFiltered.map(c => (
                      <button key={c.nome} onClick={() => { setSelCity(c.nome); setMsg(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 text-sm text-gray-800">
                        {c.nome}
                      </button>
                    ))}
                    {citySearch.trim() !== '' && citiesFiltered.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">Nenhuma cidade com "{citySearch}".</p>}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => { setSelCity(null); setMsg(''); }} className="text-xs text-gray-500 hover:text-gray-800 mb-2">← trocar cidade</button>
                  <h3 className="font-bold text-gray-900">{selCity}/{uf}</h3>
                  <p className="text-sm text-gray-500 mb-3">{leadsNaCidade > 0 ? `${leadsNaCidade} leads já no pool desta cidade` : 'Nenhum lead ainda nesta cidade'}</p>

                  <button onClick={() => setShowApify(true)} disabled={!!apifyRun}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg mb-2">
                    {apifyRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {apifyRun ? 'Buscando no Google…' : 'Buscar leads reais (Apify)'}
                  </button>
                  <p className="text-[11px] text-gray-400 mb-2">Escolha o setor e a quantidade na próxima tela. O Google traz nome, endereço e telefone reais. Depois é só ir em <strong>Prospecção → Atribuir pools</strong> pra distribuir aos reps por setor e quantidade.</p>
                  {msg && <p className="text-xs mb-3 p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">{msg}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showApify && selCity && (
        <ApifyRunModal uf={uf} municipio={selCity} busy={apifyBusy}
          onStart={handleApifyStart} onClose={() => setShowApify(false)} />
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] flex items-center justify-center">{icon}</span>
      <p className="text-xs text-gray-500 mt-2">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
