import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { montarFolhaDePrecos, nomeDoArquivo, precoAoMercado, type DadosFolha } from './intelPdf';

// Exemplo real do mercado (gôndola do Lopes, 26/09/2026): Pilão 250 g a R$ 14,89.
const dados: DadosFolha = {
  mercado: 'Supermercado Lopes — Cipava, Osasco/SP',
  atualizadoEm: '26/09/2026, 09:44',
  geradoEm: '26/09/2026, 17:30',
  recorte: 'Torrado e moído',
  margens: [20, 22.5, 25],
  medianaPorKg: 45.8,
  faixa: [33.8, 79.6],
  promoPct: 12,
  linhas: [
    { titulo: 'Pilão Tradicional', precoPrateleira: 14.89, precoPorKg: 59.56, pesoG: 250, fotoUrl: null },
    { titulo: 'Jardim Extraforte almofada', precoPrateleira: 12.99, precoPorKg: 51.96, pesoG: 250, descontoPct: 10 },
    { titulo: 'Café Gourmet 3 Corações Cerrado Mineiro', precoPrateleira: 19.9, precoPorKg: 79.6, pesoG: 250, arabica: true, fotoUrl: 'https://exemplo/foto.jpg' },
  ],
};

describe('preço ao mercado', () => {
  it('desconta a margem da rede sobre o preço de prateleira', () => {
    expect(precoAoMercado(14.89, 22.5)).toBe(11.54); // confere com a pesquisa do Lopes
    expect(precoAoMercado(12.99, 20)).toBe(10.39);
    expect(precoAoMercado(12.99, 25)).toBe(9.74);
  });
});

describe('nome do arquivo', () => {
  it('leva o mercado e a data da coleta, sem acento', () => {
    expect(nomeDoArquivo('Atacadão', new Date(2026, 8, 26))).toBe('atacadao-precos-26-09-2026');
    expect(nomeDoArquivo('Supermercado Lopes — Cipava, Osasco/SP', new Date(2026, 8, 5)))
      .toBe('supermercado-lopes-cipava-osasco-sp-precos-05-09-2026');
  });
});

describe('folha de preços', () => {
  const html = montarFolhaDePrecos(dados, 'lopes-precos-26-09-2026');

  it('mostra a data da coleta e o recorte no topo', () => {
    expect(html).toContain('Atualizado em 26/09/2026, 09:44');
    expect(html).toContain('Torrado e moído');
    expect(html).toContain('<title>lopes-precos-26-09-2026</title>');
  });

  it('cria uma coluna por margem, com o que a rede paga', () => {
    expect(html).toContain('Paga com margem<br>20%');
    expect(html).toContain('Paga com margem<br>22,5%');
    expect(html).toContain('R$ 11,54'); // Pilão 250 g com 22,5%
    expect(html).toContain('R$ 11,17'); // Pilão 250 g com 25%
  });

  it('traz o preço de prateleira, o R$/kg e a foto de quem tem', () => {
    expect(html).toContain('R$ 14,89');
    expect(html).toContain('R$ 59,56');
    expect(html).toContain('<img src="https://exemplo/foto.jpg"');
  });

  it('calcula o alvo para concorrer pela mediana, por gramatura e margem', () => {
    // 500 g na mediana de R$ 45,80/kg = R$ 22,90 de prateleira; com 22,5% de margem = R$ 17,75
    expect(html).toContain('R$ 17,75');
    expect(html).toContain('Para concorrer neste mercado');
  });

  it('escapa o que vem do anúncio (título nunca vira HTML)', () => {
    const perigoso = montarFolhaDePrecos({ ...dados, linhas: [{ titulo: '<script>x</script>', precoPrateleira: 10 }] }, 'x');
    expect(perigoso).not.toContain('<script>x');
    expect(perigoso).toContain('&lt;script&gt;');
  });

  it('guarda uma amostra para conferir o layout na tela', () => {
    const saida = path.resolve(process.cwd(), 'test-results', 'intel-precos');
    fs.mkdirSync(saida, { recursive: true });
    fs.writeFileSync(path.join(saida, 'exemplo.html'), html, 'utf8');
    expect(fs.existsSync(path.join(saida, 'exemplo.html'))).toBe(true);
  });
});
