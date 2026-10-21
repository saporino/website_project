/**
 * Testes da régua de preço de café.
 *
 * Os casos não são inventados: cada um veio de um defeito real da coleta de
 * 20/10/2026, que produziu mediana de R$ 96/kg num mercado que vende a ~35.
 */
import { describe, it, expect } from 'vitest';
import {
  classificar, pesoTotalKg, ofertaRepresentativa, avaliar, resumir,
  type Produto, type Oferta,
} from './precoCafe';

const prod = (over: Partial<Produto> = {}): Produto => ({
  ficha: 'MLB1', titulo: 'Café Torrado e Moído Tradicional 500g',
  marca: 'Marca', tipo: 'Moído', kgUnidade: 0.5, unidades: 1, ...over,
});
const of = (preco: number, over: Partial<Oferta> = {}): Oferta =>
  ({ preco, condicao: 'new', minCompra: 1, ...over });

describe('classificar — o que entra na mediana principal', () => {
  it('500 g tradicional é o grupo principal', () => {
    expect(classificar(prod()).grupo).toBe('p500');
  });

  it('extraforte também é principal — é a mesma prateleira', () => {
    expect(classificar(prod({ titulo: 'Café União Torrado e Moído Extraforte 500g' })).grupo)
      .toBe('p500');
  });

  // O defeito nº 1: cápsula tem peso declarado e passou pelo filtro de peso.
  it('CÁPSULA fica de fora, mesmo tendo peso', () => {
    const c = classificar(prod({ titulo: 'Café em Cápsulas Dolce Gusto Espresso 500g' }));
    expect(c.grupo).toBe('capsula');
  });

  it('solúvel, grão, cappuccino e acessório vão para o grupo PRÓPRIO (não somem)', () => {
    for (const t of [
      'Café Solúvel Instantâneo 500g',
      'Café em Grãos Torrado 500g',
      'Nescafé Cappuccino 500g',
      'Xícara de Café Porcelana 500g',
    ]) {
      expect(classificar(prod({ titulo: t })).grupo, t).not.toBe('p500');
    }
  });

  it('gourmet e premium saem da principal, mas não são excluídos', () => {
    const g = classificar(prod({ titulo: 'Café Torrado e Moído Gourmet 500g' }));
    expect(g.grupo).toBe('p500');
    expect(g.segmento).toBe('gourmet');
  });

  it('250 g e 1 kg viram grupos próprios', () => {
    expect(classificar(prod({ kgUnidade: 0.25 })).grupo).toBe('p250');
    expect(classificar(prod({ kgUnidade: 1 })).grupo).toBe('p1kg');
  });

  it('kit é kit, mesmo que cada unidade seja 500 g tradicional', () => {
    expect(classificar(prod({ unidades: 4 })).grupo).toBe('kit');
  });

  // A regra ANTERIOR exigia a palavra "tradicional" e jogava fora Pilão
  // Intenso e 3 Corações Fort — concorrentes diretos, descartados por
  // vocabulário. Café de 500 g torrado e moído entra por padrão.
  it('500 g sem a palavra tradicional ENTRA na principal', () => {
    expect(classificar(prod({ titulo: 'Café Torrado e Moído 500g', tipo: 'Unidade' })).grupo)
      .toBe('p500');
  });

  it('Pilão Intenso e 3 Corações Fort são concorrentes, não ambíguos', () => {
    for (const t of ['Café Torrado e Moído Pilão Intenso 500g',
                     'Café Em Pó Fort 500g 3 Corações',
                     'Café Torrado e Moído Sabor da Fazenda Pacote 500g',
                     'Café Torrado e Moído Cajubá Frasco 500g']) {
      expect(classificar(prod({ titulo: t })).grupo, t).toBe('p500');
    }
  });

  it('mas gourmet continua fora da principal', () => {
    const esp = classificar(prod({ titulo: 'Café Torrado e Moído Especial 500g' }));
    expect(esp.grupo).toBe('p500');
    expect(esp.segmento).toBe('especial');
  });

  it('sem peso confiável não classifica — e não chuta', () => {
    expect(classificar(prod({ kgUnidade: null })).grupo).toBe('sem_peso');
    expect(classificar(prod({ kgUnidade: 0 })).grupo).toBe('sem_peso');
  });

  it('peso implausível não entra', () => {
    expect(classificar(prod({ kgUnidade: 12 })).grupo).toBe('fardo');
  });
});

describe('peso total efetivamente vendido', () => {
  it('kit de 4 x 500 g pesa 2 kg', () => {
    expect(pesoTotalKg(prod({ unidades: 4 }))).toBe(2);
  });

  it('compra mínima obrigatória multiplica o peso', () => {
    expect(pesoTotalKg(prod(), of(20, { minCompra: 3 }))).toBe(1.5);
  });

  it('sem peso de unidade, não há peso total', () => {
    expect(pesoTotalKg(prod({ kgUnidade: null }))).toBeNull();
  });
});

describe('uma oferta por produto — o defeito dos 38 revendedores', () => {
  // Caso real: ficha do Pilão Tradicional 500 g, 38 ofertas de R$ 13,90 a
  // R$ 78,99. Antes, as 38 entravam na mediana como se fossem 38 produtos.
  const pilao = [
    of(25.99, { lojaOficial: 54662 }), of(26.40), of(26.98), of(13.90),
    of(45.00), of(78.99), of(31.50), of(52.00),
  ];

  it('escolhe UMA, e é a primeira da API, não o menor preço', () => {
    const r = ofertaRepresentativa(pilao)!;
    expect(r.oferta.preco).toBe(25.99);
    expect(r.origem).toBe('primeira_da_api');
  });

  it('o buy box vence quando existir', () => {
    const r = ofertaRepresentativa(pilao, of(22.90))!;
    expect(r.oferta.preco).toBe(22.90);
    expect(r.origem).toBe('buy_box');
  });

  it('oferta usada não entra', () => {
    const r = ofertaRepresentativa([of(9.90, { condicao: 'used' }), of(25.99)])!;
    expect(r.oferta.preco).toBe(25.99);
    expect(r.descartadas).toBe(1);
  });

  it('sem oferta válida, devolve nulo em vez de inventar', () => {
    expect(ofertaRepresentativa([])).toBeNull();
    expect(ofertaRepresentativa([of(0)])).toBeNull();
  });
});

describe('avaliar — o produto inteiro', () => {
  it('calcula R$/kg pela oferta representativa, e guarda o menor só como informação', () => {
    const a = avaliar(prod(), [of(25.99), of(13.90), of(78.99)]);
    expect(a.grupo).toBe('p500');
    expect(a.precoRepresentativo).toBe(25.99);
    expect(a.reaisPorKg).toBeCloseTo(51.98, 2);
    expect(a.menorOfertaValida).toBe(13.90);   // informação, não preço de mercado
    expect(a.ofertasNaFicha).toBe(3);
  });

  it('kit de 4 x 500 g a R$ 80 dá R$ 40/kg, não R$ 160', () => {
    const a = avaliar(prod({ unidades: 4 }), [of(80)]);
    expect(a.pesoKg).toBe(2);
    expect(a.reaisPorKg).toBe(40);
  });

  it('marca promoção quando há desconto declarado', () => {
    const a = avaliar(prod(), [of(19.90, { precoAntes: 29.90 })]);
    expect(a.temPromocao).toBe(true);
  });
});

describe('resumir — os indicadores', () => {
  const itens = [
    avaliar(prod({ ficha: 'A', titulo: 'Pilão Tradicional 500g' }), [of(13.90)]),
    avaliar(prod({ ficha: 'B', titulo: 'Melitta Tradicional 500g' }), [of(18.90)]),
    avaliar(prod({ ficha: 'C', titulo: 'União Extraforte 500g' }), [of(15.51)]),
    avaliar(prod({ ficha: 'D', titulo: 'Café Cápsula Dolce Gusto 500g' }), [of(90)]),
    avaliar(prod({ ficha: 'E', titulo: 'Café Gourmet Especial 500g' }), [of(60)]),
  ];

  it('a prateleira de 500 g inclui gourmet e sem rótulo — só cápsula vai para outro grupo', () => {
    const r = resumir(itens, '2026-10-20');
    // Pilão, Melitta, União e o Gourmet: quatro de 500 g na mesma prateleira.
    expect(r.principal.n).toBe(4);
    expect(r.porGrupo['capsula'].n).toBe(1);   // a cápsula, listada à parte
    expect(r.totais.coletados).toBe(5);              // e os CINCO no relatório
  });

  it('a validação com marcas conhecidas dá resultado plausível', () => {
    const r = resumir(itens, '2026-10-20');
    // O mercado de massa no ML está entre R$ 25 e R$ 45/kg. Se a mediana sair
    // fora disso, a metodologia quebrou de novo — é este teste que avisa.
    expect(r.principal.mediana!).toBeGreaterThan(25);
    expect(r.principal.mediana!).toBeLessThan(90);
  });

  it('conta e explica o que ficou de fora', () => {
    const r = resumir(itens, '2026-10-20');
    expect(r.porGrupo['capsula'].n).toBe(1);   // a cápsula, listada no grupo dela
    expect(r.totais.coletados).toBe(5);   // TODOS continuam no relatorio
  });

  it('a mesma ficha vinda das duas rotas conta uma vez só', () => {
    const dup = [...itens, avaliar(prod({ ficha: 'A', titulo: 'Pilão Tradicional 500g' }), [of(13.90)])];
    expect(resumir(dup, '2026-10-20').principal.n).toBe(4);
  });

  it('declara as limitações em vez de escondê-las', () => {
    const r = resumir(itens, '2026-10-20');
    expect(r.limitacoes.length).toBeGreaterThan(3);
    expect(r.limitacoes.join(' ')).toMatch(/buy_box|vendida|frete/i);
  });
});

describe('as quatro medidas separadas — nada se funde', () => {
  // A ficha real do Pilão: 38 ofertas, R$ 13,90 a R$ 78,99.
  const ficha = [of(25.99), of(13.90), of(45.00), of(78.99), of(31.50)];

  it('primeira retornada e menor válida convivem, e a distância é um número', () => {
    const a = avaliar(prod(), ficha);
    expect(a.precoRepresentativo).toBe(25.99);   // primeira retornada
    expect(a.menorOfertaValida).toBe(13.90);     // menor válida
    expect(a.reaisPorKg).toBeCloseTo(51.98, 2);
    expect(a.menorReaisPorKg).toBeCloseTo(27.80, 2);
    expect(a.dispersaoPct).toBeCloseTo(87.0, 0); // 25,99 está 87% acima
  });

  it('a origem NÃO afirma ser buy box', () => {
    const r = ofertaRepresentativa(ficha)!;
    expect(r.origem).toBe('primeira_da_api');
    expect(r.origem).not.toBe('buy_box');
  });

  it('oferta usada não vira o piso do mercado novo', () => {
    const a = avaliar(prod(), [of(25.99), of(5.00, { condicao: 'used' })]);
    expect(a.menorOfertaValida).toBe(25.99);
  });
});

describe('força da evidência — o caso Italle e Torino', () => {
  // Os dois são tradicional 500 g de verdade. Não estão mal classificados.
  // O que falta neles é CONCORRÊNCIA: uma oferta cada.
  it('ficha com uma oferta é evidência baixa, e continua no grupo principal', () => {
    const a = avaliar(prod({ titulo: 'Café Torrado E Moído Torino Clássico 500g' }), [of(76)]);
    expect(a.grupo).toBe('p500');     // não foi excluído por ser caro
    expect(a.evidencia).toBe('baixa');
  });

  it('cinco ofertas ou mais é evidência alta', () => {
    const a = avaliar(prod(), [of(20), of(21), of(22), of(23), of(24)]);
    expect(a.evidencia).toBe('alta');
  });

  it('a régua com concorrência exclui os de evidência baixa — e só eles', () => {
    const itens = [
      avaliar(prod({ ficha: 'A', titulo: 'Pilão Tradicional 500g' }), [of(13.9), of(20), of(25)]),
      avaliar(prod({ ficha: 'B', titulo: 'Melitta Tradicional 500g' }), [of(18.9), of(26)]),
      avaliar(prod({ ficha: 'C', titulo: 'Torino Clássico 500g' }), [of(76)]),
    ];
    const r = resumir(itens, '2026-10-20');
    expect(r.principal.n).toBe(3);
    expect(r.principalComConcorrencia.n).toBe(2);
    expect(r.principalComConcorrencia.max!).toBeLessThan(r.principal.max!);
  });

  it('a régua pela menor oferta é outra leitura, publicada lado a lado', () => {
    const itens = [avaliar(prod({ titulo: 'Pilão Tradicional 500g' }), [of(25.99), of(13.90)])];
    const r = resumir(itens, '2026-10-20');
    expect(r.principal.mediana).toBeCloseTo(51.98, 2);
    expect(r.principalPelaMenor.mediana).toBeCloseTo(27.80, 2);
  });

  it('as marcas da amostra são declaradas', () => {
    const itens = [
      avaliar(prod({ ficha: 'A', titulo: 'Pilão Tradicional 500g', marca: 'Pilão' }), [of(14)]),
      avaliar(prod({ ficha: 'B', titulo: 'Melitta Tradicional 500g', marca: 'Melitta' }), [of(19)]),
    ];
    expect(Object.keys(resumir(itens, '2026-10-20').marcas).sort()).toEqual(['Melitta', 'Pilão']);
  });

  it('NADA sai do relatorio — nem sem peso, nem capsula, nem caro', () => {
    const itens = [
      avaliar(prod({ ficha: 'A', titulo: 'Pilao Tradicional 500g' }), [of(14)]),
      avaliar(prod({ ficha: 'B', titulo: 'Capsula Dolce Gusto 500g' }), [of(90)]),
      avaliar(prod({ ficha: 'C', titulo: 'Cafe sem peso' , kgUnidade: null }), [of(30)]),
      avaliar(prod({ ficha: 'D', titulo: 'Cafe Torino 500g' }), [of(76)]),
    ];
    const r = resumir(itens, '2026-10-20');
    expect(r.totais.coletados).toBe(4);
    expect(r.todos).toHaveLength(4);
    expect(r.todos.map(x => x.ficha).sort()).toEqual(['A', 'B', 'C', 'D']);
  });
});


describe('OS CINCO CASOS QUE EU PERDI — nunca mais', () => {
  // Pilao Intenso, 3 Coracoes Fort, Cajuba, Conilon e Sabor da Fazenda
  // sairam da mediana por nao terem a palavra "tradicional" no titulo.
  const CASOS = [
    'Café Torrado e Moído Pilão Intenso 500g',
    'Café Em Pó Fort 500g 3 Corações',
    'Café Torrado e Moído Cajubá Frasco 500g',
    'Café Torrado E Moído 100% Conilon 500g',
    'Café Torrado E Moído Sabor Da Fazenda Pacote 500g',
  ];

  it('todos os cinco estao na prateleira de 500 g', () => {
    for (const t of CASOS) {
      expect(classificar(prod({ titulo: t })).grupo, t).toBe('p500');
    }
  });

  it('e nenhum some do relatorio', () => {
    const itens = CASOS.map((t, n) => avaliar(prod({ ficha: 'F' + n, titulo: t }), [of(25)]));
    const r = resumir(itens, '2026-10-20');
    expect(r.totais.coletados).toBe(5);
    expect(r.principal.n).toBe(5);
  });
});

describe('especie nao e segmento — a correcao dele', () => {
  it('100% arabica NAO vira tradicional nem gourmet', () => {
    const c = classificar(prod({ titulo: 'Café Torrado e Moído 100% Arábica 500g' }));
    expect(c.especie).toBe('arabica');
    expect(c.segmento).toBe('nao_declarado');   // a especie nao decide o segmento
  });

  it('conilon, robusta e canephora sao especie, segmento fica nao declarado', () => {
    for (const t of ['Café Conilon 500g', 'Café Robusta 500g', 'Café Canephora 500g']) {
      const c = classificar(prod({ titulo: t }));
      expect(c.especie, t).toBe('conilon_robusta');
      expect(c.segmento, t).toBe('nao_declarado');
    }
  });

  it('blend e especie; predominantemente arabica tambem', () => {
    expect(classificar(prod({ titulo: 'Café Blend 500g' })).especie).toBe('blend');
    expect(classificar(prod({ titulo: 'Café 100% predominantemente Arábica 500g' })).especie).toBe('blend');
  });

  it('arabica E conilon juntos viram blend', () => {
    expect(classificar(prod({ titulo: 'Café Arábica e Conilon 500g' })).especie).toBe('blend');
  });

  it('segmento declarado continua sendo lido', () => {
    expect(classificar(prod({ titulo: 'Café Tradicional 500g' })).segmento).toBe('tradicional');
    expect(classificar(prod({ titulo: 'Café Premium 500g' })).segmento).toBe('premium');
    expect(classificar(prod({ titulo: 'Café Especial SCA 85 pontos 500g' })).segmento).toBe('especial');
  });
});

describe('intensidade, torra e moagem — descrevem, nao filtram', () => {
  it('extraforte vence forte, que casaria junto', () => {
    expect(classificar(prod({ titulo: 'Café Extra Forte 500g' })).intensidade).toBe('extraforte');
    expect(classificar(prod({ titulo: 'Café Forte 500g' })).intensidade).toBe('forte');
    expect(classificar(prod({ titulo: 'Café Intenso 500g' })).intensidade).toBe('intenso');
    expect(classificar(prod({ titulo: 'Café Suave 500g' })).intensidade).toBe('suave');
  });

  it('media-escura conta como escura', () => {
    expect(classificar(prod({ titulo: 'Café Torra Média Escura 500g' })).torra).toBe('escura');
    expect(classificar(prod({ titulo: 'Café Torra Clara 500g' })).torra).toBe('clara');
  });

  it('moagem fina e grossa sao lidas', () => {
    expect(classificar(prod({ titulo: 'Café Moagem Fina 500g' })).moagem).toBe('fina');
    expect(classificar(prod({ titulo: 'Café Moído Grosso 500g' })).moagem).toBe('grossa');
  });

  it('nada declarado nao impede nada: continua em p500', () => {
    const c = classificar(prod({ titulo: 'Cajubá 500g', marca: 'Cajubá' }));
    expect(c.grupo).toBe('p500');
    expect(c.segmento).toBe('nao_declarado');
    expect(c.especie).toBe('nao_declarada');
    expect(c.intensidade).toBe('nao_declarada');
  });
});

describe('a mediana de 500 g nao mistura formato nem kit', () => {
  it('capsula, soluvel, grao, acessorio, kit e fardo ficam fora da mediana de p500', () => {
    const itens = [
      avaliar(prod({ ficha: '1', titulo: 'Café Tradicional 500g' }), [of(20)]),
      avaliar(prod({ ficha: '2', titulo: 'Cápsula Dolce Gusto 500g' }), [of(90)]),
      avaliar(prod({ ficha: '3', titulo: 'Café Solúvel 500g' }), [of(40)]),
      avaliar(prod({ ficha: '4', titulo: 'Café em Grãos 500g' }), [of(60)]),
      avaliar(prod({ ficha: '5', titulo: 'Xícara de Café 500g' }), [of(15)]),
      avaliar(prod({ ficha: '6', titulo: 'Café Tradicional 500g', unidades: 4 }), [of(80)]),
    ];
    const r = resumir(itens, '2026-10-20');
    expect(r.principal.n).toBe(1);        // so o pacote avulso de 500 g
    expect(r.totais.coletados).toBe(6);   // mas os SEIS estao no relatorio
    expect(r.porGrupo['kit'].n).toBe(1);  // e o kit tem R$/kg proprio
    expect(r.porGrupo['kit'].mediana).toBe(40);
  });
});
