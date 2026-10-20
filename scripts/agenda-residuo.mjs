// Resíduo da agenda: o que sobrou de rodadas antigas, antes da trava.
//
// POR QUE EXISTE. Ele viu o dia 19 com cinco peças e cobrou, porque eu havia
// dito que estava corrigido. A conferência mostrou que a correção FUNCIONA —
// o dia 20 nasceu com três, uma por janela — e que o excesso era de rodadas
// de 19/10, antes dela. Resíduo, não geração nova.
//
// Este script NÃO APAGA NADA por padrão. Ele mede, explica a origem de cada
// linha e mostra o impacto. A decisão de limpar é dele, com o número à vista.
//
//   node scripts/agenda-residuo.mjs            mostra o diagnóstico
//   node scripts/agenda-residuo.mjs --limpar   remove o excesso (pede confirmação)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const LIMPAR = process.argv.includes('--limpar');

/** Data local de São Paulo, sem depender do fuso de quem roda o script. */
function emSaoPaulo(iso) {
  const d = new Date(iso);
  const sp = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dia = `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, '0')}-${String(sp.getDate()).padStart(2, '0')}`;
  const hora = `${String(sp.getHours()).padStart(2, '0')}:${String(sp.getMinutes()).padStart(2, '0')}`;
  return { dia, hora };
}

const hojeSP = emSaoPaulo(new Date().toISOString()).dia;

const { data, error } = await db.from('studio_sugestoes')
  .select('id, brand_id, video_id, sugerido_para, status, created_at')
  .in('status', ['sugerida', 'aprovada'])
  .order('sugerido_para');
if (error) { console.error('FALHOU:', error.message); process.exit(1); }

const porDia = new Map();
for (const s of data) {
  const { dia, hora } = emSaoPaulo(s.sugerido_para);
  if (!porDia.has(dia)) porDia.set(dia, []);
  porDia.get(dia).push({ ...s, dia, hora });
}

console.log('hoje em São Paulo:', hojeSP);
console.log('sugestões ativas:', data.length, '\n');

const vencidas = [];
const duplicadas = [];

for (const [dia, itens] of [...porDia.entries()].sort()) {
  const passado = dia < hojeSP;
  const porHora = new Map();
  for (const i of itens) {
    if (!porHora.has(i.hora)) porHora.set(i.hora, []);
    porHora.get(i.hora).push(i);
  }
  const excesso = [...porHora.values()].filter(a => a.length > 1);

  const marca = passado ? '  [DIA JÁ PASSOU]' : '';
  // ⚠️ O corte é por HORÁRIO, não por dia. Eu media por dia aqui enquanto o
  // módulo media por instante — e as duas contas discordavam: as 08:00 de
  // hoje, às 20h, já passaram, mas o dia é hoje. O script dizia zero
  // vencidas enquanto a tela mostrava sugestão impossível de cumprir.
  const aviso = excesso.length ? '  [HORÁRIO REPETIDO]' : '';
  console.log(`${dia}  ${itens.length} sugestão(ões)${marca}${aviso}`);

  for (const [hora, a] of [...porHora.entries()].sort()) {
    for (const i of a) {
      const quando = i.created_at.slice(0, 16).replace('T', ' ');
      const dup = a.length > 1 ? '  <= repetida' : '';
      console.log(`    ${hora}  arte ${i.video_id.slice(0, 8)}  criada ${quando}${dup}`);
    }
    // Numa repetição, a MAIS ANTIGA fica: foi a primeira decisão, e a
    // segunda é que não deveria ter entrado.
    if (a.length > 1) {
      a.sort((x, y) => x.created_at.localeCompare(y.created_at));
      duplicadas.push(...a.slice(1));
    }
  }
  // Vencida é a que o INSTANTE já passou, esteja em que dia estiver.
  const agora = Date.now();
  vencidas.push(...itens.filter(i => new Date(i.sugerido_para).getTime() < agora));
}

console.log('\n' + '='.repeat(62));
console.log('VENCIDAS (horário já passou, nunca aprovadas nem rejeitadas):', vencidas.length);
console.log('REPETIDAS (mesmo horário, rodada posterior):', duplacount(duplicadas, vencidas));
function duplacount(dups, venc) {
  const idsVenc = new Set(venc.map(v => v.id));
  return dups.filter(d => !idsVenc.has(d.id)).length;
}

const alvo = [...new Map([...vencidas, ...duplicadas].map(x => [x.id, x])).values()];
console.log('TOTAL a remover, se você autorizar:', alvo.length);
console.log('PERMANECEM:', data.length - alvo.length);

if (!LIMPAR) {
  console.log('\nNada foi apagado. Rode com --limpar para remover o que está acima.');
  process.exit(0);
}

// Apagar sugestão APROVADA é diferente: ela pode já ter virado campanha.
const aprovadas = alvo.filter(x => x.status === 'aprovada');
if (aprovadas.length) {
  console.log(`\n⚠️  ${aprovadas.length} das selecionadas estão APROVADAS e podem já ter campanha criada.`);
  console.log('   Estas NÃO serão tocadas. Só as pendentes são removidas.');
}

const remover = alvo.filter(x => x.status === 'sugerida').map(x => x.id);
if (!remover.length) { console.log('\nNada pendente a remover.'); process.exit(0); }

const { error: eDel } = await db.from('studio_sugestoes').delete().in('id', remover);
if (eDel) { console.error('FALHOU:', eDel.message); process.exit(1); }
console.log(`\nREMOVIDAS: ${remover.length} sugestões pendentes.`);

const { count } = await db.from('studio_sugestoes')
  .select('id', { count: 'exact', head: true }).in('status', ['sugerida', 'aprovada']);
console.log('ativas agora:', count);
