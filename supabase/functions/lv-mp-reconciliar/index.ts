// Coffee LiVRE — reconciliação das cobranças com o estado oficial do provedor.
//
// O banco não depende só do webhook (pagamentos de teste nem enviam notificação).
// Admin ou serviço: { cobranca_id? } — sem id, pega as pendentes, as que precisam
// de atenção, as aprovadas sem taxa real e as não conferidas há mais de 6 horas.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { clienteServico, contexto, cors, ehAdmin, json, provedorDoContexto, registrar, respostaDeErro, rpc, tokenDoVendedor } from '../_shared/lvMp/servico.ts';
import { BloqueioDeAmbiente, conferirLiveMode } from '../_shared/lvMp/ambiente.ts';

const FN = 'lv-mp-reconciliar';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const rid = crypto.randomUUID();
  const servico = clienteServico();
  try {
    if (!(await ehAdmin(req, servico))) return json({ erro: 'Sem permissão.', codigo: 'SEM_PERMISSAO' }, 403);
    const corpo = await req.json().catch(() => ({})) as Record<string, string>;
    const ctx = await contexto(servico);
    const provedor = provedorDoContexto(ctx, servico);
    const lista = await rpc<{ cobranca_id: string; mp_payment_id: string; seller_id: string; status: string }[]>(
      servico, 'lv_cobrancas_a_reconciliar', { p_limite: 50, p_cobranca: corpo.cobranca_id ?? null });
    const resultado = { conferidas: 0, alteradas: 0, divergentes: 0, erros: 0 };
    for (const c of lista ?? []) {
      try {
        const token = await tokenDoVendedor(servico, ctx, c.seller_id).catch(e => {
          if (ctx.provedor === 'mock' && e instanceof BloqueioDeAmbiente) return 'mock';
          throw e;
        });
        const remoto = await provedor.consultar(c.mp_payment_id, token);
        conferirLiveMode(ctx.ambiente, remoto.live_mode);
        const r = await rpc<{ mudou: boolean; acao: string; antes: string; status: string }>(servico, 'lv_cobranca_aplicar', {
          p_cobranca: c.cobranca_id, p_remoto: remoto, p_origem: corpo.cobranca_id ? 'admin' : 'rotina',
        });
        resultado.conferidas++;
        if (r.mudou) resultado.alteradas++;
        if (r.antes !== r.status || r.acao === 'regressao_recusada') resultado.divergentes++;
      } catch (e) {
        resultado.erros++;
        await servico.from('lv_mp_reconciliacoes').insert({
          cobranca_id: c.cobranca_id, origem: corpo.cobranca_id ? 'admin' : 'rotina', status_local_antes: c.status,
          status_local_depois: c.status, divergente: false, acao: 'erro', erro: (e as Error).message.slice(0, 300),
        });
      }
    }
    await registrar(servico, FN, rid, 'info', 200, resultado);
    return json(resultado);
  } catch (e) {
    await registrar(servico, FN, rid, 'error', 500, {}, (e as Error).message);
    return respostaDeErro(e);
  }
});
