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

/** Busca por texto, ignorando acento. Simples e confiável de propósito. */
export async function buscarPorTexto(termo: string): Promise<ItemDaVitrine[]> {
  const { data } = await supabase.rpc('lv_buscar_produtos', { termo });
  return (data as ItemDaVitrine[]) ?? [];
}

// ---------------------------------------------------------------------
// Lojas e categorias
// ---------------------------------------------------------------------
export async function listarLojas(): Promise<Loja[]> {
  const { data } = await supabase.from('lv_stores').select(CAMPOS_LOJA).order('ordem');
  return (data as Loja[]) ?? [];
}

export async function buscarLoja(slug: string): Promise<Loja | null> {
  const { data } = await supabase.from('lv_stores').select(CAMPOS_LOJA).eq('slug', slug).maybeSingle();
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
