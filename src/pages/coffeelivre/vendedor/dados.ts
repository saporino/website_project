// Seller Central — leitura e escrita do vendedor.
//
// Nada aqui filtra "só o que é meu" por conta própria. Os filtros por
// `seller_id` existem para a consulta ser pequena, não para proteger: quem
// protege é a RLS. Se este arquivo esquecer um filtro, o banco devolve
// apenas o que é do vendedor mesmo assim — e a bancada de teste prova isso
// com dois vendedores reais tentando ler um ao outro.
import { supabase } from '../../../lib/supabase';
import { completudeDoPassport, type Completude } from '../passaporte';
import { faixasAbaixoDoPiso, type Faixa } from '../escada';
import type { ProdutoDoVendedor } from '../copiloto';

// ---------------------------------------------------------------------
// Categorias e seus atributos
// ---------------------------------------------------------------------
export interface AtributoDaCategoria {
  chave: string;
  rotulo: string;
  tipo: string;
  unidade: string | null;
  opcoes: string[];
  no_passport: boolean;
  ordem: number;
}

export interface CategoriaDoCadastro {
  id: string;
  parent_id: string | null;
  slug: string;
  nome: string;
  icone: string | null;
  ordem: number;
  /** "cafes" ou "equipamentos": decide se o produto tem Passport. */
  raizSlug: string;
  atributos: AtributoDaCategoria[];
}

export async function carregarCategorias(): Promise<CategoriaDoCadastro[]> {
  const [cats, pontes] = await Promise.all([
    supabase.from('lv_categories').select('id, parent_id, slug, nome, icone, ordem').order('ordem'),
    supabase.from('lv_category_attributes')
      .select('category_id, lv_attributes!inner(chave, rotulo, tipo, unidade, opcoes, no_passport, ordem)'),
  ]);
  type Crua = Omit<CategoriaDoCadastro, 'raizSlug' | 'atributos'>;
  const lista = (cats.data ?? []) as Crua[];
  const porId = new Map(lista.map(c => [c.id, c]));
  const atributos = new Map<string, AtributoDaCategoria[]>();
  for (const l of (pontes.data ?? []) as unknown as { category_id: string; lv_attributes: AtributoDaCategoria }[]) {
    const atual = atributos.get(l.category_id) ?? [];
    atual.push(l.lv_attributes);
    atributos.set(l.category_id, atual);
  }
  return lista.map(c => {
    const raiz = c.parent_id ? porId.get(c.parent_id) : c;
    return {
      ...c,
      raizSlug: raiz?.slug ?? c.slug,
      atributos: (atributos.get(c.id) ?? []).sort((a, b) => a.ordem - b.ordem),
    };
  });
}

export const ehCategoriaDeCafe = (c: CategoriaDoCadastro | undefined) => !!c && c.raizSlug !== 'equipamentos';

// ---------------------------------------------------------------------
// Lista de produtos do vendedor
// ---------------------------------------------------------------------
export interface LinhaDeProduto extends ProdutoDoVendedor {
  slug: string;
  sku: string | null;
  categoriaNome: string;
  precoCents: number | null;
  passport: Completude | null;
  atualizadoEm: string;
}

interface ProdutoCru {
  id: string; slug: string; titulo: string; status: string; sku: string | null;
  category_id: string | null; preco_cents: number | null; preco_minimo_cents: number | null;
  venda_por_quantidade: boolean; nota_moderacao: string | null; updated_at: string;
}

export async function listarProdutosDoVendedor(
  sellerId: string,
  categorias: CategoriaDoCadastro[],
): Promise<LinhaDeProduto[]> {
  const { data } = await supabase.from('lv_products')
    .select('id, slug, titulo, status, sku, category_id, preco_cents, preco_minimo_cents, venda_por_quantidade, nota_moderacao, updated_at')
    .eq('seller_id', sellerId)
    .order('updated_at', { ascending: false });
  const produtos = (data ?? []) as ProdutoCru[];
  if (!produtos.length) return [];

  const ids = produtos.map(p => p.id);
  const [attrs, tiers, lotes] = await Promise.all([
    supabase.from('lv_product_attributes').select('product_id, valor, lv_attributes!inner(chave)').in('product_id', ids),
    supabase.from('lv_price_tiers').select('product_id, min_qty, tipo, valor').in('product_id', ids),
    supabase.from('lv_inventory_lots').select('product_id, qtd_disponivel').in('product_id', ids),
  ]);

  const valores = new Map<string, Record<string, string>>();
  for (const l of (attrs.data ?? []) as unknown as { product_id: string; valor: string; lv_attributes: { chave: string } }[]) {
    const atual = valores.get(l.product_id) ?? {};
    atual[l.lv_attributes.chave] = l.valor;
    valores.set(l.product_id, atual);
  }
  const faixas = new Map<string, Faixa[]>();
  for (const t of (tiers.data ?? []) as (Faixa & { product_id: string })[]) {
    faixas.set(t.product_id, [...(faixas.get(t.product_id) ?? []), t]);
  }
  const estoque = new Map<string, number>();
  for (const l of (lotes.data ?? []) as { product_id: string; qtd_disponivel: number }[]) {
    estoque.set(l.product_id, (estoque.get(l.product_id) ?? 0) + l.qtd_disponivel);
  }

  const porId = new Map(categorias.map(c => [c.id, c]));
  return produtos.map(p => {
    const categoria = p.category_id ? porId.get(p.category_id) : undefined;
    const cafe = ehCategoriaDeCafe(categoria);
    const passport = cafe
      ? completudeDoPassport(valores.get(p.id) ?? {}, (categoria?.atributos ?? []).map(a => a.chave))
      : null;
    return {
      id: p.id,
      slug: p.slug,
      titulo: p.titulo,
      status: p.status,
      sku: p.sku,
      categoriaNome: categoria?.nome ?? 'Sem categoria',
      precoCents: p.preco_cents,
      ehCafe: cafe,
      passport,
      completude: passport?.percentual ?? null,
      faltando: passport?.faltando ?? [],
      vendaPorQuantidade: p.venda_por_quantidade,
      faixasAbaixoDoPiso: p.venda_por_quantidade
        ? faixasAbaixoDoPiso(p.preco_cents, faixas.get(p.id) ?? [], p.preco_minimo_cents)
        : [],
      estoque: estoque.get(p.id) ?? 0,
      notaModeracao: p.nota_moderacao,
      atualizadoEm: p.updated_at,
    };
  });
}

// ---------------------------------------------------------------------
// Um produto, para editar
// ---------------------------------------------------------------------
export interface ProdutoEditavel {
  id: string;
  slug: string;
  status: string;
  notaModeracao: string | null;
  aprovado: boolean;
  categoryId: string | null;
  titulo: string;
  marca: string;
  descricao: string;
  sku: string;
  precoCents: number | null;
  pesoG: number | null;
  pisoCents: number | null;
  vendaPorQuantidade: boolean;
  atributos: Record<string, string>;
  faixas: Faixa[];
}

export async function carregarProduto(id: string): Promise<ProdutoEditavel | null> {
  const { data } = await supabase.from('lv_products')
    .select('id, slug, status, nota_moderacao, aprovado_em, category_id, titulo, marca, descricao, sku, preco_cents, peso_g, preco_minimo_cents, venda_por_quantidade')
    .eq('id', id).maybeSingle();
  if (!data) return null;
  const p = data as {
    id: string; slug: string; status: string; nota_moderacao: string | null; aprovado_em: string | null;
    category_id: string | null; titulo: string; marca: string | null; descricao: string | null; sku: string | null;
    preco_cents: number | null; peso_g: number | null; preco_minimo_cents: number | null; venda_por_quantidade: boolean;
  };
  const [attrs, tiers] = await Promise.all([
    supabase.from('lv_product_attributes').select('valor, lv_attributes!inner(chave)').eq('product_id', id),
    supabase.from('lv_price_tiers').select('min_qty, tipo, valor').eq('product_id', id).order('min_qty'),
  ]);
  const atributos: Record<string, string> = {};
  for (const l of (attrs.data ?? []) as unknown as { valor: string; lv_attributes: { chave: string } }[]) {
    atributos[l.lv_attributes.chave] = l.valor;
  }
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    notaModeracao: p.nota_moderacao,
    aprovado: !!p.aprovado_em,
    categoryId: p.category_id,
    titulo: p.titulo,
    marca: p.marca ?? '',
    descricao: p.descricao ?? '',
    sku: p.sku ?? '',
    precoCents: p.preco_cents,
    pesoG: p.peso_g,
    pisoCents: p.preco_minimo_cents,
    vendaPorQuantidade: p.venda_por_quantidade,
    atributos,
    faixas: (tiers.data ?? []) as Faixa[],
  };
}

export interface ProdutoParaSalvar {
  id?: string | null;
  store_id: string;
  category_id: string;
  titulo: string;
  marca?: string;
  descricao?: string;
  sku?: string;
  preco_cents: number | null;
  peso_g: number | null;
  preco_minimo_cents: number | null;
  venda_por_quantidade: boolean;
  atributos: Record<string, string>;
  faixas: Faixa[];
}

/** Grava tudo numa transação no banco. Lança Error com a mensagem do banco. */
export async function salvarProduto(p: ProdutoParaSalvar): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase.rpc('lv_salvar_produto', { p });
  if (error) throw new Error(error.message);
  return data as { id: string; status: string };
}

/**
 * Pede para publicar ou despublicar. Devolve o status que o BANCO decidiu:
 * pedir "ativo" sem aprovação vigente volta como "em_moderacao".
 */
export async function publicarProduto(id: string, publicar: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('lv_publicar_produto', { p_id: id, p_publicar: publicar });
  if (error) throw new Error(error.message);
  return data as string;
}

// ---------------------------------------------------------------------
// Loja e estoque
// ---------------------------------------------------------------------
export interface CamposDaLoja {
  nome: string;
  chamada: string;
  especialidade: string;
  cidade: string;
  uf: string;
  historia: string;
  cor: string;
}

/**
 * Salva os DADOS da loja. Ativar a loja não passa por aqui — e se alguém
 * mandar `ativa` pela API, a guarda do banco devolve o valor que era.
 */
export async function salvarLoja(id: string, c: CamposDaLoja): Promise<void> {
  const vazioViraNulo = (s: string) => s.trim() || null;
  const { error } = await supabase.from('lv_stores').update({
    nome: c.nome.trim(),
    chamada: vazioViraNulo(c.chamada),
    especialidade: vazioViraNulo(c.especialidade),
    cidade: vazioViraNulo(c.cidade),
    uf: vazioViraNulo(c.uf),
    historia: vazioViraNulo(c.historia),
    cor: vazioViraNulo(c.cor),
    iniciais: c.nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Um lote de uma variante. O estoque é da variante, nunca do produto. */
export interface LinhaDeEstoque {
  id: string;
  produtoId: string;
  produtoTitulo: string;
  produtoStatus: string;
  varianteNome: string;
  sku: string | null;
  lote: string | null;
  dataTorra: string | null;
  validade: string | null;
  entradaEm: string | null;
  disponivel: number;
  reservado: number;
}

export async function listarEstoque(sellerId: string): Promise<LinhaDeEstoque[]> {
  const { data } = await supabase.from('lv_inventory_lots')
    .select('id, product_id, lote, data_torra, validade, entrada_em, qtd_disponivel, qtd_reservada, lv_products!inner(titulo, status), lv_product_variants!inner(nome, sku)')
    .eq('seller_id', sellerId)
    .order('entrada_em', { ascending: false });
  return ((data ?? []) as unknown as {
    id: string; product_id: string; lote: string | null; data_torra: string | null; validade: string | null;
    entrada_em: string | null; qtd_disponivel: number; qtd_reservada: number;
    lv_products: { titulo: string; status: string };
    lv_product_variants: { nome: string; sku: string | null };
  }[]).map(l => ({
    id: l.id,
    produtoId: l.product_id,
    produtoTitulo: l.lv_products.titulo,
    produtoStatus: l.lv_products.status,
    varianteNome: l.lv_product_variants.nome,
    sku: l.lv_product_variants.sku,
    lote: l.lote,
    dataTorra: l.data_torra,
    validade: l.validade,
    entradaEm: l.entrada_em,
    disponivel: l.qtd_disponivel,
    reservado: l.qtd_reservada,
  }));
}

// Habilitação para RECEBER vendas. Não existe onboarding de pagamento
// nesta fase; o status existe para ninguém supor que todo vendedor já recebe.
export const RECEBIMENTO: Record<string, { rotulo: string; classe: string }> = {
  nao_iniciado: { rotulo: 'Não iniciado', classe: 'neutro' },
  pendente: { rotulo: 'Pendente', classe: 'aviso' },
  verificado: { rotulo: 'Verificado', classe: 'ok' },
  bloqueado: { rotulo: 'Bloqueado', classe: 'erro' },
};

// ---------------------------------------------------------------------
// Vocabulário de status, uma vez só
// ---------------------------------------------------------------------
export const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: 'Rascunho', classe: 'neutro' },
  em_moderacao: { rotulo: 'Em moderação', classe: 'aviso' },
  ativo: { rotulo: 'Publicado', classe: 'ok' },
  pausado: { rotulo: 'Despublicado', classe: 'neutro' },
  recusado: { rotulo: 'Recusado', classe: 'erro' },
  arquivado: { rotulo: 'Arquivado', classe: 'neutro' },
};
