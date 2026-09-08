// Como o estoque é lido por quem opera.
//
// O sistema conta PACOTES, que é a menor unidade vendável e a que sai do lote.
// Mas o café chega e é guardado em fardos de 10, e quem confere a prateleira
// conta fardos. "1.499 pacotes" não ajuda ninguém no galpão; "149 fardos e
// 9 pacotes" é o que a pessoa vê na mão.
//
// Os dois números são o mesmo café: 149 × 10 + 9 = 1.499.

export const PACOTES_POR_FARDO = 10;

export type EstoqueEmFardos = {
  fardos: number;
  pacotes: number;
  total: number;
};

export function emFardos(totalPacotes: number, porFardo = PACOTES_POR_FARDO): EstoqueEmFardos {
  const total = Math.max(0, Math.floor(Number(totalPacotes) || 0));
  return {
    fardos: Math.floor(total / porFardo),
    pacotes: total % porFardo,
    total,
  };
}

/** "149 fardos e 9 pacotes" · "8 pacotes" · "20 fardos" · "esgotado" */
export function textoEmFardos(totalPacotes: number, porFardo = PACOTES_POR_FARDO): string {
  const { fardos, pacotes } = emFardos(totalPacotes, porFardo);
  const partes: string[] = [];
  if (fardos > 0) partes.push(`${fardos} ${fardos === 1 ? 'fardo' : 'fardos'}`);
  if (pacotes > 0) partes.push(`${pacotes} ${pacotes === 1 ? 'pacote' : 'pacotes'}`);
  return partes.length ? partes.join(' e ') : 'esgotado';
}
