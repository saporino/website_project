import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ALFABETO, emailDoConvite, emailValido, gerarCodigo, hashDoCodigo, montarCodigo } from './lvConvite.ts';
import { identidade } from './brandEmail.ts';

describe('código de convite do Coffee LiVRE', () => {
  it('formato LIVRE-XXXX-XXXX, sem caracteres ambíguos (0/O, 1/I/L)', () => {
    expect(montarCodigo(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBe('LIVRE-ABCD-EFGH');
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^LIVRE-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(ALFABETO).not.toMatch(/[01ILO]/);
  });
  it('hash igual ao do banco (sha256 de lower(trim)), então caixa e espaço não importam', async () => {
    const esperado = createHash('sha256').update('livre-abcd-efgh').digest('hex');
    expect(await hashDoCodigo('  LIVRE-ABCD-EFGH ')).toBe(esperado);
  });
  it('e-mail válido', () => {
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido('sem-arroba')).toBe(false);
  });
  it('e-mail do convite sai com a marca da COFICO, o código, a validade e o nome escapado', () => {
    const m = emailDoConvite(identidade('CO'), { nome: '<b>Maria</b>', codigo: 'LIVRE-ABCD-EFGH', link: 'https://www.coficobrasil.com.br/coffeelivre', expiraEm: '2026-09-26T12:00:00Z', reenvio: false });
    expect(m.assunto).toBe('Seu convite para o Coffee LiVRE');
    expect(m.html).toContain('COFICO BRASIL');
    expect(m.html).toContain('LIVRE-ABCD-EFGH');
    expect(m.html).toContain('26/09/2026');
    expect(m.html).not.toContain('<b>Maria</b>');
    expect(emailDoConvite(identidade('CO'), { nome: 'M', codigo: 'X', link: 'l', expiraEm: '2026-09-26T12:00:00Z', reenvio: true }).assunto).toBe('Seu novo código do Coffee LiVRE');
  });
});
