// Bancada da ficha PJ completa.
//
//   node scripts/auditoria-ficha-pj.mjs
//
// A pergunta central do Vlademir: "o cliente deve conseguir salvar, sair e
// entrar novamente sem perder as informacoes". Aqui isso e provado com DUAS
// sessoes diferentes do mesmo cliente -- a segunda le o que a primeira gravou.
//
// E as travas: um cliente nao ve nem escreve a ficha de outro, e ninguem se
// concede credito pelo caminho novo.
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
const nova = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const MARCA = 'teste-ficha';
const criados = { users: [], fichas: [] };

async function conta(sufixo) {
  const email = `${MARCA}-${sufixo}-${Date.now()}@teste.local`;
  const senha = crypto.randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(sufixo + ': ' + error.message);
  criados.users.push(data.user.id);
  await admin.from('user_roles').insert({ user_id: data.user.id, role_code: 'cliente_pj', is_active: true });
  const entrar = async () => {
    const c = nova();
    const { error: e } = await c.auth.signInWithPassword({ email, password: senha });
    if (e) throw new Error('login: ' + e.message);
    return c;
  };
  return { uid: data.user.id, entrar };
}

async function ficha(uid, razao) {
  const { data, error } = await admin.from('representative_clients').insert({
    representative_id: null, cnpj: '66006929000136', razao_social: razao,
    user_id: uid, origem: 'autocadastro', status_cadastro: 'em_analise',
    cadastrado_em: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Error('ficha: ' + error.message);
  criados.fichas.push(data.id);
  return data.id;
}

async function rodar() {
  const A = await conta('a'); const B = await conta('b');
  const fA = await ficha(A.uid, 'FICHA TESTE A LTDA');
  const fB = await ficha(B.uid, 'FICHA TESTE B LTDA');

  console.log('\n— 1. o cliente consegue editar a propria ficha (era o bug) —');
  const s1 = await A.entrar();
  const { error: e1 } = await s1.from('representative_clients').update({
    nome_fantasia: 'PADARIA DO TESTE',
    inscricao_estadual: '123.456.789.000',
    telefone_comercial: '(11) 4002-8922',
    email_institucional: 'contato@padariadoteste.local',
    endereco_completo: 'Rua das Flores, 100',
    cep: '01000-000', bairro: 'Centro', municipio: 'Sao Paulo', uf: 'SP',
    observacoes_cadastrais: 'Recebemos de manha.',
  }).eq('id', fA);
  checa('a ficha em analise aceita edicao do dono', !e1, e1?.message);

  console.log('\n— 2. contatos por departamento —');
  const deps = [
    { tipo: 'comprador', nome: 'Joana Compradora', cargo: 'Compras', email: 'joana@teste.local', telefone: '(11) 98888-1111', whatsapp: '(11) 98888-1111' },
    { tipo: 'financeiro', nome: 'Carlos Financeiro', email: 'financeiro@teste.local', telefone: '(11) 97777-2222' },
    { tipo: 'fiscal', nome: 'Marta Fiscal', email: 'xml@teste.local', telefone: '(11) 96666-3333' },
    { tipo: 'responsavel_legal', nome: 'Paulo Socio', cargo: 'Socio-administrador' },
  ];
  const { error: e2 } = await s1.from('cliente_contatos').insert(deps.map(d => ({ ...d, cliente_id: fA })));
  checa('o cliente grava os quatro contatos', !e2, e2?.message);

  console.log('\n— 3. endereco de entrega separado —');
  const { error: e3 } = await s1.from('representative_clients').update({
    entrega_mesmo_endereco: false,
    entrega_cep: '02000-000', entrega_logradouro: 'Av. do Deposito', entrega_numero: '900',
    entrega_bairro: 'Industrial', entrega_municipio: 'Guarulhos', entrega_uf: 'SP',
    entrega_referencia: 'Recebemos das 8h as 11h.',
  }).eq('id', fA);
  checa('o endereco de entrega salva', !e3, e3?.message);

  console.log('\n— 4. SAIR E VOLTAR: nada se perde —');
  await s1.auth.signOut();
  const s2 = await A.entrar();          // sessao NOVA, como quem volta amanha
  const { data: lido } = await s2.from('representative_clients').select('*').eq('id', fA).maybeSingle();
  checa('nome fantasia continua la', lido?.nome_fantasia === 'PADARIA DO TESTE', lido?.nome_fantasia);
  checa('inscricao estadual continua la', lido?.inscricao_estadual === '123.456.789.000');
  checa('telefone comercial continua la', lido?.telefone_comercial === '(11) 4002-8922');
  checa('e-mail institucional continua la', lido?.email_institucional === 'contato@padariadoteste.local');
  checa('endereco continua la', lido?.endereco_completo === 'Rua das Flores, 100');
  checa('observacoes continuam la', (lido?.observacoes_cadastrais ?? '').includes('manha'));
  checa('entrega separada continua la', lido?.entrega_mesmo_endereco === false && lido?.entrega_municipio === 'Guarulhos');

  const { data: ct2 } = await s2.from('cliente_contatos').select('*').eq('cliente_id', fA);
  checa('os quatro contatos continuam la', (ct2 ?? []).length === 4, `${(ct2 ?? []).length}`);
  const comprador = (ct2 ?? []).find(c => c.tipo === 'comprador');
  checa('o comprador manteve nome, e-mail e WhatsApp',
    comprador?.nome === 'Joana Compradora' && comprador?.email === 'joana@teste.local' && !!comprador?.whatsapp);

  console.log('\n— 5. completude —');
  const { data: comp } = await s2.rpc('ficha_pj_completude', { p_cliente: fA });
  checa('a completude reconhece empresa, comprador, financeiro e fiscal',
    comp?.empresa && comp?.comprador && comp?.financeiro && comp?.fiscal, JSON.stringify(comp));
  checa('e reconhece que faltam marcas', comp?.marcas === false, JSON.stringify(comp?.marcas));

  console.log('\n— 6. um cliente nao alcanca a ficha do outro —');
  const sB = await B.entrar();
  const { data: espia } = await sB.from('representative_clients').select('id').eq('id', fA);
  checa('B nao le a ficha de A', (espia ?? []).length === 0, `viu ${(espia ?? []).length}`);
  const { data: espiaC } = await sB.from('cliente_contatos').select('id').eq('cliente_id', fA);
  checa('B nao le os contatos de A', (espiaC ?? []).length === 0, `viu ${(espiaC ?? []).length}`);
  await sB.from('representative_clients').update({ nome_fantasia: 'INVADIDO' }).eq('id', fA);
  const { data: dep } = await admin.from('representative_clients').select('nome_fantasia').eq('id', fA).maybeSingle();
  checa('B nao escreve na ficha de A', dep?.nome_fantasia === 'PADARIA DO TESTE', dep?.nome_fantasia);
  const { error: eCt } = await sB.from('cliente_contatos').insert({ cliente_id: fA, tipo: 'comprador', nome: 'Invasor' });
  checa('B nao cria contato na ficha de A', !!eCt, eCt ? '' : 'inseriu!');

  console.log('\n— 7. ninguem se concede credito pelo caminho novo —');
  await s2.from('representative_clients').update({
    limite_credito: 50000, prazo_pagamento: '60d', forma_pagamento: 'boleto', status_cadastro: 'aprovado',
  }).eq('id', fA);
  const { data: dep2 } = await admin.from('representative_clients')
    .select('limite_credito, prazo_pagamento, forma_pagamento, status_cadastro').eq('id', fA).maybeSingle();
  checa('limite de credito segue vazio', !dep2?.limite_credito, String(dep2?.limite_credito));
  checa('prazo segue vazio', !dep2?.prazo_pagamento, String(dep2?.prazo_pagamento));
  checa('forma de pagamento segue vazia', !dep2?.forma_pagamento, String(dep2?.forma_pagamento));
  checa('a situacao segue em analise', dep2?.status_cadastro === 'em_analise', dep2?.status_cadastro);

  console.log('\n— 8. depois de aprovado, o CNPJ congela —');
  await admin.from('representative_clients').update({ status_cadastro: 'aprovado' }).eq('id', fA);
  const s3 = await A.entrar();
  await s3.from('representative_clients').update({ razao_social: 'OUTRA RAZAO LTDA' }).eq('id', fA);
  const { data: dep3 } = await admin.from('representative_clients').select('razao_social').eq('id', fA).maybeSingle();
  checa('razao social nao muda depois de aprovado', dep3?.razao_social === 'FICHA TESTE A LTDA', dep3?.razao_social);
  // ...mas contato e endereco continuam editaveis, que e o uso do dia a dia.
  const { error: e8 } = await s3.from('representative_clients').update({ telefone_comercial: '(11) 3030-4040' }).eq('id', fA);
  const { data: dep4 } = await admin.from('representative_clients').select('telefone_comercial').eq('id', fA).maybeSingle();
  checa('mas telefone continua editavel depois de aprovado', !e8 && dep4?.telefone_comercial === '(11) 3030-4040', dep4?.telefone_comercial);

  console.log('\n— 9. a Lilian (admin) enxerga a ficha inteira —');
  const { data: painel } = await admin.from('vw_cadastros_pj').select('*').eq('id', fA).maybeSingle();
  checa('o painel traz os contatos', Array.isArray(painel?.contatos) && painel.contatos.length === 4,
    `${painel?.contatos?.length}`);
  checa('o painel traz o endereco de entrega', painel?.entrega_municipio === 'Guarulhos');
  checa('o painel traz a completude', !!painel?.completude);
  checa('o painel traz IE e telefone', !!painel?.inscricao_estadual && !!painel?.telefone_comercial);
}

async function limpar() {
  for (const f of criados.fichas) {
    await admin.from('cliente_contatos').delete().eq('cliente_id', f);
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
else console.log('\nO cliente preenche, sai, volta e encontra tudo. E nao alcanca a ficha de ninguem.');
