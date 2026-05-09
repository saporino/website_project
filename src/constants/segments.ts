export const CLIENT_SEGMENTS = [
  { value: 'distribuidora',      label: 'Distribuidora' },
  { value: 'atacado',            label: 'Atacado' },
  { value: 'varejo',             label: 'Varejo' },
  { value: 'mini_mercado',       label: 'Mini Mercado' },
  { value: 'hortifruti',         label: 'Hortifruti' },
  { value: 'emporio',            label: 'Empório' },
  { value: 'padaria',            label: 'Padaria' },
  { value: 'cafeteria',         label: 'Cafeteria' },
  { value: 'cozinha_industrial', label: 'Cozinha Industrial' },
  { value: 'restaurante',        label: 'Restaurante' },
  { value: 'lanchonete',         label: 'Lanchonete' },
] as const;

export type ClientSegment = typeof CLIENT_SEGMENTS[number]['value'];

export const SEGMENT_LABEL: Record<string, string> =
  Object.fromEntries(CLIENT_SEGMENTS.map(s => [s.value, s.label]));
