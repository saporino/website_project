// Coffee LiVRE — pagamentos no navegador (camada de dados).
//
// O navegador NUNCA fala com o Mercado Pago com segredo: chama as Edge Functions
// lv-mp-* com a sessão do usuário. Nenhum token de vendedor chega aqui.
import { supabase } from '../../../lib/supabase';
import { registrarFalha, type Operacao } from '../observabilidade';
import type { StatusDaCobranca } from '../../../../supabase/functions/_shared/lvMp/status';

export class ErroDePagamento extends Error {
  constructor(msg: string, readonly codigo: string | null) { super(msg); }
}

async function invocar<T>(nome: string, corpo: Record<string, unknown>, operacao: Operacao): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) {
    let detalhe: { erro?: string; codigo?: string } = {};
    try { detalhe = await (error as { context?: Response }).context?.json() ?? {}; } catch { /* sem corpo */ }
    const msg = registrarFalha(operacao, { message: detalhe.erro ?? error.message, code: detalhe.codigo }, 'Pagamento indisponível agora.');
    throw new ErroDePagamento(detalhe.erro ?? msg, detalhe.codigo ?? null);
  }
  return data as T;
}

export interface ConfigDePagamento {
  ambiente: 'teste' | 'producao';
  provedor: 'mock' | 'mercadopago' | 'desativado';
  ativo: boolean;
  teste: boolean;
  pix: boolean;
  cartao: boolean;
  public_key: string | null;
}

export async function configDePagamento(): Promise<ConfigDePagamento> {
  try {
    return await invocar<ConfigDePagamento>('lv-mp-pagamento', { acao: 'config' }, 'carregar');
  } catch {
    // Função não publicada (produção antes da U9.2) = pagamento online desativado, dito com clareza.
    return { ambiente: 'producao', provedor: 'desativado', ativo: false, teste: false, pix: false, cartao: false, public_key: null };
  }
}

export interface CobrancaDoComprador {
  id: string;
  seller_order_id: string;
  metodo: 'pix' | 'cartao';
  status: StatusDaCobranca;
  provedor: 'mock' | 'mercadopago';
  ambiente: 'teste' | 'producao';
  valor_cents: number;
  frete_cents: number;
  expira_em: string | null;
  pix_qr_code: string | null;
  pix_qr_base64: string | null;
  pix_ticket_url: string | null;
  mp_status_detail: string | null;
  criado_em: string;
  lv_seller_orders: { numero: string; loja_nome: string } | null;
}

export type DadosDoCartao = { token: string; payment_method_id: string; installments: number; issuer_id?: string | null; cpf?: string | null };

export async function criarCobrancas(orderId: string, metodo: 'pix' | 'cartao', cartoes?: Record<string, DadosDoCartao>) {
  return invocar<{ falhas: { loja: string; codigo: string; erro: string }[] }>(
    'lv-mp-pagamento', { acao: 'criar', order_id: orderId, metodo, cartoes }, 'pagamento-criar');
}

/** Pede ao servidor para conferir o provedor e lê as cobranças do pedido (RLS do comprador). */
export async function cobrancasDoPedido(orderId: string, conferir = true) {
  let pedido: { status: string; pagamento_status: string } | null = null;
  if (conferir) {
    const r = await invocar<{ pedido: { status: string; pagamento_status: string } | null }>(
      'lv-mp-pagamento', { acao: 'status', order_id: orderId }, 'pagamento-status').catch(() => null);
    pedido = r?.pedido ?? null;
  }
  const { data, error } = await supabase.from('lv_cobrancas')
    .select('id, seller_order_id, metodo, status, provedor, ambiente, valor_cents, frete_cents, expira_em, pix_qr_code, pix_qr_base64, pix_ticket_url, mp_status_detail, criado_em, lv_seller_orders(numero, loja_nome)')
    .eq('order_id', orderId).order('criado_em', { ascending: false });
  if (error) throw new ErroDePagamento(registrarFalha('pagamento-status', error), null);
  return { pedido, cobrancas: (data as unknown as CobrancaDoComprador[]) ?? [] };
}

/** A cobrança mais recente de cada subpedido. */
export function ultimaPorSubpedido(lista: CobrancaDoComprador[]): CobrancaDoComprador[] {
  const vistas = new Set<string>();
  return lista.filter(c => (vistas.has(c.seller_order_id) ? false : (vistas.add(c.seller_order_id), true)));
}

// ---------------------------------------------------------------- vendedor
export interface EstadoDaConexao {
  ambiente: 'teste' | 'producao';
  provedor: 'mock' | 'mercadopago' | 'desativado';
  integracao_bloqueada: boolean;
  faltando: string[];
  conexao: {
    status: 'nao_conectado' | 'conectando' | 'conectado' | 'atencao' | 'expirado' | 'desconectado';
    mp_user_id?: string | null; escopos?: string[]; conectado_em?: string | null; renovado_em?: string | null;
    expira_em?: string | null; ultimo_erro?: string | null;
  };
}

export const estadoDaConexao = () => invocar<EstadoDaConexao>('lv-mp-conexao', { acao: 'estado' }, 'carregar');
export const iniciarConexao = (retorno: string) => invocar<{ url: string; mock: boolean }>('lv-mp-conexao', { acao: 'iniciar', retorno }, 'carregar');
export const concluirConexao = (code: string, state: string) => invocar<{ status: string }>('lv-mp-conexao', { acao: 'callback', code, state }, 'carregar');
export const desconectarMercadoPago = () => invocar<{ status: string }>('lv-mp-conexao', { acao: 'desconectar' }, 'carregar');

export interface CobrancaDoVendedor {
  id: string; status: StatusDaCobranca; metodo: string; provedor: string; criado_em: string;
  valor_cents: number; produtos_cents: number; frete_cents: number; comissao_cents: number; tarifa_cents: number;
  application_fee_cents: number; frete_no_application_fee: boolean;
  processor_fee_estimada_cents: number | null; processor_fee_real_cents: number | null;
  liquido_seller_estimado_cents: number | null; liquido_seller_real_cents: number | null; reembolsado_cents: number;
  lv_seller_orders: { numero: string } | null;
}

export async function cobrancasDoVendedor(sellerId: string): Promise<CobrancaDoVendedor[]> {
  const { data, error } = await supabase.from('lv_cobrancas')
    .select('id, status, metodo, provedor, criado_em, valor_cents, produtos_cents, frete_cents, comissao_cents, tarifa_cents, application_fee_cents, frete_no_application_fee, processor_fee_estimada_cents, processor_fee_real_cents, liquido_seller_estimado_cents, liquido_seller_real_cents, reembolsado_cents, lv_seller_orders(numero)')
    .eq('seller_id', sellerId).order('criado_em', { ascending: false }).limit(100);
  if (error) throw new ErroDePagamento(registrarFalha('pedidos-carregar', error), null);
  return (data as unknown as CobrancaDoVendedor[]) ?? [];
}

// ---------------------------------------------------------------- admin
export const reconciliar = (cobrancaId?: string) =>
  invocar<{ conferidas: number; alteradas: number; divergentes: number; erros: number }>('lv-mp-reconciliar', cobrancaId ? { cobranca_id: cobrancaId } : {}, 'pagamento-status');
export const processarReembolsos = (cobrancaId?: string, motivo?: string) =>
  invocar<{ processados: number; concluidos: number; falhas: number }>('lv-mp-reembolso', cobrancaId ? { cobranca_id: cobrancaId, motivo } : {}, 'pedido-cancelar');
