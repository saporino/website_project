// Coffee LiVRE — reembolsos pelo provedor (admin ou serviço).
//
// { cobranca_id?, valor_cents?, motivo? } — com cobranca_id, primeiro solicita
// (lv_reembolso_solicitar, idempotente: um reembolso aberto por cobrança). Depois
// processa todos os reembolsos pendentes deste ambiente: POST de reembolso no
// provedor com X-Idempotency-Key própria de cada reembolso, e consulta o pagamento
// para atualizar a cobrança. Rodar de novo não duplica.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  clienteDoUsuario, clienteServico, contexto, cors, ehAdmin, ehChaveDeServico, json, provedorDoContexto, registrar, respostaDeErro, rpc, tokenDoVendedor,
} from '../_shared/lvMp/servico.ts';
import { BloqueioDeAmbiente, conferirLiveMode } from '../_shared/lvMp/ambiente.ts';

const FN = 'lv-mp-reembolso';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const rid = crypto.randomUUID();
  const servico = clienteServico();
  try {
    if (!(await ehAdmin(req, servico))) return json({ erro: 'Sem permissão.', codigo: 'SEM_PERMISSAO' }, 403);
    const corpo = await req.json().catch(() => ({})) as Record<string, unknown>;
    const ctx = await contexto(servico);
    const provedor = provedorDoContexto(ctx, servico);

    let solicitado: unknown = null;
    if (corpo.cobranca_id) {
      const quem = ehChaveDeServico(req) ? servico : clienteDoUsuario(req)!;
      solicitado = await rpc(quem, 'lv_reembolso_solicitar', {
        p_cobranca: corpo.cobranca_id, p_valor_cents: corpo.valor_cents ?? null, p_motivo: corpo.motivo ?? null,
      });
    }

    const pendentes = await rpc<{ refund_id: string; cobranca_id: string; mp_payment_id: string; seller_id: string; valor_cents: number; total_cobranca_cents: number; idempotency_key: string }[]>(
      servico, 'lv_reembolsos_a_processar', { p_limite: 20 });
    const resultado = { processados: 0, concluidos: 0, falhas: 0 };
    for (const r of pendentes ?? []) {
      resultado.processados++;
      try {
        if (!r.mp_payment_id) throw new Error('Cobrança sem pagamento no provedor.');
        const token = await tokenDoVendedor(servico, ctx, r.seller_id).catch(e => {
          if (ctx.provedor === 'mock' && e instanceof BloqueioDeAmbiente) return 'mock';
          throw e;
        });
        const parcial = Number(r.valor_cents) < Number(r.total_cobranca_cents);
        const feito = await provedor.reembolsar(r.mp_payment_id, parcial ? Number(r.valor_cents) : null, r.idempotency_key, token);
        const status = feito.status === 'approved' ? 'refunded' : feito.status === 'rejected' || feito.status === 'cancelled' ? 'refund_failed' : 'refund_processing';
        await rpc(servico, 'lv_reembolso_aplicar', { p_refund: r.refund_id, p_status: status, p_provider_refund_id: feito.refundId, p_erro: null });
        const remoto = await provedor.consultar(r.mp_payment_id, token);
        conferirLiveMode(ctx.ambiente, remoto.live_mode);
        await rpc(servico, 'lv_cobranca_aplicar', { p_cobranca: r.cobranca_id, p_remoto: remoto, p_origem: 'admin' });
        if (status === 'refunded') resultado.concluidos++;
      } catch (e) {
        resultado.falhas++;
        // Saldo insuficiente do vendedor e afins: não some — vai para revisão manual.
        await servico.rpc('lv_reembolso_aplicar', { p_refund: r.refund_id, p_status: 'manual_review', p_provider_refund_id: null, p_erro: (e as Error).message });
      }
    }
    await registrar(servico, FN, rid, 'info', 200, resultado);
    return json({ solicitado, ...resultado });
  } catch (e) {
    await registrar(servico, FN, rid, 'error', 500, {}, (e as Error).message);
    return respostaDeErro(e);
  }
});
