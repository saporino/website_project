// Seller Central — pedidos da loja (camada de dados).
//
// O vendedor lê SÓ os subpedidos dele (RLS). Valores financeiros chegam para
// leitura: não há função nem permissão que deixe o vendedor alterá-los. A única
// escrita é o próximo passo operacional (lv_subpedido_mudar_status).

import { supabase } from '../../../lib/supabase';
import { registrarFalha } from '../observabilidade';
import { comoLista } from '../checkout/dados';
import type { StatusDoSubpedido } from '../checkout/estados';

export interface ItemDoSubpedido {
  id: string;
  titulo: string;
  variante_nome: string | null;
  gramatura_g: number | null;
  sku: string | null;
  quantidade: number;
  unitario_cents: number;
  total_cents: number;
  lotes: { lote: string | null; validade: string | null; quantidade: number }[];
}

export interface SubpedidoDaLoja {
  id: string;
  order_id: string;
  numero: string;
  status: StatusDoSubpedido;
  created_at: string;
  subtotal_produtos_cents: number;
  desconto_produtos_cents: number;
  frete_cents: number;
  total_cents: number;
  comissao_plataforma_cents: number | null;
  tarifa_operacional_cents: number | null;
  taxa_pagamento_cents: number | null;
  repasse_seller_cents: number | null;
  politica_completa: boolean;
  politica_comercial: { plano?: string; comissao_bps?: number | null; pagamento_metodo?: string };
  lv_order_items: ItemDoSubpedido[];
  lv_shipments: { transportadora: string; servico: string; prazo_dias: number | null; peso_g: number | null; status: string }[];
}

const CAMPOS = `id, order_id, numero, status, created_at, subtotal_produtos_cents, desconto_produtos_cents, frete_cents, total_cents,
  comissao_plataforma_cents, tarifa_operacional_cents, taxa_pagamento_cents, repasse_seller_cents, politica_completa, politica_comercial,
  lv_order_items(id, titulo, variante_nome, gramatura_g, sku, quantidade, unitario_cents, total_cents, lotes),
  lv_shipments(transportadora, servico, prazo_dias, peso_g, status)`;

export async function pedidosDaLoja(sellerId: string): Promise<SubpedidoDaLoja[]> {
  // Filtrar pelo vendedor importa: um admin enxerga todos pela policy de admin.
  const { data, error } = await supabase.from('lv_seller_orders').select(CAMPOS)
    .eq('seller_id', sellerId).order('created_at', { ascending: false });
  if (error) throw new Error(registrarFalha('pedidos-carregar', error, 'Não foi possível carregar os pedidos.'));
  return ((data as unknown as SubpedidoDaLoja[]) ?? []).map(normalizar);
}

// A entrega é 1:1 com o subpedido: o PostgREST devolve objeto, não lista.
function normalizar(s: SubpedidoDaLoja): SubpedidoDaLoja {
  return { ...s, lv_shipments: comoLista(s.lv_shipments), lv_order_items: comoLista(s.lv_order_items) };
}

export async function subpedidoDaLoja(id: string, sellerId: string): Promise<SubpedidoDaLoja | null> {
  const { data, error } = await supabase.from('lv_seller_orders').select(CAMPOS).eq('id', id).eq('seller_id', sellerId).maybeSingle();
  if (error) throw new Error(registrarFalha('pedidos-carregar', error, 'Não foi possível carregar o pedido.'));
  return data ? normalizar(data as unknown as SubpedidoDaLoja) : null;
}

export interface EnderecoDeEntrega {
  destinatario: string; cep: string; logradouro: string; numero: string; complemento: string | null;
  bairro: string; cidade: string; uf: string; referencia: string | null;
}

/** Só aparece depois do pagamento aprovado (RLS). Antes disso, devolve nulo. */
export async function enderecoDoPedido(orderId: string): Promise<EnderecoDeEntrega | null> {
  const { data } = await supabase.from('lv_order_addresses')
    .select('destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia').eq('order_id', orderId).maybeSingle();
  return (data as EnderecoDeEntrega | null) ?? null;
}

export async function eventosDoSubpedido(id: string) {
  const { data } = await supabase.from('lv_order_events').select('tipo, origem, created_at, metadata').eq('seller_order_id', id).order('created_at');
  return (data as { tipo: string; origem: string; created_at: string }[] | null) ?? [];
}

export async function avancarStatus(id: string, status: StatusDoSubpedido): Promise<void> {
  const { error } = await supabase.rpc('lv_subpedido_mudar_status', { p_seller_order: id, p_status: status, p_nota: null });
  if (error) throw new Error(registrarFalha('pedido-status', error, 'Não foi possível mudar o status.'));
}
