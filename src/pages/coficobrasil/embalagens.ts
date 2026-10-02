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
    ],
  },
];
