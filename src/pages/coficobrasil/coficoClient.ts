// Client Supabase PRÓPRIO da página COFICO (mantém a pasta destacável — não importa o client da Saporino).
// Uso restrito: leitura pública via RPC agregada `cofico_public_stats` (só inteiros, sem PII).
// persistSession:false p/ não conflitar com o client principal do app (evita múltiplas instâncias de auth).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const coficoDb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type CoficoStats = { entregas: number; clientes: number };

export async function fetchCoficoStats(): Promise<CoficoStats> {
  const { data, error } = await coficoDb.rpc('cofico_public_stats');
  if (error || !data) return { entregas: 0, clientes: 0 };
  return { entregas: Number(data.entregas) || 0, clientes: Number(data.clientes) || 0 };
}

/**
 * Vitrine da COFICO, vinda do MESMO catálogo que o painel administra.
 *
 * Antes esta página tinha uma lista fixa no código, e por isso nada que era
 * atualizado no painel (foto, nome, descrição) chegava aqui. Agora o catálogo é
 * um só: a view `vw_cofico_vitrine` devolve os produtos ativos, não escondidos e
 * marcados para a COFICO vender — de qualquer marca, que é o papel dela.
 */
export interface CoficoProduto {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  product_line: string | null;
  weight_grams: number | null;
  stock: number;
  marca_empresa: string | null;
  disponivel: boolean;
}

export async function fetchCoficoVitrine(): Promise<CoficoProduto[]> {
  const { data, error } = await coficoDb.from('vw_cofico_vitrine').select('*');
  if (error || !data) return [];
  return data as CoficoProduto[];
}

/**
 * Marcas que a COFICO mostra no site. Vem de `vw_cofico_marcas`, que já esconde
 * a empresa desligada em Configurações ("Aparece no site da COFICO") — desligar
 * some do site, religar traz de volta, sem mexer em produto nem pedido.
 */
export interface CoficoMarca { id: string; marca: string; logo_url: string | null; tem_produto: boolean }

export async function fetchCoficoMarcas(): Promise<CoficoMarca[] | null> {
  const { data, error } = await coficoDb.from('vw_cofico_marcas').select('*');
  // null = não deu para consultar; a página mantém o que já mostra (não apaga marca por falha de rede).
  if (error || !data) return null;
  return data as CoficoMarca[];
}

/* ------------------------------------------------------------------ embalagens ----
 * Preço, variação (cor × válvula) e desconto por volume vêm do banco: o admin muda
 * preço sem deploy, e o preço de embalagem muda sem aviso. A ficha do produto (foto,
 * medida, FAQ) continua no código, em embalagens.ts.
 */

export interface EmbalagemVariacao {
  id: string;
  sku: string;
  cor: string;
  valvula: boolean;
  preco_milheiro: number;
  ordem: number;
}

export interface EmbalagemOferta {
  id: string;
  sku: string;
  nome: string;
  minimo_unidades: number;
  passo_unidades: number;
  prazo_valvula_dias: number | null;
  avaliacoes_ativas: boolean;
  parcelamento_ativo: boolean;
  parcelas_max: number;
  quantidades_pequenas: boolean;
  variacoes: EmbalagemVariacao[];
  descontos: { a_partir_de: number; desconto_pct: number }[];
}

/** Busca a oferta pelo código COFICO do item. null = não está à venda no site. */
export async function fetchEmbalagemOferta(sku: string): Promise<EmbalagemOferta | null> {
  const { data, error } = await coficoDb
    .from('embalagem_ofertas')
    .select('id, sku, nome, minimo_unidades, passo_unidades, prazo_valvula_dias, avaliacoes_ativas, parcelamento_ativo, parcelas_max, quantidades_pequenas, embalagem_variacoes(id, sku, cor, valvula, preco_milheiro, ordem), embalagem_descontos(a_partir_de, desconto_pct)')
    .eq('sku', sku)
    .maybeSingle();
  if (error || !data) return null;

  const bruta = data as unknown as EmbalagemOferta & {
    embalagem_variacoes: EmbalagemVariacao[];
    embalagem_descontos: { a_partir_de: number; desconto_pct: number }[];
  };
  const variacoes = [...(bruta.embalagem_variacoes ?? [])].sort((a, b) => a.ordem - b.ordem);
  if (!variacoes.length) return null;
  return {
    ...bruta,
    variacoes,
    // Maior faixa primeiro: o desconto que vale é o da primeira faixa que a quantidade alcança.
    descontos: [...(bruta.embalagem_descontos ?? [])].sort((a, b) => b.a_partir_de - a.a_partir_de),
  };
}

/** Desconto que vale para esta quantidade. 0 quando nenhuma faixa foi alcançada. */
export function descontoPara(oferta: EmbalagemOferta, unidades: number): number {
  const milheiros = unidades / 1000;
  return oferta.descontos.find(d => milheiros >= d.a_partir_de)?.desconto_pct ?? 0;
}

export interface NovoPedidoEmbalagem {
  itens: { variacao: EmbalagemVariacao; unidades: number; descricao: string }[];
  nome: string;
  empresa?: string;
  documento?: string;
  email: string;
  telefone: string;
  cep?: string;
  endereco?: string;
  observacao?: string;
}

/** Grava o pedido do site. Não cobra nada: a COFICO confirma preço e frete depois. */
export async function enviarPedidoEmbalagem(oferta: EmbalagemOferta, p: NovoPedidoEmbalagem): Promise<{ numero: string } | { erro: string }> {
  const unidades = p.itens.reduce((s, i) => s + i.unidades, 0);
  if (unidades < oferta.minimo_unidades) {
    return { erro: `O pedido fecha a partir de ${oferta.minimo_unidades.toLocaleString('pt-BR')} unidades.` };
  }
  const subtotal = p.itens.reduce((s, i) => s + (i.unidades / 1000) * i.variacao.preco_milheiro, 0);
  const desconto = descontoPara(oferta, unidades);
  const total = subtotal * (1 - desconto / 100);

  const { data, error } = await coficoDb
    .from('embalagem_pedidos')
    .insert({
      unidades,
      subtotal: Number(subtotal.toFixed(2)),
      desconto_pct: desconto,
      total: Number(total.toFixed(2)),
      nome: p.nome,
      empresa: p.empresa || null,
      documento: p.documento || null,
      email: p.email,
      telefone: p.telefone,
      cep: p.cep || null,
      endereco: p.endereco || null,
      observacao: p.observacao || null,
    })
    .select('id, numero')
    .single();
  if (error || !data) return { erro: 'Não deu para registrar o pedido agora. Tente de novo ou chame a gente no WhatsApp.' };

  const itens = p.itens.map(i => ({
    pedido_id: data.id,
    variacao_id: i.variacao.id,
    descricao: i.descricao,
    unidades: i.unidades,
    preco_milheiro: i.variacao.preco_milheiro,
    subtotal: Number(((i.unidades / 1000) * i.variacao.preco_milheiro).toFixed(2)),
  }));
  const { error: erroItens } = await coficoDb.from('embalagem_pedido_itens').insert(itens);
  if (erroItens) return { erro: 'O pedido foi aberto mas os itens não gravaram. Chame a gente no WhatsApp com o número ' + data.numero + '.' };

  return { numero: data.numero as string };
}

export interface AvaliacaoEmbalagem {
  id: string;
  nome: string;
  empresa: string | null;
  nota: number;
  comentario: string;
  resposta: string | null;
  criado_em: string;
}

export async function fetchAvaliacoes(ofertaId: string): Promise<AvaliacaoEmbalagem[]> {
  const { data, error } = await coficoDb
    .from('embalagem_avaliacoes')
    .select('id, nome, empresa, nota, comentario, resposta, criado_em')
    .eq('oferta_id', ofertaId)
    .order('criado_em', { ascending: false });
  if (error || !data) return [];
  return data as AvaliacaoEmbalagem[];
}

/** A avaliação nasce pendente: só aparece no site depois que o admin aprova. */
export async function enviarAvaliacao(ofertaId: string, a: { nome: string; empresa?: string; nota: number; comentario: string }): Promise<boolean> {
  const { error } = await coficoDb.from('embalagem_avaliacoes').insert({
    oferta_id: ofertaId,
    nome: a.nome,
    empresa: a.empresa || null,
    nota: a.nota,
    comentario: a.comentario,
    status: 'pendente',
  });
  return !error;
}
