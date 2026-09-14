// Coffee LiVRE — peças comuns das Edge Functions do Mercado Pago (Deno).
//
// Regras que valem para todas as funções lv-mp-*:
//   • o ambiente vem do banco e precisa bater com LV_MP_AMBIENTE declarado na função;
//   • o provedor vem de lv_pagamentos_config (mock só em teste; desativado em produção);
//   • token de vendedor só é lido pelo serviço, nunca devolvido na resposta;
//   • log sem segredo e sem dado do pagador.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { logEdge } from '../log.ts';
import {
  BloqueioDeAmbiente, conferirAmbiente, conferirProvedor, faltandoParaMercadoPago, lerSegredos,
  type Ambiente, type Provedor, type SegredosMp,
} from './ambiente.ts';
import { ErroDoProvedor, provedorMercadoPago, provedorMock, type ArmazemMock, type PagamentoRemoto, type ProvedorDePagamento } from './provedor.ts';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const URL_SB = () => Deno.env.get('SUPABASE_URL')!;
const SERVICE = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = () => Deno.env.get('SUPABASE_ANON_KEY')!;

export function clienteServico(): SupabaseClient {
  return createClient(URL_SB(), SERVICE(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cliente com o JWT de quem chamou: é ele que a RLS e as funções do banco enxergam. */
export function clienteDoUsuario(req: Request): SupabaseClient | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return createClient(URL_SB(), ANON(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
}

export function ehChaveDeServico(req: Request): boolean {
  return req.headers.get('Authorization') === `Bearer ${SERVICE()}`;
}

export async function usuarioAtual(req: Request): Promise<{ id: string; email: string | null } | null> {
  const c = clienteDoUsuario(req);
  if (!c) return null;
  const { data } = await c.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function ehAdmin(req: Request, servico: SupabaseClient): Promise<boolean> {
  if (ehChaveDeServico(req)) return true;
  const u = await usuarioAtual(req);
  if (!u) return false;
  const { data } = await servico.from('user_profiles').select('is_admin').eq('id', u.id).maybeSingle();
  return data?.is_admin === true;
}

export interface Contexto {
  ambiente: Ambiente;
  provedor: Provedor;
  segredos: SegredosMp;
  freteNaApplicationFee: boolean;
  pixMinutos: number;
}

export async function contexto(servico: SupabaseClient): Promise<Contexto> {
  const { data, error } = await servico.rpc('lv_pagamentos_config');
  if (error || !data) throw new Error('Configuração de pagamentos indisponível.');
  const ambiente = conferirAmbiente(data.ambiente as Ambiente, Deno.env.get('LV_MP_AMBIENTE'));
  return {
    ambiente,
    provedor: data.provedor as Provedor,
    segredos: lerSegredos(ambiente, n => Deno.env.get(n)),
    freteNaApplicationFee: data.frete_no_application_fee !== false,
    pixMinutos: Number(data.pix_minutos ?? 30),
  };
}

/** Segredo do webhook do MOCK: existe só no ambiente de teste, com nome próprio. */
export function segredoDoWebhook(ctx: Contexto): string | undefined {
  if (ctx.provedor === 'mock') return ctx.ambiente === 'teste' ? Deno.env.get('LV_MP_TESTE_MOCK_WEBHOOK_SECRET') : undefined;
  return ctx.segredos.webhookSecret;
}

const BPS_MOCK = { pix: 99, cartao: 498 } as const;

function armazemSupabase(servico: SupabaseClient): ArmazemMock {
  const deLinha = (r: Record<string, unknown>): PagamentoRemoto => ({
    id: r.mp_payment_id as string, status: r.status as string, status_detail: (r.status_detail as string) ?? null,
    collector_id: (r.collector_id as string) ?? null, live_mode: r.live_mode as boolean,
    transaction_amount_cents: Number(r.transaction_amount_cents), processor_fee_cents: r.processor_fee_cents == null ? null : Number(r.processor_fee_cents),
    application_fee_cents: r.application_fee_cents == null ? null : Number(r.application_fee_cents),
    net_received_cents: r.net_received_cents == null ? null : Number(r.net_received_cents), refunded_cents: Number(r.refunded_cents ?? 0),
  });
  return {
    async ler(id) {
      const { data } = await servico.from('lv_mp_mock_remoto').select('*').eq('mp_payment_id', id).maybeSingle();
      return data ? deLinha(data) : null;
    },
    async gravar(p) {
      const { error } = await servico.from('lv_mp_mock_remoto').upsert({
        mp_payment_id: p.id, cobranca_id: p.cobranca_id ?? null, status: p.status, status_detail: p.status_detail, collector_id: p.collector_id,
        live_mode: false, transaction_amount_cents: p.transaction_amount_cents, processor_fee_cents: p.processor_fee_cents,
        application_fee_cents: p.application_fee_cents, net_received_cents: p.net_received_cents, refunded_cents: p.refunded_cents,
        atualizado_em: new Date().toISOString(),
      });
      if (error) throw new Error('mock: ' + error.message);
    },
    async reembolsoPorChave(id, chave) {
      const { data } = await servico.from('lv_mp_mock_remoto').select('reembolsos').eq('mp_payment_id', id).maybeSingle();
      const r = ((data?.reembolsos ?? []) as { chave: string; refundId: string }[]).find(x => x.chave === chave);
      return r ? { refundId: r.refundId, status: 'approved' } : null;
    },
    async registrarReembolso(id, chave, refundId, valor) {
      const { data } = await servico.from('lv_mp_mock_remoto').select('*').eq('mp_payment_id', id).single();
      const total = Number(data.refunded_cents) + valor;
      const cheio = total >= Number(data.transaction_amount_cents);
      await servico.from('lv_mp_mock_remoto').update({
        refunded_cents: total, status: cheio ? 'refunded' : 'approved', status_detail: cheio ? 'refunded' : 'partially_refunded',
        reembolsos: [...(data.reembolsos ?? []), { chave, refundId, valor }], atualizado_em: new Date().toISOString(),
      }).eq('mp_payment_id', id);
    },
  };
}

export function provedorDoContexto(ctx: Contexto, servico: SupabaseClient): ProvedorDePagamento {
  conferirProvedor(ctx.provedor, ctx.ambiente);
  if (ctx.provedor === 'mock') return provedorMock(armazemSupabase(servico), m => BPS_MOCK[m]);
  const falta = faltandoParaMercadoPago(ctx.segredos);
  if (falta.length) {
    throw new BloqueioDeAmbiente(
      `Mercado Pago não configurado neste ambiente (faltam: ${falta.map(f => `LV_MP_${ctx.ambiente === 'teste' ? 'TESTE' : 'PRODUCAO'}_${f}`).join(', ')}).`,
      'MP_NAO_CONFIGURADO');
  }
  return provedorMercadoPago();
}

/** Token OAuth do vendedor (Split 1:1). Só serviço. Nunca vai para a resposta. */
export async function tokenDoVendedor(servico: SupabaseClient, ctx: Contexto, sellerId: string): Promise<string> {
  const { data, error } = await servico.rpc('lv_mp_credencial_ler', { p_seller: sellerId });
  if (error) throw new Error('credencial: ' + error.message);
  if (!data || data.status !== 'conectado' || !data.access_token) {
    throw new BloqueioDeAmbiente('O vendedor não conectou o Mercado Pago.', 'SELLER_SEM_MERCADO_PAGO');
  }
  if (data.provedor !== ctx.provedor) {
    throw new BloqueioDeAmbiente('Conexão do vendedor é de outro provedor.', 'CONEXAO_DE_OUTRO_PROVEDOR');
  }
  if (data.expira_em && Date.parse(data.expira_em) < Date.now()) {
    await servico.rpc('lv_mp_conexao_marcar', { p_seller: sellerId, p_status: 'expirado', p_erro: 'token expirado' });
    throw new BloqueioDeAmbiente('A conexão do vendedor com o Mercado Pago expirou.', 'TOKEN_EXPIRADO');
  }
  return data.access_token as string;
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof BloqueioDeAmbiente) return json({ erro: e.message, codigo: e.codigo }, 503);
  if (e instanceof ErroDoProvedor) return json({ erro: e.message, codigo: 'ERRO_DO_PROVEDOR' }, 502);
  const err = e as { message?: string; hint?: string; code?: string };
  if (err?.hint) return json({ erro: err.message, codigo: err.hint }, 400);
  return json({ erro: 'Erro interno.', codigo: 'ERRO_INTERNO' }, 500);
}

export async function registrar(servico: SupabaseClient, fn: string, rid: string, level: 'info' | 'warn' | 'error', status: number, meta: Record<string, unknown>, erro?: string) {
  await logEdge(servico as never, { function_name: fn, request_id: rid, level, status, meta, error_text: erro });
}

/** Chama rpc e transforma erro do PostgREST em exceção com hint preservado. */
export async function rpc<T = unknown>(c: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { hint: error.hint, code: error.code });
  return data as T;
}
