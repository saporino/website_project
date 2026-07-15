// Importa places do Apify (Google Maps) num POOL não-atribuído (prospect_list sem dono).
// Fonte ÚNICA: Google (endereço/telefone reais). SEM cruzamento com a Receita.
import { supabase } from './supabase';
import { leadMatchesProspect, normName } from './leadMatch';
import type { ClientSegment } from '../constants/segments';

export interface ApifyPlace {
  title?: string; categoryName?: string;
  address?: string; street?: string; neighborhood?: string; city?: string; state?: string; postalCode?: string;
  phone?: string; phoneUnformatted?: string; website?: string; email?: string; emails?: string[];
  url?: string; placeId?: string;
  location?: { lat?: number; lng?: number };
}

export interface ApifyImportParams {
  items: ApifyPlace[];
  uf: string; municipio: string; category: string;
  segment: ClientSegment | null;
  runId?: string | null;
}

export interface ApifyImportResult {
  listId: string; criados: number; ignorados: number; fora: number;
}

export async function importApifyLeads(p: ApifyImportParams): Promise<ApifyImportResult> {
  // Rede de segurança geográfica: o Google às vezes devolve PDVs de outras cidades.
  const alvo = normName(p.municipio);
  const fora = (p.items || []).filter(it => (it.title || '').trim() && it.city && normName(it.city) !== alvo).length;
  const places = (p.items || []).filter(it => (it.title || '').trim() && (!it.city || normName(it.city) === alvo));
  if (!places.length) throw new Error('Nenhum place do município retornado.');

  // leads já existentes no município (não reimportar o mesmo PDV)
  const { data: existing } = await supabase.from('prospect_leads')
    .select('company_name,trade_name,lat,lng,district').ilike('city', p.municipio);
  const existLeads = (existing || []) as any[];

  // cria o POOL (sem dono)
  const { data: lr, error: lErr } = await supabase.from('prospect_lists').insert({
    name: `${p.municipio}/${p.uf} — ${p.category}`, segment: p.segment,
    source_type: 'scraper', source_name: 'Apify Google Places', status: 'imported',
    assigned_representative_id: null, total_count: 0, pending_count: 0,
  }).select('id').single();
  if (lErr) throw lErr;
  const listId = lr!.id as string;

  // monta os leads (dedup contra existentes por nome + bairro)
  const rows: any[] = [];
  let ignorados = 0;
  for (const it of places) {
    const district = it.neighborhood || null;
    const cand = { company_name: it.title!, trade_name: it.title!, lat: it.location?.lat ?? null, lng: it.location?.lng ?? null };
    const dup = existLeads.some(e =>
      leadMatchesProspect(cand, { nome_fantasia: e.trade_name, razao_social: e.company_name, lat: e.lat, lng: e.lng }).match
      && normName(e.district) === normName(district));
    if (dup) { ignorados++; continue; }

    const lat = it.location?.lat ?? null, lng = it.location?.lng ?? null;
    const email = it.email || (Array.isArray(it.emails) ? it.emails[0] : null);
    rows.push({
      prospect_list_id: listId, representative_id: null,
      company_name: it.title, trade_name: it.title, cnpj: null,
      segment: p.segment, category: p.category, source: 'apify_google_places',
      address: it.street || it.address || null, district, city: it.city || p.municipio, state: it.state || p.uf,
      zip_code: it.postalCode || null, lat, lng,
      geocode_status: (lat != null && lng != null) ? 'success' : 'pending',
      geocode_source: (lat != null) ? 'google_places' : null,
      phone: it.phoneUnformatted || it.phone || null, email: email || null, website: it.website || null,
      raw_data: { fonte: 'apify_google_places', google_url: it.url || null, place_id: it.placeId || null, categoria_google: it.categoryName || null },
      status: 'new',
    });
  }

  // insere em lotes
  const B = 200; let criados = 0;
  for (let i = 0; i < rows.length; i += B) {
    const slice = rows.slice(i, i + B);
    const { error } = await supabase.from('prospect_leads').insert(slice);
    if (error) throw error;
    criados += slice.length;
  }

  await supabase.from('prospect_lists').update({ total_count: criados, pending_count: criados }).eq('id', listId);
  if (p.runId) {
    await supabase.from('prospect_runs').update({
      leads_created: criados, prospect_list_id: listId, status: 'done', finished_at: new Date().toISOString(),
    }).eq('id', p.runId);
  }

  return { listId, criados, ignorados, fora };
}
