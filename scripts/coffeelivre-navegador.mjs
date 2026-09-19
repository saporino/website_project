// Coffee LiVRE — bancada de teste NO NAVEGADOR.
//
// A bancada da API (`coffeelivre-demo.mjs`) prova que o banco recusa o que
// deve recusar. Esta prova que as TELAS funcionam com uma sessão de verdade:
// um Chrome abre o site, digita o código da demonstração, entra na Seller
// Central com um vendedor temporário, cadastra, edita, configura a escada,
// vê o estoque, edita a loja e sai — em 1280 px e em 375 px. Depois faz o
// lado do comprador: estoque limitando a escada e o carrinho, esgotado, e
// o QR permanente.
//
// NADA AQUI É ATALHO DE AUTENTICAÇÃO:
//   • o código de acesso é criado para este teste, com validade de 1 hora,
//     e apagado no fim — o site confere pelo mesmo caminho de sempre;
//   • o vendedor é um usuário real do Supabase Auth, com senha aleatória
//     gerada na hora, nunca impressa, nunca gravada em arquivo;
//   • tudo leva a marca `teste-navegador` / `@coffeelivre.test`, e a
//     limpeza só apaga o que casa com essa marca;
//   • a chave de serviço fica neste processo local e nunca chega ao Chrome.
//
// Uso:
//   node scripts/coffeelivre-navegador.mjs              sobe o Vite sozinho
//   node scripts/coffeelivre-navegador.mjs --url=http://localhost:5173
//   node scripts/coffeelivre-navegador.mjs --mostrar    abre a janela
//
// Capturas de tela em test-results/coffeelivre/ (fora do git).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
// Sempre destrutivo (cria e apaga usuários): só roda em staging, nunca em produção.
const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const argumento = nome => process.argv.find(a => a.startsWith(`--${nome}`));
const MOSTRAR = !!argumento('mostrar');
const PORTA = 5188;
const SAIDA = path.join(RAIZ, 'test-results', 'coffeelivre');

// A marca de tudo o que este script cria. Mudar isto quebra a limpeza.
const MARCA = 'teste-navegador';
const EMAIL = rotulo => `${MARCA}-${rotulo}@coffeelivre.test`;
const VENDEDOR = rotulo => `Bancada Navegador ${rotulo}`;
const LOJA = rotulo => `${MARCA}-${rotulo}`;

const TELAS = [
  { rotulo: 'desktop', viewport: { width: 1280, height: 900 }, movel: false },
  { rotulo: '375', viewport: { width: 375, height: 812 }, movel: true },
];

// Todo host do Supabase que o Chrome chamou. No fim, todos precisam ser do staging.
const HOSTS = new Set();

let falhas = 0;
const ok = t => console.log('  ok  ' + t);
const erro = t => { falhas++; console.log('  !!  ' + t); };
const checar = (rotulo, condicao, detalhe = '') => condicao ? ok(rotulo) : erro(`${rotulo} ${detalhe}`);

// ---------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------
async function subirServidor() {
  const dado = argumento('url');
  if (dado) return { base: dado.split('=')[1].replace(/\/$/, ''), parar: () => {} };
  // `--mode staging`: o Vite lê `.env.staging`, então o site aberto no Chrome
  // fala com o mesmo banco que a bancada preparou (e sai com noindex).
  const vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js'), '--port', String(PORTA), '--strictPort', '--mode', 'staging'], {
    cwd: RAIZ, stdio: 'ignore',
  });
  const base = `http://localhost:${PORTA}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base)).ok) return { base, parar: () => vite.kill() }; } catch { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  vite.kill();
  throw new Error('o Vite não respondeu em 60 s');
}

// ---------------------------------------------------------------------
// Dados temporários
// ---------------------------------------------------------------------
async function acharUsuario(email) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    const achado = data?.users?.find(u => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (!data?.users || data.users.length < 200) return null;
  }
  return null;
}

async function limpar() {
  await admin.from('lv_demo_access').delete().like('label', `${MARCA}%`);
  await admin.from('lv_b2b_empresas').delete().like('nome', `${MARCA}%`);
  await admin.from('lv_seller_applications').delete().like('nome_marca', `${MARCA}%`);
  // Fluxo de compra: pedidos (cascata para subpedidos, itens, reservas, eventos),
  // depois lojas e produtos de teste, depois os usuários.
  const { data: pedidosTeste } = await admin.from('lv_orders').select('id').like('comprador_email', `${MARCA}%`);
  if (pedidosTeste?.length) await admin.from('lv_orders').delete().in('id', pedidosTeste.map(p => p.id));
  const { data: lojasCompra } = await admin.from('lv_stores').select('id, seller_id').like('slug', `${MARCA}-pedido-%`);
  for (const l of lojasCompra ?? []) {
    await admin.from('lv_products').delete().eq('store_id', l.id);
    await admin.from('lv_stores').delete().eq('id', l.id);
    await admin.from('lv_sellers').delete().eq('id', l.seller_id);
  }
  for (const rotulo of TELAS.flatMap(t => [`comprador-${t.rotulo}`, `pedido-a-${t.rotulo}`, `pedido-b-${t.rotulo}`])) {
    const u = await acharUsuario(EMAIL(rotulo));
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  for (const rotulo of TELAS.flatMap(t => [t.rotulo, `${t.rotulo}-mercado`])) {
    const { data: lojas } = await admin.from('lv_stores').select('id').eq('slug', LOJA(rotulo));
    for (const l of lojas ?? []) await admin.from('lv_products').delete().eq('store_id', l.id);
    await admin.from('lv_stores').delete().eq('slug', LOJA(rotulo));
    await admin.from('lv_sellers').delete().eq('nome_fantasia', VENDEDOR(rotulo));
    const u = await acharUsuario(EMAIL(rotulo));
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  // Admin temporário: o perfil sai junto (user_profiles → auth.users on delete cascade).
  const adm = await acharUsuario(EMAIL('admin'));
  if (adm) await admin.auth.admin.deleteUser(adm.id);
}

/**
 * Administrador TEMPORÁRIO, só no staging. Usuário real do Supabase Auth com
 * senha aleatória nunca impressa; `is_admin` ligado no perfil pela chave de
 * serviço — nunca por rota ou função do site. Apagado no fim do fluxo e na limpeza.
 */
async function criarAdminTemporario() {
  if (ambiente.nome !== 'staging') throw new Error('admin temporário só existe no staging');
  const email = EMAIL('admin');
  const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const { data: u, error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true, user_metadata: { full_name: 'Admin Temporário (teste)' },
  });
  if (error) throw new Error('admin temporário: ' + error.message);
  const { error: ep } = await admin.from('user_profiles')
    .upsert({ id: u.user.id, full_name: 'Admin Temporário (teste)', is_admin: true });
  if (ep) { await admin.auth.admin.deleteUser(u.user.id); throw new Error('perfil do admin temporário: ' + ep.message); }
  return { id: u.user.id, email, senha };
}

async function criarCodigoDeAcesso() {
  const codigo = crypto.randomBytes(18).toString('base64url');
  const { data: hash, error: eh } = await admin.rpc('lv_normalizar_codigo', { bruto: codigo });
  if (eh) throw new Error('hash do código: ' + eh.message);
  const { error } = await admin.from('lv_demo_access').insert({
    label: `${MARCA} ${new Date().toISOString()}`,
    code_hash: hash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error('código de acesso: ' + error.message);
  return codigo;
}

async function criarVendedor(rotulo) {
  const { data: s, error: es } = await admin.from('lv_sellers').insert({
    nome_fantasia: VENDEDOR(rotulo), tipo: 'torrefacao', status: 'aprovado', is_demo: true,
  }).select('id').single();
  if (es) throw new Error('vendedor: ' + es.message);
  // Loja INATIVA: o teste não pode aparecer na vitrine pública nem por um minuto.
  const { data: l, error: el } = await admin.from('lv_stores').insert({
    seller_id: s.id, slug: LOJA(rotulo), nome: `Loja Navegador ${rotulo}`, cor: '#35506B',
    iniciais: 'LN', ativa: false, is_demo: true,
  }).select('id').single();
  if (el) throw new Error('loja: ' + el.message);
  const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email: EMAIL(rotulo), password: senha, email_confirm: true });
  if (eu) throw new Error('usuário: ' + eu.message);
  const { error: ev } = await admin.from('lv_seller_users').insert({ seller_id: s.id, user_id: u.user.id });
  if (ev) throw new Error('vínculo: ' + ev.message);
  return { sellerId: s.id, lojaId: l.id, email: EMAIL(rotulo), senha };
}

// ---------------------------------------------------------------------
// Utilidades de página
// ---------------------------------------------------------------------
async function abrirContexto(browser, tela) {
  const contexto = await browser.newContext({
    viewport: tela.viewport, isMobile: tela.movel, hasTouch: tela.movel, locale: 'pt-BR',
  });
  const page = await contexto.newPage();
  page.setDefaultTimeout(20000);
  page.on('request', r => { const u = r.url(); if (u.includes('.supabase.co')) HOSTS.add(new URL(u).hostname); });
  const errosDoConsole = [];
  page.on('console', m => { if (m.type() === 'error') errosDoConsole.push(m.text()); });
  page.on('pageerror', e => errosDoConsole.push(e.message));
  return { contexto, page, errosDoConsole };
}

function fotografo(page, tela, fluxo) {
  let n = 0;
  return async (nome) => {
    n++;
    const semRolagem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    checar(`[${tela.rotulo}] ${nome}: sem rolagem lateral`, semRolagem);
    const arquivo = `${fluxo}-${tela.rotulo}-${String(n).padStart(2, '0')}-${nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    await page.screenshot({ path: path.join(SAIDA, arquivo), fullPage: true });
  };
}

// A primeira abertura de um Vite recém-subido compila o site inteiro e pode
// passar de 20 s. Navegação ganha folga; espera por elemento continua curta.
const abrir = (page, url) => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

async function passarPeloPortao(page, base, caminho, codigo) {
  await abrir(page, base + caminho);
  // O portão agora chama o campo de "Código de convite"; os códigos antigos (multiuso) entram no mesmo campo.
  await page.getByPlaceholder('Código de convite').fill(codigo, { timeout: 60000 });
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const visivel = async (localizador) => {
  try { await localizador.first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
};

/**
 * Valor de um campo de formulário, esperando até ele chegar ao esperado.
 * O React repõe o formulário depois de recarregar o produto do banco; ler no
 * mesmo instante do clique testa a corrida, não o comportamento.
 */
const valorDoCampo = async (localizador, esperado, ms = 15000) => {
  const fim = Date.now() + ms;
  let atual = '';
  do {
    atual = await localizador.first().inputValue().catch(() => '');
    if (atual === esperado) return atual;
    await new Promise(r => setTimeout(r, 250));
  } while (Date.now() < fim);
  return atual;
};

/** Navegação interna do site, sem recarregar: o carrinho vive na memória. */
const navegarPorDentro = (page, caminho) => page.evaluate(c => {
  window.history.pushState({}, '', c);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, caminho);

// ---------------------------------------------------------------------
// Fluxo do vendedor
// ---------------------------------------------------------------------
async function fluxoVendedor(browser, base, tela, codigo) {
  console.log(`\n=== SELLER CENTRAL LOGADO · ${tela.rotulo} ===`);
  const v = await criarVendedor(tela.rotulo);
  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'vendedor');
  const tituloProduto = `Café Navegador Tradicional ${tela.rotulo}`;

  try {
    await passarPeloPortao(page, base, '/coffeelivre/vendedor', codigo);
    checar(`[${tela.rotulo}] portão da demonstração leva ao login`, await visivel(page.getByRole('heading', { name: 'Seller Central' })));
    await foto('login');

    // --- login ---
    await page.getByLabel('E-mail').fill(v.email);
    await page.getByLabel('Senha').fill(v.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    checar(`[${tela.rotulo}] login com usuário temporário abre a Seller Central`, await visivel(page.getByRole('heading', { name: /^Olá,/ })));

    // --- visão geral ---
    checar(`[${tela.rotulo}] visão geral mostra o LiVRE Copiloto`, await visivel(page.getByRole('heading', { name: 'LiVRE Copiloto' })));
    checar(`[${tela.rotulo}] visão geral mostra o recebimento "Não iniciado"`,
      await visivel(page.locator('.sc-recebimento', { hasText: 'Não iniciado' })));
    checar(`[${tela.rotulo}] faixa de loja de demonstração`, await visivel(page.getByText('Loja de demonstração')));
    await foto('visao-geral');

    // --- produtos ---
    await page.locator('.sc-menu').getByRole('link', { name: 'Produtos' }).click();
    checar(`[${tela.rotulo}] lista de produtos vazia`, await visivel(page.getByText('Nenhum produto ainda')));
    await foto('produtos-vazio');

    // --- cadastro guiado ---
    await page.locator('.sc-titulo-com-acao').getByRole('link', { name: 'Cadastrar café' }).click();
    checar(`[${tela.rotulo}] passo 1 pergunta o que vende`, await visivel(page.getByRole('heading', { name: 'O que você está vendendo?' })));
    await foto('cadastro-1');
    await page.locator('.sc-escolha').filter({ has: page.locator('b', { hasText: /^Cafés$/ }) }).click();
    checar(`[${tela.rotulo}] passo 2 pergunta a categoria`, await visivel(page.getByRole('heading', { name: 'Em qual categoria?' })));
    await page.locator('.sc-escolha').filter({ has: page.locator('b', { hasText: /^Café torrado e moído$/ }) }).click();

    checar(`[${tela.rotulo}] passo 3 é o básico`, await visivel(page.getByRole('heading', { name: 'O básico' })));
    await page.getByLabel('Nome do produto').fill(tituloProduto);
    await page.getByLabel('Marca').fill('Navegador');
    await page.getByLabel('Preço').fill('23,90');
    await page.getByLabel('Peso').fill('500');
    await page.getByLabel('SKU').fill('NAV-500');
    await page.getByRole('radiogroup', { name: 'Classificação' }).getByRole('radio', { name: 'Tradicional' }).click();
    await page.getByRole('radiogroup', { name: 'Torra' }).getByRole('radio', { name: 'Média', exact: true }).click();
    await page.getByRole('radiogroup', { name: 'Moagem' }).getByRole('radio', { name: 'Média', exact: true }).click();
    checar(`[${tela.rotulo}] medidor do LiVRE Passport aparece`, await visivel(page.locator('.sc-passport', { hasText: '% completo' })));
    await foto('cadastro-3-basico');

    await page.getByRole('button', { name: 'Continuar' }).click();
    checar(`[${tela.rotulo}] passo 4 são as características`, await visivel(page.getByRole('heading', { name: 'Características' })));
    await page.getByRole('radiogroup', { name: 'Espécie' }).getByRole('radio', { name: 'Blend' }).click();
    checar(`[${tela.rotulo}] Passport de café tradicional chega a 100%`, await visivel(page.getByText('100% completo')));
    await foto('cadastro-4-caracteristicas');

    await page.getByRole('button', { name: 'Continuar' }).click();
    checar(`[${tela.rotulo}] passo 5 é preço e quantidade`, await visivel(page.getByRole('heading', { name: 'Preço e quantidade' })));
    await page.getByLabel('Preço mínimo desejado por unidade').fill('22,50');
    await page.getByRole('switch').click();
    await page.getByLabel('2 unidades').fill('1,00');
    await page.getByLabel('3 unidades').fill('1,50');
    await page.getByLabel('4 unidades').fill('3,00');
    checar(`[${tela.rotulo}] prévia da escada calcula 4 × R$ 20,90 = R$ 83,60`, await visivel(page.locator('.sc-previa', { hasText: 'R$ 83,60' })));
    checar(`[${tela.rotulo}] faixa abaixo do piso gera alerta`, await visivel(page.getByText('abaixo do seu preço mínimo desejado')));
    await foto('cadastro-5-escada-com-alerta');

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForURL(/\/coffeelivre\/vendedor\/produtos\/[0-9a-f-]{36}$/);
    const produtoId = page.url().split('/').pop();
    checar(`[${tela.rotulo}] salvar leva ao endereço do produto`, !!produtoId);

    const gravado = (await admin.from('lv_products').select('status, venda_por_quantidade, preco_cents, preco_minimo_cents').eq('id', produtoId).single()).data;
    checar(`[${tela.rotulo}] banco: rascunho com preço, piso e escada ligada`,
      gravado?.status === 'rascunho' && gravado?.preco_cents === 2390 && gravado?.preco_minimo_cents === 2250 && gravado?.venda_por_quantidade === true,
      `(${JSON.stringify(gravado)})`);
    const variante = (await admin.from('lv_product_variants').select('id, nome, sku').eq('product_id', produtoId).eq('padrao', true).single()).data;
    checar(`[${tela.rotulo}] banco: variante padrão "500 g · Média" com SKU`, variante?.nome === '500 g · Média' && variante?.sku === 'NAV-500', `(${JSON.stringify(variante)})`);

    // --- edição, com recarga: o que aparece é o que ficou gravado ---
    await page.reload();
    checar(`[${tela.rotulo}] edição reabre com o nome gravado`, await visivel(page.getByRole('heading', { name: tituloProduto })));
    await page.getByLabel('Marca').fill('Navegador Editada');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    checar(`[${tela.rotulo}] escada volta ligada`, (await page.getByRole('switch').getAttribute('aria-checked')) === 'true');
    checar(`[${tela.rotulo}] faixa de 4 volta com R$ 3,00`, (await page.getByLabel('4 unidades').inputValue()) === '3,00');
    // Só a de 4 não basta: a de 3 (R$ 22,40) também fura o piso de R$ 22,50,
    // e o alerta tem de continuar enquanto qualquer faixa furar.
    await page.getByLabel('4 unidades').fill('1,00');
    checar(`[${tela.rotulo}] alerta continua enquanto a faixa de 3 fura o piso`,
      await page.getByText('abaixo do seu preço mínimo desejado').count() === 1);
    await page.getByLabel('3 unidades').fill('1,00');
    checar(`[${tela.rotulo}] alerta some quando todas as faixas voltam acima do piso`,
      await page.getByText('abaixo do seu preço mínimo desejado').count() === 0);
    await foto('edicao-escada-sem-alerta');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    checar(`[${tela.rotulo}] edição salva`, await visivel(page.locator('.sc-aviso', { hasText: 'Salvo.' })));
    await page.reload();
    checar(`[${tela.rotulo}] marca editada persiste`, (await page.getByLabel('Marca').inputValue()) === 'Navegador Editada');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    checar(`[${tela.rotulo}] faixa editada persiste`, (await page.getByLabel('4 unidades').inputValue()) === '1,00');

    // --- lista com o produto ---
    await page.locator('.sc-menu').getByRole('link', { name: 'Produtos' }).click();
    checar(`[${tela.rotulo}] produto aparece na lista como rascunho`,
      await visivel(page.locator('.sc-linha', { hasText: tituloProduto }).locator('.sc-situacao', { hasText: 'Rascunho' })));
    await foto('produtos-com-rascunho');

    // --- estoque: lançado pela operação, lido pelo vendedor ---
    const { error: eLote } = await admin.from('lv_inventory_lots').insert({
      variant_id: variante.id, lote: 'TESTE-NAV-01', data_torra: '2026-09-10', validade: '2027-06-01',
      entrada_em: '2026-09-12', qtd_disponivel: 7, is_demo: false,
    });
    checar(`[${tela.rotulo}] operação lança lote na variante`, !eLote, eLote?.message);
    await page.locator('.sc-menu').getByRole('link', { name: 'Estoque' }).click();
    checar(`[${tela.rotulo}] estoque mostra o lote`, await visivel(page.getByText('TESTE-NAV-01')));
    checar(`[${tela.rotulo}] estoque mostra a variante`, await visivel(page.locator('.sc-linha', { hasText: '500 g · Média' })));
    checar(`[${tela.rotulo}] estoque mostra 7 unidades`, await visivel(page.getByText('7 unidades disponíveis')));
    await foto('estoque');

    // --- minha loja ---
    await page.locator('.sc-menu').getByRole('link', { name: 'Minha loja' }).click();
    checar(`[${tela.rotulo}] minha loja mostra a situação sem botão de ativar`,
      await visivel(page.getByText('Loja aguardando aprovação')) && await page.getByRole('button', { name: /ativar|publicar loja/i }).count() === 0);
    const chamada = `Chamada salva pelo navegador ${tela.rotulo}`;
    await page.getByLabel('Chamada').fill(chamada);
    await page.getByRole('button', { name: 'Salvar dados' }).click();
    checar(`[${tela.rotulo}] dados da loja salvos`, await visivel(page.locator('.sc-aviso', { hasText: 'Dados da loja salvos.' })));
    const loja = (await admin.from('lv_stores').select('chamada, ativa').eq('id', v.lojaId).single()).data;
    checar(`[${tela.rotulo}] banco: chamada gravada e loja continua inativa`, loja?.chamada === chamada && loja?.ativa === false);
    await foto('minha-loja');

    // --- sair ---
    await page.locator('.sc-topo').getByRole('button', { name: 'Sair' }).click();
    checar(`[${tela.rotulo}] sair volta ao login`, await visivel(page.getByRole('heading', { name: 'Seller Central' })));
    await abrir(page, base + "/coffeelivre/vendedor/produtos");
    checar(`[${tela.rotulo}] depois de sair, a rota interna pede login de novo`,
      await visivel(page.getByLabel('Senha')) && await page.getByRole('heading', { name: 'Produtos' }).count() === 0);
    await foto('depois-de-sair');
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo do vendedor interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `vendedor-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console do vendedor`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
}

// ---------------------------------------------------------------------
// Fluxo do comprador: estoque, escada, esgotado, variante e QR
// ---------------------------------------------------------------------
async function fluxoComprador(browser, base, tela, codigo) {
  console.log(`\n=== COMPRADOR: ESTOQUE E QR · ${tela.rotulo} ===`);
  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'comprador');
  const status = page.locator('.estoque-status');
  const degrau = n => page.locator('.degrau').nth(n - 1);
  const botao = page.locator('.produto-compra .ao-carrinho');

  try {
    // --- 2 unidades ---
    await passarPeloPortao(page, base, '/coffeelivre/cafe/serra-clara-especial-graos-250g', codigo);
    checar(`[${tela.rotulo}] 2 unidades: aviso de últimas unidades`, await visivel(status.filter({ hasText: 'Últimas 2 unidades' })));
    checar(`[${tela.rotulo}] 2 unidades: faixas 1 e 2 disponíveis`, await degrau(1).isEnabled() && await degrau(2).isEnabled());
    checar(`[${tela.rotulo}] 2 unidades: faixas 3 e 4 indisponíveis, mas na tela`,
      await degrau(3).isDisabled() && await degrau(4).isDisabled() && await page.getByText('Indisponível no estoque atual').count() === 2);
    await foto('estoque-2-unidades');
    await degrau(2).click();
    await botao.click();
    checar(`[${tela.rotulo}] 2 unidades: depois de levar 2, não cabe mais nenhuma`,
      await visivel(status.filter({ hasText: 'Todo o estoque disponível já está no seu carrinho' })) && await botao.isDisabled());

    // --- 7 unidades, mesmo carrinho ---
    await navegarPorDentro(page, '/coffeelivre/cafe/serra-clara-tradicional-moido-500g');
    checar(`[${tela.rotulo}] 7 unidades: em estoque`, await visivel(status.filter({ hasText: 'Em estoque' })));
    checar(`[${tela.rotulo}] 7 unidades: as quatro faixas disponíveis`,
      (await Promise.all([1, 2, 3, 4].map(n => degrau(n).isEnabled()))).every(Boolean));
    await degrau(4).click();
    await botao.click();
    await page.waitForTimeout(300);
    checar(`[${tela.rotulo}] 7 unidades: com 4 no carrinho, a faixa de 4 fica indisponível e a de 3 não`,
      await degrau(4).isDisabled() && await degrau(3).isEnabled());
    await foto('estoque-7-com-4-no-carrinho');
    await degrau(3).click();
    await botao.click();
    checar(`[${tela.rotulo}] 7 unidades: total para em 7, nada mais cabe`,
      await visivel(status.filter({ hasText: 'Todo o estoque disponível já está no seu carrinho' })) && await botao.isDisabled()
      && await degrau(1).isDisabled());

    // --- esgotado ---
    await navegarPorDentro(page, '/coffeelivre/cafe/torra-viva-descafeinado-moido-250g');
    checar(`[${tela.rotulo}] esgotado: página aberta, compra bloqueada`,
      await visivel(status.filter({ hasText: 'Esgotado' })) && await botao.isDisabled()
      && (await page.locator('.produto-compra .comprar').getAttribute('aria-disabled')) === 'true');
    await foto('esgotado');

    // --- variante ---
    await navegarPorDentro(page, '/coffeelivre/cafe/alto-horizonte-catuai-vermelho-250g');
    checar(`[${tela.rotulo}] variantes: duas versões à escolha`, await visivel(page.locator('.variante')) && await page.locator('.variante').count() === 2);
    await page.locator('.variante').nth(1).click();
    checar(`[${tela.rotulo}] variantes: escolher a versão leva ?v= ao endereço`, /\?v=[0-9a-f-]{36}$/.test(page.url()));
    await foto('variantes');

    // --- vitrine com esgotado ---
    await navegarPorDentro(page, '/coffeelivre/categoria/cafe-torrado-moido');
    const cartao = page.locator('.prod', { hasText: 'Descafeinado' });
    checar(`[${tela.rotulo}] vitrine: esgotado continua visível com botão bloqueado`,
      await visivel(cartao) && await cartao.getByRole('button', { name: 'Esgotado' }).isDisabled());
    await foto('vitrine-esgotado');

    // --- QR permanente ---
    const { data: qr } = await admin.from('vw_lv_vitrine').select('qr_codigo').eq('slug', 'serra-clara-especial-graos-250g').single();
    await abrir(page, `${base}/coffeelivre/q/${qr.qr_codigo}`);
    await page.waitForURL(/\/coffeelivre\/cafe\/serra-clara-especial-graos-250g/, { timeout: 15000 }).catch(() => {});
    checar(`[${tela.rotulo}] QR: código permanente abre o café`, page.url().includes('/cafe/serra-clara-especial-graos-250g'), `(${page.url()})`);
    checar(`[${tela.rotulo}] QR: a página mostra o endereço permanente, não o slug`,
      await visivel(page.locator('.compartilhar input')) && (await page.locator('.compartilhar input').inputValue()).endsWith(`/coffeelivre/q/${qr.qr_codigo}`));
    await abrir(page, `${base}/coffeelivre/q/ZZZZZZZZ`);
    checar(`[${tela.rotulo}] QR: código desconhecido cai numa página honesta`, await visivel(page.getByText('Este código não corresponde')));
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo do comprador interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `comprador-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console do comprador`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
}

// ---------------------------------------------------------------------
// Calculadora de Economia LiVRE: café 500 g a R$ 23,90, piso R$ 19,00,
// 1.000 pacotes/mês, vendendo hoje na Magalu. Os valores esperados foram
// conferidos à mão contra os estudos de benchmark.
// ---------------------------------------------------------------------
async function fluxoCalculadora(browser, base, tela, codigo) {
  console.log(`\n=== CALCULADORA DE ECONOMIA · ${tela.rotulo} ===`);
  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'calculadora');
  const cartao = p => page.locator(`.calc-cartao[data-plataforma="${p}"]`);
  const porPacote = p => cartao(p).locator('[data-campo="por-pacote"]');
  const menos = '−';

  try {
    await passarPeloPortao(page, base, '/coffeelivre/vender', codigo);
    checar(`[${tela.rotulo}] a calculadora aparece em Venda no Coffee LiVRE`,
      await visivel(page.getByRole('heading', { name: 'Calculadora de Economia LiVRE' })));
    const ordem = await page.evaluate(() => {
      const c = document.getElementById('calculadora'), p = document.getElementById('planos');
      return !!c && !!p && !!(c.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    checar(`[${tela.rotulo}] a calculadora vem antes dos planos`, ordem);
    await foto('vazia');

    await page.getByLabel('Preço atual do produto').fill('23,90');
    await page.getByRole('radiogroup', { name: 'Peso / apresentação' }).getByRole('radio', { name: '500 g' }).click();
    await page.getByLabel('Piso líquido desejado por unidade').fill('19,00');
    await page.getByLabel('Pacotes por mês').fill('1.000');
    await page.getByRole('radiogroup', { name: 'Média de pacotes por pedido' }).getByRole('radio', { name: '1', exact: true }).click();
    await page.getByRole('radiogroup', { name: 'Plataforma atual' }).getByRole('radio', { name: 'Magalu' }).click();

    checar(`[${tela.rotulo}] compara as cinco plataformas`, await visivel(cartao('coffeelivre')) && await page.locator('.calc-cartao').count() === 5);
    const esperados = [['mercado_livre', 'R$ 13,40'], ['shopee', 'R$ 15,12'], ['amazon', 'R$ 9,35'], ['magalu', 'R$ 14,60'], ['coffeelivre', 'R$ 18,89']];
    for (const [p, v] of esperados) {
      const texto = (await porPacote(p).textContent())?.trim();
      checar(`[${tela.rotulo}] ${p}: líquido por pacote ${v}`, texto === v, `(veio ${texto})`);
    }
    checar(`[${tela.rotulo}] Magalu abaixo do piso com −R$ 4,40 por pacote`,
      await visivel(cartao('magalu').locator('.calc-piso-bloco.abaixo', { hasText: `${menos}R$ 4,40` })));
    checar(`[${tela.rotulo}] impacto mensal −R$ 4.400,00 e anual −R$ 52.800,00`,
      await visivel(cartao('magalu').locator('.calc-impacto', { hasText: `por mês ${menos}R$ 4.400,00` }))
      && await cartao('magalu').locator('.calc-impacto', { hasText: `por ano ${menos}R$ 52.800,00` }).count() === 1);
    checar(`[${tela.rotulo}] economia potencial +R$ 4.290,00/mês e +R$ 51.480,00 em 12 meses`,
      await visivel(page.locator('[data-campo="economia"]', { hasText: '+R$ 4.290,00' }))
      && await page.locator('[data-campo="economia"]', { hasText: '+R$ 51.480,00' }).count() === 1);
    await foto('resultado-mes');

    await page.getByRole('radiogroup', { name: 'Período' }).getByRole('radio', { name: 'Por ano' }).click();
    checar(`[${tela.rotulo}] por ano: Magalu R$ 175.200,00`,
      (await cartao('magalu').locator('[data-campo="liquido"]').textContent())?.trim() === 'R$ 175.200,00');
    await page.getByRole('radiogroup', { name: 'Período' }).getByRole('radio', { name: 'Por pedido' }).click();
    checar(`[${tela.rotulo}] por pedido: Magalu R$ 14,60`,
      (await cartao('magalu').locator('[data-campo="liquido"]').textContent())?.trim() === 'R$ 14,60');

    checar(`[${tela.rotulo}] preço para preservar o piso na Magalu: R$ 29,27`,
      await visivel(page.locator('.calc-lista-precos li[data-plataforma="magalu"]', { hasText: 'R$ 29,27' })));
    checar(`[${tela.rotulo}] preço LiVRE equivalente: R$ 18,73, redução de R$ 5,17`,
      await visivel(page.locator('[data-campo="equivalente"]', { hasText: 'R$ 18,73' }))
      && await page.locator('[data-campo="equivalente"]', { hasText: 'R$ 5,17' }).count() === 1);
    await foto('funcoes-inversas');

    const media = page.getByRole('radiogroup', { name: 'Média de pacotes por pedido' });
    await media.getByRole('radio', { name: '4', exact: true }).click();
    checar(`[${tela.rotulo}] 4 pacotes: aviso de frete grátis da Magalu com mais 1 unidade`,
      await visivel(cartao('magalu').getByText('Com mais 1 unidade')));
    await media.getByRole('radio', { name: '5', exact: true }).click();
    checar(`[${tela.rotulo}] 5 pacotes: custo não público vira "até", nunca zero`,
      ((await porPacote('magalu').textContent()) ?? '').startsWith('até '));
    checar(`[${tela.rotulo}] 5 pacotes: preço do piso na Magalu não é inventado`,
      await visivel(page.locator('.calc-lista-precos li[data-plataforma="magalu"]', { hasText: 'Não é possível determinar' })));
    await foto('cinco-pacotes');
    await media.getByRole('radio', { name: '1', exact: true }).click();

    await cartao('magalu').getByRole('button', { name: 'Como calculamos' }).click();
    checar(`[${tela.rotulo}] "Como calculamos" mostra fonte e confiabilidade`,
      await visivel(cartao('magalu').locator('.calc-confianca', { hasText: 'Fonte secundária' }))
      && await cartao('magalu').locator('.calc-fontes a').count() > 0);

    await page.getByRole('button', { name: 'Ver cálculo detalhado' }).click();
    const detalhe = tela.movel ? page.locator('.calc-detalhe .calc-so-estreito') : page.locator('.calc-detalhe .calc-tabela');
    checar(`[${tela.rotulo}] cálculo detalhado aberto (${tela.movel ? 'cartões' : 'tabela'})`,
      await visivel(detalhe) && await visivel(detalhe.getByText('Carga efetiva')));
    await foto('detalhado');

    checar(`[${tela.rotulo}] benefícios não financeiros`, await visivel(page.getByRole('heading', { name: 'Além do dinheiro' })));

    // Recortes em tamanho real: a captura de página inteira reduz demais
    // para enxergar alinhamento de tabela e números cortados.
    const recorte = async (seletor, nome) => {
      const alvo = page.locator(seletor).first();
      if (await alvo.isVisible()) await alvo.screenshot({ path: path.join(SAIDA, `calculadora-${tela.rotulo}-recorte-${nome}.png`) });
    };
    await recorte('.calc-cenario', 'cenario');
    await recorte('.calc-cartao[data-plataforma="magalu"]', 'cartao-magalu');
    await recorte('.calc-lista-precos', 'precos-do-piso');
    await recorte('.calc-bloco[aria-label="Além do dinheiro"]', 'beneficios');
    await recorte('.calc-rodape', 'rodape');
    await recorte('.calc-detalhe', 'detalhe');

    await page.getByRole('radiogroup', { name: 'Plano do Coffee LiVRE' }).getByRole('radio', { name: 'LiVRE+ Plus' }).click();
    await page.getByRole('button', { name: 'Conhecer os planos' }).click();
    await page.waitForTimeout(900);
    const planosNaTela = await page.evaluate(() => {
      const r = document.getElementById('planos')?.getBoundingClientRect();
      return !!r && r.top < window.innerHeight && r.bottom > 0;
    });
    checar(`[${tela.rotulo}] "Conhecer os planos" leva aos planos`, planosNaTela);
    checar(`[${tela.rotulo}] o plano escolhido na calculadora continua selecionado`,
      await page.locator('.plano.on', { hasText: 'LiVRE+ Plus' }).count() === 1);
    await foto('planos');

    await page.getByRole('button', { name: 'Quero vender melhor no Coffee LiVRE' }).click();
    await page.waitForTimeout(900);
    const formNaTela = await page.evaluate(() => {
      const r = document.getElementById('quero-vender')?.getBoundingClientRect();
      return !!r && r.top < window.innerHeight && r.bottom > 0;
    });
    checar(`[${tela.rotulo}] "Quero vender melhor" leva ao formulário`, formNaTela);
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo da calculadora interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `calculadora-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console da calculadora`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
}

// ---------------------------------------------------------------------
// Comparação de mercado + preço em um clique (Unidade 7)
// Café do vendedor: tradicional 500 g a R$ 29,90, piso R$ 24,90, faixas de
// R$ 1,00 / 1,50 / 3,00. Equivalentes de demonstração: mediana R$ 26,80.
// ---------------------------------------------------------------------
async function fluxoMercado(browser, base, tela, codigo) {
  console.log(`\n=== COMPARAÇÃO E PREÇO EM UM CLIQUE · ${tela.rotulo} ===`);
  const rotulo = `${tela.rotulo}-mercado`;
  const v = await criarVendedor(rotulo);
  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();
  const { data: prod, error: ep } = await admin.from('lv_products').insert({
    store_id: v.lojaId, seller_id: v.sellerId, category_id: cat.id, slug: `${MARCA}-mercado-${tela.rotulo}`,
    titulo: `Café Navegador Mercado ${tela.rotulo}`, preco_cents: 2990, preco_minimo_cents: 2490, peso_g: 500,
    venda_por_quantidade: true, status: 'rascunho', is_demo: false,
  }).select('id').single();
  if (ep) { erro(`[${tela.rotulo}] produto do fluxo de mercado: ${ep.message}`); return; }
  const { data: attrs } = await admin.from('lv_attributes').select('id, chave').in('chave', ['classificacao', 'especie', 'torra', 'moagem', 'peso']);
  const valores = { classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', moagem: 'Média', peso: '500' };
  await admin.from('lv_product_attributes').insert(attrs.map(x => ({ product_id: prod.id, attribute_id: x.id, valor: valores[x.chave] })));
  await admin.from('lv_price_tiers').insert([
    { product_id: prod.id, min_qty: 2, tipo: 'reais', valor: 100 },
    { product_id: prod.id, min_qty: 3, tipo: 'reais', valor: 150 },
    { product_id: prod.id, min_qty: 4, tipo: 'reais', valor: 300 },
  ]);

  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'mercado');
  const campo = n => page.locator(`[data-campo="${n}"]`).first();
  const texto = async n => ((await campo(n).textContent()) ?? '').trim();
  const precoNoBanco = async () => Number((await admin.from('lv_products').select('preco_cents').eq('id', prod.id).single()).data.preco_cents);

  try {
    await passarPeloPortao(page, base, '/coffeelivre/vendedor', codigo);
    await page.getByLabel('E-mail').fill(v.email);
    await page.getByLabel('Senha').fill(v.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await visivel(page.getByRole('heading', { name: /^Olá,/ }));

    await page.locator('.sc-menu').getByRole('link', { name: 'Produtos' }).click();
    await page.getByRole('link', { name: `Café Navegador Mercado ${tela.rotulo}` }).first().click();
    checar(`[${tela.rotulo}] produto abre com a comparação de mercado`, await visivel(page.getByRole('heading', { name: 'Comparação de mercado' })));
    await campo('mediana').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

    checar(`[${tela.rotulo}] mediana dos equivalentes R$ 26,80`, (await texto('mediana')) === 'R$ 26,80', `(veio ${await texto('mediana')})`);
    checar(`[${tela.rotulo}] seu preço R$ 29,90 e R$ 59,80/kg`,
      (await texto('seu-preco')) === 'R$ 29,90' && await page.locator('.sc-metricas', { hasText: 'R$ 59,80/kg' }).count() === 1);
    checar(`[${tela.rotulo}] seu piso R$ 24,90 aparece`, (await texto('piso')) === 'R$ 24,90');
    checar(`[${tela.rotulo}] distância da mediana +11,6%`, (await texto('distancia')) === '+11,6%', `(veio ${await texto('distancia')})`);
    checar(`[${tela.rotulo}] recomendação: 12% acima, pode ir para R$ 26,79 acima do piso`,
      (await texto('recomendacao')).includes('Seu preço está 12% acima da mediana de cafés equivalentes.')
      && (await texto('recomendacao')).includes('Você pode ir para R$ 26,79 e continuar acima do seu piso.'));
    checar(`[${tela.rotulo}] opções rápidas: igualar mediana, 1% abaixo e manter`,
      await page.locator('.sc-opcoes button', { hasText: 'Igualar mediana' }).count() === 1
      && await page.locator('.sc-opcoes button', { hasText: '1% abaixo da mediana' }).count() === 1
      && await page.locator('.sc-opcoes button', { hasText: 'Manter meu preço' }).count() === 1);
    checar(`[${tela.rotulo}] semelhantes separados da comparação direta`,
      await page.getByRole('button', { name: /Ver produtos semelhantes/ }).count() === 1);
    await foto('comparacao');
    await page.locator('.sc-mercado').first().screenshot({ path: path.join(SAIDA, `mercado-${tela.rotulo}-recorte-painel.png`) }).catch(() => {});

    // Trabalho não salvo: a ação rápida de preço não pode apagar o que o vendedor digitou.
    const DESCRICAO = `Descrição digitada e ainda não salva (${tela.rotulo}).`;
    const campoDescricao = page.getByLabel('Descrição');
    await campoDescricao.fill(DESCRICAO);

    await page.getByRole('button', { name: /Aplicar preço sugerido/ }).click();
    checar(`[${tela.rotulo}] confirmação mostra novo preço e distância do piso`,
      (await texto('novo-preco')) === 'R$ 26,79' && (await texto('distancia-piso')) === '+R$ 1,89');
    checar(`[${tela.rotulo}] confirmação avisa que há alteração não salva e que ela fica na tela`,
      (await texto('aviso-nao-salvo')).includes('1 alteração não salva'));
    checar(`[${tela.rotulo}] escada recalculada avisa a faixa que fura o piso`,
      ((await texto('escada-alerta')) ?? '').includes('faixa de 4 unidades fica abaixo do seu piso'));
    await foto('confirmacao');
    await page.locator('.sc-confirmar').first().screenshot({ path: path.join(SAIDA, `mercado-${tela.rotulo}-recorte-confirmacao.png`) }).catch(() => {});
    await page.getByRole('button', { name: 'Confirmar e aplicar' }).click();
    checar(`[${tela.rotulo}] aplicado: aviso e novo preço na comparação`,
      await visivel(page.locator('.sc-aviso', { hasText: 'Preço alterado para R$ 26,79.' }))
      && await visivel(page.locator('[data-campo="seu-preco"]', { hasText: 'R$ 26,79' })));
    checar(`[${tela.rotulo}] banco: preço 2679`, (await precoNoBanco()) === 2679);
    checar(`[${tela.rotulo}] depois de aplicar, o Copiloto considera o preço competitivo`,
      await visivel(page.locator('[data-campo="recomendacao"]', { hasText: 'Seu preço está competitivo' })));
    checar(`[${tela.rotulo}] a descrição não salva continua no formulário depois do preço aplicado`,
      (await campoDescricao.inputValue()) === DESCRICAO, `(veio "${await campoDescricao.inputValue()}")`);
    checar(`[${tela.rotulo}] o campo Preço do formulário já mostra R$ 26,79`,
      (await valorDoCampo(page.getByLabel('Preço'), '26,79')) === '26,79',
      `(veio "${await page.getByLabel('Preço').first().inputValue()}")`);
    const descricaoNoBanco = async () => (await admin.from('lv_products').select('descricao').eq('id', prod.id).single()).data.descricao;
    checar(`[${tela.rotulo}] banco: a ação gravou só o preço; a descrição ainda não`, (await descricaoNoBanco()) !== DESCRICAO);
    await foto('edicao-preservada');

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await visivel(page.locator('.sc-aviso', { hasText: 'Salvo.' }));
    checar(`[${tela.rotulo}] ao salvar, descrição e preço ficam gravados juntos`,
      (await descricaoNoBanco()) === DESCRICAO && (await precoNoBanco()) === 2679);

    await page.reload();
    await campo('seu-preco').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    checar(`[${tela.rotulo}] recarregado, o preço continua R$ 26,79`,
      (await texto('seu-preco')) === 'R$ 26,79' && (await page.getByLabel('Preço').first().inputValue()) === '26,79');
    checar(`[${tela.rotulo}] recarregado, a descrição salva continua`, (await page.getByLabel('Descrição').inputValue()) === DESCRICAO);
    const linha1 = page.locator('[data-campo="historico"] li').first();
    checar(`[${tela.rotulo}] histórico: R$ 29,90 → R$ 26,79 pelo LiVRE Copiloto`,
      ((await linha1.textContent()) ?? '').includes('R$ 29,90 → R$ 26,79') && ((await linha1.textContent()) ?? '').includes('LiVRE Copiloto'));
    const hist = (await admin.from('lv_price_history').select('origem, user_id, recomendacao').eq('product_id', prod.id).order('created_at', { ascending: false }).limit(1).single()).data;
    checar(`[${tela.rotulo}] banco: histórico com usuário e recomendação`, hist?.origem === 'copiloto' && !!hist?.user_id && hist?.recomendacao?.tipo === 'acima_da_mediana');
    await foto('historico');
    await page.locator('[data-campo="historico"]').first().screenshot({ path: path.join(SAIDA, `mercado-${tela.rotulo}-recorte-historico.png`) }).catch(() => {});

    await linha1.getByRole('button', { name: 'Desfazer' }).click();
    checar(`[${tela.rotulo}] desfazer volta a R$ 29,90`,
      await visivel(page.locator('.sc-aviso', { hasText: 'Alteração desfeita' }))
      && await visivel(page.locator('[data-campo="seu-preco"]', { hasText: 'R$ 29,90' })) && (await precoNoBanco()) === 2990);

    await page.locator('.sc-menu').getByRole('link', { name: 'Visão geral' }).click();
    const dica = page.locator('.sc-dica[data-tipo="preco_mercado"]');
    checar(`[${tela.rotulo}] Copiloto da visão geral recomenda o preço`, await visivel(dica));
    await dica.getByRole('button', { name: 'Aplicar R$ 26,79' }).click();
    await dica.getByRole('button', { name: 'Confirmar R$ 26,79' }).click();
    await page.waitForTimeout(1500);
    checar(`[${tela.rotulo}] aplicado em um clique pelo Copiloto`, (await precoNoBanco()) === 2679);
    await foto('copiloto');
    await page.locator('.sc-copiloto').first().screenshot({ path: path.join(SAIDA, `mercado-${tela.rotulo}-recorte-copiloto.png`) }).catch(() => {});
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo de mercado interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `mercado-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console do fluxo de mercado`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
}

// ---------------------------------------------------------------------
// Coffee LiVRE para Empresas (B2B)
// ---------------------------------------------------------------------
async function fluxoEmpresas(browser, base, tela, codigo) {
  console.log(`\n=== EMPRESAS (B2B) · ${tela.rotulo} ===`);
  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'empresas');
  const nome = `${MARCA} Cafeteria ${tela.rotulo}`;
  try {
    await passarPeloPortao(page, base, '/coffeelivre', codigo);
    await page.locator('footer').getByRole('link', { name: 'Para empresas' }).click();
    checar(`[${tela.rotulo}] rodapé leva ao Coffee LiVRE para Empresas`, await visivel(page.getByRole('heading', { name: 'Coffee LiVRE para Empresas' })));
    await foto('entrada');

    await page.getByLabel('Nome da empresa').fill(nome);
    await page.getByRole('radiogroup', { name: 'Tipo de negócio' }).getByRole('radio', { name: 'Cafeteria' }).click();
    await page.getByLabel('Cidade').fill('Campinas');
    await page.getByLabel('UF').selectOption('SP');
    await page.getByRole('radiogroup', { name: 'Tipo de café' }).getByRole('radio', { name: 'Tradicional' }).click();
    await page.getByRole('radiogroup', { name: 'Formato' }).getByRole('radio', { name: '500 g' }).click();
    await page.getByRole('radiogroup', { name: 'Moagem' }).getByRole('radio', { name: 'Média', exact: true }).click();
    await page.getByLabel('Quantidade em kg').fill('100');
    await page.getByRole('radiogroup', { name: 'Frequência' }).getByRole('radio', { name: 'Mensal' }).click();

    checar(`[${tela.rotulo}] resumo: 100 kg todo mês`, await visivel(page.locator('[data-campo="resumo"]', { hasText: 'Você quer receber 100 kg todo mês.' })));
    const ofertas = page.locator('.emp-oferta');
    await ofertas.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    checar(`[${tela.rotulo}] ofertas compatíveis de tradicional 500 g moído`, await ofertas.count() >= 5, `(${await ofertas.count()})`);
    const ponte = page.locator('.emp-oferta[data-oferta="ponte-velha-tradicional-moido-500g"]');
    checar(`[${tela.rotulo}] oferta mostra preço, R$/kg, vendedor, estoque e quantidade para a entrega`,
      await visivel(ponte) && ((await ponte.textContent()) ?? '').includes('R$ 27,90') && ((await ponte.textContent()) ?? '').includes('R$ 55,80')
      && ((await ponte.textContent()) ?? '').includes('Torrefação Ponte Velha') && ((await ponte.textContent()) ?? '').includes('200 pacotes'));
    checar(`[${tela.rotulo}] estoque que não cobre a entrega é dito`, ((await ponte.textContent()) ?? '').includes('não cobre esta entrega'));
    await foto('ofertas');
    await page.locator('.emp-ofertas').first().screenshot({ path: path.join(SAIDA, `empresas-${tela.rotulo}-recorte-ofertas.png`) }).catch(() => {});
    await page.locator('.emp-bloco').nth(1).screenshot({ path: path.join(SAIDA, `empresas-${tela.rotulo}-recorte-necessidade.png`) }).catch(() => {});

    await page.getByRole('button', { name: 'Solicitar cotação' }).click();
    checar(`[${tela.rotulo}] solicitação registrada`, await visivel(page.locator('[data-campo="solicitacao-enviada"]')));
    await foto('enviada');
    const { data: s } = await admin.from('lv_b2b_solicitacoes')
      .select('id, status, frequencia, quantidade_kg, consumo_mensal_kg, classificacao, gramatura_g, moagem, lv_b2b_empresas!inner(nome, tipo_negocio, uf)')
      .eq('lv_b2b_empresas.nome', nome).single();
    checar(`[${tela.rotulo}] banco: demanda estruturada, status novo`,
      s?.status === 'novo' && s?.frequencia === 'mensal' && s?.quantidade_kg === 100 && s?.consumo_mensal_kg === 100
      && s?.classificacao === 'Tradicional' && s?.gramatura_g === 500 && s?.moagem === 'Média' && s?.lv_b2b_empresas?.uf === 'SP',
      `(${JSON.stringify(s)})`);
    const { error: eStatus } = await admin.from('lv_b2b_solicitacoes').update({ status: 'em_analise' }).eq('id', s.id);
    checar(`[${tela.rotulo}] equipe muda o status (chave de serviço; ver limitação do admin)`, !eStatus);
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo de empresas interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `empresas-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console de empresas`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
}

// ---------------------------------------------------------------------
// Compra multiloja: carrinho → checkout → pedido → Meus pedidos → vendedores
// ---------------------------------------------------------------------
// Números de pedido criados na tela: o fluxo do admin procura por eles.
const PEDIDOS_CRIADOS = [];

async function criarLojaDeCompra(letra, rotulo, produto) {
  const { data: s, error: es } = await admin.from('lv_sellers').insert({
    nome_fantasia: `Navegador Pedido ${letra} ${rotulo}`, tipo: 'torrefacao', status: 'aprovado', is_demo: true,
  }).select('id').single();
  if (es) throw new Error('vendedor da compra: ' + es.message);
  // Loja ATIVA: o comprador precisa conseguir comprar. É staging e tudo sai na limpeza.
  const { data: l, error: el } = await admin.from('lv_stores').insert({
    seller_id: s.id, slug: `${MARCA}-pedido-${letra.toLowerCase()}-${rotulo}`, nome: `Torrefação Navegador ${letra}`,
    cor: letra === 'A' ? '#8B4A2B' : '#35506B', iniciais: 'N' + letra, ativa: true, is_demo: true,
  }).select('id').single();
  if (el) throw new Error('loja da compra: ' + el.message);
  const { data: cat } = await admin.from('lv_categories').select('id').eq('slug', 'cafe-torrado-moido').single();
  const slug = `${MARCA}-pedido-${letra.toLowerCase()}-${rotulo}-cafe`;
  const { data: p, error: ep } = await admin.from('lv_products').insert({
    store_id: l.id, seller_id: s.id, category_id: cat.id, slug, titulo: produto.titulo, marca: 'Navegador',
    preco_cents: produto.preco, preco_minimo_cents: produto.piso, peso_g: produto.peso, venda_por_quantidade: true,
    status: 'ativo', is_demo: true,
  }).select('id').single();
  if (ep) throw new Error('produto da compra: ' + ep.message);
  await admin.from('lv_price_tiers').insert(produto.faixas.map(f => ({ product_id: p.id, ...f })));
  const { data: v } = await admin.from('lv_product_variants').select('id').eq('product_id', p.id).eq('padrao', true).single();
  await admin.from('lv_product_variants').update({ gramatura_g: produto.peso }).eq('id', v.id);
  const validade = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const { data: lote } = await admin.from('lv_inventory_lots').insert({
    variant_id: v.id, lote: `NAV-${letra}`, validade, qtd_disponivel: produto.estoque, is_demo: true,
  }).select('id').single();
  const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const email = EMAIL(`pedido-${letra.toLowerCase()}-${rotulo}`);
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (eu) throw new Error('usuário do vendedor da compra: ' + eu.message);
  await admin.from('lv_seller_users').insert({ seller_id: s.id, user_id: u.user.id });
  // Conta Mercado Pago do vendedor no provedor MOCK (só staging): sem ela não há cobrança.
  const { error: emp } = await admin.rpc('lv_mp_credencial_gravar', {
    p_seller: s.id, p_provedor: 'mock', p_access: `mock_access_${crypto.randomBytes(8).toString('hex')}`, p_refresh: null,
    p_mp_user_id: `mock-${s.id.slice(0, 8)}`, p_public_key: 'TEST-MOCK-PUBLIC-KEY', p_escopos: ['offline_access', 'read', 'write'],
    p_expira_em: new Date(Date.now() + 180 * 86400000).toISOString(), p_live_mode: false, p_renovacao: false,
  });
  if (emp) throw new Error('conexão mock do vendedor: ' + emp.message);
  return { sellerId: s.id, slug, varianteId: v.id, loteId: lote.id, email, senha };
}

async function fluxoCompra(browser, base, tela, codigo) {
  console.log(`\n=== COMPRA MULTILOJA E PEDIDOS · ${tela.rotulo} ===`);
  let A, B, comprador;
  try {
    A = await criarLojaDeCompra('A', tela.rotulo, { titulo: 'Café Tradicional 500 g', preco: 2490, piso: 2000, peso: 500, estoque: 10,
      faixas: [{ min_qty: 2, tipo: 'reais', valor: 100 }, { min_qty: 3, tipo: 'reais', valor: 150 }] });
    B = await criarLojaDeCompra('B', tela.rotulo, { titulo: 'Café Especial 250 g', preco: 3990, piso: 3000, peso: 250, estoque: 20,
      faixas: [{ min_qty: 3, tipo: 'percentual', valor: 500 }] });
    const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
    const email = EMAIL(`comprador-${tela.rotulo}`);
    const { data: u, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { full_name: 'Comprador Navegador' } });
    if (error) throw new Error('comprador: ' + error.message);
    comprador = { id: u.user.id, email, senha };
  } catch (e) {
    erro(`[${tela.rotulo}] preparar a compra: ${e.message}`);
    return;
  }

  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  const foto = fotografo(page, tela, 'compra');
  const campo = n => page.locator(`[data-campo="${n}"]`).first();
  const texto = async n => ((await campo(n).textContent()) ?? '').trim();
  const degrau = n => page.locator('.degrau').nth(n - 1);
  const botaoAdicionar = page.locator('.produto-compra .ao-carrinho');
  let numero = null;

  try {
    // --- carrinho com duas lojas ---
    await passarPeloPortao(page, base, `/coffeelivre/cafe/${A.slug}`, codigo);
    await degrau(2).waitFor({ state: 'visible', timeout: 30000 });
    await degrau(2).click();
    await botaoAdicionar.click();
    await navegarPorDentro(page, `/coffeelivre/cafe/${B.slug}`);
    await degrau(3).waitFor({ state: 'visible', timeout: 30000 });
    await degrau(3).click();
    await botaoAdicionar.click();
    await page.getByRole('link', { name: 'Carrinho' }).first().click();
    const blocos = page.locator('.carrinho-loja');
    checar(`[${tela.rotulo}] carrinho com um bloco por loja (2)`, await visivel(blocos) && await blocos.count() === 2);
    const subtotais = await page.locator('[data-campo="subtotal-loja"] b').allTextContents();
    checar(`[${tela.rotulo}] subtotal por loja com a escada: R$ 47,80 (2 × 23,90) e R$ 113,70 (3 × 37,90)`,
      subtotais.includes('R$ 47,80') && subtotais.includes('R$ 113,70'), `(${subtotais})`);
    checar(`[${tela.rotulo}] economia da escada por loja e total dos produtos R$ 161,50`,
      await page.locator('.carrinho-loja-economia').count() === 2 && (await texto('total-carrinho')).includes('R$ 161,50'));
    await foto('carrinho-multiloja');
    await page.locator('.carrinho').screenshot({ path: path.join(SAIDA, `compra-${tela.rotulo}-recorte-carrinho.png`) }).catch(() => {});

    // --- checkout: identificação ---
    await page.getByRole('button', { name: 'Fechar pedido' }).click();
    checar(`[${tela.rotulo}] checkout abre na identificação`, await visivel(page.getByRole('heading', { name: 'Identificação' })));
    await page.getByLabel('E-mail').fill(comprador.email);
    await page.getByLabel('Senha').fill(comprador.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // --- endereço ---
    checar(`[${tela.rotulo}] estoque reservado no banco ao sair da identificação`,
      await visivel(page.getByRole('heading', { name: 'Endereço de entrega' }))
      && (await admin.from('lv_inventory_lots').select('qtd_reservada').eq('id', A.loteId).single()).data.qtd_reservada === 2);
    await page.getByLabel('Nome completo').fill('Comprador Navegador');
    await page.getByLabel('CEP').fill('01310100');
    await page.getByLabel('Rua').fill('Avenida Paulista');
    await page.getByLabel('Número', { exact: true }).fill('1000');
    await page.getByLabel('Bairro').fill('Bela Vista');
    await page.getByLabel('Cidade').fill('São Paulo');
    await page.getByLabel('UF').selectOption('SP');
    await foto('endereco');
    await page.getByRole('button', { name: 'Continuar para entrega' }).click();

    // --- entrega ---
    const opcoes = page.locator('.ck-opcao');
    checar(`[${tela.rotulo}] entrega: 3 opções classificadas (econômico, rápido, custo-benefício)`,
      await visivel(opcoes) && await opcoes.count() === 3
      && await page.locator('.ck-etiqueta', { hasText: 'Mais econômico' }).count() === 1
      && await page.locator('.ck-etiqueta', { hasText: 'Mais rápido' }).count() === 1
      && await page.locator('.ck-etiqueta', { hasText: 'Melhor custo-benefício' }).count() === 1);
    await page.locator('.ck-opcao[data-frete="demo_padrao"]').click();
    await foto('entrega');
    await page.getByRole('button', { name: 'Continuar para pagamento' }).click();

    // --- pagamento e revisão ---
    checar(`[${tela.rotulo}] pagamento simulado: Pix e cartão, sem pedir dados de cartão`,
      await visivel(page.getByRole('radiogroup', { name: 'Forma de pagamento' })) && await page.locator('input[autocomplete="cc-number"]').count() === 0);
    await page.getByRole('button', { name: 'Revisar pedido' }).click();
    checar(`[${tela.rotulo}] revisão: duas lojas, cada uma com frete, e o tempo de reserva`,
      await visivel(page.locator('.ck-loja[data-loja]')) && await page.locator('.ck-loja[data-loja]').count() === 2 && await visivel(campo('tempo')));
    await foto('revisao');

    const { data: sim } = await admin.rpc('lv_checkout_expirar'); // não deve afetar este checkout (dentro do prazo)
    checar(`[${tela.rotulo}] job de expiração não mexe em checkout dentro do prazo`, sim != null
      && (await admin.from('lv_inventory_lots').select('qtd_reservada').eq('id', B.loteId).single()).data.qtd_reservada === 3);

    await page.getByRole('button', { name: /^Confirmar pedido/ }).click();
    await campo('numero-pedido').waitFor({ state: 'visible', timeout: 30000 });
    numero = await texto('numero-pedido');
    checar(`[${tela.rotulo}] pedido gerado com número público`, /^LV-\d{6}$/.test(numero), `(${numero})`);
    PEDIDOS_CRIADOS.push(numero);
    const { data: pedido } = await admin.from('lv_orders').select('id, status, total_cents, lv_seller_orders(id, seller_id, numero, status)').eq('numero', numero).single();
    checar(`[${tela.rotulo}] banco: 1 pedido pai e 2 subpedidos, aguardando pagamento`,
      pedido?.status === 'aguardando_pagamento' && pedido.lv_seller_orders.length === 2);
    checar(`[${tela.rotulo}] carrinho esvaziado depois de confirmar`, await page.locator('.cart').first().textContent().then(t => !/[1-9]/.test(t ?? '')).catch(() => true));
    await foto('confirmacao');

    // --- pagamento (U9.1): Pix por loja pelo provedor mock do staging ---
    checar(`[${tela.rotulo}] painel de pagamento marcado como AMBIENTE DE TESTE`, await visivel(campo('pagamento-teste')));
    await page.getByRole('button', { name: /^Gerar Pix/ }).click();
    const copiaCola = page.locator('[data-campo="pix-copia-cola"]');
    await copiaCola.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    checar(`[${tela.rotulo}] um Pix por loja (2), com copia e cola de TESTE e prazo`,
      await copiaCola.count() === 2 && (await copiaCola.first().inputValue()).startsWith('TESTE-SEM-VALOR')
      && await page.getByText(/^Pague até/).count() === 2);
    await foto('pix-por-loja');
    await page.locator('[data-campo="painel-pagamento"]').screenshot({ path: path.join(SAIDA, `compra-${tela.rotulo}-recorte-pix.png`) }).catch(() => {});
    const { data: pedPix } = await admin.from('lv_orders').select('id').eq('numero', numero).single();
    const { data: cobsPix } = await admin.from('lv_cobrancas').select('mp_payment_id, valor_cents, application_fee_cents').eq('order_id', pedPix.id);
    checar(`[${tela.rotulo}] banco: 2 cobranças separadas (Split 1:1), aguardando`, cobsPix?.length === 2 && new Set(cobsPix.map(c => c.mp_payment_id)).size === 2);
    // O comprador "paga" no provedor mock; a tela descobre sozinha pela conferência periódica.
    for (const c of cobsPix ?? []) {
      const fee = Math.floor((Number(c.valor_cents) * 99 + 5000) / 10000) + 3;
      await admin.from('lv_mp_mock_remoto').update({ status: 'approved', status_detail: 'accredited', processor_fee_cents: fee,
        net_received_cents: Number(c.valor_cents) - fee - Number(c.application_fee_cents) }).eq('mp_payment_id', c.mp_payment_id);
    }
    await campo('pagamento-aprovado').waitFor({ state: 'visible', timeout: 45000 }).catch(() => {});
    checar(`[${tela.rotulo}] pagamento aprovado aparece sozinho na tela: pedido pago`,
      await visivel(page.locator('[data-campo="status-pedido"]', { hasText: 'Pago' })) && await visivel(campo('pagamento-aprovado')));
    checar(`[${tela.rotulo}] banco: reserva virou baixa (A 10 → 8, reservado 0)`,
      (await admin.from('lv_inventory_lots').select('qtd_disponivel, qtd_reservada').eq('id', A.loteId).single()).data?.qtd_disponivel === 8
      && (await admin.from('lv_inventory_lots').select('qtd_reservada').eq('id', A.loteId).single()).data?.qtd_reservada === 0);

    // --- detalhe e Meus pedidos ---
    await page.getByRole('link', { name: 'Ver pedido' }).click();
    checar(`[${tela.rotulo}] detalhe do pedido: pago, 2 lojas, total e endereço`,
      await visivel(page.locator('[data-campo="status-pedido"]', { hasText: 'Pago' }))
      && await page.locator('[data-subpedido]').count() === 2 && (await texto('total-pedido')).includes('R$'));
    await foto('detalhe-pedido');
    await navegarPorDentro(page, '/coffeelivre/conta/pedidos');
    checar(`[${tela.rotulo}] Meus pedidos lista a compra consolidada`, await visivel(page.locator(`[data-pedido="${numero}"]`)));
    await foto('meus-pedidos');
  } catch (e) {
    erro(`[${tela.rotulo}] fluxo de compra interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, `compra-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
  } finally {
    checar(`[${tela.rotulo}] nenhum erro no console da compra`, errosDoConsole.length === 0, `(${errosDoConsole.slice(0, 3).join(' | ')})`);
    await contexto.close();
  }
  if (!numero) return;

  // --- Seller Central: cada vendedor vê só o seu subpedido ---
  for (const [letra, v, outro] of [['A', A, B], ['B', B, A]]) {
    const { contexto: cv, page: pv, errosDoConsole: ev } = await abrirContexto(browser, tela);
    const fotoV = fotografo(pv, tela, `pedidos-vendedor-${letra.toLowerCase()}`);
    try {
      await passarPeloPortao(pv, base, '/coffeelivre/vendedor', codigo);
      await pv.getByLabel('E-mail').fill(v.email);
      await pv.getByLabel('Senha').fill(v.senha);
      await pv.getByRole('button', { name: 'Entrar' }).click();
      await visivel(pv.getByRole('heading', { name: /^Olá,/ }));
      await pv.locator('.sc-menu').getByRole('link', { name: 'Pedidos' }).click();
      const cartoes = pv.locator('[data-subpedido]');
      await cartoes.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      const { data: subs } = await admin.from('lv_seller_orders').select('id, numero, seller_id').eq('order_id',
        (await admin.from('lv_orders').select('id').eq('numero', numero).single()).data.id);
      const meu = subs.find(s => s.seller_id === v.sellerId);
      const dele = subs.find(s => s.seller_id === outro.sellerId);
      checar(`[${tela.rotulo}] vendedor ${letra} vê só o próprio subpedido (${meu?.numero})`,
        await cartoes.count() === 1 && await pv.locator(`[data-subpedido="${meu?.numero}"]`).count() === 1
        && await pv.locator(`[data-subpedido="${dele?.numero}"]`).count() === 0);
      await fotoV('lista');
      if (letra === 'A') {
        // Financeiro / Mercado Pago (U9.1): conexão e pagamentos só da própria loja.
        await pv.locator('.sc-menu').getByRole('link', { name: 'Financeiro' }).click();
        await pv.locator('[data-campo="status-mercado-pago"]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        const cobrancasVend = pv.locator('[data-cobranca]');
        await cobrancasVend.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        checar(`[${tela.rotulo}] vendedor A: Mercado Pago conectado (teste) e só o pagamento dele, com líquido`,
          await visivel(pv.locator('[data-campo="status-mercado-pago"]', { hasText: 'Conectado' }))
          && await cobrancasVend.count() === 1 && ((await pv.locator('[data-campo="liquido"]').first().textContent()) ?? '').includes('R$')
          && !/mock_access_|access_token/.test(await pv.content()));
        await fotoV('financeiro');
        await pv.locator('.sc-menu').getByRole('link', { name: 'Pedidos' }).click();
        await cartoes.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        await pv.locator(`[data-subpedido="${meu.numero}"]`).click();
        checar(`[${tela.rotulo}] vendedor A: detalhe com valores congelados e repasse`,
          await visivel(pv.locator('[data-campo="valores"]')) && ((await pv.locator('[data-campo="repasse"]').textContent()) ?? '').includes('R$'));
        await pv.getByRole('button', { name: 'Iniciar separação' }).click();
        checar(`[${tela.rotulo}] vendedor A inicia separação e o status muda na tela`,
          await visivel(pv.locator('[data-campo="status-subpedido"]', { hasText: 'Em separação' })));
        const { data: depois } = await admin.from('lv_orders').select('status').eq('numero', numero).single();
        checar(`[${tela.rotulo}] banco: pedido pai em processamento`, depois.status === 'em_processamento');
        await fotoV('detalhe');
      }
    } catch (e) {
      erro(`[${tela.rotulo}] pedidos do vendedor ${letra} interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
      await pv.screenshot({ path: path.join(SAIDA, `pedidos-vendedor-${letra.toLowerCase()}-${tela.rotulo}-FALHA.png`), fullPage: true }).catch(() => {});
    } finally {
      checar(`[${tela.rotulo}] nenhum erro no console do vendedor ${letra}`, ev.length === 0, `(${ev.slice(0, 3).join(' | ')})`);
      await cv.close();
    }
  }
}

// ---------------------------------------------------------------------
// Admin temporário (só staging)
// ---------------------------------------------------------------------
async function fluxoAdmin(browser, base, codigo) {
  console.log('\n=== ADMIN TEMPORÁRIO · staging ===');
  const tela = TELAS[0];
  let adm;
  try { adm = await criarAdminTemporario(); } catch (e) { erro(e.message); return; }
  checar('admin temporário criado no staging, com e-mail de teste', adm.email.endsWith('@coffeelivre.test'));

  // Solicitação B2B criada pelo próprio teste, pelo mesmo caminho público do site:
  // a demonstração estável não é alterada.
  const empresa = `${MARCA} Admin B2B`;
  const { data: sol, error: es } = await admin.rpc('lv_b2b_solicitar', { p: {
    nome: empresa, tipo_negocio: 'cafeteria', cidade: 'Campinas', uf: 'SP', classificacao: 'Tradicional',
    gramatura_g: 500, moagem: 'Média', quantidade_kg: 40, consumo_mensal_kg: 40, frequencia: 'mensal',
  } });
  if (es || !sol?.id) erro('solicitação B2B do teste do admin: ' + (es?.message ?? JSON.stringify(sol)));
  const statusNoBanco = async () => (await admin.from('lv_b2b_solicitacoes').select('status').eq('id', sol?.id).single()).data?.status;

  // A aba Vendedores é a fila de CANDIDATURAS. O staging não recebe candidaturas
  // no seed (podem ter dado pessoal), então o teste cria uma, marcada.
  const marcaCandidata = `${MARCA} Candidata`;
  const { error: ec } = await admin.from('lv_seller_applications').insert({
    nome_marca: marcaCandidata, tipo: 'torrefacao', responsavel: 'Responsável fictício',
    email: EMAIL('candidata'), cidade: 'Campinas', uf: 'SP', status: 'interessado',
  });
  if (ec) erro('candidatura do teste do admin: ' + ec.message);

  const { contexto, page, errosDoConsole } = await abrirContexto(browser, tela);
  // Toda resposta com erro vira linha no relatório: o console só diz "status 400".
  const respostasComErro = [];
  page.on('response', r => {
    if (r.status() >= 400) respostasComErro.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]}`);
  });
  const foto = fotografo(page, tela, 'admin');
  const irParaCoffeeLivre = async (p) => {
    // Com o deep-link a aba já está aberta; o clique é idempotente.
    await p.getByRole('button', { name: 'Plataformas', exact: true }).click();
    await p.getByRole('button', { name: /Coffee LiVRE/ }).first().click();
    return visivel(p.getByRole('heading', { name: 'Coffee LiVRE', exact: true }));
  };
  const linhaDaEmpresa = p => p.locator('div, li, tr').filter({ hasText: empresa })
    .filter({ has: p.getByLabel('Status da solicitação') }).last();

  try {
    // Login por senha no formulário real do Coffee LiVRE (mesmo cliente Supabase do site).
    // A home da Saporino abre no HERO, cuja entrada depende da animação de rolagem.
    await passarPeloPortao(page, base, '/coffeelivre/vendedor', codigo);
    await page.getByLabel('E-mail').fill(adm.email);
    await page.getByLabel('Senha').fill(adm.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    const logou = await page.waitForFunction(
      () => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')), null, { timeout: 20000 },
    ).then(() => true, () => false);
    checar('admin temporário autenticou por senha (Supabase Auth)', logou);

    // Abre direto em Plataformas pelo deep-link do próprio painel. A aba inicial
    // (Dashboard da Saporino) tem um 400 conhecido — filtro por
    // user_profiles.account_type, coluna que não existe nem em produção — e não
    // faz parte do Coffee LiVRE.
    const abrirNoCoffeeLivre = async () => page.evaluate(() => localStorage.setItem('admin-initial-tab', 'coffee_network'));
    await abrirNoCoffeeLivre();
    await abrir(page, base + '/admin');
    checar('/admin abre o Painel Administrativo', await visivel(page.getByRole('heading', { name: 'Painel Administrativo' })));
    checar('papel exibido: Administrador', await visivel(page.getByText('Administrador', { exact: true })));
    checar('Plataformas → Coffee LiVRE', await irParaCoffeeLivre(page));

    const aba = async (nome, titulo, conteudo) => {
      // .last(): o painel da Saporino também tem um botão "Pedidos"; a subaba do Coffee LiVRE vem depois.
      await page.getByRole('button', { name: nome, exact: true }).last().click();
      const ok = await visivel(page.getByRole('heading', { name: titulo, exact: true }))
        && (!conteudo || await visivel(page.getByText(conteudo).first()));
      checar(`aba ${nome}: "${titulo}"${conteudo ? ` mostra "${conteudo}"` : ''}`, ok);
      await foto(nome);
    };
    await aba('Vendedores', 'Vendedores', marcaCandidata);
    await aba('Moderação', 'Moderação');
    await aba('Calculadora', 'Calculadora de Economia', 'Mercado Livre');
    await aba('Preços', 'Preços e comparação');
    if (PEDIDOS_CRIADOS.length) {
      await aba('Pagamentos', 'Pagamentos');
      checar('admin vê os pagamentos por subpedido com taxa estimada/real e ação de reconciliar',
        await visivel(page.getByText('Taxa MP estimada / real').first()) && await page.getByRole('button', { name: 'Reconciliar', exact: true }).count() >= 2);
      await aba('Pedidos', 'Pedidos', PEDIDOS_CRIADOS[0]);
      await page.locator(`[data-pedido="${PEDIDOS_CRIADOS[0]}"] button`).first().click();
      checar('admin abre o pedido: subpedidos, reservas por lote e eventos',
        await visivel(page.getByRole('heading', { name: 'Estoque reservado' })) && await visivel(page.getByRole('heading', { name: 'Eventos' }))
        && await visivel(page.getByText('pagamento aprovado').first()));
    }
    await aba('Empresas (B2B)', 'Empresas (B2B)', empresa);

    await linhaDaEmpresa(page).getByLabel('Status da solicitação').selectOption('em_analise');
    let status = null;
    for (let i = 0; i < 20 && status !== 'em_analise'; i++) { await page.waitForTimeout(500); status = await statusNoBanco(); }
    checar('admin muda o status da solicitação B2B na tela → banco "em_analise"', status === 'em_analise', `(veio ${status})`);

    await abrirNoCoffeeLivre();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visivel(page.getByRole('heading', { name: 'Painel Administrativo' }));
    await irParaCoffeeLivre(page);
    await page.getByRole('button', { name: 'Empresas (B2B)', exact: true }).click();
    await visivel(page.getByText(empresa).first());
    checar('recarregado, o status continua "em análise" na tela',
      (await linhaDaEmpresa(page).getByLabel('Status da solicitação').inputValue()) === 'em_analise');
    await foto('b2b-status-persistido');
    await linhaDaEmpresa(page).screenshot({ path: path.join(SAIDA, 'admin-desktop-recorte-b2b-status.png') }).catch(() => {});

    // 375 px com a MESMA sessão (copiada do login real acima). O painel administrativo
    // não foi desenhado para celular: registra como fica, não reprova.
    const movel = await browser.newContext({
      viewport: TELAS[1].viewport, isMobile: true, hasTouch: true, locale: 'pt-BR', storageState: await contexto.storageState(),
    });
    try {
      const pm = await movel.newPage();
      pm.on('request', r => { const u = r.url(); if (u.includes('.supabase.co')) HOSTS.add(new URL(u).hostname); });
      await abrir(pm, base + '/');
      await pm.evaluate(() => localStorage.setItem('admin-initial-tab', 'coffee_network'));
      await abrir(pm, base + '/admin');
      const abriu = await visivel(pm.getByRole('heading', { name: 'Painel Administrativo' }));
      checar('[375] /admin abre com a sessão do admin', abriu);
      await irParaCoffeeLivre(pm).catch(() => false);
      await pm.getByRole('button', { name: 'Empresas (B2B)', exact: true }).click().catch(() => {});
      await pm.waitForTimeout(1500);
      await pm.screenshot({ path: path.join(SAIDA, 'admin-375-empresas.png'), fullPage: true });
      const largura = await pm.evaluate(() => document.documentElement.scrollWidth);
      console.log(`  --  [375] admin: documento com ${largura}px de largura (informativo; painel administrativo é de desktop)`);
    } catch (e) {
      console.log(`  --  [375] admin não navegável no celular: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    } finally {
      await movel.close();
    }

    await page.getByTitle('Sair').click();
    await page.waitForTimeout(1500);
    await abrir(page, base + '/admin');
    checar('depois de sair, /admin nega o acesso', await visivel(page.getByRole('heading', { name: 'Acesso Negado' })));
  } catch (e) {
    erro(`fluxo do admin interrompido: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    await page.screenshot({ path: path.join(SAIDA, 'admin-desktop-FALHA.png'), fullPage: true }).catch(() => {});
  } finally {
    // Defeito CONHECIDO e anterior do painel da Saporino (não do Coffee LiVRE nem do
    // staging): o casco do /admin conta clientes por user_profiles.account_type,
    // coluna que não existe — 400 reproduzido também em PRODUÇÃO em 13/09/2026 —
    // e dispara uma leitura de orders que também volta 400. Tarefa separada.
    // Só esses dois são tolerados; qualquer outro erro reprova.
    const CONHECIDOS = new Set(['400 GET /rest/v1/orders', '400 HEAD /rest/v1/user_profiles', '400 GET /rest/v1/user_profiles']);
    const respostas = [...new Set(respostasComErro)];
    const desconhecidas = respostas.filter(r => !CONHECIDOS.has(r));
    const errosNao400 = errosDoConsole.filter(t => !/status of 400/.test(t));
    for (const r of respostas) console.log(`  --  resposta com erro no admin: ${r}${CONHECIDOS.has(r) ? ' (conhecido, Dashboard da Saporino, existe em produção)' : ''}`);
    checar('nenhum erro no console do admin além do defeito conhecido do Dashboard da Saporino',
      desconhecidas.length === 0 && errosNao400.length === 0 && (errosDoConsole.length - errosNao400.length) <= respostasComErro.length,
      `(${[...desconhecidas, ...errosNao400].slice(0, 3).join(' | ')})`);
    await contexto.close();
    await admin.from('lv_b2b_empresas').delete().eq('nome', empresa);
    await admin.from('lv_seller_applications').delete().eq('nome_marca', marcaCandidata);
    await admin.auth.admin.deleteUser(adm.id);
    const { data: perfil } = await admin.from('user_profiles').select('id').eq('id', adm.id).maybeSingle();
    checar('admin temporário removido (usuário e perfil)', !(await acharUsuario(adm.email)) && !perfil);
  }
}

// ---------------------------------------------------------------------
fs.mkdirSync(SAIDA, { recursive: true });
for (const f of fs.readdirSync(SAIDA)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SAIDA, f));

let servidor = null;
let browser = null;
try {
  await limpar();
  servidor = await subirServidor();
  const codigo = await criarCodigoDeAcesso();
  browser = await chromium.launch({ channel: 'chrome', headless: !MOSTRAR })
    .catch(() => chromium.launch({ channel: 'msedge', headless: !MOSTRAR }));
  // --so=vendedor | comprador | calculadora roda só um fluxo.
  const so = argumento('so')?.split('=')[1];
  for (const tela of TELAS) {
    if (!so || so === 'vendedor') await fluxoVendedor(browser, servidor.base, tela, codigo);
    if (!so || so === 'comprador') await fluxoComprador(browser, servidor.base, tela, codigo);
    if (!so || so === 'calculadora') await fluxoCalculadora(browser, servidor.base, tela, codigo);
    if (!so || so === 'mercado') await fluxoMercado(browser, servidor.base, tela, codigo);
    if (!so || so === 'empresas') await fluxoEmpresas(browser, servidor.base, tela, codigo);
    if (!so || so === 'compra' || so === 'admin') await fluxoCompra(browser, servidor.base, tela, codigo);
  }
  if (!so || so === 'admin') await fluxoAdmin(browser, servidor.base, codigo);
} catch (e) {
  erro('bancada do navegador interrompida: ' + (e instanceof Error ? e.message : e));
} finally {
  await browser?.close().catch(() => {});
  servidor?.parar();
  await limpar();
  const { data: sobras } = await admin.from('lv_stores').select('slug').like('slug', `${MARCA}%`);
  const { data: codigos } = await admin.from('lv_demo_access').select('id').like('label', `${MARCA}%`);
  checar('limpeza: nenhuma loja, vendedor ou código de teste sobrou', !sobras?.length && !codigos?.length);
  checar(`o Chrome só falou com o Supabase do staging (${ambiente.ref})`,
    HOSTS.size > 0 && [...HOSTS].every(h => h.startsWith(ambiente.ref + '.')), `(${[...HOSTS].join(', ')})`);
  console.log(`\nCapturas em ${path.relative(RAIZ, SAIDA)}`);
  console.log(`\n${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
  if (falhas) process.exitCode = 1;
}
