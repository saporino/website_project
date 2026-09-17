// Coffee LiVRE — conexão do vendedor com o Mercado Pago (OAuth).
//
// acao: "estado"      situação da conexão (sem token nenhum)
//       "iniciar"     devolve a URL de autorização (PKCE + state); mock: URL de volta ao próprio site
//       "callback"    troca o code por tokens e guarda no Vault
//       "desconectar" apaga os tokens do Vault
//       "renovar"     (admin/serviço) renova tokens perto de expirar
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  clienteDoUsuario, clienteServico, contexto, cors, ehAdmin, json, provedorDoContexto, registrar, respostaDeErro, rpc, usuarioAtual,
} from '../_shared/lvMp/servico.ts';
import { conferirLiveMode, faltandoParaMercadoPago } from '../_shared/lvMp/ambiente.ts';
import {
  ROTA_CALLBACK, URL_TOKEN, corpoDaRenovacao, corpoDaTroca, gerarAleatorio, normalizarTokens, redirectUriValida,
  sha256Base64Url, sha256Hex, urlDeAutorizacao, type TokensDoVendedor,
} from '../_shared/lvMp/oauth.ts';

const FN = 'lv-mp-conexao';

async function trocarNoMercadoPago(corpo: Record<string, string>): Promise<TokensDoVendedor> {
  const resp = await fetch(URL_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const r = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(`Mercado Pago recusou a autorização (${resp.status}).`), { hint: 'OAUTH_RECUSADO' });
  return normalizarTokens(r as Record<string, unknown>);
}

function tokensMock(sellerId: string): TokensDoVendedor {
  return {
    accessToken: `mock_access_${gerarAleatorio(12)}`, refreshToken: `mock_refresh_${gerarAleatorio(12)}`,
    mpUserId: `mock-${sellerId.slice(0, 8)}`, publicKey: 'TEST-MOCK-PUBLIC-KEY', escopos: ['offline_access', 'read', 'write'],
    expiraEm: new Date(Date.now() + 180 * 86400000).toISOString(), liveMode: false,
  };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const rid = crypto.randomUUID();
  const servico = clienteServico();
  try {
    const corpo = await req.json().catch(() => ({})) as Record<string, string>;
    const ctx = await contexto(servico);
    const acao = corpo.acao ?? 'estado';

    if (acao === 'renovar') {
      if (!(await ehAdmin(req, servico))) return json({ erro: 'Sem permissão.', codigo: 'SEM_PERMISSAO' }, 403);
      const lista = await rpc<{ seller_id: string }[]>(servico, 'lv_mp_conexoes_a_renovar', { p_dias: 15 });
      let renovadas = 0;
      for (const { seller_id } of lista ?? []) {
        const cred = await rpc<Record<string, string>>(servico, 'lv_mp_credencial_ler', { p_seller: seller_id });
        try {
          const t = ctx.provedor === 'mock'
            ? tokensMock(seller_id)
            : await trocarNoMercadoPago(corpoDaRenovacao({ clientId: ctx.segredos.clientId!, clientSecret: ctx.segredos.clientSecret!, refreshToken: cred.refresh_token }));
          conferirLiveMode(ctx.ambiente, t.liveMode);
          await rpc(servico, 'lv_mp_credencial_gravar', {
            p_seller: seller_id, p_provedor: ctx.provedor, p_access: t.accessToken, p_refresh: t.refreshToken, p_mp_user_id: t.mpUserId,
            p_public_key: t.publicKey, p_escopos: t.escopos, p_expira_em: t.expiraEm, p_live_mode: t.liveMode, p_renovacao: true,
          });
          renovadas++;
        } catch (e) {
          await rpc(servico, 'lv_mp_conexao_marcar', { p_seller: seller_id, p_status: 'atencao', p_erro: `renovação falhou: ${(e as Error).message}` });
        }
      }
      await registrar(servico, FN, rid, 'info', 200, { acao, renovadas });
      return json({ renovadas });
    }

    const usuario = await usuarioAtual(req);
    const cliente = clienteDoUsuario(req);
    if (!usuario || !cliente) return json({ erro: 'Entre na sua conta.', codigo: 'NAO_AUTENTICADO' }, 401);

    if (acao === 'estado') {
      const { data: conexao } = await cliente.from('lv_mp_conexoes')
        .select('status, provedor, ambiente, mp_user_id, escopos, conectado_em, renovado_em, expira_em, desconectado_em, ultimo_erro')
        .eq('ambiente', ctx.ambiente).maybeSingle();
      const falta = ctx.provedor === 'mercadopago' ? faltandoParaMercadoPago(ctx.segredos) : [];
      return json({ ambiente: ctx.ambiente, provedor: ctx.provedor, conexao: conexao ?? { status: 'nao_conectado' },
        integracao_bloqueada: ctx.provedor === 'desativado' || falta.length > 0, faltando: falta });
    }

    if (acao === 'desconectar') {
      const r = await rpc(cliente, 'lv_mp_desconectar', { p_seller: null });
      await registrar(servico, FN, rid, 'info', 200, { acao });
      return json(r);
    }

    if (acao === 'iniciar') {
      provedorDoContexto(ctx, servico);   // bloqueia desativado / mock em produção / MP sem configuração
      const { seller_id } = await rpc<{ seller_id: string }>(cliente, 'lv_mp_conexao_iniciar', {});
      const state = gerarAleatorio(24);
      const stateHash = await sha256Hex(state);
      if (ctx.provedor === 'mock') {
        await rpc(servico, 'lv_mp_oauth_estado_gravar', { p_state_hash: stateHash, p_seller: seller_id, p_user: usuario.id, p_verifier: null, p_minutos: 10 });
        const retorno = (corpo.retorno ?? '').startsWith('http') ? corpo.retorno : '';
        const url = `${retorno}?mp_mock=1&code=mockcode_${gerarAleatorio(8)}&state=${encodeURIComponent(state)}`;
        return json({ url, mock: true });
      }
      // O Mercado Pago só aceita o redirect_uri idêntico ao cadastrado na aplicação.
      // Erro de configuração para aqui, antes de mandar o vendedor para o portal.
      if (!redirectUriValida(ctx.segredos.redirectUri)) {
        return json({ erro: `A Redirect URL configurada precisa terminar em ${ROTA_CALLBACK}.`, codigo: 'REDIRECT_URI_INVALIDA' }, 503);
      }
      const verifier = gerarAleatorio(48);
      await rpc(servico, 'lv_mp_oauth_estado_gravar', { p_state_hash: stateHash, p_seller: seller_id, p_user: usuario.id, p_verifier: verifier, p_minutos: 10 });
      const url = urlDeAutorizacao({
        clientId: ctx.segredos.clientId!, redirectUri: ctx.segredos.redirectUri!, state, codeChallenge: await sha256Base64Url(verifier),
      });
      await registrar(servico, FN, rid, 'info', 200, { acao, seller_id });
      return json({ url, mock: false });
    }

    if (acao === 'callback') {
      if (!corpo.code || !corpo.state) return json({ erro: 'Autorização incompleta.', codigo: 'OAUTH_INCOMPLETO' }, 400);
      const estado = await rpc<{ seller_id: string; verifier: string | null }>(servico, 'lv_mp_oauth_estado_consumir', {
        p_state_hash: await sha256Hex(corpo.state), p_user: usuario.id,
      });
      const t = ctx.provedor === 'mock'
        ? (corpo.code.startsWith('mockcode_') ? tokensMock(estado.seller_id) : (() => { throw Object.assign(new Error('Código inválido.'), { hint: 'OAUTH_RECUSADO' }); })())
        : await trocarNoMercadoPago(corpoDaTroca({
          clientId: ctx.segredos.clientId!, clientSecret: ctx.segredos.clientSecret!, code: corpo.code,
          redirectUri: ctx.segredos.redirectUri!, verifier: estado.verifier, teste: ctx.ambiente === 'teste',
        }));
      conferirLiveMode(ctx.ambiente, t.liveMode);
      await rpc(servico, 'lv_mp_credencial_gravar', {
        p_seller: estado.seller_id, p_provedor: ctx.provedor, p_access: t.accessToken, p_refresh: t.refreshToken, p_mp_user_id: t.mpUserId,
        p_public_key: t.publicKey, p_escopos: t.escopos, p_expira_em: t.expiraEm, p_live_mode: t.liveMode, p_renovacao: false,
      });
      await registrar(servico, FN, rid, 'info', 200, { acao, seller_id: estado.seller_id, provedor: ctx.provedor });
      return json({ status: 'conectado' });
    }

    return json({ erro: 'Ação desconhecida.', codigo: 'ACAO_INVALIDA' }, 400);
  } catch (e) {
    await registrar(servico, FN, rid, 'error', 500, {}, (e as Error).message);
    return respostaDeErro(e);
  }
});
