// Coffee LiVRE — checkout e pedidos do comprador (camada de dados).
//
// Toda conta vem do banco (lv_calcular_checkout). A tela não soma preço de
// ninguém: mostra o que o servidor calculou, e o mesmo cálculo cria o pedido.

import { supabase } from '../../../lib/supabase';
import { registrarFalha, type Operacao } from '../observabilidade';
import type { MetodoDePagamento } from './provedores';
import type { StatusDoPagamento, StatusDoPedido, StatusDoSubpedido } from './estados';
import type { Comprador, Endereco } from './validacao';

export interface ItemCalculado {
  cart_item_id: string;
  variant_id: string;
  product_id: string;
  seller_id: string;
  loja_nome: string;
  loja_slug: string;
  titulo: string;
  marca: string | null;
  variante_nome: string | null;
  gramatura_g: number | null;
  quantidade: number;
  preco_cheio_cents: number;
  unitario_cents: number;
  unitario_visto_cents: number | null;
  desconto_cents: number;
  total_cents: number;
  faixa_min_qty: number | null;
}

export interface VendedorCalculado {
  seller_id: string;
  loja_nome: string;
  loja_slug: string;
  unidades: number;
  subtotal_produtos_cents: number;
  desconto_produtos_cents: number;
  frete_cents: number;
  total_cents: number;
  frete: { transportadora: string; servico: string; prazo_dias: number } | null;
}

export interface Totais {
  subtotal_produtos_cents: number;
  desconto_produtos_cents: number;
  frete_cents: number;
  desconto_frete_cents: number;
  total_cents: number;
  frete_definido: boolean;
}

export interface Divergencia {
  variant_id: string;
  titulo: string;
  unitario_visto_cents: number;
  unitario_cents: number;
}

export interface CalculoDoCheckout {
  checkout_id: string;
  status: string;
  expira_em: string;
  itens: ItemCalculado[];
  vendedores: VendedorCalculado[];
  totais: Totais;
  divergencias_de_tela?: Divergencia[];
  repetido?: boolean;
}

export interface FaltaDeEstoque {
  variant_id: string;
  pedida: number;
  disponivel: number;
  motivo: 'estoque' | 'fora_do_ar';
}

/** Erro com o código de negócio do banco (hint) e o detalhe estruturado. */
export class ErroDoCheckout extends Error {
  constructor(mensagem: string, readonly codigo: string | null, readonly detalhe: unknown) {
    super(mensagem);
  }
}

type ErroDoBanco = { message: string; code?: string; hint?: string | null; details?: string | null };

/** Embutido do PostgREST pode vir como objeto (relação 1:1), lista ou nulo. */
export function comoLista<T>(v: T | T[] | null | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function falhar(operacao: Operacao, error: ErroDoBanco, padrao: string): never {
  let detalhe: unknown = null;
  try { detalhe = error.details ? JSON.parse(error.details) : null; } catch { detalhe = error.details; }
  throw new ErroDoCheckout(registrarFalha(operacao, error, padrao), error.hint ?? null, detalhe);
}

export async function iniciarCheckout(
  itens: { variant_id: string; quantidade: number; unitario_cents: number }[],
  chave: string,
): Promise<CalculoDoCheckout> {
  const { data, error } = await supabase.rpc('lv_checkout_iniciar', { p_itens: itens, p_chave: chave });
  if (error) falhar(error.hint === 'ESTOQUE_INSUFICIENTE' ? 'reservar-estoque' : 'checkout-iniciar', error, 'Não foi possível abrir o checkout.');
  return data as CalculoDoCheckout;
}

export async function resumoDoCheckout(checkoutId: string, frete: string | null, pagamento: MetodoDePagamento | null): Promise<CalculoDoCheckout> {
  const { data, error } = await supabase.rpc('lv_checkout_resumo', { p_checkout: checkoutId, p_frete: frete, p_pagamento: pagamento });
  if (error) falhar('checkout-resumo', error, 'Não foi possível calcular o pedido.');
  return data as CalculoDoCheckout;
}

export async function confirmarPedido(
  checkoutId: string, comprador: Comprador, endereco: Endereco, frete: string, pagamento: MetodoDePagamento,
): Promise<{ order_id: string; numero: string; repetido: boolean }> {
  const { data, error } = await supabase.rpc('lv_checkout_confirmar', {
    p_checkout: checkoutId, p_comprador: comprador, p_endereco: endereco, p_frete: frete, p_pagamento: pagamento,
  });
  if (error) falhar('checkout-confirmar', error, 'Não foi possível confirmar o pedido.');
  return data as { order_id: string; numero: string; repetido: boolean };
}

// ---------------------------------------------------------------- pedidos do comprador
export interface ResumoDoPedido {
  id: string;
  numero: string;
  status: StatusDoPedido;
  pagamento_status: StatusDoPagamento;
  total_cents: number;
  created_at: string;
  lv_seller_orders: { loja_nome: string; status: StatusDoSubpedido }[];
  lv_order_items: { quantidade: number }[];
}

export async function meusPedidos(): Promise<ResumoDoPedido[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('lv_orders')
    .select('id, numero, status, pagamento_status, total_cents, created_at, lv_seller_orders(loja_nome, status), lv_order_items(quantidade)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) falhar('pedidos-carregar', error, 'Não foi possível carregar seus pedidos.');
  return (data as ResumoDoPedido[]) ?? [];
}

export interface ItemDoPedido {
  id: string;
  titulo: string;
  variante_nome: string | null;
  gramatura_g: number | null;
  quantidade: number;
  preco_cheio_cents: number;
  unitario_cents: number;
  desconto_cents: number;
  total_cents: number;
}

export interface SubpedidoDoComprador {
  id: string;
  numero: string;
  loja_nome: string;
  loja_slug: string | null;
  status: StatusDoSubpedido;
  subtotal_produtos_cents: number;
  desconto_produtos_cents: number;
  frete_cents: number;
  total_cents: number;
  lv_order_items: ItemDoPedido[];
  lv_shipments: { transportadora: string; servico: string; prazo_dias: number | null; status: string; codigo_rastreio: string | null }[];
}

export interface PedidoDoComprador {
  id: string;
  numero: string;
  status: StatusDoPedido;
  pagamento_status: StatusDoPagamento;
  pagamento_metodo: MetodoDePagamento | 'boleto';
  comprador_nome: string;
  subtotal_produtos_cents: number;
  desconto_produtos_cents: number;
  frete_cents: number;
  total_cents: number;
  created_at: string;
  lv_order_addresses: Endereco | null;
  lv_seller_orders: SubpedidoDoComprador[];
  lv_order_events: { tipo: string; origem: string; created_at: string }[];
}

export async function pedidoDoComprador(numero: string): Promise<PedidoDoComprador | null> {
  const { data, error } = await supabase.from('lv_orders')
    .select(`id, numero, status, pagamento_status, pagamento_metodo, comprador_nome, subtotal_produtos_cents,
      desconto_produtos_cents, frete_cents, total_cents, created_at,
      lv_order_addresses(destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia),
      lv_seller_orders(id, numero, loja_nome, loja_slug, status, subtotal_produtos_cents, desconto_produtos_cents, frete_cents, total_cents,
        lv_order_items(id, titulo, variante_nome, gramatura_g, quantidade, preco_cheio_cents, unitario_cents, desconto_cents, total_cents),
        lv_shipments(transportadora, servico, prazo_dias, status, codigo_rastreio)),
      lv_order_events(tipo, origem, created_at)`)
    .eq('numero', numero)
    .maybeSingle();
  if (error) falhar('pedidos-carregar', error, 'Não foi possível carregar o pedido.');
  if (!data) return null;
  const p = data as unknown as PedidoDoComprador & { lv_order_addresses: Endereco | Endereco[] | null };
  return {
    ...p,
    lv_order_addresses: Array.isArray(p.lv_order_addresses) ? p.lv_order_addresses[0] ?? null : p.lv_order_addresses,
    // Relação 1:1 (seller_order_id único): o PostgREST devolve objeto, não lista.
    lv_seller_orders: [...p.lv_seller_orders]
      .map(s => ({ ...s, lv_shipments: comoLista(s.lv_shipments) }))
      .sort((a, b) => a.numero.localeCompare(b.numero)),
    lv_order_events: [...p.lv_order_events].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export async function cancelarPedido(orderId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('lv_pedido_cancelar', { p_order: orderId, p_motivo: motivo });
  if (error) falhar('pedido-cancelar', error, 'Não foi possível cancelar o pedido.');
}
