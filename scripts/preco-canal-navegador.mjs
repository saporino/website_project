// PREÇO POR CANAL NA TELA — bancada de NAVEGADOR no staging.
//
// A bancada de banco (`auditoria-precos-por-canal.mjs`) prova a regra. Esta
// prova o que ele vai fazer: abrir a ficha, definir um preço na COFICO, e o
// preço da loja Saporino continuar onde estava.
//
// É o par que faltava. `typecheck` e teste de banco não pegam uma tela que
// pré-preenche o campo da COFICO com o preço da Saporino — e é assim que o
// vazamento voltaria.
//
//   node scripts/preco-canal-navegador.mjs [--mostrar]

import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-preco-canal';
const PORTA = 5199;
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  const { data: ps } = await admin.from('products').select('id').like('name', `${MARCA}%`);
  for (const p of ps ?? []) await admin.from('product_channel_prices').delete().eq('product_id', p.id);
  await admin.from('products').delete().like('name', `${MARCA}%`);
  await admin.from('companies').delete().like('name', `${MARCA}%`);
  for (let p = 1; p <= 20; p++) {
    const { data: u } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const x of (u?.users ?? []).filter(x => x.email?.startsWith(MARCA))) {
      await admin.from('user_roles').delete().eq('user_id', x.id);
      await admin.auth.admin.deleteUser(x.id);
    }
    if (!u?.users || u.users.length < 200) break;
  }
}
async function subirVite() {
  const vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js'), '--port', String(PORTA), '--strictPort', '--mode', 'staging'], { cwd: RAIZ, stdio: 'ignore' });
  const base = `http://localhost:${PORTA}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base)).ok) return { base, parar: () => vite.kill() }; } catch { /* subindo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  vite.kill(); throw new Error('o Vite não respondeu');
}
const visivel = async (loc, ms = 20000) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };

await limpar();
const { data: empresa } = await admin.from('companies')
  .insert({ name: `${MARCA} Empresa`, fantasia: MARCA, is_active: true, is_operator: false, sort_order: 1 }).select('id').single();

// Um café com preço e promoção na loja — o estado que não pode ser perturbado.
const PRECO_LOJA = 23.9, PROMO_LOJA = 21.9, PRECO_COFICO = 19.5;
const { data: cafe } = await admin.from('products').insert({
  name: `${MARCA} Café`, description: 'café da bancada', price: PRECO_LOJA, promotional_price: PROMO_LOJA,
  weight_grams: 500, is_active: true, hidden_from_store: false, category: 'café',
  company_id: empresa.id, sales_channels: ['saporino', 'cofico'],
}).select('id').single();

const email = `${MARCA}-admin@coffeelivre.test`;
const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const { data: criado, error: ec } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (ec) throw new Error(ec.message);
await admin.from('user_profiles').upsert({ id: criado.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
// ⚠️ QUEM DECIDE SE É ADMIN É `user_roles`, não `user_profiles.is_admin`.
// `is_admin()` — a função que toda policy chama — lê `user_roles.role_code`.
// Montar o admin só no perfil dá um usuário que ENTRA no painel e não consegue
// gravar nada: foi exatamente o que esta bancada pegou na primeira execução.
await admin.from('user_roles').insert({ user_id: criado.user.id, role_code: 'admin', is_active: true });
const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
const { data: login, error: el } = await cli.auth.signInWithPassword({ email, password: senha });
if (el) throw new Error(el.message);

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

const precoNoBanco = async (canal) => {
  const { data } = await admin.from('vw_precos_por_canal')
    .select('preco_final, definido, fonte').eq('product_id', cafe.id).eq('canal', canal).single();
  return data;
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'pt-BR' });
  await ctx.addInitScript(([k, v, emp]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('admin-initial-tab', 'products');
    localStorage.setItem('active-company-id', emp);
  }, [`sb-${ambiente.ref}-auth-token`, JSON.stringify(login.session), empresa.id]);
  const page = await ctx.newPage();

  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  checar('Produtos abre', await visivel(page.getByRole('heading', { name: 'Gerenciamento de Produtos' }), 90000));

  // Abre a ficha pelo botão de editar. Ele tem nome acessível — sem isso nem o
  // leitor de tela nem esta bancada o encontram.
  await page.getByRole('button', { name: `Editar ${MARCA} Café` }).first().click();
  checar('o bloco "Preço por canal" aparece na ficha', await visivel(page.getByText('Preço por canal'), 20000));

  // ── o estado inicial diz a verdade ────────────────────────────────────────
  checar('COFICO começa SEM PREÇO (não herda o da loja)',
    await visivel(page.getByText('Sem preço — não vende por aqui.').first(), 10000));
  const cofAntes = await precoNoBanco('cofico');
  checar('e o banco concorda: COFICO indefinida', cofAntes.definido === false, `fonte=${cofAntes.fonte}`);

  const sapAntes = await precoNoBanco('saporino');
  checar(`a loja cobra a promoção de R$ ${PROMO_LOJA}`,
    Number(sapAntes.preco_final) === PROMO_LOJA, `veio ${sapAntes.preco_final}`);

  // ── define o preço da COFICO ──────────────────────────────────────────────
  // Os TRÊS canais oferecem "Definir preço" — inclusive a Saporino, que hoje
  // herda do produto mas pode ganhar preço próprio. O cartão da COFICO é o
  // segundo, na ordem Saporino · COFICO · CASA COFICO.
  const definir = page.getByRole('button', { name: 'Definir preço' });
  checar('os três canais oferecem definir preço', (await definir.count()) === 3,
    `${await definir.count()} botões`);

  const cartaoCofico = page.locator('div.rounded-lg.border-2').filter({ hasText: 'coficobrasil.com.br' }).first();
  await cartaoCofico.getByRole('button', { name: 'Definir preço' }).click();

  const campoPreco = cartaoCofico.getByPlaceholder('Preço');
  checar('o campo da COFICO abre VAZIO (não sugere o preço da loja)',
    (await campoPreco.inputValue()) === '', `veio "${await campoPreco.inputValue()}"`);

  await campoPreco.fill(String(PRECO_COFICO));
  // Escopado ao cartão: a ficha inteira tem outro "Salvar", o do produto.
  await cartaoCofico.getByRole('button', { name: /Salvar/ }).click();
  await page.waitForTimeout(2500);

  // ── a prova ───────────────────────────────────────────────────────────────
  const cofDepois = await precoNoBanco('cofico');
  const sapDepois = await precoNoBanco('saporino');
  checar(`a COFICO passa a cobrar R$ ${PRECO_COFICO}, do canal`,
    cofDepois.definido && cofDepois.fonte === 'canal' && Number(cofDepois.preco_final) === PRECO_COFICO,
    `fonte=${cofDepois.fonte} valor=${cofDepois.preco_final}`);
  checar('a LOJA SAPORINO não se mexeu',
    Number(sapDepois.preco_final) === Number(sapAntes.preco_final) && sapDepois.fonte === 'produto',
    `${sapAntes.preco_final} → ${sapDepois.preco_final} (${sapDepois.fonte})`);
  checar('os marketplaces continuam SEM PREÇO (um canal não contamina o outro)',
    (await precoNoBanco('marketplaces')).definido === false);

  // ── o produto em si não foi tocado ────────────────────────────────────────
  const { data: pDepois } = await admin.from('products').select('price, promotional_price').eq('id', cafe.id).single();
  checar('`products.price` e `promotional_price` continuam intactos',
    Number(pDepois.price) === PRECO_LOJA && Number(pDepois.promotional_price) === PROMO_LOJA,
    `${pDepois.price} / ${pDepois.promotional_price}`);
} catch (e) {
  falhas++;
  console.log('\n  !!  erro inesperado: ' + e.message);
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
}

console.log(`\n${criterios - falhas}/${criterios} critérios${falhas ? ` — ${falhas} FALHA(S)` : ' — tudo certo'}`);
process.exit(falhas ? 1 : 0);
