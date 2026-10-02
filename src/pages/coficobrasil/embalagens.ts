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
