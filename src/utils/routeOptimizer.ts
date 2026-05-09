export interface StopInput {
  company_name: string;
  address: string;
  city: string;
  phone?: string;
  segment?: string;
  lat?: number;
  lng?: number;
}

export interface StopWithCoords extends StopInput {
  lat: number;
  lng: number;
  geocoded: boolean;
}

// Geocodifica um endereço via Nominatim (OpenStreetMap) — gratuito, sem API key
export async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${address}, ${city}, Brasil`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'SaporinoRepCo/1.0' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Geocodifica lista de paradas com delay de 1.1s por req (limite Nominatim)
export async function geocodeStops(
  stops: StopInput[],
  onProgress?: (done: number, total: number) => void
): Promise<StopWithCoords[]> {
  const result: StopWithCoords[] = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop.lat && stop.lng) {
      result.push({ ...stop, lat: stop.lat, lng: stop.lng, geocoded: true });
    } else {
      await new Promise(r => setTimeout(r, 1100));
      const coords = await geocodeAddress(stop.address || '', stop.city || '');
      result.push({
        ...stop,
        lat: coords?.lat ?? -23.55052,
        lng: coords?.lng ?? -46.633308,
        geocoded: !!coords,
      });
    }
    onProgress?.(i + 1, stops.length);
  }
  return result;
}

// Distância Haversine em km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor: ordena paradas para minimizar km percorridos
export function optimizeRoute(stops: StopWithCoords[]): StopWithCoords[] {
  if (stops.length <= 2) return stops;
  const remaining = [...stops];
  const ordered: StopWithCoords[] = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = haversine(last.lat, last.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    ordered.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return ordered;
}

// Parse de CSV com PapaParse
export async function parseRouteCSV(csvText: string): Promise<StopInput[]> {
  const Papa = await import('papaparse');
  const result = Papa.default.parse(csvText, { header: true, skipEmptyLines: true });
  return (result.data as Record<string, string>[]).map(row => ({
    company_name: row['nome_empresa'] || row['empresa'] || row['name'] || row['Nome'] || '',
    address:      row['endereco'] || row['endereço'] || row['address'] || row['Endereço'] || '',
    city:         row['cidade'] || row['city'] || row['Cidade'] || '',
    phone:        row['telefone'] || row['phone'] || row['Telefone'] || '',
    segment:      row['segmento'] || row['segment'] || row['Segmento'] || '',
  })).filter(s => s.company_name.trim() !== '');
}
