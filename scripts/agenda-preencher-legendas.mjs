// Preenche a legenda das campanhas que foram agendadas em branco.
//
// O QUE ACONTECEU. A agenda publicou no Instagram uma peça SEM TEXTO NENHUM,
// e as outras 22 já agendadas iam pelo mesmo caminho. A análise de cada arte
// já tinha a legenda pronta, com hashtags; a agenda nunca foi buscá-la, e a
// aprovação gravava `content: ''`.
//
// POR QUE PREENCHER EM VEZ DE APAGAR. Ele aprovou a arte e o horário — isso
// está certo e é trabalho dele. O que faltou foi o texto. Apagar e refazer
// jogaria fora a decisão que ele já tomou; preencher conserta só o que estava
// errado.
//
// NADA É INVENTADO. O texto vem de `studio_analyses.legendas`, da própria
// arte. Peça sem análise não recebe texto de lugar nenhum: ela é LISTADA para
// ele resolver, e fica fora da publicação até lá.
//
//   node scripts/agenda-preencher-legendas.mjs            mostra o que faria
//   node scripts/agenda-preencher-legendas.mjs --gravar   preenche

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const GRAVAR = process.argv.includes('--gravar');

/** O mesmo critério da tela: a legenda da rede já traz hashtags; as extras só
 *  entram quando não estão lá, para não repetir a mesma tag no post. */
function montar(legendas, hashtags, rede) {
  const base = String(legendas?.[rede] ?? legendas?.instagram ?? '').trim();
  if (!base) return '';
  const extras = (hashtags ?? [])
    .filter(t => t && !base.toLowerCase().includes(String(t).toLowerCase()))
    .slice(0, 6);
  return extras.length ? `${base}\n\n${extras.join(' ')}` : base;
}

const { data: campanhas, error } = await db.from('studio_campaigns')
  .select('id, title, content, platform, scheduled_at, video_id')
  .eq('status', 'scheduled').order('scheduled_at');
if (error) { console.error('FALHOU:', error.message); process.exit(1); }

const vazias = (campanhas ?? []).filter(c => !(c.content ?? '').trim());
console.log(`agendadas: ${campanhas?.length} · sem texto: ${vazias.length}\n`);
if (!vazias.length) { console.log('nada a preencher.'); process.exit(0); }

const ids = [...new Set(vazias.map(c => c.video_id).filter(Boolean))];
const { data: analises } = await db.from('studio_analyses')
  .select('video_id, legendas, hashtags').in('video_id', ids);
const porVideo = new Map((analises ?? []).map(a => [a.video_id, a]));

const comTexto = [];
const semTexto = [];
for (const c of vazias) {
  const a = porVideo.get(c.video_id);
  const texto = montar(a?.legendas, a?.hashtags, c.platform ?? 'instagram');
  (texto ? comTexto : semTexto).push({ ...c, texto });
}

console.log(`COM texto na análise: ${comTexto.length}`);
for (const c of comTexto.slice(0, 4)) {
  console.log(`  ${new Date(c.scheduled_at).toLocaleString('pt-BR')}  ${String(c.title).slice(0, 38)}`);
  console.log(`     ${c.texto.replace(/\n+/g, ' ').slice(0, 96)}…`);
}
if (comTexto.length > 4) console.log(`  … e mais ${comTexto.length - 4}`);

if (semTexto.length) {
  console.log(`\nSEM texto em lugar nenhum: ${semTexto.length} — precisam de você`);
  for (const c of semTexto) {
    console.log(`  ${new Date(c.scheduled_at).toLocaleString('pt-BR')}  ${String(c.title).slice(0, 50)}`);
  }
  console.log('  (estas NÃO serão preenchidas: inventar texto seria pior que não ter)');
}

if (!GRAVAR) {
  console.log('\nNada foi alterado. Rode com --gravar para preencher.');
  process.exit(0);
}

let n = 0;
for (const c of comTexto) {
  const { error: eC } = await db.from('studio_campaigns')
    .update({ content: c.texto }).eq('id', c.id);
  if (eC) { console.error(`  falhou em ${c.id}: ${eC.message}`); continue; }
  // A sugestão correspondente também: é dela que a tela lê, e as duas
  // discordarem seria o mesmo tipo de armadilha de novo.
  await db.from('studio_sugestoes')
    .update({ legenda: c.texto }).eq('campaign_id', c.id);
  n++;
}

console.log(`\nPREENCHIDAS: ${n} campanhas`);
const { data: conf } = await db.from('studio_campaigns')
  .select('content').eq('status', 'scheduled');
const aindaVazias = (conf ?? []).filter(x => !(x.content ?? '').trim()).length;
console.log(`ainda sem texto: ${aindaVazias}`);
