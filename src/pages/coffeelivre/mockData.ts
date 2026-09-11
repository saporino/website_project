// Coffee LiVRE — o que AINDA não vem do banco.
//
// Este arquivo encolheu na unidade 3. Produtos, lojas e categorias saíram
// daqui e passaram a vir do catálogo `lv_*` pelo `catalogo.ts`. O que
// sobrou está listado abaixo, e cada item diz quando sai.
//
// Manter o que sobrou aqui, em vez de espalhar pelos componentes, é o que
// torna a dívida visível: basta abrir este arquivo para saber o que ainda
// é maquete.

/**
 * AINDA MOCK — as oito origens da seção "Compre por origem".
 *
 * Sai quando as regiões virarem entidade de catálogo. Hoje elas não são
 * filtro nem página: são um bloco visual. Quando a origem virar navegação
 * de verdade, ela vira tabela e este bloco lê do banco como o resto.
 *
 * [UF, nome, descrição, cor inicial, cor final]
 */
export const origens: [string, string, string, string, string][] = [
  ['Minas Gerais', 'Sul de Minas', 'Doce, achocolatado, corpo médio', '#DA6418', '#6A2A08'],
  ['Minas Gerais', 'Cerrado Mineiro', 'Denominação de origem, notas de nozes', '#8A5A2B', '#40240E'],
  ['São Paulo', 'Alta Mogiana', 'Caramelo, acidez equilibrada', '#2F6B4F', '#123526'],
  ['Minas Gerais', 'Mantiqueira', 'Frutado, floral, microlotes', '#A2472A', '#4A1A0C'],
  ['Bahia', 'Chapada Diamantina', 'Complexo, adocicado, premiado', '#C2821B', '#5A3606'],
  ['Espírito Santo', 'Montanhas do ES', 'Arábicas de altitude e conilon', '#2F5B8A', '#11273F'],
  ['Rondônia', 'Matas de Rondônia', 'Robustas Amazônicos', '#3A7A6A', '#0F332B'],
  ['Paraná', 'Norte Pioneiro', 'Cítrico, corpo leve', '#5A3524', '#2A1911'],
];

/**
 * AINDA MOCK — as colunas do rodapé.
 *
 * Sai quando o CMS existir (unidade 8). São links institucionais, e
 * institucional é conteúdo de CMS, não de catálogo.
 */
export const colunasDoRodape: [string, string[]][] = [
  ['Comprar', ['Cafés especiais', 'Assinaturas', 'Cupons', 'Para empresas']],
  ['Vender', ['Como vender', 'Tarifas', 'Logística', 'Central do vendedor']],
  ['Ajuda', ['Meus pedidos', 'Trocas e devoluções', 'Compra garantida', 'Fale conosco']],
  ['Institucional', ['Quem somos', 'Termos de uso', 'Privacidade', 'Trabalhe conosco']],
];

// A marca vive no config.ts. Estes dois ficam por compatibilidade do
// rodapé e apontam para lá.
export { MARCA as _MARCA } from './config';
export const LOGO = '/coffeelivre/coffee-livre-logo.png';
export const ALT_LOGO = 'Coffee LiVRE — O marketplace do café';
