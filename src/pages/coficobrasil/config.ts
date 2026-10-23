// COFICO — configuração e conteúdo de contato (final). A base/canonical vem de env porque
// esta pasta vai migrar para domínio próprio; os contatos são conteúdo definitivo.
export const COFICO = {
  baseUrl: (import.meta.env.VITE_COFICO_BASE_URL || 'https://www.cafesaporino.com.br/coficobrasil').replace(/\/+$/, ''),
  cnpj: '66.006.929/0001-36',
  // Identificacao juridica. Estava repetida em legal.json e em comentarios; agora tem
  // um lugar so, que e o que a pagina e as politicas leem.
  razaoSocial: 'V. Medeiros de Santi Ltda',
  // Endereco CADASTRAL da empresa. Varzea Paulista e o centro de distribuicao, e aparece
  // nomeado como tal nas outras secoes do site - os dois nunca podem ser confundidos.
  endereco: 'Rua dos Chorões, 110 — Jardim Primavera, Amparo/SP, CEP 13901-321',
  email: 'sac@coficobrasil.com.br',
  // Número próprio da COFICO. Antes era o pessoal do Vlademir, que agora fica só
  // com a Saporino. Um número por empresa, como as contas do Mercado Pago.
  phone: '(11) 93810-0909',
  instagram: 'https://instagram.com/coficobrasil',
  maps: 'https://maps.app.goo.gl/rYKCPWBXWpKzJFZD7',
} as const;

/** Subdomínio do RepCo. Existe separado porque `repco.coficobrasil.com.br` É um domínio
 *  da COFICO, mas NÃO é o site institucional dela: a raiz ali abre o portal, não a vitrine.
 *  Sem esta distinção, qualquer subdomínio cairia na página institucional. */
export const HOST_REPCO = 'repco.coficobrasil.com.br';

export function noDominioRepCo(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  return host.toLowerCase().replace(/^www\./, '') === HOST_REPCO;
}

/** Domínio próprio da COFICO? Lá as páginas legais moram na raiz (/privacidade);
 *  dentro do site da Saporino elas moram sob /coficobrasil/ — senão o link cairia
 *  em cafesaporino.com.br/privacidade, que é da outra marca e não existe. */
export function noDominioCofico(host = typeof window === 'undefined' ? '' : window.location.hostname) {
  const h = host.toLowerCase();
  // O subdomínio do RepCo é da COFICO para efeito de marca (título, favicon, páginas
  // legais), mas NÃO serve a vitrine na raiz — quem decide isso é `noDominioRepCo`.
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

/**
 * Caminho das páginas do cliente PJ, ciente do domínio — mesmo princípio de
 * `linkLegal`: no domínio da COFICO elas moram na raiz; sob o site da Saporino,
 * em /coficobrasil/... Link fixo aponta para o lugar errado em metade dos casos.
 */
export function linkPortalPJ(caminho: 'cadastro' | 'minha-empresa', host?: string): string {
  return noDominioCofico(host) ? `/${caminho}` : `/coficobrasil/${caminho}`;
}

/** Domínio público da COFICO, para link ABSOLUTO vindo do site da Saporino. */
export const COFICO_URL = 'https://www.coficobrasil.com.br';

/**
 * "Trabalhe conosco" é da COFICO — ela é a empregadora, a vaga é dela, o texto
 * é dela e o formulário é dela. A página estava morando em
 * cafesaporino.com.br/trabalhe-conosco, com a marca COFICO dentro do site da
 * Saporino: exatamente o vazamento de marca que as páginas legais já evitam.
 *
 * Do site da Saporino o link é ABSOLUTO e troca de domínio de propósito — quem
 * clica tem de chegar na COFICO, não numa página da COFICO hospedada na
 * Saporino. No domínio da COFICO (e em localhost, para dar para testar) é
 * caminho relativo normal.
 */
export function linkTrabalheConosco(host?: string): string {
  const h = (host ?? (typeof window === 'undefined' ? '' : window.location.hostname)).toLowerCase();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(h);
  return noDominioCofico(h) || local ? '/trabalhe-conosco' : `${COFICO_URL}/trabalhe-conosco`;
}
