// Os dez cenários que o Vlademir listou, mais o que descobri auditando.
//
// Função pura: dá para provar que "Boa noite" não cai às 8h sem subir tela,
// sem banco e sem publicar nada.
import { describe, it, expect } from 'vitest';
import {
  classificar, montarSugestoes, assinatura, diaDaSemanaEm, LIMITE_REVISAO, proximosDias, vencidas, aindaCabeHoje, diasParaProgramar,
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

// O defeito que ele achou na tela em 19/10/2026: clicou em "Gerar sugestoes"
// duas vezes e o dia 19 ficou com CINCO artes -- duas as 08:00, duas as 15:00.
// A rodada nova empilhava em cima das pendentes em vez de enxergar o horario
// como ocupado. O limite por dia nao e um numero: e uma arte por janela.
describe('gerar duas vezes nao empilha no mesmo horario', () => {
  const seis = [
    arte('g1', 'Quem prova, sorri.'), arte('g2', 'Cafe fresquinho todo dia.'),
    arte('g3', 'O sabor que acompanha voce.'), arte('g4', 'Pausa merecida.'),
    arte('g5', 'Cafe de verdade.'), arte('g6', 'Para quem gosta de cafe forte.'),
  ];

  it('a primeira rodada nunca passa de uma arte por janela', () => {
    const { sugestoes } = montarSugestoes(seis, JANELAS, [], [TERCA]);
    expect(sugestoes.length).toBeLessThanOrEqual(JANELAS.length);
    const horarios = sugestoes.map(s => s.quando);
    expect(new Set(horarios).size).toBe(horarios.length);
  });

  it('a segunda rodada nao acrescenta nada no dia que ja esta cheio', () => {
    const primeira = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    const ocupado = primeira.map(s => ({
      brand_id: s.brand_id, video_id: s.video_id, quando: s.quando,
    }));
    const { sugestoes } = montarSugestoes(seis, JANELAS, ocupado, [TERCA]);
    expect(sugestoes).toHaveLength(0);
  });

  it('as artes que sobraram vao para o dia seguinte, nao para o mesmo dia', () => {
    const primeira = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    const ocupado = primeira.map(s => ({
      brand_id: s.brand_id, video_id: s.video_id, quando: s.quando,
    }));
    const { sugestoes } = montarSugestoes(seis, JANELAS, ocupado, [TERCA, QUARTA]);
    expect(sugestoes.every(s => s.quando.startsWith(QUARTA))).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Os defeitos que ele viu na tela em 20/10/2026
// ---------------------------------------------------------------------
describe('a data da agenda — nunca gerar para ontem', () => {
  it('no dia 20 a agenda comeca no dia 20, nunca no 19', () => {
    const vinte = new Date(2026, 9, 20, 22, 30);   // 22h30 de 20/10
    expect(proximosDias(3, vinte)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  // A conta errada: `toISOString()` converte para UTC, e no Brasil isso
  // devolve o DIA SEGUINTE depois das 21h. Este teste trava a conta certa.
  //
  // ⚠️ A segunda linha usa fuso EXPLICITO, e nao o da maquina. A versao
  // anterior fazia `new Date(2026, 9, 20, 23, 59).toISOString()` e afirmava
  // que daria 21 -- o que so e verdade rodando em UTC-3. Passava aqui e
  // falhava no CI, que roda em UTC. Foi a primeira coisa que o porteiro
  // pegou, e era um teste meu que so valia no Brasil.
  it('as 23h o dia continua sendo hoje, nao amanha', () => {
    const tarde = new Date(2026, 9, 20, 23, 59);
    expect(proximosDias(1, tarde)[0]).toBe('2026-10-20');
    expect(new Date('2026-10-20T23:59:00-03:00').toISOString().slice(0, 10))
      .toBe('2026-10-21');
  });

  it('a madrugada tambem: 00h05 e hoje', () => {
    expect(proximosDias(1, new Date(2026, 9, 20, 0, 5))[0]).toBe('2026-10-20');
  });

  it('virada de mes', () => {
    expect(proximosDias(3, new Date(2026, 9, 31))).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('virada de ano', () => {
    expect(proximosDias(3, new Date(2026, 11, 31))).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('ano bissexto', () => {
    expect(proximosDias(2, new Date(2028, 1, 28))).toEqual(['2028-02-28', '2028-02-29']);
  });
});

describe('o teto de tres por dia, sob repeticao e concorrencia', () => {
  const seis = [
    arte('t1', 'Quem prova, sorri.'), arte('t2', 'Cafe fresquinho.'),
    arte('t3', 'O sabor que acompanha.'), arte('t4', 'Pausa merecida.'),
    arte('t5', 'Cafe de verdade.'), arte('t6', 'Para quem gosta de forte.'),
  ];
  const paraOcupado = (s: ReturnType<typeof montarSugestoes>['sugestoes']) =>
    s.map(x => ({ brand_id: x.brand_id, video_id: x.video_id, quando: x.quando }));

  it('uma rodada nunca passa de uma arte por janela', () => {
    const r = montarSugestoes(seis, JANELAS, [], [TERCA]);
    expect(r.sugestoes.length).toBeLessThanOrEqual(JANELAS.length);
    expect(new Set(r.sugestoes.map(s => s.quando)).size).toBe(r.sugestoes.length);
  });

  // O caso dele: gerou duas vezes e o dia ficou com cinco.
  it('TRES rodadas seguidas no mesmo dia nao acrescentam nada', () => {
    const um = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    const dois = montarSugestoes(seis, JANELAS, paraOcupado(um), [TERCA]).sugestoes;
    const tres = montarSugestoes(seis, JANELAS, paraOcupado([...um, ...dois]), [TERCA]).sugestoes;
    expect(dois).toHaveLength(0);
    expect(tres).toHaveLength(0);
    expect(um.length + dois.length + tres.length).toBeLessThanOrEqual(3);
  });

  // Duas abas abertas: as duas leem o banco ANTES de qualquer gravacao, e
  // por isso as duas enxergam o dia vazio. E a trava do banco que resolve
  // este caso — o codigo sozinho nao tem como. O teste registra o limite.
  it('duas execucoes SIMULTANEAS produzem o mesmo plano, nao dois planos', () => {
    const a = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    const b = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    expect(a.map(x => x.quando).sort()).toEqual(b.map(x => x.quando).sort());
    expect(a.map(x => x.video_id)).toEqual(b.map(x => x.video_id));
  });

  it('horario ja ocupado nao e reutilizado, mesmo com arte sobrando', () => {
    const ocupado = [{ brand_id: MARCA, video_id: 'outra', quando: `${TERCA}T08:00:00-03:00` }];
    const r = montarSugestoes(seis, JANELAS, ocupado, [TERCA]);
    expect(r.sugestoes.some(s => s.hora === '08:00')).toBe(false);
    expect(r.vazios.some(v => v.hora === '08:00')).toBe(false);   // cheio, nao vazio
  });

  it('o que sobra vai para o dia seguinte', () => {
    const um = montarSugestoes(seis, JANELAS, [], [TERCA]).sugestoes;
    const r = montarSugestoes(seis, JANELAS, paraOcupado(um), [TERCA, QUARTA]);
    expect(r.sugestoes.every(s => s.quando.startsWith(QUARTA))).toBe(true);
  });
});

describe('o que vence volta para a fila, sem atropelar ninguem', () => {
  const AGORA = new Date(2026, 9, 20, 21, 0);   // 20/10 as 21h, depois da ultima janela

  it('sugestao cuja hora passou e vencida', () => {
    const fila = [
      { quando: '2026-10-20T08:00:00-03:00', status: 'sugerida' },
      { quando: '2026-10-20T15:00:00-03:00', status: 'sugerida' },
      { quando: '2026-10-21T08:00:00-03:00', status: 'sugerida' },
    ];
    expect(vencidas(fila, AGORA)).toHaveLength(2);
  });

  // Aprovar ja criou campanha com data firmada. Nao e proposta, e compromisso.
  it('APROVADA nunca vence, mesmo com a hora passada', () => {
    const fila = [
      { quando: '2026-10-19T08:00:00-03:00', status: 'aprovada' },
      { quando: '2026-10-19T15:00:00-03:00', status: 'sugerida' },
    ];
    const v = vencidas(fila, AGORA);
    expect(v).toHaveLength(1);
    expect(v[0].status).toBe('sugerida');
  });

  it('depois da ultima janela, hoje nao recebe mais nada', () => {
    expect(aindaCabeHoje(JANELAS, new Date(2026, 9, 20, 21, 0))).toBe(false);
    expect(aindaCabeHoje(JANELAS, new Date(2026, 9, 20, 7, 0))).toBe(true);
    expect(aindaCabeHoje(JANELAS, new Date(2026, 9, 20, 18, 59))).toBe(true);
  });

  it('as 21h a programacao comeca AMANHA, nao hoje', () => {
    expect(diasParaProgramar(3, JANELAS, new Date(2026, 9, 20, 21, 0)))
      .toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
  });

  it('de manha a programacao comeca HOJE', () => {
    expect(diasParaProgramar(3, JANELAS, new Date(2026, 9, 20, 7, 0)))
      .toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('e a virada de mes continua certa mesmo pulando hoje', () => {
    expect(diasParaProgramar(2, JANELAS, new Date(2026, 9, 31, 22, 0)))
      .toEqual(['2026-11-01', '2026-11-02']);
  });

  // O caso exato que ele descreveu.
  it('a arte vencida vai para o proximo dia LIVRE, sem tirar ninguem do lugar', () => {
    const artes = [arte('v1', 'Quem prova, sorri.'), arte('v2', 'Cafe fresquinho.'),
                   arte('v3', 'O sabor que acompanha.')];
    // 21/10 ja esta cheio com outras artes.
    const cheio = JANELAS.map(j => ({
      brand_id: MARCA, video_id: 'ja-' + j.hora, quando: `2026-10-21T${j.hora}:00-03:00`,
    }));
    const r = montarSugestoes(artes, JANELAS, cheio, ['2026-10-21', '2026-10-22']);
    // nada caiu no 21, que estava cheio
    expect(r.sugestoes.some(s => s.quando.startsWith('2026-10-21'))).toBe(false);
    // e tudo foi para o 22, que estava livre
    expect(r.sugestoes.every(s => s.quando.startsWith('2026-10-22'))).toBe(true);
    expect(r.sugestoes.length).toBe(3);
  });
});
