// Dinheiro digitado pelo vendedor.
//
// O vendedor escreve "23,90", "23.90" ou "1.234,56". O banco guarda
// centavos inteiros. A conversão NÃO passa por ponto flutuante: 23,90 * 100
// em float pode virar 2389,9999 e perder um centavo. Aqui a parte inteira e
// a fracionária são lidas separadas e somadas como inteiros.

/** Lê um número com até duas casas e devolve em centésimos, ou null. */
function centesimos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$|%/g, '');
  if (!limpo) return null;
  // Com vírgula, ela é o decimal e os pontos são milhar ("1.234,56").
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^\d+(\.\d{0,2})?$/.test(normal)) return null;
  const [inteiro, fracao = ''] = normal.split('.');
  return Number(inteiro) * 100 + Number((fracao + '00').slice(0, 2));
}

/** "23,90" -> 2390 */
export const paraCentavos = (texto: string): number | null => centesimos(texto);

/** 2390 -> "23,90". Vazio quando não há valor, para o campo abrir limpo. */
export function deCentavos(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

/** "2,5" (%) -> 250 pontos-base. Limitado a 100%. */
export function paraBps(texto: string): number | null {
  const v = centesimos(texto);
  return v == null ? null : Math.min(v, 10000);
}

/** 250 -> "2,5" */
export function deBps(bps: number | null | undefined): string {
  if (bps == null) return '';
  const inteiro = Math.floor(bps / 100);
  const fracao = bps % 100;
  if (!fracao) return String(inteiro);
  return `${inteiro},${String(fracao).padStart(2, '0').replace(/0$/, '')}`;
}
