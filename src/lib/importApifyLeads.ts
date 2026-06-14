// Importa places do Apify (Google Maps) em prospect_leads, com dedup reusando leadMatch.ts
// (a MESMA regra do cross-reference do mapa). lat/lng vem REAL do Google -> proximidade confiavel.
// O segmento aqui e PROVISORIO (vem da keyword); o definitivo e confirmado na conversao em cliente.
import { supabase } from './supabase';
import { leadMatchesProspect } from './leadMatch';
import type { ClientSegment } from '../constants/segments';

// Shape (parcial) de um place do actor compass/crawler-google-places.
export interface ApifyPlace {
  title?: string; categoryName?: string;
  address?: string; street?: string; neighborhood?: string; city?: string; state?: string; postalCode?: string;
  phone?: string; phoneUnformatted?: string; website?: string; email?: string; emails?: string[];
  url?: string; placeId?: string;
  location?: { lat?: number; lng?: number };
}

export interface ApifyImportParams {
  items: ApifyPlace[];
  uf: string;
  municipio: string;
  category: string;
  segment: ClientSegment | null;   // provisório
  listId?: string | null;          // anexar a lista existente; se vazio, cria nova
  representativeId?: string | null;
  runId?: string | null;           // p/ atualizar prospect_runs
}

export interface ApifyImportResult { listId: string; criados: number; duplicados: number; ignorados: number; }

export async function importApifyLeads(p: ApifyImportParams): Promise<ApifyImportResult> {
  const places = (p.items || []).filter(it => (it.title || '').trim());
  if (!places.length) throw new Error('Nenhum place retornado.');

  // carteira de clientes (dedup) — CNPJ + nome/proximidade
  const { data: clients } = await supabase
    .from('representative_clients').select('id,cnpj,razao_social,nome_fantasia,lat,lng');
  // leads ja existentes no mesmo municipio (evita reimportar o mesmo PDV)
  const { data: existingLeads } = await supabase
    .from('prospect_leads').select('cnpj,company_name,trade_name,lat,lng').ilike('city', p.municipio);

  const clientList = (clients || []) as any[];
  const existing = (existingLeads || []) as any[];

  // lista destino
  let listId = p.listId || null;
  if (!listId) {
    const { data: lr, error: lErr } = await supabase.from('prospect_lists').insert({
      name: `${p.municipio}/${p.uf} — Apify ${p.category}`, segment: p.segment,
      source_type: 'scraper', source_name: 'Apify Google Places', status: 'imported',
      assigned_representative_id: p.representativeId || null, total_count: 0, pending_count: 0,
    }).select('id').single();
    if (lErr) throw lErr;
    listId = lr!.id as string;
  }

  let criados = 0, duplicados = 0, ignorados = 0;
  const leads: any[] = [];
  for (const it of places) {
    const lead = {
      cnpj: null as string | null, company_name: it.title!, trade_name: it.title!,
      lat: it.location?.lat ?? null, lng: it.location?.lng ?? null,
    };
    // ja existe como lead nesta cidade? -> ignora (nao duplica)
    const dupLead = existing.some(e =>
      leadMatchesProspect(lead, { cnpj: e.cnpj, nome_fantasia: e.trade_name, razao_social: e.company_name, lat: e.lat, lng: e.lng }).match);
    if (dupLead) { ignorados++; continue; }
    // ja e cliente? -> marca duplicate
    const cli = clientList.find(c =>
      leadMatchesProspect(lead, { cnpj: c.cnpj, nome_fantasia: c.nome_fantasia, razao_social: c.razao_social, lat: c.lat, lng: c.lng }).match);

    const lat = it.location?.lat ?? null, lng = it.location?.lng ?? null;
    const email = it.email || (Array.isArray(it.emails) ? it.emails[0] : null);
    leads.push({
      prospect_list_id: listId,
      representative_id: p.representativeId || null,
      company_name: it.title, trade_name: it.title, cnpj: null,
      segment: p.segment, category: p.category, source: 'apify_google_places',
      address: it.street || it.address || null, district: it.neighborhood || null,
      city: it.city || p.municipio, state: it.state || p.uf, zip_code: it.postalCode || null,
      lat, lng,
      geocode_status: (lat != null && lng != null) ? 'success' : 'pending',
      geocode_source: (lat != null) ? 'google_places' : null,
      phone: it.phoneUnformatted || it.phone || null, email: email || null, website: it.website || null,
      raw_data: {
        fonte: 'apify_google_places', google_url: it.url || null, place_id: it.placeId || null,
        categoria_google: it.categoryName || null, segmento_provisorio: true,
      },
      status: cli ? 'duplicate' : 'new',
      duplicate_of_client_id: cli ? cli.id : null,
    });
    if (cli) duplicados++; else criados++;
  }

  const B = 500;
  for (let i = 0; i < leads.length; i += B) {
    const { error } = await supabase.from('prospect_leads').insert(leads.slice(i, i + B));
    if (error) throw error;
  }

  // atualiza contadores
  await supabase.from('prospect_lists').update({
    total_count: leads.length, pending_count: criados,
  }).eq('id', listId);
  if (p.runId) {
    await supabase.from('prospect_runs').update({
      leads_created: criados, leads_duplicated: duplicados, prospect_list_id: listId,
      status: 'done', finished_at: new Date().toISOString(),
    }).eq('id', p.runId);
  }

  return { listId: listId!, criados, duplicados, ignorados };
}
