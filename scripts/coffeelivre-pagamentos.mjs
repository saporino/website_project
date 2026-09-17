// Coffee LiVRE — bancada de PAGAMENTOS (Unidade 9.1), só no staging.
//
// Exercita as Edge Functions publicadas no staging (lv-mp-*) com JWT real de cada
// papel, o provedor MOCK e notificações ASSINADAS como o Mercado Pago faria:
//   OAuth do vendedor e isolamento de tokens · cobrança por subpedido (Split 1:1) ·
//   idempotência · webhook duplicado e fora de ordem · aprovado, recusado, expirado,
//   cancelado · pagamento tardio · reembolso e reembolso duplicado · estoque ·
//   application_fee, taxa estimada × real, frete na base · reconciliação convergente e
//   divergência · RLS de vendedor, comprador e admin · segredos fora das respostas.
// Nenhum dinheiro, nenhuma conta Mercado Pago real. Tudo é apagado no fim.
//
// Uso: node scripts/coffeelivre-pagamentos.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar, REF_PRODUCAO } from './_ambiente.mjs';
import { assinar } from '../supabase/functions/_shared/lvMp/assinatura.ts';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
const anonimo = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });
const SEGREDO_MOCK = env.LV_MP_TESTE_MOCK_WEBHOOK_SECRET;
if (!SEGREDO_MOCK) { console.error('LV_MP_TESTE_MOCK_WEBHOOK_SECRET ausente em .env.staging'); process.exit(2); }

const MARCA = 'teste-pagto';
const EMAIL = r => `${MARCA}-${r}@coffeelivre.test`;
let falhas = 0, criterios = 0;
const ok = t => { criterios++; console.log('  ok  ' + t); };
const erro = t => { criterios++; falhas++; console.log('  !!  ' + t); };
const checar = (r, c, d = '') => (c ? ok(r) : erro(`${r} ${d}`));
const secao = t => console.log(`\n=== ${t} ===`);
const futuro = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const passado = () => new Date(Date.now() - 60000).toISOString();

// ---------------------------------------------------------------- utilidades
async function usuario(rotulo, { ehAdmin = false } = {}) {
  const email = EMAIL(rotulo);
  const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
  if (ehAdmin) await admin.from('user_profiles').upsert({ id: data.user.id, full_name: 'Admin pagto', is_admin: true });
  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { data: s, error: el } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`login ${rotulo}: ${el.message}`);
  return { id: data.user.id, email, cliente, token: s.session.access_token };
}

async function fn(nome, corpo, token = env.VITE_SUPABASE_ANON_KEY, extras = {}) {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${nome}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extras },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  let json = {};
  try { json = JSON.parse(texto); } catch { json = { bruto: texto }; }
  return { status: r.status, json, texto };
}

async function webhook(mpPaymentId, { requestId = crypto.randomUUID(), assinaturaErrada = false } = {}) {
  const ts = String(Date.now());
  const xs = await assinar(assinaturaErrada ? 'segredo-errado' : SEGREDO_MOCK, mpPaymentId, requestId, ts);
  return fn('lv-mp-webhook', { type: 'payment', action: 'payment.updated', data: { id: mpPaymentId }, live_mode: false, user_id: 'mock' },
    env.VITE_SUPABASE_ANON_KEY, { 'x-signature': xs, 'x-request-id': requestId });
}

const lote = async id => (await admin.from('lv_inventory_lots').select('qtd_disponivel, qtd_reservada').eq('id', id).single()).data;
const cobrancasDo = async orderId => (await admin.from('lv_cobrancas').select('*').eq('order_id', orderId).order('criado_em')).data ?? [];
const cobranca = async id => (await admin.from('lv_cobrancas').select('*').eq('id', id).single()).data;

async function remotoAprovar(c, extra = {}) {
  const fee = Math.floor((Number(c.valor_cents) * (c.metodo === 'pix' ? 99 : 498) + 5000) / 10000) + 3;
  await admin.from('lv_mp_mock_remoto').update({
    status: 'approved', status_detail: 'accredited', processor_fee_cents: fee,
    net_received_cents: Number(c.valor_cents) - fee - Number(c.application_fee_cents), atualizado_em: new Date().toISOString(), ...extra,
  }).eq('mp_payment_id', c.mp_payment_id);
  return fee;
}

async function limpar() {
  const { data: pedidos } = await admin.from('lv_orders').select('id').like('comprador_email', `${MARCA}%`);
  if (pedidos?.length) await admin.from('lv_orders').delete().in('id', pedidos.map(p => p.id));
  const { data: lojas } = await admin.from('lv_stores').select('id, seller_id').like('slug', `${MARCA}%`);
  for (const l of lojas ?? []) {
    await admin.rpc('lv_mp_desconectar', { p_seller: l.seller_id });   // apaga os segredos do Vault
    await admin.from('lv_products').delete().eq('store_id', l.id);
    await admin.from('lv_stores').delete().eq('id', l.id);
    await admin.from('lv_sellers').delete().eq('id', l.seller_id);
  }
  await admin.from('lv_mp_webhook_eventos').delete().like('request_id', `${MARCA}%`);
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    for (const u of (data?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(u.id);
    if (!data?.users || data.users.length < 200) break;
  }
}

async function vendedor(letra, usuarioVendedor, cat, produto) {
  const { data: s } = await admin.from('lv_sellers').insert({ nome_fantasia: `${MARCA} ${letra}`, tipo: 'torrefacao', status: 'aprovado', is_demo: true }).select('id').single();
  const { data: l } = await admin.from('lv_stores').insert({ seller_id: s.id, slug: `${MARCA}-loja-${letra.toLowerCase()}`, nome: `Pagto ${letra}`, cor: '#35506B', iniciais: 'P' + letra, ativa: true, is_demo: true }).select('id').single();
  const { data: p } = await admin.from('lv_products').insert({
    store_id: l.id, seller_id: s.id, category_id: cat, slug: `${MARCA}-${letra.toLowerCase()}-cafe`, titulo: produto.titulo, marca: 'Teste',
    preco_cents: produto.preco, preco_minimo_cents: produto.piso, peso_g: produto.peso, venda_por_quantidade: false, status: 'ativo', is_demo: true,
  }).select('id').single();
  const { data: v } = await admin.from('lv_product_variants').select('id').eq('product_id', p.id).eq('padrao', true).single();
  await admin.from('lv_product_variants').update({ gramatura_g: produto.peso }).eq('id', v.id);
  const { data: lt } = await admin.from('lv_inventory_lots').insert({ variant_id: v.id, lote: `PG-${letra}`, validade: futuro(120), qtd_disponivel: 20, is_demo: true }).select('id').single();
  await admin.from('lv_seller_users').insert({ seller_id: s.id, user_id: usuarioVendedor.id });
  return { sellerId: s.id, variante: v.id, loteId: lt.id };
}

const COMPRADOR = { nome: 'Comprador Pagamento', telefone: '', cpf: '' };
const ENDERECO = { destinatario: '', cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', referencia: '' };

async function pedido(cliente, itens, metodo = 'pix') {
  const ini = await cliente.rpc('lv_checkout_iniciar', { p_itens: itens, p_chave: crypto.randomUUID() });
  if (ini.error) throw new Error('checkout: ' + ini.error.message);
  const conf = await cliente.rpc('lv_checkout_confirmar', { p_checkout: ini.data.checkout_id, p_comprador: COMPRADOR, p_endereco: ENDERECO, p_frete: 'demo_padrao', p_pagamento: metodo });
  if (conf.error) throw new Error('confirmar: ' + conf.error.message);
  return conf.data;
}

// ---------------------------------------------------------------- ciclo
async function ciclo() {
  secao('PREPARANDO');
  await limpar();
  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();
  const [uA, uB, c1, c2, adm] = await Promise.all([usuario('vend-a'), usuario('vend-b'), usuario('comprador1'), usuario('comprador2'), usuario('admin', { ehAdmin: true })]);
  const A = await vendedor('A', uA, cat.id, { titulo: 'Café Tradicional 500 g', preco: 2490, piso: 2000, peso: 500 });
  const B = await vendedor('B', uB, cat.id, { titulo: 'Café Especial 250 g', preco: 3990, piso: 3000, peso: 250 });
  ok('2 vendedores com usuário, 2 compradores e 1 admin temporário');

  const cfg = await fn('lv-mp-pagamento', { acao: 'config' });
  checar('config pública: ambiente de teste, provedor mock, sem segredo na resposta',
    cfg.json.ambiente === 'teste' && cfg.json.provedor === 'mock' && cfg.json.ativo === true && !/secret|access_token|refresh/i.test(cfg.texto), `(${cfg.texto})`);

  // ------------------------------------------------------------ OAuth
  secao('OAUTH DO VENDEDOR (MOCK) E ISOLAMENTO DE TOKENS');
  const est0 = await fn('lv-mp-conexao', { acao: 'estado' }, uA.token);
  checar('antes: vendedor A não conectado', est0.json.conexao?.status === 'nao_conectado', `(${est0.texto})`);
  const iniA = await fn('lv-mp-conexao', { acao: 'iniciar', retorno: 'https://staging.coffeelivre.test/coffeelivre/vendedor/financeiro' }, uA.token);
  const urlA = new URL(iniA.json.url ?? 'https://x.test');
  checar('iniciar devolve URL de retorno com code e state (mock)', !!urlA.searchParams.get('code') && !!urlA.searchParams.get('state'), `(${iniA.texto})`);
  const roubo = await fn('lv-mp-conexao', { acao: 'callback', code: urlA.searchParams.get('code'), state: urlA.searchParams.get('state') }, uB.token);
  checar('vendedor B não consegue usar o state de A', roubo.json.codigo === 'OAUTH_ESTADO_INVALIDO', `(${roubo.texto})`);
  const cbA = await fn('lv-mp-conexao', { acao: 'callback', code: urlA.searchParams.get('code'), state: urlA.searchParams.get('state') }, uA.token);
  checar('callback conecta A, e o state usado por B antes não foi consumido indevidamente', cbA.json.status === 'conectado', `(${cbA.texto})`);
  const repete = await fn('lv-mp-conexao', { acao: 'callback', code: urlA.searchParams.get('code'), state: urlA.searchParams.get('state') }, uA.token);
  checar('state é de uso único', repete.json.codigo === 'OAUTH_ESTADO_INVALIDO');
  const iniCb = await fn('lv-mp-conexao', { acao: 'iniciar', retorno: 'https://staging.coffeelivre.test/coffeelivre/vendedor/mp/callback' }, uA.token);
  const urlCb = new URL(iniCb.json.url ?? 'https://x.test');
  checar('retorno usa a rota canônica /coffeelivre/vendedor/mp/callback', urlCb.pathname === '/coffeelivre/vendedor/mp/callback', `(${iniCb.texto})`);
  await admin.from('lv_mp_oauth_estados').update({ expira_em: new Date(Date.now() - 60000).toISOString() }).is('usado_em', null);
  const expirado = await fn('lv-mp-conexao', { acao: 'callback', code: urlCb.searchParams.get('code'), state: urlCb.searchParams.get('state') }, uA.token);
  checar('state expirado é recusado', expirado.json.codigo === 'OAUTH_ESTADO_INVALIDO', `(${expirado.texto})`);
  const semEstado = await fn('lv-mp-conexao', { acao: 'callback', code: 'mockcode_inventado', state: 'state-inventado' }, uA.token);
  checar('state inventado (replay/forja) é recusado', semEstado.json.codigo === 'OAUTH_ESTADO_INVALIDO', `(${semEstado.texto})`);
  const iniB = await fn('lv-mp-conexao', { acao: 'iniciar', retorno: 'https://staging.coffeelivre.test/cb' }, uB.token);
  const urlB = new URL(iniB.json.url);
  await fn('lv-mp-conexao', { acao: 'callback', code: urlB.searchParams.get('code'), state: urlB.searchParams.get('state') }, uB.token);
  const estA = await fn('lv-mp-conexao', { acao: 'estado' }, uA.token);
  checar('estado de A: conectado, com user id, escopos e expiração — e nenhum token na resposta',
    estA.json.conexao?.status === 'conectado' && !!estA.json.conexao?.mp_user_id && estA.json.conexao?.escopos?.length > 0
    && !!estA.json.conexao?.expira_em && !/mock_access_|mock_refresh_|access_token|refresh_token/.test(estA.texto), `(${estA.texto})`);
  const conexoesA = await uA.cliente.from('lv_mp_conexoes').select('seller_id');
  checar('vendedor A só lê a própria conexão', conexoesA.data?.length === 1 && conexoesA.data[0].seller_id === A.sellerId);
  const credA = await uA.cliente.from('lv_mp_credenciais').select('*');
  const credB = await uB.cliente.rpc('lv_mp_credencial_ler', { p_seller: A.sellerId });
  const vaultA = await uA.cliente.schema('vault').from('decrypted_secrets').select('decrypted_secret').limit(1);
  checar('nenhum vendedor lê credencial: tabela sem permissão, função de leitura fechada, Vault inacessível',
    (!!credA.error || credA.data?.length === 0) && !!credB.error && (!!vaultA.error || vaultA.data?.length === 0));
  const serv = await admin.rpc('lv_mp_credencial_ler', { p_seller: A.sellerId });
  checar('só o serviço lê o token (guardado no Vault, não em coluna)', typeof serv.data?.access_token === 'string' && serv.data.access_token.startsWith('mock_access_'));

  // ------------------------------------------------------------ cobrança multiloja
  secao('COBRANÇA POR SUBPEDIDO (SPLIT 1:1)');
  const antesA = await lote(A.loteId);
  const antesB = await lote(B.loteId);
  const ped = await pedido(c1.cliente, [{ variant_id: A.variante, quantidade: 2 }, { variant_id: B.variante, quantidade: 3 }]);
  const criar1 = await fn('lv-mp-pagamento', { acao: 'criar', order_id: ped.order_id, metodo: 'pix' }, c1.token);
  const cobs = await cobrancasDo(ped.order_id);
  checar('pedido multiloja gera 2 pagamentos separados, um por vendedor', cobs.length === 2 && new Set(cobs.map(c => c.seller_id)).size === 2
    && new Set(cobs.map(c => c.mp_payment_id)).size === 2 && criar1.json.falhas?.length === 0, `(${criar1.texto.slice(0, 200)})`);
  checar('Pix de teste: QR claramente fictício e expiração', cobs.every(c => c.pix_qr_code?.startsWith('TESTE-SEM-VALOR') && c.expira_em && c.status === 'aguardando_pagamento'));
  const criar2 = await fn('lv-mp-pagamento', { acao: 'criar', order_id: ped.order_id, metodo: 'pix' }, c1.token);
  const cobs2 = await cobrancasDo(ped.order_id);
  const { count: remotos } = await admin.from('lv_mp_mock_remoto').select('mp_payment_id', { count: 'exact', head: true }).in('cobranca_id', cobs.map(c => c.id));
  checar('criar de novo é idempotente: mesmas cobranças, nenhum pagamento duplicado no provedor',
    criar2.status === 200 && cobs2.length === 2 && cobs2.every(c => cobs.some(x => x.id === c.id && x.mp_payment_id === c.mp_payment_id)) && remotos === 2);
  const { data: subs } = await admin.from('lv_seller_orders').select('*').eq('order_id', ped.order_id);
  const cA = cobs.find(c => c.seller_id === A.sellerId);
  const cB = cobs.find(c => c.seller_id === B.sellerId);
  const sA = subs.find(s => s.seller_id === A.sellerId);
  checar('valor da cobrança = total do subpedido (produtos + frete)', Number(cA.valor_cents) === Number(sA.total_cents)
    && Number(cA.valor_cents) === Number(cA.produtos_cents) + Number(cA.frete_cents));
  checar('application_fee = comissão + tarifa + frete do CD (congelados do subpedido)',
    Number(cA.application_fee_cents) === Number(sA.comissao_plataforma_cents) + Number(sA.tarifa_operacional_cents) + Number(sA.frete_cents));
  checar('taxa do processador ESTIMADA sobre o valor total (frete na base), real ainda desconhecida',
    Number(cA.processor_fee_estimada_cents) === Math.floor((Number(cA.valor_cents) * 99 + 5000) / 10000)
    && cA.processor_fee_real_cents === null && cA.processor_fee_base === 'valor_total_estimado');
  checar('líquido estimado do vendedor = valor − taxa estimada − application_fee',
    Number(cA.liquido_seller_estimado_cents) === Number(cA.valor_cents) - Number(cA.processor_fee_estimada_cents) - Number(cA.application_fee_cents));

  // ------------------------------------------------------------ RLS
  secao('RLS DAS COBRANÇAS');
  const vA = await uA.cliente.from('lv_cobrancas').select('seller_id').eq('order_id', ped.order_id);
  const vB = await uB.cliente.from('lv_cobrancas').select('seller_id').eq('order_id', ped.order_id);
  checar('vendedor A vê só a cobrança dele; B só a dele', vA.data?.length === 1 && vA.data[0].seller_id === A.sellerId && vB.data?.length === 1 && vB.data[0].seller_id === B.sellerId);
  checar('comprador vê as 2 cobranças do próprio pedido; outro comprador e anônimo, nada',
    (await c1.cliente.from('lv_cobrancas').select('id').eq('order_id', ped.order_id)).data?.length === 2
    && (await c2.cliente.from('lv_cobrancas').select('id').eq('order_id', ped.order_id)).data?.length === 0
    && ((await anonimo.from('lv_cobrancas').select('id').limit(1)).data?.length ?? 0) === 0);
  checar('comprador não chama a função que aplica status nem vê eventos de webhook',
    !!(await c1.cliente.rpc('lv_cobranca_aplicar', { p_cobranca: cA.id, p_remoto: { status: 'approved' }, p_origem: 'admin' })).error
    && ((await c1.cliente.from('lv_mp_webhook_eventos').select('id').limit(1)).data?.length ?? 0) === 0);
  checar('vendedor e comprador não reconciliam nem reembolsam', (await fn('lv-mp-reconciliar', {}, uA.token)).status === 403
    && (await fn('lv-mp-reembolso', { cobranca_id: cA.id }, c1.token)).status === 403);

  // ------------------------------------------------------------ webhook
  secao('WEBHOOK ASSINADO');
  const invalido = await webhook(cA.mp_payment_id, { requestId: `${MARCA}-invalido`, assinaturaErrada: true });
  checar('assinatura inválida: 401, registrada e nada processado', invalido.status === 401
    && (await cobranca(cA.id)).status === 'aguardando_pagamento'
    && (await admin.from('lv_mp_webhook_eventos').select('assinatura_valida').eq('request_id', `${MARCA}-invalido`).single()).data?.assinatura_valida === false);
  const feeReal = await remotoAprovar(cA);
  const reqA = `${MARCA}-${crypto.randomUUID()}`;
  const w1 = await webhook(cA.mp_payment_id, { requestId: reqA });
  const depoisA = await cobranca(cA.id);
  checar('aprovado pelo webhook: cobrança aprovada com taxa REAL diferente da estimada', w1.status === 200 && depoisA.status === 'aprovado'
    && Number(depoisA.processor_fee_real_cents) === feeReal && Number(depoisA.processor_fee_real_cents) !== Number(depoisA.processor_fee_estimada_cents)
    && Number(depoisA.liquido_seller_real_cents) === Number(depoisA.valor_cents) - feeReal - Number(depoisA.application_fee_cents), `(${w1.texto})`);
  checar('subpedido A confirmado e estoque de A baixado; pedido pai segue aguardando B',
    (await admin.from('lv_seller_orders').select('status').eq('id', sA.id).single()).data.status === 'confirmado'
    && (await lote(A.loteId)).qtd_reservada === antesA.qtd_reservada && (await lote(A.loteId)).qtd_disponivel === antesA.qtd_disponivel - 2
    && (await admin.from('lv_orders').select('status').eq('id', ped.order_id).single()).data.status === 'aguardando_pagamento');
  const w2 = await webhook(cA.mp_payment_id, { requestId: reqA });
  const w3 = await webhook(cA.mp_payment_id, { requestId: `${MARCA}-${crypto.randomUUID()}` });
  const { data: evAprov } = await admin.from('lv_order_events').select('id').eq('seller_order_id', sA.id).eq('tipo', 'cobranca_aprovada');
  checar('webhook duplicado (mesmo request-id) ignorado; reenvio com outro request-id não aprova de novo',
    w2.json.duplicado === true && w3.status === 200 && evAprov?.length === 1 && (await lote(A.loteId)).qtd_disponivel === antesA.qtd_disponivel - 2);
  await admin.from('lv_mp_mock_remoto').update({ status: 'pending', status_detail: 'pending_waiting_transfer' }).eq('mp_payment_id', cA.mp_payment_id);
  await webhook(cA.mp_payment_id, { requestId: `${MARCA}-${crypto.randomUUID()}` });
  const regressao = await cobranca(cA.id);
  checar('webhook fora de ordem (pendente depois de aprovado) não rebaixa e marca divergência', regressao.status === 'aprovado'
    && regressao.precisa_atencao === true && /não aplicado/.test(regressao.divergencia ?? ''));
  await remotoAprovar(cA);

  // ------------------------------------------------------------ reconciliação
  secao('RECONCILIAÇÃO');
  await remotoAprovar(cB);   // pagamento feito, mas o webhook "se perdeu"
  checar('antes: B pago no provedor e pendente no Coffee LiVRE (divergência)', (await cobranca(cB.id)).status === 'aguardando_pagamento');
  const rec = await fn('lv-mp-reconciliar', {}, adm.token);
  const depoisB = await cobranca(cB.id);
  const { data: logsB } = await admin.from('lv_mp_reconciliacoes').select('divergente, acao, origem').eq('cobranca_id', cB.id).order('consultado_em', { ascending: false }).limit(1);
  checar('rotina de reconciliação converge: B aprovado, com divergência registrada e ação aplicada', rec.status === 200 && depoisB.status === 'aprovado'
    && logsB?.[0]?.divergente === true && logsB[0].acao === 'aplicado' && logsB[0].origem === 'rotina', `(${rec.texto})`);
  checar('os dois vendedores pagos: pedido pai pago e um único pagamento_aprovado',
    (await admin.from('lv_orders').select('status').eq('id', ped.order_id).single()).data.status === 'pago'
    && (await admin.from('lv_order_events').select('id').eq('order_id', ped.order_id).eq('tipo', 'pagamento_aprovado')).data?.length === 1);
  checar('estoque de B baixado uma vez', (await lote(B.loteId)).qtd_disponivel === antesB.qtd_disponivel - 3 && (await lote(B.loteId)).qtd_reservada === antesB.qtd_reservada);
  const rec2 = await fn('lv-mp-reconciliar', { cobranca_id: cB.id }, adm.token);
  checar('reconciliar de novo (admin) não muda nada', rec2.json.alteradas === 0 && (await lote(B.loteId)).qtd_disponivel === antesB.qtd_disponivel - 3);
  const admVe = await adm.cliente.from('lv_mp_reconciliacoes').select('id').eq('cobranca_id', cB.id);
  checar('admin vê o histórico de reconciliação; vendedor não', admVe.data?.length >= 2
    && ((await uB.cliente.from('lv_mp_reconciliacoes').select('id').eq('cobranca_id', cB.id)).data?.length ?? 0) === 0);

  // ------------------------------------------------------------ cartão: recusado e aprovado
  secao('CARTÃO DE TESTE: RECUSADO, NOVA TENTATIVA APROVADA');
  const pedCartao = await pedido(c2.cliente, [{ variant_id: B.variante, quantidade: 1 }], 'cartao');
  const rej = await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedCartao.order_id, metodo: 'cartao', cartoes: { '*': { token: 'mock_recusar', payment_method_id: 'visa', installments: 1 } } }, c2.token);
  const cRej = (await cobrancasDo(pedCartao.order_id))[0];
  checar('cartão recusado: cobrança recusada, pedido continua aguardando e estoque reservado', rej.status === 200 && cRej?.status === 'recusado'
    && (await admin.from('lv_orders').select('status').eq('id', pedCartao.order_id).single()).data.status === 'aguardando_pagamento');
  const apr = await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedCartao.order_id, metodo: 'cartao', cartoes: { '*': { token: 'mock_aprovar', payment_method_id: 'visa', installments: 1 } } }, c2.token);
  const cobsCartao = await cobrancasDo(pedCartao.order_id);
  checar('nova tentativa gera nova cobrança e aprova na criação: pedido pago', apr.status === 200 && cobsCartao.length === 2
    && cobsCartao[1].status === 'aprovado' && (await admin.from('lv_orders').select('status').eq('id', pedCartao.order_id).single()).data.status === 'pago');

  // ------------------------------------------------------------ reembolso
  secao('REEMBOLSO PELO PROVEDOR');
  const cAprov = cobsCartao[1];
  const r1 = await fn('lv-mp-reembolso', { cobranca_id: cAprov.id, motivo: 'teste de reembolso' }, adm.token);
  const r2 = await fn('lv-mp-reembolso', { cobranca_id: cAprov.id, motivo: 'teste de reembolso' }, adm.token);
  const { data: refunds } = await admin.from('lv_refunds').select('status, provider_refund_id').eq('cobranca_id', cAprov.id);
  const { data: remotoRef } = await admin.from('lv_mp_mock_remoto').select('reembolsos, status').eq('mp_payment_id', cAprov.mp_payment_id).single();
  checar('reembolso executado no provedor: refunded e cobrança reembolsada', r1.status === 200 && refunds?.[0]?.status === 'refunded'
    && (await cobranca(cAprov.id)).status === 'reembolsado' && remotoRef.status === 'refunded', `(${r1.texto})`);
  checar('pedir o reembolso de novo não duplica (nenhum reembolso aberto e um só no provedor)',
    r2.status !== 200 || (refunds.length === 1 && remotoRef.reembolsos.length === 1));

  // ------------------------------------------------------------ expiração, cancelamento e pagamento tardio
  secao('EXPIRAÇÃO, CANCELAMENTO E PAGAMENTO TARDIO');
  const pedExp = await pedido(c1.cliente, [{ variant_id: A.variante, quantidade: 1 }, { variant_id: B.variante, quantidade: 1 }]);
  await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedExp.order_id, metodo: 'pix' }, c1.token);
  const [eA, eB] = await cobrancasDo(pedExp.order_id).then(l => [l.find(c => c.seller_id === A.sellerId), l.find(c => c.seller_id === B.sellerId)]);
  await remotoAprovar(eA);
  await webhook(eA.mp_payment_id, { requestId: `${MARCA}-${crypto.randomUUID()}` });
  const antesExpB = await lote(B.loteId);
  await admin.from('lv_stock_reservations').update({ expira_em: passado() }).eq('order_id', pedExp.order_id).eq('status', 'ativa');
  await admin.rpc('lv_checkout_expirar');
  const { data: subsExp } = await admin.from('lv_seller_orders').select('seller_id, status').eq('order_id', pedExp.order_id);
  checar('só o vendedor que não pagou é cancelado; pedido segue pago para quem pagou',
    subsExp.find(s => s.seller_id === B.sellerId)?.status === 'cancelado' && subsExp.find(s => s.seller_id === A.sellerId)?.status === 'confirmado'
    && (await admin.from('lv_orders').select('status').eq('id', pedExp.order_id).single()).data.status === 'pago');
  checar('cobrança de B expirada e estoque de B devolvido', (await cobranca(eB.id)).status === 'expirado'
    && (await lote(B.loteId)).qtd_disponivel === antesExpB.qtd_disponivel + 1 && (await lote(B.loteId)).qtd_reservada === antesExpB.qtd_reservada - 1);
  await remotoAprovar(eB);
  await webhook(eB.mp_payment_id, { requestId: `${MARCA}-${crypto.randomUUID()}` });
  const tardio = await cobranca(eB.id);
  const { data: refTardio } = await admin.from('lv_refunds').select('status').eq('cobranca_id', eB.id);
  checar('pagamento tardio: registrado, reembolso pendente, estoque NÃO baixa, atenção para a equipe', tardio.status === 'aprovado'
    && refTardio?.[0]?.status === 'refund_pending' && tardio.precisa_atencao === true && (await lote(B.loteId)).qtd_disponivel === antesExpB.qtd_disponivel + 1);
  const proc = await fn('lv-mp-reembolso', {}, adm.token);
  checar('rotina de reembolso devolve o pagamento tardio', proc.json.concluidos >= 1
    && (await admin.from('lv_refunds').select('status').eq('cobranca_id', eB.id).single()).data.status === 'refunded'
    && (await cobranca(eB.id)).status === 'reembolsado');

  const pedCanc = await pedido(c1.cliente, [{ variant_id: A.variante, quantidade: 1 }]);
  await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedCanc.order_id, metodo: 'pix' }, c1.token);
  const antesCanc = await lote(A.loteId);
  await c1.cliente.rpc('lv_pedido_cancelar', { p_order: pedCanc.order_id, p_motivo: 'desisti' });
  checar('cancelado antes de pagar: cobrança cancelada e reserva liberada', (await cobrancasDo(pedCanc.order_id))[0].status === 'cancelado'
    && (await lote(A.loteId)).qtd_disponivel === antesCanc.qtd_disponivel + 1);

  const pedPago = await pedido(c2.cliente, [{ variant_id: A.variante, quantidade: 1 }]);
  await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedPago.order_id, metodo: 'pix' }, c2.token);
  const cPago = (await cobrancasDo(pedPago.order_id))[0];
  await remotoAprovar(cPago);
  await webhook(cPago.mp_payment_id, { requestId: `${MARCA}-${crypto.randomUUID()}` });
  const antesDev = await lote(A.loteId);
  const cancAdm = await adm.cliente.rpc('lv_pedido_cancelar', { p_order: pedPago.order_id, p_motivo: 'cliente pediu' });
  checar('cancelar depois de pago não mexe só no banco: abre reembolso pelo provedor e devolve estoque', !cancAdm.error
    && (await admin.from('lv_refunds').select('status').eq('cobranca_id', cPago.id).single()).data.status === 'refund_pending'
    && (await lote(A.loteId)).qtd_disponivel === antesDev.qtd_disponivel + 1);
  await fn('lv-mp-reembolso', {}, adm.token);
  checar('reembolso do cancelamento concluído', (await cobranca(cPago.id)).status === 'reembolsado');

  // ------------------------------------------------------------ vendedor sem Mercado Pago
  secao('VENDEDOR DESCONECTADO');
  await fn('lv-mp-conexao', { acao: 'desconectar' }, uB.token);
  const { data: credDepois } = await admin.rpc('lv_mp_credencial_ler', { p_seller: B.sellerId });
  checar('desconectar apaga os tokens do Vault', credDepois?.status === 'desconectado' && credDepois.access_token === null);
  const pedSemMp = await pedido(c1.cliente, [{ variant_id: B.variante, quantidade: 1 }]);
  const semMp = await fn('lv-mp-pagamento', { acao: 'criar', order_id: pedSemMp.order_id, metodo: 'pix' }, c1.token);
  checar('cobrança para vendedor sem Mercado Pago não é criada e fica sinalizada', semMp.json.falhas?.[0]?.codigo === 'SELLER_SEM_MERCADO_PAGO'
    && (await cobrancasDo(pedSemMp.order_id))[0]?.status === 'erro');

  secao('LIMPEZA');
  await limpar();
  const { count } = await admin.from('lv_orders').select('id', { count: 'exact', head: true }).like('comprador_email', `${MARCA}%`);
  checar('pedidos, cobranças, conexões, tokens e usuários de teste removidos', count === 0);
}

// Produção, SÓ LEITURA: o banco de produção precisa dizer "desativado".
async function producaoSomenteLeitura() {
  secao('PRODUÇÃO (SOMENTE LEITURA)');
  const prod = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  if (!prod.VITE_SUPABASE_URL?.includes(REF_PRODUCAO)) { erro('.env não é produção'); return; }
  const p = createClient(prod.VITE_SUPABASE_URL, prod.SUPABASE_SERVICE_ROLE_KEY, semSessao);
  const { data, error } = await p.rpc('lv_pagamentos_config');
  if (error) { console.log(`  --  produção ainda sem a migration da U9.1 (${error.message})`); return; }
  checar('produção: ambiente "producao" e Mercado Pago DESATIVADO (mock impossível)', data.ambiente === 'producao' && data.provedor === 'desativado', `(${JSON.stringify(data)})`);
}

try {
  await ciclo();
  await producaoSomenteLeitura();
} catch (e) {
  erro('bancada de pagamentos interrompida: ' + (e instanceof Error ? e.stack : e));
  await limpar().catch(() => {});
}
console.log(`\n${criterios} critérios · ${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
if (falhas) process.exitCode = 1;
