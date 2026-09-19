// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { dadosEmbutidos, lerConteudo, lerHtml, lerJson, lerXml, tabelaDeLista } from './leitores';
import { normalizarLinha, sugerirMapeamento, sugerirPorValores, type Campo } from './normalizar';

const buf = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('HTML', () => {
  const html = `<html><body><h2>Associados ABIC</h2><table>
    <tr><th>Empresa</th><th>Categoria</th><th>Local</th><th>Contato</th></tr>
    <tr><td><b>A B M IND. E COM. CAFE LTDA.</b><div>BASA · BASA EXPRESSO</div></td><td>Indústria de café</td>
        <td>MARINGA<div>PR</div></td><td><a href="https://abm.com.br">site</a> <a href="mailto:contato@abm.com.br">e-mail</a><div>3266-1113</div></td></tr>
    <tr><td>A. ABRANTES GADELHA CIA</td><td>Indústria de café</td><td>SOUSA<div>PB</div></td><td></td></tr>
  </table>
  <script>window.TORREF=[["00007041000100","TORREFACAO BEM BRASIL LTDA","CAFE BEM BRASIL",["1732671744"],"ESTRADA GPI 010","ZONA RURAL","15110000","GUAPIACU","SP",1994,1,1,45000.0],
    ["00026492000194","AGRO INDUSTRIAL SULIZIS LTDA","SULIZIS",[],"LOC QI 22","TAGUATINGA","71015221","BRASILIA","DF",1966,1,0,0.0],
    ["00032789000162","VASCAFE IND E COM DE CAFE LTDA","VASCAFE",["6436511211"],"AV LEOCADIO 23","SOL NASCENTE","75863002","QUIRINOPOLIS","GO",1982,2,0,110000.0]];</script>
  </body></html>`;

  it('lê cada tabela com título, partes das células e links como colunas próprias', () => {
    const [t] = lerHtml('raio-x-abic.html', html);
    expect(t.nome).toBe('Associados ABIC');
    expect(t.linhas).toHaveLength(2);
    const l = t.linhas[0];
    expect(l['Empresa · parte 1']).toBe('A B M IND. E COM. CAFE LTDA.');
    expect(l['Empresa · parte 2']).toBe('BASA · BASA EXPRESSO');
    expect(l['Local · parte 2']).toBe('PR');
    expect(l['Contato · e-mail']).toBe('contato@abm.com.br');
    expect(l['Contato · site']).toBe('https://abm.com.br');
  });

  it('lê a lista embutida da ferramenta de torrefações (window.TORREF)', () => {
    const tabs = lerHtml('prospeccao_torrefacoes.html', html);
    const t = tabs.find(x => x.nome.includes('TORREF'))!;
    expect(t.linhas).toHaveLength(3);
    expect(t.cabecalhos.slice(0, 3)).toEqual(['Coluna 1', 'Coluna 2', 'Coluna 3']);
    expect(t.linhas[0]['Coluna 4']).toBe('1732671744');
  });

  it('lista sem cabeçalho: o conteúdo sugere CNPJ, UF, CEP e telefone', () => {
    const t = lerHtml('x.html', html).find(x => x.nome.includes('TORREF'))!;
    const mapa = sugerirPorValores(sugerirMapeamento(t.cabecalhos), t.linhas);
    expect(mapa['Coluna 1']).toBe('cnpj');
    expect(mapa['Coluna 9']).toBe('uf');
    expect(mapa['Coluna 7']).toBe('cep');
    expect(mapa['Coluna 4']).toBe('telefone');
  });

  it('ignora script que não é JSON puro', () => {
    expect(dadosEmbutidos('var x = [a, b, c]; const y = {foo: bar}')).toEqual([]);
  });
});

describe('JSON, XML e CSV', () => {
  it('JSON: lista de objetos, aninhado um nível, e lista dentro de propriedade', () => {
    const [t] = lerJson('a.json', JSON.stringify({ empresas: [{ cnpj: '11222333000181', contato: { email: 'a@b.com' } }, { cnpj: '44555666000139' }] }));
    expect(t.nome).toContain('empresas');
    expect(t.linhas[0]['contato.email']).toBe('a@b.com');
  });
  it('JSON Lines', () => {
    const [t] = lerJson('a.jsonl', '{"nome":"A"}\n{"nome":"B"}\n');
    expect(t.linhas.map(l => l.nome)).toEqual(['A', 'B']);
  });
  it('lista de listas com cabeçalho na primeira linha', () => {
    const t = tabelaDeLista('x', [['CNPJ', 'Nome'], ['11222333000181', 'A'], ['44555666000139', 'B']])!;
    expect(t.cabecalhos).toEqual(['CNPJ', 'Nome']);
    expect(t.linhas).toHaveLength(2);
  });
  it('XML: o elemento que se repete vira linha; atributos e filhos viram colunas', () => {
    const [t] = lerXml('a.xml', `<?xml version="1.0"?><lista><empresa id="1"><cnpj>11222333000181</cnpj><nome>A</nome><endereco><uf>SP</uf></endereco></empresa>
      <empresa id="2"><cnpj>44555666000139</cnpj><nome>B</nome><endereco><uf>MG</uf></endereco></empresa></lista>`);
    expect(t.linhas).toHaveLength(2);
    expect(t.linhas[0]).toMatchObject({ '@id': '1', cnpj: '11222333000181', nome: 'A', 'endereco.uf': 'SP' });
  });
  it('XML inválido é recusado com mensagem', () => {
    expect(() => lerXml('a.xml', '<a><b></a>')).toThrow();
  });
  it('CSV com ponto e vírgula e extensão desconhecida decidida pelo conteúdo', async () => {
    const [t] = await lerConteudo('lista.csv', buf('CNPJ;Razão Social;UF\n11222333000181;EMPRESA A;SP\n'));
    expect(t.linhas[0]).toMatchObject({ CNPJ: '11222333000181', 'Razão Social': 'EMPRESA A', UF: 'SP' });
    const [j] = await lerConteudo('exportacao.dat', buf('[{"cnpj":"11222333000181"},{"cnpj":"44555666000139"}]'));
    expect(j.linhas).toHaveLength(2);
  });
  it('planilha com vários telefones na célula fica com o primeiro válido', () => {
    const { linha } = normalizarLinha({ telefone: '3266-1113 · (17) 3267-1744' } as Partial<Record<Campo, unknown>>);
    expect(linha.telefone).toBe('1732671744');
  });
});
