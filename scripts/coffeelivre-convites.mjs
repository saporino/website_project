// Coffee LiVRE — bancada dos CONVITES de uso único (staging), com JWT real e a Edge Function lv-convite.
//
// Prova: só admin convida · código com formato e só o hash no banco · validar/inventado/expirado ·
// "perdi meu código" com resposta igual para todos, freio de 2 min e código novo que mata o antigo ·
// cadastro cria a conta com o e-mail do convite e consome o código · código não serve duas vezes ·
// acesso da conta (convidado, bloqueado, sem convite) · e-mail que já tinha conta vincula pelo login ·
// convite de outro e-mail recusado · RLS. Staging sem chave do Resend: nenhum e-mail é enviado.
//   node scripts/coffeelivre-convites.mjs

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
const anonimo = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-convite';
const EMAIL = r => `${MARCA}-${r}@coffeelivre.test`;
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };
const secao = t => console.log(`\n=== ${t} ===`);

async function fn(corpo, token = env.VITE_SUPABASE_ANON_KEY) {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/lv-convite`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json = {}; try { json = JSON.parse(texto); } catch { /* texto cru */ }
  return { status: r.status, json, texto };
}

async function usuario(rotulo, { ehAdmin = false } = {}) {
  const email = EMAIL(rotulo);
  const senha = crypto.randomBytes(18).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
  if (ehAdmin) await admin.from('user_profiles').upsert({ id: data.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { data: s } = await cliente.auth.signInWithPassword({ email, password: senha });
  return { id: data.user.id, email, senha, cliente, token: s.session.access_token };
}

async function limpar() {
  await admin.from('lv_convites').delete().like('email', `${MARCA}%`);
  for (let p = 1; p <= 20; p++) {
    const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const u of (data?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(u.id);
    if (!data?.users || data.users.length < 200) break;
  }
}

try {
  secao('PREPARANDO');
  await limpar();
  const adm = await usuario('admin', { ehAdmin: true });
  const comum = await usuario('comum');
  checar('admin e usuário comum temporários', !!adm.token && !!comum.token);

  secao('QUEM CONVIDA');
  const negado = await fn({ acao: 'criar', nome: 'X', email: EMAIL('x'), dias: 7 }, comum.token);
  checar('usuário comum não convida (403)', negado.status === 403, negado.texto);
  const negadoAnon = await fn({ acao: 'criar', nome: 'X', email: EMAIL('x'), dias: 7 });
  checar('anônimo não convida (403)', negadoAnon.status === 403, negadoAnon.texto);
  const ruim = await fn({ acao: 'criar', nome: 'X', email: 'nao-e-email', dias: 7 }, adm.token);
  checar('e-mail inválido é recusado', ruim.status === 400);
  const diasRuins = await fn({ acao: 'criar', nome: 'X', email: EMAIL('x'), dias: 30 }, adm.token);
  checar('validade só 24 h ou 7 dias', diasRuins.status === 400);

  secao('CONVITE');
  const conv = await fn({ acao: 'criar', nome: 'Maria Convidada', empresa: 'Torrefação Teste', email: EMAIL('maria').toUpperCase(), dias: 7 }, adm.token);
  const cod1 = conv.json.codigo;
  checar('admin convida: código LIVRE-XXXX-XXXX', /^LIVRE-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cod1 ?? ''), conv.texto);
  checar('sem chave do Resend no staging: não envia e avisa (código na tela)', conv.json.enviado === false && /RESEND/.test(conv.json.erro_envio ?? ''));
  const { data: linha } = await admin.from('lv_convites').select('*').eq('email', EMAIL('maria')).single();
  checar('e-mail gravado em minúsculas; status pendente; validade de 7 dias',
    linha?.status === 'pendente' && Math.round((new Date(linha.expires_at) - new Date(linha.created_at)) / 86400000) === 7);
  checar('o banco guarda só o hash, nunca o código', !JSON.stringify(linha).includes(cod1) && /^[0-9a-f]{64}$/.test(linha.code_hash));
  const v = await fn({ acao: 'validar', codigo: cod1.toLowerCase() + '  ' });
  checar('validar (caixa e espaço não importam): devolve nome, empresa e e-mail', v.json.ok && v.json.nome === 'Maria Convidada' && v.json.email === EMAIL('maria') && v.json.ja_tem_conta === false, v.texto);
  const inventado = await fn({ acao: 'validar', codigo: 'LIVRE-AAAA-BBBB' });
  checar('código inventado: inválido', inventado.json.ok === false && inventado.json.motivo === 'invalido');

  secao('PERDI MEU CÓDIGO');
  const perdiLogo = await fn({ acao: 'perdi', email: EMAIL('maria') });
  const { count: aindaUm } = await admin.from('lv_convites').select('id', { count: 'exact', head: true }).eq('email', EMAIL('maria'));
  checar('pedido logo depois do convite: freio de 2 min, nada muda', perdiLogo.json.ok && aindaUm === 1);
  const perdiDesconhecido = await fn({ acao: 'perdi', email: EMAIL('ninguem') });
  checar('e-mail sem convite recebe a MESMA resposta (não revela quem foi convidado)', perdiDesconhecido.json.mensagem === perdiLogo.json.mensagem);
  await admin.from('lv_convites').update({ created_at: new Date(Date.now() - 5 * 60000).toISOString() }).eq('id', linha.id);
  await fn({ acao: 'perdi', email: EMAIL('maria') });
  const { data: depoisPerdi } = await admin.from('lv_convites').select('id, status, substituido_por').eq('email', EMAIL('maria')).order('created_at');
  checar('"perdi": código novo gerado e o anterior substituído', depoisPerdi?.length === 2 && depoisPerdi[0].status === 'substituido' && depoisPerdi[1].status === 'pendente', JSON.stringify(depoisPerdi));
  const velho = await fn({ acao: 'validar', codigo: cod1 });
  checar('o código anterior deixou de valer', velho.json.ok === false);
  const reenvio = await fn({ acao: 'reenviar', convite_id: depoisPerdi[1].id }, adm.token);
  const cod2 = reenvio.json.codigo;
  checar('admin reenvia: outro código novo, que vale', !!cod2 && cod2 !== cod1 && (await fn({ acao: 'validar', codigo: cod2 })).json.ok === true, reenvio.texto);

  secao('CADASTRO');
  const curta = await fn({ acao: 'cadastrar', codigo: cod2, senha: '123', nome: 'Maria' });
  checar('senha curta recusada', curta.json.motivo === 'senha_curta');
  const senhaMaria = crypto.randomBytes(12).toString('base64url') + 'Aa1!';
  const cad = await fn({ acao: 'cadastrar', codigo: cod2, senha: senhaMaria, nome: 'Maria da Silva', empresa: 'Torrefação Teste', telefone: '11999990000', cargo: 'Compras' });
  checar('cadastro conclui com o e-mail do convite', cad.json.ok === true && cad.json.email === EMAIL('maria'), cad.texto);
  const { data: usado } = await admin.from('lv_convites').select('status, user_id').eq('email', EMAIL('maria')).eq('status', 'usado').single();
  const { data: perfilMaria } = await admin.from('lv_convidados').select('*').eq('user_id', usado?.user_id).single();
  checar('código consumido e perfil gravado (nome, empresa, telefone, cargo)',
    !!usado?.user_id && perfilMaria?.nome === 'Maria da Silva' && perfilMaria?.telefone === '11999990000' && perfilMaria?.cargo === 'Compras');
  const repete = await fn({ acao: 'cadastrar', codigo: cod2, senha: senhaMaria, nome: 'Outra pessoa' });
  checar('o MESMO código não serve para mais ninguém (usado)', repete.json.ok === false && repete.json.motivo === 'usado', repete.texto);

  secao('ACESSO DA CONTA');
  const maria = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await maria.auth.signInWithPassword({ email: EMAIL('maria'), password: senhaMaria });
  const { data: ac } = await maria.rpc('lv_acesso_da_conta');
  checar('convidada entra com e-mail e senha e passa pelo portão', !el && ac?.liberado === true && ac?.papel === 'convidado', JSON.stringify(ac));
  const { data: ultimo } = await admin.from('lv_convidados').select('ultimo_acesso').eq('user_id', usado.user_id).single();
  checar('último acesso registrado', !!ultimo?.ultimo_acesso);
  const { data: acComum } = await comum.cliente.rpc('lv_acesso_da_conta');
  checar('conta sem convite não passa', acComum?.liberado === false && acComum?.motivo === 'sem_convite');
  const { data: acAdm } = await adm.cliente.rpc('lv_acesso_da_conta');
  checar('admin passa', acAdm?.liberado === true);
  await adm.cliente.from('lv_convidados').update({ bloqueado: true, bloqueado_em: new Date().toISOString() }).eq('user_id', usado.user_id);
  const { data: acBloq } = await maria.rpc('lv_acesso_da_conta');
  checar('bloqueada pelo admin: não passa mais, sem afetar ninguém', acBloq?.liberado === false && acBloq?.motivo === 'bloqueado');

  secao('E-MAIL QUE JÁ TINHA CONTA');
  const conv2 = await fn({ acao: 'criar', nome: 'Comum', email: comum.email, dias: 1 }, adm.token);
  const v2 = await fn({ acao: 'validar', codigo: conv2.json.codigo });
  checar('validar avisa que o e-mail já tem conta', v2.json.ok && v2.json.ja_tem_conta === true);
  const cad2 = await fn({ acao: 'cadastrar', codigo: conv2.json.codigo, senha: 'SenhaQualquer123', nome: 'X' });
  checar('cadastro recusa: precisa entrar com a senha da conta', cad2.json.motivo === 'email_ja_tem_conta');
  const convOutro = await fn({ acao: 'criar', nome: 'Outro', email: EMAIL('outro'), dias: 1 }, adm.token);
  const outro = await fn({ acao: 'vincular', codigo: convOutro.json.codigo }, comum.token);
  checar('convite de OUTRO e-mail não vincula a esta conta', outro.json.motivo === 'outro_email');
  const vinc = await fn({ acao: 'vincular', codigo: conv2.json.codigo, nome: 'Comum Vinculado' }, comum.token);
  const { data: acComum2 } = await comum.cliente.rpc('lv_acesso_da_conta');
  checar('logado com o e-mail do convite: vincula e passa', vinc.json.ok === true && acComum2?.liberado === true, vinc.texto);

  secao('EXPIRADO E RLS');
  const conv3 = await fn({ acao: 'criar', nome: 'Expira', email: EMAIL('expira'), dias: 1 }, adm.token);
  await admin.from('lv_convites').update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq('email', EMAIL('expira'));
  const exp = await fn({ acao: 'validar', codigo: conv3.json.codigo });
  checar('código vencido: expirado', exp.json.ok === false && exp.json.motivo === 'expirado');
  const lidoAnon = await anonimo.from('lv_convites').select('id').limit(1);
  checar('anônimo não lê convites', !!lidoAnon.error || (lidoAnon.data ?? []).length === 0);
  const lidoComum = await comum.cliente.from('lv_convites').select('id');
  checar('usuário comum não lê convites', (lidoComum.data ?? []).length === 0);
  const proprios = await comum.cliente.from('lv_convidados').select('user_id, email');
  checar('convidado lê só o próprio perfil', (proprios.data ?? []).length === 1 && proprios.data[0].email === comum.email);
  const hackear = await comum.cliente.from('lv_convidados').update({ bloqueado: false }).eq('user_id', usado.user_id).select('user_id');
  checar('convidado não desbloqueia ninguém', (hackear.data ?? []).length === 0);
  const temConta = await comum.cliente.rpc('lv_email_tem_conta', { p_email: EMAIL('maria') });
  checar('ninguém do site consulta se um e-mail tem conta', !!temConta.error);
} catch (e) {
  falhas++; console.log('  !!  bancada interrompida: ' + (e instanceof Error ? e.message : e));
} finally {
  secao('LIMPEZA');
  await limpar();
  const { count } = await admin.from('lv_convites').select('id', { count: 'exact', head: true }).like('email', `${MARCA}%`);
  checar('convites e usuários de teste removidos', count === 0);
  console.log(`\n${criterios} critérios · ${falhas ? `${falhas} FALHARAM` : 'TODOS OS CRITÉRIOS PASSARAM'}`);
  process.exit(falhas ? 1 : 0);
}
