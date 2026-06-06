import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { MapPin, Navigation2, CheckCircle, AlertCircle, RotateCcw, Truck, ShoppingBag, Users } from 'lucide-react';

interface Props {
  representativeId: string;
  currentLat?: number;
  currentLng?: number;
  previewMode?: boolean;
  refreshKey?: number;
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

export default function RepCoFieldMap({ representativeId, currentLat, currentLng, previewMode = false, refreshKey = 0 }: Props) {
  const [mode, setMode] = useState<MapMode>('visitar');
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const hasGps = currentLat !== undefined && currentLng !== undefined;

  const fetchPins = useCallback(async () => {
    setLoading(true);
    setSelectedPin(null);

    if (mode === 'visitar') {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('rep_daily_plans')
        .select('lead_id, prospect_leads(id, company_name, address, number, city, state, lat, lng, phone, whatsapp, status, category)')
        .eq('representative_id', representativeId)
        .eq('plan_date', today);

      const rows = (data || []).map((d: any) => d.prospect_leads).filter((l: any) => l?.lat != null && l?.lng != null);
      let sorted = rows;
      if (hasGps) {
        sorted = [...rows].sort((a: any, b: any) =>
          haversineKm(currentLat!, currentLng!, a.lat, a.lng) - haversineKm(currentLat!, currentLng!, b.lat, b.lng)
        );
      }
      setPins(sorted.map((l: any, i: number) => ({
        id: l.id, number: i+1,
        lat: l.lat, lng: l.lng,
        label: l.company_name,
        sublabel: [l.address, l.city, l.state].filter(Boolean).join(', '),
        status: l.status || 'assigned',
        color: PIN_COLORS[l.status || 'assigned'] || PIN_COLORS.assigned,
        data: l,
      })));

    } else if (mode === 'pedidos') {
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, status, total_amount, representative_clients(razao_social, lat, lng, municipio, uf, endereco_completo)')
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false })
        .limit(60);

      const rows = (data || []).filter((o: any) => o.representative_clients?.lat != null);
      setPins(rows.map((o: any, i: number) => ({
        id: o.id, number: i+1,
        lat: o.representative_clients.lat, lng: o.representative_clients.lng,
        label: o.order_number || '—',
        sublabel: o.representative_clients?.razao_social || '—',
        status: o.status,
        color: PIN_COLORS[o.status] || PIN_COLORS.new,
        data: o,
      })));

    } else { // entregas
      const { data } = await supabase
        .from('representative_orders')
        .select('id, order_number, total_amount, delivery_status, representative_clients(razao_social, lat, lng, endereco_completo, municipio, uf)')
        .eq('representative_id', representativeId)
        .in('delivery_status', ['pendente', 'em_rota']);

      const rows = (data || []).filter((o: any) => o.representative_clients?.lat != null);
      let sorted = rows;
      if (hasGps) {
        sorted = [...rows].sort((a: any, b: any) =>
          haversineKm(currentLat!, currentLng!, a.representative_clients.lat, a.representative_clients.lng) -
          haversineKm(currentLat!, currentLng!, b.representative_clients.lat, b.representative_clients.lng)
        );
      }
      setPins(sorted.map((o: any, i: number) => ({
        id: o.id, number: i+1,
        lat: o.representative_clients.lat, lng: o.representative_clients.lng,
        label: o.order_number || '—',
        sublabel: o.representative_clients?.razao_social || '—',
        status: o.delivery_status || 'pendente',
        color: PIN_COLORS[o.delivery_status || 'pendente'],
        data: o,
      })));
    }
    setLoading(false);
  }, [mode, representativeId, currentLat, currentLng, refreshKey]);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // Renderiza o mapa Leaflet
  useEffect(() => {
    if (!mapRef.current || loading) return;
    let L: any;

    async function initMap() {
      L = (await import('leaflet')).default;
      if (!leafletMap.current) {
        const mapCenter = hasGps ? [currentLat!, currentLng!] : [-23.185, -47.010]; // centro Jundiaí como default
        leafletMap.current = L.map(mapRef.current!, { zoomControl: true, attributionControl: false, center: mapCenter, zoom: 13 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap.current);
      }

      // Remove markers antigos
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // GPS do rep
      if (hasGps) {
        const repIcon = L.divIcon({
          html: `<div style="width:18px;height:18px;background:#8B2214;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        });
        L.marker([currentLat, currentLng], { icon: repIcon }).addTo(leafletMap.current);
      }

      // Pinos dos dados
      const bounds: [number,number][] = hasGps ? [[currentLat!, currentLng!]] : [];
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

      if (bounds.length > 1) {
        leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } else if (bounds.length === 1) {
        leafletMap.current.setView(bounds[0], 13);
      }
    }

    initMap();
    return () => { if (!mapRef.current) { leafletMap.current?.remove(); leafletMap.current = null; } };
  }, [pins, pulsingId, loading, hasGps, currentLat, currentLng]);

  function navegar(pin: MapPin) {
    const query = [pin.label, pin.sublabel].filter(Boolean).join(', ');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
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
    // Próximo mais perto pisca
    await fetchPins();
    const remaining = pins.filter(p => p.id !== pin.id && !['visited','converted','rejected'].includes(p.status));
    if (remaining.length > 0 && hasGps) {
      const nearest = remaining.sort((a, b) =>
        haversineKm(currentLat!, currentLng!, a.lat, a.lng) - haversineKm(currentLat!, currentLng!, b.lat, b.lng)
      )[0];
      setPulsingId(nearest.id);
      setTimeout(() => setPulsingId(null), 8000);
      toast.info(`Próxima mais perto: ${nearest.label}`);
    }
    window.dispatchEvent(new CustomEvent('repco:prospection-updated', { detail: { representativeId } }));
  }

  async function doEntregue(_pin: MapPin) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    toast.info('Vá para Entregas para registrar com foto do canhoto.');
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10 px-6 text-center">
            <MapPin className="h-10 w-10 text-gray-300" />
            <p className="font-semibold text-gray-700">Nenhuma visita planejada para hoje</p>
            <p className="text-sm text-gray-500">Na aba Prospecção, selecione leads e toque em "Planejar para Hoje".</p>
          </div>
        )}
        {noData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10 px-6 text-center">
            <MapPin className="h-10 w-10 text-gray-300" />
            <p className="font-semibold text-gray-700">Sem {mode === 'pedidos' ? 'pedidos' : 'entregas'} no mapa</p>
            <p className="text-sm text-gray-500">{mode === 'pedidos' ? 'Pedidos com clientes geocodificados aparecerão aqui.' : 'Entregas pessoais pendentes aparecerão aqui.'}</p>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: 280 }} />
      </div>

      {/* Painel do pin selecionado */}
      {selectedPin && (
        <div className="bg-white border-t border-gray-200 p-3 space-y-2 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: selectedPin.color }} />
                <span className="font-semibold text-sm text-gray-900 truncate">{selectedPin.label}</span>
                <span className="text-[10px] rounded-full px-1.5 py-0.5 font-medium" style={{ background: selectedPin.color + '22', color: selectedPin.color }}>
                  {STATUS_LABEL[selectedPin.status] || selectedPin.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedPin.sublabel}</p>
              {hasGps && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {fmtDist(haversineKm(currentLat!, currentLng!, selectedPin.lat, selectedPin.lng))} de você
                </p>
              )}
              {mode === 'pedidos' && selectedPin.data.total_amount && (
                <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmtBRL(selectedPin.data.total_amount)}</p>
              )}
            </div>
            <button onClick={() => setSelectedPin(null)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => navegar(selectedPin)}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              <Navigation2 className="w-3.5 h-3.5" /> Navegar
            </button>

            {mode === 'visitar' && !['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={() => doCheckIn(selectedPin)}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5" /> {busy ? '...' : 'Fazer check-in'}
              </button>
            )}
            {mode === 'visitar' && !['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={async () => {
                if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
                setBusy(true);
                await supabase.from('prospect_leads').update({ status: 'pending_visit' }).eq('id', selectedPin.id);
                setBusy(false); setSelectedPin(null); fetchPins();
              }} className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                <RotateCcw className="w-3.5 h-3.5" /> Voltar depois
              </button>
            )}
            {mode === 'visitar' && !['visited','converted','rejected'].includes(selectedPin.status) && (
              <button disabled={busy} onClick={async () => {
                if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
                setBusy(true);
                await supabase.from('prospect_leads').update({ status: 'rejected', rejection_reason: 'Não existe no endereço' }).eq('id', selectedPin.id);
                setBusy(false); setSelectedPin(null); fetchPins();
              }} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                <AlertCircle className="w-3.5 h-3.5" /> Não existe
              </button>
            )}
            {mode === 'entregas' && selectedPin.status !== 'entregue' && (
              <button onClick={() => doEntregue(selectedPin)}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                <Truck className="w-3.5 h-3.5" /> Registrar entrega
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
