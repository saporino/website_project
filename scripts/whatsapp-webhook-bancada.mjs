// Bancada do webhook de WhatsApp contra a URL REAL — STAGING apenas.
//
//   node scripts/whatsapp-webhook-bancada.mjs
//
// Bate na função publicada, como a Meta bateria, com payloads SINTÉTICOS assinados de
// verdade. Nenhuma mensagem real, nenhum número comercial, nenhuma chamada à Meta.
//
// Exige os dois segredos de teste no ambiente, para poder assinar igual ao servidor:
//   WA_VERIFY_TOKEN= WA_APP_SECRET= node scripts/whatsapp-webhook-bancada.mjs
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const VERIFY = process.env.WA_VERIFY_TOKEN, SECRET = process.env.WA_APP_SECRET;
if (!VERIFY || !SECRET) {
  console.error('Faltam WA_VERIFY_TOKEN e WA_APP_SECRET no ambiente (os mesmos do projeto de staging).');
  process.exit(2);
}
const URL_FN = `${ambiente.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

let ok = 0; const falhas = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };
const assinar = (corpo) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(corpo).digest('hex');
const postar = async (corpo, assinatura) => {
  const r = await fetch(URL_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(assinatura ? { 'x-hub-signature-256': assinatura } : {}) },
    body: corpo,
  });
  return { status: r.status, texto: (await r.text()).trim() };
};
const sql = async (q) => { const { data, error } = await admin.rpc('exec_select', { q }); if (error) throw new Error(error.message); return data; };
const lixo = [];

const PNID = 'PNID-BANCADA-' + Date.now();
const envelope = (valor, pnid = PNID) => JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ id: 'waba-teste', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '550000000000', phone_number_id: pnid },
    ...valor,
  } }] }],
});
const comTexto = (texto, wamid, de = '5511900000099') => envelope({
  contacts: [{ profile: { name: 'Contato sintetico' }, wa_id: de }],
  messages: [{ from: de, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: texto } }],
});

try {
  // ───────────────────────────────────────────────── 1. verificação da URL (GET)
  console.log('\n— GET: a Meta prova que a URL e nossa —');
  const g = async (qs) => { const r = await fetch(`${URL_FN}?${qs}`); return { status: r.status, texto: (await r.text()).trim() }; };
  const certo = await g(`hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY)}&hub.challenge=1158201444`);
  checa('token certo devolve o challenge em texto puro', certo.status === 200 && certo.texto === '1158201444', JSON.stringify(certo));
  const errado = await g(`hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123`);
  checa('token errado devolve 403 e NAO o challenge', errado.status === 403 && !errado.texto.includes('123'), JSON.stringify(errado));
  const semToken = await g(`hub.mode=subscribe&hub.challenge=123`);
  checa('sem token devolve 403', semToken.status === 403, JSON.stringify(semToken));
  const modo = await g(`hub.mode=unsubscribe&hub.verify_token=${encodeURIComponent(VERIFY)}&hub.challenge=123`);
  checa('modo diferente de subscribe devolve 403', modo.status === 403, JSON.stringify(modo));

  // ───────────────────────────────────────── 2. assinatura: recusa ANTES de gravar
  console.log('\n— POST: assinatura e a porta —');
  const antes = (await sql('select count(*)::int n from wa_eventos'))[0].n;
  const corpo1 = comTexto('nao deveria entrar', 'wamid.semassinatura');
  checa('sem assinatura: 401', (await postar(corpo1, null)).status === 401);
  checa('assinatura de outro segredo: 401',
    (await postar(corpo1, 'sha256=' + crypto.createHmac('sha256', 'outro-segredo').update(corpo1).digest('hex'))).status === 401);
  checa('assinatura mal formada: 401', (await postar(corpo1, 'sha256=naoehex')).status === 401);
  checa('corpo alterado depois de assinar: 401',
    (await postar(corpo1.replace('nao deveria entrar', 'adulterado'), assinar(corpo1))).status === 401);
  const depois = (await sql('select count(*)::int n from wa_eventos'))[0].n;
  checa('NADA foi gravado nas quatro recusas', depois === antes, `${antes} -> ${depois}`);

  // ───────────────────────────────── 3. número desconhecido: sem empresa padrão
  console.log('\n— numero desconhecido: guarda o cru, nao cria mensagem —');
  const corpo2 = comTexto('de numero nao cadastrado', 'wamid.desconhecido.' + Date.now());
  const r2 = await postar(corpo2, assinar(corpo2));
  checa('devolve 200 (nao e erro da Meta)', r2.status === 200, JSON.stringify(r2));
  checa('resultado numero_desconhecido', r2.texto === 'numero_desconhecido', r2.texto);
  const ev = await sql(`select company_id, resultado from wa_eventos where phone_number_id='${PNID}' order by recebido_em desc limit 1`);
  checa('evento cru guardado com empresa NULA', ev.length === 1 && ev[0].company_id === null, JSON.stringify(ev));
  const msgs0 = await sql(`select count(*)::int n from wa_mensagens where id_externo like 'wamid.desconhecido%'`);
  checa('nenhuma mensagem criada', msgs0[0].n === 0);

  // ───────────────────────────────────────────── 4. número cadastrado: fluxo feliz
  console.log('\n— numero cadastrado: a mensagem entra na empresa certa —');
  const { data: emp, error: eEmp } = await admin.from('companies').insert({
    name: 'BANCADA-WH-' + Date.now(), cnpj: '00000000000353', order_prefix: 'XW',
    payment_account: 'bancada_wh', is_active: false,
  }).select('id').single();
  if (eEmp) throw new Error('empresa: ' + eEmp.message);
  // A cadeia de FKs trava em DOIS pontos com 'on delete restrict': wa_numeros segura a
  // empresa, e wa_conversas segura o numero. Apagar fora de ordem falha em silencio e
  // deixa lixo no staging - foi o que aconteceu na primeira rodada. De dentro para fora:
  const limparEmpresas = async (ids) => {
    for (const t of ['wa_mensagens', 'wa_conversas', 'wa_contatos', 'wa_numeros', 'marketing_contacts']) {
      const { error } = await admin.from(t).delete().in('company_id', ids);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    const { error } = await admin.from('companies').delete().in('id', ids);
    if (error) throw new Error(`companies: ${error.message}`);
  };
  lixo.push(() => limparEmpresas([emp.id]));
  const { error: eNum } = await admin.from('wa_numeros').insert({
    phone_number_id: PNID, numero_e164: '550000000000', company_id: emp.id,
    conjunto_credencial: 'bancada_wh', rotulo: 'bancada',
  });
  if (eNum) throw new Error('numero: ' + eNum.message);

  const wamid = 'wamid.feliz.' + Date.now();
  const corpo3 = comTexto('Bom dia, quero cotar 10 fardos', wamid);
  const r3 = await postar(corpo3, assinar(corpo3));
  checa('processado', r3.status === 200 && r3.texto === 'processado', JSON.stringify(r3));
  const m = await sql(`select company_id, texto, direcao from wa_mensagens where id_externo='${wamid}'`);
  checa('mensagem gravada na empresa do NUMERO', m.length === 1 && m[0].company_id === emp.id, JSON.stringify(m));
  checa('direcao entrada', m[0]?.direcao === 'entrada');
  const cv = await sql(`select nao_lidas, ultima_entrada_em is not null as tem_janela, status from wa_conversas where company_id='${emp.id}'`);
  checa('conversa criada, janela aberta e 1 nao lida',
    cv.length === 1 && cv[0].nao_lidas === 1 && cv[0].tem_janela && cv[0].status === 'aberta', JSON.stringify(cv));
  const ct = await sql(`select telefone_e164, nome_perfil from wa_contatos where company_id='${emp.id}'`);
  checa('contato criado com o perfil', ct.length === 1 && ct[0].telefone_e164 === '5511900000099', JSON.stringify(ct));

  // ───────────────────────────────────────────────── 5. idempotência de verdade
  console.log('\n— reenvio: a Meta manda o mesmo lote de novo —');
  const r4 = await postar(corpo3, assinar(corpo3));
  checa('mesmo corpo: resultado "repetido"', r4.status === 200 && r4.texto === 'repetido', JSON.stringify(r4));
  const m2 = await sql(`select count(*)::int n from wa_mensagens where id_externo='${wamid}'`);
  checa('continua UMA mensagem', m2[0].n === 1, `${m2[0].n}`);
  const cv2 = await sql(`select nao_lidas from wa_conversas where company_id='${emp.id}'`);
  checa('o contador NAO inflou', cv2[0].nao_lidas === 1, `${cv2[0].nao_lidas}`);

  // mesmo wamid em corpo diferente (timestamp novo): evento novo, mensagem repetida
  const corpo5 = comTexto('Bom dia, quero cotar 10 fardos', wamid).replace(/"timestamp":"\d+"/, `"timestamp":"${Math.floor(Date.now()/1000)+1}"`);
  const r5 = await postar(corpo5, assinar(corpo5));
  checa('wamid repetido em evento novo tambem nao duplica', r5.status === 200, JSON.stringify(r5));
  const m3 = await sql(`select count(*)::int n from wa_mensagens where id_externo='${wamid}'`);
  checa('ainda UMA mensagem', m3[0].n === 1, `${m3[0].n}`);
  const cv3 = await sql(`select nao_lidas from wa_conversas where company_id='${emp.id}'`);
  checa('contador segue em 1 (reprocessar nao estica a janela)', cv3[0].nao_lidas === 1, `${cv3[0].nao_lidas}`);

  // ─────────────────────────────────────────────── 6. status, lote e lixo
  console.log('\n— status, lote misto e lixo —');
  const corpo6 = envelope({ statuses: [{ id: wamid, status: 'delivered', timestamp: String(Math.floor(Date.now()/1000)) }] });
  const r6 = await postar(corpo6, assinar(corpo6));
  checa('status aplicado sem derrubar', r6.status === 200, JSON.stringify(r6));

  const corpo7 = envelope({ field_que_nao_existe: true, messages: [{ type: 'text' }] });
  const r7 = await postar(corpo7, assinar(corpo7));
  checa('lote so com lixo nao derruba (200)', r7.status === 200, JSON.stringify(r7));

  const corpo8 = '{"isso":"nao e um evento"}';
  const r8 = await postar(corpo8, assinar(corpo8));
  checa('JSON valido mas estranho: 200, sem criar nada', r8.status === 200, JSON.stringify(r8));

  const corpo9 = 'isto nao e json';
  const r9 = await postar(corpo9, assinar(corpo9));
  checa('corpo ilegivel assinado: 400 (nao peca reenvio)', r9.status === 400, JSON.stringify(r9));

  // ────────────────────────────────────────── 7. descadastramento e janela
  console.log('\n— SAIR e janela de 24 h —');
  const { error: eMc } = await admin.from('marketing_contacts').insert({
    phone_e164: '5511900000099', company_id: emp.id, consent: true,
    consent_at: new Date().toISOString(), is_mobile: true, source: 'bancada',
  });
  if (eMc) throw new Error('marketing_contacts: ' + eMc.message);
  const corpo10 = comTexto('SAIR', 'wamid.sair.' + Date.now());
  await postar(corpo10, assinar(corpo10));
  const mc = await sql(`select opted_out_at is not null as saiu, consent from marketing_contacts where company_id='${emp.id}'`);
  checa('"SAIR" registrou o descadastramento', mc[0]?.saiu === true && mc[0]?.consent === false, JSON.stringify(mc));

  const corpo11 = comTexto('pode parar a entrega de amanha?', 'wamid.naosair.' + Date.now());
  await admin.from('marketing_contacts').update({ opted_out_at: null, consent: true }).eq('company_id', emp.id);
  await postar(corpo11, assinar(corpo11));
  const mc2 = await sql(`select opted_out_at is null as continua from marketing_contacts where company_id='${emp.id}'`);
  checa('"pode parar a entrega" NAO descadastra', mc2[0]?.continua === true, JSON.stringify(mc2));

  const caixa = await sql(`select janela_aberta, janela_minutos from vw_wa_caixa where company_id='${emp.id}'`);
  checa('a caixa mostra a janela aberta e quanto falta',
    caixa[0]?.janela_aberta === true && caixa[0]?.janela_minutos > 1400, JSON.stringify(caixa));

  // ───────────────────────────────────────────── 8. nada de conteúdo na resposta
  console.log('\n— a resposta publica nao devolve conteudo —');
  const corpo12 = comTexto('MEU CARTAO E 4111 1111 1111 1111', 'wamid.sigilo.' + Date.now());
  const r12 = await postar(corpo12, assinar(corpo12));
  checa('resposta e so o veredito, sem conteudo',
    !/4111|CARTAO/i.test(r12.texto) && r12.texto.length < 40, r12.texto);
  checa('resposta de recusa tambem nao devolve conteudo',
    !/4111|CARTAO/i.test((await postar(corpo12, 'sha256=' + 'a'.repeat(64))).texto));

} catch (e) {
  console.error('\nERRO:', e.message);
  falhas.push('excecao: ' + e.message);
} finally {
  try { await admin.from('wa_eventos').delete().eq('phone_number_id', PNID); } catch { /* segue */ }
  // Engolir a falha de limpeza foi o que deixou 9 empresas de bancada no staging sem
  // ninguem ver. Uma bancada que nao consegue limpar o proprio rastro esta mentindo:
  // agora ela REPROVA e diz qual passo falhou.
  for (const f of lixo.reverse()) {
    try { await f(); }
    catch (e) { falhas.push('limpeza: ' + (e instanceof Error ? e.message : String(e))); }
  }
  console.log('\ndados sinteticos removidos.');
}

console.log(`\n${ok} verificacoes ok, ${falhas.length} falhas.`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
