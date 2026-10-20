// Agendador inteligente — a lógica, separada de banco e de tela.
//
// Duas perguntas, duas funções puras:
//   1. `classificar(texto)` — o que esta arte diz sobre QUANDO ela deve sair?
//   2. `montarSugestoes(...)` — dadas as artes e as janelas, o que vai em cada horário?
//
// Puras de propósito: é aqui que mora a chance de agendar "Boa noite" às 8h da
// manhã, e teste de função pura pega isso antes de existir tela.
//
// REGRA QUE ATRAVESSA TUDO: na dúvida, não agenda. Deixar um horário vazio é
// barato; publicar a peça errada no dia errado é caro, e com conta de cliente
// no sistema é caro em cima do nome de outra pessoa.

export type Periodo = 'manha' | 'tarde' | 'noite';
export type DiaSemana = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado';
export type Temporalidade = 'perene' | 'dia_fixo' | 'sazonal' | 'campanha';

export interface Agendamento {
  /** Dia em que a arte PRECISA sair. Nulo = qualquer dia. */
  dia_da_semana: DiaSemana | null;
  /** Período em que a arte PRECISA sair. Nulo = qualquer horário. */
  periodo: Periodo | null;
  temporalidade: Temporalidade;
  /** Assunto, para não repetir o mesmo dois dias seguidos. */
  tema: string;
  /** Data específica (ex.: Dia do Café), quando houver. */
  data_especifica: string | null;
  /** 0 a 1. Abaixo de LIMITE_REVISAO, vai para revisão em vez de agendar. */
  confianca: number;
  /** Em português, para o Vlademir conferir se a IA entendeu certo. */
  justificativa: string;
}

/** Abaixo disto a arte não entra no calendário sozinha — vai para revisão. */
/**
 * O balde onde cai a peça sem assunto reconhecido.
 *
 * NÃO é um tema: é a ausência de um. A trava de repetição precisa saber a
 * diferença, senão uma arte genérica barra todas as outras genéricas.
 */
export const SEM_TEMA = 'generico';

export const LIMITE_REVISAO = 0.6;

// ---------------------------------------------------------------------
// 1. Classificar: o que a arte diz sobre quando sair
// ---------------------------------------------------------------------

const DIAS: { dia: DiaSemana; padroes: RegExp[] }[] = [
  { dia: 'domingo', padroes: [/\bdomingo\b/i] },
  { dia: 'segunda', padroes: [/\bsegunda[- ]?feira\b/i, /\bsegundou\b/i, /\bsegunda\b/i] },
  { dia: 'terca',   padroes: [/\bter[çc]a[- ]?feira\b/i, /\bter[çc]a(?![a-zA-ZÀ-ú])/i] },
  { dia: 'quarta',  padroes: [/\bquarta[- ]?feira\b/i, /\bquarta\b/i] },
  { dia: 'quinta',  padroes: [/\bquinta[- ]?feira\b/i, /\bquinta\b/i] },
  { dia: 'sexta',   padroes: [/\bsexta[- ]?feira\b/i, /\bsextou\b/i, /\bsexta\b/i] },
  { dia: 'sabado',  padroes: [/\bs[áa]bado(?![a-zA-ZÀ-ú])/i, /\bsabadou\b/i] },
];

const PERIODOS: { periodo: Periodo; tema: string; padroes: RegExp[] }[] = [
  { periodo: 'manha', tema: 'bom_dia',   padroes: [/\bbom\s*dia\b/i, /\bcaf[ée]\s+da\s+manh[ãa]\b/i, /\bacordar\b/i, /\bcomece\s+(o|seu|sua)\b/i, /\bprimeiro\s+caf[ée]\b/i] },
  { periodo: 'tarde', tema: 'boa_tarde', padroes: [/\bboa\s*tarde\b/i, /\bcaf[ée]\s+da\s+tarde\b/i, /\blanche\s+da\s+tarde\b/i] },
  { periodo: 'noite', tema: 'boa_noite', padroes: [/\bboa\s*noite\b/i, /\bfim\s+do\s+dia\b/i, /\bantes\s+de\s+dormir\b/i, /\bdescansar\b/i] },
];

const TEMAS: { tema: string; padroes: RegExp[] }[] = [
  { tema: 'receita',       padroes: [/\breceita\b/i, /\bmodo\s+de\s+preparo\b/i, /\bingredientes?\b/i, /\bpasso\s+a\s+passo\b/i] },
  { tema: 'promocao',      padroes: [/\bpromo[çc][ãa]o(?![a-zA-ZÀ-ú])/i, /\bdesconto\b/i, /\boferta\b/i, /\bleve\s+\d/i, /\bR\$\s*\d/i] },
  { tema: 'produto',       padroes: [/\b500\s*g\b/i, /\btorra\b/i, /\bmo[íi]do(?![a-zA-ZÀ-ú])/i, /\bem\s+gr[ãa]os?(?![a-zA-ZÀ-ú])/i, /\bpacote\b/i, /\bfardo\b/i] },
  { tema: 'institucional', padroes: [/\bnossa\s+hist[óo]ria\b/i, /\bquem\s+somos\b/i, /\bnossa\s+miss[ãa]o\b/i] },
  { tema: 'data_comemorativa', padroes: [/\bdia\s+d[aeo]s?\s+\w+/i, /\bnatal\b/i, /\bp[áa]scoa(?![a-zA-ZÀ-ú])/i, /\bano\s+novo\b/i, /\bdia\s+das\s+m[ãa]es(?![a-zA-ZÀ-ú])/i, /\bdia\s+dos\s+pais\b/i] },
];

/**
 * Datas comemorativas com dia fixo — a arte só vale naquele dia.
 *
 * ⚠️ Sem `\b` depois de palavra acentuada: em JavaScript `\b` olha para
 * [A-Za-z0-9_], e `é` não é "letra" para ele. `caf[ée]\b` NUNCA casa com
 * "café", porque depois do `é` já não há fronteira a encontrar. O teste do
 * Dia do Café pegou isso.
 */
const COMEMORATIVAS: { padrao: RegExp; mesDia: string }[] = [
  { padrao: /\bdia\s+(mundial\s+)?do\s+caf[ée]/i, mesDia: '05-24' },
  { padrao: /\bnatal\b/i,                          mesDia: '12-25' },
  { padrao: /\bano\s+novo\b/i,                     mesDia: '01-01' },
];

const SAZONAIS = [/\bnatal\b/i, /\bp[áa]scoa(?![a-zA-ZÀ-ú])/i, /\bano\s+novo\b/i, /\bfestas?\s+junina/i, /\binverno\b/i, /\bver[ãa]o(?![a-zA-ZÀ-ú])/i];

/**
 * Lê o que a análise da IA já extraiu e devolve quando a arte deve sair.
 *
 * Recebe TEXTO, não imagem: a análise que já roda no Studio guarda o texto da
 * arte em `competitor_text`, o resumo em `resumo` e o copy em
 * `analise_visual.copywriting`. Aproveitar isso é o que permite classificar as
 * 49 artes antigas sem gastar uma única chamada de IA nova.
 */
export function classificar(entrada: {
  textoDaArte?: string | null;
  resumo?: string | null;
  copywriting?: string | null;
}): Agendamento {
  // O texto da arte pesa mais que o resumo: "Boa terça" escrito na peça é
  // ordem; "a peça passa clima de terça" no resumo é interpretação.
  const daArte = (entrada.textoDaArte ?? '').trim();
  const resto = [entrada.resumo, entrada.copywriting].filter(Boolean).join(' \n ');
  const tudo = `${daArte} \n ${resto}`;

  const razoes: string[] = [];
  let confianca = 0.5;

  // --- dia da semana ---
  let dia: DiaSemana | null = null;
  for (const d of DIAS) {
    if (d.padroes.some(p => p.test(daArte))) {
      dia = d.dia;
      confianca = 0.95;
      razoes.push(`a arte diz "${d.dia}"`);
      break;
    }
  }
  if (!dia) {
    for (const d of DIAS) {
      if (d.padroes.some(p => p.test(resto))) {
        dia = d.dia;
        confianca = 0.7;   // veio do resumo, não da peça: menos certeza
        razoes.push(`o resumo menciona ${d.dia}`);
        break;
      }
    }
  }

  // --- período ---
  let periodo: Periodo | null = null;
  let temaPeriodo: string | null = null;
  for (const p of PERIODOS) {
    if (p.padroes.some(r => r.test(daArte))) {
      periodo = p.periodo; temaPeriodo = p.tema;
      confianca = Math.max(confianca, 0.95);
      razoes.push(`a arte traz mensagem de ${p.tema.replace('_', ' ')}`);
      break;
    }
  }
  if (!periodo) {
    for (const p of PERIODOS) {
      if (p.padroes.some(r => r.test(resto))) {
        periodo = p.periodo; temaPeriodo = p.tema;
        confianca = Math.max(confianca, 0.7);
        razoes.push(`o conteúdo sugere ${p.periodo}`);
        break;
      }
    }
  }

  // --- tema ---
  let tema = temaPeriodo ?? SEM_TEMA;
  if (!temaPeriodo) {
    for (const t of TEMAS) {
      if (t.padroes.some(r => r.test(tudo))) { tema = t.tema; break; }
    }
  }

  // --- data específica e temporalidade ---
  let data_especifica: string | null = null;
  for (const c of COMEMORATIVAS) {
    if (c.padrao.test(tudo)) { data_especifica = c.mesDia; break; }
  }

  let temporalidade: Temporalidade = 'perene';
  if (data_especifica) { temporalidade = 'sazonal'; confianca = Math.max(confianca, 0.9); }
  else if (dia) temporalidade = 'dia_fixo';
  else if (SAZONAIS.some(r => r.test(tudo))) temporalidade = 'sazonal';

  // Sem texto nenhum para ler, não há o que afirmar. Arte muda, sem referência
  // temporal, é perene de verdade — e isso é uma conclusão, não um chute.
  if (!daArte && !resto) {
    return {
      dia_da_semana: null, periodo: null, temporalidade: 'perene', tema: SEM_TEMA,
      data_especifica: null, confianca: 0.3,
      justificativa: 'Não há texto analisado para esta arte. Precisa de revisão.',
    };
  }
  if (!dia && !periodo && !data_especifica) {
    confianca = 0.8;
    razoes.push('não há referência a dia nem a horário');
  }

  return {
    dia_da_semana: dia,
    periodo,
    temporalidade,
    tema,
    data_especifica,
    confianca: Math.min(confianca, 1),
    justificativa: razoes.length
      ? razoes.join('; ').replace(/^./, c => c.toUpperCase()) + '.'
      : 'Sem referência temporal identificada; pode sair em qualquer dia.',
  };
}

// ---------------------------------------------------------------------
// 2. Montar as sugestões
// ---------------------------------------------------------------------

export interface Arte {
  id: string;
  brand_id: string;
  titulo: string;
  agendamento: Agendamento;
  /** Já foi publicada antes? Entra na regra de reuso. */
  publicada_em?: string | null;
}

export interface Janela {
  brand_id: string;
  /** 0 = domingo … 6 = sábado. Nulo = todo dia. */
  dia_semana: number | null;
  /** 'HH:MM' no fuso de São Paulo. */
  hora: string;
  periodo: Periodo;
  plataforma: string;
  ativa: boolean;
}

export interface JaAgendado {
  brand_id: string;
  video_id: string;
  quando: string;   // ISO
  /** Opcional de propósito: nem todo agendamento guarda o assunto, e inventar
   *  um (o período, por exemplo) faz a trava de repetição bloquear por engano. */
  tema?: string | null;
}

export interface Sugestao {
  brand_id: string;
  video_id: string;
  titulo: string;
  quando: string;        // ISO, no fuso de São Paulo
  hora: string;
  periodo: Periodo;
  plataforma: string;
  motivo: string;
  confianca: number;
}

export interface Vazio {
  brand_id: string;
  quando: string;
  hora: string;
  periodo: Periodo;
  motivo: string;
}

const NOME_DIA: DiaSemana[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

/**
 * Dia da semana de uma data, no fuso de São Paulo.
 *
 * ⚠️ ARMADILHA QUE CUSTOU UM DIA INTEIRO DE AGENDA:
 * `new Date('2026-10-13')` é lido como meia-noite **UTC**, e em São Paulo isso
 * ainda é 21h do dia 12. A função devolvia "segunda" para uma terça, e todo o
 * calendário sairia um dia deslocado. O teste pegou; a tela não pegaria.
 *
 * Por isso: data só com dia é montada pelos componentes, em horário local,
 * nunca pelo construtor que assume UTC.
 */
export function diaDaSemanaEm(iso: string): DiaSemana {
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (soData && iso.length <= 10) {
    const [, a, m, d] = soData;
    return NOME_DIA[new Date(Number(a), Number(m) - 1, Number(d)).getDay()];
  }
  const d = new Date(iso);
  const saoPaulo = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return NOME_DIA[saoPaulo.getDay()];
}

/** Dias desde uma data, ou Infinity quando nunca aconteceu. */
function diasDesde(iso: string | null | undefined, referencia: Date): number {
  if (!iso) return Infinity;
  return (referencia.getTime() - new Date(iso).getTime()) / 86400000;
}

export interface OpcoesSugestao {
  /** Quantos dias uma arte publicada precisa esperar para voltar. 0 = nunca repete. */
  diasParaReusar?: number;
  /** Não repetir o mesmo tema dentro de quantos dias. */
  diasEntreMesmoTema?: number;
}

/**
 * Para cada janela do período, escolhe a arte mais adequada — ou deixa vazio.
 *
 * Os três filtros, nesta ordem:
 *   1. impossível  — dia e período que a arte EXIGE;
 *   2. repetido    — mesma arte, ou mesmo tema perto demais;
 *   3. preferência — a que está esperando há mais tempo.
 *
 * Quando nada sobra, o horário fica VAZIO e com motivo. Preencher por preencher
 * é exatamente o que o Vlademir pediu para não acontecer.
 */
/**
 * Os próximos N dias, a partir de HOJE, no fuso de quem opera.
 *
 * Estava dentro do componente, onde nenhum teste alcançava — e foi por isso
 * que a pergunta "a agenda está gerando para ontem?" não tinha como ser
 * respondida por teste. Aqui ela tem.
 *
 * ⚠️ Usa getFullYear/getMonth/getDate, nunca toISOString(). No Brasil
 * (UTC-3), `new Date().toISOString().slice(0,10)` devolve o dia SEGUINTE
 * depois das 21h — a conta que produz agenda no dia errado. Somar ao
 * `getDate()` resolve virada de mês e de ano sozinho: 31+1 vira dia 1 do mês
 * seguinte, e 31/12+1 vira 1/1 do ano seguinte, por conta do próprio Date.
 */
export function proximosDias(n: number, hoje: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  });
}

/**
 * O que venceu: sugestão cuja hora já passou e que ninguém aprovou.
 *
 * ================== POR QUE ISTO EXISTE ==================
 *
 * Ele perguntou: "se está lá para ser publicada hoje, e não foi, encaixa na
 * próxima, mas não no que já está agendado para amanhã — joga pra frente".
 *
 * Antes, a sugestão vencida ficava parada no dia que passou, ocupando a arte
 * e sujando a tela. Foi o que ele viu: o dia 19 ainda na agenda no dia 20.
 *
 * ================== A REGRA ==================
 *
 * A data NÃO é empurrada. Empurrar um dia jogaria "Comece sua terça-feira"
 * na quarta, e um "bom dia" às 19h — que é o erro que o agendador inteiro
 * existe para evitar.
 *
 * O que volta para a fila é a ARTE. Na próxima montagem ela disputa os
 * horários livres como qualquer outra, respeitando dia e período que a peça
 * exige. Nada que já está agendado perde o lugar: janela ocupada continua
 * ocupada, e a arte vencida vai para a PRÓXIMA livre.
 *
 * ================== O QUE NUNCA VENCE ==================
 *
 * Sugestão APROVADA. Aprovar já criou campanha, com data firmada — isso é
 * compromisso, não proposta, e mexer nele sem pedir seria decidir no lugar
 * dele.
 */
export function vencidas<T extends { quando: string; status?: string | null }>(
  fila: T[],
  agora: Date = new Date(),
): T[] {
  return fila.filter(s => {
    if (s.status && s.status !== 'sugerida') return false;   // aprovada não vence
    const t = new Date(s.quando).getTime();
    return Number.isFinite(t) && t < agora.getTime();
  });
}

/**
 * Faz sentido ainda sugerir para HOJE?
 *
 * Depois da última janela do dia, não: a sugestão nasceria vencida. É o
 * defeito ao contrário — em vez de encontrar o passado na tela, ele
 * encontraria uma proposta impossível de cumprir.
 */
export function aindaCabeHoje(janelas: Janela[], agora: Date = new Date()): boolean {
  const ativas = janelas.filter(j => j.ativa);
  if (!ativas.length) return false;
  const horas = ativas.map(j => j.hora).sort();
  const ultima = horas[horas.length - 1];
  const [h, m] = ultima.split(':').map(Number);
  const limite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m);
  return agora.getTime() < limite.getTime();
}

/**
 * Os dias a programar, pulando hoje quando o dia já acabou.
 *
 * Usa `proximosDias`, que é quem sabe virar mês e ano.
 */
export function diasParaProgramar(
  n: number,
  janelas: Janela[],
  agora: Date = new Date(),
): string[] {
  const dias = proximosDias(n + 1, agora);
  return aindaCabeHoje(janelas, agora) ? dias.slice(0, n) : dias.slice(1, n + 1);
}

export function montarSugestoes(
  artes: Arte[],
  janelas: Janela[],
  jaAgendado: JaAgendado[],
  periodoDias: string[],          // datas ISO (uma por dia) a programar
  opcoes: OpcoesSugestao = {},
): { sugestoes: Sugestao[]; vazios: Vazio[] } {
  const diasParaReusar = opcoes.diasParaReusar ?? 90;
  const diasEntreMesmoTema = opcoes.diasEntreMesmoTema ?? 2;

  const sugestoes: Sugestao[] = [];
  const vazios: Vazio[] = [];
  // O que já está no calendário conta como ocupado — inclusive o que esta mesma
  // rodada acabou de sugerir, senão a mesma arte cairia em dois horários.
  const ocupado: JaAgendado[] = [...jaAgendado];
  const usadasAgora = new Set<string>();

  for (const diaISO of periodoDias) {
    const dia = diaDaSemanaEm(diaISO);
    const indiceDia = NOME_DIA.indexOf(dia);

    const janelasDoDia = janelas
      .filter(j => j.ativa && (j.dia_semana === null || j.dia_semana === indiceDia))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    for (const janela of janelasDoDia) {
      // ⚠️ O FUSO VAI EXPLÍCITO, e isso não é detalhe.
      // Sem o `-03:00`, o Postgres (timestamptz) lê "08:00" como UTC e grava
      // 08:00Z — que em São Paulo é 05h da manhã. Verificado no banco: o
      // primeiro agendamento de teste saiu três horas cedo. O Brasil não tem
      // mais horário de verão desde 2019, então -03:00 vale o ano inteiro.
      const quando = `${diaISO.slice(0, 10)}T${janela.hora}:00-03:00`;
      const referencia = new Date(quando);

      // ⚠️ JANELA JÁ OCUPADA NÃO RECEBE OUTRA ARTE.
      //
      // Sem isto, clicar "Gerar sugestões" duas vezes empilhava: o dia 19
      // ficou com duas peças às 08:00, duas às 15:00 — e ainda acusava falta
      // às 19:00. Cada rodada só enxergava o que estava APROVADO e ignorava o
      // que já tinha sido proposto.
      //
      // Horário cheio também não entra na lista de vazios: ele não está vazio,
      // está decidido.
      const jaTemNesteHorario = ocupado.some(o =>
        o.brand_id === janela.brand_id &&
        Math.abs(new Date(o.quando).getTime() - referencia.getTime()) < 60_000);
      if (jaTemNesteHorario) continue;

      const candidatas = artes.filter(a => {
        // marca — uma arte NUNCA sai na conta de outra marca
        if (a.brand_id !== janela.brand_id) return false;
        // já escolhida nesta rodada
        if (usadasAgora.has(a.id)) return false;
        // confiança baixa não entra sozinha: vai para revisão
        if (a.agendamento.confianca < LIMITE_REVISAO) return false;

        // 1. o impossível
        if (a.agendamento.dia_da_semana && a.agendamento.dia_da_semana !== dia) return false;
        if (a.agendamento.periodo && a.agendamento.periodo !== janela.periodo) return false;
        if (a.agendamento.data_especifica) {
          const mesDia = diaISO.slice(5, 10);
          if (a.agendamento.data_especifica !== mesDia) return false;
        }

        // 2. o repetido
        if (diasParaReusar === 0 && a.publicada_em) return false;
        if (diasDesde(a.publicada_em, referencia) < diasParaReusar) return false;
        const jaNoCalendario = ocupado.some(o => o.video_id === a.id && o.brand_id === a.brand_id);
        if (jaNoCalendario) return false;
        // ⚠️ "GENÉRICO" NÃO É UM TEMA — É A AUSÊNCIA DE UM.
        //
        // A trava de repetição existe para não sair dois "bom dia" no mesmo
        // dia. Mas toda peça sem assunto reconhecido cai no balde `generico`,
        // e comparar balde com balde dava "mesmo tema": a PRIMEIRA arte
        // genérica a entrar barrava TODAS as outras por dois dias.
        //
        // Era isto que ele via na tela: dezoito artes disponíveis, a agenda
        // colocava uma e escrevia "nenhuma arte adequada" nos outros horários.
        // O relatório de falta estava mentindo, e mandando gerar arte nova que
        // não era necessária.
        //
        // Duas peças sem tema são duas peças diferentes. Comparar só quando há
        // assunto de verdade dos dois lados.
        const temaReal = (t?: string | null) => (t && t !== SEM_TEMA ? t : null);
        const meuTema = temaReal(a.agendamento.tema);
        const temaPerto = !!meuTema && ocupado.some(o =>
          o.brand_id === a.brand_id &&
          temaReal(o.tema) === meuTema &&
          Math.abs(diasDesde(o.quando, referencia)) < diasEntreMesmoTema);
        if (temaPerto) return false;

        return true;
      });

      if (candidatas.length === 0) {
        vazios.push({
          brand_id: janela.brand_id, quando, hora: janela.hora, periodo: janela.periodo,
          motivo: 'Nenhuma arte adequada para este dia e horário.',
        });
        continue;
      }

      // 3. preferência: a mais específica primeiro (quem exige dia e período tem
      // menos chances de encaixe), depois a que espera há mais tempo.
      candidatas.sort((a, b) => {
        const esp = (x: Arte) => (x.agendamento.dia_da_semana ? 2 : 0) + (x.agendamento.periodo ? 1 : 0);
        const d = esp(b) - esp(a);
        if (d !== 0) return d;
        return diasDesde(b.publicada_em, referencia) - diasDesde(a.publicada_em, referencia);
      });

      const escolhida = candidatas[0];
      usadasAgora.add(escolhida.id);
      ocupado.push({
        brand_id: escolhida.brand_id, video_id: escolhida.id,
        quando, tema: escolhida.agendamento.tema,
      });

      sugestoes.push({
        brand_id: janela.brand_id,
        video_id: escolhida.id,
        titulo: escolhida.titulo,
        quando, hora: janela.hora, periodo: janela.periodo,
        plataforma: janela.plataforma,
        motivo: explicar(escolhida, dia, janela),
        confianca: escolhida.agendamento.confianca,
      });
    }
  }

  return { sugestoes, vazios };
}

const DIA_POR_EXTENSO: Record<DiaSemana, string> = {
  domingo: 'domingo', segunda: 'segunda-feira', terca: 'terça-feira', quarta: 'quarta-feira',
  quinta: 'quinta-feira', sexta: 'sexta-feira', sabado: 'sábado',
};

/** A frase que o Vlademir lê para conferir se faz sentido. */
export function explicar(arte: Arte, dia: DiaSemana, janela: Janela): string {
  const partes: string[] = [];
  if (arte.agendamento.dia_da_semana) partes.push(`a arte é de ${DIA_POR_EXTENSO[arte.agendamento.dia_da_semana]}`);
  if (arte.agendamento.periodo) partes.push(`o conteúdo pede ${arte.agendamento.periodo}`);
  if (arte.agendamento.data_especifica) partes.push('é de data comemorativa');
  if (partes.length === 0) partes.push('não tem referência a dia nem horário, então cabe em qualquer janela livre');
  return `Sugerida para ${DIA_POR_EXTENSO[dia]} às ${janela.hora} porque ${partes.join(' e ')}.`;
}

// ---------------------------------------------------------------------
// 3. Assinatura da aprovação
// ---------------------------------------------------------------------

/**
 * O que foi aprovado, exatamente.
 *
 * Se a arte, a legenda, a marca, a plataforma ou o horário mudarem depois do
 * "aprovado", a assinatura muda e o sistema exige aprovação nova. Sem isto,
 * trocar a legenda de um post aprovado publicaria algo que ninguém leu.
 */
export function assinatura(p: {
  video_id: string; legenda: string; brand_id: string; plataforma: string; quando: string;
}): string {
  return [p.video_id, p.brand_id, p.plataforma, p.quando, (p.legenda ?? '').trim()].join('|');
}
