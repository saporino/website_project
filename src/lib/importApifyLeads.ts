// Importa places do Apify (Google Maps) num POOL não-atribuído (prospect_list sem dono).
// A lista do rep é SEMPRE a do scraper (endereço real). A RF (prospects_b2b) só enriquece/dedup/sinaliza:
//   - match ALTO (nome forte + mesmo município + mesmo bairro) -> enriquece o lead com CNPJ/razão da RF
//     e marca o registro RF como COBERTO (some dos faltantes).
//   - match MÉDIO (nome forte sem bairro / nome médio) -> fila lead_rf_candidates (admin confirma).
//   - sem match -> lead puro do scraper.
import { supabase } from './supabase';
import { classifyRfMatch, leadMatchesProspect, normName } from './leadMatch';
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
  segment: ClientSegment | null;      // provisório
  runId?: string | null;
}

export interface ApifyImportResult {
  listId: string; criados: number; enriquecidos: number; pendentes: number; ignorados: number; fora: number;
}

interface RfRow { cnpj: string; nome_fantasia: string | null; razao_social: string | null; bairro: string | null; }

export async function importApifyLeads(p: ApifyImportParams): Promise<ApifyImportResult> {
  // Rede de segurança geográfica: o Google às vezes devolve PDVs de outras cidades.
  // Só entram no pool os que SÃO do município alvo (ou sem cidade preenchida).
  const alvo = normName(p.municipio);
  const fora = (p.items || []).filter(it => (it.title || '').trim() && it.city && normName(it.city) !== alvo).length;
  const places = (p.items || []).filter(it => (it.title || '').trim() && (!it.city || normName(it.city) === alvo));
  if (!places.length) throw new Error('Nenhum place do município retornado.');
  const muniStop = new Set(normName(p.municipio).split(' ').filter(Boolean));

  // 1) universo RF do município (só não-cobertos) para o match — paginado (cap PostgREST 1000)
  const rf: RfRow[] = [];
  for (let from = 0; from < 12000; from += 1000) {
    const { data } = await supabase.from('prospects_b2b')
      .select('cnpj,nome_fantasia,razao_social,bairro')
      .eq('uf', p.uf).eq('municipio', p.municipio).is('covered_at', null)
      .range(from, from + 999);
    const rows = (data as RfRow[]) || [];
    rf.push(...rows);
    if (rows.length < 1000) break;
  }

  // 2) leads já existentes no município (não reimportar o mesmo PDV)
  const { data: existing } = await supabase.from('prospect_leads')
    .select('company_name,trade_name,lat,lng,district').ilike('city', p.municipio);
  const existLeads = (existing || []) as any[];

  // 3) cria o POOL (sem dono)
  const { data: lr, error: lErr } = await supabase.from('prospect_lists').insert({
    name: `${p.municipio}/${p.uf} — Apify ${p.category}`, segment: p.segment,
    source_type: 'scraper', source_name: 'Apify Google Places', status: 'imported',
    assigned_representative_id: null, total_count: 0, pending_count: 0,
  }).select('id').single();
  if (lErr) throw lErr;
  const listId = lr!.id as string;

  // 4) monta os leads + decide o match RF (sem inserir ainda — precisamos do id depois)
  type Pending = { lead: any; rf: RfRow | null; level: 'high' | 'medium' | 'none'; score: number; reason: string };
  const pend: Pending[] = [];
  let ignorados = 0;
  for (const it of places) {
    const district = it.neighborhood || null;
    const cand = { company_name: it.title!, trade_name: it.title!, lat: it.location?.lat ?? null, lng: it.location?.lng ?? null, district };
    // dedup contra leads já existentes (nome + bairro/nome)
    const dup = existLeads.some(e =>
      leadMatchesProspect({ company_name: cand.company_name, trade_name: cand.trade_name, lat: cand.lat, lng: cand.lng },
        { nome_fantasia: e.trade_name, razao_social: e.company_name, lat: e.lat, lng: e.lng }).match
      && normName(e.district) === normName(district));
    if (dup) { ignorados++; continue; }

    // match RF: melhor high; senão melhor medium
    let bestHigh: { rf: RfRow; score: number } | null = null;
    let bestMed: { rf: RfRow; score: number; reason: string } | null = null;
    for (const r of rf) {
      const c = classifyRfMatch(cand, r, { extraStop: muniStop });
      if (c.level === 'high' && (!bestHigh || c.score > bestHigh.score)) bestHigh = { rf: r, score: c.score };
      else if (c.level === 'medium' && (!bestMed || c.score > bestMed.score)) bestMed = { rf: r, score: c.score, reason: c.reason };
    }
    const lat = it.location?.lat ?? null, lng = it.location?.lng ?? null;
    const email = it.email || (Array.isArray(it.emails) ? it.emails[0] : null);
    const base: any = {
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
    };
    if (bestHigh) {
      base.rf_cnpj = bestHigh.rf.cnpj; base.rf_razao = bestHigh.rf.razao_social || bestHigh.rf.nome_fantasia || null;
      base.rf_match_status = 'confirmed';
      pend.push({ lead: base, rf: bestHigh.rf, level: 'high', score: bestHigh.score, reason: 'nome forte + mesmo bairro' });
    } else if (bestMed) {
      base.rf_match_status = 'pending';
      pend.push({ lead: base, rf: bestMed.rf, level: 'medium', score: bestMed.score, reason: bestMed.reason });
    } else {
      base.rf_match_status = 'none';
      pend.push({ lead: base, rf: null, level: 'none', score: 0, reason: '' });
    }
  }

  // 5) insere leads (com id de volta) e linka cobertura/fila
  const inserted: { id: string; pend: Pending }[] = [];
  const B = 200;
  for (let i = 0; i < pend.length; i += B) {
    const slice = pend.slice(i, i + B);
    const { data, error } = await supabase.from('prospect_leads').insert(slice.map(s => s.lead)).select('id');
    if (error) throw error;
    (data || []).forEach((row: any, idx: number) => inserted.push({ id: row.id, pend: slice[idx] }));
  }

  // high -> cobre a RF; medium -> fila de candidatos
  const candidates: any[] = [];
  let enriquecidos = 0, pendentes = 0;
  for (const ins of inserted) {
    if (ins.pend.level === 'high' && ins.pend.rf) {
      enriquecidos++;
      await supabase.from('prospects_b2b')
        .update({ covered_at: new Date().toISOString(), covered_by_lead_id: ins.id })
        .eq('cnpj', ins.pend.rf.cnpj);
    } else if (ins.pend.level === 'medium' && ins.pend.rf) {
      pendentes++;
      candidates.push({
        lead_id: ins.id, rf_cnpj: ins.pend.rf.cnpj, rf_razao: ins.pend.rf.razao_social,
        rf_fantasia: ins.pend.rf.nome_fantasia, rf_bairro: ins.pend.rf.bairro,
        rf_municipio: p.municipio, rf_uf: p.uf, score: Number(ins.pend.score.toFixed(3)), reason: ins.pend.reason,
      });
    }
  }
  if (candidates.length) {
    for (let i = 0; i < candidates.length; i += B) {
      await supabase.from('lead_rf_candidates').insert(candidates.slice(i, i + B));
    }
  }

  const criados = inserted.length;
  await supabase.from('prospect_lists').update({ total_count: criados, pending_count: criados }).eq('id', listId);
  if (p.runId) {
    await supabase.from('prospect_runs').update({
      leads_created: criados, prospect_list_id: listId, status: 'done', finished_at: new Date().toISOString(),
    }).eq('id', p.runId);
  }

  return { listId, criados, enriquecidos, pendentes, ignorados, fora };
}
