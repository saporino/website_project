// Roda o classificador v2 sobre os anúncios JÁ COLETADOS e mostra o antes/depois.
//
// Fase 2 do briefing: não gasta Apify nenhum — usa o que já foi pago. Não toca em
// `ecommerce_price_snapshots`: grava em `ecommerce_classificacao`, com a versão na linha.
//
//   node scripts/classificar-cafe-historico.mjs --producao   (só lê e classifica)
//   node scripts/classificar-cafe-historico.mjs --producao --simular   (não grava nada)
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';
import { classificar, VERSAO_CLASSIFICADOR } from '../supabase/functions/_shared/classificarCafe.ts';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const simular = process.argv.includes('--simular');
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

// ---------------------------------------------------------------- lê tudo, em páginas
const todos = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await db.from('ecommerce_price_snapshots')
    .select('id, title, price, unit_type, weight_g, price_per_kg, is_suspect, marketplace, raw')
    .order('id').range(de, de + 999);
  if (error) throw new Error(error.message);
  todos.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`\n${todos.length} anúncios carregados (nenhum alterado).`);

// -------------------------------------------------------------------- classifica
const linhas = [], conta = {
  relevancia: {}, familia: {}, apresentacao: {},
  mudouApresentacao: 0, ganhouPeso: 0, perdeuPrecoKg: 0, ganhouPrecoKg: 0, pesoCorrigido: [],
};
const soma = (m, k) => { m[k ?? '(nenhuma)'] = (m[k ?? '(nenhuma)'] ?? 0) + 1; };

/** O que a fonte mandou além do título. Cada marketplace nomeia diferente; o classificador
 *  recebe já normalizado para não ter de conhecer o formato de cada um. */
const daFonte = (raw) => ({
  categoria: raw?.category ?? raw?.categories?.[0] ?? null,
  descricao: raw?.description ?? raw?.['Descrição'] ?? null,
  marca: raw?.brand ?? null,
  embalagem: raw?.Embalagem ?? raw?.['Conteúdo da Embalagem'] ?? null,
});

for (const s of todos) {
  const c = classificar(s.title, s.price, daFonte(s.raw));
  soma(conta.relevancia, c.relevancia);
  soma(conta.familia, c.familia);
  if (c.familia === 'cafe') soma(conta.apresentacao, c.apresentacao);

  if (c.apresentacao !== s.unit_type) conta.mudouApresentacao++;
  if (s.weight_g == null && c.peso.total != null) conta.ganhouPeso++;
  if (s.price_per_kg != null && c.preco_por_kg == null) conta.perdeuPrecoKg++;
  if (s.price_per_kg == null && c.preco_por_kg != null) conta.ganhouPrecoKg++;
  // peso que muda mais de 50% é o caso do multipack lido errado
  if (s.weight_g && c.peso.total && Math.abs(c.peso.total - s.weight_g) / s.weight_g > 0.5) {
    conta.pesoCorrigido.push({ titulo: s.title.slice(0, 58), antes: s.weight_g, depois: c.peso.total });
  }

  linhas.push({
    snapshot_id: s.id, versao: VERSAO_CLASSIFICADOR,
    relevancia: c.relevancia, familia: c.familia, apresentacao: c.apresentacao,
    classe: c.classe, composicao: c.composicao, filtro_numero: c.filtro_numero, marca: c.marca,
    peso_unitario: c.peso.unitario, unidades: c.peso.unidades, peso_total: c.peso.total,
    peso_confiavel: c.peso.confiavel, preco_por_kg: c.preco_por_kg, motivos: c.motivos,
  });
}

// ----------------------------------------------------------------------- relatório
const pct = n => ((n / todos.length) * 100).toFixed(1) + '%';
const tabela = (titulo, m) => {
  console.log(`\n— ${titulo} —`);
  for (const [k, v] of Object.entries(m).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(16)} ${String(v).padStart(5)}  ${pct(v)}`);
  }
};

tabela('relevância (v2)', conta.relevancia);
tabela('família (v2)', conta.familia);
tabela('apresentação, só família café', conta.apresentacao);

console.log('\n— o que mudou em relação à v1 —');
console.log(`  apresentação diferente da v1 .......... ${conta.mudouApresentacao}  ${pct(conta.mudouApresentacao)}`);
console.log(`  ganharam peso que a v1 não leu ........ ${conta.ganhouPeso}`);
console.log(`  ganharam preço por kg ................. ${conta.ganhouPrecoKg}`);
console.log(`  PERDERAM preço por kg (era errado) .... ${conta.perdeuPrecoKg}`);

if (conta.pesoCorrigido.length) {
  console.log(`\n— pesos corrigidos (${conta.pesoCorrigido.length}), amostra —`);
  for (const p of conta.pesoCorrigido.slice(0, 10)) {
    console.log(`  ${String(p.antes).padStart(6)} g → ${String(p.depois).padStart(6)} g  ${p.titulo}`);
  }
}

// impacto no preço médio: o número que vai para relatório
const { data: medias } = await db.rpc('exec_select', {
  q: `select unit_type, round(avg(price_per_kg)::numeric,2) as media_v1, count(*) as n
        from ecommerce_price_snapshots where price_per_kg is not null group by 1 order by 1`,
});
const mediaV2 = {};
for (let i = 0; i < todos.length; i++) {
  const c = linhas[i];
  if (c.familia !== 'cafe' || c.relevancia !== 'relevante' || !c.preco_por_kg) continue;
  (mediaV2[c.apresentacao] ??= []).push(Number(c.preco_por_kg));
}
console.log('\n— preço médio por quilo: v1 × v2 —');
console.log('  apresentação      v1 (R$/kg)   n      v2 (R$/kg)   n');
for (const m of medias ?? []) {
  const v2 = mediaV2[m.unit_type] ?? [];
  const med = v2.length ? (v2.reduce((a, b) => a + b, 0) / v2.length).toFixed(2) : '—';
  console.log(`  ${String(m.unit_type).padEnd(16)} ${String(m.media_v1).padStart(9)} ${String(m.n).padStart(5)}  ${String(med).padStart(11)} ${String(v2.length).padStart(5)}`);
}

// ------------------------------------------------------------------------ grava
if (simular) {
  console.log('\n--simular: nada foi gravado.');
} else {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from('ecommerce_classificacao')
      .upsert(linhas.slice(i, i + 500), { onConflict: 'snapshot_id,versao' });
    if (error) throw new Error(error.message);
  }
  console.log(`\n${linhas.length} classificações gravadas na versão ${VERSAO_CLASSIFICADOR}. Os snapshots originais não foram tocados.`);
}
