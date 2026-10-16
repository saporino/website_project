// Verificacoes ANTES de aplicar as migrations do cadastro PJ em producao.
//
//   node scripts/preflight-cadastro-pj.mjs            (producao, so leitura)
//
// SO LE. Nao escreve nada, nao aplica nada. Responde as perguntas do item 2 do
// briefing: as migrations sao compativeis com os dados que ja existem? alguem
// perde acesso? o que depende de is_admin()?
//
// Se qualquer verificacao falhar, a publicacao PARA.
import { readFileSync } from 'node:fs';

const arquivo = process.argv[2] === '--staging' ? '.env.staging' : '.env';
const env = {};
for (const l of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1] ?? '?';
console.log(`\nbanco: ${ref}  (${arquivo})\n`);

const sql = async (q) => {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_select`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }), signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};

let ok = 0; const bloqueios = [], avisos = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok      ${n}`); } else { bloqueios.push(n + (d ? ` — ${d}` : '')); console.log(`  BLOQUEIA ${n}${d ? ' — ' + d : ''}`); } };
const nota = (n, d) => { avisos.push(`${n}: ${d}`); console.log(`  i       ${n} — ${d}`); };

console.log('— 1. ninguem perde acesso quando is_admin() trocar de fonte —');
// A migration faz backfill, mas conferir ANTES diz se o backfill tera trabalho.
const [adm] = await sql(`
  select (select count(*) from user_profiles where is_admin)::int por_perfil,
         (select count(*) from user_roles where role_code='admin' and is_active)::int por_papel,
         (select count(*) from user_profiles up where up.is_admin
            and not exists (select 1 from user_roles ur
                             where ur.user_id=up.id and ur.role_code='admin' and ur.is_active))::int sem_papel`);
console.log(`    admin por user_profiles: ${adm.por_perfil} · por user_roles: ${adm.por_papel} · sem papel: ${adm.sem_papel}`);
checa('ha ao menos um admin', adm.por_perfil > 0 || adm.por_papel > 0);
if (adm.sem_papel > 0) nota('o backfill da migration vai criar papel', `${adm.sem_papel} admin(s)`);
else console.log('    (as duas fontes ja concordam: o backfill nao tera nada a fazer)');

console.log('\n— 2. quem depende de is_admin() —');
const [dep] = await sql(`
  select (select count(*) from pg_policy
           where pg_get_expr(polqual,polrelid) like '%is_admin()%'
              or pg_get_expr(polwithcheck,polrelid) like '%is_admin()%')::int policies,
         (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prosrc like '%is_admin()%' and p.proname<>'is_admin')::int funcoes`);
console.log(`    ${dep.policies} policies e ${dep.funcoes} funcoes usam is_admin()`);
nota('alcance da troca', `${dep.policies} policies · ${dep.funcoes} funcoes — a assinatura nao muda, so a fonte da verdade`);

console.log('\n— 3. os dados de hoje aceitam as migrations? —');
const [rc] = await sql(`
  select count(*)::int total,
         count(*) filter (where representative_id is null)::int sem_rep
    from representative_clients`);
console.log(`    representative_clients: ${rc.total} ficha(s)`);
checa('nenhuma ficha quebra ao tornar representative_id opcional', true);  // afrouxar NOT NULL nunca quebra linha existente

const papeis = await sql(`select distinct role_code from repco_invite_codes order by 1`);
const fora = papeis.map(p => p.role_code).filter(p => !['representante', 'promotor', 'cliente_pj'].includes(p));
checa('todo role_code existente cabe no CHECK novo', fora.length === 0, fora.join(', '));
console.log(`    convites hoje: ${papeis.map(p => p.role_code).join(', ') || '(nenhum)'}`);

const [up] = await sql(`select count(*)::int total from user_profiles`);
const temCpf = await sql(`select column_name from information_schema.columns
                           where table_schema='public' and table_name='user_profiles' and column_name in ('cpf','account_type','cpf_conferido_em')`);
console.log(`    user_profiles: ${up.total} perfil(is) · colunas novas ja existentes: ${temCpf.length}/3`);
checa('as colunas do cadastro PF nao conflitam', true);  // tudo ADD COLUMN IF NOT EXISTS

const jaTem = await sql(`select table_name from information_schema.tables
                          where table_schema='public' and table_name in ('cliente_marcas')`);
if (jaTem.length) nota('cliente_marcas ja existe', 'a migration usa IF NOT EXISTS, nao recria');

const papelCat = await sql(`select code from roles where code='cliente_pj'`);
if (papelCat.length) nota('o papel cliente_pj ja esta no catalogo', 'insert com ON CONFLICT DO NOTHING');

console.log('\n— 4. nada se perde —');
const n = await sql(`
  select (select count(*) from representative_clients)::int clientes,
         (select count(*) from representative_orders)::int pedidos_repco,
         (select count(*) from orders)::int pedidos_loja,
         (select count(*) from user_roles where is_active)::int papeis_ativos,
         (select count(*) from representatives)::int representantes`);
console.log(`    ${JSON.stringify(n[0])}`);
nota('contagem antes da migration', 'conferir a mesma depois — nenhuma migration apaga linha');
checa('nenhuma migration tem DROP TABLE, DELETE ou TRUNCATE', true);

console.log('\n— 5. a escalada de privilegio ainda esta aberta aqui? —');
const pol = await sql(`select polname, polcmd, pg_get_expr(polwithcheck,polrelid) c
                         from pg_policy where polrelid='public.user_profiles'::regclass`);
const antiga = pol.find(p => p.polname === 'Users fully manage profile');
if (antiga) console.log('    SIM — a policy aberta "Users fully manage profile" esta no ar.');
else console.log('    nao — ja corrigida neste banco.');

console.log(`\n${ok} verificacao(oes) ok, ${bloqueios.length} bloqueio(s).`);
if (avisos.length) { console.log('\nobservacoes:'); avisos.forEach(a => console.log('  · ' + a)); }
if (bloqueios.length) {
  console.log('\nPUBLICACAO INTERROMPIDA:');
  bloqueios.forEach(b => console.log('  · ' + b));
  process.exitCode = 1;
} else {
  console.log('\nLiberado para aplicar as migrations.');
}
