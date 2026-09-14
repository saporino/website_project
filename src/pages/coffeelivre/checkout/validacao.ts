// Coffee LiVRE — validação dos dados do checkout.
//
// O banco valida de novo (lv_checkout_confirmar). Aqui é para a pessoa saber o
// que corrigir antes de apertar o botão, campo por campo, sem pedir o que não
// é necessário: CPF é opcional nesta fase (sem nota fiscal ainda).

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

export const somenteDigitos = (s: string) => s.replace(/\D/g, '');

export function formatarCep(s: string): string {
  const d = somenteDigitos(s).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cepValido(s: string): boolean {
  return /^\d{8}$/.test(somenteDigitos(s));
}

/** Dígitos verificadores do CPF. Vazio é válido (campo opcional). */
export function cpfValido(s: string): boolean {
  const d = somenteDigitos(s);
  if (d.length === 0) return true;
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, fator: number) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * (fator - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export interface Endereco {
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
}

export interface Comprador {
  nome: string;
  telefone: string;
  cpf: string;
}

export type ErrosDe<T> = Partial<Record<keyof T, string>>;

export function validarEndereco(e: Endereco): ErrosDe<Endereco> {
  const erros: ErrosDe<Endereco> = {};
  if (!cepValido(e.cep)) erros.cep = 'CEP com 8 números.';
  if (e.logradouro.trim().length < 3) erros.logradouro = 'Informe a rua.';
  if (!e.numero.trim()) erros.numero = 'Informe o número (ou S/N).';
  if (e.bairro.trim().length < 2) erros.bairro = 'Informe o bairro.';
  if (e.cidade.trim().length < 2) erros.cidade = 'Informe a cidade.';
  if (!(UFS as readonly string[]).includes(e.uf.trim().toUpperCase())) erros.uf = 'Escolha a UF.';
  return erros;
}

export function validarComprador(c: Comprador): ErrosDe<Comprador> {
  const erros: ErrosDe<Comprador> = {};
  if (c.nome.trim().length < 3) erros.nome = 'Informe seu nome completo.';
  const tel = somenteDigitos(c.telefone);
  if (tel && (tel.length < 10 || tel.length > 11)) erros.telefone = 'Telefone com DDD.';
  if (!cpfValido(c.cpf)) erros.cpf = 'CPF inválido.';
  return erros;
}

export const semErros = (e: object) => Object.keys(e).length === 0;
