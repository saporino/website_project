// Seller Central — dados da comparação de mercado e do preço em um clique.
//
// O MERCADO sai só da vitrine pública: preço, gramatura e atributos de
// produtos no ar. Nenhum dado privado de concorrente (piso, estoque por
// lote, histórico) passa por aqui — nem poderia: a RLS não entrega.
//
// O PRODUTO DO VENDEDOR sai com a leitura dele (RLS por vínculo), incluindo
// o piso, que é privado.
import { supabase } from '../../../lib/supabase';
import { atributosDosProdutos } from '../catalogo';
import type { Faixa } from '../escada';
import {
  compararComMercado, recomendarPreco,
  type ComparacaoDeMercado, type ProdutoDeMercado, type RecomendacaoDePreco,
} from '../comparacao';

export interface MeuProdutoNoMercado {
  produto: ProdutoDeMercado;
  pisoCents: number | null;
  vendaPorQuantidade: boolean;
  faixas: Faixa[];
  status: string;
}

export interface LinhaDoHistorico {
  id: string;
  precoAnteriorCents: number | null;
  precoNovoCents: number;
  origem: string;
  motivo: string | null;
  desfeitoEm: string | null;
  criadoEm: string;
}

/** Cafés no ar na vitrine pública, com atributos e gramatura. */
export async function carregarMercadoPublico(): Promise<ProdutoDeMercado[]> {
  const { data } = await supabase.from('vw_lv_vitrine')
    .select('id, store_id, loja_nome, titulo, slug, preco_cents, peso_g, categoria_raiz_slug, disponivel')
    .eq('categoria_raiz_slug', 'cafes');
  const itens = (data ?? []) as {
    id: string; store_id: string; loja_nome: string; titulo: string; slug: string;
    preco_cents: number | null; peso_g: number | null; disponivel: number;
  }[];
  const atributos = await atributosDosProdutos(itens.map(i => i.id));
  return itens.filter(i => i.preco_cents).map(i => {
    const a = atributos.get(i.id) ?? {};
    return {
      id: i.id, storeId: i.store_id, lojaNome: i.loja_nome, titulo: i.titulo, slug: i.slug,
      precoCents: Number(i.preco_cents),
      gramaturaG: i.peso_g ?? (a.peso ? Number(a.peso) : null),
      atributos: a,
      disponivel: i.disponivel,
    };
  });
}

/** Um produto do próprio vendedor, com piso e escada. */
export async function carregarMeuProduto(produtoId: string): Promise<MeuProdutoNoMercado | null> {
  const { data } = await supabase.from('lv_products')
    .select('id, store_id, titulo, slug, status, preco_cents, peso_g, preco_minimo_cents, venda_por_quantidade, lv_stores!inner(nome)')
    .eq('id', produtoId).maybeSingle();
  if (!data) return null;
  const p = data as unknown as {
    id: string; store_id: string; titulo: string; slug: string; status: string; preco_cents: number | null;
    peso_g: number | null; preco_minimo_cents: number | null; venda_por_quantidade: boolean; lv_stores: { nome: string };
  };
  const [attrs, tiers, variante] = await Promise.all([
    supabase.from('lv_product_attributes').select('valor, lv_attributes!inner(chave)').eq('product_id', produtoId),
    supabase.from('lv_price_tiers').select('min_qty, tipo, valor').eq('product_id', produtoId).order('min_qty'),
    supabase.from('lv_product_variants').select('gramatura_g').eq('product_id', produtoId).eq('padrao', true).maybeSingle(),
  ]);
  const atributos: Record<string, string> = {};
  for (const l of (attrs.data ?? []) as unknown as { valor: string; lv_attributes: { chave: string } }[]) {
    atributos[l.lv_attributes.chave] = l.valor;
  }
  const gramatura = (variante.data as { gramatura_g: number | null } | null)?.gramatura_g ?? p.peso_g;
  return {
    produto: {
      id: p.id, storeId: p.store_id, lojaNome: p.lv_stores.nome, titulo: p.titulo, slug: p.slug,
      precoCents: Number(p.preco_cents ?? 0), gramaturaG: gramatura, atributos,
    },
    pisoCents: p.preco_minimo_cents == null ? null : Number(p.preco_minimo_cents),
    vendaPorQuantidade: p.venda_por_quantidade,
    faixas: (tiers.data ?? []) as Faixa[],
    status: p.status,
  };
}

export async function historicoDePreco(produtoId: string, limite = 6): Promise<LinhaDoHistorico[]> {
  const { data } = await supabase.from('lv_price_history')
    .select('id, preco_anterior_cents, preco_novo_cents, origem, motivo, desfeito_em, created_at')
    .eq('product_id', produtoId)
    .order('created_at', { ascending: false })
    .limit(limite);
  return ((data ?? []) as {
    id: string; preco_anterior_cents: number | null; preco_novo_cents: number; origem: string;
    motivo: string | null; desfeito_em: string | null; created_at: string;
  }[]).map(h => ({
    id: h.id,
    precoAnteriorCents: h.preco_anterior_cents == null ? null : Number(h.preco_anterior_cents),
    precoNovoCents: Number(h.preco_novo_cents),
    origem: h.origem,
    motivo: h.motivo,
    desfeitoEm: h.desfeito_em,
    criadoEm: h.created_at,
  }));
}

/**
 * Aplica um preço autorizado pelo vendedor. O servidor confere o dono e o
 * piso; abaixo do piso, nada é alterado. Lança Error com a mensagem do banco.
 */
export async function aplicarPreco(
  produtoId: string,
  precoCents: number,
  motivo: string,
  recomendacao: Partial<RecomendacaoDePreco> & Record<string, unknown>,
): Promise<{ historyId: string; status: string }> {
  const { data, error } = await supabase.rpc('lv_aplicar_preco', {
    p_product: produtoId, p_preco_cents: precoCents, p_origem: 'copiloto', p_motivo: motivo, p_recomendacao: recomendacao,
  });
  if (error) throw new Error(error.message);
  const r = data as { history_id: string; status: string };
  return { historyId: r.history_id, status: r.status };
}

export async function desfazerPreco(historyId: string): Promise<void> {
  const { error } = await supabase.rpc('lv_desfazer_preco', { p_history: historyId });
  if (error) throw new Error(error.message);
}

/** Resumo gravado junto do histórico: o que o Copiloto viu ao recomendar. */
export function resumoDaRecomendacao(c: ComparacaoDeMercado, r: RecomendacaoDePreco, opcao: string): Record<string, unknown> {
  return {
    tipo: r.tipo,
    opcao,
    sugestao_cents: r.sugestaoCents,
    mediana_pacote_cents: c.estatisticas?.medianaPacoteCents ?? null,
    equivalentes: c.estatisticas?.quantidade ?? c.diretos.length,
    distancia_bps: c.estatisticas?.distanciaBps ?? null,
  };
}

export interface RecomendacaoDeMercadoDoProduto {
  produtoId: string;
  titulo: string;
  comparacao: ComparacaoDeMercado;
  recomendacao: RecomendacaoDePreco;
}

/** Recomendações de preço para os cafés do vendedor (para o Copiloto). */
export async function recomendacoesDeMercado(sellerId: string): Promise<RecomendacaoDeMercadoDoProduto[]> {
  const [mercado, meus] = await Promise.all([
    carregarMercadoPublico(),
    supabase.from('lv_products').select('id').eq('seller_id', sellerId).neq('status', 'arquivado'),
  ]);
  const ids = ((meus.data ?? []) as { id: string }[]).map(p => p.id);
  const produtos = (await Promise.all(ids.map(carregarMeuProduto))).filter((p): p is MeuProdutoNoMercado => !!p);
  return produtos
    .filter(p => p.produto.precoCents > 0 && p.produto.atributos.classificacao)
    .map(p => {
      const comparacao = compararComMercado(p.produto, mercado);
      return { produtoId: p.produto.id, titulo: p.produto.titulo, comparacao, recomendacao: recomendarPreco(comparacao, p.produto, p.pisoCents) };
    });
}
