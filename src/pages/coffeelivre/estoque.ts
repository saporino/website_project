// Coffee LiVRE — o que o estoque deixa comprar.
//
// Funções puras, pelo mesmo motivo da escada: a página do produto, o
// cartão da vitrine e o carrinho fazem a MESMA pergunta — "cabem mais
// quantas?" — e não podem responder diferente.
//
// O estoque é da VARIANTE. 250 g e 500 g são prateleiras diferentes, e
// "no carrinho" conta só as unidades daquela variante.
//
// A regra não apaga nada da configuração comercial: se só restam 2, as
// faixas de 3 e 4 ficam indisponíveis NA TELA, continuam gravadas, e voltam
// sozinhas quando o estoque subir.

export type SituacaoDoEstoque = 'esgotado' | 'ultimas' | 'disponivel';

/** A partir de quantas unidades a tela avisa "últimas unidades". */
export const ULTIMAS_UNIDADES = 5;

const inteiro = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

export function situacaoDoEstoque(disponivel: number): SituacaoDoEstoque {
  const d = inteiro(disponivel);
  if (d === 0) return 'esgotado';
  if (d <= ULTIMAS_UNIDADES) return 'ultimas';
  return 'disponivel';
}

/** Quantas unidades ainda cabem, descontando o que já está no carrinho. */
export function aindaCabe(disponivel: number, noCarrinho: number): number {
  return Math.max(0, inteiro(disponivel) - inteiro(noCarrinho));
}

/** Uma faixa da escada pode ser escolhida agora? */
export function degrauCabe(quantidade: number, disponivel: number, noCarrinho: number): boolean {
  return quantidade >= 1 && quantidade <= aindaCabe(disponivel, noCarrinho);
}

/**
 * Corta um pedido ao que o estoque permite. `limitado` diz se cortou, para
 * a tela avisar em vez de mudar o número em silêncio.
 */
export function limitarAoEstoque(
  pedida: number,
  disponivel: number,
  noCarrinho: number,
): { quantidade: number; limitado: boolean } {
  const quer = inteiro(pedida);
  const cabe = aindaCabe(disponivel, noCarrinho);
  const quantidade = Math.min(quer, cabe);
  return { quantidade, limitado: quantidade < quer };
}
