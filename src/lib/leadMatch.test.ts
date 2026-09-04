import { describe, it, expect } from 'vitest';
import {
  normName,
  onlyDigits,
  distMeters,
  coreTokens,
  leadMatchesProspect,
  classifyRfMatch,
} from './leadMatch';

describe('normName', () => {
  it('remove acento, caixa e pontuação, colapsa espaços', () => {
    expect(normName('Padaria São João & Cia.')).toBe('padaria sao joao cia');
    expect(normName('  Café   Torrefação  ')).toBe('cafe torrefacao');
  });
  it('trata null/undefined como string vazia', () => {
    expect(normName(null)).toBe('');
    expect(normName(undefined)).toBe('');
  });
});

describe('onlyDigits', () => {
  it('mantém só dígitos', () => {
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190');
    expect(onlyDigits(null)).toBe('');
  });
});

describe('distMeters (haversine)', () => {
  it('mesmo ponto = 0', () => {
    expect(distMeters([-23.5, -46.6], [-23.5, -46.6])).toBe(0);
  });
  it('0.001° de latitude ≈ 111 m', () => {
    const d = distMeters([0, 0], [0.001, 0]);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe('coreTokens', () => {
  it('remove stopwords e tokens curtos', () => {
    // "padaria","doce" são stopwords; "pedaco" (>=3, não-stopword) fica
    expect(coreTokens('Padaria Doce Pedaço')).toEqual(['pedaco']);
  });
  it('respeita extraStop (ex.: nome do município)', () => {
    expect(coreTokens('Jundiai Torrefacao Beltrano', new Set(['jundiai'])))
      .toEqual(['torrefacao', 'beltrano']);
  });
  it('nome 100% genérico vira núcleo vazio', () => {
    expect(coreTokens('Bar Central')).toEqual([]);
  });
});

describe('leadMatchesProspect', () => {
  it('CNPJ igual = match forte (score 1)', () => {
    const r = leadMatchesProspect(
      { cnpj: '12.345.678/0001-90' },
      { cnpj: '12345678000190' },
    );
    expect(r).toEqual({ match: true, reason: 'cnpj', score: 1 });
  });

  it('núcleo de nome vazio nunca casa (evita "Padaria Avenida" casar com tudo)', () => {
    const r = leadMatchesProspect(
      { trade_name: 'Bar Central' },
      { nome_fantasia: 'Padaria Avenida' },
    );
    expect(r.match).toBe(false);
  });

  it('nome forte (2 tokens distintivos) casa sem geo', () => {
    const r = leadMatchesProspect(
      { trade_name: 'Torrefação Beltrano' },
      { nome_fantasia: 'Torrefação Beltrano Ltda' },
    );
    expect(r.match).toBe(true);
    expect(r.reason).toBe('nome');
  });

  it('um único token curto genérico NÃO casa sem proximidade', () => {
    const r = leadMatchesProspect(
      { trade_name: 'Bar Terra', lat: null, lng: null },
      { nome_fantasia: 'Restaurante Terra', lat: null, lng: null },
    );
    expect(r.match).toBe(false);
  });

  it('nome parcial + proximidade real fecha (nome+geo)', () => {
    const r = leadMatchesProspect(
      { trade_name: 'Bar Terra', lat: -23.5, lng: -46.6 },
      { nome_fantasia: 'Restaurante Terra', lat: -23.5, lng: -46.6 },
    );
    expect(r.match).toBe(true);
    expect(r.reason).toBe('nome+geo');
  });

  it('coordenada distante não conta como proximidade', () => {
    const r = leadMatchesProspect(
      { trade_name: 'Bar Terra', lat: -23.5, lng: -46.6 },
      { nome_fantasia: 'Restaurante Terra', lat: -22.9, lng: -43.2 }, // ~350km
    );
    expect(r.match).toBe(false);
  });
});

describe('classifyRfMatch', () => {
  it('nome forte + mesmo bairro = high', () => {
    const r = classifyRfMatch(
      { trade_name: 'Torrefação Beltrano', district: 'Centro' },
      { nome_fantasia: 'Torrefação Beltrano', bairro: 'Centro' },
    );
    expect(r.level).toBe('high');
  });

  it('nome forte, bairro diferente = medium', () => {
    const r = classifyRfMatch(
      { trade_name: 'Torrefação Beltrano', district: 'Centro' },
      { nome_fantasia: 'Torrefação Beltrano', bairro: 'Jardim América' },
    );
    expect(r.level).toBe('medium');
  });

  it('nome médio (jaccard entre 0.34 e 0.5) = medium', () => {
    const r = classifyRfMatch(
      { trade_name: 'Torrefação Beltrano Sicrano' },
      { nome_fantasia: 'Torrefação Beltrano Fulano Mengano' },
    );
    expect(r.score).toBeGreaterThanOrEqual(0.34);
    expect(r.score).toBeLessThan(0.5);
    expect(r.level).toBe('medium');
  });

  it('núcleo vazio = none', () => {
    const r = classifyRfMatch(
      { trade_name: 'Bar Central' },
      { nome_fantasia: 'Padaria Avenida' },
    );
    expect(r.level).toBe('none');
  });
});
