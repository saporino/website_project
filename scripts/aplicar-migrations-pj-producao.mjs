// Aplica as 6 migrations do cadastro PJ em PRODUCAO, uma a uma, parando no
// primeiro erro.
//
//   node scripts/aplicar-migrations-pj-producao.mjs --confirmo
//
// Por que nao e o CLI: a senha do banco de producao nao fica em arquivo (e
// humana, de proposito). O caminho documentado no CLAUDE.md para SQL em
// producao e a RPC `exec_migration`.
//
// Cada migration roda inteira dentro de `EXECUTE` (uma transacao implicita por
// chamada): ou aplica toda, ou nenhuma parte dela. Depois de aplicar, a versao
// e registrada em supabase_migrations.schema_migrations, para que um `db push`
// futuro nao tente aplicar de novo.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const REF_PRODUCAO = 'rsvoazrkxtdrcjnatzcm';
const VERSOES = ['20261015100000', '20261015110000', '20261015120000',
                 '20261015130000', '20261015140000', '20261015150000',
                 '20261016100000', '20261016110000',
                 '20261016120000', '20261016130000'];

if (!process.argv.includes('--confirmo')) {
  console.log('\nEste comando escreve em PRODUCAO. Rode com --confirmo.\n');
  process.exit(1);
}

const env = {};
for (const l of readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
if (ref !== REF_PRODUCAO) { console.log(`.env aponta para ${ref}, nao para producao. Abortado.`); process.exit(1); }
console.log(`\nbanco: ${ref} (PRODUCAO)\n`);

const chamar = async (fn, corpo) => {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(120000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : null;
};
const sql = (q) => chamar('exec_select', { q });

const jaAplicadas = (await sql(
  `select version from supabase_migrations.schema_migrations where version in (${VERSOES.map(v => `'${v}'`).join(',')})`
)).map(r => r.version);

const arquivos = readdirSync(path.join(RAIZ, 'supabase', 'migrations'));

for (const v of VERSOES) {
  const nome = arquivos.find(f => f.startsWith(v));
  if (!nome) { console.log(`PAROU: migration ${v} nao esta na pasta. Voce esta na branch certa?`); process.exit(1); }

  if (jaAplicadas.includes(v)) { console.log(`  pulada  ${nome} (ja registrada)`); continue; }

  const corpo = readFileSync(path.join(RAIZ, 'supabase', 'migrations', nome), 'utf8');
  process.stdout.write(`  aplicando ${nome} ... `);
  try {
    await chamar('exec_migration', { q: corpo });
  } catch (e) {
    console.log('FALHOU');
    console.log(`\n${e.message}\n`);
    console.log('PUBLICACAO INTERROMPIDA. Nada depois desta migration foi aplicado.');
    console.log('A migration que falhou roda dentro de um EXECUTE: ou entrou inteira, ou nao entrou.');
    console.log('Ver docs/Rollback_Cadastro_PJ.md antes de qualquer reversao.');
    process.exit(1);
  }
  // Registrar depois de aplicar, nunca antes.
  await chamar('exec_migration', {
    q: `insert into supabase_migrations.schema_migrations (version, name)
        values ('${v}', '${nome.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/'/g, "''")}')
        on conflict (version) do nothing`,
  });
  console.log('ok');
}

console.log('\n— conferencia: nada se perdeu —');
const [n] = await sql(`
  select (select count(*) from user_profiles)::int perfis,
         (select count(*) from representative_clients)::int clientes,
         (select count(*) from representative_orders)::int pedidos_repco,
         (select count(*) from orders)::int pedidos_loja,
         (select count(*) from user_roles where is_active)::int papeis_ativos,
         (select count(*) from representatives)::int representantes`);
console.log('   ' + JSON.stringify(n));
console.log('   antes: {"perfis":6,"clientes":7,"pedidos_repco":3,"pedidos_loja":4,"papeis_ativos":5,"representantes":2}');
console.log('   (papeis_ativos pode subir 1: o backfill do admin. clientes sobe a cada cadastro novo.)');

const [a] = await sql(`select count(*)::int c from user_roles where role_code='admin' and is_active`);
console.log(`\n   admins ativos depois: ${a.c}  (precisa ser >= 1)`);
if (a.c < 1) { console.log('\n   PERIGO: nenhum admin. Ver docs/Rollback_Cadastro_PJ.md secao "perda de acesso".'); process.exitCode = 1; }
