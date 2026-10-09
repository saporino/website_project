// AUDITORIA DE ESQUEMA — o código pede o que o banco tem?
//
// Por que existe (09/10/2026): `typecheck` e `build` não enxergam o banco. Uma tabela que
// deixou de existir, uma coluna renomeada ou um `.rpc()` com nome errado compilam, passam
// no build, sobem para produção e só quebram na tela do cliente. Foi assim que apareceu a
// tabela `notifications`, citada na documentação e inexistente no banco.
//
// O que faz: varre src/ e supabase/functions/ atrás de `.from('x')`, `.select('a,b')` e
// `.rpc('f')`, e confere cada um contra o catálogo do Postgres.
//
//   node scripts/auditoria-schema-codigo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

// ---------------------------------------------------------------- o que o banco oferece
const { data: cols, error: e1 } = await admin.rpc('exec_select', {
  q: `select table_name, column_name from information_schema.columns where table_schema='public'`,
});
if (e1) throw new Error(e1.message);
const colunasDe = new Map();
for (const c of cols) {
  if (!colunasDe.has(c.table_name)) colunasDe.set(c.table_name, new Set());
  colunasDe.get(c.table_name).add(c.column_name);
}
const { data: fns } = await admin.rpc('exec_select', {
  q: `select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`,
});
const funcoes = new Set((fns ?? []).map(f => f.proname));

// ----------------------------------------------------------------- o que o código pede
function fontes(dir) {
  const saida = [];
  if (!fs.existsSync(dir)) return saida;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') saida.push(...fontes(p)); }
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts')) saida.push(p);
  }
  return saida;
}

/** Quebra "a,b,rel(x,y),alias:c" nas partes do nível raiz. */
function partes(select) {
  const fora = [];
  let nivel = 0, atual = '';
  for (const ch of select) {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) { fora.push(atual); atual = ''; continue; }
    atual += ch;
  }
  if (atual.trim()) fora.push(atual);
  return fora.map(p => p.trim()).filter(Boolean);
}

const achados = { tabela: [], coluna: [], rpc: [] };
const vistos = new Set();

// Telas prontas que NINGUÉM importa ainda — existem no repositório, mas não estão ligadas
// ao admin. O que elas pedem ao banco não quebra nada hoje, porque ninguém chega nelas.
// Entram no relatório como nota, não como defeito. Se alguma for ligada, o banco precisa
// ganhar a tabela antes.
const NAO_LIGADAS = new Set(['src/components/admin/LabelFormatsManagement.tsx']);
const adiadas = [];

for (const arquivo of [...fontes(path.join(RAIZ, 'src')), ...fontes(path.join(RAIZ, 'supabase/functions'))]) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (NAO_LIGADAS.has(rel)) { adiadas.push(rel); continue; }

  // .rpc('nome')
  for (const m of texto.matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/gi)) {
    const nome = m[1];
    if (funcoes.has(nome)) continue;
    const chave = `rpc:${nome}`;
    if (vistos.has(chave)) continue; vistos.add(chave);
    achados.rpc.push({ nome, arquivo: rel });
  }

  // .from('tabela') … .select('colunas') — o select do MESMO encadeamento. `storage.from()`
  // fica de fora: ali o argumento é bucket, não tabela.
  for (const m of texto.matchAll(/(storage\s*\.\s*)?\.?from\(\s*['"]([a-z0-9_-]+)['"]\s*\)([\s\S]{0,300}?)\.select\(\s*['"`]([^'"`]*)['"`]/gi)) {
    const [, ehStorage, tabela, meio, select] = m;
    if (ehStorage) continue;
    // se apareceu outro .from() no meio, o select é de outra consulta
    if (/\.from\(/.test(meio)) continue;
    if (!colunasDe.has(tabela)) {
      const chave = `tab:${tabela}`;
      if (!vistos.has(chave)) { vistos.add(chave); achados.tabela.push({ nome: tabela, arquivo: rel }); }
      continue;   // sem tabela não dá para conferir coluna
    }
    const colunas = colunasDe.get(tabela);
    for (const parte of partes(select)) {
      if (parte === '*' || parte.startsWith('count')) continue;
      // relação aninhada: "pedidos(id,total)" ou "alias:pedidos(id)"
      const aninhada = parte.match(/^(?:[a-z0-9_]+:)?([a-z0-9_]+)\s*(?:!\w+)?\s*\(/i);
      if (aninhada) {
        const outra = aninhada[1];
        if (!colunasDe.has(outra)) {
          const chave = `tab:${outra}`;
          if (!vistos.has(chave)) { vistos.add(chave); achados.tabela.push({ nome: outra, arquivo: rel, via: tabela }); }
        }
        continue;
      }
      const nome = parte.replace(/^[a-z0-9_]+:/i, '').replace(/::[a-z]+$/i, '').trim();
      if (!/^[a-z0-9_]+$/i.test(nome)) continue;
      if (colunas.has(nome)) continue;
      const chave = `col:${tabela}.${nome}`;
      if (vistos.has(chave)) continue; vistos.add(chave);
      achados.coluna.push({ tabela, nome, arquivo: rel });
    }
  }

  // .from('tabela') sem select junto — só confere a tabela (storage.from é bucket, não entra)
  for (const m of texto.matchAll(/(storage\s*\.\s*)?\.?from\(\s*['"]([a-z0-9_-]+)['"]\s*\)/gi)) {
    const tabela = m[2];
    if (m[1]) continue;
    if (colunasDe.has(tabela)) continue;
    const chave = `tab:${tabela}`;
    if (vistos.has(chave)) continue; vistos.add(chave);
    achados.tabela.push({ nome: tabela, arquivo: rel });
  }
}

// ------------------------------------------------------------------------- relatório
let problemas = 0;
console.log('\n— tabela ou view que o código usa e o banco não tem —');
for (const a of achados.tabela) { problemas++; console.log(`  !!  ${a.nome}${a.via ? ` (aninhada em ${a.via})` : ''} — ${a.arquivo}`); }
if (!achados.tabela.length) console.log('  ok  nenhuma');

console.log('\n— coluna que o código pede e a tabela não tem —');
for (const a of achados.coluna) { problemas++; console.log(`  !!  ${a.tabela}.${a.nome} — ${a.arquivo}`); }
if (!achados.coluna.length) console.log('  ok  nenhuma');

console.log('\n— função (.rpc) que o código chama e o banco não tem —');
for (const a of achados.rpc) { problemas++; console.log(`  !!  ${a.nome}() — ${a.arquivo}`); }
if (!achados.rpc.length) console.log('  ok  nenhuma');

if (adiadas.length) {
  console.log('\n— telas prontas que ainda não estão ligadas ao admin (não quebram nada hoje) —');
  for (const a of [...new Set(adiadas)]) console.log(`  ·   ${a}`);
}

console.log(problemas
  ? `\n${problemas} ponto(s) para olhar — cada um compila e quebra só na tela.`
  : '\nO que o código pede em uso, o banco tem.');
process.exitCode = problemas ? 1 : 0;
