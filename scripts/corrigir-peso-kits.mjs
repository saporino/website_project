// Corrige o peso dos anuncios cuja quantidade estava so no titulo.
//
// "Kit 10 Pacotes Camparoma 500g" a R$ 368,88 foi gravado como 500 g, o que
// deu R$ 737,76/kg num cafe que custa R$ 73,78/kg. Dez vezes errado, e PARA
// CIMA -- o erro que faria a gente achar que pode cobrar o dobro.
//
//   node scripts/corrigir-peso-kits.mjs            mostra
//   node scripts/corrigir-peso-kits.mjs --gravar   corrige
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { quantidadeNoTitulo } from '../src/lib/precoCafe.ts';
const env = {};
for (const l of readFileSync('.env','utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const GRAVAR = process.argv.includes('--gravar');

const { data } = await db.from('ecommerce_price_snapshots')
  .select('id, title, price, weight_g, price_per_kg, unit_type')
  .eq('marketplace','mercadolivre');

const errados = [];
for (const d of data ?? []) {
  const n = quantidadeNoTitulo(d.title);
  if (!n || !d.weight_g) continue;
  const novoPeso = d.weight_g * n;
  // So corrige se o peso gravado NAO ja considerava a quantidade.
  if (novoPeso > 60000) continue;
  const novoKg = d.price / (novoPeso / 1000);
  errados.push({ ...d, n, novoPeso, novoKg });
}
console.log(`anuncios: ${data?.length} · com quantidade no titulo nao contada: ${errados.length}\n`);
for (const e of errados.sort((a,b)=>b.price_per_kg-a.price_per_kg).slice(0,8)) {
  console.log(`  ${String(e.price_per_kg.toFixed(0)).padStart(5)}/kg -> ${String(e.novoKg.toFixed(0)).padStart(5)}/kg  (${e.n}x)  ${String(e.title).slice(0,52)}`);
}
if (!GRAVAR) { console.log('\nNada alterado. Rode com --gravar.'); process.exit(0); }
let n = 0;
for (const e of errados) {
  const { error } = await db.from('ecommerce_price_snapshots')
    .update({ weight_g: e.novoPeso, price_per_kg: e.novoKg, unit_type: `kit ${e.n}x` })
    .eq('id', e.id);
  if (!error) n++;
}
console.log(`\nCORRIGIDOS: ${n}`);
const { data: dep } = await db.from('ecommerce_price_snapshots')
  .select('price_per_kg').eq('marketplace','mercadolivre').gt('price_per_kg',300);
console.log('ainda acima de 300/kg:', dep?.length);
