// Coffee LiVRE — leitura do catálogo.
//
// Única porta de entrada dos dados da vitrine. Nenhum componente monta
// consulta por conta própria: quando a modelagem mudar (produto × oferta,
// lote), muda aqui e a tela não sabe.
//
// Tudo o que sai daqui é público por RLS: loja ativa, categoria ativa e
// produto publicado. O vendedor (CNPJ, contato) NÃO é legível pelo
// visitante, e por isso não existe função para buscá-lo neste arquivo.
import { supabase } from '../../lib/supabase';

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

export interface Produto {
  id: string;
  slug: string;
  titulo: string;
  marca: string | null;
  descricao: string | null;
  preco: number | null;
  preco_de: number | null;
  peso_g: number | null;
  destaque: boolean;
  ordem: number;
  is_demo: boolean;
  store_id: string;
  category_id: string | null;
}

/** Um campo do Coffee Passport. Só existe quando tem valor. */
export interface CampoDoPassport {
  chave: string;
  rotulo: string;
  unidade: string | null;
  valor: string;
  ordem: number;
}

export type NivelDoPassport = 'comercial' | 'origem_identificada' | 'especial' | null;

const CAMPOS_PRODUTO =
  'id, slug, titulo, marca, descricao, preco, preco_de, peso_g, destaque, ordem, is_demo, store_id, category_id';

export async function listarLojas(): Promise<Loja[]> {
  const { data } = await supabase
    .from('lv_stores')
    .select('id, slug, nome, chamada, historia, especialidade, cidade, uf, logo_url, capa_url, cor, iniciais, destaque, is_demo')
    .order('ordem');
  return (data as Loja[]) ?? [];
}

export async function buscarLoja(slug: string): Promise<Loja | null> {
  const { data } = await supabase
    .from('lv_stores')
    .select('id, slug, nome, chamada, historia, especialidade, cidade, uf, logo_url, capa_url, cor, iniciais, destaque, is_demo')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Loja) ?? null;
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await supabase
    .from('lv_categories')
    .select('id, parent_id, slug, nome, icone, ordem')
    .order('ordem');
  return (data as Categoria[]) ?? [];
}

/** Produtos publicados. Sem filtro, devolve a vitrine inteira na ordem. */
export async function listarProdutos(opcoes: { lojaId?: string; categoriaId?: string; destaque?: boolean; limite?: number } = {}): Promise<Produto[]> {
  let q = supabase.from('lv_products').select(CAMPOS_PRODUTO).order('ordem');
  if (opcoes.lojaId) q = q.eq('store_id', opcoes.lojaId);
  if (opcoes.categoriaId) q = q.eq('category_id', opcoes.categoriaId);
  if (opcoes.destaque) q = q.eq('destaque', true);
  if (opcoes.limite) q = q.limit(opcoes.limite);
  const { data } = await q;
  return (data as Produto[]) ?? [];
}

export async function buscarProduto(slug: string): Promise<Produto | null> {
  const { data } = await supabase
    .from('lv_products')
    .select(CAMPOS_PRODUTO)
    .eq('slug', slug)
    .maybeSingle();
  return (data as Produto) ?? null;
}

/**
 * Coffee Passport de um produto.
 *
 * A view só devolve campo que TEM valor. Lista vazia significa que este
 * item não tem passaporte — um moedor, por exemplo — e a tela simplesmente
 * não mostra a seção. Nunca preencher lacuna com texto genérico.
 */
export async function passaporteDoProduto(produtoId: string): Promise<CampoDoPassport[]> {
  const { data } = await supabase
    .from('vw_lv_coffee_passport')
    .select('chave, rotulo, unidade, valor, ordem')
    .eq('product_id', produtoId)
    .order('ordem');
  return (data as CampoDoPassport[]) ?? [];
}

/** Nível do passaporte, derivado do que foi preenchido. */
export async function nivelDoPassport(produtoId: string): Promise<NivelDoPassport> {
  const { data } = await supabase.rpc('lv_nivel_do_passport', { p_product_id: produtoId });
  return (data as NivelDoPassport) ?? null;
}

export const ROTULO_DO_NIVEL: Record<Exclude<NivelDoPassport, null>, string> = {
  comercial: 'Café comercial',
  origem_identificada: 'Origem identificada',
  especial: 'Café especial',
};

/** Atributos filtráveis de uma categoria, para montar a listagem. */
export async function filtrosDaCategoria(categoriaId: string) {
  const { data } = await supabase
    .from('lv_category_attributes')
    .select('ordem, lv_attributes!inner(chave, rotulo, tipo, unidade, opcoes, filtravel)')
    .eq('category_id', categoriaId)
    .order('ordem');
  return (data ?? [])
    .map(l => (l as unknown as { lv_attributes: { chave: string; rotulo: string; tipo: string; unidade: string | null; opcoes: string[]; filtravel: boolean } }).lv_attributes)
    .filter(a => a?.filtravel);
}
