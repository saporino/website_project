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

/** Domínio próprio da COFICO? Lá as páginas legais moram na raiz (/privacidade);
 *  dentro do site da Saporino elas moram sob /coficobrasil/ — senão o link cairia
 *  em cafesaporino.com.br/privacidade, que é da outra marca e não existe. */
export function noDominioCofico(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  const h = host.toLowerCase();
  return h === 'coficobrasil.com.br' || h.endsWith('.coficobrasil.com.br');
}

export const SLUGS_LEGAIS = ['privacidade', 'termos', 'exclusao-de-dados'] as const;

/** URL de uma página legal da COFICO ('privacidade' | 'termos' | 'exclusao-de-dados'). */
export function linkLegal(slug: string, host?: string) {
  return noDominioCofico(host) ? `/${slug}` : `/coficobrasil/${slug}`;
}

/** O caminho pedido é uma página legal da COFICO? Devolve o slug, ou null.
 *  `/coficobrasil/<slug>` vale em qualquer domínio (é como a página é servida sob o site
 *  da Saporino, e é como se testa em localhost). `/<slug>` só vale no domínio da COFICO. */
export function rotaLegalCofico(caminho: string, host?: string): string | null {
  const limpo = caminho.replace(/\/+$/, '') || '/';
  const sob = limpo.match(/^\/coficobrasil\/(.+)$/);
  const alvo = sob ? sob[1] : noDominioCofico(host) ? limpo.slice(1) : '';
  return (SLUGS_LEGAIS as readonly string[]).includes(alvo) ? alvo : null;
}
