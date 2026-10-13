import { describe, it, expect } from 'vitest';
import { classificar, lerPeso } from '../../supabase/functions/_shared/classificarCafe';

// Todos os títulos aqui saíram do banco de produção na auditoria de 13/10/2026. São os erros
// que o classificador v1 cometia — se algum voltar a passar, este arquivo quebra.

describe('o que NÃO é café não entra na média do café', () => {
  const foraDoEscopo = [
    'Chocolate Lacta Intense Amargo 60% Cacau Café 85g',
    'Bolo Casa Suíça Café da Manhã Chocolate 250g',
    'Biscoito de Café Coffee Joy 90g',
    "Chocolate Amargo 60% Cacau com Pedaços de Café Hershey's Special Dark 85g",
    'Chocolate Hersheys Dark Café 85g',
  ];
  for (const titulo of foraDoEscopo) {
    it(`fora do escopo: ${titulo.slice(0, 42)}`, () => {
      const c = classificar(titulo, 10);
      expect(c.relevancia).toBe('fora_escopo');
      expect(c.familia).toBe('fora');
      expect(c.preco_por_kg).toBeNull();   // não pode entrar em nenhuma média
    });
  }
});

describe('café com leite é outra categoria, não café puro', () => {
  const comLeite = [
    'Café com Leite Solúvel Melitta Lata 200g',
    'Cafe Soluvel com Leite Descafeinado Sem Lactose 3 Coracoes Lata 200g',
    'Café em Cápsulas 3 Corações Café com Leite 10x9g',
    'Café com Leite em Cápsula Latte Macchiato 3 Corações Caixa 10 Unidades',
  ];
  for (const titulo of comLeite) {
    it(`bebida pronta: ${titulo.slice(0, 42)}`, () => {
      const c = classificar(titulo, 15);
      expect(c.familia).toBe('bebida_pronta');
      expect(c.relevancia).toBe('relevante');   // é da cadeia, só não compara com café puro
    });
  }
});

describe('peso: o erro que multiplicava o preço por dez', () => {
  it('"10x9g" são 10 unidades de 9 g, não 9 g', () => {
    const p = lerPeso('Café em Cápsulas 3 Corações 10x9g');
    expect(p.unidades).toBe(10);
    expect(p.unitario).toBe(9);
    expect(p.total).toBe(90);
    expect(p.confiavel).toBe(true);
  });

  it('"Kit 4 x 500 g" são 2 kg', () => {
    expect(lerPeso('Tropeiro Paulista Kit 4 x 500 g').total).toBe(2000);
  });

  it('lê "250 gr" e "500 Gramas", que a v1 ignorava', () => {
    expect(lerPeso('Illy Café em grãos Torrado CLÁSSICO, 1 lata de 250 gr').unitario).toBe(250);
    expect(lerPeso("L'OR Café L'Or Grãos Forza - 500 Gramas").unitario).toBe(500);
  });

  it('quantidade sem peso por unidade NÃO vira preço por quilo', () => {
    const c = classificar('Café Gourmet Especial Torrado e Moído - Em Cápsulas - Caixa C/ 10un', 30);
    expect(c.peso.confiavel).toBe(false);
    expect(c.preco_por_kg).toBeNull();
    expect(c.motivos.join(' ')).toMatch(/ambíguo|não informado/);
  });

  it('peso absurdo não vira preço por quilo', () => {
    expect(lerPeso('Café expresso 2g sachê').confiavel).toBe(false);
  });

  it('peso simples e confiável calcula o preço por quilo', () => {
    const c = classificar('Orfeu Café Clássico Torrado e Moído, 100% Arabica, Torra Média, 250g', 25);
    expect(c.peso.total).toBe(250);
    expect(c.preco_por_kg).toBe(100);
  });
});

describe('apresentação: não chutar quando o anúncio não diz', () => {
  it('grãos', () => {
    expect(classificar('Café Em Grãos Torrado 100% Arábica Gourmet Torra Escura 1kg', 80).apresentacao).toBe('graos');
  });
  it('torrado e moído', () => {
    expect(classificar('3 Corações Café Torrado e Moído Descafeinado 100% Arábica, 250G', 20).apresentacao).toBe('torrado_moido');
  });
  it('cápsula ganha de "torrado e moído" no mesmo título', () => {
    expect(classificar('Café em Cápsula Torrado e Moído Espresso Avelã L\'or', 30).apresentacao).toBe('capsula');
  });
  it('solúvel', () => {
    expect(classificar('L\'OR, Café Solúvel Classique Pote de Vidro 130g', 20).apresentacao).toBe('soluvel');
  });
  it('"grãos OU moído" é ambíguo, não é moído', () => {
    const c = classificar('Café Especial em Grãos Torrado ou Moído 500g - 100% Arábica', 40);
    expect(c.relevancia).toBe('ambiguo');
    expect(c.apresentacao).toBeNull();
  });
  it('só "café" sem apresentação e sem pista de embalagem fica ambíguo', () => {
    const c = classificar('Café Nescafé Original 150g', 18);
    expect(c.relevancia).toBe('ambiguo');
    expect(c.apresentacao).toBeNull();
  });
});

describe('famílias vizinhas da cadeia', () => {
  it('filtro de papel guarda o número — 102 não compara com 103', () => {
    expect(classificar('Filtro de Papel Melitta 103 com 30 unidades', 9).filtro_numero).toBe(103);
    expect(classificar('Filtro de Papel 102 Melitta', 7).filtro_numero).toBe(102);
  });
  it('coador não é filtro de papel', () => {
    expect(classificar('Coador de Pano para Café 2 Unidades', 12).familia).toBe('coador');
  });
  it('equipamento', () => {
    expect(classificar('Cafeteira Elétrica Mondial 30 xícaras', 120).familia).toBe('equipamento');
    expect(classificar('Moedor de Café Manual Inox', 90).familia).toBe('equipamento');
  });
  it('embalagem vazia', () => {
    expect(classificar('Stand Up Pouch Preto para Café 250g - 100 unidades', 200).familia).toBe('embalagem');
  });
  it('nenhum deles vira preço por quilo de café', () => {
    for (const t of ['Cafeteira Elétrica Mondial', 'Filtro de Papel 103', 'Coador de Pano']) {
      expect(classificar(t, 50).preco_por_kg).toBeNull();
    }
  });
});

describe('atributos separados, como o briefing pede', () => {
  it('classe, composição e marca saem em campos próprios', () => {
    const c = classificar('3 Corações Café Torrado e Moído Gourmet Sul de Minas, 250g', 22);
    expect(c.familia).toBe('cafe');
    expect(c.apresentacao).toBe('torrado_moido');
    expect(c.classe).toBe('gourmet');
    expect(c.marca).toBe('3 coracoes');
  });
  it('descafeinado é composição, não classe', () => {
    expect(classificar('Café Torrado e Moído Descafeinado 250g', 20).composicao).toBe('descafeinado');
  });
  it('100% arábica', () => {
    expect(classificar('Café Especial em Grãos 500g - 100% Arábica', 45).composicao).toBe('arabica');
  });
});

describe('sinais vindos da fonte, além do título', () => {
  it('"café" como cor de calçado é fora do escopo', () => {
    const c = classificar('Sandália Slim Square Havaianas 37/38 Café par', 30);
    expect(c.relevancia).toBe('fora_escopo');
    expect(c.motivos.join(' ')).toMatch(/cor/);
  });
  it('pote para café é acessório, não café', () => {
    expect(classificar('Pote para Café Plasútil 1,15L un', 20).familia).toBe('acessorio');
  });
  it('embalagem almofada ou vácuo indica café moído', () => {
    expect(classificar('Café Rincão Almofada 500g', 15).apresentacao).toBe('torrado_moido');
    expect(classificar('Café 100% Arábica a Vácuo Aviação 500g', 22).apresentacao).toBe('torrado_moido');
    expect(classificar('Café Jardim Tradicional Pouch 500g', 16).apresentacao).toBe('torrado_moido');
  });
  it('a dedução pela embalagem fica registrada no motivo', () => {
    expect(classificar('Café Seleto Extra Forte Almofada com 500g', 14).motivos.join(' '))
      .toMatch(/embalagem/);
  });
  it('marca informada pela fonte ganha do palpite pelo título', () => {
    const c = classificar('Café Torrado e Moído 500g', 18, { marca: 'Café Bom Dia' });
    expect(c.marca).toBe('Café Bom Dia');
  });
  it('o campo Embalagem da fonte também resolve a apresentação', () => {
    const c = classificar('Café Especial 500g', 20, { embalagem: 'Almofada' });
    expect(c.apresentacao).toBe('torrado_moido');
  });
});

describe('toda classificação diz por que decidiu', () => {
  it('guarda o motivo e a versão', () => {
    const c = classificar('Chocolate Hersheys Dark Café 85g', 8);
    expect(c.motivos.length).toBeGreaterThan(0);
    expect(c.versao).toBe(2);
  });
});
