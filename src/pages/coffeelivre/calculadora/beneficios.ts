// Calculadora de Economia LiVRE — o que não é dinheiro.
//
// Cada célula dos concorrentes só diz EXISTE ou LIMITADO quando o estudo
// de benchmark sustenta; o resto é NÃO ENCONTRADO, que significa "não
// achamos", e não "não existe". Do lado do Coffee LiVRE, o que ainda não
// está construído é PLANEJADO, nunca EXISTE.
//
// Texto, não tarifa: por isso mora no código. Tarifa mora no banco.

export type StatusDoRecurso = 'existe' | 'limitado' | 'nao_encontrado' | 'planejado';

export const ROTULO_DO_STATUS: Record<StatusDoRecurso, string> = {
  existe: 'Existe',
  limitado: 'Limitado',
  nao_encontrado: 'Não encontrado',
  planejado: 'Planejado no LiVRE',
};

export type ColunaDeBeneficio = 'coffeelivre' | 'mercado_livre' | 'shopee' | 'amazon' | 'magalu';

export interface Celula { status: StatusDoRecurso; nota?: string }

export interface Beneficio {
  recurso: string;
  celulas: Record<ColunaDeBeneficio, Celula>;
}

export const BENEFICIOS: Beneficio[] = [
  {
    recurso: 'Marketplace só de café',
    celulas: {
      coffeelivre: { status: 'existe' },
      mercado_livre: { status: 'nao_encontrado', nota: 'Generalista; café é subcategoria de Alimentos e Bebidas.' },
      shopee: { status: 'nao_encontrado', nota: 'Generalista; café no 3º nível de categoria.' },
      amazon: { status: 'nao_encontrado', nota: 'Generalista; café tratado como item de mercearia.' },
      magalu: { status: 'nao_encontrado', nota: 'Generalista.' },
    },
  },
  {
    recurso: 'Ficha do café com origem, torra e processo (LiVRE Passport)',
    celulas: {
      coffeelivre: { status: 'existe' },
      mercado_livre: { status: 'nao_encontrado', nota: 'Ficha técnica genérica; atributos de café não mapeados no estudo.' },
      shopee: { status: 'nao_encontrado', nota: 'Filtros genéricos; sem torra, moagem, espécie ou processo.' },
      amazon: { status: 'limitado', nota: 'Filtros de torra e cafeína; sem produtor, origem ou processo.' },
      magalu: { status: 'limitado', nota: 'Filtros de tipo de grão e pontuação com valores inconsistentes; origem em texto livre.' },
    },
  },
  {
    recurso: 'Desconto por quantidade',
    celulas: {
      coffeelivre: { status: 'existe', nota: 'Escada de quantidade na página do produto.' },
      mercado_livre: { status: 'existe', nota: 'Central de Marketing: desconto por quantidade.' },
      shopee: { status: 'existe', nota: 'Leve Mais por Menos, com níveis progressivos.' },
      amazon: { status: 'existe', nota: 'Promoção com desconto progressivo por quantidade.' },
      magalu: { status: 'nao_encontrado', nota: 'Nenhuma mecânica nativa observada.' },
    },
  },
  {
    recurso: 'Estoque e envio pela plataforma (fulfillment)',
    celulas: {
      coffeelivre: { status: 'planejado', nota: 'CD em implantação; o estoque por lote já está no sistema.' },
      mercado_livre: { status: 'existe', nota: 'Full.' },
      shopee: { status: 'existe', nota: 'Full.' },
      amazon: { status: 'existe', nota: 'FBA.' },
      magalu: { status: 'existe', nota: 'Fulfillment Magalu.' },
    },
  },
  {
    recurso: 'Lote e data de torra no estoque',
    celulas: {
      coffeelivre: { status: 'planejado', nota: 'Lote com data de torra já existe no estoque; Lot Passport planejado.' },
      mercado_livre: { status: 'limitado', nota: 'Full exige validade e lote visíveis na embalagem.' },
      shopee: { status: 'nao_encontrado', nota: 'Controle por lote e FEFO não descritos ao vendedor.' },
      amazon: { status: 'nao_encontrado', nota: 'Controle de lote no FBA brasileiro não publicado.' },
      magalu: { status: 'nao_encontrado', nota: 'Data de torra em 0 de 9 fichas auditadas.' },
    },
  },
  {
    recurso: 'Recomendações ao vendedor (LiVRE Copiloto)',
    celulas: {
      coffeelivre: { status: 'existe', nota: 'Por regra, no Seller Central.' },
      mercado_livre: { status: 'limitado', nota: 'Métricas de custos e análise de mercado, sem recomendação.' },
      shopee: { status: 'limitado', nota: 'Informações gerenciais.' },
      amazon: { status: 'limitado', nota: 'Relatórios de tráfego e desempenho.' },
      magalu: { status: 'limitado', nota: 'Resultado por item; funil só por e-mail semanal.' },
    },
  },
  {
    recurso: 'Comparação entre cafés por atributo',
    celulas: {
      coffeelivre: { status: 'planejado' },
      mercado_livre: { status: 'nao_encontrado' },
      shopee: { status: 'nao_encontrado' },
      amazon: { status: 'limitado', nota: 'Filtros de torra e cafeína na busca.' },
      magalu: { status: 'nao_encontrado' },
    },
  },
  {
    recurso: 'Preço por quilo visível',
    celulas: {
      coffeelivre: { status: 'planejado' },
      mercado_livre: { status: 'limitado', nota: 'Aparece pontualmente, segundo o estudo da Amazon.' },
      shopee: { status: 'nao_encontrado' },
      amazon: { status: 'existe', nota: 'Em todo card de resultado.' },
      magalu: { status: 'nao_encontrado', nota: 'Zero ocorrências no site.' },
    },
  },
  {
    recurso: 'Canal B2B para o vendedor',
    celulas: {
      coffeelivre: { status: 'planejado' },
      mercado_livre: { status: 'nao_encontrado' },
      shopee: { status: 'nao_encontrado' },
      amazon: { status: 'nao_encontrado', nota: 'Amazon Business não opera no Brasil.' },
      magalu: { status: 'limitado', nota: 'Magalu Empresas é venda própria; o vendedor 3P não tem canal B2B.' },
    },
  },
];

export const FONTES_DOS_BENEFICIOS =
  'Estudos de benchmark de 11 e 12/09/2026: Mercado Livre (taxas e complemento), Shopee (estrutura e complemento), Amazon (raio-X e complemento) e Magalu (raio-X completo).';
