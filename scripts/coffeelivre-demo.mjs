// Coffee LiVRE — bancada de teste do vendedor.
//
// POR QUE ISTO É UM SCRIPT E NÃO UMA ROTA OU UMA FUNÇÃO NO BANCO:
// qualquer atalho de aprovação que exista numa rota, numa edge function
// ou numa RPC existe TAMBÉM EM PRODUÇÃO — basta alguém descobrir o
// caminho. Um script de linha de comando usa a chave de serviço que já
// está no `.env` da máquina de quem desenvolve, a mesma que aplica as
// migrations, e essa chave nunca chega ao navegador. Nada é acrescentado
// ao pacote publicado, e nenhum botão de "aprovar sem análise" passa a
// existir para ninguém.
//
// LIMITE HONESTO: o projeto Supabase é um só, então este script escreve
// no MESMO banco da demonstração. A proteção não é de ambiente, é de
// marcação: tudo o que ele cria leva o prefixo `teste-` e `is_demo`, e o
// comando `limpar` só apaga o que casa com esse prefixo. Ele não tem como
// remover vendedor, loja ou produto que não tenha criado.
//
// Uso:
//   node scripts/coffeelivre-demo.mjs semear      cria vendedor, loja e produto com escada
//   node scripts/coffeelivre-demo.mjs publicar    põe o produto no ar
//   node scripts/coffeelivre-demo.mjs despublicar tira do ar
//   node scripts/coffeelivre-demo.mjs aceite      roda os critérios de aceite
//   node scripts/coffeelivre-demo.mjs limpar      apaga tudo o que criou
//   node scripts/coffeelivre-demo.mjs ciclo       semear + aceite + limpar

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

// Service role escreve; anon lê. Os dois clientes existem porque metade
// dos critérios de aceite é justamente "o visitante consegue ver isto?".
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const visitante = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// A marca de tudo que este script cria. Mudar isto quebra o `limpar`.
const PREFIXO = 'teste-';
const LOJA = `${PREFIXO}bancada`;
const PRODUTO = `${PREFIXO}cafe-com-escada`;
const VENDEDOR = 'Bancada de Teste (automático)';

const PRECO = 2390;          // R$ 23,90, o exemplo da especificação
const PISO = 2000;           // R$ 20,00 de piso do vendedor
const FAIXAS = [             // desconto em reais por unidade
  { min_qty: 2, tipo: 'reais', valor: 100 },
  { min_qty: 3, tipo: 'reais', valor: 150 },
  { min_qty: 4, tipo: 'reais', valor: 200 },
];

let falhas = 0;
const ok = t => console.log('  ok  ' + t);
const erro = t => { falhas++; console.log('  !!  ' + t); };
const checar = (rotulo, condicao, detalhe = '') => condicao ? ok(rotulo) : erro(`${rotulo} ${detalhe}`);
const reais = c => (c / 100).toFixed(2).replace('.', ',');

async function semear() {
  console.log('\n=== SEMEANDO ===');
  await limpar(true);

  const { data: v, error: ev } = await admin.from('lv_sellers').insert({
    nome_fantasia: VENDEDOR, tipo: 'torrefacao', cidade: 'Bancada', uf: 'SP',
    responsavel: 'Automação', email: 'bancada@teste.local', status: 'aprovado', is_demo: true,
  }).select('id').single();
  if (ev) { erro('criar vendedor: ' + ev.message); return null; }
  ok(`vendedor ${v.id.slice(0, 8)}`);

  const { data: l, error: el } = await admin.from('lv_stores').insert({
    seller_id: v.id, slug: LOJA, nome: 'Bancada de Teste',
    chamada: 'Loja criada pela automação de testes',
    cidade: 'Bancada', uf: 'SP', cor: '#2F4B3A', iniciais: 'BT',
    // Nasce INATIVA, como no fluxo real de aprovação.
    ativa: false, is_demo: true,
  }).select('id').single();
  if (el) { erro('criar loja: ' + el.message); return null; }
  ok(`loja ${LOJA} (inativa)`);

  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();
  const { data: p, error: ep } = await admin.from('lv_products').insert({
    store_id: l.id, seller_id: v.id, category_id: cat.id, slug: PRODUTO,
    titulo: 'Café de Bancada Torrado e Moído 500g', marca: 'Bancada',
    descricao: 'Produto criado pela automação para validar a escada de quantidade.',
    preco_cents: PRECO, peso_g: 500,
    venda_por_quantidade: true, preco_minimo_cents: PISO,
    // Nasce em rascunho: publicar é um passo separado, como na vida real.
    status: 'rascunho', is_demo: true, ordem: 99,
  }).select('id').single();
  if (ep) { erro('criar produto: ' + ep.message); return null; }
  ok(`produto ${PRODUTO} (rascunho, R$ ${reais(PRECO)})`);

  const { error: et } = await admin.from('lv_price_tiers')
    .insert(FAIXAS.map(f => ({ ...f, product_id: p.id })));
  if (et) { erro('criar faixas: ' + et.message); return null; }
  ok('escada 2/3/4 com desconto em reais por unidade');

  return { vendedorId: v.id, lojaId: l.id, produtoId: p.id };
}

async function publicar(ligado = true) {
  const { error: e1 } = await admin.from('lv_products')
    .update({ status: ligado ? 'ativo' : 'rascunho' }).eq('slug', PRODUTO);
  const { error: e2 } = await admin.from('lv_stores').update({ ativa: ligado }).eq('slug', LOJA);
  if (e1 || e2) { erro('publicar: ' + (e1 ?? e2).message); return; }
  ok(ligado ? 'produto e loja no ar' : 'produto e loja fora do ar');
}

async function aceite() {
  console.log('\n=== CRITÉRIOS DE ACEITE ===');

  // 1. Rascunho não aparece para o visitante.
  await publicar(false);
  const escondido = await visitante.from('vw_lv_vitrine').select('slug').eq('slug', PRODUTO);
  checar('rascunho não aparece na vitrine', escondido.data.length === 0, `(vieram ${escondido.data.length})`);

  // 2. Publicado aparece, com a escada ligada.
  await publicar(true);
  const publico = await visitante.from('vw_lv_vitrine').select('*').eq('slug', PRODUTO).maybeSingle();
  checar('publicado aparece na vitrine', !!publico.data);
  checar('a vitrine sabe que tem escada', publico.data?.venda_por_quantidade === true);
  checar('preço em centavos inteiros', Number.isInteger(publico.data?.preco_cents), `(${publico.data?.preco_cents})`);

  // 3. As faixas são legíveis pelo visitante.
  const faixas = await visitante.from('lv_price_tiers')
    .select('min_qty, tipo, valor').eq('product_id', publico.data.id).order('min_qty');
  checar('o visitante lê as três faixas', faixas.data?.length === 3, `(leu ${faixas.data?.length})`);

  // 4. O cálculo bate com a especificação. Mesma regra do `escada.ts`:
  //    vale a maior faixa alcançada, e o desconto em reais sai de CADA
  //    pacote.
  const unitario = q => {
    const f = (faixas.data ?? []).filter(x => x.min_qty <= q).sort((a, b) => b.min_qty - a.min_qty)[0];
    if (!f) return PRECO;
    const bruto = f.tipo === 'percentual' ? PRECO - Math.round((PRECO * f.valor) / 10000) : PRECO - f.valor;
    return Math.max(0, Math.min(PRECO, bruto));
  };
  const esperado = [[1, 2390, 2390], [2, 2290, 4580], [3, 2240, 6720], [4, 2190, 8760]];
  for (const [q, u, t] of esperado) {
    checar(`${q} pacote(s): R$ ${reais(u)} cada, total R$ ${reais(t)}`,
      unitario(q) === u && unitario(q) * q === t,
      `(veio ${reais(unitario(q))} / ${reais(unitario(q) * q)})`);
  }

  // 5. Economia do comprador.
  const economia4 = PRECO * 4 - unitario(4) * 4;
  checar(`levar 4 economiza R$ ${reais(economia4)}`, economia4 === 800, `(veio ${reais(economia4)})`);

  // 6. O piso do vendedor ALERTA, e nenhuma faixa aqui o fura.
  const furam = FAIXAS.map(f => f.min_qty).filter(q => unitario(q) < PISO);
  checar('nenhuma faixa fura o piso de R$ 20,00', furam.length === 0, `(furam ${furam})`);

  // 7. Estoque continua unitário: não existe SKU de kit.
  const kits = await admin.from('lv_products').select('slug')
    .like('slug', `${PRODUTO}%`).neq('slug', PRODUTO);
  checar('nenhum SKU de kit foi criado', kits.data.length === 0, `(achou ${kits.data.length})`);

  // 8. A loja publicada aparece e leva ao produto.
  const loja = await visitante.from('lv_stores').select('slug').eq('slug', LOJA);
  checar('a loja aparece para o visitante', loja.data.length === 1);
  const daLoja = await visitante.from('vw_lv_vitrine').select('slug').eq('loja_slug', LOJA);
  checar('o produto aparece na vitrine da loja', daLoja.data.length === 1);

  // 9. A busca acha.
  const busca = await visitante.rpc('lv_buscar_produtos', { termo: 'bancada' });
  checar('a busca encontra o produto', (busca.data ?? []).some(x => x.slug === PRODUTO));

  // 10. O visitante não escreve nada.
  const invasao = await visitante.from('lv_price_tiers').insert({ product_id: publico.data.id, min_qty: 9, tipo: 'reais', valor: 1 });
  checar('o visitante não cria faixa', !!invasao.error);
}

async function limpar(silencioso = false) {
  if (!silencioso) console.log('\n=== LIMPANDO ===');
  // Ordem importa: as faixas caem por cascade do produto, mas apagar na
  // mão deixa o resultado explícito.
  const { data: p } = await admin.from('lv_products').select('id').eq('slug', PRODUTO).maybeSingle();
  if (p) await admin.from('lv_price_tiers').delete().eq('product_id', p.id);
  await admin.from('lv_products').delete().eq('slug', PRODUTO);
  await admin.from('lv_stores').delete().eq('slug', LOJA);
  await admin.from('lv_sellers').delete().eq('nome_fantasia', VENDEDOR);
  if (!silencioso) ok('vendedor, loja, produto e faixas da bancada removidos');
}

const comando = process.argv[2] ?? 'ciclo';
if (comando === 'semear') await semear();
else if (comando === 'publicar') await publicar(true);
else if (comando === 'despublicar') await publicar(false);
else if (comando === 'aceite') await aceite();
else if (comando === 'limpar') await limpar();
else if (comando === 'ciclo') { await semear(); await aceite(); await limpar(); }
else { console.error('Comando desconhecido: ' + comando); process.exitCode = 1; }

if (comando === 'aceite' || comando === 'ciclo') {
  console.log(`\n${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
}
if (falhas) process.exitCode = 1;
