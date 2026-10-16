// Bancada do painel de aprovacao de cadastro PJ.
//
//   node scripts/auditoria-aprovacao-pj.mjs
//
// As perguntas que importam:
//   1. so admin decide -- cliente, representante e anonimo nao;
//   2. o CLIENTE nao muda a propria situacao, por nenhum caminho;
//   3. aprovar NAO concede credito, limite, prazo nem boleto;
//   4. a decisao fica registrada: quem, quando, qual, por que;
//   5. reprovar sem motivo e recusado;
//   6. o cliente le o motivo da PROPRIA recusa, e nao a de outro;
//   7. os cadastros que ja existiam continuam intactos.
//
// STAGING. Cria usuarios temporarios e apaga tudo no fim.
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
anunciar(ambiente);
const env = ambiente.env;
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

let ok = 0; const falhas = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };
const sessao = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const MARCA = 'teste-aprov';
const criados = { users: [], fichas: [] };

async function conta(sufixo, papel) {
  const email = `${MARCA}-${sufixo}-${Date.now()}@teste.local`;
  const senha = crypto.randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(sufixo + ': ' + error.message);
  criados.users.push(data.user.id);
  if (papel) await admin.from('user_roles').insert({ user_id: data.user.id, role_code: papel, is_active: true });
  const c = sessao();
  const { error: e } = await c.auth.signInWithPassword({ email, password: senha });
  if (e) throw new Error('login ' + sufixo + ': ' + e.message);
  return { c, uid: data.user.id };
}

async function ficha(uid, nome) {
  const { data, error } = await admin.from('representative_clients').insert({
    representative_id: null, cnpj: '66006929000136', razao_social: nome,
    user_id: uid, origem: 'autocadastro', status_cadastro: 'em_analise',
    cadastrado_em: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Error('ficha: ' + error.message);
  criados.fichas.push(data.id);
  await admin.from('cliente_marcas').insert({ cliente_id: data.id, marca: 'Café Saporino' });
  return data.id;
}

async function rodar() {
  console.log('\n— preparo —');
  const [antesClientes] = (await admin.from('representative_clients').select('id', { count: 'exact', head: true })
    .then(r => [{ c: r.count }]));
  console.log(`  fichas existentes antes: ${antesClientes.c}`);

  const adm = await conta('admin', 'admin');
  const cliA = await conta('clienteA', 'cliente_pj');
  const cliB = await conta('clienteB', 'cliente_pj');
  const rep  = await conta('rep', 'representante');
  const fA = await ficha(cliA.uid, 'EMPRESA A APROVACAO LTDA');
  const fB = await ficha(cliB.uid, 'EMPRESA B APROVACAO LTDA');

  console.log('\n— 1. quem NAO pode decidir —');
  const { error: e1 } = await cliA.c.rpc('cliente_pj_decidir', { p_cliente: fA, p_decisao: 'aprovado' });
  checa('o CLIENTE nao aprova o proprio cadastro', !!e1, e1 ? '' : 'aceitou!');

  const { error: e2 } = await cliB.c.rpc('cliente_pj_decidir', { p_cliente: fA, p_decisao: 'aprovado' });
  checa('um cliente nao aprova o cadastro de OUTRO', !!e2, e2 ? '' : 'aceitou!');

  const { error: e3 } = await rep.c.rpc('cliente_pj_decidir', { p_cliente: fA, p_decisao: 'aprovado' });
  checa('o REPRESENTANTE nao aprova cadastro', !!e3, e3 ? '' : 'aceitou!');

  const anon = sessao();
  const { error: e4 } = await anon.rpc('cliente_pj_decidir', { p_cliente: fA, p_decisao: 'aprovado' });
  checa('anonimo nao aprova cadastro', !!e4, e4 ? '' : 'aceitou!');

  const { data: dep0 } = await admin.from('representative_clients').select('status_cadastro').eq('id', fA).maybeSingle();
  checa('depois de todas as tentativas, segue em analise', dep0?.status_cadastro === 'em_analise', dep0?.status_cadastro);

  console.log('\n— 2. o cliente nao muda a situacao por fora da RPC —');
  await cliA.c.from('representative_clients').update({ status_cadastro: 'aprovado' }).eq('id', fA);
  const { data: dep1 } = await admin.from('representative_clients').select('status_cadastro').eq('id', fA).maybeSingle();
  checa('update direto na propria ficha nao muda a situacao', dep1?.status_cadastro === 'em_analise', dep1?.status_cadastro);

  const { error: e5 } = await cliA.c.from('cliente_pj_decisoes')
    .insert({ cliente_id: fA, decisao: 'aprovado', motivo: 'eu mesmo' });
  checa('o cliente nao forja uma decisao na tabela', !!e5, e5 ? '' : 'inseriu!');

  console.log('\n— 3. o admin decide —');
  const { error: e6 } = await adm.c.rpc('cliente_pj_decidir', { p_cliente: fA, p_decisao: 'aprovado' });
  checa('admin aprova', !e6, e6?.message);
  const { data: dep2 } = await admin.from('representative_clients')
    .select('status_cadastro, limite_credito, credito_score, forma_pagamento, prazo_pagamento').eq('id', fA).maybeSingle();
  checa('a situacao virou aprovado', dep2?.status_cadastro === 'aprovado', dep2?.status_cadastro);

  console.log('\n— 4. aprovar NAO concede credito —');
  checa('limite de credito continua vazio', !dep2?.limite_credito, String(dep2?.limite_credito));
  checa('score continua vazio', !dep2?.credito_score, String(dep2?.credito_score));
  checa('forma de pagamento continua vazia', !dep2?.forma_pagamento, String(dep2?.forma_pagamento));
  checa('prazo de pagamento continua vazio', !dep2?.prazo_pagamento, String(dep2?.prazo_pagamento));

  console.log('\n— 5. reprovar exige motivo —');
  const { error: e7 } = await adm.c.rpc('cliente_pj_decidir', { p_cliente: fB, p_decisao: 'recusado' });
  checa('reprovar SEM motivo e recusado', !!e7, e7 ? '' : 'aceitou sem motivo!');
  const { error: e8 } = await adm.c.rpc('cliente_pj_decidir', { p_cliente: fB, p_decisao: 'recusado', p_motivo: '   ' });
  checa('motivo so com espacos tambem e recusado', !!e8, e8 ? '' : 'aceitou!');
  const { error: e9 } = await adm.c.rpc('cliente_pj_decidir', {
    p_cliente: fB, p_decisao: 'recusado', p_motivo: 'CNPJ com situacao irregular na Receita.' });
  checa('reprovar COM motivo funciona', !e9, e9?.message);

  const { error: e10 } = await adm.c.rpc('cliente_pj_decidir', { p_cliente: fB, p_decisao: 'talvez' });
  checa('decisao inventada e recusada', !!e10, e10 ? '' : 'aceitou!');

  console.log('\n— 6. o historico ficou —');
  const { data: hist } = await admin.from('cliente_pj_decisoes').select('*').in('cliente_id', [fA, fB]);
  checa('duas decisoes gravadas', (hist ?? []).length === 2, `${(hist ?? []).length}`);
  const dA = (hist ?? []).find(h => h.cliente_id === fA);
  const dB = (hist ?? []).find(h => h.cliente_id === fB);
  checa('a decisao guarda QUEM decidiu', dA?.decidido_por === adm.uid);
  checa('a decisao guarda QUANDO', !!dA?.decidido_em);
  checa('a decisao guarda QUAL foi', dA?.decisao === 'aprovado' && dB?.decisao === 'recusado');
  checa('a reprovacao guarda o MOTIVO', (dB?.motivo ?? '').includes('irregular'));

  console.log('\n— 7. o cliente le o proprio motivo, e so o proprio —');
  const { data: meuB } = await cliB.c.from('cliente_pj_decisoes').select('motivo').eq('cliente_id', fB);
  checa('o cliente B le a recusa dele', (meuB ?? []).length === 1 && (meuB[0].motivo ?? '').includes('irregular'),
    JSON.stringify(meuB));
  const { data: alheia } = await cliB.c.from('cliente_pj_decisoes').select('motivo').eq('cliente_id', fA);
  checa('o cliente B NAO le a decisao de A', (alheia ?? []).length === 0, `viu ${(alheia ?? []).length}`);

  console.log('\n— 8. a visao do admin mostra tudo —');
  const { data: painel } = await adm.c.from('vw_cadastros_pj').select('*').in('id', [fA, fB]);
  const pA = (painel ?? []).find(x => x.id === fA);
  checa('o painel mostra os dois cadastros', (painel ?? []).length === 2, `${(painel ?? []).length}`);
  checa('mostra CNPJ, marcas e data', !!pA?.cnpj && !!pA?.marcas && !!pA?.cadastrado_em);
  checa('mostra a ultima decisao e quem tomou', pA?.ultima_decisao === 'aprovado' && pA?.decidido_por !== undefined);

  console.log('\n— 9. o sininho conta certo —');
  const { data: n1 } = await adm.c.rpc('cadastros_pj_pendentes');
  checa('admin ve a contagem de pendentes', typeof n1 === 'number', String(n1));
  const { data: n2 } = await cliA.c.rpc('cadastros_pj_pendentes');
  checa('o cliente ve zero pendentes', n2 === 0, String(n2));

  console.log('\n— 10. o que ja existia continua intacto —');
  const { count: agora } = await admin.from('representative_clients').select('id', { count: 'exact', head: true });
  checa('nenhuma ficha preexistente sumiu', agora >= antesClientes.c, `${agora} vs ${antesClientes.c}`);
  const { data: antigas } = await admin.from('representative_clients')
    .select('id, status_cadastro').eq('origem', 'representante').limit(5);
  checa('fichas de representante seguem aprovadas por padrao',
    (antigas ?? []).every(f => f.status_cadastro === 'aprovado'),
    JSON.stringify((antigas ?? []).map(f => f.status_cadastro)));
}

async function limpar() {
  for (const f of criados.fichas) {
    await admin.from('cliente_pj_decisoes').delete().eq('cliente_id', f);
    await admin.from('cliente_marcas').delete().eq('cliente_id', f);
    const { error } = await admin.from('representative_clients').delete().eq('id', f);
    if (error) throw new Error('limpeza da ficha: ' + error.message);
  }
  for (const u of criados.users) {
    await admin.from('user_roles').delete().eq('user_id', u);
    const { error } = await admin.auth.admin.deleteUser(u);
    if (error) throw new Error('limpeza do usuario: ' + error.message);
  }
  console.log('\nlimpeza: tudo apagado.');
}

try { await rodar(); } finally { await limpar(); }

console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
else console.log('\nSo o admin decide, o cliente nao mexe na propria situacao,\ne aprovar nao concede credito nenhum.');
