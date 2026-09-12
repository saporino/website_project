import { describe, expect, it } from 'vitest';
import { aindaCabe, degrauCabe, limitarAoEstoque, situacaoDoEstoque } from './estoque';

describe('situacaoDoEstoque', () => {
  it('zero é esgotado', () => expect(situacaoDoEstoque(0)).toBe('esgotado'));
  it('negativo ou inválido é esgotado, nunca vendável', () => {
    expect(situacaoDoEstoque(-3)).toBe('esgotado');
    expect(situacaoDoEstoque(Number.NaN)).toBe('esgotado');
  });
  it('até 5 são as últimas unidades', () => {
    expect(situacaoDoEstoque(1)).toBe('ultimas');
    expect(situacaoDoEstoque(5)).toBe('ultimas');
  });
  it('acima de 5 está disponível', () => expect(situacaoDoEstoque(6)).toBe('disponivel'));
});

describe('variante com 7 unidades', () => {
  it('as quatro faixas podem ser escolhidas com o carrinho vazio', () => {
    expect([1, 2, 3, 4].map(q => degrauCabe(q, 7, 0))).toEqual([true, true, true, true]);
  });

  it('com 4 no carrinho, a faixa de 4 some e a de 3 continua', () => {
    expect(aindaCabe(7, 4)).toBe(3);
    expect(degrauCabe(3, 7, 4)).toBe(true);
    expect(degrauCabe(4, 7, 4)).toBe(false);
  });

  it('não conclui total acima de 7: pedir mais 4 com 4 no carrinho vira 3', () => {
    expect(limitarAoEstoque(4, 7, 4)).toEqual({ quantidade: 3, limitado: true });
  });

  it('com 7 no carrinho, nada mais cabe', () => {
    expect(limitarAoEstoque(1, 7, 7)).toEqual({ quantidade: 0, limitado: true });
    expect(degrauCabe(1, 7, 7)).toBe(false);
  });
});

describe('variante com 2 unidades', () => {
  it('faixas de 3 e 4 ficam indisponíveis', () => {
    expect([1, 2, 3, 4].map(q => degrauCabe(q, 2, 0))).toEqual([true, true, false, false]);
  });
  it('voltam sozinhas quando o estoque sobe', () => {
    expect([3, 4].map(q => degrauCabe(q, 9, 0))).toEqual([true, true]);
  });
});

describe('variante esgotada', () => {
  it('não deixa adicionar nem uma unidade', () => {
    expect(limitarAoEstoque(1, 0, 0)).toEqual({ quantidade: 0, limitado: true });
    expect(degrauCabe(1, 0, 0)).toBe(false);
  });
});

describe('limitarAoEstoque', () => {
  it('não limita quando cabe', () => {
    expect(limitarAoEstoque(2, 10, 3)).toEqual({ quantidade: 2, limitado: false });
  });
  it('carrinho acima do estoque (estoque caiu depois) não dá número negativo', () => {
    expect(aindaCabe(3, 5)).toBe(0);
  });
});
