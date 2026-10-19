// Os dez cenários que o Vlademir listou, mais o que descobri auditando.
//
// Função pura: dá para provar que "Boa noite" não cai às 8h sem subir tela,
// sem banco e sem publicar nada.
import { describe, it, expect } from 'vitest';
import {
  classificar, montarSugestoes, assinatura, diaDaSemanaEm, LIMITE_REVISAO,
  type Arte, type Janela,
} from './agendador';

const MARCA = 'marca-saporino';
const OUTRA = 'marca-tropeiro';

function janela(hora: string, periodo: 'manha' | 'tarde' | 'noite', brand = MARCA): Janela {
  return { brand_id: brand, dia_semana: null, hora, periodo, plataforma: 'instagram', ativa: true };
}
const JANELAS = [janela('08:00', 'manha'), janela('15:00', 'tarde'), janela('19:00', 'noite')];

function arte(id: string, texto: string, brand = MARCA, publicada?: string): Arte {
  return { id, brand_id: brand, titulo: id, agendamento: classificar({ textoDaArte: texto }), publicada_em: publicada ?? null };
}

// 13/10/2026 é uma TERÇA. Datas fixas para o teste não mudar de resultado amanhã.
const TERCA = '2026-10-13';
const QUARTA = '2026-10-14';

describe('classificar — o que a arte diz sobre quando sair', () => {
  it('pega o dia da semana escrito na peça', () => {
    const a = classificar({ textoDaArte: 'Comece sua terça-feira com um bom café' });
    expect(a.dia_da_semana).toBe('terca');
    expect(a.temporalidade).toBe('dia_fixo');
    expect(a.confianca).toBeGreaterThan(0.9);
  });

  it('pega o período de "bom dia"', () => {
    const a = classificar({ textoDaArte: 'Bom dia! Que tal um café?' });
    expect(a.periodo).toBe('manha');
    expect(a.tema).toBe('bom_dia');
  });

  it('pega "boa noite"', () => {
    const a = classificar({ textoDaArte: 'Boa noite, feche o dia com Saporino' });
    expect(a.periodo).toBe('noite');
  });

  it('arte sem referência temporal é perene', () => {
    const a = classificar({ textoDaArte: 'Quem prova, sorri.' });
    expect(a.dia_da_semana).toBeNull();
    expect(a.periodo).toBeNull();
    expect(a.temporalidade).toBe('perene');
  });

  it('texto da PEÇA pesa mais que o resumo', () => {
    // O resumo fala em sexta; a peça fala em terça. A peça manda.
    const a = classificar({ textoDaArte: 'Boa terça!', resumo: 'clima de sexta-feira' });
    expect(a.dia_da_semana).toBe('terca');
  });

  it('sem texto nenhum, vai para revisão em vez de chutar', () => {
    const a = classificar({});
    expect(a.confianca).toBeLessThan(LIMITE_REVISAO);
    expect(a.justificativa).toMatch(/revis[ãa]o/i);
  });

  it('reconhece data comemorativa de dia fixo', () => {
    const a = classificar({ textoDaArte: 'Hoje é o Dia do Café!' });
    expect(a.data_especifica).toBe('05-24');
    expect(a.temporalidade).toBe('sazonal');
  });

  it('a justificativa é legível por gente', () => {
    const a = classificar({ textoDaArte: 'Boa terça-feira! Bom dia!' });
    expect(a.justificativa).toMatch(/terca|terça/i);
    expect(a.justificativa.length).toBeGreaterThan(10);
  });
});

describe('os dez cenários obrigatórios', () => {
  it('1. arte de terça é sugerida para terça', () => {
    const artes = [arte('a1', 'Boa terça-feira!')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].video_id).toBe('a1');
    expect(diaDaSemanaEm(sugestoes[0].quando)).toBe('terca');
  });

  it('1b. a MESMA arte de terça NÃO entra na quarta', () => {
    const artes = [arte('a1', 'Boa terça-feira!')];
    const { sugestoes, vazios } = montarSugestoes(artes, JANELAS, [], [QUARTA]);
    expect(sugestoes).toHaveLength(0);
    expect(vazios.length).toBe(3);
  });

  it('2. arte de bom dia vai para a janela da manhã', () => {
    const artes = [arte('a2', 'Bom dia!')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].hora).toBe('08:00');
    expect(sugestoes[0].periodo).toBe('manha');
  });

  it('3. arte de boa noite NÃO aparece às 08h', () => {
    const artes = [arte('a3', 'Boa noite!')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].hora).toBe('19:00');
    expect(sugestoes.some(s => s.hora === '08:00')).toBe(false);
  });

  it('4. arte atemporal usa um horário disponível', () => {
    const artes = [arte('a4', 'Quem prova, sorri.')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(1);
    expect(['08:00', '15:00', '19:00']).toContain(sugestoes[0].hora);
  });

  it('5. sem arte adequada, o horário fica VAZIO — nada é inventado', () => {
    const { sugestoes, vazios } = montarSugestoes([], JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(0);
    expect(vazios).toHaveLength(3);
    expect(vazios[0].motivo).toMatch(/Nenhuma arte adequada/);
  });

  it('5b. uma arte só gera UMA sugestão, não três', () => {
    const artes = [arte('a5', 'Quem prova, sorri.')];
    const { sugestoes, vazios } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(1);
    expect(vazios).toHaveLength(2);
  });

  it('6. arte já publicada não volta antes do prazo', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const artes = [arte('a6', 'Quem prova, sorri.', MARCA, ontem)];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA], { diasParaReusar: 90 });
    expect(sugestoes).toHaveLength(0);
  });

  it('6b. com reuso desligado, arte publicada nunca volta', () => {
    const antigo = new Date(Date.now() - 400 * 86400000).toISOString();
    const artes = [arte('a6', 'Quem prova, sorri.', MARCA, antigo)];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA], { diasParaReusar: 0 });
    expect(sugestoes).toHaveLength(0);
  });

  it('7. arte de uma marca NUNCA entra na janela de outra', () => {
    const artes = [arte('a7', 'Bom dia!', OUTRA)];
    const { sugestoes, vazios } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(0);
    expect(vazios).toHaveLength(3);
  });

  it('8+9. a assinatura muda quando a legenda muda — exige nova aprovação', () => {
    const base = { video_id: 'a8', brand_id: MARCA, plataforma: 'instagram', quando: `${TERCA}T08:00:00` };
    const antes = assinatura({ ...base, legenda: 'Bom dia!' });
    const depois = assinatura({ ...base, legenda: 'Bom dia, Saporino!' });
    expect(antes).not.toBe(depois);
  });

  it('9b. mudar o horário também invalida a aprovação', () => {
    const base = { video_id: 'a9', brand_id: MARCA, plataforma: 'instagram', legenda: 'x' };
    expect(assinatura({ ...base, quando: `${TERCA}T08:00:00` }))
      .not.toBe(assinatura({ ...base, quando: `${TERCA}T19:00:00` }));
  });

  it('9c. a mesma coisa duas vezes dá a mesma assinatura', () => {
    const p = { video_id: 'a9', brand_id: MARCA, plataforma: 'instagram', quando: `${TERCA}T08:00:00`, legenda: ' x ' };
    expect(assinatura(p)).toBe(assinatura({ ...p, legenda: 'x' }));
  });
});

describe('as travas de repetição', () => {
  it('não sugere a mesma arte duas vezes na mesma rodada', () => {
    const artes = [arte('u1', 'Quem prova, sorri.')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA, QUARTA]);
    const ids = sugestoes.map(s => s.video_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não repete o mesmo tema em dias seguidos', () => {
    const artes = [arte('b1', 'Bom dia!'), arte('b2', 'Bom dia, tudo bem?')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA, QUARTA], { diasEntreMesmoTema: 2 });
    // As duas são 'bom_dia' e os dias são seguidos: só uma entra.
    expect(sugestoes).toHaveLength(1);
  });

  it('respeita o que JÁ estava agendado', () => {
    const artes = [arte('c1', 'Bom dia!')];
    const ja = [{ brand_id: MARCA, video_id: 'c1', quando: `${TERCA}T08:00:00`, tema: 'bom_dia' }];
    const { sugestoes } = montarSugestoes(artes, JANELAS, ja, [TERCA]);
    expect(sugestoes).toHaveLength(0);
  });

  it('arte com confiança baixa não entra sozinha no calendário', () => {
    const a: Arte = { id: 'd1', brand_id: MARCA, titulo: 'sem texto', agendamento: classificar({}) };
    const { sugestoes } = montarSugestoes([a], JANELAS, [], [TERCA]);
    expect(sugestoes).toHaveLength(0);
  });
});

describe('a explicação', () => {
  it('diz por que aquela arte foi para aquele horário', () => {
    const artes = [arte('e1', 'Boa terça-feira! Bom dia!')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes[0].motivo).toMatch(/terça-feira/);
    expect(sugestoes[0].motivo).toMatch(/08:00/);
  });

  it('não promete engajamento que ninguém mediu', () => {
    const artes = [arte('e2', 'Bom dia!')];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA]);
    expect(sugestoes[0].motivo).not.toMatch(/engajamento|melhor desempenho|mais curtidas/i);
  });
});

describe('o que conta como DISPONÍVEL', () => {
  // O contador dizia "40 disponíveis" numa marca com 22 já publicadas. As
  // sugestões estavam certas (o motor filtrava por dentro), mas o número fazia
  // o Vlademir achar que tinha três semanas de estoque quando tinha uma.
  it('arte publicada há pouco não entra no calendário', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const artes = [
      arte('nova', 'Quem prova, sorri.'),
      arte('velha', 'Café que acompanha o dia.', MARCA, ontem),
    ];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA], { diasParaReusar: 90 });
    expect(sugestoes.map(s => s.video_id)).toEqual(['nova']);
  });

  it('arte publicada há muito tempo volta a ficar disponível', () => {
    const antigo = new Date(Date.now() - 200 * 86400000).toISOString();
    const artes = [arte('antiga', 'Quem prova, sorri.', MARCA, antigo)];
    const { sugestoes } = montarSugestoes(artes, JANELAS, [], [TERCA], { diasParaReusar: 90 });
    expect(sugestoes).toHaveLength(1);
  });

  it('com TODAS publicadas, não sugere nada — e não inventa', () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const artes = [
      arte('p1', 'Bom dia!', MARCA, ontem),
      arte('p2', 'Boa noite!', MARCA, ontem),
    ];
    const { sugestoes, vazios } = montarSugestoes(artes, JANELAS, [], [TERCA], { diasParaReusar: 90 });
    expect(sugestoes).toHaveLength(0);
    expect(vazios).toHaveLength(3);
  });
});
