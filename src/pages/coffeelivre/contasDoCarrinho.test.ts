import { describe, expect, it } from 'vitest';
import { agruparPorLoja, totaisDoCarrinho, unitarioDaLinha, type LinhaDoCarrinho } from './contasDoCarrinho';

const linha = (x: Partial<LinhaDoCarrinho>): LinhaDoCarrinho => ({
  varianteId: 'v', lojaSlug: 'a', lojaNome: 'Torrefação A', lojaCor: null, quantidade: 1, disponivel: 10,
  cheio_cents: 2490, faixas: [], unitario_cents: 2490, ...x,
});

describe('carrinho multiloja', () => {
  it('escada recalculada pela mesma função da página do produto', () => {
    const faixas = [{ min_qty: 2, tipo: 'reais' as const, valor: 100 }, { min_qty: 3, tipo: 'reais' as const, valor: 150 }];
    expect(unitarioDaLinha(linha({ faixas, quantidade: 1 }))).toBe(2490);
    expect(unitarioDaLinha(linha({ faixas, quantidade: 2 }))).toBe(2390);
    expect(unitarioDaLinha(linha({ faixas, quantidade: 5 }))).toBe(2340);
  });

  it('sem escada carregada, vale o unitário congelado', () => {
    expect(unitarioDaLinha(linha({ faixas: null, unitario_cents: 2200, quantidade: 3 }))).toBe(2200);
  });

  it('agrupa por loja com subtotal, unidades e economia', () => {
    const itens = [
      linha({ varianteId: 'a1', quantidade: 2, faixas: [{ min_qty: 2, tipo: 'reais', valor: 100 }] }),
      linha({ varianteId: 'b1', lojaSlug: 'b', lojaNome: 'Torrefação B', quantidade: 3, cheio_cents: 3990, faixas: [{ min_qty: 3, tipo: 'percentual', valor: 500 }] }),
      linha({ varianteId: 'a2', quantidade: 1, cheio_cents: 1990 }),
    ];
    const g = agruparPorLoja(itens);
    expect(g.map(x => x.lojaSlug)).toEqual(['a', 'b']);
    expect(g[0]).toMatchObject({ unidades: 3, total_cents: 2 * 2390 + 1990, economia_cents: 200 });
    expect(g[1]).toMatchObject({ unidades: 3, total_cents: 3 * 3790, economia_cents: 600 });
    expect(totaisDoCarrinho(itens)).toMatchObject({ lojas: 2, unidades: 6, economia_cents: 800, total_cents: 2 * 2390 + 1990 + 3 * 3790 });
  });
});
