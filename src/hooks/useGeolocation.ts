import { useState, useEffect, useRef } from 'react';

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface ProximityAlert {
  stopId: string;
  stopName: string;
  distanceMeters: number;
}

interface UseGeolocationOptions {
  enabled: boolean;
  proximityStops?: Array<{ id: string; name: string; lat: number; lng: number; scheduled_at?: string | null }>;
  proximityRadiusMeters?: number;
  onProximityAlert?: (alert: ProximityAlert) => void;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation({ enabled, proximityStops = [], proximityRadiusMeters = 500, onProximityAlert }: UseGeolocationOptions) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const alertedStops = useRef<Set<string>>(new Set());
  const watchId = useRef<number | null>(null);

  // Refs com os valores mais recentes — assim o watchPosition NÃO é re-registrado
  // a cada render (proximityStops/onProximityAlert chegam como refs novas a cada render).
  // Sem isto, o efeito re-rodava sem parar → setCoords em loop → PATCH presence em rajada.
  const stopsRef = useRef(proximityStops);
  const radiusRef = useRef(proximityRadiusMeters);
  const alertRef = useRef(onProximityAlert);
  stopsRef.current = proximityStops;
  radiusRef.current = proximityRadiusMeters;
  alertRef.current = onProximityAlert;

  useEffect(() => {
    if (!enabled) {
      if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
      return;
    }
    if (!navigator.geolocation) { setError('Geolocalização não suportada neste dispositivo.'); return; }
    setLoading(true);
    watchId.current = navigator.geolocation.watchPosition(
      position => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        // Só atualiza se a posição realmente mudou (evita re-render/PATCH com a mesma coordenada).
        setCoords(prev => (prev && prev.lat === lat && prev.lng === lng && prev.accuracy === accuracy ? prev : { lat, lng, accuracy }));
        setLoading(false);
        const onAlert = alertRef.current;
        const stops = stopsRef.current;
        if (!onAlert || stops.length === 0) return;
        const now = new Date();
        stops.forEach(stop => {
          if (!stop.lat || !stop.lng) return;
          if (alertedStops.current.has(stop.id)) return;
          if (stop.scheduled_at) {
            const scheduled = new Date(stop.scheduled_at);
            const isToday =
              scheduled.getFullYear() === now.getFullYear() &&
              scheduled.getMonth() === now.getMonth() &&
              scheduled.getDate() === now.getDate();
            if (!isToday) return;
          }
          const distance = haversineMeters(lat, lng, stop.lat, stop.lng);
          if (distance <= radiusRef.current) {
            alertedStops.current.add(stop.id);
            onAlert({ stopId: stop.id, stopName: stop.name, distanceMeters: Math.round(distance) });
            setTimeout(() => alertedStops.current.delete(stop.id), 30 * 60 * 1000);
          }
        });
      },
      err => {
        setLoading(false);
        setError(err.code === err.PERMISSION_DENIED ? 'Permissão de localização negada. Ative nas configurações do celular.' : 'Erro ao obter localização.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [enabled]);

  return { coords, error, loading };
}
