import { afterEach, describe, expect, it } from 'vitest';
import { _definirDestino, classificarFalha, registrarFalha, type EventoDeFalha } from './observabilidade';

describe('classificarFalha', () => {
  it('RLS e permissão', () => {
    expect(classificarFalha({ code: '42501', message: 'permission denied for table lv_products' }).tipo).toBe('permissao');
    expect(classificarFalha({ message: 'new row violates row-level security policy' }).tipo).toBe('permissao');
  });
  it('autenticação', () => {
    expect(classificarFalha({ message: 'JWT expired', code: 'PGRST301' }).tipo).toBe('autenticacao');
    expect(classificarFalha({ status: 401, message: 'x' }).tipo).toBe('autenticacao');
  });
  it('regra do banco é validação e a mensagem é repassada', () => {
    expect(classificarFalha({ code: 'P0001', message: 'Preço abaixo do seu piso' }).tipo).toBe('validacao');
  });
  it('rede', () => {
    const e = new TypeError('Failed to fetch');
    expect(classificarFalha(e).tipo).toBe('rede');
  });
  it('o resto é banco', () => {
    expect(classificarFalha({ message: 'relation does not exist', code: '42P01' }).tipo).toBe('banco');
    expect(classificarFalha(null).tipo).toBe('banco');
  });
});

describe('registrarFalha', () => {
  const eventos: EventoDeFalha[] = [];
  afterEach(() => { eventos.length = 0; });

  it('sempre emite um evento estruturado e devolve texto para a tela', () => {
    _definirDestino(e => eventos.push(e));
    const texto = registrarFalha('aplicar-preco', { code: 'P0001', message: 'Preço abaixo do seu piso' });
    expect(texto).toBe('Preço abaixo do seu piso');
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ operacao: 'aplicar-preco', tipo: 'validacao', codigo: 'P0001' });
    expect(eventos[0].momento).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('permissão vira mensagem clara, sem detalhe técnico', () => {
    _definirDestino(e => eventos.push(e));
    expect(registrarFalha('b2b-solicitar', { code: '42501', message: 'permission denied' })).toBe('Você não tem permissão para fazer isto.');
    expect(eventos[0].tipo).toBe('permissao');
  });

  it('erro sem mensagem usa o texto padrão', () => {
    _definirDestino(e => eventos.push(e));
    expect(registrarFalha('carregar', null, 'Falhou.')).toBe('Falhou.');
  });
});
