// Camada 2 — promove uma fatia do universo (prospects_b2b) para a esteira de trabalho
// (prospect_lists + prospect_leads), aplicando a MESMA regra de dedup por CNPJ que o
// ProspectionManager usa (match por dígitos do CNPJ contra a carteira). Não reescreve a
// dedup do importador de CSV — apenas reaproveita a chave forte (CNPJ) no momento da promoção.
import { supabase } from './supabase';
import { normName } from './leadMatch';

const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '');

export interface PromoteResult {
  listId: string;
  total: number;
  novos: number;
  duplicados: number;
}

interface ProspectRow {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  cnae_principal: string | null; cnae_descricao: string | null;
  logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; municipio: string | null; uf: string | null; cep: string | null;
  telefone: string | null; email: string | null; lat: number | null; lng: number | null;
}

/**
 * Cria uma lista de prospecção a partir de um município (ou de uma seleção de prospects),
 * deduplicando por CNPJ contra representative_clients. Retorna contagens.
 */
export async function promoteMunicipio(params: {
  uf: string;
  municipio: string;
  cnaes?: string[];           // opcional: restringe a CNAEs
  listName?: string;
  maxRows?: number;
}): Promise<PromoteResult> {
  const { uf, municipio, cnaes, maxRows = 5000 } = params;

  // 1) fatia do universo
  let q = supabase.from('prospects_b2b')
    .select('cnpj,razao_social,nome_fantasia,cnae_principal,cnae_descricao,logradouro,numero,complemento,bairro,municipio,uf,cep,telefone,email,lat,lng')
    .eq('uf', uf).eq('municipio', municipio).limit(maxRows);
  if (cnaes && cnaes.length) q = q.in('cnae_principal', cnaes);
  const { data: prospects, error: pErr } = await q;
  if (pErr) throw pErr;
  if (!prospects || prospects.length === 0) throw new Error('Nenhum prospect nesta seleção.');

  // 2) carteira de clientes (dedup por CNPJ) — mesma chave do findExistingClient
  const { data: clients } = await supabase
    .from('representative_clients').select('id,cnpj');
  const clientByCnpj = new Map<string, string>();
  (clients || []).forEach(c => { const d = onlyDigits(c.cnpj); if (d) clientByCnpj.set(d, c.id); });

  // 3) cria a lista
  const listName = params.listName || `${municipio}/${uf} — base pública (RF)`;
  const dupCount = prospects.filter(p => clientByCnpj.has(onlyDigits(p.cnpj))).length;
  const { data: listRow, error: lErr } = await supabase.from('prospect_lists').insert({
    name: listName, segment: null, source_type: 'scraper', source_name: 'RF Dados Abertos 2026-05',
    status: 'imported', total_count: prospects.length,
    pending_count: prospects.length - dupCount, duplicate_count: dupCount,
  }).select('id').single();
  if (lErr) throw lErr;
  const listId = listRow!.id as string;

  // 4) monta os leads (dedup por CNPJ embutida)
  const leads = (prospects as ProspectRow[]).map(p => {
    const dupClientId = clientByCnpj.get(onlyDigits(p.cnpj)) || null;
    return {
      prospect_list_id: listId,
      company_name: p.razao_social || p.nome_fantasia || p.cnpj,
      trade_name: p.nome_fantasia,
      cnpj: p.cnpj,
      segment: null as string | null,
      category: p.cnae_descricao,
      source: 'rf_dados_abertos',
      address: p.logradouro, number: p.numero, complement: p.complemento,
      district: p.bairro, city: p.municipio, state: p.uf, zip_code: p.cep,
      lat: p.lat, lng: p.lng,
      geocode_status: (p.lat != null && p.lng != null) ? 'success' : 'pending',
      geocode_source: (p.lat != null) ? 'municipio_centroide' : null,
      phone: p.telefone, email: p.email,
      raw_data: { cnae_principal: p.cnae_principal, fonte: 'rf_dados_abertos' },
      status: dupClientId ? 'duplicate' : 'new',
      duplicate_of_client_id: dupClientId,
    };
  });

  // 5) insere em lotes
  const B = 500;
  for (let i = 0; i < leads.length; i += B) {
    const { error } = await supabase.from('prospect_leads').insert(leads.slice(i, i + B));
    if (error) throw error;
  }

  return { listId, total: leads.length, novos: leads.length - dupCount, duplicados: dupCount };
}

export interface AddResult { adicionados: number; ignorados: number; }

/**
 * "Fechar o buraco": adiciona PDVs do universo (prospects_b2b) a uma LISTA EXISTENTE do rep,
 * reusando o mesmo caminho/dedup. Pula quem já está na lista (por CNPJ ou nome normalizado) e
 * marca como 'duplicate' quem já é cliente (CNPJ). Não duplica leads.
 */
export async function addProspectsToList(params: {
  listId: string;
  prospects: ProspectRow[];
}): Promise<AddResult> {
  const { listId, prospects } = params;
  if (!prospects.length) return { adicionados: 0, ignorados: 0 };

  // leads que já existem na lista (dedup por CNPJ e por nome normalizado)
  const { data: existing } = await supabase
    .from('prospect_leads').select('cnpj,company_name,trade_name').eq('prospect_list_id', listId);
  const seenCnpj = new Set<string>();
  const seenName = new Set<string>();
  (existing || []).forEach(l => {
    const d = onlyDigits(l.cnpj); if (d) seenCnpj.add(d);
    const n = normName(l.trade_name || l.company_name); if (n) seenName.add(n);
  });

  // carteira de clientes (CNPJ) -> marca duplicate_of_client_id
  const { data: clients } = await supabase.from('representative_clients').select('id,cnpj');
  const clientByCnpj = new Map<string, string>();
  (clients || []).forEach(c => { const d = onlyDigits(c.cnpj); if (d) clientByCnpj.set(d, c.id); });

  const fresh = prospects.filter(p => {
    const d = onlyDigits(p.cnpj);
    const n = normName(p.nome_fantasia || p.razao_social);
    if (d && seenCnpj.has(d)) return false;
    if (n && seenName.has(n)) return false;
    return true;
  });

  const leads = fresh.map(p => {
    const dupClientId = clientByCnpj.get(onlyDigits(p.cnpj)) || null;
    return {
      prospect_list_id: listId,
      company_name: p.razao_social || p.nome_fantasia || p.cnpj,
      trade_name: p.nome_fantasia, cnpj: p.cnpj, category: p.cnae_descricao, source: 'rf_dados_abertos',
      address: p.logradouro, number: p.numero, complement: p.complemento, district: p.bairro,
      city: p.municipio, state: p.uf, zip_code: p.cep, lat: p.lat, lng: p.lng,
      geocode_status: (p.lat != null && p.lng != null) ? 'success' : 'pending',
      geocode_source: (p.lat != null) ? 'municipio_centroide' : null,
      phone: p.telefone, email: p.email,
      raw_data: { cnae_principal: p.cnae_principal, fonte: 'rf_dados_abertos', origem: 'fechar_buraco' },
      status: dupClientId ? 'duplicate' : 'new', duplicate_of_client_id: dupClientId,
    };
  });

  const B = 500;
  for (let i = 0; i < leads.length; i += B) {
    const { error } = await supabase.from('prospect_leads').insert(leads.slice(i, i + B));
    if (error) throw error;
  }
  return { adicionados: leads.length, ignorados: prospects.length - leads.length };
}
