// Gera a BASELINE de estrutura a partir de produção — sem nenhum dado.
//
// Por que existe: as 143 migrations históricas NÃO reconstroem um banco vazio.
// A primeira já altera `orders`, que só nasce meses depois, e 44 tabelas e 33
// funções de produção foram criadas por `exec_migration` sem arquivo nenhum.
// Reescrever o passado mudaria o que produção registrou como aplicado; então o
// histórico fica como está e ganha um ponto de partida verificável:
//
//   banco vazio → baseline (este arquivo) → migrations posteriores → seeds
//
// O que entra: extensões, sequências, tabelas (colunas, identity, gerados,
// defaults), funções, views, constraints, índices, triggers (inclusive o de
// auth.users), RLS e policies (public e storage), comentários, permissões,
// publicação realtime e a configuração dos buckets.
//
// O que NÃO entra, de propósito:
//   • dados de qualquer tabela (nenhum cliente, pedido, rep, usuário ou arquivo);
//   • jobs do pg_cron — todos chamam funções de PRODUÇÃO por URL; em staging
//     disparariam envios reais;
//   • segredos do vault e objetos do storage.
//
// Só lê: usa `exec_select` com a service role de produção (`.env`).
// Uso: node scripts/staging/gerar-baseline.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { REF_PRODUCAO } from '../_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../..');
export const VERSAO_BASELINE = '20260913150000';
const SAIDA = path.join(RAIZ, 'supabase', 'baseline', `${VERSAO_BASELINE}_estrutura_de_producao.sql`);

const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (!env.VITE_SUPABASE_URL?.includes(REF_PRODUCAO)) throw new Error('.env não aponta para produção; a baseline sai de produção.');
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function sel(sql) {
  const { data, error } = await db.rpc('exec_select', { q: sql });
  if (error) throw new Error(`${error.message}\n${sql}`);
  return data ?? [];
}

const id = s => `"${String(s).replaceAll('"', '""')}"`;
const lit = s => (s == null ? 'null' : `'${String(s).replaceAll("'", "''")}'`);
const SEM_EXTENSAO = alias => `not exists (select 1 from pg_depend d where d.objid = ${alias}.oid and d.deptype = 'e')`;
// Papéis que existem em todo projeto Supabase. Qualquer outro (ex.: login do CLI) fica fora.
const PAPEIS = new Set(['anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC']);

const partes = [];
const secao = (titulo, linhas) => { if (linhas.length) partes.push(`\n-- ${titulo}\n${linhas.join('\n')}`); };

// ---------------------------------------------------------------- conferências
const estranhos = await sel(`select p.proname, p.prokind from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind not in ('f','p') and ${SEM_EXTENSAO('p')}`);
if (estranhos.length) throw new Error('agregados/janelas em public não suportados: ' + JSON.stringify(estranhos));
const tiposProprios = await sel(`select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype in ('e','d','c','r') and not exists (select 1 from pg_class c where c.reltype = t.oid)`);
if (tiposProprios.length) throw new Error('tipos próprios em public não suportados: ' + JSON.stringify(tiposProprios));
const aclColunas = await sel(`select c.relname, a.attname, coalesce(r.rolname, 'PUBLIC') papel, x.privilege_type priv
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(a.attacl) x left join pg_roles r on r.oid = x.grantee
  where n.nspname = 'public' and a.attacl is not null order by 1, 3, 4, 2`);

// ---------------------------------------------------------------- extensões
const extensoes = await sel(`select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname not in ('plpgsql','supabase_vault','pg_stat_statements') order by 1`);
secao('Extensões', extensoes.map(e =>
  ['pg_net', 'pg_cron'].includes(e.extname)
    ? `create extension if not exists ${id(e.extname)};`
    : `create extension if not exists ${id(e.extname)} with schema ${id(e.nspname)};`));

// ---------------------------------------------------------------- sequências (as de identity nascem com a coluna)
const sequencias = await sel(`select c.relname, format_type(s.seqtypid, null) tipo, s.seqstart::text ini, s.seqincrement::text inc,
    s.seqmin::text mn, s.seqmax::text mx, s.seqcycle ciclo
  from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_sequence s on s.seqrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'S' and ${SEM_EXTENSAO('c')}
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'i')
  order by 1`);
secao('Sequências', sequencias.map(s =>
  `create sequence if not exists public.${id(s.relname)} as ${s.tipo} increment ${s.inc} minvalue ${s.mn} maxvalue ${s.mx} start ${s.ini}${s.ciclo ? ' cycle' : ''};`));

// ---------------------------------------------------------------- tabelas
const tabelas = await sel(`select c.relname, c.relrowsecurity rls, c.relforcerowsecurity forcar
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and ${SEM_EXTENSAO('c')} order by 1`);
const colunas = await sel(`select c.relname, a.attnum, a.attname, format_type(a.atttypid, a.atttypmod) tipo, a.attnotnull nn,
    a.attidentity ident, a.attgenerated gerado, pg_get_expr(ad.adbin, ad.adrelid) expr,
    (select collname from pg_collation co where co.oid = a.attcollation and a.attcollation <> 100) colacao
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  where n.nspname = 'public' and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped and ${SEM_EXTENSAO('c')}
  order by c.relname, a.attnum`);
const porTabela = new Map(tabelas.map(t => [t.relname, []]));
for (const c of colunas) porTabela.get(c.relname)?.push(c);
const defaults = [];
secao('Tabelas (defaults vêm depois das funções)', tabelas.map(t => {
  const cols = porTabela.get(t.relname).map(c => {
    let linha = `  ${id(c.attname)} ${c.tipo}`;
    if (c.colacao) linha += ` collate ${id(c.colacao)}`;
    if (c.ident === 'a') linha += ' generated always as identity';
    if (c.ident === 'd') linha += ' generated by default as identity';
    if (c.gerado === 's') linha += ` generated always as (${c.expr}) stored`;
    else if (c.expr != null && !c.ident) defaults.push(`alter table public.${id(t.relname)} alter column ${id(c.attname)} set default ${c.expr};`);
    if (c.nn) linha += ' not null';
    return linha;
  });
  return `create table if not exists public.${id(t.relname)} (\n${cols.join(',\n')}\n);`;
}));

const donos = await sel(`select s.relname seq, t.relname tab, a.attname col from pg_depend d
  join pg_class s on s.oid = d.objid and s.relkind = 'S' join pg_class t on t.oid = d.refobjid
  join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid join pg_namespace n on n.oid = s.relnamespace
  where n.nspname = 'public' and d.deptype = 'a'`);

// ---------------------------------------------------------------- funções
const funcoes = await sel(`select p.proname, pg_get_function_identity_arguments(p.oid) args, pg_get_functiondef(p.oid) def,
    p.prokind, coalesce((select bool_or(rc.relkind in ('v','m')) from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]) || p.prorettype) u(o)
      join pg_type ty on ty.oid = u.o join pg_class rc on rc.oid = ty.typrelid), false) usa_view
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p') and ${SEM_EXTENSAO('p')} order by 1, 2`);
const defFuncao = f => `${f.def.trim()};`;
secao('Funções (corpo não é validado agora: check_function_bodies = off)', funcoes.filter(f => !f.usa_view).map(defFuncao));
secao('Defaults de coluna', defaults);
secao('Donos de sequência', donos.map(d => `alter sequence public.${id(d.seq)} owned by public.${id(d.tab)}.${id(d.col)};`));

// ---------------------------------------------------------------- views, em ordem de dependência
const views = await sel(`select c.oid::int8 oid, c.relname, c.relkind, pg_get_viewdef(c.oid) def, c.reloptions::text[] opcoes
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v','m') and ${SEM_EXTENSAO('c')}`);
const deps = await sel(`select distinct r.ev_class::int8 v, d.refobjid::int8 ref from pg_depend d join pg_rewrite r on r.oid = d.objid
  where d.classid = 'pg_rewrite'::regclass and d.refobjid <> r.ev_class`);
const oids = new Set(views.map(v => v.oid));
const precisa = new Map(views.map(v => [v.oid, new Set()]));
for (const d of deps) if (oids.has(d.v) && oids.has(d.ref)) precisa.get(d.v).add(d.ref);
const ordenadas = [];
const feitas = new Set();
while (ordenadas.length < views.length) {
  const prontas = views.filter(v => !feitas.has(v.oid) && [...precisa.get(v.oid)].every(o => feitas.has(o)));
  if (!prontas.length) throw new Error('ciclo entre views');
  for (const v of prontas.sort((a, b) => a.relname.localeCompare(b.relname))) { ordenadas.push(v); feitas.add(v.oid); }
}
secao('Views', ordenadas.map(v => {
  const com = v.opcoes?.length ? ` with (${v.opcoes.join(', ')})` : '';
  const corpo = v.def.trim().replace(/;$/, '');
  return v.relkind === 'm'
    ? `create materialized view if not exists public.${id(v.relname)}${com} as\n${corpo}\nwith no data;`
    : `create or replace view public.${id(v.relname)}${com} as\n${corpo};`;
}));
secao('Funções que usam o tipo de uma view', funcoes.filter(f => f.usa_view).map(defFuncao));

// ---------------------------------------------------------------- constraints
const constraints = await sel(`select c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) def
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and con.contype in ('p','u','x','c','f') and ${SEM_EXTENSAO('c')}
  order by case con.contype when 'p' then 0 when 'u' then 1 when 'x' then 2 when 'c' then 3 else 4 end, c.relname, con.conname`);
secao('Constraints (chaves estrangeiras por último)', constraints.map(c =>
  `alter table public.${id(c.relname)} add constraint ${id(c.conname)} ${c.def};`));

// ---------------------------------------------------------------- índices
const indices = await sel(`select pg_get_indexdef(i.indexrelid) def from pg_index i
  join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and ${SEM_EXTENSAO('c')}
    and not exists (select 1 from pg_constraint con where con.conindid = i.indexrelid and con.conrelid = i.indrelid)
  order by 1`);
secao('Índices', indices.map(i => `${i.def.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ')};`));
secao('Materialized views: primeira carga (tabelas vazias)', views.filter(v => v.relkind === 'm')
  .map(v => `refresh materialized view public.${id(v.relname)};`));

// ---------------------------------------------------------------- triggers
const triggers = await sel(`select pg_get_triggerdef(t.oid) def from pg_trigger t
  join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and ${SEM_EXTENSAO('c')}
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
  order by 1`);
secao('Triggers', triggers.map(t => `${t.def};`));

// ---------------------------------------------------------------- RLS e policies
secao('RLS', tabelas.flatMap(t => [
  ...(t.rls ? [`alter table public.${id(t.relname)} enable row level security;`] : []),
  ...(t.forcar ? [`alter table public.${id(t.relname)} force row level security;`] : []),
]));
const policies = await sel(`select schemaname, tablename, policyname, permissive, roles::text[] roles, cmd, qual, with_check
  from pg_policies where schemaname in ('public','storage') order by 1, 2, 3`);
secao('Policies', policies.map(p => {
  const papeis = p.roles.map(r => (r === 'public' ? 'public' : id(r))).join(', ');
  let s = `drop policy if exists ${id(p.policyname)} on ${id(p.schemaname)}.${id(p.tablename)};\n`;
  s += `create policy ${id(p.policyname)} on ${id(p.schemaname)}.${id(p.tablename)} as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${papeis}`;
  if (p.qual != null) s += ` using (${p.qual})`;
  if (p.with_check != null) s += ` with check (${p.with_check})`;
  return s + ';';
}));

// ---------------------------------------------------------------- comentários
const comentarios = await sel(`select c.relname, c.relkind, a.attname, d.description from pg_description d
  join pg_class c on c.oid = d.objoid and d.classoid = 'pg_class'::regclass join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid
  where n.nspname = 'public' and ${SEM_EXTENSAO('c')} and c.relkind in ('r','p','v','m') order by 1, 3`);
const tipoRel = { r: 'table', p: 'table', v: 'view', m: 'materialized view' };
secao('Comentários', comentarios.map(c => c.attname
  ? `comment on column public.${id(c.relname)}.${id(c.attname)} is ${lit(c.description)};`
  : `comment on ${tipoRel[c.relkind]} public.${id(c.relname)} is ${lit(c.description)};`));

// ---------------------------------------------------------------- permissões
// Todo projeto novo concede tudo a anon/authenticated por padrão; produção pode
// ter revogado. Então: revoga tudo e concede exatamente o que produção tem.
const aclRel = await sel(`select c.relname, c.relkind, coalesce(r.rolname, 'PUBLIC') papel, a.privilege_type priv
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end::"char", c.relowner))) a
  left join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','S') and ${SEM_EXTENSAO('c')}
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'i')
  order by 1, 3, 4`);
const relacoes = await sel(`select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','S') and ${SEM_EXTENSAO('c')}
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'i') order by 1`);
const grants = [];
for (const r of relacoes) {
  const alvo = `${r.relkind === 'S' ? 'sequence' : 'table'} public.${id(r.relname)}`;
  grants.push(`revoke all on ${alvo} from public, anon, authenticated, service_role;`);
  const porPapel = new Map();
  for (const a of aclRel.filter(x => x.relname === r.relname && x.papel !== 'postgres' && PAPEIS.has(x.papel))) {
    porPapel.set(a.papel, [...(porPapel.get(a.papel) ?? []), a.priv.toLowerCase()]);
  }
  for (const [papel, privs] of porPapel) grants.push(`grant ${privs.join(', ')} on ${alvo} to ${papel === 'PUBLIC' ? 'public' : id(papel)};`);
}
// Permissão por coluna (ex.: authenticated só pode atualizar certas colunas).
const porColuna = new Map();
for (const a of aclColunas.filter(x => x.papel !== 'postgres' && PAPEIS.has(x.papel))) {
  const chave = `${a.relname}|${a.papel}|${a.priv}`;
  porColuna.set(chave, [...(porColuna.get(chave) ?? []), a.attname]);
}
for (const [chave, cols] of porColuna) {
  const [tabela, papel, priv] = chave.split('|');
  grants.push(`grant ${priv.toLowerCase()} (${cols.map(id).join(', ')}) on table public.${id(tabela)} to ${papel === 'PUBLIC' ? 'public' : id(papel)};`);
}
const aclFun = await sel(`select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prokind,
    coalesce(r.rolname, 'PUBLIC') papel
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  left join pg_roles r on r.oid = a.grantee
  where n.nspname = 'public' and p.prokind in ('f','p') and ${SEM_EXTENSAO('p')} order by 1, 2, 4`);
for (const f of funcoes) {
  const alvo = `${f.prokind === 'p' ? 'procedure' : 'function'} public.${id(f.proname)}(${f.args})`;
  grants.push(`revoke all on ${alvo} from public, anon, authenticated, service_role;`);
  const papeis = aclFun.filter(a => a.proname === f.proname && a.args === f.args && a.papel !== 'postgres' && PAPEIS.has(a.papel));
  if (papeis.length) grants.push(`grant execute on ${alvo} to ${papeis.map(a => (a.papel === 'PUBLIC' ? 'public' : id(a.papel))).join(', ')};`);
}
secao('Permissões', grants);

// ---------------------------------------------------------------- realtime e storage
const publicacao = await sel(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`);
secao('Realtime', publicacao.map(p =>
  `do $$ begin alter publication supabase_realtime add table public.${id(p.tablename)}; exception when duplicate_object then null; end $$;`));
const buckets = await sel(`select id, name, public, file_size_limit::text lim, allowed_mime_types::text[] mimes from storage.buckets order by 1`);
secao('Buckets (só a configuração; nenhum arquivo)', buckets.map(b =>
  `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (${lit(b.id)}, ${lit(b.name)}, ${b.public}, ${b.lim ?? 'null'}, ${b.mimes ? `array[${b.mimes.map(lit).join(', ')}]` : 'null'}) on conflict (id) do nothing;`));

// ---------------------------------------------------------------- arquivo
const contagem = {
  extensoes: extensoes.length, sequencias: sequencias.length, tabelas: tabelas.length, colunas: colunas.length,
  funcoes: funcoes.length, views: views.length, constraints: constraints.length, indices: indices.length,
  triggers: triggers.length, policies: policies.length, buckets: buckets.length, realtime: publicacao.length,
};
const cabecalho = `-- BASELINE DE ESTRUTURA — gerada por scripts/staging/gerar-baseline.mjs
-- Origem: produção (${REF_PRODUCAO}), SOMENTE ESTRUTURA. Nenhum dado, nenhum job do pg_cron, nenhum segredo.
-- Equivale ao estado de produção depois da migration 20260913140000.
-- Não editar à mão: regenerar pelo script. Mudanças novas vão em supabase/migrations/.
-- Contagem: ${JSON.stringify(contagem)}

set check_function_bodies = off;
set search_path = public, extensions;
`;
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, cabecalho + partes.join('\n') + '\n');
console.log(`baseline gravada: ${path.relative(RAIZ, SAIDA)}`);
console.log(contagem);
