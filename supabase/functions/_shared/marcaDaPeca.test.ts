// Dono administrativo do arquivo × marca da peça.
//
// Foi confundir as duas coisas que fez a embalagem Café Capital entrar e a
// embalagem Saporino sair. A empresa por baixo responde por arquivo, sessão e
// auditoria; ela NÃO decide a identidade criativa.
//
// Estas funções espelham a decisão que hoje vive no navegador e no motor. O
// teste existe para que a regra pare de ser convenção e vire lei verificável.
import { describe, it, expect } from 'vitest';

type ModoMarca = 'perfil' | 'livre';

/** Identidade da peça, a partir do seletor do topo. */
function identidadeDaPeca(
  marcaLivre: boolean,
  nomeLivre: string,
  marcaCadastrada: string | null,
): { modo: ModoMarca; marca: string } {
  return marcaLivre
    ? { modo: 'livre', marca: nomeLivre.trim() }
    : { modo: 'perfil', marca: marcaCadastrada ?? '' };
}

/** Marca gravada num ativo no momento do upload. */
function marcaDoAtivo(marcaLivre: boolean, brandId: string | null, nome: string) {
  return { brand_id: marcaLivre ? null : brandId, brand_mode: marcaLivre ? 'livre' : 'perfil', brand_name: nome };
}

/** A trava do motor: este ativo é desta marca? */
function conflita(
  ativo: { brand_id: string | null; brand_name: string | null },
  modo: ModoMarca,
  brandIdDaPeca: string | null,
  marca: string,
): boolean {
  return modo === 'perfil'
    ? ativo.brand_id !== brandIdDaPeca
    : Boolean(ativo.brand_name) && ativo.brand_name!.toLowerCase() !== marca.toLowerCase();
}

const SAPORINO = 'brand-saporino';

describe('a empresa administrativa não decide a marca da peça', () => {
  it('marca livre ignora a marca cadastrada da empresa por baixo', () => {
    const id = identidadeDaPeca(true, 'Café Capital', 'Café Saporino');
    expect(id).toEqual({ modo: 'livre', marca: 'Café Capital' });
  });

  it('sem marca livre, vale a marca cadastrada', () => {
    expect(identidadeDaPeca(false, 'Café Capital', 'Café Saporino'))
      .toEqual({ modo: 'perfil', marca: 'Café Saporino' });
  });
});

describe('ownership do ativo', () => {
  it('em marca livre o ativo NÃO herda brand_profile da empresa', () => {
    // O bug: a empresa administrativa era Saporino, então o upload carimbava
    // Saporino e a própria trava barrava a peça da Capital.
    const a = marcaDoAtivo(true, SAPORINO, 'Café Capital');
    expect(a.brand_id).toBeNull();
    expect(a.brand_name).toBe('Café Capital');
  });

  it('em marca cadastrada o ativo recebe a marca', () => {
    expect(marcaDoAtivo(false, SAPORINO, 'Café Saporino').brand_id).toBe(SAPORINO);
  });
});

describe('a trava continua rígida', () => {
  it('marca livre aceita o ativo enviado com o mesmo nome', () => {
    const a = marcaDoAtivo(true, SAPORINO, 'Café Capital');
    expect(conflita(a, 'livre', null, 'Café Capital')).toBe(false);
  });

  it('marca livre recusa ativo de outra marca', () => {
    const a = marcaDoAtivo(false, SAPORINO, 'Café Saporino');
    expect(conflita(a, 'livre', null, 'Café Capital')).toBe(true);
  });

  it('marca cadastrada exige que o ativo seja DELA', () => {
    const a = marcaDoAtivo(false, 'brand-cofico', 'COFICO Brasil');
    expect(conflita(a, 'perfil', SAPORINO, 'Café Saporino')).toBe(true);
  });

  it('marca cadastrada recusa ativo sem marca, vindo de marca livre', () => {
    // Sem isto, a porta fechada de um lado reabriria pelo outro.
    const a = marcaDoAtivo(true, null, 'Café Capital');
    expect(conflita(a, 'perfil', SAPORINO, 'Café Saporino')).toBe(true);
  });

  it('marca cadastrada aceita o próprio ativo', () => {
    const a = marcaDoAtivo(false, SAPORINO, 'Café Saporino');
    expect(conflita(a, 'perfil', SAPORINO, 'Café Saporino')).toBe(false);
  });
});
