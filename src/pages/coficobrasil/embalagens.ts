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
    resumo: 'Fica em pé na gôndola, com zip para fechar de novo. O formato mais usado por torrefação pequena e média.',
    itens: [],
  },
];
