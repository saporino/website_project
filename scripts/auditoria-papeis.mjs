// AUDITORIA DE PAPÉIS — cada um enxerga só o que é dele?
//
// Pergunta do Vlademir (09/10/2026): "o cliente B2C só compra na loja, o perfil dele não tem
// nada a ver com o RepCo. E o representante só vê a venda dele, o pedido dele, a comissão
// dele. Está assim?"
//
// A bancada monta o cenário real e tenta atravessar: dois representantes com cliente, pedido
// e comissão cada um, e um cliente da loja com o pedido dele. Depois cada um tenta ler e
// mexer no do outro. Tudo apagado no fim.
//
//   node scripts/auditoria-papeis.mjs
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

let falhas = 0, criterios = 0, inconclusivos = 0;
const checar = (t, ok, d = '') => { criterios++; if (ok) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

/**
 * "Não consegue ler X" só vale se X TEM o que ler. Numa tabela vazia o teste passa sozinho
 * e esconde o buraco — foi o que aconteceu aqui com price_lists, que o representante na
 * verdade lê de propósito. Sem linha para ler, o critério é marcado inconclusivo, nunca ok.
 */
async function naoLe(cli, tabela, rotulo, oque) {
  const { count } = await admin.from(tabela).select('*', { count: 'exact', head: true });
  if (!count) { inconclusivos++; console.log(`  ??  ${rotulo} · ${tabela} (${oque}) — tabela vazia, teste não prova nada`); return; }
  const { data } = await cli.from(tabela).select('*').limit(1);
  checar(`${rotulo} não lê ${tabela} (${oque})`, !data?.length, `leu ${data?.length} de ${count} linha(s)`);
}

const usuarios = [], limpar = [];
async function entrar(rotulo) {
  const email = `aud-papel-${rotulo}-${crypto.randomBytes(4).toString('hex')}@coffeelivre.test`;
  const senha = crypto.randomBytes(20).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
  usuarios.push(data.user.id);
  const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cli.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`${rotulo} login: ${el.message}`);
  return { cli, id: data.user.id, email };
}

async function montarRep(nome) {
  const u = await entrar(nome);
  const { data: rep, error } = await admin.from('representatives').insert({
    user_id: u.id, full_name: `Rep ${nome}`, email: u.email,
    cpf: String(Math.floor(Math.random() * 1e11)).padStart(11, '0'),
    commission_rate: 5, status: 'active',
  }).select('id').single();
  if (error) throw new Error(`rep ${nome}: ${error.message}`);
  limpar.push(['representatives', rep.id]);

  const { data: cliente, error: ec } = await admin.from('representative_clients').insert({
    representative_id: rep.id, razao_social: `Cliente do ${nome}`, nome_fantasia: `Cliente ${nome}`,
    // a tabela exige documento: cliente sem CPF/CNPJ não existe no RepCo
    cnpj: String(Math.floor(Math.random() * 1e14)).padStart(14, '0'),
  }).select('id').single();
  if (ec) throw new Error(`cliente ${nome}: ${ec.message}`);

  const { data: pedido, error: ep } = await admin.from('representative_orders').insert({
    representative_id: rep.id, representative_client_id: cliente.id, order_number: `AUD-${nome}-${Date.now() % 100000}`,
    total_amount: 1000, status: 'pending',
  }).select('id').single();
  if (ep) throw new Error(`pedido ${nome}: ${ep.message}`);

  const { error: ecm } = await admin.from('representative_commissions').insert({
    representative_id: rep.id, order_id: pedido.id, order_amount: 1000, total_rate: 5, commission_amount: 50,
  });
  if (ecm) throw new Error(`comissão ${nome}: ${ecm.message}`);

  return { ...u, repId: rep.id, clienteId: cliente.id, pedidoId: pedido.id };
}

/** Põe uma linha na tabela se ela estiver vazia, para o teste de bloqueio ter o que provar. */
async function semearSeVazio(tabela, linha) {
  const { count } = await admin.from(tabela).select('*', { count: 'exact', head: true });
  if (count) return;
  const { data, error } = await admin.from(tabela).insert(linha).select('id').single();
  if (error) { console.log(`  ·   não deu para semear ${tabela}: ${error.message}`); return; }
  limpar.push([tabela, data.id]);
}

try {
  const A = await montarRep('A');
  const B = await montarRep('B');
  const loja = await entrar('loja');

  // Sem isto, "não consegue ler" passa em tabela vazia e o verde é falso.
  await semearSeVazio('embalagem_custos', {
    fornecedor: 'AUDITORIA', linha: 'stand up', descricao: 'Item de auditoria', preco_milheiro: 100,
  });
  await semearSeVazio('prospects_b2b', { razao_social: 'Prospect de auditoria', cnpj: '00000000000191' });
  await semearSeVazio('green_coffee_lots', { batch_number: 'AUD-LOTE-001' });
  await semearSeVazio('studio_social_connections', { platform: 'instagram', account_name: '@auditoria', status: 'expired' });

  // price_lists e payouts dependem de produto e comissão existirem
  const { data: prodAud } = await admin.from('products')
    .insert({ name: 'Produto auditoria papéis', price: 10, is_active: false }).select('id').single();
  if (prodAud) {
    limpar.push(['products', prodAud.id]);
    await semearSeVazio('price_lists', { product_id: prodAud.id, segment: 'distribuidora', price: 20 });
  }
  // Um pagamento para CADA rep: o teste não é "o rep não vê pagamento" (ele vê o dele, na
  // aba Pagas) e sim "o rep não vê o pagamento do vizinho".
  const payoutDe = {};
  for (const r of [A, B]) {
    const { data: com } = await admin.from('representative_commissions')
      .select('id').eq('representative_id', r.repId).maybeSingle();
    if (!com) continue;
    const { data: pay } = await admin.from('representative_commission_payouts')
      .insert({ commission_id: com.id, representative_id: r.repId, amount: 50 }).select('id').single();
    if (pay) { payoutDe[r.repId] = pay.id; limpar.push(['representative_commission_payouts', pay.id]); }
  }

  const { data: pedidoDaLoja, error: epl } = await admin.from('orders').insert({
    order_number: `AUD-B2C-${Date.now() % 100000}`, total_amount: 80,
    customer_name: 'Cliente da loja', customer_email: loja.email, user_id: loja.id,
  }).select('id').single();
  if (epl) throw new Error('pedido da loja: ' + epl.message);
  limpar.push(['orders', pedidoDaLoja.id]);

  // ---------------------------------------------------- o representante vê o que é dele
  console.log('\n— representante A —');
  const meus = async (tabela, campo, valor) =>
    (await A.cli.from(tabela).select('id').eq(campo, valor)).data?.length ?? 0;

  checar('vê o próprio pedido', await meus('representative_orders', 'id', A.pedidoId) === 1);
  checar('vê o próprio cliente', await meus('representative_clients', 'id', A.clienteId) === 1);
  checar('vê a própria comissão',
    ((await A.cli.from('representative_commissions').select('id').eq('representative_id', A.repId)).data?.length ?? 0) === 1);
  if (payoutDe[A.repId]) checar('vê o próprio pagamento (aba Pagas)',
    ((await A.cli.from('representative_commission_payouts').select('id').eq('id', payoutDe[A.repId])).data?.length ?? 0) === 1);

  console.log('\n— e não enxerga o do vizinho —');
  checar('não vê o pedido do representante B', await meus('representative_orders', 'id', B.pedidoId) === 0);
  checar('não vê o cliente do representante B', await meus('representative_clients', 'id', B.clienteId) === 0);
  checar('não vê a comissão do representante B',
    ((await A.cli.from('representative_commissions').select('id').eq('representative_id', B.repId)).data?.length ?? 0) === 0);
  checar('não vê o cadastro do representante B',
    ((await A.cli.from('representatives').select('id').eq('id', B.repId)).data?.length ?? 0) === 0);
  checar('não vê o pedido da loja (B2C)',
    ((await A.cli.from('orders').select('id').eq('id', pedidoDaLoja.id)).data?.length ?? 0) === 0);
  if (payoutDe[B.repId]) checar('não vê o pagamento do representante B',
    ((await A.cli.from('representative_commission_payouts').select('id').eq('id', payoutDe[B.repId])).data?.length ?? 0) === 0);

  console.log('\n— nem o que é do admin —');
  // price_lists NÃO entra: o representante lê de propósito, senão não monta pedido.
  // Mas o PAYOUT dele é dado do admin — o rep vê "Pagas" por outra tabela.
  for (const [tabela, oque] of [
    ['green_coffee_lots', 'custo do café verde'],
    ['embalagem_custos', 'custo de embalagem'],
    ['prospects_b2b', 'base de prospecção'],
    ['studio_social_connections', 'tokens das redes'],
  ]) await naoLe(A.cli, tabela, 'representante', oque);

  // o pedido do vizinho também não pode ser alterado nem apagado
  await A.cli.from('representative_orders').update({ total_amount: 1 }).eq('id', B.pedidoId);
  const { data: pedidoB } = await admin.from('representative_orders').select('total_amount').eq('id', B.pedidoId).single();
  checar('não altera o pedido do representante B', Number(pedidoB.total_amount) === 1000, `virou ${pedidoB.total_amount}`);
  await A.cli.from('representative_orders').delete().eq('id', B.pedidoId);
  checar('não apaga o pedido do representante B',
    !!(await admin.from('representative_orders').select('id').eq('id', B.pedidoId).maybeSingle()).data);

  // ------------------------------------------------------------- o cliente da loja
  console.log('\n— cliente da loja (B2C) —');
  checar('vê o próprio pedido da loja',
    ((await loja.cli.from('orders').select('id').eq('id', pedidoDaLoja.id)).data?.length ?? 0) === 1);
  for (const [tabela, oque] of [
    ['representative_orders', 'pedidos do RepCo'],
    ['representative_clients', 'clientes dos representantes'],
    ['representatives', 'cadastro dos representantes'],
    ['representative_commissions', 'comissões'],
    ['price_lists', 'tabela de preço B2B'],
    ['green_coffee_lots', 'custo do café verde'],
    ['embalagem_custos', 'custo de embalagem'],
  ]) await naoLe(loja.cli, tabela, 'cliente da loja', oque);
  const { data: ehAdmin } = await loja.cli.rpc('is_admin');
  const { data: repDaLoja } = await loja.cli.rpc('my_rep_id');
  checar('cliente da loja não é admin nem representante', ehAdmin !== true && !repDaLoja);

  // O admin passou a enxergar todos os cadastros (senão a aba Clientes fica cega). O cliente
  // NÃO pode ter ganhado isso junto — é o lado da moeda que precisa continuar fechado.
  const { data: perfisQueOClienteVe } = await loja.cli.from('user_profiles').select('id');
  const deOutros = (perfisQueOClienteVe ?? []).filter(p => p.id !== loja.id);
  checar('cliente da loja lê só o próprio perfil', deOutros.length === 0,
    `leu ${deOutros.length} perfil(is) de outras pessoas`);
  const { data: perfisQueORepVe } = await A.cli.from('user_profiles').select('id');
  checar('representante lê só o próprio perfil',
    (perfisQueORepVe ?? []).filter(p => p.id !== A.id).length === 0);
} finally {
  for (const [tabela, id] of limpar.reverse()) await admin.from(tabela).delete().eq('id', id);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
}

console.log(`\n${criterios - falhas}/${criterios} critérios` +
  (inconclusivos ? ` · ${inconclusivos} inconclusivo(s): tabela vazia, nada provado` : ''));
process.exitCode = falhas ? 1 : 0;
