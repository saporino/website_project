// Webhook da WhatsApp Cloud API — recebimento de mensagens da COFICO.
//
// URL pública: a Meta chama sem JWT, então a função é publicada com --no-verify-jwt e a
// porta é a ASSINATURA, não um token de plataforma. Mesmo desenho do webhook do Mercado
// Pago, que já roda em produção.
//
// Esta função só faz I/O. Toda a decisão está em `_shared/whatsappProcesso.ts`, com 19
// testes, e a leitura do evento em `_shared/whatsapp.ts`, com 27. Aqui ficam apenas:
// crypto, Postgres e HTTP.
//
// O service role é usado porque não há usuário logado do outro lado — a Meta não tem
// sessão. O alcance disso é estreito de propósito: esta função só escreve nas cinco
// tabelas wa_*, e todo acesso de GENTE continua passando pela RLS (admin ou papel
// `atendimento` da empresa). Nenhuma leitura daqui vai para fora.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { respostaDoDesafio, assinaturaConfere, type StatusDeMensagem } from '../_shared/whatsapp.ts';
import { processarEvento, paraLog, type Repositorio, type Numero } from '../_shared/whatsappProcesso.ts';
import { logEdge, newRequestId } from '../_shared/log.ts';

const FN = 'whatsapp-webhook';

// Segredos, por empresa, no mesmo padrão do Mercado Pago: dono explícito no nome, valor
// NUNCA no banco. Não existe nome genérico — foi assim que se descobriu, em setembro, que
// o "token genérico" era da Saporino.
const seg = (n: string) => Deno.env.get(n) ?? undefined;
const VERIFY_TOKEN = seg('WHATSAPP_COFICO_VERIFY_TOKEN');
const APP_SECRET = seg('WHATSAPP_COFICO_APP_SECRET');

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo, null, 1), { status, headers: { 'Content-Type': 'application/json' } });
const texto = (corpo: string, status = 200) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

/** HMAC-SHA256 do corpo CRU. Reserializar o JSON muda um espaço e a assinatura não bate. */
async function hmacHex(corpoCru: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinado = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpoCru));
  return [...new Uint8Array(assinado)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Liga o processamento às cinco tabelas. Cada método faz uma coisa e devolve o mínimo. */
function repositorio(db: SupabaseClient): Repositorio {
  const erro = (onde: string, e: { message: string } | null) => {
    // A mensagem do Postgres pode citar valores. Fica o código/onde, nunca o conteúdo.
    if (e) throw new Error(`${onde}: ${String(e.message).slice(0, 60)}`);
  };
  return {
    async guardarEvento(e) {
      const { error } = await db.from('wa_eventos').insert({
        assinatura: e.assinatura, corpo: e.corpo, phone_number_id: e.phoneNumberId,
        company_id: e.companyId, mensagens: e.mensagens, statuses: e.statuses,
        ignorados: e.ignorados, resultado: 'recebido',
      });
      // 23505 = chave única: a Meta já tinha mandado este corpo. Não é falha.
      if (error?.code === '23505') return 'repetido';
      erro('guardar evento', error);
      return 'novo';
    },
    async numeroDe(phoneNumberId): Promise<Numero | null> {
      const { data, error } = await db.from('wa_numeros')
        .select('id, company_id').eq('phone_number_id', phoneNumberId).eq('ativo', true).maybeSingle();
      erro('consultar numero', error);
      return data ? { companyId: data.company_id, numeroId: data.id } : null;
    },
    async acharOuCriarContato(companyId, telefone, nomePerfil) {
      const agora = new Date().toISOString();
      const { data, error } = await db.from('wa_contatos').upsert({
        company_id: companyId, telefone_e164: telefone, nome_perfil: nomePerfil,
        ultima_mensagem_em: agora, atualizado_em: agora,
      }, { onConflict: 'company_id,telefone_e164' }).select('id').single();
      erro('contato', error);
      return data!.id;
    },
    async acharOuCriarConversa(companyId, numeroId, contatoId) {
      const { data, error } = await db.from('wa_conversas').upsert({
        company_id: companyId, numero_id: numeroId, contato_id: contatoId,
      }, { onConflict: 'contato_id,numero_id', ignoreDuplicates: false }).select('id').single();
      erro('conversa', error);
      return data!.id;
    },
    async gravarMensagem(m) {
      const { error } = await db.from('wa_mensagens').insert({
        company_id: m.companyId, conversa_id: m.conversaId, id_externo: m.idExterno,
        direcao: 'entrada', tipo: m.tipo, texto: m.texto,
        // Guardamos só o ID da mídia na Meta. O arquivo é baixado depois, para o bucket
        // PRIVADO, por um passo próprio. Nada de link público aqui.
        midia_id: m.midiaId, midia_mime: m.midiaMime,
        ocorrida_em: m.ocorridaEm,
      });
      if (error?.code === '23505') return 'repetida';   // wamid já existia
      erro('mensagem', error);
      return 'nova';
    },
    async marcarEntrada(conversaId, quando) {
      const { error } = await db.rpc('wa_marcar_entrada', { p_conversa: conversaId, p_quando: quando });
      erro('janela', error);
    },
    async atualizarEstado(s: StatusDeMensagem) {
      // Silencioso quando não conhecemos o wamid: é status de mensagem que não é nossa.
      const { error } = await db.from('wa_mensagens').update({
        estado: s.estado, erro_codigo: s.erro ? s.erro.split(' ')[0] : null, erro_texto: s.erro,
      }).eq('id_externo', s.idExterno);
      erro('estado', error);
    },
    async registrarSaida(companyId, telefone) {
      const { error } = await db.from('marketing_contacts')
        .update({ opted_out_at: new Date().toISOString(), consent: false })
        .eq('company_id', companyId).eq('phone_e164', telefone);
      erro('opt-out', error);
    },
    async fecharEvento(assinatura, resultado, detalhe) {
      const { error } = await db.from('wa_eventos')
        .update({ resultado, detalhe }).eq('assinatura', assinatura);
      erro('fechar evento', error);
    },
  };
}

Deno.serve(async (req) => {
  const requestId = newRequestId();
  const url = new URL(req.url);

  // ── GET ?diagnostico=1 — o formato do App Secret, sem revelar o valor ────────
  //
  // O erro mais comum ao trocar esse segredo é colar com espaço, aspas ou quebra de linha
  // junto. Isso só apareceria no PRIMEIRO evento real: a Meta assina certo, a gente calcula
  // errado, devolve 401, e depois de muitas falhas ela desativa a inscrição. Custar uma ida
  // e volta com a Meta para descobrir um espaço em branco é caro demais.
  //
  // Exige o verify token (quem não o tem não chega aqui) e devolve SÓ booleanos. O formato
  // de um App Secret da Meta — 32 caracteres hexadecimais — é público; o valor, não.
  if (req.method === 'GET' && url.searchParams.get('diagnostico') === '1') {
    const t = url.searchParams.get('hub.verify_token');
    if (!VERIFY_TOKEN || t !== VERIFY_TOKEN) return texto('forbidden', 403);
    const s = APP_SECRET ?? '';
    return new Response(JSON.stringify({
      verify_token_configurado: !!VERIFY_TOKEN,
      app_secret_configurado: s.length > 0,
      app_secret_tamanho_32: s.length === 32,
      app_secret_so_hex: /^[a-f0-9]+$/i.test(s),
      app_secret_sem_espaco_nas_pontas: s === s.trim(),
      app_secret_sem_aspas: !/^["']|["']$/.test(s),
    }, null, 1), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ── GET ?diagnostico=meta — a WABA está inscrita neste app? (SÓ LEITURA) ─────
  //
  // Quando a amostra do painel chega mas a mensagem real não, a causa quase sempre é esta:
  // configurar o webhook no APP e inscrever a WABA no app são dois passos diferentes. O
  // primeiro faz o botão "Testar" funcionar; só o segundo faz mensagem de verdade chegar.
  //
  // Usa o app access token (`id|segredo`), montado aqui dentro e nunca devolvido. Apenas GET
  // na Graph API: não cria inscrição, não publica nada, não envia mensagem.
  if (req.method === 'GET' && url.searchParams.get('diagnostico') === 'meta') {
    const t = url.searchParams.get('hub.verify_token');
    if (!VERIFY_TOKEN || t !== VERIFY_TOKEN) return texto('forbidden', 403);
    const appId = url.searchParams.get('app_id') ?? '';
    const waba = url.searchParams.get('waba') ?? '';
    if (!APP_SECRET || !appId || !waba) return texto('faltam app_id e waba', 400);
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${waba}/subscribed_apps?access_token=${appId}|${APP_SECRET}`);
    const corpo = await r.text();
    // A resposta da Graph pode ecoar o token numa mensagem de erro. Nunca deixamos sair.
    const limpo = corpo.replaceAll(APP_SECRET, '«segredo»');
    return new Response(limpo, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }

  // ── GET ?diagnostico=token — o token de ENVIO vale? (SÓ LEITURA, nada é enviado) ──
  //
  // Descobrir que o token está errado no primeiro disparo real, com a câmera ligada, é o
  // pior momento possível. Aqui ele é exercido contra a Graph API em modo leitura: se
  // responde, vale; se não, o erro vem com o código, antes de qualquer mensagem.
  //
  // Nenhum segredo sai na resposta — o que a Graph devolver é limpo antes de voltar.
  if (req.method === 'GET' && url.searchParams.get('diagnostico') === 'token') {
    const t = url.searchParams.get('hub.verify_token');
    if (!VERIFY_TOKEN || t !== VERIFY_TOKEN) return texto('forbidden', 403);
    const ENVIO = seg('WHATSAPP_COFICO_TOKEN');
    if (!ENVIO) return json({ token_configurado: false });
    const pnid = url.searchParams.get('phone_number_id') ?? '';
    const waba = url.searchParams.get('waba') ?? '';
    const limpar = (s: string) => s.replaceAll(ENVIO, '«token»').replaceAll(APP_SECRET ?? '\u0000', '«segredo»');
    const ler = async (caminho: string) => {
      const r = await fetch(`https://graph.facebook.com/v21.0/${caminho}`,
        { headers: { Authorization: `Bearer ${ENVIO}` } });
      let corpo: unknown = null;
      try { corpo = JSON.parse(limpar(await r.text())); } catch { corpo = null; }
      return { status: r.status, corpo };
    };
    // 1) o número: valida o token e `whatsapp_business_messaging` sobre ele
    const numero = pnid ? await ler(`${pnid}?fields=display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app,code_verification_status`) : null;
    // 2) os modelos: valida `whatsapp_business_management` sobre a WABA
    const modelos = waba ? await ler(`${waba}/message_templates?limit=1&fields=name,status,category`) : null;
    return json({
      token_configurado: true,
      numero: numero ? { http: numero.status, resposta: numero.corpo } : 'phone_number_id nao informado',
      modelos: modelos ? { http: modelos.status, resposta: modelos.corpo } : 'waba nao informada',
    });
  }

  // ── GET: a Meta prova, uma vez, que a URL é nossa ────────────────────────────
  if (req.method === 'GET') {
    const challenge = respostaDoDesafio({
      modo: url.searchParams.get('hub.mode'),
      token: url.searchParams.get('hub.verify_token'),
      challenge: url.searchParams.get('hub.challenge'),
    }, VERIFY_TOKEN);
    logEdge(FN, { requestId, etapa: 'verificacao', aceito: challenge !== null });
    return challenge !== null ? texto(challenge) : texto('forbidden', 403);
  }

  if (req.method !== 'POST') return texto('method not allowed', 405);

  // ── POST: assinatura ANTES de ler, interpretar ou gravar qualquer coisa ──────
  if (!APP_SECRET) {
    // Sem segredo configurado ninguém entra. 500 (e não 403) porque é falha NOSSA de
    // configuração, e a Meta reenvia depois que alguém arrumar.
    logEdge(FN, { requestId, etapa: 'config', erro: 'WHATSAPP_COFICO_APP_SECRET ausente' });
    return texto('not configured', 500);
  }
  const corpoCru = await req.text();
  const calculado = await hmacHex(corpoCru, APP_SECRET);
  if (!assinaturaConfere(req.headers.get('x-hub-signature-256'), calculado)) {
    logEdge(FN, { requestId, etapa: 'assinatura', aceito: false, bytes: corpoCru.length });
    // Recusa agora deixa RASTRO. Sem isto não dá para separar "nenhum POST chegou" de
    // "um POST chegou e foi recusado" — e essa diferença decide se o problema é da Meta
    // (inscrição, lista de destinatários) ou nosso (segredo errado).
    //
    // O CORPO NÃO É GUARDADO: é entrada não verificada, de origem desconhecida. Fica só
    // o tamanho, se havia cabeçalho de assinatura e o formato dele.
    try {
      const cab = req.headers.get('x-hub-signature-256');
      await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } })
        .from('wa_eventos').insert({
          assinatura: `rejeitado:${crypto.randomUUID()}`,
          corpo: {}, resultado: 'assinatura_invalida',
          detalhe: `bytes=${corpoCru.length} cabecalho=${cab ? (/^sha256=[a-f0-9]{64}$/i.test(cab) ? 'formato ok' : 'formato invalido') : 'ausente'}`,
        });
    } catch { /* registrar a recusa nunca pode virar erro 500 */ }
    return texto('invalid signature', 401);          // nada do conteúdo foi aproveitado
  }

  let corpo: unknown;
  try { corpo = JSON.parse(corpoCru); }
  catch {
    logEdge(FN, { requestId, etapa: 'json', erro: 'corpo nao e JSON' });
    return texto('bad request', 400);                // assinado, mas ilegível: não reenvie
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } });

  // A impressão digital do corpo cru é o próprio HMAC: entrega repetida e idêntica não
  // vira linha nova, e não precisamos calcular mais nada.
  const v = await processarEvento(corpo, calculado, repositorio(db));
  logEdge(FN, { requestId, etapa: 'processado', ...paraLog(v, null) });
  return texto(v.resultado, v.http);
});
