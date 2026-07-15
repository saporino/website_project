// Importa places do Apify (Google Maps) num POOL não-atribuído (prospect_list sem dono).
// Fonte ÚNICA: Google (endereço/telefone reais). SEM cruzamento com a Receita.
import { supabase } from './supabase';
import { leadMatchesProspect, normName } from './leadMatch';
import { isFoodRelevant } from './foodRelevance';
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
  listId: string; criados: number; atualizados: number; ignorados: number; fora: number; foraDoRamo: number;
}

export async function importApifyLeads(p: ApifyImportParams): Promise<ApifyImportResult> {
  // Rede de segurança geográfica: o Google às vezes devolve PDVs de outras cidades.
  const alvo = normName(p.municipio);
  const fora = (p.items || []).filter(it => (it.title || '').trim() && it.city && normName(it.city) !== alvo).length;
  const naCidade = (p.items || []).filter(it => (it.title || '').trim() && (!it.city || normName(it.city) === alvo));
  // Filtro de RELEVÂNCIA: só entra quem é do ramo de café/alimentos (descarta vidro/pneu/bateria/açaí...).
  const places = naCidade.filter(it => isFoodRelevant(it.title, it.categoryName));
  const foraDoRamo = naCidade.length - places.length;
  if (!places.length) throw new Error('Nenhum estabelecimento do ramo de alimentos retornado nesta busca.');

  // leads já existentes no município (não reimportar; se já existe, só atualiza a info)
  const { data: existing } = await supabase.from('prospect_leads')
    .select('id,company_name,trade_name,lat,lng,district,phone,website,email,address').ilike('city', p.municipio);
  const existLeads = (existing || []) as any[];

  // cria o POOL (sem dono)
  const { data: lr, error: lErr } = await supabase.from('prospect_lists').insert({
    name: `${p.municipio}/${p.uf} — ${p.category}`, segment: p.segment,
    source_type: 'scraper', source_name: 'Apify Google Places', status: 'imported',
    assigned_representative_id: null, total_count: 0, pending_count: 0,
  }).select('id').single();
  if (lErr) throw lErr;
  const listId = lr!.id as string;

  // monta os leads. Se JÁ EXISTE (mesmo nome+bairro): não recria — só atualiza a info
  // (telefone/site/email/endereço) e MANTÉM rep/cliente/status. Assim clientes e atribuições
  // não se perdem ao re-scrapear a cidade, e não voltam pro pool pra atribuir de novo.
  const rows: any[] = [];
  const updates: { id: string; patch: any }[] = [];
  let ignorados = 0;
  for (const it of places) {
    const district = it.neighborhood || null;
    const lat = it.location?.lat ?? null, lng = it.location?.lng ?? null;
    const email = it.email || (Array.isArray(it.emails) ? it.emails[0] : null) || null;
    const phone = it.phoneUnformatted || it.phone || null;
    const website = it.website || null;
    const address = it.street || it.address || null;
    const cand = { company_name: it.title!, trade_name: it.title!, lat, lng };
    const match = existLeads.find(e =>
      leadMatchesProspect(cand, { nome_fantasia: e.trade_name, razao_social: e.company_name, lat: e.lat, lng: e.lng }).match
      && normName(e.district) === normName(district));
    if (match) {
      const patch: any = {};
      if (phone && phone !== match.phone) patch.phone = phone;
      if (website && website !== match.website) patch.website = website;
      if (email && email !== match.email) patch.email = email;
      if (address && address !== match.address) patch.address = address;
      if (Object.keys(patch).length) updates.push({ id: match.id, patch });
      else ignorados++; // já existe e nada mudou
      continue;
    }
    rows.push({
      prospect_list_id: listId, representative_id: null,
      company_name: it.title, trade_name: it.title, cnpj: null,
      segment: p.segment, category: p.category, source: 'apify_google_places',
      address, district, city: it.city || p.municipio, state: it.state || p.uf,
      zip_code: it.postalCode || null, lat, lng,
      geocode_status: (lat != null && lng != null) ? 'success' : 'pending',
      geocode_source: (lat != null) ? 'google_places' : null,
      phone, email, website,
      raw_data: { fonte: 'apify_google_places', google_url: it.url || null, place_id: it.placeId || null, categoria_google: it.categoryName || null },
      status: 'new',
    });
  }

  // atualiza os que já existem (mantém dono/cliente/status)
  let atualizados = 0;
  for (const u of updates) {
    const { error } = await supabase.from('prospect_leads').update(u.patch).eq('id', u.id);
    if (!error) atualizados++;
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

  return { listId, criados, atualizados, ignorados, fora, foraDoRamo };
}
