import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface RepPresence {
  id: string; full_name: string; is_online: boolean; last_seen_at: string | null;
  last_lat: number | null; last_lng: number | null; current_tab: string | null;
  commission_rate: number; status: string; todayOrders: number; todayRevenue: number;
}

interface SaleAnimation {
  id: string; lat: number; lng: number; amount: number; clientName: string; repName: string; timestamp: number;
}

interface RouteStop { lat: number; lng: number; visit_status: string; company_name: string; }

const TAB_LABELS: Record<string, string> = {
  inicio: 'Início', clients: 'Clientes', novo_pedido: 'Fazendo pedido',
  rotas: 'Na rota', commissions: 'Comissões', profile: 'Perfil',
};

const STOP_COLORS: Record<string, string> = {
  pending: '#ef4444', in_progress: '#3b82f6', completed: '#22c55e', not_attended: '#f97316',
};

function makeRepIcon(isOnline: boolean, minutesAgo: number) {
  const color = isOnline && minutesAgo < 2 ? '#22c55e' : isOnline && minutesAgo < 10 ? '#eab308' : '#9ca3af';
  const pulse = isOnline && minutesAgo < 2;
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px">
      ${pulse ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.3;animation:repPulse 1.5s ease-out infinite"></div>` : ''}
      <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px">👤</div>
    </div>`,
    iconSize: [36, 36], iconAnchor: [18, 18], className: '',
  });
}

function makeSaleIcon(amount: number) {
  return L.divIcon({
    html: `<div style="background:#22c55e;color:#fff;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);border:2px solid #fff;animation:saleAppear 8s ease forwards">✓ R$ ${amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>`,
    iconSize: [120, 28], iconAnchor: [60, 14], className: '',
  });
}

function getMinutesAgo(lastSeen: string | null) {
  if (!lastSeen) return 999;
  return Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
}

function getStatusStyle(rep: RepPresence) {
  const min = getMinutesAgo(rep.last_seen_at);
  if (rep.is_online && min < 2) return { badge: 'bg-green-100 text-green-700', label: 'Online agora' };
  if (rep.is_online && min < 10) return { badge: 'bg-yellow-100 text-yellow-700', label: `${min}min atrás` };
  if (rep.last_seen_at) return { badge: 'bg-gray-100 text-gray-500', label: `Visto ${new Date(rep.last_seen_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` };
  return { badge: 'bg-gray-100 text-gray-400', label: 'Offline' };
}

export default function RepCoLiveMap() {
  const [reps, setReps] = useState<RepPresence[]>([]);
  const [saleAnimations, setSaleAnimations] = useState<SaleAnimation[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [repRouteStops, setRepRouteStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const repsRef = useRef<RepPresence[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const center: [number, number] = [-23.55052, -46.633308];

  useEffect(() => { repsRef.current = reps; }, [reps]);

  useEffect(() => {
    fetchReps();
    const tick = setInterval(() => setLastUpdate(new Date()), 30000);
    return () => { clearInterval(tick); if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  useEffect(() => {
    if (reps.length === 0) return;
    setupRealtime();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [reps.length > 0]);

  async function fetchReps() {
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [{ data: repsData }, { data: ordersData }] = await Promise.all([
      supabase.from('representatives').select('id,full_name,is_online,last_seen_at,last_lat,last_lng,current_tab,commission_rate,status').eq('status', 'active').order('full_name'),
      supabase.from('representative_orders').select('representative_id,total_amount,status').gte('created_at', today.toISOString()),
    ]);
    if (!repsData) { setLoading(false); return; }
    setReps(repsData.map(rep => ({
      ...rep,
      todayOrders: ordersData?.filter(o => o.representative_id === rep.id).length ?? 0,
      todayRevenue: ordersData?.filter(o => o.representative_id === rep.id).reduce((s, o) => s + (o.total_amount || 0), 0) ?? 0,
    })));
    setLoading(false);
  }

  function setupRealtime() {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase.channel('repco-live-map')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'representatives' }, payload => {
        setReps(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
        setLastUpdate(new Date());
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'representative_orders' }, async payload => {
        const order = payload.new;
        const rep = repsRef.current.find(r => r.id === order.representative_id);
        if (!rep?.last_lat || !rep?.last_lng) return;
        let clientName = 'Cliente';
        if (order.representative_client_id) {
          const { data } = await supabase.from('representative_clients').select('nome_fantasia,razao_social').eq('id', order.representative_client_id).single();
          clientName = data?.nome_fantasia || data?.razao_social || 'Cliente';
        }
        const anim: SaleAnimation = { id: order.id, lat: rep.last_lat, lng: rep.last_lng + 0.002, amount: order.total_amount, clientName, repName: rep.full_name, timestamp: Date.now() };
        setSaleAnimations(prev => [...prev, anim]);
        setTimeout(() => setSaleAnimations(prev => prev.filter(a => a.id !== anim.id)), 8000);
        setReps(prev => prev.map(r => r.id === order.representative_id ? { ...r, todayOrders: r.todayOrders + 1, todayRevenue: r.todayRevenue + order.total_amount } : r));
      })
      .subscribe();
  }

  async function toggleRepRoute(repId: string) {
    if (selectedRepId === repId) { setSelectedRepId(null); setRepRouteStops([]); return; }
    setSelectedRepId(repId);
    const { data } = await supabase.from('route_stops')
      .select('lat,lng,visit_status,company_name,representative_routes!inner(representative_id)')
      .eq('representative_routes.representative_id', repId)
      .not('lat', 'is', null).order('stop_order');
    if (data) setRepRouteStops(data as RouteStop[]);
  }

  const onlineCount = reps.filter(r => r.is_online && getMinutesAgo(r.last_seen_at) < 10).length;
  const repsWithCoords = reps.filter(r => r.last_lat && r.last_lng);
  const todayRevenue = reps.reduce((s, r) => s + r.todayRevenue, 0);
  const todayOrders = reps.reduce((s, r) => s + r.todayOrders, 0);
  const routePolyline = repRouteStops.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng] as [number, number]);
  const ranked = [...reps].sort((a, b) => b.todayRevenue - a.todayRevenue);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"/></div>;

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes repPulse { 0%{transform:scale(1);opacity:.3} 100%{transform:scale(2.5);opacity:0} }
        @keyframes saleAppear { 0%{transform:scale(0) translateY(10px);opacity:0} 20%{transform:scale(1.1) translateY(-5px);opacity:1} 80%{transform:scale(1);opacity:1} 100%{transform:scale(.8) translateY(-20px);opacity:0} }
      `}</style>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Online agora', value: onlineCount, color: 'text-green-600' },
          { label: 'Reps ativos', value: reps.length, color: 'text-amber-700' },
          { label: 'Vendido hoje', value: `R$ ${todayRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, color: 'text-amber-700', small: true },
          { label: 'Pedidos hoje', value: todayOrders, color: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className={`font-bold ${s.color} ${s.small ? 'text-lg' : 'text-2xl'}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Mapa */}
        <div className="flex-1">
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '500px' }}>
            <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
              {routePolyline.length > 1 && <Polyline positions={routePolyline} color="#d97706" weight={2} dashArray="6,4" opacity={0.7}/>}
              {repRouteStops.map((stop, i) => stop.lat && stop.lng && (
                <Circle key={i} center={[stop.lat, stop.lng]} radius={80}
                  pathOptions={{ color: STOP_COLORS[stop.visit_status] ?? '#888', fillColor: STOP_COLORS[stop.visit_status] ?? '#888', fillOpacity: 0.5, weight: 1 }}/>
              ))}
              {repsWithCoords.map(rep => (
                <Marker key={rep.id} position={[rep.last_lat!, rep.last_lng!]}
                  icon={makeRepIcon(rep.is_online, getMinutesAgo(rep.last_seen_at))}
                  eventHandlers={{ click: () => toggleRepRoute(rep.id) }}>
                  <Popup>
                    <div style={{ minWidth: '180px', fontFamily: 'system-ui' }}>
                      <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{rep.full_name}</p>
                      <p style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{rep.current_tab ? TAB_LABELS[rep.current_tab] ?? rep.current_tab : '—'}</p>
                      <p style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{getStatusStyle(rep).label}</p>
                      <div style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
                        <p style={{ fontSize: 11 }}><strong>{rep.todayOrders}</strong> pedidos hoje</p>
                        <p style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>R$ {rep.todayRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {saleAnimations.map(sale => <Marker key={sale.id} position={[sale.lat, sale.lng]} icon={makeSaleIcon(sale.amount)} interactive={false}/>)}
            </MapContainer>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-400">Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            {selectedRepId && <button onClick={() => { setSelectedRepId(null); setRepRouteStops([]); }} className="text-xs text-amber-600 underline">Ocultar rota</button>}
          </div>
        </div>

        {/* Ranking lateral */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-1">Ranking do dia</p>
          {ranked.length === 0
            ? <div className="text-center py-8 text-gray-400"><p className="text-3xl mb-2">👥</p><p className="text-xs">Nenhum representante ativo</p></div>
            : ranked.map((rep, i) => {
              const { badge, label } = getStatusStyle(rep);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={rep.id} onClick={() => toggleRepRoute(rep.id)}
                  className={`bg-white border rounded-xl p-3 cursor-pointer transition-all hover:border-amber-300 ${selectedRepId === rep.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base flex-shrink-0">{medals[i] ?? `${i + 1}`}</span>
                    <p className="text-xs font-medium text-gray-800 truncate flex-1">{rep.full_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${badge}`}>
                      {rep.is_online && getMinutesAgo(rep.last_seen_at) < 2 ? '●' : '○'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{rep.todayOrders} pedidos</span>
                    <span className="text-xs font-semibold text-amber-700">R$ {rep.todayRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                  </div>
                  {rep.current_tab && rep.is_online && getMinutesAgo(rep.last_seen_at) < 10 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">📍 {TAB_LABELS[rep.current_tab] ?? rep.current_tab}</p>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
