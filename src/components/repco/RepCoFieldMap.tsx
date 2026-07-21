import { useState, useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css'; // CSS do Leaflet — SEM isto os tiles renderizam quebrados/em escada
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from 'sonner';
import { MapPin, Navigation2, CheckCircle, AlertCircle, RotateCcw, Truck, ShoppingBag, Users, Edit2, UserPlus } from 'lucide-react';

interface Props {
  representativeId: string;
  currentLat?: number;
  currentLng?: number;
  previewMode?: boolean;
  refreshKey?: number;
  onEditLead?: (leadData: {
    razao_social: string; endereco_completo: string; whatsapp_comprador: string;
    cnpj: string | null; segment: string | null; lat: number | null; lng: number | null;
    municipio: string | null; uf: string | null;
  }) => void;
  /** Chamado ao finalizar entrega no mapa — navega para aba Entregas com aquele pedido destacado */
  onFinalizeDelivery?: (orderId: string) => void;
  /** Treinamento ao vivo: reporta a posição/zoom do mapa (instrutor transmite) */
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void;
  /** Treinamento ao vivo: aplica a posição/zoom recebida (rep/espelho segue o instrutor) */
  syncView?: { lat: number; lng: number; zoom: number } | null;
}

type MapMode = 'visitar' | 'pedidos' | 'entregas';

interface MapPin {
  id: string;
  number: number;
  lat: number;
  lng: number;
  label: string;
  sublabel: string;
  status: string;
  color: string;
  isPulsing?: boolean;
  data: Record<string, any>;
}

// Cores por status
const PIN_COLORS: Record<string, string> = {
  // Visitar
  assigned: '#DC2626',      // vermelho — não visitado
  pending_visit: '#EA580C', // laranja — voltar depois
  in_progress: '#2563EB',   // azul — em andamento
  visited: '#16A34A',       // verde — check-in feito
  converted: '#7C3AED',     // roxo — virou cliente
  rejected: '#6B7280',      // cinza — não deu certo
  // Pedidos
  new: '#2563EB',
  pending: '#CA8A04',
  completed: '#16A34A',
  cancelled: '#6B7280',
  // Entregas
  pendente: '#EA580C',
  em_rota: '#2563EB',
  entregue: '#16A34A',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtDist(km: number) { return km < 1 ? `${Math.round(km*1000)}m` : `${km.toFixed(1)}km`; }
function fmtBRL(v: number) { return `R$ ${(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

const STATUS_LABEL: Record<string, string> = {
  assigned:'Atribuído', pending_visit:'Voltar depois', in_progress:'Em andamento',
  visited:'Visitado', converted:'Cliente', rejected:'Não deu certo',
  new:'Novo', pending:'Pendente', completed:'Concluído', cancelled:'Cancelado',
  pendente:'A entregar', em_rota:'Em rota', entregue:'Entregue',
};

interface DayBlock {
  date: string; // YYYY-MM-DD
  items: Array<{ id: string; label: string; sublabel: string; status: string; time?: string; isPending: boolean }>;
}

export default function RepCoFieldMap({ representativeId, currentLat, currentLng, previewMode = false, refreshKey = 0, onEditLead, onFinalizeDelivery, onViewChange, syncView }: Props) {
  const [mode, setMode] = useState<MapMode>('visitar');
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const { activeCompanyId } = useCompany();
  const [busy, setBusy] = useState(false);
  const [askGondola, setAskGondola] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', address: '', phone: '' });
  useEffect(() => { setAskGondola(false); }, [selectedPin?.id]);
  // Histórico diário abaixo do mapa
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const markersRef = useRef<any[]>([]);
  const userHasInteracted = useRef(false);
  // Treinamento ao vivo: transmitir/obedecer a posição do mapa. Refs evitam listeners
  // duplicados e closures velhas. applyingSyncRef impede loop (setView -> moveend -> broadcast).
  const onViewChangeRef = useRef(onViewChange);
  const syncViewRef = useRef(syncView);
  const applyingSyncRef = useRef(false);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => { syncViewRef.current = syncView; }, [syncView]);
  // Controla fitBounds: só faz UMA vez por modo (na primeira carga).
  // Quando o usuário muda de aba, hasInitialFit reseta → fitBounds roda de novo.
  // Quando dados atualizam (fetchPins, GPS) → hasInitialFit já é true → sem reset.
  const hasInitialFit = useRef(false);
  // Ref para evitar loop no useEffect de auto-pulsing
  const pulsingIdRef = useRef<string | null>(null);
  useEffect(() => { pulsingIdRef.current = pulsingId; }, [pulsingId]);

  // GPS num ref: o GPS do celular atualiza toda hora; se ele entrar nas dependências
  // de fetchPins/effects, cada atualização re-dispara a busca -> loop de spinner (bug).
  // No ref, usamos a posição pra ordenar/mover o ponto SEM re-buscar.
  const coordsRef = useRef<{ lat?: number; lng?: number }>({ lat: currentLat, lng: currentLng });
  useEffect(() => { coordsRef.current = { lat: currentLat, lng: currentLng }; }, [currentLat, currentLng]);
  const repMarkerRef = useRef<any>(null);

  const hasGps = currentLat !== undefined && currentLng !== undefined;

  // Supabase retorna a relação como objeto OU array dependendo do contexto —
  // normaliza para sempre ser um objeto (ou null).
  function getClient(o: any) {
    const c = o.representative_clients;
    return Array.isArray(c) ? (c[0] ?? null) : (c ?? null);
  }

  // Aplica um pequeno deslocamento (~100-300m) em pinos que compartilham as
  // mesmas coordenadas (ex.: vários clientes com coords do centro da cidade).
  // Usa o índice para gerar um offset determinístico em espiral.
  function jitterPins(pins: MapPin[]): MapPin[] {
    const seen = new Map<string, number>();
    return pins.map(pin => {
      const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
      const count = seen.get(key) || 0;
      seen.set(key, count + 1);
      if (count === 0) return pin; // primeiro pin nessa posição: sem jitter
      // Distribui em ângulos de 45° com raio de ~0.002° (~200m)
      const angle = (count * 45 * Math.PI) / 180;
      const radius = 0.002 * Math.ceil(count / 8);
      return { ...pin, lat: pin.lat + radius * Math.cos(angle), lng: pin.lng + radius * Math.sin(angle) };
    });
  }

  const fetchPins = useCallback(async () => {
    setLoading(true);
    setSelectedPin(null);
    // GPS lido do ref (não das deps) — ordena por distância sem re-buscar a cada update.
    const { lat: gLat, lng: gLng } = coordsRef.current;
    const gGps = gLat != null && gLng != null;

    if (mode === 'visitar') {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('rep_daily_plans')
        .select('lead_id, prospect_leads(id, company_name, address, number, city, state, lat, lng, phone, whatsapp, status, category)')
        .eq('representative_id', representativeId)
        .eq('plan_date', today);

      const rows = (data || [])
        .map((d: any) => Array.isArray(d.prospect_leads) ? d.prospect_leads[0] : d.prospect_leads)
        .filter((l: any) => l?.lat != null && l?.lng != null
          // Concluídos saem do mapa ativo (ficam só no histórico abaixo)
          && !['visited', 'converted', 'rejected'].includes(l?.status || ''));
      const sorted = gGps
        ? [...rows].sort((a: any, b: any) => haversineKm(gLat!, gLng!, a.lat, a.lng) - haversineKm(gLat!, gLng!, b.lat, b.lng))
        : rows;
      setPins(jitterPins(sorted.map((l: any, i: number) => ({
        id: l.id, number: i+1, lat: l.lat, lng: l.lng,
        label: l.company_name,
        sublabel: [l.address, l.city, l.state].filter(Boolean).join(', '),
        status: l.status || 'assigned',
        color: PIN_COLORS[l.status || 'assigned'] || PIN_COLORS.assigned,
        data: l,
      }))));

    } else if (mode === 'pedidos') {
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, status, total_amount, representative_clients(razao_social, lat, lng, municipio, uf, endereco_completo)')
        .eq('representative_id', representativeId)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(60);

      const rows = (data || [])
        .map((o: any) => ({ ...o, _c: getClient(o) }))
        .filter((o: any) => o._c?.lat != null && o._c?.lng != null);
      setPins(jitterPins(rows.map((o: any, i: number) => ({
        id: o.id, number: i+1, lat: o._c.lat, lng: o._c.lng,
        label: o.order_number || '—',
        sublabel: o._c?.razao_social || '—',
        status: o.status,
        color: PIN_COLORS[o.status] || PIN_COLORS.new,
        data: o,
      }))));

    } else { // entregas
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, total_amount, delivery_status, representative_clients(razao_social, lat, lng, endereco_completo, municipio, uf)')
        .eq('representative_id', representativeId)
        .eq('company_id', activeCompanyId)
        .in('delivery_status', ['pendente', 'em_rota']);

      const rows = (data || [])
        .map((o: any) => ({ ...o, _c: getClient(o) }))
        .filter((o: any) => o._c?.lat != null && o._c?.lng != null);
      const sorted = gGps
        ? [...rows].sort((a: any, b: any) => haversineKm(gLat!, gLng!, a._c.lat, a._c.lng) - haversineKm(gLat!, gLng!, b._c.lat, b._c.lng))
        : rows;
      setPins(jitterPins(sorted.map((o: any, i: number) => ({
        id: o.id, number: i+1, lat: o._c.lat, lng: o._c.lng,
        label: o.order_number || '—',
        sublabel: `${o._c?.razao_social || '—'} · ${o._c?.municipio || ''}`,
        status: o.delivery_status || 'pendente',
        color: PIN_COLORS[o.delivery_status || 'pendente'],
        data: o,
      }))));
    }
    // ── HISTÓRICO DIÁRIO ──
    await fetchHistory();
    setLoading(false);
  }, [mode, representativeId, refreshKey, activeCompanyId]);

  const fetchHistory = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    let blocks: DayBlock[] = [];

    if (mode === 'visitar') {
      const { data } = await supabase
        .from('rep_daily_plans')
        .select('plan_date, prospect_leads(id, company_name, status, visited_at, category)')
        .eq('representative_id', representativeId)
        .order('plan_date', { ascending: false })
        .limit(14);
      const byDate: Record<string, any[]> = {};
      (data || []).forEach((row: any) => {
        const d = row.plan_date;
        const lead = Array.isArray(row.prospect_leads) ? row.prospect_leads[0] : row.prospect_leads;
        if (!lead) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(lead);
      });
      blocks = Object.entries(byDate).map(([date, leads]) => ({
        date,
        items: leads.map((l: any) => ({
          id: l.id, label: l.company_name, sublabel: l.category || '',
          status: l.status || 'assigned',
          time: l.visited_at ? new Date(l.visited_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
          isPending: !['visited', 'converted', 'rejected'].includes(l.status || 'assigned'),
        })),
      }));

    } else if (mode === 'pedidos') {
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, status, total_amount, created_at, representative_clients(razao_social, municipio)')
        .eq('representative_id', representativeId)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(60);
      const byDate: Record<string, any[]> = {};
      (data || []).forEach((o: any) => {
        const d = o.created_at?.split('T')[0];
        if (!d) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(o);
      });
      blocks = Object.entries(byDate).map(([date, orders]) => ({
        date,
        items: orders.map((o: any) => {
          const c = getClient(o);
          return {
            id: o.id, label: o.order_number || '—',
            sublabel: `${c?.razao_social || '—'} · R$ ${(o.total_amount||0).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})}`,
            status: o.status, time: undefined,
            isPending: !['completed', 'cancelled'].includes(o.status || ''),
          };
        }),
      }));

    } else { // entregas
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, delivery_status, total_amount, delivery_accepted_at, delivered_at, representative_clients(razao_social, municipio)')
        .eq('representative_id', representativeId)
        .eq('company_id', activeCompanyId)
        .not('delivery_accepted_at', 'is', null)
        .order('delivery_accepted_at', { ascending: false })
        .limit(30);
      const byDate: Record<string, any[]> = {};
      (data || []).forEach((o: any) => {
        const d = (o.delivery_accepted_at || o.delivered_at)?.split('T')[0];
        if (!d) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(o);
      });
      blocks = Object.entries(byDate).map(([date, orders]) => ({
        date,
        items: orders.map((o: any) => {
          const c = getClient(o);
          return {
            id: o.id, label: o.order_number || '—',
            sublabel: `${c?.razao_social || '—'} · R$ ${(o.total_amount||0).toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})}`,
            status: o.delivery_status || 'pendente',
            time: o.delivered_at ? new Date(o.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
            isPending: o.delivery_status !== 'entregue',
          };
        }),
      }));
    }

    setDayBlocks(blocks);
    // Hoje sempre expandido por padrão
    setExpandedDays(prev => { const n = new Set(prev); n.add(today); return n; });
  }, [mode, representativeId, activeCompanyId]);

  async function continuarPendentes(date: string) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    const today = new Date().toISOString().split('T')[0];
    const block = dayBlocks.find(b => b.date === date);
    if (!block) return;
    const pendingIds = block.items.filter(i => i.isPending).map(i => i.id);
    if (!pendingIds.length) return;
    const rows = pendingIds.map(lead_id => ({ representative_id: representativeId, lead_id, plan_date: today }));
    const { error } = await supabase.from('rep_daily_plans').upsert(rows, { onConflict: 'representative_id,lead_id,plan_date' });
    if (error) { toast.error('Erro ao continuar pendentes'); return; }
    toast.success(`${pendingIds.length} visita${pendingIds.length > 1 ? 's' : ''} adicionada${pendingIds.length > 1 ? 's' : ''} ao plano de hoje!`);
    await fetchHistory();
    window.dispatchEvent(new CustomEvent('repco:map-updated', { detail: { representativeId } }));
  }

  useEffect(() => { fetchPins(); }, [fetchPins]);
  // Ao mudar de aba (modo), reseta refs
  useEffect(() => {
    userHasInteracted.current = false;
    hasInitialFit.current = false;
    setPulsingId(null);
  }, [mode]);

  // Decide se um pino está pendente (deve piscar / ficar no mapa)
  function isPending(pin: MapPin) {
    if (mode === 'visitar') return !['visited', 'converted', 'rejected'].includes(pin.status);
    if (mode === 'entregas') return pin.status !== 'entregue';
    return !['completed', 'cancelled'].includes(pin.status);
  }

  // Auto-pulsing: sempre que os pinos mudam, garante que o mais próximo pendente está piscando.
  // Só troca se o atual pulsing foi concluído (saiu dos pins pendentes).
  useEffect(() => {
    if (loading) return;
    const pending = pins.filter(isPending);
    if (pending.length === 0) { setPulsingId(null); return; }
    const currentStillPending = pending.find(p => p.id === pulsingIdRef.current);
    if (currentStillPending) return; // atual ainda pendente → mantém
    const { lat: gLat, lng: gLng } = coordsRef.current;
    const nearest = (gLat != null && gLng != null)
      ? [...pending].sort((a, b) => haversineKm(gLat, gLng, a.lat, a.lng) - haversineKm(gLat, gLng, b.lat, b.lng))[0]
      : pending[0];
    setPulsingId(nearest.id);
  }, [pins, mode, loading]);

  // Renderiza o mapa Leaflet
  useEffect(() => {
    if (!mapRef.current || loading) return;
    let L: any;

    async function initMap() {
      L = (await import('leaflet')).default;
      if (!leafletMap.current) {
        const mapCenter = (coordsRef.current.lat != null && coordsRef.current.lng != null)
          ? [coordsRef.current.lat, coordsRef.current.lng] : [-23.185, -47.010];
        leafletMap.current = L.map(mapRef.current!, {
          zoomControl: true, attributionControl: false, scrollWheelZoom: true,
          center: mapCenter, zoom: 13,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap.current);
        // Marca interação manual — zoom e pan feitos pelo usuário não são revertidos após ações
        leafletMap.current.on('movestart', (e: any) => {
          if (e.originalEvent) userHasInteracted.current = true; // só eventos reais do usuário
        });
        // Treinamento: instrutor transmite a posição/zoom ao mover/dar zoom
        const emitView = () => {
          if (applyingSyncRef.current || !onViewChangeRef.current || !leafletMap.current) return;
          const c = leafletMap.current.getCenter();
          onViewChangeRef.current({ lat: c.lat, lng: c.lng, zoom: leafletMap.current.getZoom() });
        };
        leafletMap.current.on('moveend', emitView);
        leafletMap.current.on('zoomend', emitView);
        // Se já chegou uma posição do instrutor antes do mapa existir, aplica agora
        if (syncViewRef.current) {
          applyingSyncRef.current = true;
          leafletMap.current.setView([syncViewRef.current.lat, syncViewRef.current.lng], syncViewRef.current.zoom);
          setTimeout(() => { applyingSyncRef.current = false; }, 400);
        }
      }
      // Recalcula o tamanho quando o container muda/aparece (aba trocada, layout assentando).
      // Sem isso os tiles do Leaflet renderizam quebrados/desalinhados ao montar em aba oculta.
      if (!resizeObsRef.current && mapRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObsRef.current = new ResizeObserver(() => leafletMap.current?.invalidateSize());
        resizeObsRef.current.observe(mapRef.current);
      }
      [60, 250, 600].forEach(ms => setTimeout(() => leafletMap.current?.invalidateSize(), ms));

      // Remove markers antigos
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // GPS do rep — ponto "você está aqui" (guardado em ref p/ mover sem re-render)
      const { lat: rLat, lng: rLng } = coordsRef.current;
      const rGps = rLat != null && rLng != null;
      if (rGps) {
        const repIcon = L.divIcon({
          html: `<div style="width:18px;height:18px;background:#8B2214;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        });
        repMarkerRef.current = L.marker([rLat, rLng], { icon: repIcon }).addTo(leafletMap.current);
      }

      // Pinos dos dados
      const bounds: [number,number][] = rGps ? [[rLat!, rLng!]] : [];
      pins.forEach(pin => {
        const isPulsing = pin.id === pulsingId;
        const icon = L.divIcon({
          html: `<div style="
            width:32px;height:32px;background:${pin.color};border:2px solid white;
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            display:flex;align-items:center;justify-content:center;
            ${isPulsing ? 'animation:pulse-pin 1s ease-in-out infinite;' : ''}
          ">
            <span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:700;line-height:1">${pin.number}</span>
          </div>
          <style>@keyframes pulse-pin{0%,100%{transform:rotate(-45deg) scale(1);box-shadow:0 2px 8px rgba(0,0,0,0.35)}50%{transform:rotate(-45deg) scale(1.3);box-shadow:0 4px 16px rgba(139,34,20,0.6)}}</style>`,
          className: '', iconSize: [32, 36], iconAnchor: [10, 36], popupAnchor: [6, -36],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(leafletMap.current);
        marker.on('click', () => setSelectedPin(pin));
        markersRef.current.push(marker);
        bounds.push([pin.lat, pin.lng]);
      });

      // fitBounds só na PRIMEIRA carga de cada modo.
      // Depois disso (GPS update, check-in, refresh) o zoom NÃO reseta.
      // Mudar de aba reseta hasInitialFit → fitBounds roda de novo ao entrar na aba.
      if (!hasInitialFit.current && bounds.length > 0 && !syncViewRef.current) {
        hasInitialFit.current = true;
        if (bounds.length > 1) {
          leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else {
          leafletMap.current.setView(bounds[0], 13);
        }
      }
    }

    initMap();
    return () => { if (!mapRef.current) { resizeObsRef.current?.disconnect(); resizeObsRef.current = null; leafletMap.current?.remove(); leafletMap.current = null; } };
    // GPS (currentLat/Lng) NÃO entra aqui: senão o mapa se redesenha a cada update do
    // GPS -> piscava/recarregava em loop. O ponto "você está aqui" é movido no effect abaixo.
  }, [pins, pulsingId, loading]);

  // Move só o ponto GPS quando a localização muda — sem reconstruir o mapa/pinos.
  useEffect(() => {
    if (currentLat == null || currentLng == null || !repMarkerRef.current) return;
    try { repMarkerRef.current.setLatLng([currentLat, currentLng]); } catch { /* mapa recriando */ }
  }, [currentLat, currentLng]);

  // Treinamento: rep/espelho recebe a posição do instrutor e move o mapa pra lá.
  useEffect(() => {
    if (!syncView || !leafletMap.current) return;
    applyingSyncRef.current = true;
    leafletMap.current.setView([syncView.lat, syncView.lng], syncView.zoom, { animate: true });
    const t = setTimeout(() => { applyingSyncRef.current = false; }, 500);
    return () => clearTimeout(t);
  }, [syncView?.lat, syncView?.lng, syncView?.zoom]);

  function navegar(pin: MapPin, app: 'google' | 'waze') {
    const query = [pin.label, pin.sublabel].filter(Boolean).join(', ');
    const encoded = encodeURIComponent(query);
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${encoded}&navigate=yes`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(url, '_blank');
  }

  function openEdit(pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    if (onEditLead) {
      // Abre aba Clientes com formulário completo pré-preenchido
      onEditLead({
        razao_social: pin.data.company_name || pin.label || '',
        endereco_completo: [pin.data.address, pin.data.number, pin.data.city, pin.data.state].filter(Boolean).join(', '),
        whatsapp_comprador: pin.data.whatsapp || pin.data.phone || '',
        cnpj: pin.data.cnpj || null,
        segment: pin.data.segment || null,
        lat: pin.lat,
        lng: pin.lng,
        municipio: pin.data.city || null,
        uf: pin.data.state || null,
      });
    } else {
      // Fallback: abre form inline simplificado se não houver callback
      setEditForm({
        company_name: pin.data.company_name || pin.label || '',
        address: pin.data.address || '',
        phone: pin.data.phone || pin.data.whatsapp || '',
      });
      setEditing(true);
    }
  }

  async function saveEdit(pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    setBusy(true);
    const { error } = await supabase.from('prospect_leads').update({
      company_name: editForm.company_name,
      address: editForm.address,
      phone: editForm.phone,
    }).eq('id', pin.id);
    setBusy(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Dados atualizados');
    setEditing(false);
    fetchPins();
  }

  async function convertToClient(pin: MapPin, temGondola: boolean) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    setBusy(true);
    // Cria cliente básico com os dados do lead (gôndola respondida no passo anterior — obrigatório)
    const { data: client, error: clientErr } = await supabase.from('representative_clients').insert({
      representative_id: representativeId,
      company_id: activeCompanyId,
      razao_social: pin.data.company_name || pin.label,
      endereco_completo: pin.data.address ? [pin.data.address, pin.data.city, pin.data.state].filter(Boolean).join(', ') : null,
      whatsapp_comprador: pin.data.phone || pin.data.whatsapp || null,
      segment: pin.data.segment || null,
      tem_gondola: temGondola,
      lat: pin.lat, lng: pin.lng,
      municipio: pin.data.city || null, uf: pin.data.state || null,
      status: 'active', is_active_client: true,
    }).select('id').single();
    if (clientErr || !client) { setBusy(false); toast.error('Erro ao converter: ' + clientErr?.message); return; }
    // Marca lead como convertido
    await supabase.from('prospect_leads').update({
      status: 'converted', converted_at: new Date().toISOString(),
      representative_client_id: client.id,
    }).eq('id', pin.id);
    setBusy(false);
    setAskGondola(false);
    toast.success(`${pin.label} convertido em cliente! ✅`);
    setSelectedPin(null);
    fetchPins();
    window.dispatchEvent(new CustomEvent('repco:clients-updated', { detail: { representativeId } }));
  }

  async function doCheckIn(pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    setBusy(true);
    const { error } = await supabase.from('prospect_leads').update({
      status: 'visited', visited_at: new Date().toISOString(),
    }).eq('id', pin.id);
    setBusy(false);
    if (error) { toast.error('Erro ao fazer check-in'); return; }
    toast.success('Check-in registrado!');
    setSelectedPin(null);
    // fetchPins → setPins → useEffect auto-pulsing escolhe o próximo pendente
    await fetchPins();
    window.dispatchEvent(new CustomEvent('repco:prospection-updated', { detail: { representativeId } }));
  }

  async function aceitarEntrega(pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('repco_update_delivery', { p_order_id: pin.id, p_status: 'em_rota' });
    setBusy(false);
    if (error) { toast.error('Erro ao aceitar entrega'); return; }
    toast.success('Entrega aceita — você está em rota! 🚚');
    setSelectedPin(null);
    await fetchPins();
    // Abre navegação automaticamente ao aceitar
    navegar(pin, 'google');
  }

  async function finalizarEntrega(pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    // Navega para aba Entregas para fazer upload do canhoto
    if (onFinalizeDelivery) {
      onFinalizeDelivery(pin.id);
    }
    // Pulsing do próximo após finalizar
    // fetchPins → setPins → useEffect auto-pulsing escolhe o próximo pendente
  }


  const noPlan = mode === 'visitar' && !loading && pins.length === 0;
  const noData = mode !== 'visitar' && !loading && pins.length === 0;

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Seletor de modo */}
      <div className="flex gap-1 p-2 bg-white border-b border-gray-200">
        {([
          { id: 'visitar', label: 'Visitar', icon: Users },
          { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
          { id: 'entregas', label: 'Entregas', icon: Truck },
        ] as const).map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setSelectedPin(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === m.id ? 'bg-[#8B2214] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <m.icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Legenda */}
      {!loading && pins.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1 bg-gray-50 border-b border-gray-100 text-[10px]">
          {Array.from(new Set(pins.map(p => p.status))).map(st => (
            <span key={st} className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: PIN_COLORS[st] || '#888' }} />
              {STATUS_LABEL[st] || st}
            </span>
          ))}
          {!hasGps && <span className="text-amber-600 ml-auto">⚠ GPS inativo</span>}
        </div>
      )}

      {/* Mapa */}
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#8B2214]" />
          </div>
        )}
        {noPlan && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[90%] max-w-sm rounded-xl bg-white/90 shadow-lg border border-gray-200 px-4 py-3 text-center backdrop-blur-sm">
            <p className="font-semibold text-gray-700 text-sm">Nenhuma visita planejada para hoje</p>
            <p className="text-xs text-gray-500 mt-0.5">Na aba Prospecção, selecione leads e toque em "Planejar para Hoje".</p>
          </div>
        )}
        {noData && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[90%] max-w-sm rounded-xl bg-white/90 shadow-lg border border-gray-200 px-4 py-3 text-center backdrop-blur-sm">
            <p className="font-semibold text-gray-700 text-sm">Sem {mode === 'pedidos' ? 'pedidos' : 'entregas'} no mapa</p>
            <p className="text-xs text-gray-500 mt-0.5">{mode === 'pedidos' ? 'Pedidos com clientes geocodificados aparecerão aqui.' : 'Entregas pessoais pendentes aparecerão aqui.'}</p>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 280 }} />
      </div>

      {/* Painel do pin selecionado */}
      {selectedPin && (
        <div className="bg-white border-t border-gray-200 p-3 space-y-2.5 shadow-lg">
          {/* Header: número + nome + status + fechar */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Número do pino — identifica no mapa */}
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-bold flex-shrink-0"
                  style={{ background: selectedPin.color }}>
                  {selectedPin.number}
                </span>
                <span className="font-semibold text-sm text-gray-900 truncate">{selectedPin.label}</span>
                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-medium flex-shrink-0"
                  style={{ background: selectedPin.color + '22', color: selectedPin.color }}>
                  {STATUS_LABEL[selectedPin.status] || selectedPin.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{selectedPin.sublabel}</p>
              {hasGps && (
                <p className="text-xs text-blue-600 mt-0.5 font-medium">
                  📍 {fmtDist(haversineKm(currentLat!, currentLng!, selectedPin.lat, selectedPin.lng))} de você
                </p>
              )}
              {mode === 'pedidos' && selectedPin.data.total_amount && (
                <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmtBRL(selectedPin.data.total_amount)}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {mode === 'visitar' && (
                <button onClick={() => { openEdit(selectedPin); }}
                  title="Editar dados do lead"
                  className="rounded-lg p-1.5 text-gray-400 hover:text-[#8B2214] hover:bg-red-50">
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => { setSelectedPin(null); setEditing(false); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
            </div>
          </div>

          {/* Formulário de edição inline */}
          {editing && mode === 'visitar' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Editar dados</p>
              <input value={editForm.company_name} onChange={e => setEditForm(f=>({...f,company_name:e.target.value}))}
                placeholder="Nome do estabelecimento" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#8B2214]" />
              <input value={editForm.address} onChange={e => setEditForm(f=>({...f,address:e.target.value}))}
                placeholder="Endereço" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#8B2214]" />
              <input value={editForm.phone} onChange={e => setEditForm(f=>({...f,phone:e.target.value}))}
                placeholder="Telefone / WhatsApp" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#8B2214]" />
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button disabled={busy} onClick={() => saveEdit(selectedPin)}
                  className="flex-1 rounded-lg bg-[#8B2214] py-1.5 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
                  {busy ? '...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {/* Navegação */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => navegar(selectedPin, 'google')}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              <Navigation2 className="w-3.5 h-3.5" /> Google Maps
            </button>
            <button onClick={() => navegar(selectedPin, 'waze')}
              className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
              <Navigation2 className="w-3.5 h-3.5" /> Waze
            </button>
          </div>

          {/* Ações do modo Visitar */}
          {mode === 'visitar' && !editing && (
          <div className="flex gap-1.5 flex-wrap">
            {!['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={() => doCheckIn(selectedPin)}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5" /> {busy ? '...' : 'Check-in'}
              </button>
            )}
            {!['visited','converted','rejected'].includes(selectedPin.status) && !askGondola && (
              <button disabled={busy} onClick={() => setAskGondola(true)}
                className="flex items-center gap-1 rounded-lg bg-[#8B2214] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
                <UserPlus className="w-3.5 h-3.5" /> Converter em cliente
              </button>
            )}
            {!['visited','converted','rejected'].includes(selectedPin.status) && askGondola && (
              <div className="w-full rounded-lg border border-[#ddd0cc] bg-[#f8f7f5] p-2.5">
                <div className="text-xs font-semibold text-gray-800 mb-1.5">Esta loja tem gôndola (espaço na prateleira pro seu produto)? <span className="text-red-600">*</span></div>
                <div className="flex gap-1.5">
                  <button disabled={busy} onClick={() => convertToClient(selectedPin, true)}
                    className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                    {busy ? '...' : 'Sim, tem'}
                  </button>
                  <button disabled={busy} onClick={() => convertToClient(selectedPin, false)}
                    className="flex-1 rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                    {busy ? '...' : 'Não tem'}
                  </button>
                  <button disabled={busy} onClick={() => setAskGondola(false)}
                    className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {!['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={async () => {
                if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
                setBusy(true);
                await supabase.from('prospect_leads').update({ status: 'pending_visit' }).eq('id', selectedPin.id);
                setBusy(false); setSelectedPin(null); fetchPins();
              }} className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                <RotateCcw className="w-3.5 h-3.5" /> Voltar depois
              </button>
            )}
            {!['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={async () => {
                if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
                setBusy(true);
                await supabase.from('prospect_leads').update({ status: 'rejected', rejection_reason: 'Não existe no endereço' }).eq('id', selectedPin.id);
                setBusy(false); setSelectedPin(null); fetchPins();
              }} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                <AlertCircle className="w-3.5 h-3.5" /> Não existe
              </button>
            )}
          </div>
          )}

          {/* Ações do modo Entregas */}
          {mode === 'entregas' && (
            <div className="flex gap-1.5 flex-wrap">
              {selectedPin.status === 'pendente' && (
                <button disabled={busy} onClick={() => aceitarEntrega(selectedPin)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#8B2214] py-2 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
                  <Truck className="w-3.5 h-3.5" /> {busy ? '...' : 'Aceitar entrega → Ir agora'}
                </button>
              )}
              {selectedPin.status === 'em_rota' && (
                <>
                  <div className="w-full text-center text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg py-1.5 flex items-center justify-center gap-1">
                    <Truck className="w-3.5 h-3.5 animate-pulse" /> Em rota de entrega
                  </div>
                  <button disabled={busy} onClick={() => finalizarEntrega(selectedPin)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle className="w-3.5 h-3.5" /> {busy ? '...' : 'Finalizar + foto do canhoto'}
                  </button>
                </>
              )}
              {selectedPin.status === 'entregue' && (
                <div className="w-full text-center text-xs font-semibold text-green-700 bg-green-50 rounded-lg py-2 flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Entregue ✓
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── HISTÓRICO DIÁRIO ── */}
      {dayBlocks.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {mode === 'visitar' ? 'Histórico de Visitas' : mode === 'pedidos' ? 'Histórico de Pedidos' : 'Histórico de Entregas'}
            </span>
            <span className="text-[10px] text-gray-400">{dayBlocks.length} dia{dayBlocks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-1 px-2 pb-3 max-h-64 overflow-y-auto">
            {dayBlocks.map(block => {
              const today = new Date().toISOString().split('T')[0];
              const isToday = block.date === today;
              const isExpanded = expandedDays.has(block.date);
              const pendingCount = block.items.filter(i => i.isPending).length;
              const doneCount = block.items.length - pendingCount;
              const dateLabel = isToday ? 'Hoje' : new Date(block.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

              return (
                <div key={block.date} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {/* Header do bloco */}
                  <button onClick={() => setExpandedDays(prev => { const n = new Set(prev); n.has(block.date) ? n.delete(block.date) : n.add(block.date); return n; })}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isToday ? 'text-[#8B2214]' : 'text-gray-700'}`}>{dateLabel}</span>
                      {pendingCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
                      )}
                      {doneCount > 0 && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">{doneCount} feito{doneCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Itens do bloco */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Botão "Continuar pendentes" para dias anteriores no modo Visitar */}
                      {!isToday && pendingCount > 0 && mode === 'visitar' && (
                        <button onClick={() => continuarPendentes(block.date)}
                          className="w-full py-1.5 text-xs font-semibold text-[#8B2214] hover:bg-red-50 border-b border-gray-100">
                          ↩ Continuar {pendingCount} visita{pendingCount !== 1 ? 's' : ''} pendente{pendingCount !== 1 ? 's' : ''} hoje
                        </button>
                      )}
                      {block.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">{item.label}</p>
                            {item.sublabel && <p className="text-[10px] text-gray-500 truncate">{item.sublabel}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {item.time && <span className="text-[10px] text-gray-400">{item.time}</span>}
                            <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${
                              item.isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {STATUS_LABEL[item.status] || item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
