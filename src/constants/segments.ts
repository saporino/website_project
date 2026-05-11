export const CLIENT_SEGMENTS = [
  { value: 'distribuidora',         label: 'Distribuidora' },
  { value: 'atacado',               label: 'Atacado' },
  { value: 'varejo',                label: 'Varejo' },
  { value: 'mini_mercado',          label: 'Mini Mercado' },
  { value: 'hortifruti',            label: 'Hortifruti' },
  { value: 'emporio',               label: 'Empório' },
  { value: 'padaria',               label: 'Padaria' },
  { value: 'cafeteria',             label: 'Cafeteria' },
  { value: 'cozinha_industrial',    label: 'Cozinha Industrial' },
  { value: 'restaurante',           label: 'Restaurante' },
  { value: 'lanchonete',            label: 'Lanchonete' },
  { value: 'mercadinho_condominio', label: 'Mercadinho de Condomínio' },
] as const;

export type ClientSegment = typeof CLIENT_SEGMENTS[number]['value'];

export const MARKETPLACE_SEGMENTS = [
  { value: 'amazon',        label: 'Amazon' },
  { value: 'mercado_livre', label: 'Mercado Livre' },
  { value: 'shopee',        label: 'Shopee' },
  { value: 'tiktok_shop',   label: 'TikTok Shop' },
] as const;

export type MarketplaceSegment = typeof MARKETPLACE_SEGMENTS[number]['value'];

export const ALL_SEGMENTS = [...CLIENT_SEGMENTS, ...MARKETPLACE_SEGMENTS] as const;

export const SEGMENT_LABEL: Record<string, string> = Object.fromEntries(
  ALL_SEGMENTS.map(s => [s.value, s.label])
);
