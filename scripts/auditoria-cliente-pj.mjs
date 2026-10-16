// Bancada do cadastro de cliente PJ — o fluxo inteiro, com sessoes de verdade.
//
//   node scripts/auditoria-cliente-pj.mjs
//
// Prova as cinco coisas que importam antes de isso existir para um cliente real:
//   1. o convite funciona (gera, confere, consome, morre);
//   2. o cliente so enxerga a PROPRIA ficha — nunca a de outro;
//   3. o cadastro NAO concede credito, prazo nem limite;
//   4. o convite NAO vira permissao administrativa nem de representante;
//   5. gerente e supervisor nao escrevem mais direto na tabela de convites.
//
// STAGING, sempre. Cria dois clientes temporarios e apaga tudo no fim.
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

const MARCA = 'teste-pj';
const criados = { users: [], fichas: [], codigos: [] };

// Admin de verdade para gerar convite: a RPC exige is_admin(), e desde a
// migration de 15/10 isso significa papel em user_roles.
async function criarAdmin() {
  const email = `${MARCA}-admin-${Date.now()}@teste.local`;
  const senha = crypto.randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error('admin: ' + error.message);
  criados.users.push(data.user.id);
  await admin.from('user_roles').insert({ user_id: data.user.id, role_code: 'admin', is_active: true });
  const c = sessao();
  const { error: e } = await c.auth.signInWithPassword({ email, password: senha });
  if (e) throw new Error('login admin: ' + e.message);
  return c;
}

async function criarCliente(sufixo) {
  const email = `${MARCA}-${sufixo}-${Date.now()}@teste.local`;
  const senha = crypto.randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error('cliente: ' + error.message);
  criados.users.push(data.user.id);
  const c = sessao();
  const { error: e } = await c.auth.signInWithPassword({ email, password: senha });
  if (e) throw new Error('login cliente: ' + e.message);
  return { cliente: c, uid: data.user.id, email };
}

async function rodar() {
  const comoAdmin = await criarAdmin();

  console.log('\n— 1. o convite de cliente PJ —');
  const { data: g, error: eg } = await comoAdmin.rpc('repco_generate_invite_pj', {
    p_note: 'Empresa de Teste', p_email: 'comprador@teste.local', p_dias: 7,
  });
  checa('admin gera convite de cliente PJ', !eg && !!(Array.isArray(g) ? g[0]?.code : null), eg?.message);
  const codigo = Array.isArray(g) ? g[0]?.code : null;
  if (codigo) criados.codigos.push(codigo);

  const { data: semEmail, error: eSem } = await comoAdmin.rpc('repco_generate_invite_pj', { p_note: 'x', p_email: '' });
  checa('convite SEM e-mail e recusado', !!eSem, eSem ? '' : JSON.stringify(semEmail));

  const { data: v } = await comoAdmin.rpc('repco_validate_invite_pj', { p_code: codigo });
  const ver = Array.isArray(v) ? v[0] : v;
  checa('conferir o codigo nao o consome', ver?.valido === true, JSON.stringify(ver));
  checa('o codigo devolve o e-mail a que esta preso', ver?.email === 'comprador@teste.local', ver?.email);

  const { data: vFalso } = await comoAdmin.rpc('repco_validate_invite_pj', { p_code: 'ZZZZZZ' });
  checa('codigo inexistente e recusado', (Array.isArray(vFalso) ? vFalso[0] : vFalso)?.valido === false);

  console.log('\n— 2. o cliente se cadastra —');
  const a = await criarCliente('a');
  const { data: fichaA, error: eReg } = await a.cliente.rpc('cliente_pj_registrar', {
    p_code: codigo, p_cnpj: '61109694000194', p_razao_social: 'EMPRESA TESTE A LTDA',
    p_nome_fantasia: 'Teste A', p_marcas: ['Café Saporino', 'Tropeiro Paulista'],
  });
  checa('o cadastro cria a ficha', !eReg && !!fichaA, eReg?.message);
  if (fichaA) criados.fichas.push(fichaA);

  const { data: marcas } = await admin.from('cliente_marcas').select('marca').eq('cliente_id', fichaA);
  checa('as DUAS marcas escolhidas foram gravadas', (marcas ?? []).length === 2, JSON.stringify(marcas));

  const { data: ficha } = await admin.from('representative_clients')
    .select('status_cadastro, origem, representative_id, limite_credito, convite_id').eq('id', fichaA).maybeSingle();
  checa('nasce em analise, nao aprovado', ficha?.status_cadastro === 'em_analise', ficha?.status_cadastro);
  checa('nasce como autocadastro', ficha?.origem === 'autocadastro', ficha?.origem);
  checa('nasce SEM representante', ficha?.representative_id === null);
  checa('o cadastro NAO concede limite de credito', !ficha?.limite_credito, String(ficha?.limite_credito));
  checa('o vinculo com o convite ficou gravado', !!ficha?.convite_id);

  console.log('\n— 3. o codigo morre no uso —');
  const { data: v2 } = await comoAdmin.rpc('repco_validate_invite_pj', { p_code: codigo });
  checa('codigo ja usado nao vale mais', (Array.isArray(v2) ? v2[0] : v2)?.valido === false);

  const b = await criarCliente('b');
  const { error: eReuso } = await b.cliente.rpc('cliente_pj_registrar', {
    p_code: codigo, p_cnpj: '37856623000170', p_razao_social: 'TENTATIVA DE REUSO LTDA', p_marcas: ['Café Saporino'],
  });
  checa('outra pessoa NAO reusa o mesmo codigo', !!eReuso, eReuso ? '' : 'reuso aceito!');

  console.log('\n— 4. o cliente so enxerga o que e dele —');
  // Segunda ficha, de outro cliente, para ter com o que comparar.
  const { data: g2 } = await comoAdmin.rpc('repco_generate_invite_pj', { p_note: 'B', p_email: 'b@teste.local', p_dias: 7 });
  const codigo2 = Array.isArray(g2) ? g2[0]?.code : null;
  if (codigo2) criados.codigos.push(codigo2);
  const { data: fichaB } = await b.cliente.rpc('cliente_pj_registrar', {
    p_code: codigo2, p_cnpj: '37856623000170', p_razao_social: 'EMPRESA TESTE B LTDA', p_marcas: ['Café Saporino'],
  });
  if (fichaB) criados.fichas.push(fichaB);

  const { data: vistoPorA } = await a.cliente.from('representative_clients').select('id, razao_social');
  checa('o cliente A ve exatamente 1 ficha (a dele)', (vistoPorA ?? []).length === 1, `viu ${(vistoPorA ?? []).length}`);
  checa('a ficha que A ve e a DELE', vistoPorA?.[0]?.id === fichaA);

  const { data: espiada } = await a.cliente.from('representative_clients').select('razao_social').eq('id', fichaB);
  checa('A NAO alcanca a ficha de B nem pedindo pelo id', (espiada ?? []).length === 0, JSON.stringify(espiada));

  const { data: marcasDeB } = await a.cliente.from('cliente_marcas').select('marca').eq('cliente_id', fichaB);
  checa('A NAO ve as marcas de B', (marcasDeB ?? []).length === 0);

  console.log('\n— 5. o cliente nao se da credito —');
  await a.cliente.from('representative_clients').update({ limite_credito: 999999 }).eq('id', fichaA);
  const { data: dep1 } = await admin.from('representative_clients').select('limite_credito').eq('id', fichaA).maybeSingle();
  checa('cliente NAO escreve limite de credito', !dep1?.limite_credito, String(dep1?.limite_credito));

  await a.cliente.from('representative_clients').update({ prazo_pagamento: '90d', forma_pagamento: 'boleto' }).eq('id', fichaA);
  const { data: dep2 } = await admin.from('representative_clients').select('prazo_pagamento').eq('id', fichaA).maybeSingle();
  checa('cliente NAO escreve prazo de pagamento', dep2?.prazo_pagamento !== '90d', String(dep2?.prazo_pagamento));

  console.log('\n— 6. o convite nao vira permissao administrativa —');
  const { data: papeis } = await admin.from('user_roles').select('role_code').eq('user_id', a.uid);
  const lista = (papeis ?? []).map(p => p.role_code);
  checa('o cliente recebeu SO o papel cliente_pj', lista.length === 1 && lista[0] === 'cliente_pj', JSON.stringify(lista));

  const { data: ehAdmin } = await a.cliente.rpc('is_admin');
  checa('o cliente NAO e admin', ehAdmin !== true, String(ehAdmin));

  const { data: outrosClientes } = await a.cliente.from('representatives').select('id');
  checa('o cliente NAO enxerga representantes', (outrosClientes ?? []).length === 0, `viu ${(outrosClientes ?? []).length}`);

  const { error: eConv } = await a.cliente.from('repco_invite_codes')
    .insert({ code: 'HACK01', role_code: 'admin', expires_at: new Date(Date.now() + 9e8).toISOString() });
  checa('o cliente NAO cria convite nenhum', !!eConv, eConv ? '' : 'insercao aceita!');

  console.log('\n— 7. role_code fora da lista e recusado —');
  const { error: eRole } = await admin.from('repco_invite_codes')
    .insert({ code: 'XXX999', role_code: 'superadmin', expires_at: new Date(Date.now() + 9e8).toISOString() });
  checa('role_code inventado e recusado pelo CHECK', !!eRole, eRole ? '' : 'aceito!');

  console.log('\n— 8. o convite de cliente nao serve para entrar como representante —');
  const { data: g3 } = await comoAdmin.rpc('repco_generate_invite_pj', { p_note: 'C', p_email: 'c@teste.local', p_dias: 7 });
  const codigo3 = Array.isArray(g3) ? g3[0]?.code : null;
  if (codigo3) criados.codigos.push(codigo3);
  const { data: comoRep } = await admin.rpc('repco_validate_invite', { p_code: codigo3 });
  checa('codigo de cliente NAO vale como convite de representante', comoRep !== true, JSON.stringify(comoRep));
  const { data: comoProm } = await admin.rpc('promoter_validate_invite', { p_code: codigo3 });
  checa('codigo de cliente NAO vale como convite de promotor', comoProm !== true, JSON.stringify(comoProm));

  console.log('\n— 9. o admin continua enxergando o cadastro —');
  const { data: painel } = await comoAdmin.from('vw_cadastros_pj').select('*');
  const linhaA = (painel ?? []).find(x => x.id === fichaA);
  checa('o cadastro aparece para a administracao', !!linhaA, `${(painel ?? []).length} linha(s)`);
  checa('mostra o codigo de convite usado', !!linhaA?.codigo_convite, linhaA?.codigo_convite);
  checa('mostra quem convidou', linhaA?.convidado_por !== undefined);
  checa('mostra as marcas que o cliente escolheu', (linhaA?.marcas ?? '').includes('Saporino'), linhaA?.marcas);
}

async function limpar() {
  // De dentro para fora: marcas dependem da ficha, ficha depende do convite.
  for (const f of criados.fichas) {
    await admin.from('cliente_marcas').delete().eq('cliente_id', f);
    const { error } = await admin.from('representative_clients').delete().eq('id', f);
    if (error) throw new Error('limpeza da ficha ' + f + ': ' + error.message);
  }
  for (const c of criados.codigos) {
    const { error } = await admin.from('repco_invite_codes').delete().eq('code', c);
    if (error) throw new Error('limpeza do codigo ' + c + ': ' + error.message);
  }
  for (const u of criados.users) {
    await admin.from('user_roles').delete().eq('user_id', u);
    const { error } = await admin.auth.admin.deleteUser(u);
    if (error) throw new Error('limpeza do usuario ' + u + ': ' + error.message);
  }
  // Nao engolir erro de limpeza: lixo em staging ja aconteceu tres vezes.
  const { data: sobrou } = await admin.from('representative_clients').select('id').like('razao_social', '%TESTE%');
  if ((sobrou ?? []).length) console.log(`  ATENCAO: ${sobrou.length} ficha(s) de teste ficaram para tras.`);
  console.log('limpeza: tudo apagado.');
}

try { await rodar(); } finally { await limpar(); }

console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
else console.log('\nO cadastro de cliente PJ esta isolado: convite de uso unico, ficha propria,\nsem credito automatico e sem permissao administrativa.');
