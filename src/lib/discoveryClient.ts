// Discovery Intelligence — client (TASK INTEL-1).
// Dispara o run via edge function discovery-run (token Apify só no servidor), faz polling,
// normaliza por fonte, deduplica (canonical_url / external_id) e pontua (score determinístico),
// gravando em discovery_results. Grupo/comunidade NUNCA vira lead automaticamente.
import { supabase } from './supabase';

export type DiscoverySource = 'whatsapp_group' | 'whatsapp_channel' | 'google_places';

// Fontes operacionais no MVP (só as com actor real). label + tipo + se é "business" (mapa) ou comunidade.
export const DISCOVERY_SOURCES: { id: DiscoverySource; label: string; kind: 'community' | 'business'; note?: string }[] = [
  { id: 'whatsapp_group', label: 'WhatsApp — grupos públicos', kind: 'community' },
  { id: 'whatsapp_channel', label: 'WhatsApp — canais públicos', kind: 'community', note: 'secundário' },
  { id: 'google_places', label: 'Empresas (Google Maps)', kind: 'business', note: 'baseline existente' },
];

const RESULT_TYPE: Record<DiscoverySource, string> = {
  whatsapp_group: 'PUBLIC_WHATSAPP_GROUP',
  whatsapp_channel: 'PUBLIC_WHATSAPP_CHANNEL',
  google_places: 'BUSINESS',
};

export interface RunParams {
  source: DiscoverySource;
  keywords: string[];
  country: string;   // 'BR'
  state?: string;    // 'SP'
  city?: string;
  maxResults: number;
  campaignId?: string | null;
}

export interface NormalizedResult {
  source: DiscoverySource;
  result_type: string;
  title: string | null;
  description: string | null;
  public_url: string | null;
  canonical_url: string | null;
  external_id: string | null;
  keyword: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  member_count: number | null;
  raw_payload: any;
}

// --------- Normalização por fonte ---------
function canonWhatsApp(url: string | null | undefined, code: string | null | undefined): string | null {
  if (code) return `wa:${String(code).trim().toLowerCase()}`;
  if (!url) return null;
  const m = String(url).match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);
  if (m) return `wa:${m[1].toLowerCase()}`;
  return String(url).trim().toLowerCase().replace(/[?#].*$/, '');
}
function canonUrl(url: string | null | undefined, extId: string | null | undefined): string | null {
  if (extId) return `gp:${String(extId).trim().toLowerCase()}`;
  if (!url) return null;
  return String(url).trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
}

export function normalizeItem(source: DiscoverySource, it: any): NormalizedResult {
  if (source === 'whatsapp_group' || source === 'whatsapp_channel') {
    const url = it.invite_url || it.inviteUrl || it.final_url || it.url || it.link || null;
    const code = it.invite_code || it.inviteCode || null;
    return {
      source, result_type: RESULT_TYPE[source],
      title: it.name || it.title || null,
      description: it.description || null,
      public_url: url,
      canonical_url: canonWhatsApp(url, code),
      external_id: code || null,
      keyword: it.keyword || it.search_term || null,
      country: it.country || null, state: null, city: null,
      member_count: (typeof it.member_count === 'number' ? it.member_count : null),
      raw_payload: it,
    };
  }
  // google_places
  const url = it.website || it.url || null;
  const pid = it.placeId || it.place_id || null;
  return {
    source, result_type: RESULT_TYPE[source],
    title: it.title || it.name || null,
    description: it.categoryName || it.category || null,
    public_url: url,
    canonical_url: canonUrl(it.url || url, pid),
    external_id: pid,
    keyword: it.searchString || null,
    country: 'BR', state: it.state || null, city: it.city || null,
    member_count: null,
    raw_payload: it,
  };
}

// --------- Score determinístico 0–100 (fatores registrados) ---------
const NICHE = ['caf', 'represent', 'vend', 'distribu', 'mercado', 'padaria', 'atacad', 'food', 'restaurante', 'afiliad', 'bar', 'conveni', 'supermerc'];
export function scoreResult(n: NormalizedResult, p: RunParams): { score: number; factors: Record<string, number> } {
  const text = `${n.title || ''} ${n.description || ''}`.toLowerCase();
  const kwHit = p.keywords.some(k => text.includes(String(k).toLowerCase().split(' ')[0])) ? 20 : 0;
  const niche = NICHE.some(t => text.includes(t)) ? 20 : 0;
  const region = (n.country || p.country) === (p.country || 'BR') ? 15 : 0;
  const hasDesc = n.description ? 15 : 0;
  const size = (typeof n.member_count === 'number' && n.member_count > 0) ? 10 : 0;
  const hasUrl = n.public_url ? 10 : 0;
  const completeness = (n.title && n.public_url && (n.description || n.member_count)) ? 10 : 0;
  const factors = { keyword_match: kwHit, niche, region, has_description: hasDesc, public_size: size, has_url: hasUrl, completeness };
  const score = Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}
export function priorityLabel(score: number): 'Alta' | 'Média' | 'Baixa' {
  return score >= 70 ? 'Alta' : score >= 40 ? 'Média' : 'Baixa';
}

// --------- Edge function ---------
export async function startRun(p: RunParams): Promise<{ runId: string; actor: string } | { error: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke('discovery-run', { body: { action: 'start', ...p } });
  if (error) return { error: 'invoke_error', message: error.message };
  if (data?.error) return { error: data.error, message: data.message };
  return { runId: data.runId, actor: data.actor };
}

export async function pollStatus(runId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('discovery-run', { body: { action: 'status', runId } });
  if (error) return { status: 'error', message: error.message };
  return data;
}

export async function checkAccount(): Promise<any> {
  const { data, error } = await supabase.functions.invoke('discovery-run', { body: { action: 'account' } });
  if (error) return { ok: false, message: error.message };
  return data;
}

// --------- Import: normaliza + dedup + score + grava ---------
export interface ImportResult { inserted: number; duplicates: number; total: number }

export async function importResults(runId: string, campaignId: string | null, p: RunParams, items: any[]): Promise<ImportResult> {
  const normalized = (items || []).map(it => normalizeItem(p.source, it)).filter(n => n.title || n.public_url);
  // dedup dentro do lote (canonical_url ou external_id)
  const seen = new Set<string>();
  const batch: NormalizedResult[] = [];
  for (const n of normalized) {
    const key = n.canonical_url || (n.external_id ? `${p.source}:${n.external_id}` : (n.title || Math.random().toString()));
    if (seen.has(key)) continue;
    seen.add(key); batch.push(n);
  }
  // dedup contra o banco (canonical_url já existentes)
  const canon = batch.map(n => n.canonical_url).filter(Boolean) as string[];
  let existing = new Set<string>();
  if (canon.length) {
    const { data } = await supabase.from('discovery_results').select('canonical_url').in('canonical_url', canon);
    existing = new Set((data || []).map((r: any) => r.canonical_url));
  }
  const rows = batch.map(n => {
    const { score, factors } = scoreResult(n, p);
    return {
      campaign_id: campaignId, run_id: runId, source: n.source, result_type: n.result_type,
      title: n.title, description: n.description, public_url: n.public_url, canonical_url: n.canonical_url,
      external_id: n.external_id, keyword: n.keyword, country: n.country, state: n.state, city: n.city,
      member_count: n.member_count, provider: 'apify', raw_payload: n.raw_payload,
      score, score_factors: factors, status: 'new',
    };
  }).filter(r => !(r.canonical_url && existing.has(r.canonical_url)));

  let inserted = 0;
  const B = 200;
  for (let i = 0; i < rows.length; i += B) {
    const slice = rows.slice(i, i + B);
    const { error } = await supabase.from('discovery_results').insert(slice);
    if (!error) { inserted += slice.length; continue; }
    // fallback: se um lote colidir com o índice único (dup rara), insere linha a linha
    for (const row of slice) {
      const { error: e2 } = await supabase.from('discovery_results').insert(row);
      if (!e2) inserted++;
    }
  }
  await supabase.from('prospect_runs').update({ status: 'done', result_count: inserted, finished_at: new Date().toISOString() }).eq('id', runId);
  return { inserted, duplicates: normalized.length - inserted, total: normalized.length };
}
