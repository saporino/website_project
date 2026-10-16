// Ficha PJ — o que cada seção guarda, e como ela fala com o banco.
//
// Separado do componente porque a tela já é grande, e porque estas regras
// (quais tipos de contato existem, o que é obrigatório) valem também para o
// painel da administração.

export interface Contato {
  id?: string;
  tipo: TipoContato;
  nome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
}

export type TipoContato =
  | 'comprador' | 'comprador_substituto'
  | 'financeiro' | 'financeiro_alternativo'
  | 'fiscal' | 'contabilidade'
  | 'responsavel_legal' | 'proprietario' | 'socio_administrador'
  | 'gerente_comercial' | 'gerente_loja'
  | 'recebimento';

/** Como cada papel aparece na tela, e o que ele significa para quem preenche. */
export const PAPEIS: { tipo: TipoContato; titulo: string; ajuda: string }[] = [
  { tipo: 'comprador',            titulo: 'Comprador',              ajuda: 'Quem faz o pedido do café.' },
  { tipo: 'comprador_substituto', titulo: 'Comprador substituto',   ajuda: 'Quem compra quando o titular não está.' },
  { tipo: 'financeiro',           titulo: 'Financeiro',             ajuda: 'Quem recebe boleto e cobrança.' },
  { tipo: 'financeiro_alternativo', titulo: 'Financeiro — alternativo', ajuda: 'Segundo contato de contas a pagar.' },
  { tipo: 'fiscal',               titulo: 'Fiscal',                 ajuda: 'Quem recebe a nota fiscal (XML e DANFE).' },
  { tipo: 'contabilidade',        titulo: 'Contabilidade',          ajuda: 'Escritório contábil, quando for terceirizado.' },
  { tipo: 'responsavel_legal',    titulo: 'Responsável legal',      ajuda: 'Quem assina pela empresa.' },
  { tipo: 'gerente_comercial',    titulo: 'Gerente',                ajuda: 'Gerente da loja ou comercial.' },
  { tipo: 'recebimento',          titulo: 'Recebimento',            ajuda: 'Quem recebe a mercadoria na entrega.' },
];

/** Os quatro que a COFICO precisa para operar. O resto ajuda, mas não trava. */
export const PAPEIS_ESSENCIAIS: TipoContato[] = ['comprador', 'financeiro', 'fiscal', 'responsavel_legal'];

export interface Completude {
  empresa: boolean; fiscal_ie: boolean; contato: boolean; endereco: boolean;
  comprador: boolean; financeiro: boolean; fiscal: boolean;
  responsavel: boolean; marcas: boolean;
}

export const ROTULOS_COMPLETUDE: { chave: keyof Completude; texto: string }[] = [
  { chave: 'empresa',    texto: 'Dados da empresa' },
  { chave: 'endereco',   texto: 'Endereço' },
  { chave: 'contato',    texto: 'Telefone ou e-mail da empresa' },
  { chave: 'fiscal_ie',  texto: 'Inscrição estadual' },
  { chave: 'comprador',  texto: 'Comprador' },
  { chave: 'financeiro', texto: 'Financeiro' },
  { chave: 'fiscal',     texto: 'Fiscal' },
  { chave: 'responsavel',texto: 'Responsável legal' },
  { chave: 'marcas',     texto: 'Marcas que compra' },
];

export function quantoFalta(c: Completude | null): { feitos: number; total: number; faltando: string[] } {
  if (!c) return { feitos: 0, total: ROTULOS_COMPLETUDE.length, faltando: [] };
  const faltando = ROTULOS_COMPLETUDE.filter(r => !c[r.chave]).map(r => r.texto);
  return { feitos: ROTULOS_COMPLETUDE.length - faltando.length, total: ROTULOS_COMPLETUDE.length, faltando };
}

/** Máscaras: a pessoa vê o número no formato que reconhece, o banco guarda dígitos. */
export const soDigitos = (v: string) => (v || '').replace(/\D/g, '');

export function formatarTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarCEP(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatarCNPJ(v: string | null): string {
  const d = soDigitos(v || '');
  if (d.length !== 14) return v ?? '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** E-mail só o suficiente para pegar erro de digitação — quem valida é o envio. */
export const emailParece = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
