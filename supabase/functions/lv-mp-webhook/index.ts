// Coffee LiVRE — notificações do Mercado Pago (publicar SEMPRE com --no-verify-jwt).
//
// 1. confere a assinatura x-signature (fail closed);
// 2. grava o evento (deduplicado por provedor + x-request-id);
// 3. não confia no corpo: busca o pagamento no provedor com o token do vendedor;
// 4. aplica o estado oficial pela função do banco (idempotente, sem regressão);
// 5. responde 200 — muito abaixo do limite de 22 s da documentação.
// Log sem segredo e sem o corpo do pagamento.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { clienteServico, contexto, cors, json, provedorDoContexto, registrar, rpc, segredoDoWebhook, tokenDoVendedor } from '../_shared/lvMp/servico.ts';
import { assinaturaValida } from '../_shared/lvMp/assinatura.ts';
import { BloqueioDeAmbiente, conferirLiveMode } from '../_shared/lvMp/ambiente.ts';

const FN = 'lv-mp-webhook';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const servico = clienteServico();
  const requestId = req.headers.get('x-request-id') ?? '';
  const rid = requestId || crypto.randomUUID();
  try {
    const texto = await req.text();
    let corpo: Record<string, unknown> = {};
    try { corpo = texto ? JSON.parse(texto) : {}; } catch { corpo = {}; }
    const url = new URL(req.url);
    const dataId = String((corpo.data as Record<string, unknown> | undefined)?.id ?? url.searchParams.get('data.id') ?? '');
    const tipo = String(corpo.type ?? url.searchParams.get('type') ?? '');
    const ctx = await contexto(servico);
    if (ctx.provedor === 'desativado') return json({ erro: 'Pagamentos desativados.' }, 503);

    const valida = await assinaturaValida({ xSignature: req.headers.get('x-signature'), requestId, dataId, segredo: segredoDoWebhook(ctx) });
    if (!requestId) return json({ erro: 'x-request-id ausente.' }, 400);

    const { data: evento, error: eEv } = await servico.from('lv_mp_webhook_eventos').insert({
      provedor: ctx.provedor, request_id: requestId, tipo, acao: String(corpo.action ?? ''), data_id: dataId,
      mp_user_id: corpo.user_id != null ? String(corpo.user_id) : null,
      live_mode: typeof corpo.live_mode === 'boolean' ? corpo.live_mode : null, assinatura_valida: valida,
      resultado: valida ? 'recebido' : 'assinatura_invalida',
    }).select('id').single();
    if (eEv) {
      if (eEv.code === '23505') {
        await registrar(servico, FN, rid, 'info', 200, { duplicado: true, tipo });
        return json({ duplicado: true });
      }
      throw eEv;
    }
    if (!valida) {
      await registrar(servico, FN, rid, 'warn', 401, { tipo });
      return json({ erro: 'Assinatura inválida.' }, 401);
    }

    const finalizar = (resultado: string, erro?: string) =>
      servico.from('lv_mp_webhook_eventos').update({ resultado, erro: erro ?? null, processado_em: new Date().toISOString() }).eq('id', evento.id);

    if (tipo !== 'payment' || !dataId) {
      await finalizar('ignorado');
      return json({ ignorado: true });
    }
    conferirLiveMode(ctx.ambiente, typeof corpo.live_mode === 'boolean' ? corpo.live_mode : null);

    const { data: cobranca } = await servico.from('lv_cobrancas').select('id, seller_id, provedor, ambiente')
      .eq('mp_payment_id', dataId).maybeSingle();
    if (!cobranca || cobranca.ambiente !== ctx.ambiente) {
      await finalizar('cobranca_nao_encontrada');
      return json({ recebido: true });
    }
    const provedor = provedorDoContexto(ctx, servico);
    const token = await tokenDoVendedor(servico, ctx, cobranca.seller_id).catch(e => {
      // Mock: o estado remoto é local; o token só é exigido no Mercado Pago real.
      if (ctx.provedor === 'mock' && e instanceof BloqueioDeAmbiente) return 'mock';
      throw e;
    });
    const remoto = await provedor.consultar(dataId, token);
    conferirLiveMode(ctx.ambiente, remoto.live_mode);
    const r = await rpc<{ status: string; acao: string }>(servico, 'lv_cobranca_aplicar', { p_cobranca: cobranca.id, p_remoto: remoto, p_origem: 'webhook' });
    await finalizar(r.acao);
    await registrar(servico, FN, rid, 'info', 200, { tipo, cobranca_id: cobranca.id, status: r.status, acao: r.acao });
    return json({ recebido: true, status: r.status });
  } catch (e) {
    await registrar(servico, FN, rid, 'error', 500, {}, (e as Error).message);
    // 500 faz o Mercado Pago tentar de novo; o processamento é repetível.
    return json({ erro: 'Falha ao processar a notificação.' }, e instanceof BloqueioDeAmbiente ? 503 : 500);
  }
});
