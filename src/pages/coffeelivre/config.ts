// Coffee LiVRE — configuração central da plataforma.
//
// Existe por um motivo só: hoje a experiência mora em
// coficobrasil.com.br/coffeelivre e um dia vai morar em coffeelivre.com.br.
// Se o caminho base estiver espalhado por vinte arquivos, mudar de domínio
// vira reconstrução. Aqui ele é uma constante e um helper.
//
// REGRA: nenhum componente do Coffee LiVRE escreve "/coffeelivre" à mão.
// Todo caminho sai de `rota()`.

/** Prefixo de todas as rotas da plataforma. Mudar aqui muda o site inteiro. */
export const BASE = '/coffeelivre';

/**
 * Monta um caminho da plataforma.
 * rota()            -> /coffeelivre
 * rota('loja/x')    -> /coffeelivre/loja/x
 */
export function rota(caminho = ''): string {
  const limpo = caminho.replace(/^\/+/, '');
  return limpo ? `${BASE}/${limpo}` : BASE;
}

/** Navegação interna sem recarregar a página, no padrão do roteador do projeto. */
export function navegar(caminho: string) {
  window.history.pushState({}, '', rota(caminho));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * URL permanente de um café. É o destino do QR Code.
 *
 * QR impresso em embalagem, display ou material de feira aponta para cá, e
 * embalagem não se recolhe: o slug de um produto que já circulou NUNCA
 * pode mudar. A troca de domínio, essa sim, é livre — muda BASE e todo QR
 * antigo continua funcionando por redirecionamento.
 */
export function rotaDoProduto(slug: string): string {
  return rota(`cafe/${slug}`);
}

/** URL permanente da vitrine de um vendedor. */
export function rotaDaLoja(slug: string): string {
  return rota(`loja/${slug}`);
}

/** Listagem de uma categoria. */
export function rotaDaCategoria(slug: string): string {
  return rota(`categoria/${slug}`);
}

export const MARCA = {
  nome: 'Coffee LiVRE',
  titulo: 'Coffee LiVRE — O marketplace do café',
  descricao: 'Produtores, torrefações e marcas de café do Brasil inteiro em um só lugar.',
  logo: '/coffeelivre/coffee-livre-logo.png',
  icone: '/coffeelivre/coffee-livre-icon.png',
} as const;

/**
 * Enquanto a demonstração for privada, nada de buscador.
 * Some quando o marketplace abrir ao público.
 */
export const DEMONSTRACAO_PRIVADA = true;

/** Chave da sessão de demonstração no navegador. */
export const CHAVE_SESSAO = 'livre_access';
