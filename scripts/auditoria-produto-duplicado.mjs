// PRODUTO DUPLICADO ENTRE EMPRESAS — raio-X antes de qualquer decisão.
//
// "Tropeiro Paulista Tradicional" está cadastrado duas vezes: uma na CAFE SAPORINO
// e outra na COFICO Brasil, mesma foto. A ordem foi clara: NÃO APAGAR. Investigar
// os vínculos e apresentar o impacto.
//
// Este script é SOMENTE LEITURA. Ele não escreve, não apaga, não corrige. Para cada
// nome repetido em empresas diferentes, mostra de que lado estão os pedidos, os
// lotes, os kits, os preços e as listas de preço — que é o que decide se dá para
// consolidar e qual dos dois sobrevive.
//
//   node scripts/auditoria-produto-duplicado.mjs --producao   (leitura)

import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const chave = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const brl = n => 'R$ ' + Number(n ?? 0).toFixed(2).replace('.', ',');

const { data: empresas } = await db.from('companies').select('id,name,fantasia');
const nomeEmpresa = id => empresas?.find(e => e.id === id)?.fantasia || empresas?.find(e => e.id === id)?.name || id;

const { data: produtos, error } = await db.from('products')
  .select('id,name,company_id,price,promotional_price,is_active,hidden_from_store,sales_channels,kit_of_product_id,kit_quantity,sku,barcode,image_url,created_at')
  .order('created_at');
if (error) throw error;

// Agrupa por nome. Duplicata é o mesmo nome em MAIS DE UMA empresa — dois produtos
// de nomes iguais na mesma empresa é outro problema, e também aparece aqui.
const grupos = new Map();
for (const p of produtos) {
  const k = chave(p.name);
  (grupos.get(k) ?? grupos.set(k, []).get(k)).push(p);
}

const repetidos = [...grupos.values()].filter(g => g.length > 1);
if (!repetidos.length) {
  console.log('\nNenhum nome de produto repetido. Nada a decidir.');
  process.exit(0);
}

console.log(`\n${repetidos.length} nome(s) de produto aparecem mais de uma vez.\n`);

for (const grupo of repetidos) {
  console.log('═'.repeat(78));
  console.log(`  ${grupo[0].name}`);
  console.log('═'.repeat(78));

  for (const p of grupo) {
    // Tudo o que amarra este produto. Se qualquer um destes for > 0, apagar deixa
    // rastro: pedido sem item, lote sem café, kit órfão.
    const conta = async (tabela, coluna) => {
      const { count, error: e } = await db.from(tabela)
        .select('*', { count: 'exact', head: true }).eq(coluna, p.id);
      return e ? `? (${e.code})` : (count ?? 0);
    };
    const [pedidosB2C, pedidosB2B, lotes, kits, listas] = await Promise.all([
      conta('order_items', 'product_id'),
      conta('representative_order_items', 'product_id'),
      conta('green_coffee_lots', 'product_id'),
      conta('products', 'kit_of_product_id'),
      conta('price_lists', 'product_id'),
    ]);

    console.log(`\n  ▸ ${nomeEmpresa(p.company_id)}   ${p.id}`);
    console.log(`    criado em ....... ${String(p.created_at).slice(0, 10)}`);
    console.log(`    preço ........... ${brl(p.price)}${p.promotional_price ? ` (promo ${brl(p.promotional_price)})` : ''}`);
    console.log(`    estado .......... ${p.is_active ? 'ativo' : 'INATIVO'}${p.hidden_from_store ? ' · oculto na loja' : ''}`);
    console.log(`    canais .......... ${(p.sales_channels ?? []).join(', ') || '(nenhum)'}`);
    console.log(`    sku/barras ...... ${p.sku || '—'} / ${p.barcode || '—'}`);
    console.log(`    VÍNCULOS:`);
    console.log(`      pedidos da loja ......... ${pedidosB2C}`);
    console.log(`      pedidos do RepCo ........ ${pedidosB2B}`);
    console.log(`      lotes de café verde ..... ${lotes}`);
    console.log(`      kits que dependem dele .. ${kits}`);
    console.log(`      listas de preço B2B ..... ${listas}`);

    const preso = [pedidosB2C, pedidosB2B, lotes, kits, listas]
      .filter(n => typeof n === 'number' && n > 0).length;
    console.log(`    → ${preso === 0
      ? 'SEM VÍNCULO: apagar não deixaria rastro.'
      : 'TEM VÍNCULO: apagar quebraria histórico. Só consolidando.'}`);
  }

  // Mesma foto costuma significar "cópia", não "produto diferente de mesmo nome".
  const fotos = new Set(grupo.map(p => p.image_url));
  console.log(`\n  Fotos distintas no grupo: ${fotos.size}${fotos.size === 1 ? ' (mesma foto — é cópia)' : ''}`);
  console.log(`  Empresas envolvidas: ${[...new Set(grupo.map(p => nomeEmpresa(p.company_id)))].join(' · ')}\n`);
}

console.log('═'.repeat(78));
console.log('Leitura apenas. Nada foi alterado.');
