// HORÁRIO DE SÃO PAULO — a operação é no Brasil, então toda data que o usuário lê ou digita
// é horário de Brasília, não o fuso do aparelho.
//
// Por que isso importa: `new Date(valor)` e `toLocaleString()` usam o fuso do dispositivo.
// Agendar 14h no computador de São Paulo e abrir o painel num celular configurado em outro
// fuso mostrava outra hora — e, pior, agendar de um aparelho fora do fuso gravava a hora
// errada no banco. O banco continua guardando UTC (que é o certo); a conversão é aqui.

export const FUSO = 'America/Sao_Paulo';

/** Deslocamento de São Paulo em relação ao UTC, em minutos, naquele instante: -180 hoje.
 *  Calculado em vez de fixado, para o dia em que voltar o horário de verão. */
function offsetMinutos(d: Date): number {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map(p => [p.type, p.value]),
  ) as Record<string, string>;
  const comoSeFosseUtc = Date.UTC(
    +partes.year, +partes.month - 1, +partes.day,
    +partes.hour % 24, +partes.minute, +partes.second,
  );
  return (comoSeFosseUtc - d.getTime()) / 60000;
}

/** "5 de outubro, 16:40" — como a pessoa lê, sempre no horário de Brasília. */
export function quandoEmSP(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
  return `${dia}, ${hora}`;
}

/** "05/10/2026 16:40" — formato curto para tabela e lista. */
export function dataHoraEmSP(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
  return `${data} ${hora}`;
}

/** O que o usuário digitou num <input type="datetime-local"> é horário de São Paulo.
 *  Devolve o ISO em UTC para gravar no banco. */
export function isoDeSaoPaulo(valorDoInput: string): string {
  const [data, hora = '00:00'] = valorDoInput.split('T');
  const [ano, mes, dia] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const palpite = Date.UTC(ano, mes - 1, dia, h, min);
  // SP está 3h atrás, então o UTC correspondente é 3h À FRENTE: subtrai o offset negativo.
  // O offset é estável dentro do dia, então uma passada basta.
  return new Date(palpite - offsetMinutos(new Date(palpite)) * 60000).toISOString();
}

/** Caminho inverso: ISO do banco → "YYYY-MM-DDTHH:mm" para preencher o input já em
 *  horário de São Paulo. */
export function paraInputSP(iso: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(iso)).map(p => [p.type, p.value]),
  ) as Record<string, string>;
  const hora = String(+partes.hour % 24).padStart(2, '0');
  return `${partes.year}-${partes.month}-${partes.day}T${hora}:${partes.minute}`;
}

/** "em 20 min", "em 3h", "em 2 dias" — distância até a data, que não depende de fuso. */
export function faltamPara(iso: string): string {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (min <= 0) return 'a qualquer momento';
  if (min < 60) return `em ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `em ${h}h`;
  const d = Math.round(h / 24);
  return `em ${d} dia${d > 1 ? 's' : ''}`;
}
