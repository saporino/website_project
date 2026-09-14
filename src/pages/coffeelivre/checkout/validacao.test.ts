import { describe, expect, it } from 'vitest';
import { cepValido, cpfValido, formatarCep, semErros, validarComprador, validarEndereco } from './validacao';

const ENDERECO = {
  destinatario: '', cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '',
  bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', referencia: '',
};

describe('validação do checkout', () => {
  it('CEP', () => {
    expect(cepValido('01310-100')).toBe(true);
    expect(cepValido('0131010')).toBe(false);
    expect(formatarCep('01310100')).toBe('01310-100');
  });
  it('CPF opcional, mas se vier precisa ser válido', () => {
    expect(cpfValido('')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });
  it('endereço completo passa; faltando campos, diz quais', () => {
    expect(semErros(validarEndereco(ENDERECO))).toBe(true);
    const e = validarEndereco({ ...ENDERECO, numero: '', uf: 'XX' });
    expect(Object.keys(e).sort()).toEqual(['numero', 'uf']);
  });
  it('comprador: nome obrigatório, telefone com DDD', () => {
    expect(semErros(validarComprador({ nome: 'Ana Souza', telefone: '', cpf: '' }))).toBe(true);
    expect(Object.keys(validarComprador({ nome: 'A', telefone: '1234', cpf: '' })).sort()).toEqual(['nome', 'telefone']);
  });
});
