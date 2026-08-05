// COFICO — configuração e conteúdo de contato (final). A base/canonical vem de env porque
// esta pasta vai migrar para domínio próprio; os contatos são conteúdo definitivo.
export const COFICO = {
  baseUrl: (import.meta.env.VITE_COFICO_BASE_URL || 'https://www.cafesaporino.com.br/coficobrasil').replace(/\/+$/, ''),
  cnpj: '66.006.929/0001-36',
  email: 'sac@coficobrasil.com.br',
  phone: '(11) 91771-9798',
  instagram: 'https://instagram.com/coficobrasil',
  maps: 'https://maps.app.goo.gl/rYKCPWBXWpKzJFZD7',
} as const;
