// Coffee LiVRE — como um registro do banco vira imagem na vitrine.
//
// O visual aprovado desenha o produto como um pacote SVG colorido. O
// banco não guarda desenho: guarda loja, categoria e título. Este arquivo
// é a ponte, e existe para que nenhum componente invente cor por conta.
//
// Regra: o pacote usa a cor da LOJA. É o que faz a vitrine de cada
// torrefação ter identidade sem ninguém desenhar nada.
import type { ItemDaVitrine } from './catalogo';
import type { TipoPacote } from './svg';

/** Centavos viram "R$ 52,90". Dinheiro nunca é formatado à mão na tela. */
export function reais(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Parte inteira e centavos separados, como o preço da vitrine mostra. */
export function partesDoPreco(cents: number | null | undefined): [string, string] {
  const s = reais(cents);
  const [r, c] = s.split(',');
  return [r ?? '0', c ?? '00'];
}

export function porcentagemOff(de: number | null, por: number | null): number | null {
  if (!de || !por || de <= por) return null;
  return Math.round((1 - por / de) * 100);
}

/** Parcelamento: 6x a partir de R$ 90, 3x a partir de R$ 30. */
export function parcelas(cents: number | null): string {
  if (!cents || cents < 3000) return '';
  const n = cents >= 9000 ? 6 : 3;
  return `em ${n}x R$ ${reais(Math.round(cents / n))} sem juros`;
}

/** Um item é café? Equipamento não tem pacote nem passaporte. */
export function ehCafe(item: { categoria_raiz_slug: string | null }): boolean {
  return item.categoria_raiz_slug !== 'equipamentos';
}

const TIPO_POR_CATEGORIA: Record<string, TipoPacote> = {
  'cafe-em-graos': 'grao',
  'cafes-especiais': 'grao',
  'cafe-torrado-moido': 'moido',
  'capsulas': 'caps',
  'drip-coffee': 'drip',
};

// Tom claro do rótulo, por categoria. Fica no claro de propósito: o
// pacote precisa de contraste com a cor da loja, que costuma ser escura.
const FITA_POR_CATEGORIA: Record<string, string> = {
  'cafe-em-graos': '#E8C46A',
  'cafes-especiais': '#F3A066',
  'cafe-torrado-moido': '#F2D29B',
  'capsulas': '#D9A441',
  'drip-coffee': '#FFD9A8',
};

export interface VisualDoProduto {
  cor: string;
  fita: string;
  rotulo: string;
  tipo: TipoPacote;
}

/**
 * Pacote de um café. O rótulo curto sai da marca ou da loja — nunca do
 * título inteiro, que não caberia no desenho.
 */
export function pacoteDoProduto(item: ItemDaVitrine): VisualDoProduto {
  const categoria = item.categoria_slug ?? '';
  const bruto = (item.marca || item.loja_nome || '').toUpperCase();
  return {
    cor: item.loja_cor || '#3A2318',
    fita: FITA_POR_CATEGORIA[categoria] ?? '#EFE3DA',
    rotulo: bruto.length > 14 ? bruto.slice(0, 13).trimEnd() + '.' : bruto,
    tipo: TIPO_POR_CATEGORIA[categoria] ?? 'grao',
  };
}

/** Selo do cartão. Deriva do dado, nunca é digitado. */
export function seloDoProduto(item: ItemDaVitrine): [string, string] | null {
  if (item.nivel_passport === 'especial') return ['esp', 'ESPECIAL'];
  if (item.nivel_passport === 'origem_identificada') return ['micro', 'ORIGEM IDENTIFICADA'];
  if (item.destaque) return ['mv', 'DESTAQUE'];
  return null;
}
