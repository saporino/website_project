import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { SEGMENT_LABEL } from '../../constants/segments';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_CFG = {
  pending:      { label: 'Pendente',     color: '#ef4444', bg: '#ffebee', tc: '#c62828' },
  in_progress:  { label: 'Em Andamento', color: '#3b82f6', bg: '#e3f2fd', tc: '#1565c0' },
  completed:    { label: 'Concluído',    color: '#22c55e', bg: '#e8f5e9', tc: '#2e7d32' },
  not_attended: { label: 'Não Atendido', color: '#f97316', bg: '#fff3e0', tc: '#e65100' },
} as const;
type VisitStatus = keyof typeof STATUS_CFG;

const ROUTE_TYPE_LABELS: Record<string, string> = { visit: 'Visita', delivery: 'Entrega', prospection: 'Prospecção' };

interface Stop {
  id: string; stop_order: number; company_name: string;
  address: string | null; city: string | null; phone: string | null; segment: string | null;
  lat: number; lng: number; visit_status: VisitStatus;
  visit_notes: string | null; visited_at: string | null;
  representative_client_id: string | null; scheduled_at: string | null;
  arrival_at?: string | null; departure_at?: string | null;
  proof_photo_url?: string | null; proof_photo_lat?: number | null;
  proof_photo_lng?: number | null; proof_photo_at?: string | null;
  geofence_triggered?: boolean; weight_kg?: number; stop_type?: string;
}

interface Route {
  id: string; name: string; status: string; created_at: string;
  route_type?: string; max_weight_kg?: number; total_weight_kg?: number;
  region?: string; finalized_at?: string; learned_order?: Record<string, number>;
}

interface Props {
  representativeId: string;
  currentLat?: number; currentLng?: number;
  onNavigateToOrder?: (clientId: string) => void;
  previewMode?: boolean;
}

function hav(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function RepCoRoutes({ representativeId, currentLat, currentLng, onNavigateToOrder, previewMode = false }: Props) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [sel, setSel] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStops, setLoadingStops] = useState(false);
  const [viewMode, setViewMode] = useState<'list'|'map'>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const pendingStop = useRef<string | null>(null);

  useEffect(() => { fetchRoutes(); }, [representativeId]);
  useEffect(() => { if (!previewMode && currentLat && currentLng && stops.length) checkGeo(currentLat, currentLng); }, [currentLat, currentLng, stops, previewMode]);

  async function fetchRoutes() {
    setLoading(true);
    const { data } = await supabase.from('representative_routes').select('*').eq('representative_id', representativeId).order('created_at', { ascending: false });
    if (data) setRoutes(data as Route[]);
    setLoading(false);
  }

  async function fetchStops(routeId: string) {
    setLoadingStops(true);
    const { data } = await supabase.from('route_stops').select('*').eq('route_id', routeId).order('stop_order');
    if (data) setStops(data as Stop[]);
    setLoadingStops(false);
  }

  async function updateStatus(stopId: string, status: VisitStatus, notes?: string) {
    if (previewMode) return;
    setUpdating(stopId);
    const updates: any = { visit_status: status, visit_notes: notes };
    if (status === 'in_progress' && !stops.find(s => s.id === stopId)?.arrival_at) updates.arrival_at = new Date().toISOString();
    if (status === 'completed' || status === 'not_attended') { updates.visited_at = new Date().toISOString(); updates.departure_at = new Date().toISOString(); }
    await supabase.from('route_stops').update(updates).eq('id', stopId);
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, ...updates } : s));
    setUpdating(null);
    if (status === 'completed') { pendingStop.current = stopId; photoRef.current?.click(); }
  }

  async function uploadPhoto(stopId: string, file: File) {
    if (previewMode) return;
    setUploading(stopId);
    const path = `visits/${representativeId}/${stopId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('visit-photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('visit-photos').getPublicUrl(path);
      const now = new Date().toISOString();
      await supabase.from('route_stops').update({ proof_photo_url: urlData.publicUrl, proof_photo_lat: currentLat, proof_photo_lng: currentLng, proof_photo_at: now }).eq('id', stopId);
      setStops(prev => prev.map(s => s.id === stopId ? { ...s, proof_photo_url: urlData.publicUrl, proof_photo_at: now } : s));
    }
    setUploading(null);
  }

  function checkGeo(lat: number, lng: number) {
    if (previewMode) return;
    stops.forEach(async stop => {
      if (!stop.lat || !stop.lng || (stop.visit_status !== 'pending' && stop.visit_status !== 'in_progress')) return;
      const d = hav(lat, lng, stop.lat, stop.lng);
      if (d <= 0.5 && stop.visit_status === 'pending' && !stop.geofence_triggered) {
        await supabase.from('route_stops').update({ visit_status: 'in_progress', geofence_triggered: true, arrival_at: new Date().toISOString() }).eq('id', stop.id);
        setStops(prev => prev.map(s => s.id === stop.id ? { ...s, visit_status: 'in_progress' as VisitStatus, geofence_triggered: true } : s));
      }
    });
  }

  function openNav(stop: Stop) {
    if (!stop.lat || !stop.lng) return;
    const waze = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
    const maps = `https://maps.google.com/?daddr=${stop.lat},${stop.lng}`;
    window.open(window.confirm('Abrir no Waze? (Cancelar = Google Maps)') ? waze : maps, '_blank');
  }

  async function finalizeDay() {
    if (previewMode) return;
    if (!sel) return;
    setFinalizing(true);
    const completed = stops.filter(s => s.visit_status === 'completed').length;
    const notAtt = stops.filter(s => s.visit_status === 'not_attended').length;
    const pend = stops.filter(s => s.visit_status === 'pending' || s.visit_status === 'in_progress').length;
    const visitedOrder = stops.filter(s => s.visited_at).sort((a, b) => new Date(a.visited_at!).getTime() - new Date(b.visited_at!).getTime()).map(s => s.company_name);
    const plannedOrder = [...stops].sort((a, b) => a.stop_order - b.stop_order).map(s => s.company_name);
    const learned: Record<string, number> = {};
    visitedOrder.forEach((name, i) => { if (plannedOrder.indexOf(name) !== i) learned[name] = i; });
    await supabase.from('representative_routes').update({ status: 'completed', finalized_at: new Date().toISOString(), learned_order: { ...(sel.learned_order || {}), ...learned } }).eq('id', sel.id);
    setSel(prev => prev ? { ...prev, status: 'completed', finalized_at: new Date().toISOString() } : null);
    setFinalizing(false); setShowFinalize(false);
    alert(`Dia finalizado!\n✅ ${completed} concluídos\n❌ ${notAtt} não atendidos\n⏳ ${pend} pendentes`);
    fetchRoutes();
  }

  async function convertToClient(stop: Stop) {
    if (previewMode) return;
    const cnpj = prompt('CNPJ do cliente (somente números):');
    if (!cnpj) return;
    const { error } = await supabase.from('representative_clients').insert({ representative_id: representativeId, cnpj: cnpj.replace(/\D/g, ''), razao_social: stop.company_name, endereco_completo: stop.address, whatsapp_comprador: stop.phone || null, segment: stop.segment || null, status: 'active', is_active_client: true });
    if (!error) { alert(`${stop.company_name} convertido!`); onNavigateToOrder?.('new'); }
  }

  const pendingC = stops.filter(s => s.visit_status === 'pending').length;
  const inProgC = stops.filter(s => s.visit_status === 'in_progress').length;
  const compC = stops.filter(s => s.visit_status === 'completed').length;
  const notAttC = stops.filter(s => s.visit_status === 'not_attended').length;
  const totalW = stops.reduce((s, st) => s + (st.weight_kg || 0), 0);
  const maxW = sel?.max_weight_kg || 800;
  const wPct = Math.min(100, (totalW / maxW) * 100);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"/></div>;

  // ROUTE LIST
  if (!sel) return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-800">Minhas Rotas</h3>
      {routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">🗺️</p><p className="font-medium">Nenhuma rota atribuída</p><p className="text-sm mt-1">Aguarde o admin enviar uma rota</p></div>
      ) : routes.map(r => (
        <div key={r.id} onClick={() => { setSel(r); fetchStops(r.id); }} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-800">{r.name}</span>
                {r.route_type && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{ROUTE_TYPE_LABELS[r.route_type] || r.route_type}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {r.status === 'completed' ? 'Concluída' : r.status === 'active' ? 'Ativa' : r.status}
                </span>
              </div>
              {r.region && <p className="text-xs text-gray-500 mt-0.5">📍 {r.region}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('pt-BR')}{r.finalized_at && ` · Finalizada ${new Date(r.finalized_at).toLocaleDateString('pt-BR')}`}</p>
            </div>
            <span className="text-amber-600 text-lg ml-2">›</span>
          </div>
        </div>
      ))}
    </div>
  );

  // ROUTE DETAIL
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => { setSel(null); setStops([]); setViewMode('list'); }} className="text-sm text-gray-400 hover:text-gray-600">‹ Voltar</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-800">{sel.name}</h3>
            {sel.route_type && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{ROUTE_TYPE_LABELS[sel.route_type]}</span>}
          </div>
          {sel.region && <p className="text-xs text-gray-500">📍 {sel.region}</p>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-xs font-medium ${viewMode === 'list' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500'}`}>Lista</button>
          <button onClick={() => setViewMode('map')} className={`px-3 py-1 rounded-md text-xs font-medium ${viewMode === 'map' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500'}`}>Mapa</button>
        </div>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-4 gap-2">
        {[{ c: pendingC, l: 'Pendente', ...STATUS_CFG.pending }, { c: inProgC, l: 'Andamento', ...STATUS_CFG.in_progress }, { c: compC, l: 'Concluído', ...STATUS_CFG.completed }, { c: notAttC, l: 'Não atend.', ...STATUS_CFG.not_attended }].map(({ c, l, bg, tc }) => (
          <div key={l} style={{ background: bg }} className="rounded-lg p-2 text-center">
            <p style={{ color: tc }} className="text-xl font-semibold">{c}</p>
            <p style={{ color: tc }} className="text-xs">{l}</p>
          </div>
        ))}
      </div>

      {/* Weight bar */}
      {totalW > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1"><span>Carga total</span><span className={wPct > 90 ? 'text-red-600 font-medium' : ''}>{totalW.toFixed(1)}kg / {maxW}kg</span></div>
          <div className="bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full transition-all ${wPct > 90 ? 'bg-red-500' : wPct > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${wPct}%` }}/></div>
          {wPct > 90 && <p className="text-xs text-red-600 mt-1">⚠️ Próximo do limite máximo</p>}
        </div>
      )}

      {loadingStops ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"/></div> : viewMode === 'list' ? (
        <div className="space-y-2">
          {stops.map(stop => {
            const cfg = STATUS_CFG[stop.visit_status];
            const isOpen = openId === stop.id;
            return (
              <div key={stop.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-amber-400' : 'border-gray-200'}`}>
                <div className="p-3 cursor-pointer flex items-center gap-3" onClick={() => setOpenId(isOpen ? null : stop.id)}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0" style={{ background: cfg.color }}>{stop.stop_order}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{stop.company_name}</p>
                    <p className="text-xs text-gray-500 truncate">{stop.address}{stop.city ? `, ${stop.city}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stop.proof_photo_url && <span className="text-xs text-green-600">📷</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.tc }}>{cfg.label}</span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {stop.phone && <a href={`tel:${stop.phone}`} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg">📞 {stop.phone}</a>}
                      {stop.lat && stop.lng && <button onClick={() => openNav(stop)} className="flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">🧭 Navegar</button>}
                      {stop.phone && <a href={`https://wa.me/55${stop.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg">💬 WhatsApp</a>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Atualizar status:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(STATUS_CFG) as [VisitStatus, typeof STATUS_CFG.pending][]).map(([key, c]) => (
                          <button key={key} onClick={() => updateStatus(stop.id, key)} disabled={previewMode || updating === stop.id} title={previewMode ? 'Bloqueado no preview' : undefined}
                            className="text-xs py-2 px-3 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: stop.visit_status === key ? c.color : c.bg, color: stop.visit_status === key ? '#fff' : c.tc, borderColor: c.color }}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {stop.visit_status === 'completed' && (
                      <div>
                        {stop.proof_photo_url ? (
                          <div className="space-y-2">
                            <p className="text-xs text-green-600 font-medium">✅ Comprovante de entrega</p>
                            <img src={stop.proof_photo_url} alt="Comprovante" className="w-full rounded-lg border border-gray-200 max-h-32 object-cover" />
                            {stop.proof_photo_at && <p className="text-xs text-gray-400">📍 {new Date(stop.proof_photo_at).toLocaleString('pt-BR')}</p>}
                          </div>
                        ) : (
                          <button onClick={() => { if (previewMode) return; pendingStop.current = stop.id; photoRef.current?.click(); }} disabled={previewMode || uploading === stop.id}
                            className="w-full flex items-center justify-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2.5 rounded-lg hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                            {previewMode ? 'Bloqueado no preview' : uploading === stop.id ? 'Enviando...' : '📷 Tirar foto de comprovante'}
                          </button>
                        )}
                      </div>
                    )}
                    {(stop.visit_status === 'completed' || stop.visit_status === 'in_progress') && !stop.representative_client_id && (
                      <button onClick={() => convertToClient(stop)} disabled={previewMode} title={previewMode ? 'Bloqueado no preview' : undefined} className="w-full text-xs bg-[#8B2214] text-white py-2 rounded-lg hover:bg-[#6d1a10] disabled:cursor-not-allowed disabled:opacity-50">{previewMode ? 'Bloqueado no preview' : '🔄 Converter em cliente'}</button>
                    )}
                    {stop.segment && <p className="text-xs text-gray-400">Segmento: {SEGMENT_LABEL[stop.segment] ?? stop.segment}</p>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Finalizar dia */}
          {stops.length > 0 && !sel.finalized_at && (
            <div className="pt-2">
              {showFinalize ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">Confirmar finalização?</p>
                  <div className="text-xs text-amber-700 space-y-1">
                    <p>✅ {compC} concluídos</p><p>❌ {notAttC} não atendidos</p>
                    {pendingC > 0 && <p>⏳ {pendingC} pendentes → próximo dia</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowFinalize(false)} className="flex-1 text-xs border border-gray-300 text-gray-600 py-2 rounded-lg">Cancelar</button>
                    <button onClick={finalizeDay} disabled={previewMode || finalizing} className="flex-1 text-xs bg-[#8B2214] text-white py-2 rounded-lg disabled:cursor-not-allowed disabled:opacity-50">{previewMode ? 'Bloqueado no preview' : finalizing ? 'Finalizando...' : '🏁 Confirmar'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowFinalize(true)} disabled={previewMode} title={previewMode ? 'Bloqueado no preview' : undefined} className="w-full bg-gray-800 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50">{previewMode ? 'Bloqueado no preview' : '🏁 Finalizar dia'}</button>
              )}
            </div>
          )}
          {sel.finalized_at && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-sm font-medium text-green-700">✅ Rota finalizada</p>
              <p className="text-xs text-green-600 mt-0.5">{new Date(sel.finalized_at).toLocaleString('pt-BR')}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 360 }}>
          {stops.some(s => s.lat && s.lng) ? (
            <MapContainer center={[stops.find(s => s.lat)?.lat || -23.5, stops.find(s => s.lng)?.lng || -46.6]} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {currentLat && currentLng && (
                <Marker position={[currentLat, currentLng]} icon={L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 0 4px rgba(34,197,94,0.3)"></div>', iconSize: [14, 14] })}><Popup>Você está aqui</Popup></Marker>
              )}
              {stops.filter(s => s.lat && s.lng).map(stop => {
                const c = STATUS_CFG[stop.visit_status];
                return <Marker key={stop.id} position={[stop.lat!, stop.lng!]} icon={L.divIcon({ className: '', html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c.color};border:2px solid white;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:white;font-size:10px;font-weight:bold">${stop.stop_order}</span></div>`, iconSize: [28, 28] })}><Popup><strong>{stop.company_name}</strong><br/>{stop.address}<br/><span style={{ color: c.tc }}>{c.label}</span></Popup></Marker>;
              })}
              {stops.filter(s => s.lat && s.lng).length > 1 && <Polyline positions={stops.filter(s => s.lat && s.lng).sort((a,b) => a.stop_order - b.stop_order).map(s => [s.lat!, s.lng!])} color="#8B2214" weight={2} dashArray="6,4" opacity={0.6} />}
            </MapContainer>
          ) : <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400"><p className="text-sm">Sem coordenadas</p></div>}
        </div>
      )}

      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f && pendingStop.current) uploadPhoto(pendingStop.current, f); e.target.value = ''; }} />
    </div>
  );
}
