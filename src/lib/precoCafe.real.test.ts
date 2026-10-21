/**
 * Validação da régua contra a coleta REAL do Mercado Livre (20/10/2026).
 *
 * Não é teste de unidade: é a prova de que a metodologia corrigida produz
 * número plausível em cima dos 356 registros que a API devolveu de verdade —
 * e a comparação com o que a versão anterior produzia.
 *
 * Roda só quando o arquivo da coleta existe. Sem ele, é pulado em vez de
 * falhar: a coleta é um artefato local, não faz parte do repositório.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { avaliar, resumir, type Produto, type Oferta, type Comparavel } from './precoCafe';

const ARQUIVO = 'ml-coleta-cafe.json';

interface LinhaColetada {
  ficha: string; titulo?: string; marca?: string; tipo?: string;
  kg_unidade?: number; unidades?: number; preco: number; rs_kg: number;
  fonte?: string; preco_antes?: number | null;
}

describe.skipIf(!existsSync(ARQUIVO))('régua aplicada à coleta real', () => {
  // `describe.skipIf` ainda PERCORRE o corpo para coletar os testes, entao
  // ler o arquivo aqui quebrava a suite inteira quando ele nao existia — e
  // ele nao existe por padrao: e artefato local, fora do git.
  const linhas: LinhaColetada[] = existsSync(ARQUIVO)
    ? JSON.parse(readFileSync(ARQUIVO, 'utf8'))
    : [];

  // Reagrupa por ficha: na coleta, cada OFERTA virou uma linha — e era
  // exatamente isso que inflava a mediana.
  const porFicha = new Map<string, LinhaColetada[]>();
  for (const l of linhas) {
    if (!porFicha.has(l.ficha)) porFicha.set(l.ficha, []);
    porFicha.get(l.ficha)!.push(l);
  }

  const itens: Comparavel[] = [];
  for (const [ficha, ofs] of porFicha) {
    const p: Produto = {
      ficha,
      titulo: ofs[0].titulo ?? null,
      marca: ofs[0].marca ?? null,
      tipo: ofs[0].tipo ?? null,
      kgUnidade: ofs[0].kg_unidade ?? null,
      unidades: ofs[0].unidades ?? 1,
    };
    const ofertas: Oferta[] = ofs.map(o => ({
      preco: o.preco, condicao: 'new', minCompra: 1, precoAntes: o.preco_antes ?? null,
    }));
    itens.push(avaliar(p, ofertas));
  }

  const r = resumir(itens, '2026-10-20');

  it('a mediana principal fica na faixa plausível do mercado de massa', () => {
    // ANTES: R$ 96,00/kg (500 g), com cápsula dentro e 38 revendedores
    // contando como 38 produtos.
    expect(r.principal.n).toBeGreaterThan(0);
    expect(r.principal.mediana!).toBeGreaterThan(20);
    expect(r.principal.mediana!).toBeLessThan(70);
  });

  it('a amostra principal é bem menor que a coleta bruta — e isso é o ponto', () => {
    // 356 ofertas viram ~50 produtos, e só uma parte é comparável.
    expect(r.principal.n).toBeLessThan(linhas.length / 3);
  });

  it('produto conhecido cai onde deveria', () => {
    const pilao = itens.find(i => /pil[ãa]o/i.test(i.titulo ?? ''));
    if (pilao) {
      expect(pilao.reaisPorKg!).toBeGreaterThan(20);
      expect(pilao.reaisPorKg!).toBeLessThan(80);
    }
  });

  it('relatório', () => {
    const L: string[] = [];
    const add = (x = '') => L.push(x);
    const f = (v: number | null) => v == null ? '     -' : v.toFixed(2).padStart(6);

    add('REGUA DE PRECO — CAFE NO MERCADO LIVRE');
    add('coleta ' + r.dataColeta + ' · ' + linhas.length + ' ofertas · ' + porFicha.size + ' produtos');
    add('');
    add('TOTAL COLETADO: ' + r.totais.coletados + ' produtos · com R$/kg: ' + r.totais.comPrecoPorKg + ' · sem peso: ' + r.totais.semPeso);
    add('');
    add('PRATELEIRA 500 g — TODAS as marcas, TODAS as linhas');
    add('                                 n     p25  mediana      p75     min     max');
    const linha = (rot: string, x: typeof r.principal) =>
      add('  ' + rot.padEnd(30) + String(x.n).padStart(3) + ' ' +
          f(x.p25) + ' ' + f(x.mediana) + ' ' + f(x.p75) + ' ' + f(x.min) + ' ' + f(x.max));
    linha('todos', r.principal);
    linha('so com concorrencia (2+)', r.principalComConcorrencia);
    linha('pela MENOR oferta valida', r.principalPelaMenor);
    add('');
    add('MARCAS NA AMOSTRA PRINCIPAL');
    for (const [m, n] of Object.entries(r.marcas).sort((a, b) => b[1] - a[1])) {
      add('  ' + String(n).padStart(3) + '  ' + m);
    }
    add('');
    add('GRUPOS COMPLEMENTARES');
    for (const [g, v] of Object.entries(r.porGrupo)) {
      if (g === 'principal') continue;
      add('  ' + g.padEnd(12) + ' n=' + String(v.n).padStart(3) + '   mediana ' + f(v.mediana) + '/kg');
    }
    add('');
    for (const [nome, mapa] of [['SEGMENTO', r.porSegmento], ['ESPECIE', r.porEspecie], ['INTENSIDADE', r.porIntensidade]] as const) {
      add(nome + ' (descreve, nao exclui)');
      for (const [k, v] of Object.entries(mapa)) {
        add('  ' + k.padEnd(18) + ' n=' + String(v.n).padStart(3) + '   mediana ' + f(v.mediana) + '/kg');
      }
      add('');
    }
    add('');
    add('PRODUTOS COMPARAVEIS — primeira retornada x menor valida');
    add('  MARCA            1a OFERTA    R$/kg   MENOR    R$/kg   DISP%  OF  EVID');
    for (const i of itens.filter(x => x.grupo === 'p500' && x.reaisPorKg != null)
      .sort((a, b) => a.reaisPorKg! - b.reaisPorKg!)) {
      add('  ' + String(i.marca ?? '?').slice(0, 15).padEnd(16)
        + String(i.precoRepresentativo).padStart(9) + ' ' + f(i.reaisPorKg)
        + ' ' + String(i.menorOfertaValida).padStart(7) + ' ' + f(i.menorReaisPorKg)
        + ' ' + (i.dispersaoPct == null ? '    -' : i.dispersaoPct.toFixed(0).padStart(5))
        + ' ' + String(i.ofertasNaFicha).padStart(3) + '  ' + i.evidencia);
    }
    add('');
    add('CASA COFICO — Tropeiro Paulista Tradicional 500 g');
    add('  R$ 23,90 por pacote = R$ 47,80/kg');
    const med = r.principalComConcorrencia.mediana;
    if (med) {
      const d = ((47.80 - med) / med) * 100;
      add('  contra a mediana com concorrencia (' + med.toFixed(2) + '/kg): '
          + (d >= 0 ? '+' : '') + d.toFixed(0) + '%');
    }
    const medMenor = r.principalPelaMenor.mediana;
    if (medMenor) {
      const d2 = ((47.80 - medMenor) / medMenor) * 100;
      add('  contra a mediana pela menor oferta (' + medMenor.toFixed(2) + '/kg): '
          + (d2 >= 0 ? '+' : '') + d2.toFixed(0) + '%');
    }
    add('');
    add('TODOS OS PRODUTOS COLETADOS — nenhum fora da lista');
    add('  MARCA            GRUPO        SEGMENTO      ESPECIE         1a OFERTA    R$/kg   OF');
    for (const i of r.todos) {
      add('  ' + String(i.marca ?? '?').slice(0, 15).padEnd(16)
        + i.grupo.padEnd(13) + i.segmento.padEnd(14) + i.especie.padEnd(16)
        + (i.precoRepresentativo == null ? '        -' : String(i.precoRepresentativo).padStart(9))
        + ' ' + f(i.reaisPorKg) + ' ' + String(i.ofertasNaFicha).padStart(4));
    }
    add('');
    add('LIMITACOES');
    for (const l of r.limitacoes) add('  - ' + l);

    writeFileSync('regua-preco-cafe.txt', L.join(String.fromCharCode(10)), 'utf8');
    expect(L.length).toBeGreaterThan(10);
  });
});
