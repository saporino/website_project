// Telefone brasileiro no checkout.
//
// O "+55" é fixo na tela, como fazem as lojas grandes: o cliente digita só DDD e
// número. Celular tem 9 dígitos e começa com 9; fixo tem 8. A diferença importa
// porque promoção por WhatsApp em telefone fixo não chega a lugar nenhum, e o
// consentimento só vale para celular.

export interface TelefoneBR {
  digitos: string;      // só números, sem o 55: DDD + número
  ddd: string | null;
  numero: string | null;
  celular: boolean;
  valido: boolean;
  e164: string | null;  // +55DDDNUMERO
}

/** Aceita no máximo 11 dígitos (DDD + celular de 9). */
export function somenteDigitos(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 11);
}

/** Formata para leitura enquanto digita: (11) 90000-0000 ou (11) 3000-0000. */
export function formatarTelefone(v: string): string {
  const d = somenteDigitos(v);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length >= 9 ? 5 : 4;      // celular quebra em 5, fixo em 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export function analisarTelefone(v: string): TelefoneBR {
  const d = somenteDigitos(v);
  const valido = d.length === 10 || d.length === 11;
  if (!valido) return { digitos: d, ddd: null, numero: null, celular: false, valido: false, e164: null };
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  const celular = numero.length === 9 && numero.startsWith('9');
  return { digitos: d, ddd, numero, celular, valido: true, e164: `+55${ddd}${numero}` };
}
