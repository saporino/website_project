import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { CLIENT_SEGMENTS, SEGMENT_LABEL } from '../../constants/segments';
import type { ClientSegment } from '../../constants/segments';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_CONFIG = {
  pending:      { label: 'Pendente',     color: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300'    },
  in_progress:  { label: 'Em Andamento', color: '#3b82f6', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  completed:    { label: 'Concluído',    color: '#22c55e', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
  not_attended: { label: 'Não Atendido', color: '#f97316', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
} as const;

type VisitStatus = keyof typeof STATUS_CONFIG;

function makeIcon(color: string, order: number) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-size:11px;font-weight:700;"><span style="transform:rotate(45deg)">${order}</span></div>`,
    iconSize: [28, 28], iconAnchor: [14, 28], className: '',
  });
}

interface Stop {
  id: string; stop_order: number; company_name: string;
  address: string | null; city: string | null; phone: string | null; segment: string | null;
  lat: number; lng: number; visit_status: VisitStatus;
  visit_notes: string | null; visited_at: string | null; representative_client_id: string | null;
}

interface Route { id: string; name: string; status: string; created_at: string; }

interface ConvertForm {
  cnpj: string; razao_social: string; nome_fantasia: string; endereco_completo: string;
  whatsapp_comprador: string; segment: ClientSegment | ''; forma_pagamento: string;
}

const emptyForm: ConvertForm = { cnpj: '', razao_social: '', nome_fantasia: '', endereco_completo: '', whatsapp_comprador: '', segment: '', forma_pagamento: '' };

interface Props { representativeId: string; onNavigateToOrder?: (clientId: string) => void; }

export default function RepCoRoutes({ representativeId, onNavigateToOrder }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'map'|'list'>('list');
  const [convertingStop, setConvertingStop] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm>(emptyForm);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [convertSuccess, setConvertSuccess] = useState('');

  useEffect(() => { fetchRoutes(); }, [representativeId]);

  async function fetchRoutes() {
    setLoading(true);
    const { data } = await supabase.from('representative_routes').select('id,name,status,created_at').eq('representative_id', representativeId).eq('status','active').order('created_at', { ascending: false });
    setRoutes(data || []);
    setLoading(false);
  }

  async function fetchStops(routeId: string) {
    setLoadingStops(true);
    const { data } = await supabase.from('route_stops').select('*').eq('route_id', routeId).order('stop_order');
    setStops((data as Stop[]) || []);
    setLoadingStops(false);
  }

  function selectRoute(route: Route) { setSelectedRoute(route); fetchStops(route.id); setSelectedStop(null); setConvertingStop(null); }

  async function updateStatus(stop: Stop, newStatus: VisitStatus) {
    setUpdatingStatus(stop.id);
    const { error } = await supabase.from('route_stops').update({ visit_status: newStatus, visit_notes: notes || stop.visit_notes, visited_at: newStatus !== 'pending' ? new Date().toISOString() : null }).eq('id', stop.id);
    if (!error) {
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, visit_status: newStatus, visit_notes: notes || s.visit_notes } : s));
      setSelectedStop(prev => prev?.id === stop.id ? { ...prev, visit_status: newStatus } : prev);
    }
    setUpdatingStatus(null); setNotes('');
  }

  function openConvertForm(stop: Stop) {
    setConvertingStop(stop.id); setConvertError(''); setConvertSuccess('');
    setConvertForm({ ...emptyForm, nome_fantasia: stop.company_name, endereco_completo: [stop.address, stop.city].filter(Boolean).join(', '), segment: (stop.segment as ClientSegment) || '', whatsapp_comprador: stop.phone || '' });
  }

  async function searchCNPJ() {
    const cnpj = convertForm.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) { setConvertError('CNPJ deve ter 14 dígitos.'); return; }
    setSearchingCNPJ(true); setConvertError('');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConvertForm(prev => ({ ...prev, razao_social: data.razao_social || '', nome_fantasia: data.nome_fantasia || prev.nome_fantasia, endereco_completo: [data.logradouro, data.numero, data.complemento, data.bairro, data.municipio, data.uf].filter(Boolean).join(', ') }));
    } catch { setConvertError('CNPJ não encontrado. Preencha manualmente.'); }
    setSearchingCNPJ(false);
  }

  async function saveAsClient(stop: Stop) {
    if (!convertForm.segment) { setConvertError('Selecione o segmento.'); return; }
    if (!convertForm.razao_social && !convertForm.nome_fantasia) { setConvertError('Informe o nome da empresa.'); return; }
    setSavingClient(true); setConvertError('');
    const cnpj = convertForm.cnpj.replace(/\D/g,'') || '00000000000000';
    const { data: newClient, error } = await supabase.from('representative_clients').insert({
      representative_id: representativeId, cnpj,
      razao_social: convertForm.razao_social || convertForm.nome_fantasia,
      nome_fantasia: convertForm.nome_fantasia, endereco_completo: convertForm.endereco_completo,
      whatsapp_comprador: convertForm.whatsapp_comprador || null,
      forma_pagamento: convertForm.forma_pagamento || null,
      segment: convertForm.segment, status: 'active',
    }).select().single();
    if (error) { setConvertError('Erro: ' + error.message); setSavingClient(false); return; }
    await supabase.from('route_stops').update({ representative_client_id: newClient.id, visit_status: 'completed' }).eq('id', stop.id);
    setStops(prev => prev.map(s => s.id === stop.id ? { ...s, representative_client_id: newClient.id, visit_status: 'completed' } : s));
    setConvertSuccess('Cliente cadastrado com sucesso!'); setSavingClient(false); setConvertingStop(null);
    if (onNavigateToOrder) setTimeout(() => onNavigateToOrder(newClient.id), 1500);
  }

  const fmt = (v: string) => v.replace(/\D/g,'').slice(0,14).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
  const stopsWithCoords = stops.filter(s => s.lat && s.lng);
  const polylinePoints = stopsWithCoords.map(s => [s.lat, s.lng] as [number, number]);
  const center: [number,number] = stopsWithCoords.length > 0 ? [stopsWithCoords[0].lat, stopsWithCoords[0].lng] : [-23.55052, -46.633308];
  const statusCounts = { pending: 0, in_progress: 0, completed: 0, not_attended: 0 };
  stops.forEach(s => { if (s.visit_status in statusCounts) statusCounts[s.visit_status]++; });

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  if (!selectedRoute) return (
    <div className="space-y-3">
      <div><h3 className="text-lg font-semibold text-gray-800">Minhas Rotas</h3><p className="text-sm text-gray-500">{routes.length} rota{routes.length!==1?'s':''} ativa{routes.length!==1?'s':''}</p></div>
      {routes.length === 0
        ? <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">🗺️</p><p className="font-medium">Nenhuma rota atribuída ainda</p><p className="text-sm mt-1">O administrador criará rotas para você</p></div>
        : routes.map(route => (
          <div key={route.id} onClick={() => selectRoute(route)} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#a4240e]/40 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between"><div><p className="font-semibold text-gray-900">{route.name}</p><p className="text-xs text-gray-400 mt-0.5">Criada em {new Date(route.created_at).toLocaleDateString('pt-BR')}</p></div><span className="text-[#a4240e] text-lg">›</span></div>
          </div>
        ))
      }
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedRoute(null)} className="text-sm text-gray-400 hover:text-gray-600">‹</button>
        <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{selectedRoute.name}</p><p className="text-xs text-gray-400">{stops.length} pontos</p></div>
        <div className="flex gap-1">
          {(['list','map'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode===m?'bg-[#a4240e] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m==='list'?'Lista':'Mapa'}</button>
          ))}
        </div>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
          <div key={s} className={`rounded-lg p-2 text-center ${STATUS_CONFIG[s].bg}`}>
            <p className={`text-xl font-bold ${STATUS_CONFIG[s].text}`}>{statusCounts[s]}</p>
            <p className={`${STATUS_CONFIG[s].text} leading-tight`} style={{fontSize:'9px'}}>{STATUS_CONFIG[s].label}</p>
          </div>
        ))}
      </div>

      {convertSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{convertSuccess}</div>}

      {loadingStops ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a4240e]"/></div> : (
        <>
          {/* MAP */}
          {viewMode === 'map' && stopsWithCoords.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{height:'320px'}}>
              <MapContainer center={center} zoom={12} style={{height:'100%',width:'100%'}}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
                <Polyline positions={polylinePoints} color="#a4240e" weight={2} dashArray="6,4" opacity={0.6}/>
                {stopsWithCoords.map(stop => (
                  <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={makeIcon(STATUS_CONFIG[stop.visit_status]?.color??'#888', stop.stop_order)} eventHandlers={{click:()=>setSelectedStop(stop)}}>
                    <Popup>
                      <div style={{minWidth:'160px',fontFamily:'system-ui'}}>
                        <p style={{fontWeight:600,marginBottom:'4px'}}>{stop.company_name}</p>
                        <p style={{fontSize:'12px',color:'#666',marginBottom:'6px'}}>{stop.address}</p>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                          {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
                            <button key={s} onClick={()=>updateStatus(stop,s)} style={{background:STATUS_CONFIG[s].color,color:'#fff',border:'none',borderRadius:'4px',padding:'3px 7px',fontSize:'11px',cursor:'pointer',fontWeight:stop.visit_status===s?700:400,opacity:stop.visit_status===s?1:0.7}}>{STATUS_CONFIG[s].label}</button>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
          {viewMode === 'map' && stopsWithCoords.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">Nenhum ponto com coordenadas</div>}

          {/* LIST */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {stops.map(stop => {
                const cfg = STATUS_CONFIG[stop.visit_status] ?? STATUS_CONFIG.pending;
                const isSelected = selectedStop?.id === stop.id;
                const isConverting = convertingStop === stop.id;
                const alreadyClient = !!stop.representative_client_id;
                return (
                  <div key={stop.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isSelected?'border-[#a4240e]/40':'border-gray-200'}`}>
                    <div className="p-3 cursor-pointer flex items-center gap-3" onClick={() => { setSelectedStop(isSelected?null:stop); if(isSelected) setConvertingStop(null); }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:cfg.color}}>{stop.stop_order}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{stop.company_name}</p>
                          {alreadyClient && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">Cliente ✓</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{stop.address}{stop.city?`, ${stop.city}`:''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text} flex-shrink-0`}>{cfg.label}</span>
                    </div>

                    {isSelected && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                        {stop.phone && <a href={`tel:${stop.phone}`} className="flex items-center gap-2 text-xs text-blue-600">📞 {stop.phone}</a>}
                        {stop.address && (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address||''} ${stop.city||''}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-600">🧭 Abrir no Google Maps</a>
                        )}

                        {/* Status buttons */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Atualizar status:</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
                              <button key={s} onClick={()=>updateStatus(stop,s)} disabled={updatingStatus===stop.id}
                                className={`text-xs py-1.5 px-2 rounded-lg font-medium border transition-all ${stop.visit_status===s?`${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} ${STATUS_CONFIG[s].border} border`:'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                {updatingStatus===stop.id?'...':STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Adicionar observação..." className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none"/>

                        {/* Convert to client / Make order */}
                        {!alreadyClient && (
                          <button onClick={()=>isConverting?setConvertingStop(null):openConvertForm(stop)}
                            className="w-full flex items-center justify-center gap-2 bg-[#a4240e] text-white py-2 rounded-lg text-xs font-semibold hover:bg-[#8a1f0c]">
                            {isConverting?'✕ Cancelar':'🔄 Converter em cliente'}
                          </button>
                        )}
                        {alreadyClient && onNavigateToOrder && (
                          <button onClick={()=>onNavigateToOrder(stop.representative_client_id!)}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-green-700">
                            🛒 Fazer pedido para este cliente
                          </button>
                        )}

                        {/* Conversion form */}
                        {isConverting && (
                          <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-3">
                            <p className="text-xs font-semibold text-gray-700">Cadastrar como cliente</p>
                            {convertError && <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">{convertError}</p>}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">CNPJ (busca automática)</label>
                              <div className="flex gap-2">
                                <input type="text" value={fmt(convertForm.cnpj)} onChange={e=>setConvertForm(p=>({...p,cnpj:e.target.value.replace(/\D/g,'')}))} placeholder="00.000.000/0000-00" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none"/>
                                <button onClick={searchCNPJ} disabled={searchingCNPJ||convertForm.cnpj.replace(/\D/g,'').length!==14} className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-gray-800 disabled:opacity-40">{searchingCNPJ?'...':'Buscar'}</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <div><label className="block text-xs text-gray-500 mb-1">Nome / Razão Social *</label><input type="text" value={convertForm.razao_social||convertForm.nome_fantasia} onChange={e=>setConvertForm(p=>({...p,razao_social:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none"/></div>
                              <div><label className="block text-xs text-gray-500 mb-1">Segmento *</label>
                                <select value={convertForm.segment} onChange={e=>setConvertForm(p=>({...p,segment:e.target.value as ClientSegment}))} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none">
                                  <option value="">Selecione...</option>
                                  {CLIENT_SEGMENTS.map(seg=><option key={seg.value} value={seg.value}>{seg.label}</option>)}
                                </select></div>
                              <div><label className="block text-xs text-gray-500 mb-1">WhatsApp</label><input type="text" value={convertForm.whatsapp_comprador} onChange={e=>setConvertForm(p=>({...p,whatsapp_comprador:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none"/></div>
                              <div><label className="block text-xs text-gray-500 mb-1">Forma de pagamento</label>
                                <select value={convertForm.forma_pagamento} onChange={e=>setConvertForm(p=>({...p,forma_pagamento:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none">
                                  <option value="">Selecione...</option><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="a_vista">À Vista</option>
                                </select></div>
                            </div>
                            <button onClick={()=>saveAsClient(stop)} disabled={savingClient} className="w-full bg-[#a4240e] text-white py-2 rounded-lg text-xs font-semibold hover:bg-[#8a1f0c] disabled:opacity-50">
                              {savingClient?'Cadastrando...':'✅ Confirmar cadastro como cliente'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
