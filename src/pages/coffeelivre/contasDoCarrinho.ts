// Coffee LiVRE — contas do carrinho multiloja (funções puras).
//
// Um carrinho, várias lojas. A tela mostra um bloco por loja porque é assim
// que o pedido vai nascer: um subpedido por vendedor. O unitário de cada linha
// sai de `unitarioNaQuantidade`, a MESMA função da página do produto e do banco
// (lv_unitario_na_quantidade) — nenhuma tela calcula escada do seu jeito.

import { unitarioNaQuantidade, type Faixa } from './escada';

export interface LinhaDoCarrinho {
  varianteId: string;
  lojaSlug: string;
  lojaNome: string;
  lojaCor: string | null;
  quantidade: number;
  disponivel: number;
  cheio_cents: number;
  /** Nulo quando a escada ainda não foi carregada: vale o unitário congelado. */
  faixas: Faixa[] | null;
  unitario_cents: number;
}

/** Unitário da linha para a quantidade atual. */
export function unitarioDaLinha(l: Pick<LinhaDoCarrinho, 'cheio_cents' | 'faixas' | 'quantidade' | 'unitario_cents'>): number {
  return l.faixas ? unitarioNaQuantidade(l.cheio_cents, l.faixas, l.quantidade) : l.unitario_cents;
}

export interface GrupoDaLoja<T extends LinhaDoCarrinho> {
  lojaSlug: string;
  lojaNome: string;
  lojaCor: string | null;
  itens: T[];
  unidades: number;
  cheio_cents: number;
  total_cents: number;
  economia_cents: number;
}

export function agruparPorLoja<T extends LinhaDoCarrinho>(itens: T[]): GrupoDaLoja<T>[] {
  const grupos = new Map<string, GrupoDaLoja<T>>();
  for (const i of itens) {
    const g = grupos.get(i.lojaSlug) ?? {
      lojaSlug: i.lojaSlug, lojaNome: i.lojaNome, lojaCor: i.lojaCor,
      itens: [], unidades: 0, cheio_cents: 0, total_cents: 0, economia_cents: 0,
    };
    const unitario = unitarioDaLinha(i);
    g.itens.push(i);
    g.unidades += i.quantidade;
    g.cheio_cents += i.cheio_cents * i.quantidade;
    g.total_cents += unitario * i.quantidade;
    g.economia_cents = g.cheio_cents - g.total_cents;
    grupos.set(i.lojaSlug, g);
  }
  // A ordem de entrada da primeira linha de cada loja: o bloco não pula de lugar.
  return [...grupos.values()];
}

export function totaisDoCarrinho<T extends LinhaDoCarrinho>(itens: T[]) {
  const grupos = agruparPorLoja(itens);
  return {
    lojas: grupos.length,
    unidades: grupos.reduce((s, g) => s + g.unidades, 0),
    cheio_cents: grupos.reduce((s, g) => s + g.cheio_cents, 0),
    total_cents: grupos.reduce((s, g) => s + g.total_cents, 0),
    economia_cents: grupos.reduce((s, g) => s + g.economia_cents, 0),
  };
}
