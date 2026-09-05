// COFICO — configuração e conteúdo de contato (final). A base/canonical vem de env porque
// esta pasta vai migrar para domínio próprio; os contatos são conteúdo definitivo.
export const COFICO = {
  baseUrl: (import.meta.env.VITE_COFICO_BASE_URL || 'https://www.cafesaporino.com.br/coficobrasil').replace(/\/+$/, ''),
  cnpj: '66.006.929/0001-36',
  email: 'sac@coficobrasil.com.br',
  // Número próprio da COFICO. Antes era o pessoal do Vlademir, que agora fica só
  // com a Saporino. Um número por empresa, como as contas do Mercado Pago.
  phone: '(11) 93810-0909',
  instagram: 'https://instagram.com/coficobrasil',
  maps: 'https://maps.app.goo.gl/rYKCPWBXWpKzJFZD7',
} as const;
