import { describe, it, expect } from 'vitest';
import { custoDaImagemUSD, decomporEntrada, FORMATOS, PRECOS } from './aiPricing.ts';

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

describe('decomporEntrada — separar texto de imagem na entrada', () => {
  it('grava a decomposição quando a API manda input_tokens_details', () => {
    const d = decomporEntrada({
      input_tokens: 3000,
      input_tokens_details: { text_tokens: 1000, image_tokens: 2000 },
    });
    expect(d).toEqual({ texto: 1000, imagem: 2000, cache: null });
  });

  it('a decomposição soma o total informado pela API', () => {
    const uso = { input_tokens: 3000, input_tokens_details: { text_tokens: 1000, image_tokens: 2000 } };
    const d = decomporEntrada(uso);
    expect((d.texto ?? 0) + (d.imagem ?? 0)).toBe(uso.input_tokens);
  });

  it('sem input_tokens_details devolve nulo — nulo é "não informado", não zero', () => {
    // Foi o caso da primeira geração real: entrada só de texto, sem detalhe.
    // Gravar zero faria um relatório dizer que a referência não custou nada.
    const d = decomporEntrada({ input_tokens: 1092, output_tokens: 1587 });
    expect(d.texto).toBeNull();
    expect(d.imagem).toBeNull();
  });

  it('captura o cache venha ele no detalhe ou solto no usage', () => {
    expect(decomporEntrada({ input_tokens_details: { cached_tokens: 50 } }).cache).toBe(50);
    expect(decomporEntrada({ cached_tokens: 80 }).cache).toBe(80);
  });

  it('sem usage nenhum, não quebra e não inventa', () => {
    expect(decomporEntrada(null)).toEqual({ texto: null, imagem: null, cache: null });
    expect(decomporEntrada(undefined)).toEqual({ texto: null, imagem: null, cache: null });
  });

  it('detalhe parcial preserva o que veio e deixa nulo o que não veio', () => {
    const d = decomporEntrada({ input_tokens: 500, input_tokens_details: { text_tokens: 500 } });
    expect(d.texto).toBe(500);
    expect(d.imagem).toBeNull();
  });
});

describe('o custo não mudou com a instrumentação nova', () => {
  it('reproduz exatamente a primeira geração real: $ 0,05307', () => {
    // 1.092 entrada (tudo texto) + 1.587 saída, gpt-image-2.5-flare.
    // Este é o valor medido em produção em 10/09/2026 — se mudar, quebrou.
    const c = custoDaImagemUSD('gpt-image-2.5-flare', { input_tokens: 1092, output_tokens: 1587 });
    expect(c).toBe(0.05307);
  });

  it('geração SEM imagem continua custando o mesmo de antes', () => {
    const semDetalhe = custoDaImagemUSD('gpt-image-2.5-flare', { input_tokens: 1000, output_tokens: 1500 });
    const comDetalheSoTexto = custoDaImagemUSD('gpt-image-2.5-flare', {
      input_tokens: 1000, output_tokens: 1500,
      input_tokens_details: { text_tokens: 1000, image_tokens: 0 },
    });
    expect(semDetalhe).toBe(comDetalheSoTexto);
  });

  it('imagem de referência custa mais que a mesma quantidade de texto', () => {
    // $8/1M contra $5/1M — é o que responde "quanto a embalagem acrescentou".
    const soTexto = custoDaImagemUSD('gpt-image-2.5-flare', {
      input_tokens: 2000, output_tokens: 1587,
      input_tokens_details: { text_tokens: 2000, image_tokens: 0 },
    })!;
    const comImagem = custoDaImagemUSD('gpt-image-2.5-flare', {
      input_tokens: 2000, output_tokens: 1587,
      input_tokens_details: { text_tokens: 1000, image_tokens: 1000 },
    })!;
    expect(comImagem).toBeGreaterThan(soTexto);
    // 1.000 tokens migrando de $5/1M para $8/1M = +$0,003
    expect(comImagem - soTexto).toBeCloseTo(0.003, 6);
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
