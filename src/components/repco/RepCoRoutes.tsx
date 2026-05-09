import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';

// Fix ícone Leaflet com Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_CONFIG = {
  pending:     { label: 'Não visitado', color: '#ef4444', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
  in_progress: { label: 'Em andamento', color: '#3b82f6', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  visited:     { label: 'Visitado',     color: '#eab308', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  closed:      { label: 'Fechado',      color: '#22c55e', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
} as const;

type VisitStatus = keyof typeof STATUS_CONFIG;

function makeIcon(color: string, order: number) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-size:11px;font-weight:700;"><span style="transform:rotate(45deg)">${order}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    className: '',
  });
}

interface Stop {
  id: string; stop_order: number; company_name: string;
  address: string | null; city: string | null; phone: string | null; segment: string | null;
  lat: number; lng: number; visit_status: VisitStatus;
  visit_notes: string | null; visited_at: string | null;
}

interface Route { id: string; name: string; status: string; created_at: string; }

interface Props { repId: string; }

export function RepCoRoutes({ repId }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');

  useEffect(() => { fetchRoutes(); }, [repId]);

  async function fetchRoutes() {
    setLoading(true);
    const { data } = await supabase
      .from('representative_routes')
      .select('id,name,status,created_at')
      .eq('representative_id', repId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setRoutes(data || []);
    setLoading(false);
  }

  async function fetchStops(routeId: string) {
    setLoadingStops(true);
    const { data } = await supabase.from('route_stops').select('*').eq('route_id', routeId).order('stop_order');
    setStops((data as Stop[]) || []);
    setLoadingStops(false);
  }

  function selectRoute(route: Route) {
    setSelectedRoute(route);
    fetchStops(route.id);
    setSelectedStop(null);
  }

  async function updateStatus(stop: Stop, newStatus: VisitStatus) {
    setUpdatingStatus(stop.id);
    const { error } = await supabase.from('route_stops').update({
      visit_status: newStatus,
      visit_notes: notes || stop.visit_notes,
      visited_at: newStatus !== 'pending' ? new Date().toISOString() : null,
    }).eq('id', stop.id);
    if (!error) {
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, visit_status: newStatus, visit_notes: notes || s.visit_notes } : s));
      setSelectedStop(prev => prev?.id === stop.id ? { ...prev, visit_status: newStatus } : prev);
    }
    setUpdatingStatus(null);
    setNotes('');
  }

  const stopsWithCoords = stops.filter(s => s.lat && s.lng);
  const polylinePoints = stopsWithCoords.map(s => [s.lat, s.lng] as [number, number]);
  const center: [number, number] = stopsWithCoords.length > 0 ? [stopsWithCoords[0].lat, stopsWithCoords[0].lng] : [-23.55052, -46.633308];

  const statusCounts = (Object.keys(STATUS_CONFIG) as VisitStatus[]).reduce((acc, s) => {
    acc[s] = stops.filter(st => st.visit_status === s).length;
    return acc;
  }, {} as Record<VisitStatus, number>);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  if (!selectedRoute) return (
    <div className="space-y-3">
      <div><h3 className="text-2xl font-bold text-gray-900">Minhas Rotas</h3><p className="text-sm text-gray-500">{routes.length} rota{routes.length !== 1 ? 's' : ''} ativa{routes.length !== 1 ? 's' : ''}</p></div>
      {routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">🗺️</p><p className="font-medium">Nenhuma rota atribuída ainda</p><p className="text-sm mt-1">O administrador criará rotas para você</p></div>
      ) : (
        routes.map(route => (
          <div key={route.id} onClick={() => selectRoute(route)} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#a4240e]/40 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <div><p className="font-semibold text-gray-900">{route.name}</p><p className="text-xs text-gray-400 mt-0.5">Criada em {new Date(route.created_at).toLocaleDateString('pt-BR')}</p></div>
              <span className="text-[#a4240e] text-lg">›</span>
            </div>
          </div>
        ))
      )}
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
            <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode === m ? 'bg-[#a4240e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m === 'list' ? 'Lista' : 'Mapa'}</button>
          ))}
        </div>
      </div>

      {/* Progress cards */}
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
          <div key={s} className={`rounded-lg p-2 text-center ${STATUS_CONFIG[s].bg}`}>
            <p className={`text-xl font-bold ${STATUS_CONFIG[s].text}`}>{statusCounts[s]}</p>
            <p className={`${STATUS_CONFIG[s].text} leading-tight`} style={{fontSize:'9px'}}>{STATUS_CONFIG[s].label}</p>
          </div>
        ))}
      </div>

      {loadingStops ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a4240e]"/></div>
      ) : (
        <>
          {/* MAP VIEW */}
          {viewMode === 'map' && stopsWithCoords.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '320px' }}>
              <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
                <Polyline positions={polylinePoints} color="#a4240e" weight={2} dashArray="6,4" opacity={0.6}/>
                {stopsWithCoords.map(stop => (
                  <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={makeIcon(STATUS_CONFIG[stop.visit_status]?.color ?? '#888', stop.stop_order)} eventHandlers={{ click: () => setSelectedStop(stop) }}>
                    <Popup>
                      <div style={{ minWidth: '160px', fontFamily: 'system-ui' }}>
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>{stop.company_name}</p>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>{stop.address}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
                            <button key={s} onClick={() => updateStatus(stop, s)} style={{ background: STATUS_CONFIG[s].color, color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 7px', fontSize: '11px', cursor: 'pointer', fontWeight: stop.visit_status === s ? 700 : 400, opacity: stop.visit_status === s ? 1 : 0.7 }}>
                              {STATUS_CONFIG[s].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
          {viewMode === 'map' && stopsWithCoords.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum ponto com coordenadas disponível</div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {stops.map(stop => {
                const cfg = STATUS_CONFIG[stop.visit_status] ?? STATUS_CONFIG.pending;
                const isSelected = selectedStop?.id === stop.id;
                return (
                  <div key={stop.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isSelected ? 'border-[#a4240e]/40' : 'border-gray-200'}`}>
                    <div className="p-3 cursor-pointer flex items-center gap-3" onClick={() => setSelectedStop(isSelected ? null : stop)}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: cfg.color }}>{stop.stop_order}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{stop.company_name}</p>
                        <p className="text-xs text-gray-400 truncate">{stop.address}{stop.city ? `, ${stop.city}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    {isSelected && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                        {stop.phone && <a href={`tel:${stop.phone}`} className="flex items-center gap-2 text-xs text-blue-600">📞 {stop.phone}</a>}
                        {stop.address && (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${stop.address || ''} ${stop.city || ''}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-600">
                            🧭 Abrir no Google Maps
                          </a>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5 font-medium">Atualizar status:</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(Object.keys(STATUS_CONFIG) as VisitStatus[]).map(s => (
                              <button key={s} onClick={() => updateStatus(stop, s)} disabled={updatingStatus === stop.id}
                                className={`text-xs py-1.5 px-2 rounded-lg font-medium border transition-all ${stop.visit_status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} ${STATUS_CONFIG[s].border} border` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                {updatingStatus === stop.id ? '...' : STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Adicionar observação..." className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#a4240e] outline-none"/>
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
