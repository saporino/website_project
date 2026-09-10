import { describe, it, expect } from 'vitest';
import { custoDaImagemUSD, FORMATOS, PRECOS } from './aiPricing.ts';

describe('custoDaImagemUSD — o número vem do usage real, nunca de estimativa', () => {
  it('soma texto de entrada, imagem de entrada e imagem de saída com os preços oficiais', () => {
    // 1.000 tokens de texto ($5/1M) + 2.000 de imagem de entrada ($8/1M)
    // + 5.000 de saída ($30/1M) = 0,005 + 0,016 + 0,15
    const c = custoDaImagemUSD('gpt-image-2.5-flare', {
      input_tokens: 3000,
      output_tokens: 5000,
      input_tokens_details: { text_tokens: 1000, image_tokens: 2000 },
    });
    expect(c).toBeCloseTo(0.171, 6);
  });

  it('sem detalhamento, trata a entrada inteira como texto — o lado barato', () => {
    // Superestimar custo com base em suposição é pior que subestimar com base
    // no que o provedor informou.
    const c = custoDaImagemUSD('gpt-image-2.5-flare', { input_tokens: 1000, output_tokens: 0 });
    expect(c).toBeCloseTo(0.005, 6);
  });

  it('a saída de imagem domina o custo, e é por isso que ela é medida', () => {
    const soEntrada = custoDaImagemUSD('gpt-image-2.5-flare', { input_tokens: 1000, output_tokens: 0 })!;
    const soSaida = custoDaImagemUSD('gpt-image-2.5-flare', { input_tokens: 0, output_tokens: 1000 })!;
    expect(soSaida).toBeGreaterThan(soEntrada * 5);
  });

  it('devolve null sem usage — melhor custo ausente que custo inventado', () => {
    expect(custoDaImagemUSD('gpt-image-2.5-flare', null)).toBeNull();
    expect(custoDaImagemUSD('gpt-image-2.5-flare', undefined)).toBeNull();
  });

  it('devolve null para modelo sem preço cadastrado', () => {
    expect(custoDaImagemUSD('modelo-que-nao-existe', { output_tokens: 1000 })).toBeNull();
  });

  it('os dois modelos de imagem têm o mesmo preço (tabela oficial 09/09/2026)', () => {
    expect(PRECOS['gpt-image-2.5-sunburst']).toEqual(PRECOS['gpt-image-2.5-flare']);
  });

  it('trata usage vazio como zero, sem quebrar', () => {
    expect(custoDaImagemUSD('gpt-image-2.5-flare', {})).toBe(0);
  });
});

describe('FORMATOS — a API exige lados múltiplos de 16', () => {
  it('todos os lados são múltiplos de 16', () => {
    for (const f of Object.values(FORMATOS)) {
      expect(f.largura % 16, `largura ${f.largura}`).toBe(0);
      expect(f.altura % 16, `altura ${f.altura}`).toBe(0);
    }
  });

  it('feed é 4:5 exato — a proporção que o Instagram usa', () => {
    expect(FORMATOS.feed.largura / FORMATOS.feed.altura).toBeCloseTo(4 / 5, 10);
  });

  it('story é 9:16 exato', () => {
    expect(FORMATOS.story.largura / FORMATOS.story.altura).toBeCloseTo(9 / 16, 10);
  });

  it('ficam dentro do limite de pixels da API (655.360 a 8.294.400)', () => {
    for (const f of Object.values(FORMATOS)) {
      const px = f.largura * f.altura;
      expect(px).toBeGreaterThanOrEqual(655_360);
      expect(px).toBeLessThanOrEqual(8_294_400);
    }
  });

  it('a proporção entre lados respeita o limite de 1:3 a 3:1', () => {
    for (const f of Object.values(FORMATOS)) {
      const r = f.largura / f.altura;
      expect(r).toBeGreaterThanOrEqual(1 / 3);
      expect(r).toBeLessThanOrEqual(3);
    }
  });
});
