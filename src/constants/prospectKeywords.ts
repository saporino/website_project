// Biblioteca de keywords de prospecção (Apify Google Maps) — SEPARADA dos 12 segmentos fixos.
// Regra: muitas keywords -> 1 segmento PROVISÓRIO (o definitivo, que trava o preço, é confirmado
// na conversão do lead em cliente). `places: false` = cargo/intenção (não é lugar no mapa) -> NÃO
// vai pro Apify; fica guardado para outro canal (LinkedIn/busca) no futuro.
import type { ClientSegment } from './segments';

export interface KeywordGroup {
  category: string;
  segment: ClientSegment | null;      // segmento provisório mapeado
  places: boolean;                    // true = serve para o Apify (negócio com endereço no mapa)
  channel?: 'apify' | 'fora_do_mapa'; // fora_do_mapa = LinkedIn/busca (cargo/intenção)
  note?: string;
  keywords: string[];
}

export const PROSPECT_KEYWORDS: KeywordGroup[] = [
  {
    category: 'Distribuidoras',
    segment: 'distribuidora', places: true, channel: 'apify',
    keywords: [
      'distribuidora de café', 'distribuidora de alimentos', 'distribuidora de produtos alimentícios',
      'distribuidora food service', 'distribuidora de bebidas', 'distribuidora de mercearia',
      'distribuidora de secos e molhados', 'distribuidora de produtos para padaria',
      'distribuidora de insumos para panificação', 'distribuidora horeca', 'distribuidora para restaurantes',
      'distribuidora para hotéis', 'distribuidora para cafeterias', 'distribuidora para padarias',
      'distribuidora para cozinhas industriais', 'fornecedor de café', 'fornecedor de alimentos',
      'fornecedor food service', 'central de abastecimento',
    ],
  },
  {
    category: 'Atacadistas / Atacarejo',
    segment: 'atacado', places: true, channel: 'apify',
    keywords: [
      'distribuidora atacadista', 'atacadista de café', 'atacado de café', 'atacado de alimentos',
      'atacado de bebidas', 'cash and carry', 'atacarejo', 'supermercado atacado', 'empório atacadista',
      'revenda de café', 'café para revenda',
    ],
  },
  {
    category: 'Café e Torrefações',
    segment: 'distribuidora', places: true, channel: 'apify',
    note: 'Prospects de café cru/verde e revenda; segmento provisório distribuidora.',
    keywords: [
      'torrefação de café', 'torrefadora de café', 'indústria de café', 'fábrica de café', 'micro torrefação',
      'torra artesanal', 'café especial', 'café gourmet', 'café premium', 'café em grão', 'café torrado',
      'café moído', 'beneficiadora de café', 'rebeneficiadora de café', 'cooperativa de café',
      'armazém de café', 'trading de café',
    ],
  },
  {
    category: 'Padarias e Confeitarias',
    segment: 'padaria', places: true, channel: 'apify',
    keywords: [
      'padaria', 'padaria e confeitaria', 'panificadora', 'padaria artesanal', 'padaria gourmet',
      'padaria premium', 'padaria industrial', 'confeitaria', 'doceria', 'casa de bolos', 'panificação',
      'rede de padarias',
    ],
  },
  {
    category: 'Cafeterias',
    segment: 'cafeteria', places: true, channel: 'apify',
    keywords: [
      'cafeteria', 'coffee shop', 'cafeteria artesanal', 'cafeteria premium', 'cafeteria de shopping',
      'casa de café', 'rede de cafeterias',
    ],
  },
  {
    category: 'Restaurantes',
    segment: 'restaurante', places: true, channel: 'apify',
    keywords: [
      'restaurante', 'restaurante por quilo', 'restaurante self service', 'self service',
      'restaurante executivo', 'churrascaria', 'pizzaria', 'hamburgueria',
    ],
  },
  {
    category: 'Cozinha Industrial / Food Service',
    segment: 'cozinha_industrial', places: true, channel: 'apify',
    keywords: [
      'restaurante corporativo', 'restaurante industrial', 'buffet', 'buffet corporativo', 'catering',
      'empresa de catering', 'alimentação coletiva', 'empresa de alimentação', 'refeitório',
      'refeição coletiva', 'cozinha industrial', 'cozinha corporativa', 'operador food service',
    ],
  },
  {
    category: 'Lanchonetes / Alto consumo',
    segment: 'lanchonete', places: true, channel: 'apify',
    keywords: ['lanchonete', 'sorveteria', 'açaíteria', 'casa de sucos'],
  },
  {
    category: 'Hotéis e Hospitalidade',
    segment: 'cozinha_industrial', places: true, channel: 'apify',
    note: 'Sem segmento Hotel ainda; provisório = cozinha_industrial (consumo food-service).',
    keywords: [
      'hotel', 'hotel executivo', 'hotel fazenda', 'resort', 'pousada', 'hostel', 'apart hotel',
      'rede hoteleira',
    ],
  },
  {
    category: 'Supermercados e Varejo',
    segment: 'varejo', places: true, channel: 'apify',
    keywords: [
      'supermercado', 'hipermercado', 'mercado', 'loja de conveniência', 'conveniência',
      'rede de supermercados', 'posto de gasolina', 'rede de postos',
    ],
  },
  {
    category: 'Mini mercado / Mercearia',
    segment: 'mini_mercado', places: true, channel: 'apify',
    keywords: ['mini mercado', 'mercado de bairro', 'mercadinho', 'mercearia', 'armazém'],
  },
  {
    category: 'Mercadinho de Condomínio',
    segment: 'mercadinho_condominio', places: true, channel: 'apify',
    keywords: ['mercadinho de condomínio', 'mercado autônomo de condomínio'],
  },
  {
    category: 'Empório',
    segment: 'emporio', places: true, channel: 'apify',
    keywords: ['empório', 'empório gourmet'],
  },
  {
    category: 'Hortifruti',
    segment: 'hortifruti', places: true, channel: 'apify',
    keywords: ['hortifruti', 'sacolão', 'quitanda'],
  },
  // ----- NÃO-PLACES: cargo/intenção -> NÃO vai pro Apify (guardado p/ LinkedIn/busca) -----
  {
    category: 'Compradores (cargo — fora do mapa)',
    segment: null, places: false, channel: 'fora_do_mapa',
    note: 'Cargo/pessoa, não é lugar no Google Maps. Reservado p/ LinkedIn/busca.',
    keywords: [
      'comprador de café', 'comprador food service', 'comprador horeca', 'gerente de compras',
      'coordenador de compras', 'supervisor de compras', 'analista de compras', 'central de compras',
      'departamento de compras', 'buyer food service', 'buyer horeca', 'procurement manager',
    ],
  },
  {
    category: 'Intenção B2B (fora do mapa)',
    segment: null, places: false, channel: 'fora_do_mapa',
    note: 'Intenção de venda, não tipo de estabelecimento. Reservado p/ busca/SEO.',
    keywords: [
      'fornecedor de café para restaurante', 'fornecedor de café para hotel', 'fornecedor de café para padaria',
      'fornecedor de café para cafeteria', 'fornecedor de café corporativo', 'café para empresas',
      'café para escritórios', 'café para revenda', 'café para distribuição', 'café para horeca',
    ],
  },
];

// Grupos que de fato vão pro Apify (Google Maps).
export const APIFY_KEYWORD_GROUPS = PROSPECT_KEYWORDS.filter(g => g.places);

// Mapa categoria -> segmento provisório.
export const CATEGORY_SEGMENT: Record<string, ClientSegment | null> =
  Object.fromEntries(PROSPECT_KEYWORDS.map(g => [g.category, g.segment]));
