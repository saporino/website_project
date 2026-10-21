// Refaz o bloco de hashtags das publicações agendadas, preservando o texto.
//
// MEDIDO em 21/10/2026, nas 22 agendadas: #CaféForte e #RitualDoCafé em 19
// delas, #CaféTropeiro em 16. Bloco idêntico em posts seguidos o Instagram
// trata como spam. O corpo do texto é dele e continua sendo — só as tags
// mudam, com rotação por peça e sem nenhuma tag de concorrente.
//
//   node scripts/agenda-rotacionar-hashtags.mjs            mostra
//   node scripts/agenda-rotacionar-hashtags.mjs --gravar   aplica

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { montarHashtags, trocarHashtags } from '../src/lib/hashtagsCafe.ts';

const env = {};
for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
const GRAVAR = process.argv.includes('--gravar');

const { data: campanhas } = await db.from('studio_campaigns')
  .select('id, title, content, video_id, brand_id, scheduled_at')
  .eq('status', 'scheduled').order('scheduled_at');
const { data: marcas } = await db.from('studio_brand_profiles').select('id, name');
const nomeDaMarca = new Map((marcas ?? []).map(m => [m.id, m.name]));

const tagDaMarca = (nome) => {
  const l = String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return l ? '#' + l : null;
};

const antes = new Map();
for (const c of campanhas ?? []) {
  for (const t of (c.content ?? '').match(/#[^\s#]+/g) ?? []) {
    antes.set(t.toLowerCase(), (antes.get(t.toLowerCase()) ?? 0) + 1);
  }
}
console.log(`agendadas: ${campanhas?.length}`);
console.log('\nANTES — as mais repetidas:');
[...antes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  .forEach(([t, n]) => console.log(`  ${String(n).padStart(3)} de ${campanhas.length}  ${t}`));

const usadas = [];
const novos = [];
for (const c of campanhas ?? []) {
  const tags = montarHashtags(c.video_id ?? c.id, {
    daMarca: tagDaMarca(nomeDaMarca.get(c.brand_id)),
    recentes: usadas.slice(-24),
  });
  usadas.push(...tags);
  novos.push({ ...c, novo: trocarHashtags(c.content ?? '', tags), tags });
}

const depois = new Map();
for (const c of novos) for (const t of c.tags) {
  depois.set(t.toLowerCase(), (depois.get(t.toLowerCase()) ?? 0) + 1);
}
console.log('\nDEPOIS — as mais repetidas:');
[...depois.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  .forEach(([t, n]) => console.log(`  ${String(n).padStart(3)} de ${novos.length}  ${t}`));

console.log('\nexemplo:');
console.log('  ', String(novos[0].title).slice(0, 40));
console.log('   antes :', ((campanhas[0].content ?? '').match(/#[^\s#]+/g) ?? []).join(' '));
console.log('   depois:', novos[0].tags.join(' '));

if (!GRAVAR) { console.log('\nNada alterado. Rode com --gravar.'); process.exit(0); }

let n = 0;
for (const c of novos) {
  const { error } = await db.from('studio_campaigns').update({ content: c.novo }).eq('id', c.id);
  if (error) { console.error('  falhou:', error.message); continue; }
  await db.from('studio_sugestoes').update({ legenda: c.novo }).eq('campaign_id', c.id);
  n++;
}
console.log(`\nATUALIZADAS: ${n}`);
