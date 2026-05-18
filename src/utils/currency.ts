// Utilitarios de moeda BR: aceita "27.360,00" / "27360,00" / "27360" / 27360 e normaliza
export const parseBR = (val: string | number | null | undefined): number | null => {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
};

export const formatBR = (num: number | null | undefined, decimals: number = 2): string => {
  if (num == null || isNaN(num as number)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num as number);
};

export const formatBRL = (num: number | null | undefined): string => {
  if (num == null || isNaN(num as number)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num as number);
};
