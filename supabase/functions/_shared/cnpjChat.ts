/**
 * ADAPTADOR cnpj.chat — tradução, não acoplamento.
 *
 * ⚠️ NENHUMA CHAVE AQUI, E NENHUMA CHAMADA REAL POR PADRÃO.
 * O trial (7 dias / 2.000 operações) NÃO foi iniciado. Este módulo existe para
 * que, no dia em que for, baste pôr o token num secret e trocar um sinalizador —
 * sem reescrever nada e sem gastar operação descobrindo o formato na marra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM ADAPTADOR, E NÃO CHAMADAS ESPALHADAS
 *
 * O RepCo já prospecta com Apify (`prospect_runs.provider`). O cnpj.chat é um
 * SEGUNDO fornecedor dos mesmos dados. Se o formato dele vazar para dentro do
 * app, trocar de fornecedor vira reescrita. Aqui ele entra, é traduzido para o
 * formato que o RepCo já usa (`prospects_b2b`), e sai.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE AINDA NÃO SE SABE — e por que isso está escrito, não presumido
 *
 * O levantamento trouxe os endereços (`/companies/{cnpj}`, `/lists`) e o tipo
 * de autenticação (Bearer). NÃO trouxe o formato das respostas. Então:
 *
 *   · `traduzirEmpresa` aceita os nomes de campo mais prováveis E os nossos,
 *     e devolve `null` no que não encontrar. Campo ausente vira ausente, nunca
 *     string vazia nem valor inventado — prospect com razão social em branco é
 *     pior do que prospect que não entrou.
 *   · nada aqui grava no banco. Quem chama decide.
 *
 * Quando o contrato real for conhecido, só `traduzirEmpresa` muda.
 */

/** O formato que o RepCo já entende — espelha `prospects_b2b`. */
export interface ProspectNormalizado {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  situacao_cadastral: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  telefone: string | null;
  email: string | null;
  fonte: 'cnpj_chat';
}

export const BASE_REST = 'https://api.cnpj.chat/api/v1';

/** Só dígitos, 14 posições. CNPJ com máscara, com espaço ou com zero à esquerda
 *  perdido é a origem mais comum de duplicata — normalizar aqui evita o resto. */
export function limparCnpj(bruto: unknown): string | null {
  const so = String(bruto ?? '').replace(/\D/g, '');
  return so.length === 14 ? so : null;
}

/** Primeiro valor presente entre vários nomes possíveis de campo. */
function pegar(obj: Record<string, unknown>, ...nomes: string[]): string | null {
  for (const n of nomes) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/**
 * Traduz UMA empresa do formato do cnpj.chat para o nosso.
 *
 * ⚠️ DADO DE SÓCIO É DESCARTADO DE PROPÓSITO. A resposta da Receita costuma vir
 * com quadro societário: nome e CPF de pessoas físicas. Não precisamos disso
 * para prospectar um estabelecimento, e guardar dado pessoal sem necessidade é
 * o oposto do que a LGPD pede. O que não entra aqui não vaza depois.
 */
export function traduzirEmpresa(bruta: Record<string, unknown> | null | undefined): ProspectNormalizado | null {
  if (!bruta || typeof bruta !== 'object') return null;
  const cnpj = limparCnpj(pegar(bruta, 'cnpj', 'cnpj_completo', 'taxId', 'tax_id'));
  if (!cnpj) return null;   // sem CNPJ não há como evitar duplicata: não entra.

  const endereco = (bruta.endereco ?? bruta.address ?? bruta.estabelecimento ?? {}) as Record<string, unknown>;
  const cnae = (bruta.cnae_fiscal ?? bruta.atividade_principal ?? bruta.mainActivity ?? {}) as Record<string, unknown>;
  const cnaeObj = typeof cnae === 'object' ? cnae : {};

  return {
    cnpj,
    razao_social: pegar(bruta, 'razao_social', 'razaoSocial', 'company_name', 'nome'),
    nome_fantasia: pegar(bruta, 'nome_fantasia', 'nomeFantasia', 'trade_name', 'fantasia'),
    cnae_principal: pegar(bruta, 'cnae_principal', 'cnae_fiscal_codigo')
      ?? pegar(cnaeObj, 'codigo', 'code', 'id'),
    cnae_descricao: pegar(bruta, 'cnae_descricao', 'cnae_fiscal_descricao')
      ?? pegar(cnaeObj, 'descricao', 'text', 'description'),
    situacao_cadastral: pegar(bruta, 'situacao_cadastral', 'situacao', 'status'),
    municipio: pegar(bruta, 'municipio', 'cidade') ?? pegar(endereco, 'municipio', 'cidade', 'city'),
    uf: (pegar(bruta, 'uf', 'estado') ?? pegar(endereco, 'uf', 'estado', 'state'))?.toUpperCase() ?? null,
    cep: (pegar(bruta, 'cep') ?? pegar(endereco, 'cep', 'zip'))?.replace(/\D/g, '') ?? null,
    logradouro: pegar(bruta, 'logradouro') ?? pegar(endereco, 'logradouro', 'street'),
    numero: pegar(bruta, 'numero') ?? pegar(endereco, 'numero', 'number'),
    bairro: pegar(bruta, 'bairro') ?? pegar(endereco, 'bairro', 'district'),
    telefone: pegar(bruta, 'telefone', 'ddd_telefone_1', 'phone'),
    email: pegar(bruta, 'email', 'correio_eletronico'),
    fonte: 'cnpj_chat',
    // Sócios, CPF e quadro societário ficam de fora. Ver o comentário acima.
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * MODO SIMULADO — o padrão.
 *
 * Devolve respostas com a FORMA de uma resposta real, para exercitar o caminho
 * inteiro (tradução, deduplicação, gravação) sem gastar uma operação do trial.
 *
 * Os CNPJs são os da própria casa — Saporino e COFICO. Nenhum CNPJ de terceiro
 * é inventado: um número fabricado pode colidir com uma empresa real e virar
 * prospect fantasma de alguém que existe.
 * ─────────────────────────────────────────────────────────────────────────── */
export const EXEMPLOS_SIMULADOS: Record<string, unknown>[] = [
  {
    cnpj: '61.109.694/0001-94',
    razao_social: 'CAFE SAPORINO LTDA',
    nome_fantasia: 'CAFE SAPORINO',
    situacao_cadastral: '02',
    cnae_fiscal: { codigo: '1081302', descricao: 'Torrefação e moagem de café' },
    endereco: { municipio: 'Barueri', uf: 'SP', cep: '06454-000', logradouro: 'Alameda Rio Negro', numero: '503' },
    // De propósito: a resposta real virá com sócios, e o adaptador tem de
    // DESCARTAR isto. Se um dia vazar para `ProspectNormalizado`, o teste quebra.
    qsa: [{ nome_socio: 'FULANO DE TAL', cpf_cnpj_socio: '***123456**' }],
  },
  {
    cnpj: '66006929000136',
    razaoSocial: 'V. MEDEIROS DE SANTI LTDA',
    nomeFantasia: 'COFICO BRASIL',
    status: '02',
    atividade_principal: { code: '4639701', text: 'Comércio atacadista de produtos alimentícios' },
    address: { city: 'São Paulo', state: 'sp', zip: '00000000' },
  },
];

export interface ResultadoBusca {
  prospects: ProspectNormalizado[];
  simulado: boolean;
  /** Quantas operações do trial isto consumiu. Zero no modo simulado. */
  operacoes: number;
  aviso?: string;
}

/**
 * Busca uma empresa por CNPJ.
 *
 * Sem `token`, responde simulado e gasta ZERO operações. É o padrão, e é
 * deliberado: um erro de configuração não pode torrar o trial de 2.000
 * operações sem ninguém pedir.
 */
export async function buscarEmpresa(
  cnpjBruto: string,
  opts: { token?: string | null; buscar?: typeof fetch } = {},
): Promise<ResultadoBusca> {
  const cnpj = limparCnpj(cnpjBruto);
  if (!cnpj) return { prospects: [], simulado: true, operacoes: 0, aviso: 'CNPJ inválido' };

  if (!opts.token) {
    const achado = EXEMPLOS_SIMULADOS.find(e => limparCnpj(e.cnpj) === cnpj);
    return {
      prospects: achado ? [traduzirEmpresa(achado)!] : [],
      simulado: true,
      operacoes: 0,
      aviso: 'Modo simulado: nenhuma operação do trial foi consumida.',
    };
  }

  const buscar = opts.buscar ?? fetch;
  const resp = await buscar(`${BASE_REST}/companies/${cnpj}`, {
    headers: { Authorization: `Bearer ${opts.token}`, Accept: 'application/json' },
  });
  if (!resp.ok) {
    return {
      prospects: [], simulado: false, operacoes: 1,
      aviso: `cnpj.chat respondeu ${resp.status}`,
    };
  }
  const corpo = await resp.json();
  // A resposta pode vir solta ou embrulhada — aceita as duas formas.
  const bruta = (corpo?.data ?? corpo?.company ?? corpo) as Record<string, unknown>;
  const p = traduzirEmpresa(bruta);
  return {
    prospects: p ? [p] : [],
    simulado: false,
    operacoes: 1,
    aviso: p ? undefined : 'Resposta recebida mas sem CNPJ reconhecível — o contrato mudou?',
  };
}
