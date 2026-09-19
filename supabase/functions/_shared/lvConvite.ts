// Coffee LiVRE — peças puras do convite (código, hash, e-mail). Testáveis sem banco.
import { esc, moldura, nota, p, type Identidade } from './brandEmail.ts';

export const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // sem 0/O, 1/I/L
export const VALIDADES_DIAS = [1, 7] as const;

/** LIVRE-XXXX-XXXX a partir de 8 bytes aleatórios. */
export function montarCodigo(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return `LIVRE-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function gerarCodigo(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return montarCodigo(b);
}

/** Igual a public.lv_normalizar_codigo: sha256 hex de lower(trim(código)). */
export async function hashDoCodigo(codigo: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo.trim().toLowerCase()));
  return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export function emailValido(e: unknown): e is string {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export function emailDoConvite(id: Identidade, dados: { nome: string; codigo: string; link: string; expiraEm: string; reenvio: boolean }) {
  const validade = new Date(dados.expiraEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const corpo = [
    p(`Olá, ${esc(dados.nome)}.`),
    p(dados.reenvio
      ? 'Aqui está o seu <b>novo código</b> de convite para o Coffee LiVRE, o marketplace do café. O código anterior deixou de valer.'
      : 'Você foi convidado para conhecer o <b>Coffee LiVRE</b>, o marketplace do café da COFICO, ainda em fase de apresentação.'),
    `<div style="margin:22px 0 8px;font-size:26px;font-weight:700;letter-spacing:3px;color:${id.cor};font-family:Consolas,Menlo,monospace">${esc(dados.codigo)}</div>`,
    p(`Digite o código no site, preencha seu cadastro e crie sua senha. Ele vale até <b>${validade}</b> e pode ser usado <b>uma única vez</b>: depois do cadastro você entra com seu e-mail e senha.`),
    nota('Este convite é pessoal. Se você não esperava este e-mail, pode ignorá-lo.'),
  ].join('');
  return {
    assunto: dados.reenvio ? 'Seu novo código do Coffee LiVRE' : 'Seu convite para o Coffee LiVRE',
    html: moldura(id, dados.reenvio ? 'Novo código de convite' : 'Seu convite para o Coffee LiVRE', corpo, { texto: 'Abrir o Coffee LiVRE', link: dados.link }),
  };
}
