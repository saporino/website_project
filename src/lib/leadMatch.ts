// Match best-effort entre lead de scraper (sem CNPJ) e prospect do universo CNPJ (prospects_b2b).
// Estrategia: CNPJ quando ambos tiverem; senao nome normalizado (sem acento/caixa, sem termos
// genericos) + proximidade geografica (mesmo municipio + ~150 m). Resultado é APROXIMADO.

const STOPWORDS = new Set([
  // tipos de estabelecimento
  'padaria','panificadora','confeitaria','cafeteria','cafe','restaurante','lanchonete','bar','mercado',
  'supermercado','hipermercado','mercearia','minimercado','empório','emporio','comercio','comercial',
  'industria','industrial','distribuidora','atacado','varejo','loja','casa','ponto','rotisserie','choperia',
  // razao social / forma juridica
  'ltda','me','epp','eireli','sa','cia','do','da','de','dos','das','e','o','a','os','as','-','&','em','no','na',
  // produtos / termos de domínio genéricos (alta chance de coincidir falso)
  'paes','pao','doce','doces','salgado','salgados','lanche','lanches','bolos','bolo','pizza','pizzaria',
  'alimentos','alimenticios','alimentacao','sabor','sabores','delicia','delicias','gourmet','express',
  'servicos','servico','grill','self','point','kg','kilo','buffet','refeicoes','refeicao',
  // termos geográficos / de via comuns
  'avenida','central','centro','jardim','vila','parque','novo','nova',
]);

export function normName(s?: string | null): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// "núcleo" do nome: tokens sem termos genéricos (ex.: "Padaria Doce Pedaço" -> "doce pedaco").
// extraStop permite remover tokens do município corrente (ex.: "jundiai" no nome da empresa).
export function coreTokens(s?: string | null, extraStop?: Set<string>): string[] {
  return normName(s).split(' ').filter(t => t.length >= 3 && !STOPWORDS.has(t) && !(extraStop && extraStop.has(t)));
}

export function onlyDigits(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

// distância em metros (haversine)
export function distMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Jaccard + tokens compartilhados
function tokenStats(aTok: string[], bTok: string[]): { jaccard: number; shared: string[] } {
  if (!aTok.length || !bTok.length) return { jaccard: 0, shared: [] };
  const A = new Set(aTok), B = new Set(bTok);
  const shared: string[] = []; A.forEach(t => { if (B.has(t)) shared.push(t); });
  return { jaccard: shared.length / (A.size + B.size - shared.length), shared };
}

export interface MatchableLead { cnpj?: string | null; company_name?: string | null; trade_name?: string | null; lat?: number | null; lng?: number | null; }
export interface MatchableProspect { cnpj?: string | null; nome_fantasia?: string | null; razao_social?: string | null; lat?: number | null; lng?: number | null; }

/**
 * Decide se um lead e um prospect são a mesma empresa (best-effort).
 * Retorna {match, reason, score}.
 */
export function leadMatchesProspect(lead: MatchableLead, prospect: MatchableProspect, opts?: { maxMeters?: number; extraStop?: Set<string> }): { match: boolean; reason: string; score: number } {
  const maxMeters = opts?.maxMeters ?? 150;
  // 1) CNPJ forte
  const lc = onlyDigits(lead.cnpj), pc = onlyDigits(prospect.cnpj);
  if (lc && pc && lc === pc) return { match: true, reason: 'cnpj', score: 1 };

  // 2) nome + proximidade. Exige NÚCLEO não-vazio (senão "Padaria Avenida" vira [] e casa com tudo).
  const leadTok = coreTokens(lead.trade_name || lead.company_name, opts?.extraStop);
  if (leadTok.length === 0) return { match: false, reason: '', score: 0 };
  let best = 0; let bestShared: string[] = [];
  for (const n of [prospect.nome_fantasia, prospect.razao_social]) {
    const t = coreTokens(n, opts?.extraStop);
    if (!t.length) continue;
    const st = tokenStats(leadTok, t);
    if (st.jaccard > best) { best = st.jaccard; bestShared = st.shared; }
  }
  // proximidade só conta quando AMBOS têm coordenada real (sem default otimista).
  // Obs: prospects geocodificados por centroide ficam no centro do município — proximidade
  // só é confiável quando a coordenada é de endereço; por isso o nome é o sinal primário.
  const haveBoth = lead.lat != null && lead.lng != null && prospect.lat != null && prospect.lng != null;
  const near = haveBoth && distMeters([lead.lat!, lead.lng!], [prospect.lat!, prospect.lng!]) <= maxMeters;
  // nome forte = >=2 tokens distintivos compartilhados OU 1 token longo (>=6 chars) — evita casar
  // por um único token genérico curto ("terra"). Nome parcial só fecha com proximidade real.
  const nameStrong = bestShared.length >= 2 || bestShared.some(t => t.length >= 6);
  if (best >= 0.5 && nameStrong) return { match: true, reason: 'nome', score: best };
  if (best >= 0.34 && near) return { match: true, reason: 'nome+geo', score: best };
  return { match: false, reason: '', score: best };
}
