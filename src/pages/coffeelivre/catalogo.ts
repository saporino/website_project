// Coffee LiVRE — leitura do catálogo.
//
// Única porta de entrada dos dados da vitrine. Nenhum componente monta
// consulta por conta própria: quando a modelagem mudar — variantes de
// produto, oferta por vendedor, lote — muda aqui e a tela não sabe.
//
// Tudo o que sai daqui é público por RLS: loja ativa, categoria ativa e
// produto com status 'ativo'. O VENDEDOR (CNPJ, contato) não é legível
// pelo visitante, e por isso não existe função para buscá-lo aqui.
//
// Dinheiro em CENTAVOS, conforme a seção 10 do RAIO-X.
import { supabase } from '../../lib/supabase';
import type { Faixa } from './escada';

export interface ItemDaVitrine {
  id: string;
  slug: string;
  titulo: string;
  marca: string | null;
  descricao: string | null;
  preco_cents: number | null;
  preco_de_cents: number | null;
  peso_g: number | null;
  destaque: boolean;
  ordem: number;
  is_demo: boolean;
  category_id: string | null;
  categoria_slug: string | null;
  categoria_nome: string | null;
  categoria_icone: string | null;
  categoria_raiz_slug: string | null;
  store_id: string;
  loja_slug: string;
  loja_nome: string;
  loja_cidade: string | null;
  loja_uf: string | null;
  loja_cor: string | null;
  loja_iniciais: string | null;
  nivel_passport: NivelDoPassport;
  /** Nulo quando o vendedor nao informou — e ai o selo nao aparece. */
  pontuacao: string | null;
  /** O produto tem escada de quantidade configurada. */
  venda_por_quantidade: boolean;
  /** Variante que o cartão vende com um clique. */
  variante_padrao_id: string | null;
  /** Vendável da variante padrão. Zero = esgotado: aparece, não vende. */
  disponivel: number;
  /** Código permanente do QR. Nunca muda, mesmo que o slug mude. */
  qr_codigo: string | null;
}

/** Variante à venda, com o preço efetivo e o vendável dela. */
export interface VarianteAVenda {
  id: string;
  nome: string;
  gramatura_g: number | null;
  moagem: string | null;
  embalagem: string | null;
  preco_cents: number | null;
  padrao: boolean;
  ordem: number;
  disponivel: number;
}

export interface Loja {
  id: string;
  slug: string;
  nome: string;
  chamada: string | null;
  historia: string | null;
  especialidade: string | null;
  cidade: string | null;
  uf: string | null;
  logo_url: string | null;
  capa_url: string | null;
  cor: string | null;
  iniciais: string | null;
  destaque: boolean;
  is_demo: boolean;
}

export interface Categoria {
  id: string;
  parent_id: string | null;
  slug: string;
  nome: string;
  icone: string | null;
  ordem: number;
}

export interface CampoDoPassport {
  chave: string;
  rotulo: string;
  unidade: string | null;
  valor: string;
  ordem: number;
}

export interface AtributoFiltravel {
  chave: string;
  rotulo: string;
  tipo: string;
  unidade: string | null;
  opcoes: string[];
}

export type NivelDoPassport = 'comercial' | 'origem_identificada' | 'especial' | null;

export const ROTULO_DO_NIVEL: Record<Exclude<NivelDoPassport, null>, string> = {
  comercial: 'Café comercial',
  origem_identificada: 'Origem identificada',
  especial: 'Café especial',
};

const CAMPOS_LOJA =
  'id, slug, nome, chamada, historia, especialidade, cidade, uf, logo_url, capa_url, cor, iniciais, destaque, is_demo';

// ---------------------------------------------------------------------
// Vitrine
// ---------------------------------------------------------------------
export async function listarVitrine(opcoes: {
  lojaId?: string;
  categoriaIds?: string[];
  destaque?: boolean;
  limite?: number;
} = {}): Promise<ItemDaVitrine[]> {
  let q = supabase.from('vw_lv_vitrine').select('*').order('ordem');
  if (opcoes.lojaId) q = q.eq('store_id', opcoes.lojaId);
  if (opcoes.categoriaIds?.length) q = q.in('category_id', opcoes.categoriaIds);
  if (opcoes.destaque) q = q.eq('destaque', true);
  if (opcoes.limite) q = q.limit(opcoes.limite);
  const { data } = await q;
  return (data as ItemDaVitrine[]) ?? [];
}

export async function buscarProduto(slug: string): Promise<ItemDaVitrine | null> {
  const { data } = await supabase.from('vw_lv_vitrine').select('*').eq('slug', slug).maybeSingle();
  return (data as ItemDaVitrine) ?? null;
}

/**
 * Variantes à venda de um produto. O vendável vem pronto do banco: o
 * comprador não lê lote, recebe só o número.
 */
export async function variantesDoProduto(produtoId: string): Promise<VarianteAVenda[]> {
  const { data } = await supabase.rpc('lv_variantes_a_venda', { p_product: produtoId });
  return (data as VarianteAVenda[]) ?? [];
}

export type DestinoDoQr =
  | { tipo: 'produto'; slug: string; varianteId: string | null }
  | { tipo: 'fora_do_ar' }
  | { tipo: 'desconhecido' };

/** Resolve o código permanente impresso no QR. */
export async function resolverQr(codigo: string): Promise<DestinoDoQr> {
  const { data, error } = await supabase.rpc('lv_resolver_qr', { p_codigo: codigo });
  if (error || !data) return { tipo: 'desconhecido' };
  const r = data as { disponivel: boolean; slug?: string; variante_id?: string | null };
  if (!r.disponivel || !r.slug) return { tipo: 'fora_do_ar' };
  return { tipo: 'produto', slug: r.slug, varianteId: r.variante_id ?? null };
}

/** Busca por texto, ignorando acento. Simples e confiável de propósito. */
export async function buscarPorTexto(termo: string): Promise<ItemDaVitrine[]> {
  const { data } = await supabase.rpc('lv_buscar_produtos', { termo });
  return (data as ItemDaVitrine[]) ?? [];
}

// ---------------------------------------------------------------------
// Lojas e categorias
// ---------------------------------------------------------------------
export async function listarLojas(): Promise<Loja[]> {
  // `ativa` explicito: vendedor e admin leem lojas inativas pela RLS, e
  // loja aguardando aprovacao nao pode aparecer na home para ninguem.
  const { data } = await supabase.from('lv_stores').select(CAMPOS_LOJA).eq('ativa', true).order('ordem');
  return (data as Loja[]) ?? [];
}

export async function buscarLoja(slug: string): Promise<Loja | null> {
  const { data } = await supabase.from('lv_stores').select(CAMPOS_LOJA).eq('slug', slug).eq('ativa', true).maybeSingle();
  return (data as Loja) ?? null;
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await supabase
    .from('lv_categories')
    .select('id, parent_id, slug, nome, icone, ordem')
    .order('ordem');
  return (data as Categoria[]) ?? [];
}

// ---------------------------------------------------------------------
// Coffee Passport
// ---------------------------------------------------------------------
/**
 * A view só devolve campo que TEM valor. Lista vazia significa que este
 * item não tem passaporte — um moedor, por exemplo — e a tela não mostra
 * a seção. Nunca preencher lacuna com texto genérico.
 */
export async function passaporteDoProduto(produtoId: string): Promise<CampoDoPassport[]> {
  const { data } = await supabase
    .from('vw_lv_coffee_passport')
    .select('chave, rotulo, unidade, valor, ordem')
    .eq('product_id', produtoId)
    .order('ordem');
  return (data as CampoDoPassport[]) ?? [];
}

/** Todos os atributos de um produto, inclusive os que não vão ao Passport. */
export async function atributosDoProduto(produtoId: string): Promise<CampoDoPassport[]> {
  const { data } = await supabase
    .from('lv_product_attributes')
    .select('valor, lv_attributes!inner(chave, rotulo, unidade, ordem)')
    .eq('product_id', produtoId);
  return (data ?? [])
    .map(l => {
      const a = (l as unknown as { valor: string; lv_attributes: { chave: string; rotulo: string; unidade: string | null; ordem: number } });
      return { chave: a.lv_attributes.chave, rotulo: a.lv_attributes.rotulo, unidade: a.lv_attributes.unidade, valor: a.valor, ordem: a.lv_attributes.ordem };
    })
    .sort((x, y) => x.ordem - y.ordem);
}

/** Atributos que viram filtro numa categoria. */
export async function filtrosDaCategoria(categoriaIds: string[]): Promise<AtributoFiltravel[]> {
  if (!categoriaIds.length) return [];
  const { data } = await supabase
    .from('lv_category_attributes')
    .select('ordem, lv_attributes!inner(chave, rotulo, tipo, unidade, opcoes, filtravel)')
    .in('category_id', categoriaIds)
    .order('ordem');
  const vistos = new Set<string>();
  return (data ?? [])
    .map(l => (l as unknown as { lv_attributes: AtributoFiltravel & { filtravel: boolean } }).lv_attributes)
    .filter(a => {
      if (!a?.filtravel || vistos.has(a.chave)) return false;
      vistos.add(a.chave);
      return true;
    });
}

/**
 * Valores de atributo de um conjunto de produtos, para filtrar a listagem.
 * Uma consulta só: filtrar no navegador é honesto nesta escala e evita um
 * motor de busca que ainda não precisamos.
 */
export async function atributosDosProdutos(ids: string[]): Promise<Map<string, Record<string, string>>> {
  const mapa = new Map<string, Record<string, string>>();
  if (!ids.length) return mapa;
  const { data } = await supabase
    .from('lv_product_attributes')
    .select('product_id, valor, lv_attributes!inner(chave)')
    .in('product_id', ids);
  for (const linha of data ?? []) {
    const l = linha as unknown as { product_id: string; valor: string; lv_attributes: { chave: string } };
    const atual = mapa.get(l.product_id) ?? {};
    atual[l.lv_attributes.chave] = l.valor;
    mapa.set(l.product_id, atual);
  }
  return mapa;
}

// ---------------------------------------------------------------------
// Planos e entrada do vendedor
// ---------------------------------------------------------------------
export interface Plano {
  id: string;
  slug: string;
  nome: string;
  chamada: string | null;
  mensalidade_cents: number;
  comissao_bps: number | null;
  destaques: string[];
  limite_produtos: number | null;
  /** Valor ainda em estudo. A tela diz isso em vez de fingir tabela fechada. */
  em_estudo: boolean;
}

export interface Candidatura {
  cnpj?: string;
  razao_social?: string;
  nome_marca: string;
  tipo: string;
  responsavel: string;
  email: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  tipos_de_cafe?: string;
  volume_mensal?: string;
  prazo_expedicao?: string;
  emite_nfe?: boolean | null;
  mensagem?: string;
  plan_id?: string | null;
}

export async function listarPlanos(): Promise<Plano[]> {
  const { data } = await supabase
    .from('lv_plans')
    .select('id, slug, nome, chamada, mensalidade_cents, comissao_bps, destaques, limite_produtos, em_estudo')
    .order('ordem');
  return (data as Plano[]) ?? [];
}

/**
 * Envia um pedido de entrada.
 *
 * Não passa `status`: ele nasce "interessado" por padrão e a RLS recusa
 * qualquer outro valor vindo do navegador. Ninguém se aprova sozinho.
 */
export async function enviarCandidatura(c: Candidatura): Promise<string | null> {
  const { error } = await supabase.from('lv_seller_applications').insert(c);
  return error?.message ?? null;
}

// ---------------------------------------------------------------------
// Escada de quantidade
// ---------------------------------------------------------------------
export interface EscadaDoProduto {
  faixas: Faixa[];
  /** Piso por unidade do vendedor. Alerta na tela dele, nunca bloqueio. */
  piso_cents: number | null;
}

/**
 * Faixas de um produto, mais o piso do vendedor.
 *
 * O piso vem de `lv_products` e não da vitrine: é informação de gestão do
 * vendedor, e a view pública não precisa carregá-la em toda listagem.
 */
export async function escadaDoProduto(produtoId: string): Promise<EscadaDoProduto> {
  const [tiers, produto] = await Promise.all([
    supabase.from('lv_price_tiers').select('min_qty, tipo, valor').eq('product_id', produtoId).order('min_qty'),
    supabase.from('lv_products').select('preco_minimo_cents').eq('id', produtoId).maybeSingle(),
  ]);
  return {
    faixas: (tiers.data as Faixa[]) ?? [],
    piso_cents: (produto.data as { preco_minimo_cents: number | null } | null)?.preco_minimo_cents ?? null,
  };
}
