import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // sem isso o mapa quebra (bug já visto neste repo)
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';

// Bloco 6 — mapa ao vivo: promotores online + lojas visitadas hoje.
const pinPromotor = L.divIcon({
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  html: '<div style="width:26px;height:26px;border-radius:50%;background:#8B2214;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
});

export default function PromoterLiveMapInner() {
  const { activeCompanyId } = useCompany();
  const [proms, setProms] = useState<{ id: string; full_name: string; last_lat: number | null; last_lng: number | null; is_online: boolean | null }[]>([]);
  const [lojas, setLojas] = useState<{ id: string; nome: string; lat: number; lng: number; status: string }[]>([]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: ps }, { data: vs }] = await Promise.all([
        supabase.from('promoters').select('id,full_name,last_lat,last_lng,is_online').eq('company_id', activeCompanyId),
        supabase.from('promoter_visits').select('id,status,representative_client_id,representative_clients(nome_fantasia,razao_social,lat,lng)').eq('company_id', activeCompanyId).gte('created_at', today),
      ]);
      setProms(((ps as any[]) || []).filter(p => p.last_lat != null));
      setLojas(((vs as any[]) || []).filter(v => v.representative_clients?.lat != null).map(v => ({
        id: v.id, nome: v.representative_clients.nome_fantasia || v.representative_clients.razao_social,
        lat: Number(v.representative_clients.lat), lng: Number(v.representative_clients.lng), status: v.status,
      })));
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [activeCompanyId]);

  const center: [number, number] = proms[0]?.last_lat != null
    ? [Number(proms[0].last_lat), Number(proms[0].last_lng)]
    : lojas[0] ? [lojas[0].lat, lojas[0].lng] : [-23.55, -46.63];

  return (
    <div className="h-72 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {lojas.map(l => (
          <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={9}
            pathOptions={{ color: '#fff', weight: 2, fillColor: l.status === 'concluida' ? '#16a34a' : l.status === 'em_atendimento' ? '#f59e0b' : '#9ca3af', fillOpacity: 0.95 }}>
            <Popup><strong>{l.nome}</strong><br />visita: {l.status.replace(/_/g, ' ')}</Popup>
          </CircleMarker>
        ))}
        {proms.map(p => (
          <Marker key={p.id} position={[Number(p.last_lat), Number(p.last_lng)]} icon={pinPromotor} opacity={p.is_online ? 1 : 0.45}>
            <Popup><strong>{p.full_name}</strong><br />{p.is_online ? 'online agora' : 'última posição'}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
