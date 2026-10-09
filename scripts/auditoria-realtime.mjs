// AUDITORIA DE REALTIME — a tela se atualiza sozinha, ou só com F5?
//
// Por que existe (09/10/2026): o Vlademir cobrou, com razão, que eu estava tapando buraco
// por buraco — liguei o realtime na aba Vídeos e deixei a aba Campanhas de fora, que é a
// irmã dela na mesma tela. A varredura achou mais dois casos piores:
//   • o sininho escutava `b2b_leads` e `candidaturas_representante` havia meses, mas as
//     duas nunca estiveram na publicação: escuta morta, sino que nunca tocava;
//   • `orders` não publicava nada, então venda da loja não aparecia sem recarregar.
//
// Esta bancada compara os dois lados e falha quando eles se separam de novo:
//   1. tabela que o código ESCUTA e o banco não PUBLICA  → escuta morta
//   2. tabela que recebe coisa de fora e ninguém escuta  → tela que precisa de F5
//
//   node scripts/auditoria-realtime.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

// Tabelas onde o dado nasce SEM ninguém do painel clicar: cliente comprando, representante
// lançando pedido, agendador publicando, candidato se inscrevendo. São as que, se a tela
// não escutar, deixam alguém olhando uma lista desatualizada sem saber.
const CHEGA_DE_FORA = {
  orders: 'venda da loja',
  embalagem_pedidos: 'pedido de embalagem do site da COFICO',
  representative_orders: 'pedido lançado pelo representante',
  representative_order_installments: 'comprovante de boleto anexado',
  b2b_leads: 'lead B2B do site',
  candidaturas_representante: 'candidatura de representante',
  studio_campaigns: 'postagem publicada pelo agendador',
  studio_videos: 'peça terminando de processar',
  chat_messages: 'mensagem recebida',
  promoter_incidents: 'ruptura registrada pelo promotor',
};

// ---------- 1. o que o código escuta ----------
const escutadas = new Map();   // tabela -> arquivos
for (const arquivo of listarFontes(path.join(RAIZ, 'src'))) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  for (const m of texto.matchAll(/table:\s*'([a-z0-9_]+)'/g)) {
    const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
    escutadas.set(m[1], [...new Set([...(escutadas.get(m[1]) ?? []), rel])]);
  }
}

function listarFontes(dir) {
  const saida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) saida.push(...listarFontes(p));
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts')) saida.push(p);
  }
  return saida;
}

// ---------- 2. o que o banco publica ----------
const { data, error } = await admin.rpc('exec_select',
  { q: "select tablename from pg_publication_tables where pubname='supabase_realtime'" });
if (error) throw new Error(error.message);
const publicadas = new Set((data ?? []).map(r => r.tablename));

// ---------- 3. cruzamento ----------
let falhas = 0;
console.log('\n— escuta morta (o código espera aviso que o banco nunca manda) —');
for (const [tabela, arquivos] of [...escutadas].sort()) {
  if (!publicadas.has(tabela)) { falhas++; console.log(`  !!  ${tabela} — escutada em ${arquivos.join(', ')}`); }
}
if (!falhas) console.log('  ok  nenhuma');

const semOuvinte = Object.entries(CHEGA_DE_FORA).filter(([t]) => !escutadas.has(t));
console.log('\n— chega de fora e ninguém escuta (tela que precisa de F5) —');
for (const [t, oque] of semOuvinte) { falhas++; console.log(`  !!  ${t} — ${oque}`); }
if (!semOuvinte.length) console.log('  ok  nenhuma');

const semPublicar = Object.keys(CHEGA_DE_FORA).filter(t => !publicadas.has(t));
console.log('\n— chega de fora e o banco não publica —');
for (const t of semPublicar) { falhas++; console.log(`  !!  ${t} — ${CHEGA_DE_FORA[t]}`); }
if (!semPublicar.length) console.log('  ok  nenhuma');

console.log(falhas ? `\n${falhas} problema(s)` : '\nTudo ligado: o que chega de fora chega na tela sozinho.');
// exitCode em vez de exit(): o cliente do Supabase ainda tem socket aberto, e sair no
// meio faz o Node abortar no Windows com um erro que não é nosso.
process.exitCode = falhas ? 1 : 0;
