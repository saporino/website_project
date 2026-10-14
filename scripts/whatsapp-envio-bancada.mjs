// Bancada do ENVIO de WhatsApp — STAGING apenas, contra a função publicada.
//
//   node scripts/whatsapp-envio-bancada.mjs
//
// Nenhuma mensagem real sai: enquanto `WHATSAPP_COFICO_TOKEN` não existir, a função opera
// em modo SIMULADO e devolve `simulado: true`. É de propósito — o briefing pede testar com
// resposta simulada ANTES do primeiro disparo real.
//
// O que prova: quem pode enviar, quem não pode, e o que o banco recusa mesmo quando a tela
// pediria. Cria e apaga os próprios dados.
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const URL = ambiente.env.VITE_SUPABASE_URL, ANON = ambiente.env.VITE_SUPABASE_ANON_KEY;
const FN = `${URL}/functions/v1/whatsapp-enviar`;
let ok = 0; const falhas = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };
const sql = async (q) => { const { data, error } = await admin.rpc('exec_select', { q }); if (error) throw new Error(error.message); return data; };
const lixo = [];
const uuid = () => crypto.randomUUID();

async function usuario(email, papel, companyId, ehAdmin = false) {
  const senha = 'bc-' + crypto.randomUUID() + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`criar ${email}: ${error.message}`);
  lixo.push(() => admin.auth.admin.deleteUser(data.user.id));
  if (ehAdmin) await admin.from('user_profiles').upsert({ id: data.user.id, full_name: email, is_admin: true });
  if (papel) {
    const { error: e2 } = await admin.from('user_roles')
      .insert({ user_id: data.user.id, role_code: papel, company_id: companyId, is_active: true });
    if (e2) throw new Error(`papel ${papel}: ${e2.message}`);
  }
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: sessao, error: e3 } = await cli.auth.signInWithPassword({ email, password: senha });
  if (e3) throw new Error(`login ${email}: ${e3.message}`);
  return { id: data.user.id, jwt: sessao.session.access_token };
}

/** Chama a função como a tela chamaria: com o JWT da pessoa no cabeçalho. */
const enviar = async (jwt, corpo) => {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

try {
  await admin.from('roles').upsert([
    { code: 'representante', label: 'Representante Comercial' },
    { code: 'promotor', label: 'Promotor' },
  ], { onConflict: 'code' });

  // ── cenário: duas empresas, cada uma com número, contato e conversa aberta ──
  const marca = 'BANCADA-ENV-' + Date.now();
  const { data: empresas, error: eEmp } = await admin.from('companies').insert([
    { name: `${marca}-A`, cnpj: '00000000000434', order_prefix: 'YA', payment_account: 'bc_a', is_active: false },
    { name: `${marca}-B`, cnpj: '00000000000515', order_prefix: 'YB', payment_account: 'bc_b', is_active: false },
  ]).select('id, name');
  if (eEmp) throw new Error('empresas: ' + eEmp.message);
  const [A, B] = empresas;
  const limpar = async () => {
    const ids = [A.id, B.id];
    for (const t of ['wa_mensagens', 'wa_conversas', 'wa_contatos', 'wa_numeros', 'wa_eventos', 'marketing_contacts']) {
      const { error } = await admin.from(t).delete().in('company_id', ids);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    const { error } = await admin.from('companies').delete().in('id', ids);
    if (error) throw new Error('companies: ' + error.message);
  };
  lixo.push(limpar);

  const montar = async (empresa, sufixo, { envio = true, entradaHaHoras = 1 } = {}) => {
    const { data: n, error: e1 } = await admin.from('wa_numeros').insert({
      phone_number_id: `PNID-ENV-${sufixo}-${Date.now()}`, numero_e164: `55110000${sufixo}000`,
      company_id: empresa.id, conjunto_credencial: 'bc', ambiente: 'teste', envio_habilitado: envio,
    }).select('id').single();
    if (e1) throw new Error('numero: ' + e1.message);
    const { data: ct, error: e2 } = await admin.from('wa_contatos').insert({
      company_id: empresa.id, telefone_e164: `5511900${sufixo}0001`, nome_perfil: 'Contato ' + sufixo,
    }).select('id').single();
    if (e2) throw new Error('contato: ' + e2.message);
    const entrada = new Date(Date.now() - entradaHaHoras * 3600_000).toISOString();
    const { data: cv, error: e3 } = await admin.from('wa_conversas').insert({
      company_id: empresa.id, numero_id: n.id, contato_id: ct.id, ultima_entrada_em: entrada,
    }).select('id').single();
    if (e3) throw new Error('conversa: ' + e3.message);
    return cv.id;
  };

  const convA = await montar(A, '1');
  const convB = await montar(B, '2');
  const convFechada = await montar(A, '3', { entradaHaHoras: 30 });   // janela vencida
  const convSemEnvio = await montar(A, '4', { envio: false });        // número não habilitado

  const selo = Date.now();
  const adminA = await usuario(`bc-env-admin-${selo}@exemplo.test`, null, null, true);
  const atendA = await usuario(`bc-env-atend-a-${selo}@exemplo.test`, 'atendimento', A.id);
  const atendB = await usuario(`bc-env-atend-b-${selo}@exemplo.test`, 'atendimento', B.id);
  const rep = await usuario(`bc-env-rep-${selo}@exemplo.test`, 'representante', A.id);
  const promo = await usuario(`bc-env-promo-${selo}@exemplo.test`, 'promotor', A.id);
  const nada = await usuario(`bc-env-nada-${selo}@exemplo.test`, null, null);

  // ───────────────────────────────────────────────────────── quem PODE
  console.log('\n— quem pode enviar —');
  const r1 = await enviar(adminA.jwt, { conversa: convA, texto: 'resposta do admin', chave: uuid() });
  checa('ADMIN envia', r1.status === 200 && r1.corpo?.ok === true, JSON.stringify(r1.corpo));
  checa('e o envio foi SIMULADO (sem token configurado)', r1.corpo?.simulado === true, JSON.stringify(r1.corpo));

  const r2 = await enviar(atendA.jwt, { conversa: convA, texto: 'resposta do atendente', chave: uuid() });
  checa('ATENDIMENTO da empresa envia', r2.status === 200 && r2.corpo?.ok === true, JSON.stringify(r2.corpo));

  // ───────────────────────────────────────────────────────── quem NÃO pode
  console.log('\n— quem nao pode —');
  const casos = [
    ['REPRESENTANTE da mesma empresa', rep.jwt, convA, 'sem_permissao'],
    ['PROMOTOR da mesma empresa', promo.jwt, convA, 'sem_permissao'],
    ['usuario SEM papel', nada.jwt, convA, 'sem_permissao'],
    ['ATENDIMENTO da empresa B na conversa da A', atendB.jwt, convA, 'sem_permissao'],
    ['ATENDIMENTO da empresa A na conversa da B', atendA.jwt, convB, 'sem_permissao'],
  ];
  for (const [nome, jwt, conversa, motivo] of casos) {
    const r = await enviar(jwt, { conversa, texto: 'nao deveria sair', chave: uuid() });
    checa(`${nome} e recusado`, r.status === 403 && r.corpo?.motivo === motivo,
      `${r.status} ${JSON.stringify(r.corpo)}`);
  }
  const semJwt = await enviar(null, { conversa: convA, texto: 'x', chave: uuid() });
  checa('sem JWT nenhum: recusado', semJwt.status === 401, `${semJwt.status}`);

  // ───────────────────────────────────────────────────── regras do envio
  console.log('\n— as regras —');
  const rJanela = await enviar(adminA.jwt, { conversa: convFechada, texto: 'fora da janela', chave: uuid() });
  checa('JANELA FECHADA: recusado, mesmo para admin',
    rJanela.status === 403 && rJanela.corpo?.motivo === 'janela_fechada', JSON.stringify(rJanela.corpo));

  const rNum = await enviar(adminA.jwt, { conversa: convSemEnvio, texto: 'numero sem envio', chave: uuid() });
  checa('NUMERO nao habilitado: recusado',
    rNum.status === 403 && rNum.corpo?.motivo === 'numero_nao_envia', JSON.stringify(rNum.corpo));

  const rVazio = await enviar(adminA.jwt, { conversa: convA, texto: '   ', chave: uuid() });
  checa('texto vazio: recusado', rVazio.corpo?.motivo === 'texto_vazio');
  const rLongo = await enviar(adminA.jwt, { conversa: convA, texto: 'a'.repeat(5000), chave: uuid() });
  checa('texto acima do limite: recusado', rLongo.corpo?.motivo === 'texto_longo');
  const rSemChave = await enviar(adminA.jwt, { conversa: convA, texto: 'oi' });
  checa('sem chave de idempotencia: recusado', rSemChave.corpo?.motivo === 'chave_invalida');
  const rInexistente = await enviar(adminA.jwt, { conversa: uuid(), texto: 'oi', chave: uuid() });
  checa('conversa inexistente: recusado', rInexistente.corpo?.motivo === 'conversa_inexistente',
    JSON.stringify(rInexistente.corpo));

  // ───────────────────────────────────────────── clique duplo
  console.log('\n— clique duplo nao vira duas mensagens —');
  const chaveRepetida = uuid();
  const d1 = await enviar(adminA.jwt, { conversa: convA, texto: 'so uma vez', chave: chaveRepetida });
  const d2 = await enviar(adminA.jwt, { conversa: convA, texto: 'so uma vez', chave: chaveRepetida });
  checa('a primeira passa', d1.corpo?.ok === true);
  checa('a segunda volta como duplicada', d2.corpo?.ok === true && d2.corpo?.duplicado === true, JSON.stringify(d2.corpo));
  const [{ n: quantas }] = await sql(
    `select count(*)::int n from wa_mensagens where conversa_id='${convA}' and texto='so uma vez'`);
  checa('existe UMA mensagem no banco', quantas === 1, `${quantas}`);

  // duas chamadas ao MESMO tempo, que e o caso real do clique nervoso
  const chaveCorrida = uuid();
  const [c1, c2] = await Promise.all([
    enviar(adminA.jwt, { conversa: convA, texto: 'corrida', chave: chaveCorrida }),
    enviar(adminA.jwt, { conversa: convA, texto: 'corrida', chave: chaveCorrida }),
  ]);
  const [{ n: corrida }] = await sql(
    `select count(*)::int n from wa_mensagens where conversa_id='${convA}' and texto='corrida'`);
  checa('duas chamadas simultaneas geram UMA mensagem', corrida === 1,
    `${corrida} · ${JSON.stringify([c1.corpo, c2.corpo])}`);

  // ───────────────────────────────────────────── o que ficou gravado
  console.log('\n— persistencia —');
  const gravadas = await sql(`
    select m.texto, m.direcao, m.estado, m.id_externo, m.enviada_por is not null tem_autor,
           c.name empresa
      from wa_mensagens m join companies c on c.id=m.company_id
     where m.conversa_id='${convA}' and m.direcao='saida' order by m.criada_em`);
  checa('as saidas ficaram gravadas', gravadas.length >= 4, `${gravadas.length}`);
  checa('todas com direcao saida e estado enviada',
    gravadas.every(g => g.direcao === 'saida' && g.estado === 'enviada'));
  checa('todas com autor registrado', gravadas.every(g => g.tem_autor));
  checa('todas na empresa certa', gravadas.every(g => g.empresa === `${marca}-A`));
  checa('id de simulado se denuncia', gravadas.every(g => g.id_externo.startsWith('wamid.SIMULADO.')),
    gravadas.map(g => g.id_externo.slice(0, 22)).join(', '));
  const [{ n: naB }] = await sql(`select count(*)::int n from wa_mensagens where company_id='${B.id}'`);
  checa('nada vazou para a empresa B', naB === 0, `${naB}`);

  // ───────────────────────────────────────────── o numero comercial
  console.log('\n— o numero comercial nao envia —');
  const { error: eCom } = await admin.from('wa_numeros').insert({
    phone_number_id: 'PNID-COMERCIAL-' + Date.now(), numero_e164: '5511938100909',
    company_id: A.id, conjunto_credencial: 'bc', ambiente: 'producao', envio_habilitado: true,
  });
  checa('o banco recusa habilitar envio no +55 11 93810-0909', !!eCom,
    eCom?.message?.slice(0, 70) ?? 'ACEITOU!');
  // A MESMA linha telefonica, escrita de outros jeitos. A trava e por identidade do
  // numero, nao por formato - foi assim que ela furou na primeira versao.
  const disfarces = ['(11) 93810-0909', '11938100909', '+55 11 93810-0909', '55 11 93810 0909'];
  for (const [i, numero] of disfarces.entries()) {
    const { error } = await admin.from('wa_numeros').insert({
      phone_number_id: `PNID-COM${i}-${Date.now()}`, numero_e164: numero,
      company_id: A.id, conjunto_credencial: 'bc', ambiente: 'producao', envio_habilitado: true,
    });
    checa(`recusa escrito como "${numero}"`, !!error, error?.message?.slice(0, 60) ?? 'ACEITOU!');
  }
  // E um numero PARECIDO tem de continuar passando: a trava nao pode virar bloqueio geral.
  const { error: eOutro } = await admin.from('wa_numeros').insert({
    phone_number_id: 'PNID-OUTRO-' + Date.now(), numero_e164: '5511938100910',
    company_id: A.id, conjunto_credencial: 'bc', ambiente: 'teste', envio_habilitado: true,
  });
  checa('um numero DIFERENTE continua podendo enviar', !eOutro, eOutro?.message?.slice(0, 60) ?? '');

} catch (e) {
  console.error('\nERRO:', e.message);
  falhas.push('excecao: ' + e.message);
} finally {
  for (const f of lixo.reverse()) {
    try { await f(); }
    catch (e) { falhas.push('limpeza: ' + (e instanceof Error ? e.message : String(e))); }
  }
  console.log('\ndados de teste removidos.');
}

console.log(`\n${ok} verificacoes ok, ${falhas.length} falhas.`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
