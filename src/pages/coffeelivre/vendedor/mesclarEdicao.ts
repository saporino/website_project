// Mescla em três vias entre o formulário e o banco.
//
// Uma ação rápida (aplicar o preço recomendado, desfazer uma troca) grava no
// banco enquanto o vendedor pode estar editando outro campo sem salvar. Recarregar
// o formulário inteiro apagaria esse trabalho. A regra é:
//
//   - campo que o vendedor NÃO mexeu (local igual à base) recebe o valor do banco;
//   - campo que o vendedor mexeu fica como está;
//   - campo em `forcar` (o que a ação rápida alterou de propósito) recebe o valor do
//     banco mesmo se estava editado, e isso volta como `substituidos` para a tela
//     avisar — nunca some em silêncio.
//
// A base passa a ser o que veio do banco, então o que continua diferente dela
// segue marcado como não salvo.

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ResultadoDaMescla<T> {
  campos: T;
  /** Campos editados e não salvos que foram mantidos. */
  preservados: (keyof T)[];
  /** Campos editados que a ação rápida substituiu de propósito. */
  substituidos: (keyof T)[];
}

export function mesclarComBanco<T extends Record<string, unknown>>(
  local: T, base: T, banco: T, forcar: (keyof T)[] = [],
): ResultadoDaMescla<T> {
  const campos = { ...local };
  const preservados: (keyof T)[] = [];
  const substituidos: (keyof T)[] = [];
  for (const chave of Object.keys(banco) as (keyof T)[]) {
    const editado = !igual(local[chave], base[chave]);
    if (!editado) {
      campos[chave] = banco[chave];
    } else if (forcar.includes(chave)) {
      if (!igual(local[chave], banco[chave])) substituidos.push(chave);
      campos[chave] = banco[chave];
    } else {
      preservados.push(chave);
    }
  }
  return { campos, preservados, substituidos };
}

export function camposAlterados<T extends Record<string, unknown>>(local: T, base: T): (keyof T)[] {
  return (Object.keys(base) as (keyof T)[]).filter(k => !igual(local[k], base[k]));
}
