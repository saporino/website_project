// PREÇO POR CANAL — a bancada que prova que nada mudou.
//
// A pergunta que esta bancada responde não é "a tabela existe?". É esta:
// *o preço que a loja cobra hoje é exatamente o mesmo de antes da migration?*
// Preço é dinheiro real; "compilou" não vale como resposta.
//
// Ela compara, produto a produto, o preço que a loja B2C cobrava pela regra
// ANTIGA (products.price / promotional_price) com o que `preco_do_canal` devolve
// agora para o canal 'saporino'. Qualquer diferença é falha.
//
// E confere o isolamento: COFICO e marketplaces têm de voltar NÃO DEFINIDO
// enquanto ninguém tiver cadastrado preço neles — herdar o preço da Saporino é
// exatamente o defeito que a migration existe para corrigir.
//
//   node scripts/auditoria-precos-por-canal.mjs --producao

import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };
const brl = n => n === null || n === undefined ? '—' : 'R$ ' + Number(n).toFixed(2).replace('.', ',');

// A regra ANTIGA, escrita aqui à mão de propósito: se eu reusasse a função nova
// para calcular o esperado, o teste concordaria consigo mesmo e não provaria nada.
const regraAntiga = p => {
  const promo = Number(p.promotional_price ?? 0);
  const cheio = Number(p.price ?? 0);
  const emPromocao = promo > 0 && promo < cheio;
  return { preco_final: emPromocao ? promo : cheio, em_promocao: emPromocao };
};

const { data: produtos, error } = await db.from('products')
  .select('id,name,price,promotional_price,company_id,kit_of_product_id').order('name');
if (error) throw error;

const { data: linhas, error: e2 } = await db.from('vw_precos_por_canal').select('*');
if (e2) throw e2;
const porChave = new Map(linhas.map(l => [`${l.product_id}|${l.canal}`, l]));

console.log(`\n· ${produtos.length} produtos · ${linhas.length} combinações produto×canal\n`);

// ── 1. a loja B2C cobra exatamente o mesmo de antes ──────────────────────────
console.log('1. O preço da loja Saporino não mudou');
const divergentes = [];
for (const p of produtos) {
  const esperado = regraAntiga(p);
  const obtido = porChave.get(`${p.id}|saporino`);
  if (!obtido) { divergentes.push(`${p.name}: sem linha para o canal saporino`); continue; }
  // Produto com preço zero nunca foi vendável; a regra nova o marca como
  // indefinido, e isso é melhoria, não divergência.
  if (Number(p.price ?? 0) <= 0) continue;
  const mesmoValor = Number(obtido.preco_final) === Number(esperado.preco_final);
  const mesmaPromo = !!obtido.em_promocao === esperado.em_promocao;
  if (!mesmoValor || !mesmaPromo) {
    divergentes.push(`${p.name}: antes ${brl(esperado.preco_final)}${esperado.em_promocao ? ' (promo)' : ''} · agora ${brl(obtido.preco_final)}${obtido.em_promocao ? ' (promo)' : ''}`);
  }
}
checar(`todos os ${produtos.filter(p => Number(p.price ?? 0) > 0).length} produtos com preço cobram o mesmo valor de antes`,
  divergentes.length === 0, '\n      ' + divergentes.join('\n      '));

// ── 2. a promoção da Saporino não vazou ──────────────────────────────────────
console.log('\n2. O desconto da Saporino NÃO aparece nos outros canais');
const { count: quantosPrecosDeCanal } = await db
  .from('product_channel_prices').select('*', { count: 'exact', head: true });

const vazou = linhas.filter(l => l.canal !== 'saporino' && l.fonte === 'produto');
checar('nenhum canal herda preço do produto além da Saporino', vazou.length === 0,
  vazou.slice(0, 5).map(l => `${l.name} (${l.canal})`).join(', '));

const emPromocaoNaSaporino = linhas.filter(l => l.canal === 'saporino' && l.em_promocao);
const mesmosNaCofico = emPromocaoNaSaporino
  .map(l => porChave.get(`${l.product_id}|cofico`))
  .filter(l => l?.em_promocao);
checar(`os ${emPromocaoNaSaporino.length} produtos em promoção na loja não estão em promoção na COFICO`,
  mesmosNaCofico.length === 0, mesmosNaCofico.map(l => l.name).join(', '));

// ── 3. fail closed: sem preço, não vende ─────────────────────────────────────
console.log('\n3. Canal sem preço cadastrado volta NÃO DEFINIDO (não vende)');
if (quantosPrecosDeCanal === 0) {
  const indefinidosCofico = linhas.filter(l => l.canal === 'cofico' && !l.definido).length;
  const indefinidosMkt = linhas.filter(l => l.canal === 'marketplaces' && !l.definido).length;
  checar('COFICO: todos indefinidos (nenhum preço cadastrado ainda)', indefinidosCofico === produtos.length,
    `${indefinidosCofico} de ${produtos.length}`);
  checar('marketplaces: todos indefinidos', indefinidosMkt === produtos.length,
    `${indefinidosMkt} de ${produtos.length}`);
} else {
  const semPreco = linhas.filter(l => l.canal !== 'saporino' && !l.definido).length;
  console.log(`  --  ${quantosPrecosDeCanal} preço(s) de canal já cadastrados · ${semPreco} combinações ainda sem preço`);
  const definidosSemLinha = linhas.filter(l => l.canal !== 'saporino' && l.definido && l.fonte !== 'canal');
  checar('nenhum canal se declara definido sem linha própria', definidosSemLinha.length === 0,
    definidosSemLinha.map(l => `${l.name}/${l.canal}`).join(', '));
}

// ── 4. kits têm preço próprio, separado do café avulso ───────────────────────
console.log('\n4. Kit tem preço próprio, não o do café avulso');
const kits = produtos.filter(p => p.kit_of_product_id);
const kitsComPrecoProprio = kits.filter(k => {
  const base = produtos.find(p => p.id === k.kit_of_product_id);
  const lk = porChave.get(`${k.id}|saporino`);
  const lb = base && porChave.get(`${base.id}|saporino`);
  return lk?.definido && lb?.definido && Number(lk.preco_final) !== Number(lb.preco_final);
});
checar(`os ${kits.length} kits têm preço diferente do café avulso`,
  kits.length === 0 || kitsComPrecoProprio.length === kits.length,
  `${kitsComPrecoProprio.length} de ${kits.length}`);

// ── 5. o banco recusa preço inválido ─────────────────────────────────────────
console.log('\n5. O banco recusa preço que não faz sentido');
const alvo = produtos.find(p => Number(p.price ?? 0) > 0);
if (alvo) {
  const tentar = async (linha, oque) => {
    const { error } = await db.from('product_channel_prices').insert(linha);
    checar(oque, !!error, error ? '' : 'o banco ACEITOU — isto é um furo');
    if (!error) await db.from('product_channel_prices').delete().eq('product_id', alvo.id).eq('channel', linha.channel);
  };
  await tentar({ product_id: alvo.id, channel: 'saporino', price: -1 }, 'recusa preço negativo');
  await tentar({ product_id: alvo.id, channel: 'saporino', price: 10, promotional_price: 20 }, 'recusa promoção MAIOR que o preço');
  await tentar({ product_id: alvo.id, channel: 'repco', price: 10 }, 'recusa canal inexistente (RepCo usa price_lists)');

  // O dono vem do produto, não de quem escreve.
  const { data: criado } = await db.from('product_channel_prices')
    .insert({ product_id: alvo.id, channel: 'cofico', price: 99.99, company_id: null })
    .select('company_id').single();
  checar('o dono do preço é preenchido pelo banco a partir do produto',
    criado?.company_id === alvo.company_id, `veio ${criado?.company_id}`);

  // E agora a prova que importa: cadastrar preço na COFICO não mexe na Saporino.
  const { data: depois } = await db.from('vw_precos_por_canal')
    .select('canal,preco_final,fonte,definido').eq('product_id', alvo.id);
  const sapAntes = porChave.get(`${alvo.id}|saporino`);
  const sapDepois = depois.find(l => l.canal === 'saporino');
  const cofDepois = depois.find(l => l.canal === 'cofico');
  checar('cadastrar preço na COFICO NÃO altera o preço da loja Saporino',
    Number(sapDepois.preco_final) === Number(sapAntes.preco_final),
    `${brl(sapAntes.preco_final)} → ${brl(sapDepois.preco_final)}`);
  checar('o preço da COFICO passa a vir do canal, com o valor cadastrado',
    cofDepois.fonte === 'canal' && Number(cofDepois.preco_final) === 99.99,
    `fonte=${cofDepois.fonte} valor=${brl(cofDepois.preco_final)}`);

  await db.from('product_channel_prices').delete().eq('product_id', alvo.id).eq('channel', 'cofico');
  const { data: limpo } = await db.from('vw_precos_por_canal')
    .select('definido').eq('product_id', alvo.id).eq('canal', 'cofico').single();
  checar('apagar o preço devolve a COFICO para NÃO DEFINIDO', limpo.definido === false);
}

console.log(`\n${criterios - falhas}/${criterios} critérios${falhas ? ` — ${falhas} FALHA(S)` : ' — nenhum preço foi alterado'}`);
process.exit(falhas ? 1 : 0);
