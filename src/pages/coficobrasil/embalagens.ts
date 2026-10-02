// CATÁLOGO DE EMBALAGENS da COFICO.
//
// Fica num arquivo só para que cada embalagem nova seja UMA linha, sem mexer na página.
// Regras combinadas com o Vlademir (02/10/2026):
//   • pedido mínimo de 1.000 unidades (não vendemos escada de 50/100/250);
//   • sem preço no site — preço sai na tabela, com o comercial;
//   • código é o da COFICO; nunca o do fornecedor.
// O que não vier confirmado fica de fora: embalagem errada no site vira pedido errado.

export interface EmbalagemItem {
  /** "Stand Up Pouch Preto para Café — 250 g" */
  nome: string;
  /** "10 × 14,5 cm" */
  medidas?: string;
  /** "preto fosco", "kraft", "metalizado" */
  cor?: string;
  /** "50 g", "250 g", "500 g", "1 kg" */
  capacidade?: string;
  /** zip, válvula desgaseificadora, fundo que fica em pé… */
  detalhes?: string[];
  /** Código COFICO. Vazio = não mostra (nunca inventar). */
  codigo?: string;
  /** Caminho em /public/cofico. Vazio = card sem foto, em vez de imagem quebrada. */
  foto?: string;
  /** Fotos extras (medidas, usos, o que acompanha). Viram quadrinhos embaixo da principal. */
  fotos?: string[];
  /** Quando difere do mínimo padrão de 1.000 unidades. */
  minimo?: string;
  /** Descrição em parágrafos. Texto da COFICO: nunca copiar o do fornecedor. */
  descricao?: string[];
  /** Para que serve, em itens curtos. */
  aplicacoes?: string[];
  /** Ficha técnica: pares [rótulo, valor] que não cabem no resumo do topo. */
  ficha?: [string, string][];
  /** O que o cliente NÃO recebe junto. Evita reclamação depois da entrega. */
  naoAcompanha?: string;
  /** Perguntas que o comercial responde toda semana. */
  faq?: { p: string; r: string }[];
  /** Gramatura que existe na linha mas ainda não tem ficha/preço fechados. */
  sobConsulta?: boolean;
}

export interface GrupoEmbalagem {
  id: string;       // âncora da seção
  titulo: string;   // "Stand up pouch"
  resumo?: string;  // uma linha dizendo para que serve
  itens: EmbalagemItem[];
}

export const MINIMO_PADRAO = '1.000 unidades';

// Os grupos aparecem no site na ordem desta lista, e um grupo sem itens não aparece.
export const EMBALAGENS: GrupoEmbalagem[] = [
  {
    id: 'stand-up-pouch',
    titulo: 'Stand up pouch',
    resumo: 'Fica em pé na gôndola, com zip para fechar de novo. Serve café moído, em grãos, kit de degustação, amostra e brinde. A embalagem vai vazia: café, etiqueta e acessórios não acompanham.',
    itens: [
      {
        nome: 'Stand Up Pouch Preto para Café — 50 g',
        capacidade: '50 g',
        medidas: '10 × 14,5 cm',
        cor: 'preto fosco',
        codigo: 'SUPPF1014COFI-1000',
        detalhes: ['Zip para fechar de novo', 'Fica em pé', 'Espessura 0,180 mm'],
        descricao: [
          'Embalagem pronta para quem quer apresentar o produto com cara de marca. O stand up pouch preto fosco fica em pé na prateleira, tem zip para fechar de novo depois de aberto e acondiciona café moído, café em grãos e outros produtos sólidos em porções pequenas.',
          'É o formato que torrefação, cafeteria e marca artesanal usam para kit de degustação, amostra comercial, brinde e clube de assinatura — a mesma embalagem que resolve a venda de porção e a ação promocional.',
          'A capacidade de 50 g é referência: o peso que cabe de fato muda conforme a densidade, a moagem e o jeito de encher. Confira a medida contra o seu produto antes de fechar o pedido.',
        ],
        aplicacoes: [
          'Café moído e café em grãos',
          'Kits de degustação e amostras comerciais',
          'Brindes, eventos e ações promocionais',
          'Clubes de assinatura e porções fracionadas',
          'Outros produtos sólidos que caibam na medida',
        ],
        ficha: [
          ['Produto', 'Embalagem stand up pouch'],
          ['Espessura', '0,180 mm'],
          ['Capacidade de referência', 'até 50 g, conforme a densidade do produto'],
          ['Fechamento', 'zip, reaproveitável depois de aberto'],
          ['Unidade de venda', 'pacote fechado de 1.000 unidades'],
          ['Conteúdo', 'embalagens vazias, sem impressão'],
        ],
        naoAcompanha: 'Café, etiquetas, válvula, dosador, funil e itens de montagem não acompanham. Impressão da sua marca é serviço à parte — a COFICO faz em silkscreen.',
        faq: [
          { p: 'Para que serve esse pouch de 50 g?',
            r: 'Para acondicionar e apresentar café e outros produtos sólidos em porções pequenas, desde que caibam na medida. É o formato de venda fracionada, kit, amostra, degustação, brinde e produto artesanal.' },
          { p: 'Qual é a medida exata?',
            r: '10 cm de largura por 14,5 cm de altura. Compare com o seu produto e considere o espaço que o preenchimento e o fechamento ocupam.' },
          { p: 'Cabe exatamente 50 g?',
            r: '50 g é porção de referência. O peso real varia conforme a densidade, a granulometria e o formato do que você vai embalar.' },
          { p: 'O que significa a espessura de 0,180 mm?',
            r: 'É a espessura do material. Ela ajuda no manuseio, mas sozinha não define barreira, resistência nem tempo de conservação do seu produto.' },
          { p: 'Tem em outra cor?',
            r: 'Este item é preto fosco. Outras cores e outros tamanhos entram sob cotação — fale com o comercial com o volume que você precisa.' },
          { p: 'Qual é a quantidade mínima?',
            r: 'A COFICO vende a partir de 1.000 unidades por item. Não trabalhamos com lotes menores.' },
          { p: 'O café vem junto?',
            r: 'Não. A embalagem vai vazia. Café, grãos, etiquetas, acessórios e itens de montagem são comprados à parte.' },
          { p: 'Dá para imprimir a minha marca?',
            r: 'Dá. A COFICO imprime em silkscreen: você manda a arte, a gente ajusta ao formato, faz a prova e só produz depois da sua aprovação.' },
        ],
        foto: '/cofico/pouch-preto-50g.webp',
        fotos: [
          '/cofico/pouch-preto-50g-medidas.webp',
          '/cofico/pouch-preto-50g-possibilidades.webp',
          '/cofico/pouch-preto-50g-vazias.webp',
        ],
      },
      {
        nome: 'Stand Up Pouch para Café — 100 g',
        capacidade: '100 g',
        medidas: '14 × 18,5 + 4 cm',
        cor: 'preto, branco ou kraft',
        codigo: 'SUP1418COFI-1000',
        detalhes: ['Com ou sem válvula', '3 cores', 'Espessura 0,200 mm'],
        descricao: [
          'A mesma embalagem em três caras diferentes: preto para apresentação sóbria, branco como base neutra para a sua arte e kraft para quem quer o visual natural e artesanal. Sai com ou sem válvula, conforme o seu processo de envase.',
          'A medida é 14 cm de largura por 18,5 cm de altura mais 4 cm de base — esse "+4" é o fundo que faz a embalagem ficar em pé cheia. Espessura de 0,200 mm.',
          'O mínimo de 1.000 unidades é do pedido, não da cor: dá para fechar com 500 pretas e 500 kraft, ou 500 com válvula e 500 sem. Você monta a combinação e a gente produz.',
        ],
        aplicacoes: [
          'Café moído e café em grãos',
          'Linha própria de torrefação e cafeteria',
          'Kits, amostras e clubes de assinatura',
          'Brindes, eventos e ações promocionais',
          'Outros produtos sólidos compatíveis com a medida',
        ],
        ficha: [
          ['Produto', 'Embalagem stand up pouch'],
          ['Espessura', '0,200 mm'],
          ['Capacidade de referência', 'até 100 g, conforme a densidade do produto'],
          ['Cores', 'preto, branco e kraft'],
          ['Válvula', 'com ou sem — você escolhe por quantidade'],
          ['Prazo da versão com válvula', '5 dias úteis de confecção'],
          ['Unidade de venda', 'pedido fechado a partir de 1.000 unidades'],
          ['Conteúdo', 'embalagens vazias, sem impressão'],
        ],
        naoAcompanha: 'Café, etiquetas, dosador, funil, caixa e itens de montagem não acompanham. Impressão da sua marca é serviço à parte — a COFICO faz em silkscreen.',
        faq: [
          { p: 'Posso misturar as cores no mesmo pedido?',
            r: 'Pode. O mínimo de 1.000 unidades vale para o pedido inteiro. Você divide como quiser entre preto, branco e kraft — por exemplo 500 de uma e 500 de outra.' },
          { p: 'E com válvula e sem válvula, posso misturar também?',
            r: 'Pode, na mesma lógica: 500 com válvula e 500 sem fecham o mínimo. Só precisamos da quantidade certinha de cada combinação para produzir.' },
          { p: 'Para que serve a válvula?',
            r: 'Ela é usada em café recém-torrado, que libera gás depois da torra. Se a sua operação envasa logo após a torra, converse com o comercial sobre a especificação antes de fechar.' },
          { p: 'O que significa o "+4" na medida?',
            r: 'É o fundo: 14 cm de largura por 18,5 cm de altura, mais 4 cm de base. Esse fundo é o que faz a embalagem ficar em pé quando cheia.' },
          { p: 'Cabe exatamente 100 g?',
            r: '100 g é porção de referência. O peso real varia conforme a densidade, a granulometria e o jeito de encher.' },
          { p: 'Quanto tempo leva a versão com válvula?',
            r: 'A valvulada tem 5 dias úteis de confecção. A versão sem válvula sai mais rápido — o comercial confirma o prazo com o seu volume.' },
          { p: 'Qual é a quantidade mínima?',
            r: 'A COFICO fecha pedido a partir de 1.000 unidades, somando todas as combinações de cor e válvula.' },
          { p: 'Dá para imprimir a minha marca?',
            r: 'Dá. A COFICO imprime em silkscreen: você manda a arte, a gente ajusta ao formato, faz a prova e só produz depois da sua aprovação.' },
        ],
      },
      { nome: 'Stand Up Pouch para Café — 250 g', capacidade: '250 g', sobConsulta: true },
      { nome: 'Stand Up Pouch para Café — 500 g', capacidade: '500 g', sobConsulta: true },
      { nome: 'Stand Up Pouch para Café — 1 kg', capacidade: '1 kg', sobConsulta: true },
    ],
  },
  {
    id: 'sanfonada',
    titulo: 'Sanfonada (lateral)',
    resumo: 'A embalagem clássica de café, com fole nas laterais: enche bem, empilha na prateleira e é a que o consumidor reconhece como pacote de café. Vai vazia, para você envasar e etiquetar.',
    itens: [
      { nome: 'Sanfonada — 100 g', capacidade: '100 g', sobConsulta: true },
      { nome: 'Sanfonada — 250 g', capacidade: '250 g', sobConsulta: true },
      { nome: 'Sanfonada — 500 g', capacidade: '500 g', sobConsulta: true },
      { nome: 'Sanfonada — 1 kg', capacidade: '1 kg', sobConsulta: true },
    ],
  },
  {
    id: 'quatro-soldas',
    titulo: '4 soldas',
    resumo: 'Fechamento soldado nos quatro lados, formato reto e limpo. Usada para linha própria, porção maior e quem quer apresentação sóbria, sem fole aparente.',
    itens: [
      { nome: '4 soldas — 250 g', capacidade: '250 g', sobConsulta: true },
      { nome: '4 soldas — 500 g', capacidade: '500 g', sobConsulta: true },
      { nome: '4 soldas — 1 kg', capacidade: '1 kg', sobConsulta: true },
      { nome: '4 soldas — 5 kg', capacidade: '5 kg', sobConsulta: true },
    ],
  },
  {
    id: 'almofada',
    titulo: 'Almofada',
    resumo: 'Embalagem deitada, sem fundo: o formato mais econômico por unidade. Serve porção, amostra e produto que não precisa ficar em pé na prateleira.',
    itens: [
      { nome: 'Almofada — 250 g', capacidade: '250 g', sobConsulta: true },
      { nome: 'Almofada — 500 g', capacidade: '500 g', sobConsulta: true },
    ],
  },
  {
    id: 'sacos-plasticos',
    titulo: 'Sacos plásticos',
    resumo: 'Saco liso para envase, transporte e armazenamento interno. É o item de operação: não vai para a gôndola, mas segura a produção.',
    itens: [],
  },
];
