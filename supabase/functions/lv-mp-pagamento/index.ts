// Coffee LiVRE — cobranças do comprador (Split 1:1: uma por subpedido).
//
// acao: "config"  provedor, ambiente e o que está disponível (sem segredos; public_key só se existir)
//       "criar"   { order_id, metodo: 'pix'|'cartao', cartoes?: { [seller_order_id]: {token, payment_method_id, installments, issuer_id} } }
//       "status"  { order_id } cobranças do pedido; consulta o provedor para as pendentes
//                 (pagamentos com credencial de teste não enviam webhook: a consulta é a garantia)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  clienteDoUsuario, clienteServico, contexto, cors, json, provedorDoContexto, registrar, respostaDeErro, rpc, tokenDoVendedor,
} from '../_shared/lvMp/servico.ts';
import { BloqueioDeAmbiente, conferirLiveMode, faltandoParaMercadoPago } from '../_shared/lvMp/ambiente.ts';
import { ErroDoProvedor } from '../_shared/lvMp/provedor.ts';

const FN = 'lv-mp-pagamento';
const CAMPOS = 'id, seller_order_id, seller_id, provedor, ambiente, metodo, status, valor_cents, frete_cents, expira_em, pix_qr_code, pix_qr_base64, pix_ticket_url, mp_status_detail, ultimo_erro, atualizado_em, ultima_reconciliacao_em, mp_payment_id';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const rid = crypto.randomUUID();
  const servico = clienteServico();
  try {
    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ctx = await contexto(servico);
    const acao = String(corpo.acao ?? 'config');

    if (acao === 'config') {
      const falta = ctx.provedor === 'mercadopago' ? faltandoParaMercadoPago(ctx.segredos) : [];
      const ativo = ctx.provedor === 'mock' || (ctx.provedor === 'mercadopago' && falta.length === 0);
      return json({
        ambiente: ctx.ambiente, provedor: ctx.provedor, ativo, teste: ctx.ambiente === 'teste',
        pix: ativo, cartao: ativo, public_key: ctx.provedor === 'mercadopago' && ativo ? ctx.segredos.publicKey : null,
      });
    }

    const cliente = clienteDoUsuario(req);
    if (!cliente) return json({ erro: 'Entre na sua conta.', codigo: 'NAO_AUTENTICADO' }, 401);
    const orderId = String(corpo.order_id ?? '');

    if (acao === 'criar') {
      const provedor = provedorDoContexto(ctx, servico);
      const metodo = corpo.metodo === 'cartao' ? 'cartao' : 'pix';
      const prep = await rpc<{ cobrancas: Record<string, unknown>[]; comprador_email: string; comprador_nome: string; numero: string }>(
        cliente, 'lv_cobranca_preparar', { p_order: orderId, p_metodo: metodo });
      const cartoes = (corpo.cartoes ?? {}) as Record<string, { token: string; payment_method_id: string; installments?: number; issuer_id?: string; cpf?: string }>;
      const falhas: { cobranca_id: string; loja: string; codigo: string; erro: string }[] = [];

      for (const c of prep.cobrancas) {
        if (c.status !== 'criando') continue;   // já criada antes: idempotência
        const cobrancaId = c.id as string;
        try {
          const cartao = metodo === 'cartao' ? cartoes[c.seller_order_id as string] ?? cartoes['*'] : undefined;
          if (metodo === 'cartao' && !cartao) {
            throw new BloqueioDeAmbiente(`Dados do cartão ausentes para ${c.loja_nome}. Cada loja é um pagamento separado.`, 'CARTAO_POR_LOJA');
          }
          if (metodo === 'cartao' && ctx.provedor === 'mercadopago' && !cartoes[c.seller_order_id as string] && prep.cobrancas.length > 1) {
            // Token de cartão do Mercado Pago é de uso único: um por pagamento.
            throw new BloqueioDeAmbiente('Com mais de uma loja, cada pagamento precisa do próprio token de cartão.', 'CARTAO_POR_LOJA');
          }
          const token = await tokenDoVendedor(servico, ctx, c.seller_id as string);
          const remoto = await provedor.criar({
            idempotencyKey: c.idempotency_key as string, externalReference: c.external_reference as string,
            valorCents: Number(c.valor_cents), applicationFeeCents: Number(c.application_fee_cents),
            descricao: `Coffee LiVRE ${c.subpedido} · ${c.loja_nome}`, metodo,
            pagador: { email: prep.comprador_email, nome: prep.comprador_nome },
            expiraEm: metodo === 'pix' && c.expira_em ? new Date(c.expira_em as string).toISOString() : null,
            notificationUrl: ctx.segredos.webhookUrl ?? null,
            cartao: cartao ? { token: cartao.token, paymentMethodId: cartao.payment_method_id, installments: cartao.installments ?? 1, issuerId: cartao.issuer_id ?? null, cpf: cartao.cpf ?? null } : null,
            accessTokenDoVendedor: token,
          });
          conferirLiveMode(ctx.ambiente, remoto.live_mode);
          await rpc(servico, 'lv_cobranca_registrar_criacao', { p_cobranca: cobrancaId, p_remoto: remoto });
        } catch (e) {
          const codigo = e instanceof BloqueioDeAmbiente ? e.codigo : e instanceof ErroDoProvedor ? 'ERRO_DO_PROVEDOR' : 'ERRO_INTERNO';
          const erro = e instanceof BloqueioDeAmbiente || e instanceof ErroDoProvedor ? (e as Error).message : 'Falha ao gerar o pagamento.';
          await servico.rpc('lv_cobranca_falhou', { p_cobranca: cobrancaId, p_erro: `${codigo}: ${erro}` });
          falhas.push({ cobranca_id: cobrancaId, loja: String(c.loja_nome), codigo, erro });
        }
      }
      const { data: cobrancas } = await cliente.from('lv_cobrancas').select(CAMPOS).eq('order_id', orderId).order('criado_em');
      await registrar(servico, FN, rid, falhas.length ? 'warn' : 'info', 200, { acao, order_id: orderId, metodo, provedor: ctx.provedor, falhas: falhas.map(f => f.codigo) });
      return json({ provedor: ctx.provedor, ambiente: ctx.ambiente, cobrancas: cobrancas ?? [], falhas });
    }

    if (acao === 'status') {
      const { data: minhas, error } = await cliente.from('lv_cobrancas').select(CAMPOS).eq('order_id', orderId).order('criado_em');
      if (error) throw error;
      if (ctx.provedor !== 'desativado') {
        const provedor = provedorDoContexto(ctx, servico);
        for (const c of minhas ?? []) {
          const recente = c.ultima_reconciliacao_em && Date.now() - Date.parse(c.ultima_reconciliacao_em) < 15000;
          if (!c.mp_payment_id || recente || !['aguardando_pagamento', 'em_analise'].includes(c.status)) continue;
          try {
            const token = await tokenDoVendedor(servico, ctx, c.seller_id);
            const remoto = await provedor.consultar(c.mp_payment_id, token);
            conferirLiveMode(ctx.ambiente, remoto.live_mode);
            await rpc(servico, 'lv_cobranca_aplicar', { p_cobranca: c.id, p_remoto: remoto, p_origem: 'rotina' });
          } catch (e) {
            await registrar(servico, FN, rid, 'warn', 200, { acao, cobranca_id: c.id }, (e as Error).message);
          }
        }
      }
      const [{ data: cobrancas }, { data: pedido }] = await Promise.all([
        cliente.from('lv_cobrancas').select(CAMPOS).eq('order_id', orderId).order('criado_em'),
        cliente.from('lv_orders').select('status, pagamento_status').eq('id', orderId).maybeSingle(),
      ]);
      return json({ provedor: ctx.provedor, ambiente: ctx.ambiente, pedido, cobrancas: cobrancas ?? [] });
    }

    return json({ erro: 'Ação desconhecida.', codigo: 'ACAO_INVALIDA' }, 400);
  } catch (e) {
    await registrar(servico, FN, rid, 'error', 500, {}, (e as Error).message);
    return respostaDeErro(e);
  }
});
