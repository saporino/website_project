import { supabase } from './supabase';

// Registra a visita por IP (cidade/estado aproximados), 1x por sessao.
// Sem pedir permissao ao usuario. Falha silenciosa.
export async function trackVisit() {
  try {
    if (sessionStorage.getItem('saporino-visit-logged')) return;
    sessionStorage.setItem('saporino-visit-logged', '1');
    // geojs.io: gratis, https, CORS, sem chave — retorna city/region/country/lat/lng pelo IP
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
    const d = await res.json();
    if (!d || !d.country) return;
    const lat = parseFloat(d.latitude); const lng = parseFloat(d.longitude);
    await supabase.from('site_visits').insert({
      city: d.city || null,
      region: d.region || null,
      country: d.country || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      path: window.location.pathname,
    });
  } catch {
    /* silencioso — analytics nao pode quebrar o site */
  }
}
