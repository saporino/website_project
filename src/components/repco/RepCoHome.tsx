import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { subscribeVisitLive, type VisitLivePayload } from '../../lib/promoterVisit';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { googleCalendarLink, outlookCalendarLink, downloadICS } from '../../utils/calendarLinks';

interface Stats { ordersThisMonth: number; revenueThisMonth: number; pendingCommission: number; activeClients: number; monthGoal: number; }
interface InactiveClient { id: string; nome_fantasia: string | null; razao_social: string | null; last_order_at: string | null; inactivity_snoozed_until: string | null; daysSinceOrder: number; }
interface UpcomingStop { id: string; company_name: string; address: string | null; city: string | null; scheduled_at: string; visit_status: string; lat: number; lng: number; route_name?: string; }
interface RecentOrder { id: string; order_number: string; total_amount: number; status: string; created_at: string; client_name: string; }
interface ProximityAlert { stopId: string; stopName: string; distanceMeters: number; }
interface Props { representativeId: string; onNavigateToRoute?: () => void; onNavigateToClient?: (clientId: string) => void; previewMode?: boolean; refreshKey?: number; }

const INACTIVITY_DAYS = 7;
const STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', pending: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS: Record<string, string> = { new: 'Novo', pending: 'Pendente', completed: 'Concluído', cancelled: 'Cancelado' };

export default function RepCoHome({ representativeId, onNavigateToRoute, onNavigateToClient, previewMode = false, refreshKey = 0 }: Props) {
  const [stats, setStats] = useState<Stats>({ ordersThisMonth: 0, revenueThisMonth: 0, pendingCommission: 0, activeClients: 0, monthGoal: 8000 });
  const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([]);
  const [upcomingStops, setUpcomingStops] = useState<UpcomingStop[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [calendarModal, setCalendarModal] = useState<UpcomingStop | null>(null);
  const [snoozingClient, setSnoozingClient] = useState<string | null>(null);
  // "Promotor na loja agora" — Realtime do módulo Promotor (Bloco 3)
  const [liveVisits, setLiveVisits] = useState<VisitLivePayload[]>([]);

  useEffect(() => {
    let myClientIds = new Set<string>();
    supabase.from('representative_clients').select('id').eq('representative_id', representativeId)
      .then(({ data }) => { myClientIds = new Set((data || []).map((c: { id: string }) => c.id)); });
    const unsub = subscribeVisitLive(p => {
      if (!myClientIds.has(p.clientId)) return;
      setLiveVisits(prev => p.type === 'checkin'
        ? (prev.some(x => x.visitId === p.visitId) ? prev : [...prev, p])
        : prev.filter(x => x.visitId !== p.visitId));
    });
    return unsub;
  }, [representativeId]);

  const { activeCompanyId } = useCompany();
  const { permission, requestPermission, sendNotification } = usePushNotifications();

  const handleProximityAlert = useCallback((alert: ProximityAlert) => {
    setProximityAlerts(prev => prev.find(a => a.stopId === alert.stopId) ? prev : [...prev, alert]);
    sendNotification(`📍 Visita próxima — ${alert.stopName}`, { body: `Você está a ${alert.distanceMeters}m. Toque para abrir a rota.`, tag: `proximity-${alert.stopId}` });
  }, [sendNotification]);

  const { coords, error: geoError } = useGeolocation({
    enabled: geoEnabled,
    proximityStops: upcomingStops.map(s => ({ id: s.id, name: s.company_name, lat: s.lat, lng: s.lng, scheduled_at: s.scheduled_at })),
    proximityRadiusMeters: 500,
    onProximityAlert: handleProximityAlert,
  });

  useEffect(() => { if (activeCompanyId) fetchAll(); }, [representativeId, refreshKey, activeCompanyId]);

  useEffect(() => {
    function handleRefresh() {
      fetchAll();
    }
    window.addEventListener('repco:clients-updated', handleRefresh);
    window.addEventListener('repco:orders-updated', handleRefresh);
    window.addEventListener('repco:prospection-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('repco:clients-updated', handleRefresh);
      window.removeEventListener('repco:orders-updated', handleRefresh);
      window.removeEventListener('repco:prospection-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [representativeId]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchStats(), fetchInactiveClients(), fetchUpcomingStops(), fetchRecentOrders()]);
    setLoading(false);
  }

  async function fetchStats() {
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ data: orders }, { data: commissions }, { count: clientCount }] = await Promise.all([
      supabase.from('representative_orders').select('total_amount,status').eq('representative_id', representativeId).eq('company_id', activeCompanyId).gte('created_at', firstDay),
      supabase.from('representative_commissions').select('commission_amount,status').eq('representative_id', representativeId).eq('company_id', activeCompanyId).eq('status', 'pending'),
      supabase.from('representative_clients').select('id', { count: 'exact', head: true }).eq('representative_id', representativeId).eq('company_id', activeCompanyId).eq('status', 'active'),
    ]);
    setStats(prev => ({
      ...prev,
      ordersThisMonth: orders?.length ?? 0,
      revenueThisMonth: orders?.reduce((s, o) => s + (o.total_amount || 0), 0) ?? 0,
      pendingCommission: commissions?.reduce((s, c) => s + (c.commission_amount || 0), 0) ?? 0,
      activeClients: clientCount ?? 0,
    }));
  }

  async function fetchInactiveClients() {
    const threshold = new Date(); threshold.setDate(threshold.getDate() - INACTIVITY_DAYS);
    const { data } = await supabase.from('representative_clients')
      .select('id,nome_fantasia,razao_social,last_order_at,inactivity_snoozed_until')
      .eq('representative_id', representativeId).eq('company_id', activeCompanyId).eq('status', 'active').eq('inactivity_alert_dismissed', false);
    if (!data) return;
    const now = new Date();
    setInactiveClients(
      data.filter(c => {
        if (c.inactivity_snoozed_until && new Date(c.inactivity_snoozed_until) > now) return false;
        return !c.last_order_at || new Date(c.last_order_at) < threshold;
      }).map(c => ({ ...c, daysSinceOrder: c.last_order_at ? Math.floor((Date.now() - new Date(c.last_order_at).getTime()) / 86400000) : 999 }))
      .sort((a, b) => b.daysSinceOrder - a.daysSinceOrder)
    );
  }

  async function fetchUpcomingStops() {
    const now = new Date(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
    const { data } = await supabase.from('route_stops')
      .select('id,company_name,address,city,scheduled_at,visit_status,lat,lng,representative_routes(name)')
      .not('scheduled_at', 'is', null).gte('scheduled_at', now.toISOString()).lte('scheduled_at', tomorrow.toISOString())
      .neq('visit_status', 'completed').order('scheduled_at');
    if (data) setUpcomingStops(data.map((s: any) => ({ ...s, route_name: s.representative_routes?.name })));
  }

  async function fetchRecentOrders() {
    const { data } = await supabase.from('representative_orders')
      .select('id,order_number,total_amount,status,created_at,representative_clients(nome_fantasia,razao_social)')
      .eq('representative_id', representativeId).eq('company_id', activeCompanyId).order('created_at', { ascending: false }).limit(5);
    if (data) setRecentOrders(data.map((o: any) => ({ id: o.id, order_number: o.order_number, total_amount: o.total_amount, status: o.status, created_at: o.created_at, client_name: o.representative_clients?.nome_fantasia || o.representative_clients?.razao_social || '—' })));
  }

  async function snoozeClient(clientId: string) {
    if (previewMode) {
      alert('Ação desativada no espelho.');
      return;
    }
    setSnoozingClient(clientId);
    const snoozeUntil = new Date(); snoozeUntil.setDate(snoozeUntil.getDate() + 2);
    await supabase.from('representative_clients').update({ inactivity_snoozed_until: snoozeUntil.toISOString() }).eq('id', clientId);
    setInactiveClients(prev => prev.filter(c => c.id !== clientId));
    window.dispatchEvent(new CustomEvent('repco:clients-updated', { detail: { representativeId } }));
    setSnoozingClient(null);
  }

  async function enableGPS() {
    if (previewMode) {
      alert('Ação desativada no espelho.');
      return;
    }
    if (permission !== 'granted') await requestPermission();
    setGeoEnabled(true);
  }

  const buildEvent = (stop: UpcomingStop) => ({ title: `Visita — ${stop.company_name}`, description: `Rota: ${stop.route_name ?? 'Saporino RepCo'}`, location: [stop.address, stop.city].filter(Boolean).join(', '), startDate: new Date(stop.scheduled_at), durationMinutes: 30 });
  const pct = Math.min(100, Math.round((stats.revenueThisMonth / stats.monthGoal) * 100));

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  return (
    <div className="space-y-4 pb-6">

      {/* Promotor na loja agora (Realtime) */}
      {liveVisits.map(lv => (
        <div key={lv.visitId} className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          <p className="text-sm text-amber-800"><strong>{lv.promoterName}</strong> está na loja <strong>{lv.clientName}</strong> agora <span className="text-amber-600">(entrou às {new Date(lv.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span></p>
        </div>
      ))}

      {/* Alertas de proximidade */}
      {proximityAlerts.map(alert => (
        <div key={alert.stopId} className="bg-[#a4240e] text-white rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📍</span>
            <div><p className="text-sm font-semibold">Você está a {alert.distanceMeters}m</p><p className="text-xs opacity-90">{alert.stopName} — visita agendada hoje</p></div>
          </div>
          <div className="flex gap-2">
            {onNavigateToRoute && <button onClick={() => { setProximityAlerts(p => p.filter(a => a.stopId !== alert.stopId)); onNavigateToRoute(); }} className="bg-white text-[#a4240e] text-xs font-semibold px-3 py-1.5 rounded-lg">Ver rota</button>}
            <button onClick={() => setProximityAlerts(p => p.filter(a => a.stopId !== alert.stopId))} className="opacity-75 hover:opacity-100 text-lg">✕</button>
          </div>
        </div>
      ))}

      {/* Stats 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-[#a4240e]">{stats.ordersThisMonth}</p><p className="text-xs text-gray-500 mt-0.5">Pedidos do mês</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center"><p className="text-lg font-bold text-[#a4240e]">R$ {stats.revenueThisMonth.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p><p className="text-xs text-gray-500 mt-0.5">Faturado</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center"><p className="text-lg font-bold text-green-600">R$ {stats.pendingCommission.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p><p className="text-xs text-gray-500 mt-0.5">Comissão pendente</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center"><p className="text-2xl font-bold text-[#a4240e]">{stats.activeClients}</p><p className="text-xs text-gray-500 mt-0.5">Clientes ativos</p></div>
      </div>

      {/* Meta do mês */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2"><p className="text-sm font-medium text-gray-700">Meta do mês</p><p className="text-sm font-bold text-[#a4240e]">{pct}%</p></div>
        <div className="bg-gray-100 rounded-full h-2.5 mb-1"><div className="bg-[#a4240e] h-2.5 rounded-full transition-all" style={{ width: pct + '%' }}/></div>
        <p className="text-xs text-gray-400">R$ {stats.revenueThisMonth.toLocaleString('pt-BR')} de R$ {stats.monthGoal.toLocaleString('pt-BR')}</p>
      </div>

      {/* GPS + Próximas visitas */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Próximas visitas (48h)</p>
          {!geoEnabled
            ? <button onClick={enableGPS} className="flex items-center gap-1.5 text-xs bg-[#f5f0ef] border border-[#ddd0cc] text-[#8B2214] px-3 py-1.5 rounded-lg font-medium hover:bg-[#ede5e3]">📍 Ativar GPS</button>
            : <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium"><span className="w-2 h-2 rounded-full bg-green-500"/>GPS ativo{coords && <span className="text-gray-400 ml-1">±{Math.round(coords.accuracy)}m</span>}</span>
          }
        </div>
        {geoError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{geoError}</p>}
        {upcomingStops.length === 0
          ? <p className="text-xs text-gray-400 text-center py-3">Nenhuma visita agendada nas próximas 48h.{onNavigateToRoute && <> <button onClick={onNavigateToRoute} className="text-[#a4240e] underline">Ver rotas</button></>}</p>
          : upcomingStops.map(stop => (
            <div key={stop.id} className="flex items-center gap-3 bg-[#f8f7f5] border border-gray-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-[#a4240e] flex items-center justify-center text-white text-lg flex-shrink-0">🗓</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{stop.company_name}</p>
                <p className="text-xs text-gray-500">{new Date(stop.scheduled_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                {stop.address && <p className="text-xs text-gray-400 truncate">{stop.address}</p>}
              </div>
              <button onClick={() => setCalendarModal(stop)} className="flex-shrink-0 text-xs bg-white border border-gray-200 text-[#8B2214] px-2 py-1.5 rounded-lg hover:bg-[#f5f0ef]">+ Cal</button>
            </div>
          ))
        }
      </div>

      {/* Alertas de inatividade */}
      {inactiveClients.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1"><span>⚠️</span><p className="text-sm font-semibold text-red-700">{inactiveClients.length} cliente{inactiveClients.length > 1 ? 's' : ''} sem comprar há {INACTIVITY_DAYS}+ dias</p></div>
          {inactiveClients.slice(0, 5).map(client => (
            <div key={client.id} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{client.nome_fantasia || client.razao_social}</p>
                <p className="text-xs text-red-500">{client.daysSinceOrder >= 999 ? 'Nunca comprou' : `${client.daysSinceOrder} dias sem comprar`}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {onNavigateToClient && <button onClick={() => onNavigateToClient(client.id)} className="text-xs bg-[#a4240e] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#8a1f0c]">Pedido</button>}
                <button onClick={() => snoozeClient(client.id)} disabled={snoozingClient === client.id} className="text-xs bg-white border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50" title="Adiar 2 dias">{snoozingClient === client.id ? '...' : '+2d'}</button>
              </div>
            </div>
          ))}
          {inactiveClients.length > 5 && <p className="text-xs text-gray-400 text-center">+{inactiveClients.length - 5} outros clientes inativos</p>}
        </div>
      )}

      {/* Últimos pedidos */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Últimos pedidos</p>
        {recentOrders.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">Nenhum pedido ainda.</p>
          : <div className="space-y-2">{recentOrders.map(order => (
            <div key={order.id} className="flex items-center justify-between">
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{order.client_name}</p><p className="text-xs text-gray-400">{order.order_number} · {new Date(order.created_at).toLocaleDateString('pt-BR')}</p></div>
              <div className="flex items-center gap-2 flex-shrink-0"><span className="text-sm font-medium">R$ {order.total_amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_LABELS[order.status] ?? order.status}</span></div>
            </div>
          ))}</div>
        }
      </div>

      {/* Calendar modal */}
      {calendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setCalendarModal(null)}>
          <div className="bg-white rounded-t-2xl p-5 w-full space-y-3 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-800">Adicionar ao calendário</p>
            <p className="text-sm text-gray-500">{calendarModal.company_name}</p>
            <p className="text-xs text-gray-400">{new Date(calendarModal.scheduled_at).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
            <a href={googleCalendarLink(buildEvent(calendarModal))} target="_blank" rel="noreferrer" className="flex items-center gap-3 w-full bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50"><span className="text-xl">📅</span><span className="text-sm font-medium text-gray-700">Google Calendar</span></a>
            <a href={outlookCalendarLink(buildEvent(calendarModal))} target="_blank" rel="noreferrer" className="flex items-center gap-3 w-full bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50"><span className="text-xl">📆</span><span className="text-sm font-medium text-gray-700">Outlook Calendar</span></a>
            <button onClick={() => { downloadICS(buildEvent(calendarModal!)); setCalendarModal(null); }} className="flex items-center gap-3 w-full bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50"><span className="text-xl">📱</span><span className="text-sm font-medium text-gray-700">Calendário do celular (.ics)</span></button>
            <button onClick={() => setCalendarModal(null)} className="w-full text-sm text-gray-400 py-2 hover:text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
