// COFICO — configuração. Tudo que é ambiente/externo vem daqui, porque esta pasta
// vai migrar para um DOMÍNIO PRÓPRIO no futuro. Nenhum valor de URL fica hardcoded.
// Base/canonical vêm de VITE_COFICO_BASE_URL. Contato/redes são configuráveis (env);
// o que não estiver setado simplesmente não aparece (não inventamos dado de empresa).

export const COFICO = {
  // Domínio próprio (ex.: https://www.coficobrasil.com.br). Sem barra final.
  baseUrl: (import.meta.env.VITE_COFICO_BASE_URL || '').replace(/\/+$/, ''),
  // Fato confirmado (vai também no JSON-LD como taxID).
  cnpj: '66.006.929/0001-36',
  // Contato e redes — só aparecem se configurados via env.
  email: import.meta.env.VITE_COFICO_EMAIL || '',
  phone: import.meta.env.VITE_COFICO_PHONE || '',
  instagram: import.meta.env.VITE_COFICO_INSTAGRAM || '',
  linkedin: import.meta.env.VITE_COFICO_LINKEDIN || '',
  google: import.meta.env.VITE_COFICO_GOOGLE || '',
} as const;
