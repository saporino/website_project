// Verifica, EM PRODUCAO, que a escalada de privilegio esta fechada.
//
//   node scripts/verificar-seguranca-producao.mjs --confirmo
//
// Cria UM usuario temporario, tenta se promover a admin, confirma que o banco
// recusa, e apaga o usuario. Nao toca em nenhum dado real: nao le ficha de
// cliente, nao altera pedido, nao mexe em permissao de ninguem.
//
// Existe porque "a migration aplicou" nao e o mesmo que "o ataque nao funciona".
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const REF_PRODUCAO = 'rsvoazrkxtdrcjnatzcm';
if (!process.argv.includes('--confirmo')) { console.log('\nRode com --confirmo.\n'); process.exit(1); }

const env = {};
for (const l of readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
if (ref !== REF_PRODUCAO) { console.log(`.env aponta para ${ref}. Abortado.`); process.exit(1); }
console.log(`\nbanco: ${ref} (PRODUCAO)\n`);

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = async (q) => {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_select`, {
    method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }), signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};

let ok = 0; const falhas = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };

const EMAIL = `verificacao-seguranca-${Date.now()}@coficobrasil.com.br`;
const SENHA = crypto.randomBytes(18).toString('base64url');   // nunca impressa
let uid = null;

async function rodar() {
  console.log('— 1. a configuracao mudou mesmo? —');
  const [f] = await sql(`select pg_get_functiondef(p.oid) def from pg_proc p
                           join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='is_admin'`);
  checa('is_admin() le user_roles, nao user_profiles',
    f.def.includes('user_roles') && !f.def.includes('user_profiles'));

  const pol = await sql(`select polname from pg_policy where polrelid='public.user_profiles'::regclass`);
  const nomes = pol.map(p => p.polname);
  checa('a policy aberta "Users fully manage profile" nao existe mais', !nomes.includes('Users fully manage profile'), nomes.join(', '));
  checa('as policies novas estao no ar', nomes.includes('perfil_proprio_edicao'));

  const conv = await sql(`select polname from pg_policy where polrelid='public.repco_invite_codes'::regclass`);
  const cn = conv.map(p => p.polname);
  checa('gerente e supervisor nao escrevem mais em convites',
    !cn.includes('repco_invite_codes_ger_all') && !cn.includes('repco_invite_codes_sup_all'), cn.join(', '));

  const chk = await sql(`select conname from pg_constraint where conrelid='public.repco_invite_codes'::regclass
                          and conname='repco_invite_codes_role_code_check'`);
  checa('o CHECK de role_code existe', chk.length === 1);

  console.log('\n— 2. o ataque, de verdade, com sessao real —');
  const { data: criado, error: e1 } = await admin.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true });
  if (e1) throw new Error('nao criou usuario: ' + e1.message);
  uid = criado.user.id;
  console.log('  usuario temporario criado (apagado no fim)');

  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e2 } = await cliente.auth.signInWithPassword({ email: EMAIL, password: SENHA });
  if (e2) throw new Error('nao logou: ' + e2.message);

  await cliente.from('user_profiles').update({ is_admin: true }).eq('id', uid);
  const { data: p } = await admin.from('user_profiles').select('is_admin').eq('id', uid).maybeSingle();
  checa('um cliente NAO consegue virar administrador', p?.is_admin !== true,
    p?.is_admin === true ? 'ESCALADA AINDA ABERTA' : '');
  if (p?.is_admin === true) await admin.from('user_profiles').update({ is_admin: false }).eq('id', uid);

  const { data: ehAdmin } = await cliente.rpc('is_admin');
  checa('is_admin() devolve false para ele', ehAdmin !== true, String(ehAdmin));

  console.log('\n— 3. ele nao alcanca dado de ninguem —');
  const { data: fichas } = await cliente.from('representative_clients').select('id');
  checa('nao enxerga ficha de cliente nenhuma', (fichas ?? []).length === 0, `viu ${(fichas ?? []).length} de 7`);

  const { data: reps } = await cliente.from('representatives').select('id');
  checa('nao enxerga representantes', (reps ?? []).length === 0, `viu ${(reps ?? []).length}`);

  const { data: pedidos } = await cliente.from('representative_orders').select('id');
  checa('nao enxerga pedidos do RepCo', (pedidos ?? []).length === 0, `viu ${(pedidos ?? []).length}`);

  const { error: eConv } = await cliente.from('repco_invite_codes')
    .insert({ code: 'ZZZ999', role_code: 'admin', expires_at: new Date(Date.now() + 9e8).toISOString() });
  checa('nao cria convite', !!eConv, eConv ? '' : 'insercao aceita!');

  console.log('\n— 4. quem ja tinha acesso continua tendo —');
  const [a] = await sql(`select count(*)::int c from user_roles where role_code='admin' and is_active`);
  checa('ha admin ativo', a.c >= 1, `${a.c}`);
  const [r] = await sql(`select count(*)::int c from representatives`);
  checa('os representantes continuam la', r.c === 2, `${r.c}`);
  const [cl] = await sql(`select count(*)::int c from representative_clients`);
  checa('as 7 fichas de cliente continuam la', cl.c >= 7, `${cl.c}`);

  console.log('\n— 5. o cadastro PJ esta pronto no banco —');
  const [pj] = await sql(`select
     (select count(*) from roles where code='cliente_pj')::int papel,
     (select count(*) from information_schema.columns where table_schema='public' and table_name='representative_clients' and column_name='user_id')::int coluna,
     (select count(*) from information_schema.tables where table_schema='public' and table_name='cliente_marcas')::int marcas,
     (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('repco_generate_invite_pj','repco_validate_invite_pj','cliente_pj_registrar','repco_list_invites_pj'))::int funcoes`);
  checa('papel cliente_pj no catalogo', pj.papel === 1);
  checa('representative_clients.user_id existe', pj.coluna === 1);
  checa('tabela cliente_marcas existe', pj.marcas === 1);
  checa('as 4 funcoes do convite PJ existem', pj.funcoes === 4, `${pj.funcoes}/4`);
}

try { await rodar(); } finally {
  if (uid) {
    await admin.from('user_roles').delete().eq('user_id', uid);
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) console.log('ATENCAO: nao apagou o usuario temporario ' + uid + ': ' + error.message);
    else console.log('\nlimpeza: usuario temporario apagado.');
  }
}

console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
else console.log('\nPRODUCAO SEGURA: a escalada esta fechada e o cadastro PJ esta pronto no banco.');
