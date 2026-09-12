// A escada de quantidade é onde o comprador decide levar mais.
//
// Um centavo errado aqui aparece como total diferente entre a página e o
// carrinho, e é por isso que o cálculo é função pura e tem teste.
import { describe, it, expect } from 'vitest';
import { unitarioNaQuantidade, montarEscada, faixasAbaixoDoPiso, type Faixa } from './escada';

// R$ 23,90 — o exemplo que o Vlademir usou ao definir a regra.
const PRECO = 2390;

const EM_REAIS: Faixa[] = [
  { min_qty: 2, tipo: 'reais', valor: 100 },
  { min_qty: 3, tipo: 'reais', valor: 150 },
  { min_qty: 4, tipo: 'reais', valor: 200 },
];

const EM_PERCENTUAL: Faixa[] = [
  { min_qty: 2, tipo: 'percentual', valor: 200 },
  { min_qty: 3, tipo: 'percentual', valor: 400 },
  { min_qty: 4, tipo: 'percentual', valor: 600 },
];

describe('desconto em reais por unidade', () => {
  it('uma unidade paga o preço cheio', () => {
    expect(unitarioNaQuantidade(PRECO, EM_REAIS, 1)).toBe(2390);
  });

  it('cada faixa tira o valor combinado de CADA pacote', () => {
    expect(unitarioNaQuantidade(PRECO, EM_REAIS, 2)).toBe(2290);
    expect(unitarioNaQuantidade(PRECO, EM_REAIS, 3)).toBe(2240);
    expect(unitarioNaQuantidade(PRECO, EM_REAIS, 4)).toBe(2190);
  });

  it('acima da última faixa, vale a última', () => {
    // Quem leva 7 paga o preço da faixa de 4. Não existe faixa de 7, e
    // inventar uma seria decidir preço no lugar do vendedor.
    expect(unitarioNaQuantidade(PRECO, EM_REAIS, 7)).toBe(2190);
  });

  it('o total é o unitário da faixa vezes a quantidade', () => {
    const e = montarEscada(PRECO, EM_REAIS);
    expect(e[3].quantidade).toBe(4);
    expect(e[3].total_cents).toBe(8760);
    expect(e[3].economia_cents).toBe(2390 * 4 - 8760);
    expect(e[3].economia_cents).toBe(800);
  });
});

describe('desconto percentual', () => {
  it('2% de R$ 23,90 arredonda para cima no favor do comprador', () => {
    // 2390 * 2% = 47,8 centavos. Truncar daria 48 de desconto virando 47;
    // arredondar entrega os 48 anunciados.
    expect(unitarioNaQuantidade(PRECO, EM_PERCENTUAL, 2)).toBe(2342);
  });

  it('as três faixas descem como configurado', () => {
    expect(unitarioNaQuantidade(PRECO, EM_PERCENTUAL, 3)).toBe(2294);
    expect(unitarioNaQuantidade(PRECO, EM_PERCENTUAL, 4)).toBe(2247);
  });

  it('a economia em pontos-base bate com o percentual da faixa', () => {
    const e = montarEscada(PRECO, EM_PERCENTUAL);
    expect(e[3].economia_bps).toBeGreaterThanOrEqual(590);
    expect(e[3].economia_bps).toBeLessThanOrEqual(610);
  });
});

describe('a escada montada', () => {
  it('sempre começa em 1 unidade pelo preço cheio', () => {
    const e = montarEscada(PRECO, EM_REAIS);
    expect(e[0]).toMatchObject({ quantidade: 1, unitario_cents: 2390, total_cents: 2390, economia_cents: 0 });
  });

  it('marca o melhor custo por pacote na maior faixa', () => {
    const e = montarEscada(PRECO, EM_REAIS);
    expect(e.filter(d => d.melhorCustoPorUnidade).map(d => d.quantidade)).toEqual([4]);
  });

  it('nunca marca "melhor custo" na unidade avulsa', () => {
    // Produto sem escada não pode sugerir que levar 1 é vantagem.
    const e = montarEscada(PRECO, []);
    expect(e.some(d => d.melhorCustoPorUnidade)).toBe(false);
  });

  it('no empate, marca a MENOR quantidade que alcança o preço', () => {
    // Empurrar volume pelo mesmo custo por pacote não ajuda ninguém.
    const empatadas: Faixa[] = [
      { min_qty: 2, tipo: 'reais', valor: 100 },
      { min_qty: 3, tipo: 'reais', valor: 100 },
    ];
    const e = montarEscada(PRECO, empatadas);
    expect(e.filter(d => d.melhorCustoPorUnidade).map(d => d.quantidade)).toEqual([2]);
  });

  it('vai até a maior faixa quando ela passa de quatro', () => {
    const ate6: Faixa[] = [...EM_REAIS, { min_qty: 6, tipo: 'reais', valor: 300 }];
    expect(montarEscada(PRECO, ate6).length).toBe(6);
  });

  it('produto sem preço não gera escada', () => {
    expect(montarEscada(null, EM_REAIS)).toEqual([]);
    expect(montarEscada(0, EM_REAIS)).toEqual([]);
  });
});

describe('limites de sanidade', () => {
  it('desconto maior que o preço não gera preço negativo', () => {
    const absurda: Faixa[] = [{ min_qty: 2, tipo: 'reais', valor: 999999 }];
    expect(unitarioNaQuantidade(PRECO, absurda, 2)).toBe(0);
  });

  it('faixa nunca aumenta o preço', () => {
    const invertida: Faixa[] = [{ min_qty: 2, tipo: 'reais', valor: -500 }];
    expect(unitarioNaQuantidade(PRECO, invertida, 2)).toBe(PRECO);
  });

  it('tudo em centavos inteiros, sem fração', () => {
    const e = montarEscada(1999, EM_PERCENTUAL);
    for (const d of e) {
      expect(Number.isInteger(d.unitario_cents)).toBe(true);
      expect(Number.isInteger(d.total_cents)).toBe(true);
      expect(Number.isInteger(d.economia_cents)).toBe(true);
    }
  });
});

describe('piso do vendedor', () => {
  it('acusa a faixa que fura o piso', () => {
    // Piso R$ 22,50: a faixa de 3 (R$ 22,40) e a de 4 (R$ 21,90) furam.
    expect(faixasAbaixoDoPiso(PRECO, EM_REAIS, 2250)).toEqual([3, 4]);
  });

  it('sem piso informado, não acusa nada', () => {
    expect(faixasAbaixoDoPiso(PRECO, EM_REAIS, null)).toEqual([]);
  });

  it('piso respeitado não acusa', () => {
    expect(faixasAbaixoDoPiso(PRECO, EM_REAIS, 2000)).toEqual([]);
  });

  it('o degrau que fura o piso vem marcado para a tela do vendedor', () => {
    const e = montarEscada(PRECO, EM_REAIS, { pisoCents: 2250 });
    expect(e.filter(d => d.abaixoDoPiso).map(d => d.quantidade)).toEqual([3, 4]);
  });

  it('o piso ALERTA, nao bloqueia: o preco sai igual', () => {
    // Quem decide preço é o vendedor. O sistema avisa e segue.
    const com = montarEscada(PRECO, EM_REAIS, { pisoCents: 2250 });
    const sem = montarEscada(PRECO, EM_REAIS);
    expect(com.map(d => d.total_cents)).toEqual(sem.map(d => d.total_cents));
  });
});
