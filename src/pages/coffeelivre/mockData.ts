// Coffee LiVRE — dados da home oficial.
//
// Copiados LITERALMENTE de docs/marketplace/coffee-livre-home-laranja.html.
// São fictícios e o próprio rodapé do mockup diz isso. Ficam todos aqui para
// que nenhum componente carregue dado espalhado no meio do JSX.

import type { TipoPacote } from './svg';

export interface Produto {
  t: string;
  loja: string;
  de: number | null;
  por: number;
  cor: string;
  fita: string;
  rot: string;
  tipo: TipoPacote;
  selo?: [string, string];
  pts?: number;
  nota: number;
  av: number;
  full?: boolean;
}

export const produtos: Produto[] = [
  { t: 'Café Especial Torrado em Grãos 250g — Sul de Minas, Catuaí Amarelo', loja: 'Torrefação Serra Clara', de: 69.9, por: 52.9, cor: '#2F4B3A', fita: '#E8C46A', rot: 'SUL DE MINAS', tipo: 'grao', selo: ['esp', 'ESPECIAL'], pts: 86, nota: 4.9, av: 412, full: true },
  { t: 'Café Tradicional Torrado e Moído 500g — Torra Média', loja: 'Loja Saporino', de: 32.9, por: 24.9, cor: '#8B2214', fita: '#F2D29B', rot: 'TRADICIONAL', tipo: 'moido', selo: ['mv', 'MAIS VENDIDO'], nota: 4.8, av: 1893, full: true },
  { t: 'Cápsulas Compatíveis Nespresso Intensidade 9 — 10 unidades', loja: 'Grão Norte Cafés', de: 24.9, por: 19.9, cor: '#1F2A44', fita: '#D9A441', rot: 'INTENSO 9', tipo: 'caps', nota: 4.6, av: 651 },
  { t: 'Café Orgânico Certificado em Grãos 500g — Alta Mogiana', loja: 'Sítio Bela Aurora', de: 89.9, por: 74.5, cor: '#4E6B2E', fita: '#F0E3B2', rot: 'ORGÂNICO', tipo: 'grao', selo: ['org', 'ORGÂNICO'], pts: 84, nota: 4.9, av: 208 },
  { t: 'Drip Coffee Bag Frutado — Caixa com 10 sachês', loja: 'Torra Viva', de: 45, por: 36.9, cor: '#A2472A', fita: '#FFD9A8', rot: 'FRUTADO', tipo: 'drip', nota: 4.7, av: 330, full: true },
  { t: 'Café Extra Forte Torrado e Moído 500g — Almofada', loja: 'Café Fazendinha', de: 29.9, por: 22.9, cor: '#3B2416', fita: '#E6B35C', rot: 'EXTRA FORTE', tipo: 'moido', selo: ['mv', 'MAIS VENDIDO'], nota: 4.7, av: 2210, full: true },
  { t: 'Microlote Natural Fermentado 250g — Mantiqueira de Minas', loja: 'Fazenda Alto Pinhal', de: null, por: 79.9, cor: '#DA6418', fita: '#3A2318', rot: 'MANTIQUEIRA', tipo: 'grao', selo: ['micro', 'MICROLOTE'], pts: 88, nota: 5.0, av: 97 },
  { t: 'Café Gourmet em Grãos 1kg — Cerrado Mineiro, Torra Média', loja: 'Torrefação Serra Clara', de: 129.9, por: 98.9, cor: '#6E4A2A', fita: '#F5DFB5', rot: 'CERRADO', tipo: 'grao', pts: 83, nota: 4.8, av: 540, full: true },
  { t: 'Robustas Amazônicos em Grãos 250g — Rondônia', loja: 'Grão Norte Cafés', de: 54.9, por: 46.9, cor: '#264D4A', fita: '#F2C14E', rot: 'ROBUSTA AMZ', tipo: 'grao', selo: ['esp', 'ESPECIAL'], pts: 85, nota: 4.8, av: 143 },
  { t: 'Café Descafeinado Torrado e Moído 250g', loja: 'Torra Viva', de: 34.9, por: 29.9, cor: '#35506B', fita: '#E6E0F0', rot: 'DESCAF', tipo: 'moido', nota: 4.5, av: 188 },
];

/** Ordem da vitrine "Mais vendidos em Cafés Especiais". */
export const maisIdx = [6, 0, 3, 8, 7, 4, 1, 2];

export const brl = (v: number) => v.toFixed(2).replace('.', ',');
export const pct = (d: number, p: number) => Math.round((1 - p / d) * 100);

/** Parcelamento: 6x a partir de R$ 90, 3x a partir de R$ 30, nada abaixo. */
export function parcelas(por: number): string {
  if (por < 30) return '';
  const n = por >= 90 ? 6 : 3;
  return `em ${n}x R$ ${brl(por / n)} sem juros`;
}

/**
 * Barra de estoque — só nas Ofertas do dia, e só em produto com preço "de".
 * O valor é derivado do índice, não sorteado: o mockup precisa ser estável.
 */
export function estoqueVendido(i: number): number {
  return 45 + ((i * 37) % 50);
}

export const categorias: [string, string][] = [
  ['grao', 'Café em grãos'],
  ['moido', 'Café moído'],
  ['caps', 'Cápsulas'],
  ['esp', 'Especiais 80+ pts'],
  ['org', 'Orgânicos'],
  ['verde', 'Café verde (cru)'],
  ['metodo', 'Métodos de preparo'],
  ['maquina', 'Máquinas e moedores'],
  ['drip', 'Drip bags'],
  ['gelado', 'Cold brew e gelados'],
];

/** [UF, nome, descrição, cor inicial, cor final] */
export const origens: [string, string, string, string, string][] = [
  ['Minas Gerais', 'Sul de Minas', 'Doce, achocolatado, corpo médio', '#DA6418', '#6A2A08'],
  ['Minas Gerais', 'Cerrado Mineiro', 'Denominação de origem, notas de nozes', '#8A5A2B', '#40240E'],
  ['São Paulo', 'Alta Mogiana', 'Caramelo, acidez equilibrada', '#2F6B4F', '#123526'],
  ['Minas Gerais', 'Mantiqueira', 'Frutado, floral, microlotes', '#A2472A', '#4A1A0C'],
  ['Bahia', 'Chapada Diamantina', 'Complexo, adocicado, premiado', '#C2821B', '#5A3606'],
  ['Espírito Santo', 'Montanhas do ES', 'Arábicas de altitude e conilon', '#2F5B8A', '#11273F'],
  ['Rondônia', 'Matas de Rondônia', 'Robustas Amazônicos', '#3A7A6A', '#0F332B'],
  ['Paraná', 'Norte Pioneiro', 'Cítrico, corpo leve', '#5A3524', '#2A1911'],
];

/** [nome, descrição, sigla, cor, índices dos produtos na vitrine da loja] */
export const lojas: [string, string, string, string, number[]][] = [
  ['Torrefação Serra Clara', 'Especiais · Sul de Minas', 'SC', '#2F4B3A', [0, 7]],
  ['Loja Saporino', 'Tradicionais e gourmet', 'SA', '#8B2214', [1]],
  ['Café Fazendinha', 'Tradicional · Extra Forte', 'CF', '#3B2416', [5]],
  ['Grão Norte Cafés', 'Robustas Amazônicos · cápsulas', 'GN', '#264D4A', [8, 2]],
];

/** Itens do menu "Categorias" do cabeçalho. */
export const menuCategorias = [
  'Café em grãos',
  'Café moído',
  'Cápsulas e drip bags',
  'Cafés especiais (80+ pts)',
  'Orgânicos e certificados',
  'Café verde (cru)',
  'Métodos de preparo',
  'Máquinas e moedores',
  'Para empresas (B2B)',
];

/** Colunas do rodapé. */
export const colunasDoRodape: [string, string[]][] = [
  ['Comprar', ['Cafés especiais', 'Assinaturas', 'Cupons', 'Para empresas']],
  ['Vender', ['Como vender', 'Tarifas', 'Logística', 'Central do vendedor']],
  ['Ajuda', ['Meus pedidos', 'Trocas e devoluções', 'Compra garantida', 'Fale conosco']],
  ['Institucional', ['Quem somos', 'Termos de uso', 'Privacidade', 'Trabalhe conosco']],
];

export const LOGO = '/coffeelivre/coffee-livre-logo.png';
export const ALT_LOGO = 'Coffee LiVRE — O marketplace do café';
