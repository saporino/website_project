// Consulta pública de CNPJ na BrasilAPI (gratuita, sem chave, com CORS).
// Retorna os dados cadastrais da Receita Federal. ATENÇÃO: a base FEDERAL do CNPJ
// NÃO inclui Inscrição Estadual (isso é estadual/SINTEGRA) — esse campo continua manual.
export interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  cidade: string;
  uf: string;
  cep: string;
  endereco: string;       // logradouro, número, bairro
  email: string;
  telefone: string;       // só dígitos
  situacao: string;       // ex.: "ATIVA"
  socio: string;          // 1º sócio/administrador (quando público)
}

export async function lookupCnpj(cnpjRaw: string): Promise<CnpjData> {
  const cnpj = (cnpjRaw || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw new Error('CNPJ inválido — precisa ter 14 dígitos.');

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('CNPJ não encontrado na Receita.');
    throw new Error('Falha ao consultar a Receita. Tente de novo.');
  }
  const d: any = await res.json();

  const endereco = [d.logradouro, d.numero, d.bairro]
    .map((x: any) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join(', ');

  return {
    razao_social: d.razao_social || '',
    nome_fantasia: d.nome_fantasia || '',
    cidade: d.municipio || '',
    uf: d.uf || '',
    cep: d.cep ? String(d.cep).replace(/\D/g, '') : '',
    endereco,
    email: d.email || '',
    telefone: d.ddd_telefone_1 ? String(d.ddd_telefone_1).replace(/\D/g, '') : '',
    situacao: d.descricao_situacao_cadastral || '',
    socio: Array.isArray(d.qsa) && d.qsa[0]?.nome_socio ? d.qsa[0].nome_socio : '',
  };
}
