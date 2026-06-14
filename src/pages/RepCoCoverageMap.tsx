import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Lock, MapPin, Store, Target, Loader2, Plus } from 'lucide-react';
import { promoteMunicipio } from '../lib/promoteProspects';

const PRIMARY = '#8B2214';

interface Cobertura { uf: string; municipio: string; clientes: number; prospects: number; prospects_nao_clientes: number; lat: number | null; lng: number | null; }
interface ClienteGeo { id: string; nome: string | null; municipio: string | null; uf: string | null; lat: number; lng: number; }
interface Prospect { id: string; cnpj: string; nome_fantasia: string | null; cnae_descricao: string | null; logradouro: string | null; numero: string | null; bairro: string | null; municipio: string | null; lat: number | null; lng: number | null; is_client: boolean; }

function goBack() {
  window.history.pushState({}, '', '/repco/inteligencia');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">{children}</div>
);

export default function RepCoCoverageMap() {
  const { profile, loading } = useAuth();
  const [uf, setUf] = useState('SP');
  const [cobertura, setCobertura] = useState<Cobertura[]>([]);
  const [clientes, setClientes] = useState<ClienteGeo[]>([]);
  const [busy, setBusy] = useState(true);
  const [onlyGaps, setOnlyGaps] = useState(false);
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
      const [c, cl] = await Promise.all([
        supabase.from('vw_repco_cobertura').select('*').eq('uf', uf),
        supabase.from('vw_repco_clientes_geo').select('*').eq('uf', uf),
      ]);
      if (!active) return;
      setCobertura((c.data as Cobertura[]) || []);
      setClientes((cl.data as ClienteGeo[]) || []);
      setBusy(false);
    })();
    return () => { active = false; };
  }, [profile?.is_admin, uf]);

  const shown = useMemo(() => {
    const withCoords = cobertura.filter(c => c.lat != null && c.lng != null);
    return onlyGaps ? withCoords.filter(c => c.clientes === 0 && c.prospects > 0) : withCoords;
  }, [cobertura, onlyGaps]);

  const totals = useMemo(() => ({
    prospects: cobertura.reduce((s, c) => s + c.prospects, 0),
    municipios: cobertura.filter(c => c.prospects > 0).length,
    buracos: cobertura.filter(c => c.prospects > 0 && c.clientes === 0).length,
    clientes: clientes.length,
  }), [cobertura, clientes]);

  const maxP = Math.max(...shown.map(c => c.prospects), 1);
  const center: [number, number] = shown.length
    ? [shown.reduce((s, c) => s + (c.lat || 0), 0) / shown.length, shown.reduce((s, c) => s + (c.lng || 0), 0) / shown.length]
    : [-22.5, -48.5];

  async function openMuni(municipio: string) {
    setSelMuni(municipio); setLoadingMuni(true); setProspects([]); setMsg('');
    const { data } = await supabase.from('prospects_b2b')
      .select('id,cnpj,nome_fantasia,cnae_descricao,logradouro,numero,bairro,municipio,lat,lng,is_client')
      .eq('uf', uf).eq('municipio', municipio).limit(2000);
    setProspects((data as Prospect[]) || []);
    setLoadingMuni(false);
  }

  async function handlePromote() {
    if (!selMuni) return;
    if (!confirm(`Criar lista de prospecção com os PDVs de ${selMuni}/${uf}?\nA dedup por CNPJ marca quem já é cliente.`)) return;
    setPromoting(true); setMsg('');
    try {
      const r = await promoteMunicipio({ uf, municipio: selMuni });
      setMsg(`Lista criada: ${r.total} PDVs (${r.novos} novos, ${r.duplicados} já clientes). Veja em Prospecção.`);
    } catch (e) {
      setMsg('Erro ao criar lista: ' + (e instanceof Error ? e.message : String(e)));
    }
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
            <p className="text-sm text-gray-500">PDVs potenciais (base pública RF) × clientes ativos — onde abrir território</p>
          </div>
          <select value={uf} onChange={e => setUf(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium">
            {['SP','MG','RJ','PR','SC','RS','BA','GO','ES','DF'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi icon={<Target className="w-4 h-4" style={{ color: PRIMARY }} />} label="Prospects (PDVs)" value={totals.prospects.toLocaleString('pt-BR')} />
          <Kpi icon={<MapPin className="w-4 h-4 text-blue-600" />} label="Municípios c/ PDV" value={String(totals.municipios)} />
          <Kpi icon={<MapPin className="w-4 h-4 text-red-600" />} label="Buracos (PDV, 0 cliente)" value={String(totals.buracos)} />
          <Kpi icon={<Store className="w-4 h-4 text-green-600" />} label="Clientes ativos" value={String(totals.clientes)} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)} className="rounded" />
            Mostrar só buracos de cobertura
          </label>
          <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#dc2626' }} /> sem cliente</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f59e0b' }} /> tem cliente</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#16a34a' }} /> cliente</span>
          </div>
        </div>

        {busy ? (
          <Center><Loader2 className="w-9 h-9 animate-spin" style={{ color: PRIMARY }} /></Center>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Mapa */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-3">
              <div className="rounded-lg overflow-hidden border border-gray-100" style={{ height: 480 }}>
                <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {/* bolhas de município (prospects) */}
                  {shown.map(c => {
                    const col = c.clientes > 0 ? '#f59e0b' : '#dc2626';
                    return (
                      <CircleMarker key={`m-${c.municipio}`} center={[c.lat!, c.lng!]}
                        radius={5 + (c.prospects / maxP) * 24}
                        pathOptions={{ color: col, fillColor: col, fillOpacity: 0.4, weight: 1 }}
                        eventHandlers={{ click: () => openMuni(c.municipio) }}>
                        <Tooltip>{c.municipio} · {c.prospects} PDVs · {c.clientes} cliente(s)</Tooltip>
                      </CircleMarker>
                    );
                  })}
                  {/* prospects individuais do município selecionado */}
                  {prospects.filter(p => p.lat != null && p.lng != null).map(p => (
                    <CircleMarker key={`p-${p.id}`} center={[p.lat!, p.lng!]} radius={3}
                      pathOptions={{ color: p.is_client ? '#16a34a' : '#dc2626', fillOpacity: 0.7, weight: 1 }}>
                      <Tooltip>{p.nome_fantasia || p.cnpj} · {p.cnae_descricao || ''}</Tooltip>
                    </CircleMarker>
                  ))}
                  {/* clientes ativos */}
                  {clientes.map(cl => (
                    <CircleMarker key={`c-${cl.id}`} center={[cl.lat, cl.lng]} radius={6}
                      pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.9, weight: 2 }}>
                      <Tooltip>{cl.nome || 'Cliente'} (cliente ativo)</Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2">Clique numa bolha para carregar os PDVs do município. Fonte: Receita Federal — Dados Abertos CNPJ · © OpenStreetMap contributors.</p>
            </div>

            {/* Painel lateral */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              {!selMuni ? (
                <>
                  <h3 className="font-bold text-gray-900 mb-3">Ranking de buracos</h3>
                  <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
                    {[...cobertura].filter(c => c.prospects > 0).sort((a, b) => (a.clientes - b.clientes) || (b.prospects - a.prospects)).slice(0, 30).map(c => (
                      <button key={c.municipio} onClick={() => openMuni(c.municipio)}
                        className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                        <span className="text-sm text-gray-800 truncate">{c.municipio}</span>
                        <span className="text-xs flex-shrink-0 ml-2">
                          <span className="font-semibold" style={{ color: c.clientes ? '#16a34a' : '#dc2626' }}>{c.prospects}</span>
                          <span className="text-gray-400"> PDV · {c.clientes} cli</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => { setSelMuni(null); setProspects([]); setMsg(''); }} className="text-xs text-gray-500 hover:text-gray-800 mb-2">← voltar ao ranking</button>
                  <h3 className="font-bold text-gray-900">{selMuni}/{uf}</h3>
                  <p className="text-sm text-gray-500 mb-3">{loadingMuni ? 'carregando…' : `${prospects.length} PDVs${prospects.length === 2000 ? '+ (limitado a 2000)' : ''}`}</p>
                  <button onClick={handlePromote} disabled={promoting || loadingMuni || prospects.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg mb-3">
                    {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar lista de prospecção
                  </button>
                  {msg && <p className="text-xs mb-3 p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">{msg}</p>}
                  <div className="space-y-1 max-h-[360px] overflow-y-auto">
                    {prospects.slice(0, 200).map(p => (
                      <div key={p.id} className="text-xs px-2 py-1.5 rounded border border-gray-100">
                        <div className="font-medium text-gray-800 truncate">{p.nome_fantasia || p.cnpj} {p.is_client && <span className="text-green-600">· cliente</span>}</div>
                        <div className="text-gray-400 truncate">{p.cnae_descricao} · {p.logradouro || ''} {p.numero || ''}</div>
                      </div>
                    ))}
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
      <div className="flex items-center gap-2 mb-1">
        <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] flex items-center justify-center">{icon}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
