// Coffee LiVRE — operação do STAGING.
//
// O staging é um projeto Supabase separado (ref em `.env.staging`) e é
// descartável: tudo o que ele tem sai de arquivos do git. Nada é feito à mão
// no painel.
//
//   banco vazio → supabase/baseline (estrutura) → supabase/migrations posteriores
//               → marca de ambiente → seed de referência → seed de demonstração
//
// Uso:
//   node scripts/coffeelivre-staging.mjs reconstruir   APAGA o staging e refaz do zero
//   node scripts/coffeelivre-staging.mjs migrar        aplica migrations novas, sem apagar
//   node scripts/coffeelivre-staging.mjs semear        roda os seeds de novo (idempotente)
//   node scripts/coffeelivre-staging.mjs verificar     compara a estrutura com produção
//   COFFEELIVRE_CONFIRMO_PRODUCAO=<ref> node scripts/coffeelivre-staging.mjs marcar-producao --producao
//
// Nenhum comando daqui escreve em produção, exceto `marcar-producao`, que só
// insere a linha de marca de ambiente.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar, REF_PRODUCAO } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VERSAO_BASELINE = '20260913150000';
const comando = process.argv[2] ?? 'verificar';
const semOpcoes = { auth: { persistSession: false, autoRefreshToken: false } };

async function sql(cliente, texto, rotulo) {
  const { error } = await cliente.rpc('exec_migration', { q: texto });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
}

async function selecionar(cliente, texto) {
  const { data, error } = await cliente.rpc('exec_select', { q: texto });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function pastaDeTrabalho() {
  // Pasta temporária com o que o CLI deve aplicar: a baseline e só as migrations
  // POSTERIORES a ela. As anteriores já estão dentro da baseline.
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'coffeelivre-staging-'));
  const destino = path.join(w, 'supabase', 'migrations');
  fs.mkdirSync(destino, { recursive: true });
  const baseline = fs.readdirSync(path.join(RAIZ, 'supabase', 'baseline')).filter(f => f.startsWith(VERSAO_BASELINE));
  if (baseline.length !== 1) throw new Error('baseline não encontrada em supabase/baseline');
  fs.copyFileSync(path.join(RAIZ, 'supabase', 'baseline', baseline[0]), path.join(destino, baseline[0]));
  const posteriores = fs.readdirSync(path.join(RAIZ, 'supabase', 'migrations'))
    .filter(f => /^\d{14}_/.test(f) && f.slice(0, 14) > VERSAO_BASELINE).sort();
  for (const f of posteriores) fs.copyFileSync(path.join(RAIZ, 'supabase', 'migrations', f), path.join(destino, f));
  return { w, posteriores };
}

function cli(args, ambiente) {
  // A senha vai por PGPASSWORD no processo filho: nunca na linha de comando nem na saída.
  const senha = ambiente.env.SUPABASE_DB_PASSWORD;
  if (!senha) throw new Error('SUPABASE_DB_PASSWORD ausente em .env.staging');
  const host = ambiente.env.SUPABASE_POOLER_HOST || 'aws-0-sa-east-1.pooler.supabase.com';
  const url = `postgresql://postgres.${ambiente.ref}@${host}:5432/postgres`;
  const r = spawnSync('npx', ['supabase', ...args, '--db-url', url], {
    cwd: RAIZ, shell: true, encoding: 'utf8', env: { ...process.env, PGPASSWORD: senha },
  });
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`.replaceAll(senha, '***')
    .split(/\r?\n/).filter(l => l.trim() && !/new version|recommend updating|^NOTICE \(00000\)/i.test(l)).join('\n');
  console.log(saida);
  if (r.status !== 0 || /^ERROR|failed to/im.test(saida)) throw new Error(`supabase ${args.slice(0, 2).join(' ')} falhou`);
}

async function marcar(cliente, ambiente) {
  await sql(cliente, `insert into public.ambiente_do_banco (id, nome, project_ref) values (1, '${ambiente.nome}', '${ambiente.ref}')
    on conflict (id) do nothing`, 'marca de ambiente');
  const { data } = await cliente.from('ambiente_do_banco').select('nome, project_ref').eq('id', 1).single();
  if (data?.nome !== ambiente.nome || data?.project_ref !== ambiente.ref) throw new Error(`a marca do banco ficou ${JSON.stringify(data)}`);
  console.log(`  ok  banco marcado como ${data.nome} (${data.project_ref})`);
}

async function semear(cliente) {
  for (const arquivo of ['coffeelivre_referencia.sql', 'coffeelivre_demo.sql']) {
    await sql(cliente, fs.readFileSync(path.join(RAIZ, 'supabase', 'seeds', arquivo), 'utf8'), arquivo);
    console.log(`  ok  seed ${arquivo}`);
  }
}

const IMPRESSAO = {
  tabelas: `select c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')`,
  colunas: `select c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) as nome from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped`,
  views: `select c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('v','m')`,
  funcoes: `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || case when p.prosecdef then ' definer' else '' end as nome from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`,
  constraints: `select c.relname || '.' || con.conname as nome from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and con.contype in ('p','u','x','c','f')`,
  indices: `select indexname as nome from pg_indexes where schemaname = 'public'`,
  triggers: `select c.relname || '.' || t.tgname as nome from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))`,
  policies: `select schemaname || '.' || tablename || '.' || policyname || ':' || cmd || ':' || roles::text as nome from pg_policies where schemaname in ('public','storage')`,
  rls: `select c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity`,
  permissoes: `select c.relname || ':' || coalesce(r.rolname, 'PUBLIC') || ':' || a.privilege_type as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a left join pg_roles r on r.oid = a.grantee where n.nspname = 'public' and c.relkind in ('r','p','v','m') and coalesce(r.rolname, 'PUBLIC') in ('anon','authenticated','PUBLIC')`,
  exec_fn: `select p.proname || ':' || coalesce(r.rolname, 'PUBLIC') as nome from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a left join pg_roles r on r.oid = a.grantee where n.nspname = 'public' and coalesce(r.rolname, 'PUBLIC') in ('anon','authenticated','PUBLIC')`,
  buckets: `select id || ':' || public::text as nome from storage.buckets`,
};

async function verificar(staging) {
  // Produção só é LIDA aqui.
  const prodEnv = Object.fromEntries(
    fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  if (!prodEnv.VITE_SUPABASE_URL.includes(REF_PRODUCAO)) throw new Error('.env não é produção');
  const producao = createClient(prodEnv.VITE_SUPABASE_URL, prodEnv.SUPABASE_SERVICE_ROLE_KEY, semOpcoes);
  const { posteriores } = pastaDeTrabalho();
  let divergencias = 0;
  for (const [tipo, consulta] of Object.entries(IMPRESSAO)) {
    const [p, s] = await Promise.all([selecionar(producao, consulta), selecionar(staging, consulta)]);
    const P = new Set(p.map(x => x.nome));
    const S = new Set(s.map(x => x.nome));
    const faltam = [...P].filter(x => !S.has(x));
    const sobram = [...S].filter(x => !P.has(x));
    // Só no staging: migrations posteriores ainda não aplicadas em produção.
    // Falta no staging: sempre erro.
    const rotulo = `${tipo.padEnd(11)} produção ${String(P.size).padStart(4)} · staging ${String(S.size).padStart(4)}`;
    if (faltam.length) { divergencias++; console.log(`  !!  ${rotulo} · faltam no staging: ${faltam.slice(0, 8).join(', ')}${faltam.length > 8 ? '…' : ''}`); }
    else console.log(`  ok  ${rotulo}${sobram.length ? ` · só no staging: ${sobram.slice(0, 6).join(', ')}` : ''}`);
  }
  const contar = async (t, f) => { let q = staging.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return (await q).count ?? 0; };
  const demo = await contar('lv_products', q => q.eq('is_demo', true));
  const tarifas = await contar('lv_tarifas_simulacao');
  const naoDemo = await contar('lv_sellers', q => q.eq('is_demo', false));
  const perfis = await contar('user_profiles');
  const pedidos = await contar('orders');
  const clientes = await contar('representative_clients');
  const linha = (ok, t) => { if (!ok) divergencias++; console.log(`  ${ok ? 'ok' : '!!'}  ${t}`); };
  linha(demo > 0, `produtos de demonstração: ${demo}`);
  linha(tarifas > 0, `tarifas da calculadora: ${tarifas}`);
  linha(naoDemo === 0, `vendedores não-demo (dado real): ${naoDemo}`);
  linha(pedidos === 0 && clientes === 0, `pedidos e clientes da Saporino: ${pedidos} / ${clientes}`);
  console.log(`  --  perfis de usuário (só contas de teste): ${perfis}`);
  console.log(`\nmigrations posteriores à baseline: ${posteriores.join(', ') || 'nenhuma'}`);
  console.log(divergencias ? `\n${divergencias} DIVERGÊNCIA(S)\n` : '\nSTAGING CONFERE COM PRODUÇÃO\n');
  if (divergencias) process.exitCode = 1;
}

if (comando === 'marcar-producao') {
  const ambiente = escolherAmbiente({ destrutivo: false });
  if (ambiente.nome !== 'producao') { console.error('use com --producao'); process.exit(2); }
  anunciar(ambiente);
  await marcar(createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY, semOpcoes), ambiente);
} else {
  if (process.argv.includes('--producao')) { console.error('ABORTADO: o staging nunca é produção.'); process.exit(2); }
  const ambiente = escolherAmbiente({ destrutivo: true });
  anunciar(ambiente);
  const cliente = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY, semOpcoes);

  if (comando === 'reconstruir') {
    // Banco novo ainda não tem a marca; banco que tem precisa dizer "staging" com este ref.
    const { data: marca, error } = await cliente.from('ambiente_do_banco').select('nome, project_ref').eq('id', 1).maybeSingle();
    if (!error && marca && (marca.nome !== 'staging' || marca.project_ref !== ambiente.ref)) {
      console.error(`ABORTADO: o banco se declara ${JSON.stringify(marca)}.`); process.exit(2);
    }
    const { w } = pastaDeTrabalho();
    cli(['db', 'reset', '--yes', '--no-seed', '--workdir', w], ambiente);
    await marcar(cliente, ambiente);
    await semear(cliente);
    await verificar(cliente);
  } else {
    await confirmarNoBanco(cliente, ambiente, { destrutivo: true });
    if (comando === 'migrar') { const { w } = pastaDeTrabalho(); cli(['db', 'push', '--yes', '--include-all', '--workdir', w], ambiente); }
    else if (comando === 'semear') await semear(cliente);
    else if (comando === 'verificar') await verificar(cliente);
    else { console.error('Comando desconhecido: ' + comando); process.exitCode = 1; }
  }
}
