// Envio de mensagem pela central de WhatsApp — staging, número de teste.
//
// Ao contrário do webhook, esta função EXIGE JWT: do outro lado tem uma pessoa logada, não
// a Meta. O token da Meta nunca chega ao navegador; ele só existe aqui dentro.
//
// A permissão NÃO é verificada aqui: quem decide é `wa_pode_enviar`, no banco, com a mesma
// regra usada pelos outros caminhos (admin ou papel `atendimento` da empresa) — e com o
// RELÓGIO DO BANCO para a janela de 24 h, porque o do navegador pode estar errado.
//
// A ordem é deliberada: a linha da mensagem existe ANTES de a Meta ser chamada. Se a Meta
// respondesse e o banco falhasse depois, o cliente teria recebido algo que o atendimento não
// sabe que mandou.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  lerPedido, lerVeredito, corpoParaMeta, lerRespostaDaMeta,
  idProvisorio, idSimulado, EXPLICACAO, type MotivoRecusa,
} from '../_shared/whatsappEnvio.ts';
import { logEdge, newRequestId } from '../_shared/log.ts';

const FN = 'whatsapp-enviar';
const VERSAO_API = 'v21.0';
const TOKEN = Deno.env.get('WHATSAPP_COFICO_TOKEN');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const recusa = (motivo: MotivoRecusa, status = 403) =>
  json({ ok: false, motivo, explicacao: EXPLICACAO[motivo] }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, motivo: 'metodo' }, 405);
  const requestId = newRequestId();

  // ── quem está pedindo ────────────────────────────────────────────────────────
  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao.startsWith('Bearer ')) return recusa('nao_autenticado', 401);

  // Cliente COM o JWT da pessoa: é assim que `wa_pode_enviar` enxerga `auth.uid()` e a RLS
  // continua valendo. Nada aqui usa service role para DECIDIR — só para gravar.
  const comoUsuario = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return recusa('nao_autenticado', 401);

  // ── o pedido ─────────────────────────────────────────────────────────────────
  let corpo: unknown;
  try { corpo = await req.json(); } catch { return recusa('chave_invalida', 400); }
  const lido = lerPedido(corpo as Record<string, unknown>);
  if (!lido.ok) return recusa(lido.motivo, 400);
  const { conversa, texto, chave } = lido.pedido;

  // ── pode? quem responde é o banco ────────────────────────────────────────────
  const { data: brutoVeredito, error: eVeredito } = await comoUsuario
    .rpc('wa_pode_enviar', { p_conversa: conversa });
  if (eVeredito) {
    logEdge(FN, { requestId, etapa: 'veredito', erro: eVeredito.message.slice(0, 80) });
    return json({ ok: false, motivo: 'erro', explicacao: 'Não foi possível verificar a permissão.' }, 500);
  }
  const v = lerVeredito(brutoVeredito);
  if (!v.pode) {
    logEdge(FN, { requestId, etapa: 'recusado', motivo: v.motivo, usuario: user.id.slice(0, 8) });
    return recusa(v.motivo ?? 'sem_permissao');
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } });

  // ── 1. a linha existe ANTES de qualquer chamada à Meta ───────────────────────
  const agora = new Date().toISOString();
  const { data: linha, error: eInsert } = await admin.from('wa_mensagens').insert({
    company_id: v.company_id, conversa_id: conversa, id_externo: idProvisorio(chave),
    chave_envio: chave, direcao: 'saida', tipo: 'texto', texto,
    estado: 'enviada', enviada_por: user.id, ocorrida_em: agora,
  }).select('id').single();

  if (eInsert) {
    // 23505 na chave de envio = clique duplo. A primeira mensagem já está a caminho;
    // a segunda não pode virar outra mensagem para o cliente.
    if (eInsert.code === '23505') {
      logEdge(FN, { requestId, etapa: 'duplicado', chave: chave.slice(0, 8) });
      return json({ ok: true, duplicado: true, explicacao: 'Esta mensagem já foi enviada.' });
    }
    logEdge(FN, { requestId, etapa: 'gravar', erro: eInsert.message.slice(0, 80) });
    return json({ ok: false, motivo: 'erro', explicacao: 'Não foi possível registrar a mensagem.' }, 500);
  }

  const concluir = async (campos: Record<string, unknown>) => {
    await admin.from('wa_mensagens').update(campos).eq('id', linha!.id);
  };

  // ── 2. sem token: SIMULADO, e o nome diz isso no banco e na tela ─────────────
  if (!TOKEN) {
    await concluir({ id_externo: idSimulado(chave), estado: 'enviada' });
    await admin.from('wa_conversas').update({ ultima_saida_em: agora, atualizada_em: agora }).eq('id', conversa);
    logEdge(FN, { requestId, etapa: 'simulado', conversa: conversa.slice(0, 8) });
    return json({
      ok: true, simulado: true,
      explicacao: 'Simulado: o token da Meta ainda não foi configurado. Nada saiu para o cliente.',
    });
  }

  // ── 3. a Meta ────────────────────────────────────────────────────────────────
  let status = 0; let resposta: unknown = null;
  try {
    const r = await fetch(`https://graph.facebook.com/${VERSAO_API}/${v.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(corpoParaMeta(v.telefone!, texto)),
    });
    status = r.status;
    resposta = await r.json().catch(() => null);
  } catch (e) {
    const detalhe = e instanceof Error ? e.message.slice(0, 120) : 'falha de rede';
    await concluir({ estado: 'falhou', erro_codigo: 'rede', erro_texto: detalhe });
    logEdge(FN, { requestId, etapa: 'rede', erro: detalhe });
    return json({ ok: false, motivo: 'erro', explicacao: 'Não foi possível falar com o WhatsApp. A mensagem ficou marcada como falha.' }, 502);
  }

  const { wamid, erroCodigo, erroTexto } = lerRespostaDaMeta(status, resposta);
  if (!wamid) {
    await concluir({ estado: 'falhou', erro_codigo: erroCodigo, erro_texto: erroTexto });
    logEdge(FN, { requestId, etapa: 'recusa-meta', codigo: erroCodigo });
    return json({ ok: false, motivo: 'meta', codigo: erroCodigo, explicacao: erroTexto }, 502);
  }

  // ── 4. o wamid real entra na linha: é por ele que o webhook casa o status ────
  await concluir({ id_externo: wamid, estado: 'enviada' });
  await admin.from('wa_conversas').update({ ultima_saida_em: agora, atualizada_em: agora }).eq('id', conversa);
  logEdge(FN, { requestId, etapa: 'enviado', conversa: conversa.slice(0, 8) });
  return json({ ok: true, wamid });
});
