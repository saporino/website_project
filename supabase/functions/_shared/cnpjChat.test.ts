import { describe, it, expect } from 'vitest';
import {
  limparCnpj, traduzirEmpresa, buscarEmpresa, EXEMPLOS_SIMULADOS,
} from './cnpjChat.ts';

describe('limparCnpj — a origem das duplicatas', () => {
  it('aceita com e sem máscara, e dá o mesmo resultado', () => {
    expect(limparCnpj('61.109.694/0001-94')).toBe('61109694000194');
    expect(limparCnpj('61109694000194')).toBe('61109694000194');
    expect(limparCnpj(' 61.109.694/0001-94 ')).toBe('61109694000194');
  });

  it('recusa o que não tem 14 dígitos — inclusive o CNPJ que perdeu o zero à esquerda', () => {
    expect(limparCnpj('6109694000194')).toBeNull();   // 13
    expect(limparCnpj('')).toBeNull();
    expect(limparCnpj(null)).toBeNull();
    expect(limparCnpj('abc')).toBeNull();
  });
});

describe('traduzirEmpresa — o contrato ainda não é conhecido', () => {
  it('entende os nomes de campo em snake_case', () => {
    const p = traduzirEmpresa(EXEMPLOS_SIMULADOS[0])!;
    expect(p.cnpj).toBe('61109694000194');
    expect(p.razao_social).toBe('CAFE SAPORINO LTDA');
    expect(p.cnae_principal).toBe('1081302');
    expect(p.municipio).toBe('Barueri');
    expect(p.uf).toBe('SP');
  });

  it('entende também camelCase e inglês, porque o formato real é desconhecido', () => {
    const p = traduzirEmpresa(EXEMPLOS_SIMULADOS[1])!;
    expect(p.razao_social).toBe('V. MEDEIROS DE SANTI LTDA');
    expect(p.nome_fantasia).toBe('COFICO BRASIL');
    expect(p.cnae_principal).toBe('4639701');
    expect(p.municipio).toBe('São Paulo');
  });

  it('normaliza UF para maiúscula — senão "sp" e "SP" viram dois filtros', () => {
    expect(traduzirEmpresa(EXEMPLOS_SIMULADOS[1])!.uf).toBe('SP');
  });

  it('DESCARTA sócios e CPF: dado pessoal que não precisamos não entra', () => {
    const p = traduzirEmpresa(EXEMPLOS_SIMULADOS[0])!;
    const texto = JSON.stringify(p);
    expect(texto).not.toContain('qsa');
    expect(texto).not.toContain('FULANO');
    expect(texto).not.toContain('cpf');
    expect(texto).not.toContain('123456');
  });

  it('campo ausente vira null, nunca string vazia nem valor inventado', () => {
    const p = traduzirEmpresa({ cnpj: '61109694000194' })!;
    expect(p.razao_social).toBeNull();
    expect(p.cnae_principal).toBeNull();
    expect(p.municipio).toBeNull();
  });

  it('sem CNPJ não entra: sem ele não há como evitar duplicata', () => {
    expect(traduzirEmpresa({ razao_social: 'EMPRESA SEM CNPJ' })).toBeNull();
    expect(traduzirEmpresa(null)).toBeNull();
    expect(traduzirEmpresa({})).toBeNull();
  });
});

describe('buscarEmpresa — o trial não pode ser gasto por acidente', () => {
  it('SEM token responde simulado e consome ZERO operações', async () => {
    const r = await buscarEmpresa('61.109.694/0001-94');
    expect(r.simulado).toBe(true);
    expect(r.operacoes).toBe(0);
    expect(r.prospects[0].razao_social).toBe('CAFE SAPORINO LTDA');
  });

  it('sem token NÃO toca a rede, nem por engano', async () => {
    let chamou = false;
    const espiao = (async () => { chamou = true; return new Response('{}'); }) as unknown as typeof fetch;
    await buscarEmpresa('61109694000194', { buscar: espiao });
    expect(chamou).toBe(false);
  });

  it('CNPJ inválido não consome operação nem chama a API', async () => {
    let chamou = false;
    const espiao = (async () => { chamou = true; return new Response('{}'); }) as unknown as typeof fetch;
    const r = await buscarEmpresa('123', { token: 'tok', buscar: espiao });
    expect(chamou).toBe(false);
    expect(r.operacoes).toBe(0);
  });

  it('COM token chama a API, manda Bearer e conta a operação', async () => {
    let url = '', auth = '';
    const falso = (async (u: string, init?: RequestInit) => {
      url = String(u);
      auth = String((init?.headers as Record<string, string>)?.Authorization ?? '');
      return new Response(JSON.stringify({ data: { cnpj: '61109694000194', razao_social: 'X LTDA' } }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;

    const r = await buscarEmpresa('61109694000194', { token: 'segredo', buscar: falso });
    expect(url).toContain('/companies/61109694000194');
    expect(auth).toBe('Bearer segredo');
    expect(r.simulado).toBe(false);
    expect(r.operacoes).toBe(1);
    expect(r.prospects[0].razao_social).toBe('X LTDA');
  });

  it('erro da API não vira prospect vazio: avisa e devolve lista vazia', async () => {
    const falso = (async () => new Response('nope', { status: 429 })) as unknown as typeof fetch;
    const r = await buscarEmpresa('61109694000194', { token: 'tok', buscar: falso });
    expect(r.prospects).toHaveLength(0);
    expect(r.aviso).toContain('429');
  });

  it('resposta em formato inesperado avisa em vez de gravar lixo', async () => {
    const falso = (async () => new Response(JSON.stringify({ outro: 'formato' }),
      { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const r = await buscarEmpresa('61109694000194', { token: 'tok', buscar: falso });
    expect(r.prospects).toHaveLength(0);
    expect(r.aviso).toContain('contrato');
  });
});
