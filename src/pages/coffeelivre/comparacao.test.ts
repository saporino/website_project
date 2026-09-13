import { describe, expect, it } from 'vitest';
import {
  compararComMercado, precoPorKg, recomendarPreco, relacionar, temDiferenciais,
  type ProdutoDeMercado,
} from './comparacao';

let seq = 0;
const TRADICIONAL = { classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', moagem: 'Média' };

function cafe(preco: number, p: Partial<ProdutoDeMercado> = {}, attrs: Record<string, string> = {}): ProdutoDeMercado {
  seq++;
  return {
    id: `p${seq}`, storeId: `loja${seq}`, lojaNome: `Loja ${seq}`, titulo: `Café ${seq}`, slug: `cafe-${seq}`,
    precoCents: preco, gramaturaG: 500, atributos: { ...TRADICIONAL, ...attrs }, ...p,
  };
}

const alvo = (preco: number, attrs: Record<string, string> = {}) =>
  cafe(preco, { id: 'meu', storeId: 'minha-loja' }, attrs);

// Mediana de 2680: [2490, 2590, 2680, 2790, 2890]
const MERCADO = [2490, 2590, 2680, 2790, 2890].map(p => cafe(p));

describe('equivalência', () => {
  it('mesma gramatura, classificação, espécie, torra e moagem = direto', () => {
    expect(relacionar(alvo(2990), cafe(2500)).relacao).toBe('direto');
  });
  it('especial de 250 g nunca é comparação direta de tradicional de 500 g', () => {
    const r = relacionar(alvo(2990), cafe(5290, { gramaturaG: 250 }, { classificacao: 'Especial', especie: 'Arábica', moagem: 'Em grãos' }));
    expect(r.relacao).toBe('outro');
  });
  it('mesma classificação com torra diferente = semelhante, com a diferença dita', () => {
    const r = relacionar(alvo(2990), cafe(2500, {}, { torra: 'Escura' }));
    expect(r).toEqual({ relacao: 'semelhante', diferencas: ['torra Escura'] });
  });
  it('mesmo formato com outra gramatura = semelhante', () => {
    expect(relacionar(alvo(2990), cafe(1500, { gramaturaG: 250 })).relacao).toBe('semelhante');
  });
  it('café com ABIC só se compara diretamente com ABIC', () => {
    expect(relacionar(alvo(2990, { certificacoes: 'ABIC' }), cafe(2500)).relacao).toBe('semelhante');
    expect(relacionar(alvo(2990, { certificacoes: 'ABIC' }), cafe(2500, {}, { certificacoes: 'Orgânico, ABIC' })).relacao).toBe('direto');
  });
  it('produtos da própria loja não são mercado', () => {
    expect(relacionar(alvo(2990), cafe(2500, { storeId: 'minha-loja' })).relacao).toBe('outro');
  });
  it('ficha incompleta não vira comparação direta', () => {
    const incompleto = alvo(2990);
    delete incompleto.atributos.especie;
    expect(relacionar(incompleto, cafe(2500)).relacao).toBe('semelhante');
    expect(compararComMercado(incompleto, MERCADO).faltandoParaDireto).toEqual(['especie']);
  });
});

describe('métricas', () => {
  it('preço por kg', () => {
    expect(precoPorKg(2390, 500)).toBe(4780);
    expect(precoPorKg(5290, 250)).toBe(21160);
  });
  it('mediana, menor, maior, quantidade e distância', () => {
    const e = compararComMercado(alvo(2990), MERCADO).estatisticas!;
    expect(e.quantidade).toBe(5);
    expect(e.medianaPacoteCents).toBe(2680);
    expect(e.menorPacoteCents).toBe(2490);
    expect(e.maiorPacoteCents).toBe(2890);
    expect(e.medianaKgCents).toBe(5360);
    expect(e.distanciaBps).toBe(1157);
    expect(e.posicao).toBe('acima_da_faixa');
  });
  it('mediana com número par de equivalentes', () => {
    expect(compararComMercado(alvo(2600), MERCADO.slice(0, 4)).estatisticas!.medianaPacoteCents).toBe(2635);
  });
  it('semelhantes não entram na mediana', () => {
    const c = compararComMercado(alvo(2990), [...MERCADO, cafe(900, {}, { torra: 'Escura' })]);
    expect(c.semelhantes).toHaveLength(1);
    expect(c.estatisticas!.medianaPacoteCents).toBe(2680);
  });
  it('amostra insuficiente não gera mediana', () => {
    const c = compararComMercado(alvo(2990), MERCADO.slice(0, 2));
    expect(c.amostraSuficiente).toBe(false);
    expect(c.estatisticas).toBeNull();
  });
});

describe('recomendação', () => {
  it('exemplo da especificação: R$ 29,90, mediana R$ 26,80, piso R$ 24,90 → R$ 26,79', () => {
    const a = alvo(2990);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2490);
    expect(r.tipo).toBe('acima_da_mediana');
    expect(r.sugestaoCents).toBe(2679);
    expect(r.titulo).toBe('Seu preço está 12% acima da mediana de cafés equivalentes.');
    expect(r.explicacao).toBe('Você pode ir para R$ 26,79 e continuar acima do seu piso.');
  });
  it('opções rápidas: recomendado, igualar mediana, 1% abaixo e manter', () => {
    const a = alvo(2990);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2490);
    expect(r.opcoes.map(o => [o.chave, o.precoCents])).toEqual([
      ['recomendado', 2679], ['mediana', 2680], ['mediana_menos_1', 2653], ['manter', 2990],
    ]);
  });
  it('competitivo: não recomenda alteração', () => {
    const a = alvo(2750);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2490);
    expect(r.tipo).toBe('competitivo');
    expect(r.sugestaoCents).toBeNull();
  });
  it('piso acima da mediana limita a sugestão ao piso', () => {
    const a = alvo(2990);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2750);
    expect(r.sugestaoCents).toBe(2750);
    expect(r.opcoes.find(o => o.chave === 'mediana')!.abaixoDoPiso).toBe(true);
  });
  it('preço já no piso: não recomenda reduzir', () => {
    const a = alvo(2990);
    expect(recomendarPreco(compararComMercado(a, MERCADO), a, 2990).tipo).toBe('piso_impede');
  });
  it('diferenciais justificam preço acima da mediana', () => {
    const a = alvo(3490, { pontuacao: '84', certificacoes: 'ABIC', regiao: 'Sul de Minas' });
    // Equivalentes também com ABIC, para continuarem diretos; sem região nem pontuação.
    const mercado = [2490, 2590, 2680].map(p => cafe(p, {}, { certificacoes: 'ABIC' }));
    const c = compararComMercado(a, mercado);
    expect(temDiferenciais(a, c.diretos)).toBe(true);
    expect(recomendarPreco(c, a, 2490).tipo).toBe('acima_com_diferenciais');
  });
  it('abaixo da mediana: espaço para subir, sem empurrar', () => {
    const a = alvo(2200);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2000);
    expect(r.tipo).toBe('abaixo_da_mediana');
    expect(r.sugestaoCents).toBe(2679);
  });
  it('amostra insuficiente: diz claramente, sem opções', () => {
    const a = alvo(2990);
    const r = recomendarPreco(compararComMercado(a, MERCADO.slice(0, 1)), a, 2490);
    expect(r.tipo).toBe('amostra_insuficiente');
    expect(r.opcoes).toEqual([]);
    expect(r.explicacao).toContain('pelo menos 3');
  });
  it('nunca usa linguagem de guerra de preço', () => {
    const a = alvo(2990);
    const r = recomendarPreco(compararComMercado(a, MERCADO), a, 2490);
    expect(`${r.titulo} ${r.explicacao}`).not.toMatch(/mais barato|precisa ser/i);
  });
});
