import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Lock, MapPin, Store, Target, Loader2, Plus, Users } from 'lucide-react';
import { promoteMunicipio, addProspectsToList } from '../lib/promoteProspects';
import { leadMatchesProspect, normName } from '../lib/leadMatch';

const PRIMARY = '#8B2214';
const GREEN = '#16a34a', GRAY = '#9ca3af', ORANGE = '#f59e0b', RED = '#dc2626';
const REP_PALETTE = ['#8B2214', '#1d6fa4', '#6a1a8a', '#b45309', '#0e5f6b', '#7b2d00', '#1a3a6b', '#9d174d'];
const STATUS_COLOR: Record<string, string> = {
  assigned: '#f59e0b', new: '#f59e0b', pending_visit: '#2563eb', in_progress: '#2563eb',
  visited: '#0891b2', qualified: '#7c3aed',
};
const STATE_UF: Record<string, string> = {
  'sao paulo': 'SP', 'minas gerais': 'MG', 'rio de janeiro': 'RJ', 'parana': 'PR', 'santa catarina': 'SC',
  'rio grande do sul': 'RS', 'bahia': 'BA', 'goias': 'GO', 'espirito santo': 'ES', 'distrito federal': 'DF',
  'ceara': 'CE', 'pernambuco': 'PE', 'para': 'PA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
};
const toUf = (s?: string | null) => { const t = (s || '').trim(); if (t.length === 2) return t.toUpperCase(); return STATE_UF[normName(t)] || ''; };

interface Cobertura { uf: string; municipio: string; clientes: number; prospects: number; prospects_nao_clientes: number; lat: number | null; lng: number | null; }
interface ClienteGeo { id: string; nome: string | null; municipio: string | null; uf: string | null; lat: number; lng: number; }
interface Prospect { id: string; cnpj: string; razao_social: string | null; nome_fantasia: string | null; cnae_principal: string | null; cnae_descricao: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; municipio: string | null; uf: string | null; cep: string | null; telefone: string | null; email: string | null; lat: number | null; lng: number | null; is_client: boolean; }
interface Lead { id: string; company_name: string; trade_name: string | null; cnpj: string | null; municipio: string | null; state: string | null; lat: number; lng: number; status: string; rep_id: string | null; rep_nome: string | null; prospect_list_id: string; }

function goBack() { window.history.pushState({}, '', '/repco/inteligencia'); window.dispatchEvent(new PopStateEvent('popstate')); }
const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">{children}</div>
);
const DEAD = ['rejected', 'invalid', 'duplicate'];

export default function RepCoCoverageMap() {
  const { profile, loading } = useAuth();
  const [uf, setUf] = useState('SP');
  const [cobertura, setCobertura] = useState<Cobertura[]>([]);
  const [clientes, setClientes] = useState<ClienteGeo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(true);
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [colorMode, setColorMode] = useState<'rep' | 'status'>('rep');
  const [showLeads, setShowLeads] = useState(true);
  const [enabledReps, setEnabledReps] = useState<Set<string>>(new Set());
  const [selMuni, setSelMuni] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loadingMuni, setLoadingMuni] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!profile?.is_admin) return;
    let active = true;
    (async () => {
      setBusy(true); setSelMuni(null); setProspects([]);
      // leads pode passar de 1000 (cap do PostgREST) -> pagina via range() até um teto.
      const fetchLeads = async () => {
        const PAGE = 1000, CAP = 8000; let out: Lead[] = [];
        for (let from = 0; from < CAP; from += PAGE) {
          const { data } = await supabase.from('vw_repco_leads_geo').select('*').range(from, from + PAGE - 1);
          const rows = (data as Lead[]) || []; out = out.concat(rows);
          if (rows.length < PAGE) break;
        }
        return out;
      };
      const [c, cl, lg] = await Promise.all([
        supabase.from('vw_repco_cobertura').select('*').eq('uf', uf),
        supabase.from('vw_repco_clientes_geo').select('*').eq('uf', uf),
        fetchLeads(),
      ]);
      if (!active) return;
      setCobertura((c.data as Cobertura[]) || []);
      setClientes((cl.data as ClienteGeo[]) || []);
      const allLeads = (lg || []).filter(l => toUf(l.state) === uf);
      setLeads(allLeads);
      setEnabledReps(new Set(allLeads.map(l => l.rep_id || 'sem').filter(Boolean) as string[]));
      setBusy(false);
    })();
    return () => { active = false; };
  }, [profile?.is_admin, uf]);

  // representantes (com lead no mapa) + cor
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

  const shownLeads = useMemo(() => leads.filter(l => showLeads && enabledReps.has(l.rep_id || '')), [leads, showLeads, enabledReps]);

  const shownBubbles = useMemo(() => {
    const withCoords = cobertura.filter(c => c.lat != null && c.lng != null);
    return onlyGaps ? withCoords.filter(c => c.clientes === 0 && c.prospects > 0) : withCoords;
  }, [cobertura, onlyGaps]);

  const totals = useMemo(() => ({
    prospects: cobertura.reduce((s, c) => s + c.prospects, 0),
    municipios: cobertura.filter(c => c.prospects > 0).length,
    buracos: cobertura.filter(c => c.prospects > 0 && c.clientes === 0).length,
    clientes: clientes.length,
    leads: leads.length,
  }), [cobertura, clientes, leads]);

  const maxP = Math.max(...shownBubbles.map(c => c.prospects), 1);
  const center: [number, number] = shownBubbles.length
    ? [shownBubbles.reduce((s, c) => s + (c.lat || 0), 0) / shownBubbles.length, shownBubbles.reduce((s, c) => s + (c.lng || 0), 0) / shownBubbles.length]
    : [-22.5, -48.5];

  // ===== município selecionado: cruzamento scraper x CNPJ =====
  const muniLeads = useMemo(() => selMuni ? leads.filter(l => normName(l.municipio) === normName(selMuni)) : [], [leads, selMuni]);
  const cross = useMemo(() => {
    if (!selMuni) return null;
    const extraStop = new Set(normName(selMuni).split(' ').filter(Boolean));
    const matchedProspectIds = new Set<string>();
    const matchedLeadIds = new Set<string>();
    for (const p of prospects) {
      for (const l of muniLeads) {
        if (leadMatchesProspect(l, p, { extraStop }).match) { matchedProspectIds.add(p.id); matchedLeadIds.add(l.id); }
      }
    }
    const faltantes = prospects.filter(p => !matchedProspectIds.has(p.id) && !p.is_client);
    return {
      ambos: matchedProspectIds.size,
      soScraper: muniLeads.filter(l => !matchedLeadIds.has(l.id)).length,
      faltantes,
      matchedProspectIds,
    };
  }, [selMuni, prospects, muniLeads]);

  // lista do rep para "fechar o buraco" (a lista com mais leads neste município)
  const targetList = useMemo(() => {
    if (!muniLeads.length) return null;
    const byList = new Map<string, { count: number; rep: string | null }>();
    muniLeads.forEach(l => { const e = byList.get(l.prospect_list_id) || { count: 0, rep: l.rep_nome }; e.count++; byList.set(l.prospect_list_id, e); });
    const top = [...byList.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    return { listId: top[0], rep: top[1].rep };
  }, [muniLeads]);

  // PostgREST limita a 1000 linhas/request -> paginamos via range() até um teto (4000) para
  // cidades grandes (ex.: capital com 9k+ PDVs) carregarem além das primeiras 1000.
  // Leaflet fica pesado com milhares de pinos -> renderizamos no máximo MARKER_CAP,
  // priorizando os "sem atendimento" (laranja), que são o sinal acionável. Contagens usam tudo.
  const MARKER_CAP = 1200;
  const prospectMarkers = useMemo(() => {
    const withCoord = prospects.filter(p => p.lat != null && p.lng != null);
    if (withCoord.length <= MARKER_CAP) return withCoord;
    const covered = (p: Prospect) => p.is_client || (cross?.matchedProspectIds.has(p.id) ?? false);
    const uncov = withCoord.filter(p => !covered(p));
    const cov = withCoord.filter(p => covered(p));
    return uncov.concat(cov).slice(0, MARKER_CAP);
  }, [prospects, cross]);

  async function openMuni(municipio: string) {
    setSelMuni(municipio); setLoadingMuni(true); setProspects([]); setMsg('');
    const cols = 'id,cnpj,razao_social,nome_fantasia,cnae_principal,cnae_descricao,logradouro,numero,complemento,bairro,municipio,uf,cep,telefone,email,lat,lng,is_client';
    const PAGE = 1000, CAP = 4000;
    let all: Prospect[] = [];
    for (let from = 0; from < CAP; from += PAGE) {
      const { data } = await supabase.from('prospects_b2b').select(cols)
        .eq('uf', uf).eq('municipio', municipio).range(from, from + PAGE - 1);
      const rows = (data as Prospect[]) || [];
      all = all.concat(rows);
      if (rows.length < PAGE) break;
    }
    setProspects(all);
    setLoadingMuni(false);
  }

  async function handleCreateList() {
    if (!selMuni) return;
    if (!confirm(`Criar lista de prospecção com os PDVs de ${selMuni}/${uf}?`)) return;
    setPromoting(true); setMsg('');
    try { const r = await promoteMunicipio({ uf, municipio: selMuni }); setMsg(`Lista criada: ${r.total} PDVs (${r.novos} novos, ${r.duplicados} já clientes).`); }
    catch (e) { setMsg('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setPromoting(false);
  }

  async function handleCloseGap() {
    if (!targetList || !cross?.faltantes.length) return;
    if (!confirm(`Adicionar ${cross.faltantes.length} PDVs que faltam à lista de ${targetList.rep || 'rep'}?\nDedup por CNPJ e nome evita repetir.`)) return;
    setPromoting(true); setMsg('');
    try {
      const r = await addProspectsToList({ listId: targetList.listId, prospects: cross.faltantes as any });
      setMsg(`Adicionados ${r.adicionados} PDVs à lista (${r.ignorados} já estavam). Aparecem na Prospecção do rep.`);
    } catch (e) { setMsg('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setPromoting(false);
  }

  if (loading) return <Center><Loader2 className="w-9 h-9 animate-spin" style={{ color: PRIMARY }} /></Center>;
  if (!profile?.is_admin) return (
    <Center>
      <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm">
        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">Mapa de cobertura B2B</h2>
        <p className="text-sm text-gray-500 mt-1">Acesso restrito a administradores.</p>
      </div>
    </Center>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Mapa de cobertura B2B</h1>
            <p className="text-sm text-gray-500">Universo de PDVs (RF) × leads de prospecção × clientes — onde reforçar território</p>
          </div>
          <select value={uf} onChange={e => setUf(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium">
            {['SP', 'MG', 'RJ', 'PR', 'SC', 'RS', 'BA', 'GO', 'ES', 'DF'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Kpi icon={<Target className="w-4 h-4" style={{ color: PRIMARY }} />} label="Prospects (PDVs)" value={totals.prospects.toLocaleString('pt-BR')} />
          <Kpi icon={<MapPin className="w-4 h-4 text-blue-600" />} label="Municípios c/ PDV" value={String(totals.municipios)} />
          <Kpi icon={<MapPin className="w-4 h-4 text-red-600" />} label="Buracos" value={String(totals.buracos)} />
          <Kpi icon={<Users className="w-4 h-4" style={{ color: PRIMARY }} />} label="Leads em trabalho" value={String(totals.leads)} />
          <Kpi icon={<Store className="w-4 h-4 text-green-600" />} label="Clientes ativos" value={String(totals.clientes)} />
        </div>

        {/* Controles */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)} className="rounded" /> Só buracos</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showLeads} onChange={e => setShowLeads(e.target.checked)} className="rounded" /> Leads de prospecção</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Colorir leads:</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setColorMode('rep')} className={`px-2.5 py-1 ${colorMode === 'rep' ? 'bg-[#8B2214] text-white' : 'text-gray-600'}`}>por representante</button>
              <button onClick={() => setColorMode('status')} className={`px-2.5 py-1 ${colorMode === 'status' ? 'bg-[#8B2214] text-white' : 'text-gray-600'}`}>por status</button>
            </div>
          </div>
          {colorMode === 'rep' && reps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-500">Reps:</span>
              {reps.map(r => {
                const on = enabledReps.has(r.id);
                return (
                  <button key={r.id} onClick={() => setEnabledReps(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? 'border-gray-300' : 'border-gray-200 opacity-40'}`}>
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: r.color }} /> {r.nome}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {busy ? <Center><Loader2 className="w-9 h-9 animate-spin" style={{ color: PRIMARY }} /></Center> : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-3">
              <div className="rounded-lg overflow-hidden border border-gray-100" style={{ height: 500 }}>
                <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {/* 1) bolhas de município */}
                  {shownBubbles.map(c => {
                    const col = c.clientes > 0 ? ORANGE : RED;
                    return (
                      <CircleMarker key={`m-${c.municipio}`} center={[c.lat!, c.lng!]} radius={5 + (c.prospects / maxP) * 22}
                        pathOptions={{ color: col, fillColor: col, fillOpacity: 0.25, weight: 1 }}
                        eventHandlers={{ click: () => openMuni(c.municipio) }}>
                        <Tooltip>{c.municipio} · {c.prospects} PDVs · {c.clientes} cliente(s)</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* 2) prospects individuais do município (laranja=não atendido, cinza=já cliente/casado) */}
                  {prospectMarkers.map(p => {
                    const covered = p.is_client || (cross?.matchedProspectIds.has(p.id) ?? false);
                    return (
                      <CircleMarker key={`p-${p.id}`} center={[p.lat!, p.lng!]} radius={3}
                        pathOptions={{ color: covered ? GRAY : ORANGE, fillColor: covered ? GRAY : ORANGE, fillOpacity: 0.7, weight: 1 }}>
                        <Tooltip>{p.nome_fantasia || p.razao_social || p.cnpj} · {p.cnae_descricao || ''}{covered ? ' · coberto' : ' · sem atendimento'}</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* 3) leads em trabalho (cor por rep/status) */}
                  {shownLeads.map(l => {
                    const col = leadColor(l);
                    return (
                      <CircleMarker key={`l-${l.id}`} center={[l.lat, l.lng]} radius={5}
                        pathOptions={{ color: col, fillColor: col, fillOpacity: 0.85, weight: 1 }}>
                        <Tooltip>{l.trade_name || l.company_name} · {l.rep_nome || ''} · {l.status}</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* 4) clientes ativos (verde, topo) */}
                  {clientes.map(cl => (
                    <CircleMarker key={`c-${cl.id}`} center={[cl.lat, cl.lng]} radius={6}
                      pathOptions={{ color: GREEN, fillColor: GREEN, fillOpacity: 0.95, weight: 2 }}>
                      <Tooltip>{cl.nome || 'Cliente'} (cliente ativo)</Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: GREEN }} /> cliente / convertido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: PRIMARY }} /> lead em trabalho</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: ORANGE }} /> PDV sem atendimento</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: GRAY }} /> coberto / já cliente</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Fonte CNPJ: Receita Federal — Dados Abertos · leads da Prospecção · © OpenStreetMap contributors.</p>
            </div>

            {/* Painel lateral */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              {!selMuni ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-3">Ranking de buracos</h3>
                  <div className="space-y-1.5 max-h-[470px] overflow-y-auto">
                    {[...cobertura].filter(c => c.prospects > 0).sort((a, b) => (a.clientes - b.clientes) || (b.prospects - a.prospects)).slice(0, 30).map(c => (
                      <button key={c.municipio} onClick={() => openMuni(c.municipio)} className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                        <span className="text-sm text-gray-800 truncate">{c.municipio}</span>
                        <span className="text-xs flex-shrink-0 ml-2"><span className="font-semibold" style={{ color: c.clientes ? GREEN : RED }}>{c.prospects}</span><span className="text-gray-400"> PDV · {c.clientes} cli</span></span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => { setSelMuni(null); setProspects([]); setMsg(''); }} className="text-xs text-gray-500 hover:text-gray-800 mb-2">← voltar ao ranking</button>
                  <h3 className="font-bold text-gray-900">{selMuni}/{uf}</h3>
                  {(() => {
                    const total = cobertura.find(c => c.municipio === selMuni)?.prospects ?? prospects.length;
                    return <p className="text-sm text-gray-500 mb-3">{loadingMuni ? 'carregando…' : `${prospects.length}${total > prospects.length ? ` de ${total}` : ''} PDVs no universo${total > prospects.length ? ' (teto 4000)' : ''}`}</p>;
                  })()}

                  {/* Cruzamento scraper x CNPJ */}
                  {!loadingMuni && cross && (
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <CrossBox label="Em ambos" value={cross.ambos} color={GRAY} />
                      <CrossBox label="Só scraper" value={cross.soScraper} color={PRIMARY} />
                      <CrossBox label="Só CNPJ (faltam)" value={cross.faltantes.length} color={ORANGE} />
                    </div>
                  )}

                  {/* Ações */}
                  {targetList && cross && cross.faltantes.length > 0 && (
                    <button onClick={handleCloseGap} disabled={promoting || loadingMuni}
                      className="w-full flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg mb-2">
                      {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Adicionar {cross.faltantes.length} faltantes à lista de {targetList.rep || 'rep'}
                    </button>
                  )}
                  <button onClick={handleCreateList} disabled={promoting || loadingMuni || prospects.length === 0}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg mb-3">
                    <Plus className="w-4 h-4" /> Criar nova lista desta cidade
                  </button>
                  {msg && <p className="text-xs mb-3 p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">{msg}</p>}

                  {/* Faltantes */}
                  <p className="text-xs font-semibold text-gray-600 mb-1">PDVs que faltam na lista (CNPJ não pego pelo scraper)</p>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {(cross?.faltantes || []).slice(0, 200).map(p => (
                      <div key={p.id} className="text-xs px-2 py-1.5 rounded border border-gray-100">
                        <div className="font-medium text-gray-800 truncate">{p.nome_fantasia || p.razao_social || p.cnpj}</div>
                        <div className="text-gray-400 truncate">{p.cnae_descricao} · {p.logradouro || ''} {p.numero || ''}</div>
                      </div>
                    ))}
                    {cross && cross.faltantes.length === 0 && !loadingMuni && <p className="text-xs text-gray-400">Nenhum — a lista cobre o universo desta cidade. 🎯</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
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
function CrossBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-100 py-2">
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
    </div>
  );
}
