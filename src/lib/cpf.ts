// CPF: máscara e validação.
//
// Validar no navegador não é segurança — é cortesia. O objetivo é o cliente
// descobrir o erro de digitação na hora, e não depois, quando a nota fiscal
// for recusada e alguém tiver que ligar para ele.

export const somenteDigitos = (v: string) => (v || '').replace(/\D/g, '');

/** 000.000.000-00, formatando enquanto se digita. */
export function formatarCPF(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Confere os dois dígitos verificadores.
 * Pega erro de digitação, que é o caso comum. Não diz se o CPF existe de
 * verdade nem se é da pessoa — para isso só a Receita.
 */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return false;
  // 11111111111 e afins passam na conta dos dígitos, mas não são CPF.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}
