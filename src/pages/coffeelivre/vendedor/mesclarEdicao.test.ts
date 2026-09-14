import { describe, expect, it } from 'vitest';
import { camposAlterados, mesclarComBanco } from './mesclarEdicao';

const base = { titulo: 'Catuaí', descricao: 'Antiga', preco: '24,90', atributos: { torra: 'media' } };

describe('mesclarComBanco', () => {
  it('descrição não salva sobrevive ao preço aplicado pelo Copiloto', () => {
    const local = { ...base, descricao: 'Nova descrição digitada' };
    const banco = { ...base, preco: '23,50' };
    const r = mesclarComBanco(local, base, banco, ['preco']);
    expect(r.campos.descricao).toBe('Nova descrição digitada');
    expect(r.campos.preco).toBe('23,50');
    expect(r.preservados).toEqual(['descricao']);
    expect(r.substituidos).toEqual([]);
  });

  it('campo não editado recebe o valor do banco', () => {
    const r = mesclarComBanco(base, base, { ...base, titulo: 'Catuaí Amarelo' });
    expect(r.campos.titulo).toBe('Catuaí Amarelo');
    expect(r.preservados).toEqual([]);
  });

  it('preço digitado e não salvo é substituído pela ação rápida e avisado', () => {
    const local = { ...base, preco: '26,00' };
    const r = mesclarComBanco(local, base, { ...base, preco: '23,50' }, ['preco']);
    expect(r.campos.preco).toBe('23,50');
    expect(r.substituidos).toEqual(['preco']);
  });

  it('não avisa substituição quando o valor digitado já era o do banco', () => {
    const local = { ...base, preco: '23,50' };
    const r = mesclarComBanco(local, base, { ...base, preco: '23,50' }, ['preco']);
    expect(r.substituidos).toEqual([]);
  });

  it('compara objetos por conteúdo', () => {
    const local = { ...base, atributos: { torra: 'escura' } };
    const r = mesclarComBanco(local, base, { ...base, atributos: { torra: 'media' } });
    expect(r.campos.atributos).toEqual({ torra: 'escura' });
    expect(r.preservados).toEqual(['atributos']);
  });

  it('camposAlterados lista o que ainda não foi salvo', () => {
    expect(camposAlterados({ ...base, descricao: 'x' }, base)).toEqual(['descricao']);
    expect(camposAlterados(base, base)).toEqual([]);
  });
});
