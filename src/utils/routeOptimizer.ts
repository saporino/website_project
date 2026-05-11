import Papa from 'papaparse';

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
  weight_kg?: number;
  stop_type?: 'visit' | 'delivery' | 'prospection';
}

export interface RouteStop {
  id?: string;
  company_name: string;
  address: string;
  city?: string;
  phone?: string;
  segment?: string;
  lat?: number;
  lng?: number;
  stop_order?: number;
  weight_kg?: number;
  stop_type?: 'visit' | 'delivery' | 'prospection';
}

export interface OptimizeOptions {
  maxWeightKg?: number;
  filterSegment?: string;
  filterRegion?: string;
  learnedOrder?: Record<string, number>;
}

// Geocodifica um endereço via Nominatim (OpenStreetMap) — gratuito, sem API key
export async function geocodeAddress(address: string, city?: string): Promise<{ lat: number; lng: number } | null> {
  const query = city ? `${address}, ${city}, Brasil` : `${address}, Brasil`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'CafeSaporino/1.0' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
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
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
function nearestNeighbor(stops: StopWithCoords[]): StopWithCoords[] {
  if (stops.length === 0) return [];
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

// Otimização com aprendizado + filtros
export function optimizeRoute(stops: StopWithCoords[], options: OptimizeOptions = {}): StopWithCoords[] {
  let filtered = stops.filter(s => s.lat && s.lng);

  if (options.filterSegment) {
    filtered = filtered.filter(s => s.segment === options.filterSegment);
  }

  if (options.filterRegion) {
    const region = options.filterRegion.toLowerCase();
    filtered = filtered.filter(s =>
      s.city?.toLowerCase().includes(region) ||
      s.address?.toLowerCase().includes(region)
    );
  }

  // Use learned order if available
  if (options.learnedOrder && Object.keys(options.learnedOrder).length > 0) {
    const learned = options.learnedOrder;
    const withLearned = filtered.filter(s => s.company_name && learned[s.company_name] !== undefined);
    const withoutLearned = filtered.filter(s => !s.company_name || learned[s.company_name] === undefined);
    if (withLearned.length > withoutLearned.length * 0.5) {
      const sortedLearned = [...withLearned].sort((a, b) =>
        (learned[a.company_name!] || 0) - (learned[b.company_name!] || 0)
      );
      return [...sortedLearned, ...nearestNeighbor(withoutLearned)].map((s, i) => ({ ...s, stop_order: i + 1 }));
    }
  }

  return nearestNeighbor(filtered);
}

// Aprende a ordem real baseada na execução
export function learnRouteOrder(
  plannedStops: RouteStop[],
  actualStops: RouteStop[],
  existingLearned: Record<string, number> = {}
): Record<string, number> {
  const learned = { ...existingLearned };
  actualStops.forEach((stop, index) => {
    if (stop.company_name) {
      const plannedIndex = plannedStops.findIndex(s => s.company_name === stop.company_name);
      if (plannedIndex !== -1 && index !== plannedIndex) {
        learned[stop.company_name] = index;
      }
    }
  });
  return learned;
}

// Calcula peso total
export function calculateTotalWeight(stops: RouteStop[]): number {
  return stops.reduce((sum, s) => sum + (s.weight_kg || 0), 0);
}

// Parse de CSV com PapaParse (aceita string ou File)
export async function parseRouteCSV(input: string | File): Promise<StopInput[]> {
  if (typeof input === 'string') {
    const result = Papa.parse(input, { header: true, skipEmptyLines: true });
    return mapCSVRows(result.data as Record<string, string>[]);
  }
  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(mapCSVRows(results.data as Record<string, string>[])),
      error: reject,
    });
  });
}

function mapCSVRows(rows: Record<string, string>[]): StopInput[] {
  return rows.map(row => ({
    company_name: row['nome_empresa'] || row['empresa'] || row['name'] || row['Nome'] || row['company_name'] || '',
    address:      row['endereco'] || row['endereço'] || row['address'] || row['Endereço'] || '',
    city:         row['cidade'] || row['city'] || row['Cidade'] || '',
    phone:        row['telefone'] || row['phone'] || row['Telefone'] || '',
    segment:      row['segmento'] || row['segment'] || row['Segmento'] || '',
  })).filter(s => s.company_name.trim() !== '');
}
