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

// =====================================================================
// UNIDADE 6 — Seller Central: identidade, isolamento e moderação
// =====================================================================
//
// Aqui a bancada testa com JWT DE VERDADE. Cria dois usuários no Supabase
// Auth, entra como cada um, e tenta — como vendedor A e como vendedor B —
// fazer o que a interface não oferece. O que importa não é a tela esconder
// o botão: é o banco recusar quando alguém chama a API direto.
//
// As senhas são aleatórias, geradas na hora, nunca impressas e nunca
// gravadas. Os dois usuários são apagados no fim.

import crypto from 'node:crypto';

const VEND = {
  A: { nome: 'Bancada Vendedor A', loja: `${PREFIXO}loja-a`, email: 'teste-bancada-a@coffeelivre.test' },
  B: { nome: 'Bancada Vendedor B', loja: `${PREFIXO}loja-b`, email: 'teste-bancada-b@coffeelivre.test' },
};

const senhaAleatoria = () => crypto.randomBytes(24).toString('base64url') + 'Aa1!';

async function acharUsuarioPorEmail(email) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const achado = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (achado) return achado;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Cliente autenticado como um usuário — é o JWT real que a RLS enxerga. */
async function entrarComo(email, senha) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`entrar como ${email}: ${error.message}`);
  return c;
}

async function limparVendedores(silencioso = false) {
  if (!silencioso) console.log('\n=== LIMPANDO VENDEDORES DE TESTE ===');
  for (const v of Object.values(VEND)) {
    const { data: lojas } = await admin.from('lv_stores').select('id').eq('slug', v.loja);
    for (const l of lojas ?? []) {
      // Produtos levam atributos, faixas e estoque por cascade.
      await admin.from('lv_products').delete().eq('store_id', l.id);
    }
    await admin.from('lv_stores').delete().eq('slug', v.loja);
    await admin.from('lv_sellers').delete().eq('nome_fantasia', v.nome);
    const u = await acharUsuarioPorEmail(v.email);
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  if (!silencioso) ok('usuários, vendedores, lojas e produtos da bancada removidos');
}

async function semearVendedores() {
  console.log('\n=== SEMEANDO VENDEDORES A e B ===');
  await limparVendedores(true);
  const criados = {};
  for (const [chave, v] of Object.entries(VEND)) {
    const { data: s, error: es } = await admin.from('lv_sellers').insert({
      nome_fantasia: v.nome, tipo: 'torrefacao', status: 'aprovado', is_demo: true,
    }).select('id').single();
    if (es) throw new Error('vendedor ' + chave + ': ' + es.message);

    // Loja nasce INATIVA, como na aprovação de verdade.
    const { data: l, error: el } = await admin.from('lv_stores').insert({
      seller_id: s.id, slug: v.loja, nome: `Loja ${chave} da Bancada`, cor: '#35506B',
      iniciais: 'B' + chave, ativa: false, is_demo: true,
    }).select('id').single();
    if (el) throw new Error('loja ' + chave + ': ' + el.message);

    const senha = senhaAleatoria();
    const { data: u, error: eu } = await admin.auth.admin.createUser({
      email: v.email, password: senha, email_confirm: true,
    });
    if (eu) throw new Error('usuário ' + chave + ': ' + eu.message);

    const { error: ev } = await admin.from('lv_seller_users').insert({ seller_id: s.id, user_id: u.user.id });
    if (ev) throw new Error('vínculo ' + chave + ': ' + ev.message);

    criados[chave] = { sellerId: s.id, lojaId: l.id, cliente: await entrarComo(v.email, senha) };
    ok(`vendedor ${chave}: usuário real, vínculo e loja inativa`);
  }
  return criados;
}

async function aceiteVendedor() {
  const { A, B } = await semearVendedores();
  const a = A.cliente, b = B.cliente;
  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();

  console.log('\n=== LOJA: DADOS SIM, APROVAÇÃO NÃO ===');
  const minhaLoja = await a.from('lv_stores').select('id, ativa').eq('id', A.lojaId).maybeSingle();
  checar('A enxerga a própria loja mesmo inativa', !!minhaLoja.data);
  const lojaAlheia = await a.from('lv_stores').select('id').eq('id', B.lojaId);
  checar('A não enxerga a loja inativa de B', lojaAlheia.data.length === 0);

  await a.from('lv_stores').update({ chamada: 'Editada pelo vendedor A', ativa: true }).eq('id', A.lojaId);
  const depois = (await admin.from('lv_stores').select('chamada, ativa').eq('id', A.lojaId).single()).data;
  checar('A edita a chamada da própria loja', depois.chamada === 'Editada pelo vendedor A');
  checar('A NÃO consegue ativar a própria loja', depois.ativa === false);

  await a.from('lv_stores').update({ chamada: 'Invadida por A' }).eq('id', B.lojaId);
  const lojaB = (await admin.from('lv_stores').select('chamada').eq('id', B.lojaId).single()).data;
  checar('A NÃO edita a loja de B', lojaB.chamada !== 'Invadida por A');

  console.log('\n=== CADASTRO GUIADO ===');
  const salvo = await a.rpc('lv_salvar_produto', { p: {
    store_id: A.lojaId, category_id: cat.id,
    titulo: 'Café da Bancada Tradicional 500g', marca: 'Bancada', sku: 'BAN-500',
    preco_cents: 2390, peso_g: 500, preco_minimo_cents: 2250, venda_por_quantidade: true,
    atributos: { classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', moagem: 'Média', peso: '500', voltagem: '220V' },
    faixas: [
      { min_qty: 2, tipo: 'reais', valor: 100 },
      { min_qty: 3, tipo: 'reais', valor: 150 },
      { min_qty: 4, tipo: 'reais', valor: 200 },
    ],
  } });
  checar('A cria produto pelo cadastro guiado', !salvo.error, salvo.error?.message);
  const idA = salvo.data?.id;
  checar('produto novo nasce em rascunho', salvo.data?.status === 'rascunho', `(veio ${salvo.data?.status})`);

  // "Recarregar": ler de novo, como a tela faz depois de salvar.
  const recarregado = (await a.from('lv_products')
    .select('titulo, preco_cents, preco_minimo_cents, venda_por_quantidade, sku, slug').eq('id', idA).single()).data;
  checar('preço, piso e SKU persistem', recarregado?.preco_cents === 2390 && recarregado?.preco_minimo_cents === 2250 && recarregado?.sku === 'BAN-500');
  checar('venda por quantidade persiste ligada', recarregado?.venda_por_quantidade === true);

  const attrs = (await a.from('lv_product_attributes').select('lv_attributes!inner(chave)').eq('product_id', idA)).data ?? [];
  const chaves = attrs.map(x => x.lv_attributes.chave).sort();
  checar('atributos da categoria gravados', ['classificacao', 'especie', 'moagem', 'peso', 'torra'].every(c => chaves.includes(c)), `(${chaves})`);
  checar('atributo de OUTRA categoria (voltagem) descartado', !chaves.includes('voltagem'));

  const tiers = (await a.from('lv_price_tiers').select('min_qty').eq('product_id', idA)).data ?? [];
  checar('as três faixas persistem', tiers.length === 3, `(${tiers.length})`);

  console.log('\n=== VARIANTE E QR NASCEM COM O PRODUTO ===');
  const variantesA = (await a.from('lv_product_variants').select('id, nome, gramatura_g, moagem, sku, padrao').eq('product_id', idA)).data ?? [];
  const padraoA = variantesA.find(v => v.padrao);
  checar('produto novo nasce com uma variante padrão', variantesA.length === 1 && !!padraoA, `(${variantesA.length})`);
  checar('a variante recebe gramatura, moagem e SKU do cadastro',
    padraoA?.gramatura_g === 500 && padraoA?.moagem === 'Média' && padraoA?.sku === 'BAN-500' && padraoA?.nome === '500 g · Média',
    `(${JSON.stringify(padraoA)})`);
  const qrA = (await a.from('lv_qr_codes').select('codigo, variant_id').eq('product_id', idA)).data ?? [];
  checar('produto novo nasce com código permanente de QR', qrA.length === 1 && /^[A-HJKMNP-Z2-9]{8}$/.test(qrA[0]?.codigo ?? ''), `(${JSON.stringify(qrA)})`);
  const codigoA = qrA[0]?.codigo;
  const qrRascunho = await visitante.rpc('lv_resolver_qr', { p_codigo: codigoA });
  checar('QR de produto fora do ar não revela o destino', qrRascunho.data?.disponivel === false && !qrRascunho.data?.slug);
  const qrInexistente = await visitante.rpc('lv_resolver_qr', { p_codigo: 'ZZZZZZZZ' });
  checar('QR inexistente não resolve', qrInexistente.data === null);

  const varB = await b.from('lv_product_variants').select('id').eq('product_id', idA);
  checar('B NÃO lê variantes do rascunho de A', (varB.data ?? []).length === 0);
  const varInjetada = await b.from('lv_product_variants').insert({ product_id: idA, nome: 'injetada por B' });
  checar('B NÃO cria variante no produto de A', !!varInjetada.error);
  const qrB = await b.from('lv_qr_codes').select('codigo').eq('product_id', idA);
  checar('B NÃO lê o QR de A', (qrB.data ?? []).length === 0);
  const qrForjado = await a.from('lv_qr_codes').insert({ codigo: 'AAAAAAAA', product_id: idA });
  checar('nem o dono cria QR à mão: o código nasce pelo banco', !!qrForjado.error);

  console.log('\n=== RECEBIMENTO DO VENDEDOR ===');
  const meuVendedor = (await a.from('lv_sellers').select('pagamento_status').eq('id', A.sellerId).single()).data;
  checar('vendedor novo nasce com recebimento "não iniciado"', meuVendedor?.pagamento_status === 'nao_iniciado', `(${meuVendedor?.pagamento_status})`);
  await a.from('lv_sellers').update({ pagamento_status: 'verificado' }).eq('id', A.sellerId);
  const depoisDaTentativa = (await admin.from('lv_sellers').select('pagamento_status').eq('id', A.sellerId).single()).data;
  checar('A NÃO se declara habilitado para receber', depoisDaTentativa.pagamento_status === 'nao_iniciado');
  const podeReceber = await a.rpc('lv_vendedor_pode_receber', { p_seller: A.sellerId });
  checar('vendedor não verificado não pode receber', podeReceber.data === false, `(${JSON.stringify(podeReceber.data ?? podeReceber.error)})`);

  console.log('\n=== GUARDAS DE COLUNA ===');
  await a.from('lv_products').update({ destaque: true, slug: 'slug-roubado', is_demo: true }).eq('id', idA);
  const guardado = (await admin.from('lv_products').select('destaque, slug, is_demo').eq('id', idA).single()).data;
  checar('A NÃO se dá destaque na vitrine', guardado.destaque === false);
  checar('A NÃO troca o slug permanente', guardado.slug === recarregado.slug);
  checar('A NÃO marca produto como demonstração', guardado.is_demo === false);

  const recusa = await a.from('lv_products').update({ status: 'recusado' }).eq('id', idA);
  checar('A NÃO recusa o próprio produto', !!recusa.error);

  const direto = await a.from('lv_products').insert({
    store_id: A.lojaId, seller_id: A.sellerId, slug: `${PREFIXO}direto-${Date.now()}`,
    titulo: 'Tentativa direta', status: 'ativo',
  }).select('status').single();
  checar('inserir direto como "ativo" vira rascunho', direto.data?.status === 'rascunho', `(veio ${direto.data?.status})`);

  console.log('\n=== MODERAÇÃO NÃO SE CONTORNA ===');
  const pedido = await a.rpc('lv_publicar_produto', { p_id: idA, p_publicar: true });
  checar('pedir publicação sem aprovação vira moderação', pedido.data === 'em_moderacao', `(veio ${pedido.data})`);
  const naVitrine1 = await visitante.from('vw_lv_vitrine').select('id').eq('id', idA);
  checar('em moderação não aparece na vitrine', naVitrine1.data.length === 0);

  // O que só a plataforma faz: aprovar a loja e o produto.
  await admin.from('lv_stores').update({ ativa: true }).eq('id', A.lojaId);
  await admin.from('lv_products').update({ status: 'ativo' }).eq('id', idA);
  const aprovado = (await admin.from('lv_products').select('status, aprovado_em').eq('id', idA).single()).data;
  checar('a moderação aprova e carimba a aprovação', aprovado.status === 'ativo' && !!aprovado.aprovado_em);

  const naVitrine2 = await visitante.from('vw_lv_vitrine').select('id, venda_por_quantidade').eq('id', idA).maybeSingle();
  checar('aprovado aparece na vitrine', !!naVitrine2.data);
  const tiersPublicos = await visitante.from('lv_price_tiers').select('min_qty').eq('product_id', idA);
  checar('o comprador vê a mesma escada de 3 faixas', tiersPublicos.data.length === 3);

  console.log('\n=== PAUSAR E VOLTAR ===');
  const pausa = await a.rpc('lv_publicar_produto', { p_id: idA, p_publicar: false });
  checar('A despublica', pausa.data === 'pausado', `(veio ${pausa.data})`);
  const naVitrine3 = await visitante.from('vw_lv_vitrine').select('id').eq('id', idA);
  checar('despublicado some da vitrine', naVitrine3.data.length === 0);
  const ainda = (await a.from('lv_products').select('preco_cents').eq('id', idA).single()).data;
  const tiersAinda = (await a.from('lv_price_tiers').select('min_qty').eq('product_id', idA)).data ?? [];
  checar('despublicar não perde preço nem escada', ainda.preco_cents === 2390 && tiersAinda.length === 3);

  const volta = await a.rpc('lv_publicar_produto', { p_id: idA, p_publicar: true });
  checar('já aprovado volta ao ar sem nova fila', volta.data === 'ativo', `(veio ${volta.data})`);

  // Edição sensível: título. Pela seção 4.3, volta para a fila.
  await a.rpc('lv_salvar_produto', { p: {
    id: idA, store_id: A.lojaId, category_id: cat.id, titulo: 'Café da Bancada RENOMEADO 500g',
    preco_cents: 2390, peso_g: 500, preco_minimo_cents: 2250, venda_por_quantidade: true,
    atributos: { classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', moagem: 'Média', peso: '500' },
    faixas: [{ min_qty: 2, tipo: 'reais', valor: 100 }, { min_qty: 3, tipo: 'reais', valor: 150 }, { min_qty: 4, tipo: 'reais', valor: 200 }],
  } });
  const sensivel = (await admin.from('lv_products').select('status').eq('id', idA).single()).data;
  checar('trocar o título de produto no ar volta para moderação', sensivel.status === 'em_moderacao', `(veio ${sensivel.status})`);

  console.log('\n=== ISOLAMENTO ENTRE VENDEDORES ===');
  await admin.from('lv_products').update({ status: 'ativo' }).eq('id', idA);

  await b.from('lv_products').update({ titulo: 'Invadido por B' }).eq('id', idA);
  const tituloA = (await admin.from('lv_products').select('titulo').eq('id', idA).single()).data.titulo;
  checar('B NÃO altera produto de A', tituloA !== 'Invadido por B');

  const rpcInvasora = await b.rpc('lv_salvar_produto', { p: {
    id: idA, store_id: A.lojaId, category_id: cat.id, titulo: 'Invasão por RPC', preco_cents: 1,
  } });
  checar('B NÃO altera produto de A pela função de salvar', !!rpcInvasora.error);

  const penduraNaLojaDeA = await b.rpc('lv_salvar_produto', { p: {
    store_id: A.lojaId, category_id: cat.id, titulo: 'Produto de B na loja de A', preco_cents: 100,
  } });
  checar('B NÃO cria produto na loja de A', !!penduraNaLojaDeA.error);

  await b.from('lv_price_tiers').delete().eq('product_id', idA);
  const tiersDepois = (await admin.from('lv_price_tiers').select('min_qty').eq('product_id', idA)).data ?? [];
  checar('B NÃO apaga a escada de A', tiersDepois.length === 3);

  const { data: attr } = await admin.from('lv_attributes').select('id').eq('chave', 'notas').single();
  const injetar = await b.from('lv_product_attributes').insert({ product_id: idA, attribute_id: attr.id, valor: 'injetado' });
  checar('B NÃO injeta atributo no produto de A', !!injetar.error);

  const rascunhoA = await a.rpc('lv_salvar_produto', { p: {
    store_id: A.lojaId, category_id: cat.id, titulo: 'Rascunho secreto de A', preco_cents: 1000,
  } });
  const espiar = await b.from('lv_products').select('id').eq('id', rascunhoA.data.id);
  checar('B NÃO lê rascunho de A', espiar.data.length === 0);

  console.log('\n=== ESTOQUE POR VARIANTE ===');
  const semEstoque = (await visitante.from('vw_lv_vitrine').select('disponivel').eq('id', idA).single()).data;
  checar('produto no ar sem lote aparece com 0 disponível (esgotado)', semEstoque?.disponivel === 0, `(${semEstoque?.disponivel})`);

  // O produto é real (o vendedor não marca demonstração), então o lote
  // também é real — marcado pelo prefixo TESTE- e apagado junto com o produto.
  const misturado = await admin.from('lv_inventory_lots').insert({
    variant_id: padraoA.id, lote: 'TESTE-DEMO', qtd_disponivel: 500, is_demo: true,
  });
  checar('lote de demonstração em produto real é recusado', !!misturado.error, misturado.error ? '' : '(entrou)');

  const lote = await admin.from('lv_inventory_lots').insert({
    variant_id: padraoA.id, lote: 'TESTE-BAN-01', entrada_em: '2026-09-12', data_torra: '2026-09-08',
    validade: '2027-03-01', qtd_disponivel: 7, is_demo: false,
  }).select('product_id, seller_id').single();
  checar('lote lançado na variante', !lote.error, lote.error?.message);
  checar('o banco deriva produto e vendedor do lote pela variante',
    lote.data?.product_id === idA && lote.data?.seller_id === A.sellerId);

  const vencido = await admin.from('lv_inventory_lots').insert({
    variant_id: padraoA.id, lote: 'TESTE-BAN-VENCIDO', validade: '2020-01-01', qtd_disponivel: 50, is_demo: false,
  });
  checar('lote vencido pode ser registrado', !vencido.error, vencido.error?.message);

  const aVenda = await visitante.rpc('lv_variantes_a_venda', { p_product: idA });
  checar('o comprador vê 7 vendáveis: lote vencido não conta', aVenda.data?.[0]?.disponivel === 7, `(${JSON.stringify(aVenda.data ?? aVenda.error)})`);
  const naVitrine7 = (await visitante.from('vw_lv_vitrine').select('disponivel, variante_padrao_id, qr_codigo').eq('id', idA).single()).data;
  checar('a vitrine traz disponível, variante padrão e código do QR',
    naVitrine7?.disponivel === 7 && naVitrine7?.variante_padrao_id === padraoA.id && naVitrine7?.qr_codigo === codigoA,
    `(${JSON.stringify(naVitrine7)})`);
  const loteAlheio = await visitante.from('lv_inventory_lots').select('id').eq('product_id', idA);
  checar('o comprador NÃO lê lote', (loteAlheio.data ?? []).length === 0);

  console.log('\n=== QR NÃO DEPENDE DO SLUG ===');
  const qrNoAr = await visitante.rpc('lv_resolver_qr', { p_codigo: codigoA.toLowerCase() });
  checar('QR resolve para o produto no ar (caixa baixa também)', qrNoAr.data?.disponivel === true && qrNoAr.data?.slug === recarregado.slug);
  // Só a plataforma troca slug. Se trocar, o código impresso segue válido.
  const novoSlug = `${PREFIXO}slug-corrigido-${Date.now()}`;
  await admin.from('lv_products').update({ slug: novoSlug }).eq('id', idA);
  const qrDepois = await visitante.rpc('lv_resolver_qr', { p_codigo: codigoA });
  checar('slug corrigido: o mesmo QR leva ao endereço novo', qrDepois.data?.slug === novoSlug, `(${qrDepois.data?.slug})`);

  const estoqueA = await a.from('lv_inventory_lots').select('qtd_disponivel').eq('product_id', idA).eq('lote', 'TESTE-BAN-01');
  checar('A vê o próprio estoque', estoqueA.data?.[0]?.qtd_disponivel === 7);
  const estoqueB = await b.from('lv_inventory_lots').select('id').eq('product_id', idA);
  checar('B NÃO vê o estoque de A', estoqueB.data.length === 0);
  const inflar = await a.from('lv_inventory_lots').insert({
    product_id: idA, seller_id: A.sellerId, qtd_disponivel: 99999,
  });
  checar('A NÃO lança estoque para si mesmo', !!inflar.error);

  console.log('\n=== ESTOQUE DE DEMONSTRAÇÃO CONTROLADO ===');
  const demo = Object.fromEntries(((await visitante.from('vw_lv_vitrine').select('slug, disponivel')
    .in('slug', ['serra-clara-tradicional-moido-500g', 'serra-clara-especial-graos-250g', 'torra-viva-descafeinado-moido-250g'])).data ?? [])
    .map(x => [x.slug, x.disponivel]));
  checar('demo com 7 unidades', demo['serra-clara-tradicional-moido-500g'] === 7, `(${demo['serra-clara-tradicional-moido-500g']})`);
  checar('demo com 2 unidades', demo['serra-clara-especial-graos-250g'] === 2, `(${demo['serra-clara-especial-graos-250g']})`);
  checar('demo esgotado continua na vitrine com 0', demo['torra-viva-descafeinado-moido-250g'] === 0, `(${demo['torra-viva-descafeinado-moido-250g']})`);
  const { data: catuai } = await visitante.from('vw_lv_vitrine').select('id').eq('slug', 'alto-horizonte-catuai-vermelho-250g').single();
  const variantesCatuai = await visitante.rpc('lv_variantes_a_venda', { p_product: catuai.id });
  checar('demo com duas variantes e estoques próprios',
    variantesCatuai.data?.length === 2 && variantesCatuai.data[0].disponivel !== variantesCatuai.data[1].disponivel,
    `(${JSON.stringify(variantesCatuai.data)})`);
  const escadaDo2 = await visitante.from('lv_price_tiers').select('min_qty')
    .eq('product_id', (await visitante.from('vw_lv_vitrine').select('id').eq('slug', 'serra-clara-especial-graos-250g').single()).data.id);
  checar('estoque baixo NÃO apaga a escada do vendedor (3 faixas seguem gravadas)', (escadaDo2.data ?? []).length === 3);

  console.log('\n=== APAGAR ===');
  await a.from('lv_products').delete().eq('id', idA);
  const aindaExiste = await admin.from('lv_products').select('id').eq('id', idA);
  checar('A NÃO apaga produto que já passou pela vitrine', aindaExiste.data.length === 1);
  await a.from('lv_products').delete().eq('id', rascunhoA.data.id);
  const rascunhoSumiu = await admin.from('lv_products').select('id').eq('id', rascunhoA.data.id);
  checar('A apaga o próprio rascunho', rascunhoSumiu.data.length === 0);

  await a.auth.signOut();
  await b.auth.signOut();
  await limparVendedores();
}

/**
 * Cria (ou reaproveita) um login de vendedor para a demonstração ao vivo.
 *
 * Roda na máquina de quem opera e imprime a senha provisória SÓ no
 * terminal dele. Não é backdoor: usa a chave de serviço local, a mesma das
 * migrations, e não existe caminho equivalente no site publicado.
 */
async function acessoDemo(email, slugDaLoja) {
  if (!email || !slugDaLoja) {
    console.error('Uso: node scripts/coffeelivre-demo.mjs acesso-demo <email> <slug-da-loja>');
    process.exitCode = 1;
    return;
  }
  const { data: loja } = await admin.from('lv_stores').select('id, seller_id, nome, ativa, is_demo').eq('slug', slugDaLoja).maybeSingle();
  if (!loja) { console.error('Loja não encontrada: ' + slugDaLoja); process.exitCode = 1; return; }

  const senha = senhaAleatoria();
  let usuario = await acharUsuarioPorEmail(email);
  if (usuario) {
    await admin.auth.admin.updateUserById(usuario.id, { password: senha });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error) { console.error('Não foi possível criar o login: ' + error.message); process.exitCode = 1; return; }
    usuario = data.user;
  }
  await admin.from('lv_seller_users').upsert({ seller_id: loja.seller_id, user_id: usuario.id });

  console.log(`\nLogin de vendedor pronto para "${loja.nome}"${loja.is_demo ? ' (loja de demonstração)' : ''}.`);
  console.log(`  e-mail: ${email}`);
  console.log(`  senha provisória: ${senha}`);
  console.log('  entrar em: /coffeelivre/vendedor');
  if (!loja.ativa) console.log('  atenção: esta loja está inativa — publique-a no admin para os produtos aparecerem.');
  console.log('');
}

const comando = process.argv[2] ?? 'ciclo';
if (comando === 'semear') await semear();
else if (comando === 'publicar') await publicar(true);
else if (comando === 'despublicar') await publicar(false);
else if (comando === 'aceite') await aceite();
else if (comando === 'limpar') { await limpar(); await limparVendedores(); }
else if (comando === 'vendedor') await aceiteVendedor();
else if (comando === 'acesso-demo') await acessoDemo(process.argv[3], process.argv[4]);
else if (comando === 'ciclo') {
  await semear(); await aceite(); await limpar();
  try {
    await aceiteVendedor();
  } catch (e) {
    erro('bancada do vendedor interrompida: ' + (e instanceof Error ? e.message : e));
    await limparVendedores(true);
  }
}
else { console.error('Comando desconhecido: ' + comando); process.exitCode = 1; }

if (comando === 'aceite' || comando === 'ciclo' || comando === 'vendedor') {
  console.log(`\n${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
}
if (falhas) process.exitCode = 1;
