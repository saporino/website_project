// Coffee LiVRE — escada de quantidade.
//
// Uma função pura, e é de propósito: o mesmo cálculo alimenta a página do
// produto, o carrinho e, mais adiante, o pedido. Se cada tela calculasse
// por conta, o comprador veria um total na vitrine e outro no checkout —
// que é a forma mais rápida de perder a venda e a confiança.
//
// TUDO EM CENTAVOS, inteiro, sem ponto flutuante. Dinheiro em float é onde
// um centavo some por linha e ninguém acha depois.
//
// O SISTEMA NÃO DECIDE PREÇO. O vendedor configura a faixa; aqui só se
// calcula e se avisa quando a faixa fura o piso que ele mesmo definiu.

export type TipoDeFaixa = 'percentual' | 'reais';

export interface Faixa {
  min_qty: number;
  tipo: TipoDeFaixa;
  /** percentual: pontos-base (200 = 2%). reais: centavos POR UNIDADE. */
  valor: number;
}

export interface Degrau {
  quantidade: number;
  /** Preço de UMA unidade dentro desta faixa. */
  unitario_cents: number;
  total_cents: number;
  /** Quanto o comprador deixa de pagar em relação ao preço cheio. */
  economia_cents: number;
  /** Economia em pontos-base do total cheio (250 = 2,5%). */
  economia_bps: number;
  /** Melhor custo por unidade da escada inteira. */
  melhorCustoPorUnidade: boolean;
  /** O unitário desta faixa caiu abaixo do piso do vendedor. */
  abaixoDoPiso: boolean;
}

/**
 * Preço de uma unidade quando se leva `quantidade`.
 *
 * Vale a MAIOR faixa que a quantidade alcança: quem leva 5 com faixas de
 * 2, 3 e 4 paga o preço da faixa de 4. Faixa nunca sobe preço, então o
 * resultado é limitado ao preço cheio por baixo e a zero por cima.
 */
export function unitarioNaQuantidade(precoCents: number, faixas: Faixa[], quantidade: number): number {
  const aplicavel = faixas
    .filter(f => f.min_qty <= quantidade)
    .sort((a, b) => b.min_qty - a.min_qty)[0];
  if (!aplicavel) return precoCents;

  const bruto = aplicavel.tipo === 'percentual'
    // round() e não trunc(): truncar sempre favorece a casa, e num
    // desconto isso significa entregar menos do que foi anunciado.
    ? precoCents - Math.round((precoCents * aplicavel.valor) / 10000)
    : precoCents - aplicavel.valor;

  return Math.max(0, Math.min(precoCents, bruto));
}

/**
 * A escada inteira, pronta para a tela.
 *
 * O primeiro degrau é sempre 1 unidade pelo preço cheio: o comprador
 * precisa ver de onde parte para entender o que economiza.
 */
export function montarEscada(
  precoCents: number | null,
  faixas: Faixa[],
  opcoes: { pisoCents?: number | null; ate?: number } = {},
): Degrau[] {
  if (!precoCents || precoCents <= 0) return [];

  const maiorFaixa = faixas.reduce((m, f) => Math.max(m, f.min_qty), 1);
  const ate = opcoes.ate ?? Math.max(4, maiorFaixa);
  const piso = opcoes.pisoCents ?? null;

  const degraus: Degrau[] = [];
  for (let q = 1; q <= ate; q++) {
    const unitario = unitarioNaQuantidade(precoCents, faixas, q);
    const total = unitario * q;
    const cheio = precoCents * q;
    degraus.push({
      quantidade: q,
      unitario_cents: unitario,
      total_cents: total,
      economia_cents: cheio - total,
      economia_bps: cheio > 0 ? Math.round(((cheio - total) / cheio) * 10000) : 0,
      melhorCustoPorUnidade: false,
      abaixoDoPiso: piso != null && unitario < piso,
    });
  }

  // "Melhor custo por pacote" marca o menor unitário. Havendo empate,
  // marca a MENOR quantidade que já alcança esse preço — mandar a pessoa
  // levar mais pelo mesmo custo por pacote seria empurrar volume.
  const menorUnitario = Math.min(...degraus.map(d => d.unitario_cents));
  const primeiro = degraus.find(d => d.unitario_cents === menorUnitario);
  if (primeiro && primeiro.quantidade > 1) primeiro.melhorCustoPorUnidade = true;

  return degraus;
}

/** Alguma faixa fura o piso do vendedor? Vira alerta na tela dele. */
export function faixasAbaixoDoPiso(
  precoCents: number | null,
  faixas: Faixa[],
  pisoCents: number | null | undefined,
): number[] {
  if (!precoCents || pisoCents == null) return [];
  return faixas
    .filter(f => unitarioNaQuantidade(precoCents, faixas, f.min_qty) < pisoCents)
    .map(f => f.min_qty)
    .sort((a, b) => a - b);
}
