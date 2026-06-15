// Normalizador de preços e-commerce — validado em 440 anúncios reais (handoff).
// O filtro de sanidade é OBRIGATÓRIO: sem ele, um peso lido errado vira R$57.000/kg.
export type UnitType = 'torrado_moido' | 'graos' | 'soluvel' | 'capsula' | 'filtro' | 'outro';

const SANE: Record<string, [number, number]> = {
  torrado_moido: [15, 200], graos: [30, 300], soluvel: [30, 800],
  capsula: [0, Infinity], filtro: [0, Infinity], outro: [0, Infinity],
};

export function extractWeightG(title: string): number | null {
  const t = title.toLowerCase().replace(/\./g, ',');
  let m = t.match(/(\d+(?:,\d+)?)\s*kg/);
  if (m) return parseFloat(m[1].replace(',', '.')) * 1000;
  m = t.match(/(\d+(?:,\d+)?)\s*g(?![a-z])/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

export function classifyType(title: string, category?: string | null): UnitType {
  const t = title.toLowerCase(); const c = (category || '');
  if (/c[áa]psula|nespresso|dolce gusto/.test(t) || c.includes('CAPSULE')) return 'capsula';
  if (/filtro|coador|papel/.test(t)) return 'filtro';
  if (/sol[úu]vel|instant|cappuccino|capuccino/.test(t) || c.includes('INSTANT')) return 'soluvel';
  if (/gr[ãa]os?|em gr[ãa]o|beans/.test(t) && !/mo[íi]do/.test(t)) return 'graos';
  return 'torrado_moido';
}

export function isArabica(title: string): boolean {
  return /ar[áa]bica/.test(title.toLowerCase());
}

export function normalize(raw: any) {
  const title: string = raw.title ?? '';
  const price: number | null = typeof raw.price === 'number' ? raw.price : null;
  const weight_g = extractWeightG(title);
  const unit_type = classifyType(title, raw.category);
  const price_per_kg = (price && weight_g) ? +(price / (weight_g / 1000)).toFixed(2) : null;
  let is_suspect = false;
  if (price_per_kg != null) {
    const [lo, hi] = SANE[unit_type] ?? [0, Infinity];
    if (price_per_kg < lo || price_per_kg > hi) is_suspect = true;
  }
  return { weight_g, unit_type, is_arabica: isArabica(title), price_per_kg, is_suspect };
}
