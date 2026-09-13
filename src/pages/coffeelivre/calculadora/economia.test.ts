import { describe, expect, it } from 'vitest';
import {
  aplicarBps, calcularPedido, comparar, ehErro, pesoDaMensalidade, precoParaLiquido, projetar,
  simularEscada, unidadeParaFreteGratis,
  type Alvo, type Cenario, type Regra, type ResultadoPedido,
} from './economia';

// Recorte das regras semeadas em 20260913120000_calculadora_de_economia.sql.
// Os valores esperados abaixo são os dos estudos de benchmark, não os
// calculados por este motor: o teste prova que o motor reproduz o estudo.
let seq = 0;
function regra(p: Partial<Regra> & Pick<Regra, 'plataforma' | 'componente'>): Regra {
  return {
    id: String(++seq), modalidade: null, cenario: null, percentual_bps: null, valor_cents: null, valor_micros: null,
    minimo_cents: null, preco_min_cents: null, preco_max_cents: null, peso_sobre: null, peso_min_g: null, peso_max_g: null,
    confiabilidade: 'verificado', natureza: 'benchmark', rotulo: null, fonte: null, fonte_url: null, verificado_em: null,
    vigencia_inicio: null, vigencia_fim: null, observacao: null, ordem: 0, ...p,
  };
}

const envioML: [number, number, number[]][] = [
  [0, 300, [685, 815, 1295]], [300, 500, [695, 825, 1385]], [500, 1000, [715, 845, 1445]],
  [1000, 1500, [735, 865, 1475]], [1500, 2000, [745, 875, 1505]], [2000, 3000, [865, 915, 1645]],
];
const faixasML: [number, number][] = [[1900, 4899], [4900, 7899], [7900, 9999]];

const fbaFaixas: [number, number][] = [[0, 2999], [3000, 4999], [5000, 7899], [7900, 9999], [10000, 11999]];
const fba: [number, number, number[]][] = [
  [500, 750, [1205, 1405, 1605, 1845, 1855]], [750, 1000, [1245, 1445, 1645, 1905, 1925]],
  [1000, 1500, [1400, 1635, 1875, 2110, 2290]], [1500, 2000, [1305, 1505, 1705, 1995, 2135]],
  [2000, 3000, [1405, 1605, 1805, 2005, 2235]],
];

const REGRAS: Regra[] = [
  regra({ plataforma: 'mercado_livre', modalidade: 'classico', componente: 'comissao', percentual_bps: 1400 }),
  regra({ plataforma: 'mercado_livre', modalidade: 'premium', componente: 'comissao', percentual_bps: 1900 }),
  ...envioML.flatMap(([gmin, gmax, v]) => faixasML.map(([pmin, pmax], i) => regra({
    plataforma: 'mercado_livre', componente: 'logistica_pedido', valor_cents: v[i],
    preco_min_cents: pmin, preco_max_cents: pmax, peso_sobre: 'envio', peso_min_g: gmin, peso_max_g: gmax,
  }))),

  regra({ plataforma: 'shopee', modalidade: 'padrao', componente: 'comissao', percentual_bps: 2000, preco_min_cents: 800, preco_max_cents: 7999 }),
  regra({ plataforma: 'shopee', modalidade: 'padrao', componente: 'tarifa_fixa_pedido', valor_cents: 400, preco_min_cents: 800, preco_max_cents: 7999 }),
  regra({ plataforma: 'shopee', modalidade: 'padrao', componente: 'logistica_pedido', valor_cents: 0, confiabilidade: 'premissa' }),

  regra({ plataforma: 'amazon', modalidade: 'fba', componente: 'comissao', percentual_bps: 1000, minimo_cents: 100 }),
  ...fba.flatMap(([gmin, gmax, v]) => fbaFaixas.map(([pmin, pmax], i) => regra({
    plataforma: 'amazon', modalidade: 'fba', componente: 'logistica_pedido', valor_cents: v[i],
    preco_min_cents: pmin, preco_max_cents: pmax, peso_sobre: 'envio', peso_min_g: gmin, peso_max_g: gmax,
  }))),
  regra({ plataforma: 'amazon', modalidade: 'fba', componente: 'armazenagem_unidade', valor_micros: 85680, peso_sobre: 'unidade', peso_min_g: 450, peso_max_g: 550, confiabilidade: 'calculado' }),
  regra({ plataforma: 'amazon', modalidade: 'fba', componente: 'mensalidade', valor_cents: 1900 }),

  regra({ plataforma: 'magalu', modalidade: 'padrao', componente: 'comissao', percentual_bps: 1800, confiabilidade: 'premissa' }),
  regra({ plataforma: 'magalu', modalidade: 'padrao', componente: 'tarifa_fixa_pedido', valor_cents: 500, confiabilidade: 'fonte_secundaria' }),
  regra({ plataforma: 'magalu', modalidade: 'padrao', componente: 'logistica_pedido', valor_cents: 0, preco_max_cents: 9899 }),
  regra({ plataforma: 'magalu', modalidade: 'padrao', componente: 'logistica_pedido', valor_cents: null, preco_min_cents: 9900, confiabilidade: 'nao_publico' }),
  regra({ plataforma: 'magalu', modalidade: 'padrao', componente: 'frete_gratis_limiar', valor_cents: 9900 }),

  regra({ plataforma: 'coffeelivre', modalidade: 'zero', componente: 'comissao', percentual_bps: 1200, confiabilidade: 'em_estudo', natureza: 'hipotese_livre' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'livre', componente: 'comissao', percentual_bps: 1000, confiabilidade: 'em_estudo', natureza: 'hipotese_livre' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'zero', componente: 'tarifa_unidade', valor_cents: 95, peso_sobre: 'unidade', peso_min_g: 450, peso_max_g: 500, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'zero', componente: 'tarifa_unidade', valor_cents: 50, peso_sobre: 'unidade', peso_min_g: 200, peso_max_g: 250, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'livre', componente: 'tarifa_unidade', valor_cents: 85, peso_sobre: 'unidade', peso_min_g: 450, peso_max_g: 500, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'livre', componente: 'tarifa_unidade', valor_cents: null, peso_sobre: 'unidade', peso_min_g: 200, peso_max_g: 250, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'livre', componente: 'mensalidade', valor_cents: 6990, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', modalidade: 'zero', componente: 'mensalidade', valor_cents: 0, confiabilidade: 'em_estudo' }),
  regra({ plataforma: 'coffeelivre', componente: 'pagamento', cenario: 'cartao', percentual_bps: 498, confiabilidade: 'fonte_secundaria' }),
  regra({ plataforma: 'coffeelivre', componente: 'pagamento', cenario: 'pix', percentual_bps: 99, confiabilidade: 'fonte_secundaria' }),
  regra({ plataforma: 'coffeelivre', componente: 'frete', valor_cents: 0, confiabilidade: 'nao_se_aplica' }),
];

const ML: Alvo = { plataforma: 'mercado_livre', modalidade: 'classico' };
const ML_PREMIUM: Alvo = { plataforma: 'mercado_livre', modalidade: 'premium' };
const SHOPEE: Alvo = { plataforma: 'shopee', modalidade: 'padrao' };
const AMAZON: Alvo = { plataforma: 'amazon', modalidade: 'fba' };
const MAGALU: Alvo = { plataforma: 'magalu', modalidade: 'padrao' };
const ZERO: Alvo = { plataforma: 'coffeelivre', modalidade: 'zero' };
const LIVRE: Alvo = { plataforma: 'coffeelivre', modalidade: 'livre' };

// O cenário-base pedido para o smoke test.
const BASE: Cenario = {
  precoCents: 2390, gramaturaG: 500, quantidade: 1, volumeMensal: 1000, pisoCents: 1900, pagamento: 'cartao',
};

function pedido(alvo: Alvo, c: Partial<Cenario> = {}): ResultadoPedido {
  const r = calcularPedido(REGRAS, alvo, { ...BASE, ...c });
  if (ehErro(r)) throw new Error(r.erro);
  return r;
}

describe('arredondamento monetário', () => {
  it('14% de R$ 23,90 = R$ 3,35 (meio para cima)', () => expect(aplicarBps(2390, 1400)).toBe(335));
  it('não usa ponto flutuante na porcentagem', () => expect(aplicarBps(4780, 1400)).toBe(669));
});

describe('Mercado Livre reproduz a simulação oficial de 12/09/2026', () => {
  // Carga em pontos-base: o estudo arredonda para 43,9% / 29,4% / 26,2% / 31,2%.
  it.each([[1, 1340, 4393], [2, 3376, 2937], [3, 5291, 2621], [4, 6577, 3120]])(
    'Clássico, %i pacote(s): líquido e carga efetiva', (q, liquido, carga) => {
      const r = pedido(ML, { quantidade: q, volumeMensal: 1000 });
      expect(r.liquidoCents).toBe(liquido);
      expect(r.cargaBps).toBe(carga);
    });

  it.each([[1, 1221], [2, 3137], [3, 4933], [4, 6099]])('Premium, %i pacote(s)', (q, liquido) => {
    expect(pedido(ML_PREMIUM, { quantidade: q }).liquidoCents).toBe(liquido);
  });

  it('com 5 pacotes (R$ 119,50) a tabela estudada não cobre: não disponível, nunca zero', () => {
    const r = pedido(ML, { quantidade: 5 });
    const envio = r.linhas.find(l => l.componente === 'logistica_pedido')!;
    expect(envio.valorCents).toBeNull();
    expect(envio.confiabilidade).toBe('fora_da_tabela');
    expect(r.completo).toBe(false);
    expect(r.cargaBps).toBeNull();
  });
});

describe('Amazon reproduz o quadro-resumo do estudo', () => {
  // O estudo rateou o plano em 100 pedidos/mês.
  it.each([[1, 918], [2, 2631], [3, 4703], [4, 6546]])('FBA, %i pacote(s)', (q, liquido) => {
    expect(pedido(AMAZON, { quantidade: q, volumeMensal: 100 * q }).liquidoCents).toBe(liquido);
  });

  it('comissão mínima de R$ 1,00', () => {
    const r = pedido(AMAZON, { precoCents: 500 });
    expect(r.linhas.find(l => l.componente === 'comissao')!.valorCents).toBe(100);
  });

  it('armazenagem de gramatura não estudada fica desconhecida', () => {
    const r = pedido(AMAZON, { gramaturaG: 1000 });
    expect(r.linhas.find(l => l.componente === 'armazenagem_unidade')!.valorCents).toBeNull();
    expect(r.completo).toBe(false);
  });
});

describe('Magalu reproduz a simulação do estudo', () => {
  it.each([[1, 1460], [2, 3420], [3, 5379], [4, 7339]])('%i pacote(s)', (q, liquido) => {
    expect(pedido(MAGALU, { quantidade: q }).liquidoCents).toBe(liquido);
  });

  it('a partir de R$ 99 a coparticipação não é pública: conta incompleta', () => {
    const r = pedido(MAGALU, { quantidade: 5 });
    expect(r.linhas.find(l => l.componente === 'logistica_pedido')!.valorCents).toBeNull();
    expect(r.completo).toBe(false);
  });

  it('avisa quando mais uma unidade alcança o frete grátis do comprador', () => {
    expect(unidadeParaFreteGratis(REGRAS, MAGALU, 2390, 4)).toBe(9900);
    expect(unidadeParaFreteGratis(REGRAS, MAGALU, 2390, 3)).toBeNull();
    expect(unidadeParaFreteGratis(REGRAS, ML, 2390, 4)).toBeNull();
  });
});

describe('Shopee', () => {
  it('20% + R$ 4,00 em R$ 23,90', () => expect(pedido(SHOPEE).liquidoCents).toBe(1512));
});

describe('Coffee LiVRE (hipóteses em estudo)', () => {
  it('Zero, cartão: R$ 23,90 − 2,87 − 0,95 − 1,19 = R$ 18,89', () => {
    expect(pedido(ZERO).liquidoCents).toBe(1889);
  });
  it('Zero, Pix: R$ 19,84', () => expect(pedido(ZERO, { pagamento: 'pix' }).liquidoCents).toBe(1984));
  it('tarifa por pacote multiplica pela quantidade', () => {
    expect(pedido(ZERO, { quantidade: 3 }).linhas.find(l => l.componente === 'tarifa_unidade')!.valorCents).toBe(285);
  });
  it('gramatura com valor ainda em estudo não vira zero', () => {
    const r = pedido(LIVRE, { gramaturaG: 250 });
    expect(r.linhas.find(l => l.componente === 'tarifa_unidade')!.valorCents).toBeNull();
    expect(r.completo).toBe(false);
  });
  it('gramatura fora das estudadas fica fora da tabela', () => {
    expect(pedido(ZERO, { gramaturaG: 340 }).linhas.find(l => l.componente === 'tarifa_unidade')!.confiabilidade).toBe('fora_da_tabela');
  });
});

describe('piso do vendedor', () => {
  it('abaixo, com a diferença por pacote', () => {
    const r = pedido(MAGALU);
    expect(r.piso).toEqual({ situacao: 'abaixo', diferencaUnidadeCents: -440 });
  });
  it('próximo: acima, mas a menos de 5% do piso', () => {
    expect(pedido(ZERO, { pisoCents: 1800 }).piso?.situacao).toBe('proximo');
  });
  it('acima', () => expect(pedido(ZERO, { pagamento: 'pix', pisoCents: 1800 }).piso?.situacao).toBe('acima'));
  it('conta incompleta cujo teto já fica abaixo do piso: abaixo é certo', () => {
    expect(pedido(MAGALU, { quantidade: 5, pisoCents: 3000 }).piso?.situacao).toBe('abaixo');
  });
  it('conta incompleta cujo teto alcança o piso: indeterminado', () => {
    // Teto de R$ 18,60 por pacote: acima de R$ 18,00, mas o custo do frete é desconhecido.
    expect(pedido(MAGALU, { quantidade: 5, pisoCents: 1800 }).piso?.situacao).toBe('indeterminado');
  });
  it('sem piso informado, sem classificação', () => expect(pedido(ML, { pisoCents: null }).piso).toBeNull());
});

describe('volume mensal e ano', () => {
  it('1.000 pacotes a R$ 13,40: R$ 13.400 no mês e R$ 160.800 no ano', () => {
    const r = pedido(ML);
    expect(projetar(r, 1000, 1, 1900).liquidoCents).toBe(1340000);
    expect(projetar(r, 1000, 12, 1900).liquidoCents).toBe(16080000);
  });
  it('diferença para o piso: −R$ 4,40 por pacote vira −R$ 4.400 no mês e −R$ 52.800 no ano', () => {
    const r = pedido(MAGALU);
    expect(projetar(r, 1000, 1, 1900).diferencaPisoCents).toBe(-440000);
    expect(projetar(r, 1000, 12, 1900).diferencaPisoCents).toBe(-5280000);
  });
  it('mensalidade rateada por pedido', () => {
    expect(pedido(LIVRE).linhas.find(l => l.componente === 'mensalidade')!.valorCents).toBe(7);
  });
  it('zero vendas: sem rateio no pedido, mensalidade cheia no mês', () => {
    const r = pedido(LIVRE, { volumeMensal: 0 });
    expect(r.linhas.find(l => l.componente === 'mensalidade')!.valorCents).toBe(0);
    expect(projetar(r, 0, 1, 1900).liquidoCents).toBe(-6990);
  });
  it('pedidos com 3 pacotes: 1.000 pacotes = 333,3 pedidos, sem perder centavo por pedido inteiro', () => {
    const r = pedido(ML, { quantidade: 3 });
    expect(projetar(r, 1000, 1, null).vendaCents).toBe(2390000);
  });
});

describe('economia potencial', () => {
  it('exata quando as duas contas estão completas', () => {
    const atual = projetar(pedido(ML), 1000, 1, 1900);
    const livre = projetar(pedido(ZERO), 1000, 1, 1900);
    expect(comparar(atual, livre)).toEqual({ tipo: 'exata', diferencaCents: 549000 });
  });
  it('mínima quando a plataforma atual tem custo desconhecido', () => {
    const atual = projetar(pedido(MAGALU, { quantidade: 5 }), 1000, 1, 1900);
    const livre = projetar(pedido(ZERO, { quantidade: 5 }), 1000, 1, 1900);
    expect(comparar(atual, livre).tipo).toBe('minima');
  });
  it('indeterminada quando o Coffee LiVRE tem valor em estudo', () => {
    const atual = projetar(pedido(ML), 1000, 1, 1900);
    const livre = projetar(pedido(LIVRE, { gramaturaG: 250 }), 1000, 1, 1900);
    expect(comparar(atual, livre).tipo).toBe('indeterminada');
  });
  it('mensalidade em perspectiva: R$ 69,90 sobre R$ 5.490 de economia = 1,27%', () => {
    expect(pesoDaMensalidade(6990, 549000)).toBe(127);
    expect(pesoDaMensalidade(6990, -10)).toBeNull();
  });
});

describe('preço necessário para preservar o piso', () => {
  it('Mercado Livre Clássico: R$ 30,41 entrega R$ 19,00 e R$ 30,40 não', () => {
    const s = precoParaLiquido(REGRAS, ML, BASE, 1900);
    expect(s).toEqual({ tipo: 'preco', precoCents: 3041 });
    expect(pedido(ML, { precoCents: 3040 }).liquidoUnidadeCents).toBeLessThan(1900);
  });
  it('não resolve quando atravessa custo não público', () => {
    expect(precoParaLiquido(REGRAS, MAGALU, { ...BASE, quantidade: 5 }, 1900)).toEqual({ tipo: 'indeterminado' });
  });
  it('alvo inválido não tem solução', () => {
    expect(precoParaLiquido(REGRAS, ML, BASE, 0)).toEqual({ tipo: 'sem_solucao' });
  });
});

describe('preço no Coffee LiVRE que preserva o líquido de hoje', () => {
  it('R$ 13,40 líquidos do ML Clássico cabem num preço LiVRE Zero menor', () => {
    const s = precoParaLiquido(REGRAS, ZERO, BASE, 1340);
    expect(s.tipo).toBe('preco');
    const p = (s as { precoCents: number }).precoCents;
    expect(pedido(ZERO, { precoCents: p }).liquidoUnidadeCents).toBeGreaterThanOrEqual(1340);
    expect(pedido(ZERO, { precoCents: p - 1 }).liquidoUnidadeCents).toBeLessThan(1340);
    expect(p).toBe(1728);
  });
});

describe('entradas inválidas', () => {
  it.each<[string, Partial<Cenario>]>([
    ['preço zero', { precoCents: 0 }],
    ['preço negativo', { precoCents: -100 }],
    ['preço fracionado', { precoCents: 23.9 }],
    ['quantidade zero', { quantidade: 0 }],
    ['quantidade fracionada', { quantidade: 2.5 }],
    ['volume negativo', { volumeMensal: -1 }],
    ['gramatura zero', { gramaturaG: 0 }],
  ])('%s', (_, c) => {
    expect(ehErro(calcularPedido(REGRAS, ML, { ...BASE, ...c }))).toBe(true);
  });
});

describe('quantidade de 1 a 5 com a escada da PDP', () => {
  it('cada quantidade recalcula venda, custo e líquido por pacote', () => {
    const d = simularEscada(REGRAS, ZERO, BASE, []);
    expect(d.map(x => x.quantidade)).toEqual([1, 2, 3, 4, 5]);
    expect(d.map(x => x.totalCents)).toEqual([2390, 4780, 7170, 9560, 11950]);
    expect(new Set(d.map(x => x.resultado.liquidoCents)).size).toBe(5);
  });
  it('usa as faixas do vendedor: 4 pacotes com R$ 2,00 a menos cada', () => {
    const d = simularEscada(REGRAS, ZERO, BASE, [{ min_qty: 4, tipo: 'reais', valor: 200 }]);
    expect(d[3].unitarioCents).toBe(2190);
    expect(d[3].resultado.vendaCents).toBe(8760);
  });
});
