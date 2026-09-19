// B2B Prospecção — padronização de qualquer lista que chega (Receita, ABIC, Google, planilhas).
//
// Usado igual na tela (importador) e no script de carga: a regra de limpeza é uma só.
// Saída = objeto pronto para public.b2b_mesclar (a mescla por CNPJ acontece no banco).

export const TIPOS = [
  ['torrefacao', 'Torrefação'], ['produtor', 'Produtor'], ['cooperativa', 'Cooperativa'], ['industria', 'Indústria'],
  ['distribuidor', 'Distribuidor'], ['atacado', 'Atacado'], ['supermercado', 'Supermercado'], ['varejo', 'Varejo'],
  ['cafeteria', 'Cafeteria'], ['food_service', 'Food service'], ['fornecedor', 'Fornecedor'], ['outro', 'Outro'],
] as const;
export type Tipo = typeof TIPOS[number][0];
export const ROTULO_DO_TIPO = Object.fromEntries(TIPOS) as Record<Tipo, string>;

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const;
const NOME_DA_UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amazonas: 'AM', amapa: 'AP', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'minas gerais': 'MG', 'mato grosso do sul': 'MS', 'mato grosso': 'MT',
  para: 'PA', paraiba: 'PB', pernambuco: 'PE', piaui: 'PI', parana: 'PR', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  rondonia: 'RO', roraima: 'RR', 'rio grande do sul': 'RS', 'santa catarina': 'SC', sergipe: 'SE', 'sao paulo': 'SP', tocantins: 'TO',
};

/** CNAE → tipo de empresa. Só os que interessam ao café; o resto fica "outro" até alguém classificar. */
const TIPO_DO_CNAE: Record<string, Tipo> = {
  '0134200': 'produtor', '1081301': 'industria', '1081302': 'torrefacao', '1082100': 'industria',
  '4621400': 'atacado', '4637101': 'atacado', '4639701': 'atacado', '4639702': 'atacado',
  '4711301': 'supermercado', '4711302': 'supermercado', '4712100': 'varejo', '4721102': 'varejo', '4729699': 'varejo',
  '1091102': 'food_service', '5611201': 'food_service', '5611203': 'cafeteria', '5620104': 'food_service',
  '4623199': 'atacado', '8292000': 'fornecedor', '1731100': 'fornecedor', '2222600': 'fornecedor',
};

const SITUACAO_RF: Record<string, string> = { '01': 'Nula', '02': 'Ativa', '03': 'Suspensa', '04': 'Inapta', '08': 'Baixada' };

export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const texto = (v: unknown): string | null => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s && !/^(null|undefined|n\/?a|-|—)$/i.test(s) ? s : null;
};

/** CNPJ com dígitos verificadores corretos, 14 dígitos (repõe zeros à esquerda perdidos em planilha). */
export function normalizarCnpj(v: unknown): string | null {
  let d = digitos(v);
  if (!d) return null;
  // Planilha que leu o CNPJ como número perde os zeros da frente; o dígito verificador confirma.
  if (d.length >= 8 && d.length < 14) d = d.padStart(14, '0');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return null;
  const calc = (base: string, pesos: number[]) => {
    const s = base.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]) ? d : null;
}

export function formatarCnpj(c: string | null | undefined): string {
  const d = digitos(c);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (c ?? '');
}

export function normalizarUf(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  const up = s.toUpperCase();
  if ((UFS as readonly string[]).includes(up)) return up;
  return NOME_DA_UF[semAcento(s).toLowerCase()] ?? null;
}

/** Telefone brasileiro só com dígitos, DDD incluído (10 ou 11 dígitos). Remove +55 e zeros de operadora. */
export function normalizarTelefone(v: unknown): string | null {
  let d = digitos(v);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d.length === 10 || d.length === 11 ? d : null;
}
export const ehCelular = (t: string | null) => !!t && t.length === 11 && t[2] === '9';
export function formatarTelefone(t: string | null | undefined): string {
  const d = digitos(t);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? '';
}

export function normalizarEmail(v: unknown): string | null {
  const s = texto(v)?.toLowerCase().replace(/^mailto:/, '') ?? null;
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function normalizarSite(v: unknown): string | null {
  const s = texto(v);
  if (!s || s.includes('@')) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { const u = new URL(url); return u.hostname.includes('.') ? u.toString().replace(/\/$/, '') : null; } catch { return null; }
}

export function normalizarInstagram(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(s) ?? /^@?([A-Za-z0-9._]{2,30})$/.exec(s);
  return m ? `@${m[1].toLowerCase()}` : null;
}

export function tipoPorCnae(cnae: unknown): Tipo | null {
  const d = digitos(cnae).padStart(7, '0');
  return TIPO_DO_CNAE[d] ?? null;
}

/** Tipo a partir de um texto livre de categoria ("Indústria de café", "Supermercado", "Torrefação"…). */
export function tipoPorTexto(v: unknown): Tipo | null {
  const s = semAcento(String(v ?? '')).toLowerCase();
  if (!s.trim()) return null;
  if (/torref|torrad/.test(s)) return 'torrefacao';
  if (/cooperat/.test(s)) return 'cooperativa';
  if (/industri/.test(s)) return 'industria';
  if (/produtor|fazenda|sitio|cafeicult/.test(s)) return 'produtor';
  if (/distribu/.test(s)) return 'distribuidor';
  if (/atacad/.test(s)) return 'atacado';
  if (/supermerc|hipermerc|mercado/.test(s)) return 'supermercado';
  if (/cafeteria|coffee ?shop|\bcafe\b bar/.test(s)) return 'cafeteria';
  if (/restaur|food ?service|lanchon|padaria|hotel/.test(s)) return 'food_service';
  if (/fornecedor|embalag|maquin|equipament/.test(s)) return 'fornecedor';
  if (/varejo|empori|loja|mercearia/.test(s)) return 'varejo';
  return null;
}

/**
 * Razão social de MEI traz o nome da pessoa e às vezes o CPF ("NOME DA PESSOA 12345678901")
 * ou a base do CNPJ na frente ("17.246.022 NOME DA PESSOA"). LGPD: guarda sem o número e marca.
 */
export function limparRazaoSocial(v: unknown): { razao: string | null; pessoaFisica: boolean } {
  const s = texto(v);
  if (!s) return { razao: null, pessoaFisica: false };
  const comCpf = /\s\d{11}$/.test(s);
  const comBase = /^\d{2}\.?\d{3}\.?\d{3}\s/.test(s);
  const razao = s.replace(/\s\d{11}$/, '').replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, '').trim();
  return { razao: razao || null, pessoaFisica: comCpf || comBase };
}

const RUIDO_DE_NOME = /\b(ltda|me|epp|eireli|s\/?a|sa|mei|comercio|comercial|industria|ind|com|e|de|da|do|dos|das|cafe|cafes)\b/g;
/** Chave para juntar quem vem sem CNPJ: nome sem ruído + município + UF. */
export function chaveDeNome(nome: string | null, municipio: string | null, uf: string | null): string | null {
  if (!nome || !municipio || !uf) return null;
  const n = semAcento(nome).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(RUIDO_DE_NOME, ' ').replace(/\s+/g, ' ').trim();
  const m = semAcento(municipio).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return n && m ? `${n}|${m}|${uf}` : null;
}

function data(v: unknown): string | null {
  const s = texto(v);
  if (!s) return null;
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ------------------------------------------------------------------ campos e cabeçalhos
export const CAMPOS = [
  ['cnpj', 'CNPJ'], ['razao_social', 'Razão social'], ['nome_fantasia', 'Nome fantasia'], ['tipo', 'Tipo / categoria'],
  ['cnae_principal', 'CNAE'], ['cnae_descricao', 'Descrição do CNAE'], ['inscricao_estadual', 'Inscrição estadual'],
  ['situacao_cadastral', 'Situação cadastral'], ['porte', 'Porte'], ['data_abertura', 'Data de abertura'],
  ['uf', 'UF / estado'], ['municipio', 'Município / cidade'], ['cep', 'CEP'], ['logradouro', 'Endereço'], ['numero', 'Número'],
  ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['telefone', 'Telefone'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'],
  ['site', 'Site'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['marcas', 'Marcas'], ['notas', 'Observações'],
] as const;
export type Campo = typeof CAMPOS[number][0];

const SINONIMOS: Record<Campo, string[]> = {
  cnpj: ['cnpj', 'cnpj cpf', 'documento', 'cnpj da empresa'],
  razao_social: ['razao social', 'razao', 'nome empresarial', 'empresa', 'nome da empresa', 'company'],
  nome_fantasia: ['nome fantasia', 'fantasia', 'trade name', 'nome'],
  tipo: ['tipo', 'categoria', 'segmento', 'setor', 'category', 'segment'],
  cnae_principal: ['cnae', 'cnae principal', 'cnae fiscal'],
  cnae_descricao: ['cnae descricao', 'descricao cnae', 'atividade', 'atividade principal'],
  inscricao_estadual: ['inscricao estadual', 'ie', 'insc estadual'],
  situacao_cadastral: ['situacao cadastral', 'situacao', 'status receita'],
  porte: ['porte', 'porte da empresa'],
  data_abertura: ['data inicio atividade', 'data abertura', 'abertura', 'inicio atividade', 'fundacao'],
  uf: ['uf', 'estado', 'state'],
  municipio: ['municipio', 'municipio nome', 'cidade', 'city', 'local'],
  cep: ['cep', 'zip', 'zip code'],
  logradouro: ['logradouro', 'endereco', 'address', 'rua'],
  numero: ['numero', 'n', 'nro'],
  complemento: ['complemento'],
  bairro: ['bairro', 'district'],
  telefone: ['telefone', 'fone', 'phone', 'tel', 'telefone 1', 'contato'],
  whatsapp: ['whatsapp', 'whats', 'celular'],
  email: ['email', 'e mail', 'mail'],
  site: ['site', 'website', 'url', 'web'],
  instagram: ['instagram', 'ig'],
  facebook: ['facebook', 'fb'],
  marcas: ['marcas', 'marca', 'marca produto', 'produtos'],
  notas: ['observacao', 'observacoes', 'notas', 'descricao', 'obs'],
};

const chaveDeCabecalho = (h: string) => semAcento(h).toLowerCase().replace(/[_\-/.]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Sugere o campo de cada coluna pelo nome do cabeçalho. Coluna desconhecida = null (ignorada). */
export function sugerirMapeamento(cabecalhos: string[]): Record<string, Campo | null> {
  const usados = new Set<Campo>();
  const out: Record<string, Campo | null> = {};
  for (const h of cabecalhos) {
    const k = chaveDeCabecalho(h);
    const achado = (Object.entries(SINONIMOS) as [Campo, string[]][]).find(([c, s]) => !usados.has(c) && s.includes(k));
    out[h] = achado ? achado[0] : null;
    if (achado) usados.add(achado[0]);
  }
  return out;
}

export interface LinhaB2B {
  cnpj: string | null; chave_nome: string | null; razao_social: string | null; nome_fantasia: string | null; tipo: Tipo;
  cnae_principal: string | null; cnae_descricao: string | null; inscricao_estadual: string | null; situacao_cadastral: string | null;
  porte: string | null; data_abertura: string | null; pessoa_fisica: boolean; uf: string | null; municipio: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  telefone: string | null; whatsapp: string | null; email: string | null; site: string | null; instagram: string | null;
  facebook: string | null; marcas: string[]; notas: string | null;
}

/** Uma linha crua (já com as colunas mapeadas para campos) → linha padronizada. `valida` = tem CNPJ ou chave. */
export function normalizarLinha(bruta: Partial<Record<Campo, unknown>>): { linha: LinhaB2B; valida: boolean; cnpjInvalido: boolean } {
  const cnpjBruto = digitos(bruta.cnpj);
  const cnpj = normalizarCnpj(bruta.cnpj);
  const { razao, pessoaFisica } = limparRazaoSocial(bruta.razao_social);
  const fantasia = texto(bruta.nome_fantasia);
  const uf = normalizarUf(bruta.uf);
  const municipio = texto(bruta.municipio)?.toUpperCase() ?? null;
  const cnae = digitos(bruta.cnae_principal) ? digitos(bruta.cnae_principal).padStart(7, '0') : null;
  const whatsInformado = normalizarTelefone(bruta.whatsapp);
  const tel = normalizarTelefone(bruta.telefone) ?? whatsInformado;
  const whats = whatsInformado ?? (ehCelular(tel) ? tel : null);
  const situacao = texto(bruta.situacao_cadastral);
  const marcas = String(bruta.marcas ?? '').split(/[·;|,\n]/).map(m => m.trim()).filter(m => m && m.length <= 80);
  const tipo = tipoPorTexto(bruta.tipo) ?? tipoPorCnae(cnae) ?? tipoPorTexto(bruta.cnae_descricao) ?? 'outro';
  const linha: LinhaB2B = {
    cnpj, chave_nome: chaveDeNome(fantasia ?? razao, municipio, uf),
    razao_social: razao, nome_fantasia: fantasia, tipo,
    cnae_principal: cnae, cnae_descricao: texto(bruta.cnae_descricao), inscricao_estadual: texto(bruta.inscricao_estadual),
    situacao_cadastral: situacao ? (SITUACAO_RF[situacao.padStart(2, '0')] ?? situacao) : null,
    porte: texto(bruta.porte), data_abertura: data(bruta.data_abertura), pessoa_fisica: pessoaFisica,
    uf, municipio, cep: digitos(bruta.cep).length === 8 ? digitos(bruta.cep) : null,
    logradouro: texto(bruta.logradouro), numero: texto(bruta.numero), complemento: texto(bruta.complemento), bairro: texto(bruta.bairro),
    telefone: tel, whatsapp: whats, email: normalizarEmail(bruta.email), site: normalizarSite(bruta.site),
    instagram: normalizarInstagram(bruta.instagram), facebook: texto(bruta.facebook), marcas, notas: texto(bruta.notas),
  };
  // CNPJ informado e errado = dado suspeito: a linha fica fora, mesmo tendo nome e cidade.
  const cnpjInvalido = !!cnpjBruto && !cnpj;
  return { linha, valida: !cnpjInvalido && !!(linha.cnpj || linha.chave_nome), cnpjInvalido };
}
