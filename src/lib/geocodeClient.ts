// Geocodificação não-bloqueante de cliente do RepCo (Camada 1 — mapa de vendas por região).
// Roda no navegador, no melhor esforço: se falhar, NÃO atrapalha o cadastro — o backfill
// (scripts/geocode-clients.mjs) recolhe depois. Só preenche lat/lng (+ municipio/uf se vazios).
// Cascata gratuita: CEP (BrasilAPI v2) -> endereço/município (Nominatim/OSM).
import { supabase } from './supabase';

const STATE_UF: Record<string, string> = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE',
  'distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT',
  'mato grosso do sul':'MS','minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR',
  'pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ','rio grande do norte':'RN',
  'rio grande do sul':'RS','rondonia':'RO','roraima':'RR','santa catarina':'SC',
  'sao paulo':'SP','sergipe':'SE','tocantins':'TO',
};
function toUf(state?: string | null): string | null {
  if (!state) return null;
  const s = String(state).trim();
  if (s.length === 2) return s.toUpperCase();
  const norm = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return STATE_UF[norm] || null;
}

type Geo = { lat: number; lng: number; municipio: string | null; uf: string | null };

async function fromCep(cep: string): Promise<Geo | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (!r.ok) return null;
    const d = await r.json();
    const c = d?.location?.coordinates;
    if (c?.latitude && c?.longitude) {
      return { lat: Number(c.latitude), lng: Number(c.longitude), municipio: d.city || null, uf: toUf(d.state) };
    }
  } catch { /* ignora */ }
  return null;
}

async function fromNominatim(query: string): Promise<Geo | null> {
  try {
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(query)}`;
    const r = await fetch(u, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr?.length) return null;
    const hit = arr[0];
    const a = hit.address || {};
    return {
      lat: Number(hit.lat), lng: Number(hit.lon),
      municipio: a.city || a.town || a.village || a.municipality || null,
      uf: toUf(a.state),
    };
  } catch { return null; }
}

export interface GeocodeInput {
  cep?: string | null;
  endereco_completo?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

/**
 * Geocodifica um cliente e grava lat/lng. Best-effort e não-bloqueante:
 * o chamador NÃO deve dar await antes de mostrar sucesso. Erros são engolidos.
 */
export async function geocodeClientById(id: string, input: GeocodeInput): Promise<void> {
  try {
    let geo: Geo | null = null;
    if (input.cep && input.cep.replace(/\D/g, '').length === 8) geo = await fromCep(input.cep);
    if (!geo && input.endereco_completo && input.endereco_completo.trim().length > 5) {
      geo = await fromNominatim(`${input.endereco_completo}, Brasil`);
    }
    if (!geo && input.municipio && input.uf) {
      geo = await fromNominatim(`${input.municipio}, ${input.uf}, Brasil`);
    }
    if (!geo) {
      await supabase.from('representative_clients').update({ geocode_status: 'failed' }).eq('id', id);
      return;
    }
    const patch: Record<string, unknown> = {
      lat: geo.lat, lng: geo.lng, geocode_status: 'success', geocoded_at: new Date().toISOString(),
    };
    if (!input.municipio && geo.municipio) patch.municipio = geo.municipio;
    if (!input.uf && geo.uf) patch.uf = geo.uf;
    await supabase.from('representative_clients').update(patch).eq('id', id);
  } catch { /* best-effort: silencioso */ }
}
