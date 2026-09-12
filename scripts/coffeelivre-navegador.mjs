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

const RAIZ = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  const vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js'), '--port', String(PORTA), '--strictPort'], {
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
  for (const { rotulo } of TELAS) {
    const { data: lojas } = await admin.from('lv_stores').select('id').eq('slug', LOJA(rotulo));
    for (const l of lojas ?? []) await admin.from('lv_products').delete().eq('store_id', l.id);
    await admin.from('lv_stores').delete().eq('slug', LOJA(rotulo));
    await admin.from('lv_sellers').delete().eq('nome_fantasia', VENDEDOR(rotulo));
    const u = await acharUsuario(EMAIL(rotulo));
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
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
  await page.getByPlaceholder('Código de acesso').fill(codigo);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

const visivel = async (localizador) => {
  try { await localizador.first().waitFor({ state: 'visible', timeout: 15000 }); return true; } catch { return false; }
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
  for (const tela of TELAS) {
    await fluxoVendedor(browser, servidor.base, tela, codigo);
    await fluxoComprador(browser, servidor.base, tela, codigo);
  }
} catch (e) {
  erro('bancada do navegador interrompida: ' + (e instanceof Error ? e.message : e));
} finally {
  await browser?.close().catch(() => {});
  servidor?.parar();
  await limpar();
  const { data: sobras } = await admin.from('lv_stores').select('slug').like('slug', `${MARCA}%`);
  const { data: codigos } = await admin.from('lv_demo_access').select('id').like('label', `${MARCA}%`);
  checar('limpeza: nenhuma loja, vendedor ou código de teste sobrou', !sobras?.length && !codigos?.length);
  console.log(`\nCapturas em ${path.relative(RAIZ, SAIDA)}`);
  console.log(`\n${falhas === 0 ? 'TODOS OS CRITÉRIOS PASSARAM' : falhas + ' CRITÉRIO(S) FALHARAM'}\n`);
  if (falhas) process.exitCode = 1;
}
