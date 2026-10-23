// Backup dos arquivos do Storage — o que o backup do Supabase NÃO cobre.
//
// ================== POR QUE ESTE SCRIPT EXISTE ==================
//
// A própria tela de backups do Supabase avisa: "Storage objects are not
// included". O backup diário guarda o BANCO — quem é o cliente, qual pedido,
// qual valor — e **não guarda os arquivos**. Restaurar um backup traz a ficha
// do pedido e não traz a nota fiscal dele.
//
// Nos 13 buckets há nota fiscal, comprovante de pagamento, boleto, documento
// de representante, documento de lote e foto de entrega (POD). São os papéis
// que provam o que aconteceu. Perder o banco é ruim; perder isto é pior,
// porque não se refaz.
//
// ================== COMO FUNCIONA ==================
//
// Percorre todos os buckets, desce todas as pastas, e grava cada arquivo numa
// cópia local espelhando o caminho de origem. Mantém um manifesto com tamanho
// e data de cada arquivo: na próxima vez, o que não mudou não é baixado de
// novo. A primeira cópia é a demorada; as seguintes são rápidas.
//
// NUNCA APAGA NADA, nem na origem nem no destino. Arquivo que sumiu do
// Supabase continua na cópia — e é marcado no manifesto, porque sumiço é
// exatamente a situação em que a cópia vale.
//
//   node scripts/backup-storage.mjs --medir     só mede, não baixa
//   node scripts/backup-storage.mjs             copia o que falta
//   node scripts/backup-storage.mjs --destino D:/backups/saporino

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const env = {};
for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const MEDIR = process.argv.includes('--medir');
const DESTINO = arg('--destino', 'C:/Users/vlade/OneDrive/Documents/BACKUP_STORAGE_SAPORINO');
const MANIFESTO = join(DESTINO, '_manifesto.json');

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';

/** Desce a árvore de um bucket. O `list` do Supabase não é recursivo: pasta
 *  volta como item sem `id`, e é preciso entrar nela. */
async function listar(bucket, prefixo = '', fundo = 0) {
  if (fundo > 8) return [];                 // trava contra ciclo
  const out = [];
  let pagina = 0;
  for (;;) {
    const { data, error } = await db.storage.from(bucket)
      .list(prefixo, { limit: 100, offset: pagina * 100, sortBy: { column: 'name', order: 'asc' } });
    if (error) { console.error(`  erro em ${bucket}/${prefixo}: ${error.message}`); break; }
    if (!data?.length) break;
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id) {
        out.push({
          bucket, caminho,
          tamanho: item.metadata?.size ?? 0,
          atualizado: item.updated_at ?? item.created_at ?? null,
        });
      } else {
        out.push(...await listar(bucket, caminho, fundo + 1));
      }
    }
    if (data.length < 100) break;
    pagina++;
  }
  return out;
}

const manifesto = existsSync(MANIFESTO)
  ? JSON.parse(readFileSync(MANIFESTO, 'utf8'))
  : { criado: new Date().toISOString(), arquivos: {} };

const { data: buckets, error: eB } = await db.storage.listBuckets();
if (eB) { console.error('FALHOU ao listar buckets:', eB.message); process.exit(1); }

console.log(`destino: ${DESTINO}`);
console.log(`buckets: ${buckets.length}\n`);

const todos = [];
for (const b of buckets) {
  const arquivos = await listar(b.name);
  const bytes = arquivos.reduce((s, a) => s + a.tamanho, 0);
  console.log(`  ${b.name.padEnd(20)} ${String(arquivos.length).padStart(5)} arquivo(s)  ${mb(bytes).padStart(10)}`);
  todos.push(...arquivos);
}

const total = todos.reduce((s, a) => s + a.tamanho, 0);
console.log(`\nTOTAL: ${todos.length} arquivos · ${mb(total)}`);

// O que mudou desde a última cópia.
const pendentes = todos.filter(a => {
  const chave = `${a.bucket}/${a.caminho}`;
  const antes = manifesto.arquivos[chave];
  if (!antes) return true;
  const local = join(DESTINO, a.bucket, a.caminho);
  if (!existsSync(local)) return true;
  // Tamanho igual E data igual: não precisa baixar de novo.
  return antes.tamanho !== a.tamanho || antes.atualizado !== a.atualizado;
});

const bytesPendentes = pendentes.reduce((s, a) => s + a.tamanho, 0);
console.log(`a copiar: ${pendentes.length} arquivo(s) · ${mb(bytesPendentes)}`);

// Arquivos que estavam na cópia e sumiram da origem. Não apaga — avisa.
const atuais = new Set(todos.map(a => `${a.bucket}/${a.caminho}`));
const sumidos = Object.keys(manifesto.arquivos).filter(k => !atuais.has(k));
if (sumidos.length) {
  console.log(`\n⚠️  ${sumidos.length} arquivo(s) sumiram da origem e CONTINUAM na cópia:`);
  for (const s of sumidos.slice(0, 5)) console.log(`     ${s}`);
  if (sumidos.length > 5) console.log(`     … e mais ${sumidos.length - 5}`);
}

if (MEDIR) {
  console.log('\n[medição] nada foi baixado. Rode sem --medir para copiar.');
  process.exit(0);
}

mkdirSync(DESTINO, { recursive: true });
let copiados = 0, falhas = 0, bytes = 0;
for (const a of pendentes) {
  const { data, error } = await db.storage.from(a.bucket).download(a.caminho);
  if (error) { console.error(`  falhou ${a.bucket}/${a.caminho}: ${error.message}`); falhas++; continue; }
  const local = join(DESTINO, a.bucket, a.caminho);
  mkdirSync(dirname(local), { recursive: true });
  writeFileSync(local, Buffer.from(await data.arrayBuffer()));
  manifesto.arquivos[`${a.bucket}/${a.caminho}`] = {
    tamanho: a.tamanho, atualizado: a.atualizado, copiado: new Date().toISOString(),
  };
  copiados++; bytes += a.tamanho;
  if (copiados % 25 === 0) console.log(`  … ${copiados}/${pendentes.length}`);
}

manifesto.ultimaCopia = new Date().toISOString();
manifesto.totalArquivos = todos.length;
writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 1));

console.log(`\nCOPIADOS: ${copiados} · ${mb(bytes)}`);
if (falhas) console.log(`FALHAS: ${falhas}`);

// Conferência: o que está no disco bate com o que foi anotado?
let noDisco = 0, divergentes = 0;
for (const [chave, info] of Object.entries(manifesto.arquivos)) {
  const [bucket, ...resto] = chave.split('/');
  const local = join(DESTINO, bucket, resto.join('/'));
  if (!existsSync(local)) continue;
  noDisco++;
  if (info.tamanho && statSync(local).size !== info.tamanho) divergentes++;
}
console.log(`CONFERIDO: ${noDisco} arquivo(s) no disco · ${divergentes} com tamanho divergente`);
console.log(`manifesto: ${MANIFESTO}`);
