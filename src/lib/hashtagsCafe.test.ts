/**
 * Testes das hashtags. Os casos vêm do que foi medido nas 22 publicações
 * agendadas em 21/10/2026, onde #CaféForte aparecia em 19 delas.
 */
import { describe, it, expect } from 'vitest';
import { montarHashtags, trocarHashtags, ehDeTerceiro, normalizar } from './hashtagsCafe';

const MARCA = '#CafeTropeiroPaulista';

describe('tag de concorrente nunca entra', () => {
  it('reconhece marca de terceiro, com e sem acento', () => {
    for (const t of ['#pilao', '#Pilão', '#melitta', '#3coracoes', '#nespresso',
                     '#DolceGusto', '#starbucks', '#cafeuniao', '#orfeu']) {
      expect(ehDeTerceiro(t), t).toBe(true);
    }
  });

  it('não confunde tag genérica com marca', () => {
    for (const t of ['#cafe', '#cafezinho', '#cafeespecial', '#horadocafe', '#saopaulo']) {
      expect(ehDeTerceiro(t), t).toBe(false);
    }
  });

  it('nenhuma tag de terceiro sai do montador, em 200 peças', () => {
    for (let i = 0; i < 200; i++) {
      for (const t of montarHashtags('peca-' + i, { daMarca: MARCA })) {
        expect(ehDeTerceiro(t), t).toBe(false);
      }
    }
  });

  it('nem a própria marca passa, se alguém puser um concorrente lá', () => {
    expect(montarHashtags('x', { daMarca: '#melitta' })).not.toContain('#melitta');
  });
});

describe('rotação — o defeito dos 19 em 22', () => {
  it('peças diferentes não recebem o MESMO conjunto', () => {
    const a = montarHashtags('arte-A', { daMarca: MARCA });
    const b = montarHashtags('arte-B', { daMarca: MARCA });
    // Coincidir uma ou outra e normal com listas deste tamanho; o que nao
    // pode e sair o mesmo bloco, que foi o defeito medido. Quem garante a
    // nao-dominancia e o teste das 22, abaixo.
    expect(a.join()).not.toBe(b.join());
    const iguais = a.filter(t => t !== MARCA && b.includes(t));
    expect(iguais.length).toBeLessThan(a.length - 2);
  });

  it('a MESMA peça recebe sempre o mesmo conjunto', () => {
    expect(montarHashtags('arte-A', { daMarca: MARCA }))
      .toEqual(montarHashtags('arte-A', { daMarca: MARCA }));
  });

  // O número que importa: nenhuma tag pode dominar como #CaféForte dominava.
  it('em 22 peças, nenhuma tag genérica aparece em mais de metade', () => {
    const freq = new Map<string, number>();
    for (let i = 0; i < 22; i++) {
      for (const t of montarHashtags('p' + i, { daMarca: MARCA })) {
        if (t === MARCA) continue;
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    const pior = Math.max(...freq.values());
    expect(pior).toBeLessThanOrEqual(11);   // antes: 19 de 22
  });

  it('as recentes são evitadas quando há alternativa', () => {
    const primeiro = montarHashtags('p1', { daMarca: MARCA });
    const segundo = montarHashtags('p2', { daMarca: MARCA, recentes: primeiro });
    const repetidas = segundo.filter(t => t !== MARCA && primeiro.includes(t));
    expect(repetidas).toHaveLength(0);
  });

  it('com acervo pequeno não devolve lista vazia — reserva vale mais que vazio', () => {
    const todas = Array.from({ length: 40 }, (_, i) =>
      montarHashtags('p' + i, { daMarca: MARCA })).flat();
    const r = montarHashtags('novo', { daMarca: MARCA, recentes: todas });
    expect(r.length).toBeGreaterThan(3);
  });
});

describe('composição', () => {
  it('sete por padrão, e a da marca sempre presente', () => {
    const t = montarHashtags('x', { daMarca: MARCA });
    expect(t).toHaveLength(7);
    expect(t[0]).toBe(MARCA);
  });

  it('respeita o quanto foi pedido, dentro do razoável', () => {
    expect(montarHashtags('x', { daMarca: MARCA, quantas: 4 })).toHaveLength(4);
    expect(montarHashtags('x', { daMarca: MARCA, quantas: 99 }).length).toBeLessThanOrEqual(12);
    expect(montarHashtags('x', { daMarca: MARCA, quantas: 1 }).length).toBeGreaterThanOrEqual(3);
  });

  it('não repete a mesma tag dentro do post', () => {
    const t = montarHashtags('x', { daMarca: MARCA });
    expect(new Set(t).size).toBe(t.length);
  });

  it('funciona sem marca informada', () => {
    expect(montarHashtags('x').length).toBeGreaterThan(3);
  });
});

describe('normalizar e trocar', () => {
  it('uma tag só tem uma forma', () => {
    expect(normalizar('cafe')).toBe('#cafe');
    expect(normalizar('##cafe')).toBe('#cafe');
    expect(normalizar('# cafe forte')).toBe('#cafeforte');
  });

  it('troca o bloco de tags e preserva o texto', () => {
    const antes = 'Café que acorda de verdade. ☕ #CafeForte #RitualDoCafe\n\n#CafeDaManha';
    const depois = trocarHashtags(antes, ['#cafe', '#cafezinho']);
    expect(depois).toContain('Café que acorda de verdade');
    expect(depois).not.toContain('#CafeForte');
    expect(depois).toContain('#cafezinho');
  });

  it('legenda sem tags recebe as novas sem perder nada', () => {
    const d = trocarHashtags('Só o texto, sem tag.', ['#cafe']);
    expect(d).toContain('Só o texto, sem tag.');
    expect(d).toContain('#cafe');
  });
});
