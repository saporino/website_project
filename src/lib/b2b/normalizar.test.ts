import { describe, expect, it } from 'vitest';
import {
  chaveDeNome, formatarCnpj, limparRazaoSocial, normalizarCnpj, normalizarLinha, normalizarTelefone, normalizarUf,
  sugerirMapeamento, tipoPorCnae, tipoPorTexto,
} from './normalizar';

describe('CNPJ', () => {
  it('confere os dígitos verificadores e aceita máscara', () => {
    expect(normalizarCnpj('33.362.953/0001-59')).toBe('33362953000159');
    expect(normalizarCnpj('17246022000139')).toBe('17246022000139');
    expect(normalizarCnpj('17246022000130')).toBeNull();
    expect(normalizarCnpj('11111111111111')).toBeNull();
    expect(normalizarCnpj('')).toBeNull();
  });
  it('repõe zeros à esquerda perdidos pela planilha', () => {
    expect(normalizarCnpj(7041000100)).toBe('00007041000100');
  });
  it('formata para leitura', () => {
    expect(formatarCnpj('33362953000159')).toBe('33.362.953/0001-59');
  });
});

describe('UF, telefone e tipo', () => {
  it('aceita sigla ou nome do estado', () => {
    expect(normalizarUf('sp')).toBe('SP');
    expect(normalizarUf('São Paulo')).toBe('SP');
    expect(normalizarUf('Minas Gerais')).toBe('MG');
    expect(normalizarUf('EX')).toBeNull();
  });
  it('telefone com DDD, sem +55', () => {
    expect(normalizarTelefone('+55 (34) 99817-2106')).toBe('34998172106');
    expect(normalizarTelefone('3266-1113')).toBeNull();
    expect(normalizarTelefone('1732671744')).toBe('1732671744');
  });
  it('tipo pelo CNAE e por texto livre', () => {
    expect(tipoPorCnae('1081302')).toBe('torrefacao');
    expect(tipoPorCnae('4711302')).toBe('supermercado');
    expect(tipoPorTexto('Indústria de Café')).toBe('industria');
    expect(tipoPorTexto('Torrefação de cafés especiais')).toBe('torrefacao');
    expect(tipoPorTexto('Supermercado')).toBe('supermercado');
  });
});

describe('LGPD e chave de nome', () => {
  it('tira CPF e base de CNPJ da razão social de MEI', () => {
    expect(limparRazaoSocial('17.246.022 EUTON CESAR SILVA')).toEqual({ razao: 'EUTON CESAR SILVA', pessoaFisica: true });
    expect(limparRazaoSocial('MARIA DA SILVA 12345678901')).toEqual({ razao: 'MARIA DA SILVA', pessoaFisica: true });
    expect(limparRazaoSocial('CAFE VIEIRA LTDA')).toEqual({ razao: 'CAFE VIEIRA LTDA', pessoaFisica: false });
  });
  it('mesma empresa escrita diferente gera a mesma chave', () => {
    expect(chaveDeNome('Café Vieira Ltda', 'Presidente Olegário', 'MG')).toBe(chaveDeNome('CAFE VIEIRA - ME', 'PRESIDENTE OLEGARIO', 'MG'));
    expect(chaveDeNome('X', null, 'MG')).toBeNull();
  });
});

describe('cabeçalhos e linha completa', () => {
  it('reconhece as colunas da exportação da Receita', () => {
    const m = sugerirMapeamento(['razao_social', 'nome_fantasia', 'cnpj', 'uf', 'municipio_nome', 'situacao_cadastral', 'cnae_principal', 'cnae_descricao', 'data_inicio_atividade']);
    expect(m).toMatchObject({ razao_social: 'razao_social', nome_fantasia: 'nome_fantasia', cnpj: 'cnpj', uf: 'uf', municipio_nome: 'municipio',
      situacao_cadastral: 'situacao_cadastral', cnae_principal: 'cnae_principal', cnae_descricao: 'cnae_descricao', data_inicio_atividade: 'data_abertura' });
  });
  it('coluna desconhecida fica sem campo', () => {
    expect(sugerirMapeamento(['coluna estranha'])['coluna estranha']).toBeNull();
  });
  it('padroniza uma linha inteira', () => {
    const { linha, valida } = normalizarLinha({
      cnpj: '17246022000139', razao_social: '17.246.022 EUTON CESAR SILVA', nome_fantasia: 'CAFE CORUJAS', uf: 'MG',
      municipio: 'Carai', situacao_cadastral: '02', cnae_principal: '1081302', data_abertura: '03/12/2012',
      telefone: '(33) 99999-1234', site: 'cafecorujas.com.br', marcas: 'Corujas · Corujas Gourmet',
    });
    expect(valida).toBe(true);
    expect(linha).toMatchObject({
      cnpj: '17246022000139', razao_social: 'EUTON CESAR SILVA', pessoa_fisica: true, tipo: 'torrefacao', uf: 'MG', municipio: 'CARAI',
      situacao_cadastral: 'Ativa', data_abertura: '2012-12-03', telefone: '33999991234', whatsapp: '33999991234',
      site: 'https://cafecorujas.com.br', marcas: ['Corujas', 'Corujas Gourmet'],
    });
  });
  it('CNPJ inválido é sinalizado; sem CNPJ e sem cidade não entra', () => {
    expect(normalizarLinha({ cnpj: '12345678000100', razao_social: 'X' }).cnpjInvalido).toBe(true);
    // CNPJ errado não entra nem pelo nome + cidade.
    expect(normalizarLinha({ cnpj: '12345678000100', razao_social: 'X', municipio: 'Santos', uf: 'SP' }).valida).toBe(false);
    expect(normalizarLinha({ razao_social: 'Sem cidade' }).valida).toBe(false);
    expect(normalizarLinha({ razao_social: 'Café Uno', municipio: 'Cafe', uf: 'SP' }).valida).toBe(true);
  });
});
