// COFICO — clonar produto de outra marca + liga/desliga da empresa no site.
// Bancada de NAVEGADOR no staging (desktop), com admin temporário e sessão injetada.
//
// Prova o fluxo real: Admin › Produtos (empresa COFICO) › "Clonar de outra marca" ›
// marca a marca toda › clona › os produtos nascem na COFICO com canal cofico; e o site da
// COFICO esconde a marca quando a empresa é desligada em Configurações.
// Tudo com o prefixo `teste-cofico` e apagado no fim. Capturas em test-results/cofico-clonagem/.
//   node scripts/cofico-clonagem-navegador.mjs [--mostrar]

import fs from 'node:fs';
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

const MARCA = 'teste-cofico';
const PORTA = 5193;
const SAIDA = path.join(RAIZ, 'test-results', 'cofico-clonagem');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  const { data } = await admin.from('companies').select('id').in('name', [`Marca Origem ${MARCA}`, `COFICO ${MARCA}`]);
  const ids = (data ?? []).map(c => c.id);
  if (ids.length) {
    await admin.from('products').delete().in('company_id', ids);
    await admin.from('companies').delete().in('id', ids);
  }
  await admin.from('products').delete().like('name', `${MARCA}%`);
  for (let p = 1; p <= 20; p++) {
    const { data: u } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const x of (u?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(x.id);
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
const { data: emp, error: eEmp } = await admin.from('companies').insert([
  { name: `Marca Origem ${MARCA}`, fantasia: `ORIGEM ${MARCA}`, is_active: true, is_operator: false, sort_order: 1 },
  { name: `COFICO ${MARCA}`, fantasia: `COFICO ${MARCA}`, is_active: true, is_operator: true, sort_order: 2 },
]).select('id, name');
if (eEmp) throw new Error(eEmp.message);
const origem = emp.find(e => e.name.startsWith('Marca')), cofico = emp.find(e => e.name.startsWith('COFICO'));
const { error: eProd } = await admin.from('products').insert([
  { name: `${MARCA} Café Um`, description: 'Café de teste um', price: 20, weight_grams: 500, category: 'Café Moído', company_id: origem.id, is_active: true, hidden_from_store: false, sales_channels: ['saporino'], stock: 10 },
  { name: `${MARCA} Café Dois`, description: 'Café de teste dois', price: 30, weight_grams: 500, category: 'Café Moído', company_id: origem.id, is_active: true, hidden_from_store: false, sales_channels: ['saporino'], stock: 10 },
]);
if (eProd) throw new Error(eProd.message);

const email = `${MARCA}-admin@coffeelivre.test`;
const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const { data: criado, error: ec } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (ec) throw new Error(ec.message);
await admin.from('user_profiles').upsert({ id: criado.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
const { data: login, error: el } = await cli.auth.signInWithPassword({ email, password: senha });
if (el) throw new Error(el.message);
const chaveSessao = `sb-${ambiente.ref}-auth-token`;
const sessao = JSON.stringify(login.session);

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  await ctx.addInitScript(([k, v, empresa]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('admin-initial-tab', 'products');
    localStorage.setItem('active-company-id', empresa); // abre já na COFICO
  }, [chaveSessao, sessao, cofico.id]);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });

  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  checar('Produtos abre', await visivel(page.getByRole('heading', { name: 'Gerenciamento de Produtos' }), 90000));

  // Garante a empresa COFICO ativa no seletor do topo (o localStorage pode ter outra chave).
  const seletor = page.locator('header button', { hasText: 'COFICO' });
  if (await seletor.count()) { await seletor.first().click(); await page.getByRole('button', { name: new RegExp(`COFICO ${MARCA}`, 'i') }).first().click().catch(() => {}); }

  await page.getByRole('button', { name: 'Clonar de outra marca' }).click();
  checar('janela de clonagem abre com os produtos da outra marca',
    await visivel(page.getByText(`${MARCA} Café Um`)) && await visivel(page.getByText(`${MARCA} Café Dois`)));
  await page.getByText('marcar a marca toda').first().click();
  await page.screenshot({ path: path.join(SAIDA, 'clonagem.png') });
  await page.getByRole('button', { name: /^Clonar 2/ }).click();
  await page.waitForTimeout(2500);

  const { data: clones } = await admin.from('products').select('name, company_id, sales_channels, stock, price').eq('company_id', cofico.id);
  checar('os 2 produtos nascem na COFICO', clones?.length === 2, JSON.stringify(clones));
  checar('cópia nasce no canal cofico e com estoque zero',
    (clones ?? []).every(c => c.sales_channels?.includes('cofico') && Number(c.stock) === 0), JSON.stringify(clones));
  checar('o original continua na marca de origem',
    (await admin.from('products').select('id').eq('company_id', origem.id)).data?.length === 2);
  checar('a lista da COFICO mostra os clones', await visivel(page.getByText(`${MARCA} Café Um`), 15000));
  await page.screenshot({ path: path.join(SAIDA, 'clonados.png') });

  // Liga/desliga da empresa no site da COFICO
  const naVitrine = async () => (await admin.from('vw_cofico_vitrine').select('name').eq('company_id', cofico.id)).data ?? [];
  await admin.from('products').update({ stock: 5 }).eq('company_id', cofico.id);
  checar('ligada: os produtos aparecem na vitrine pública', (await naVitrine()).length === 2);
  await admin.from('companies').update({ cofico_visivel: false }).eq('id', cofico.id);
  checar('desligada: some da vitrine pública', (await naVitrine()).length === 0);
  const { data: marcas } = await admin.from('vw_cofico_marcas').select('marca');
  // só a empresa desligada some; a outra (origem) continua listada
  checar('desligada: some de "Marcas que distribuímos", e só ela',
    !(marcas ?? []).some(m => m.marca === `COFICO ${MARCA}`) && (marcas ?? []).some(m => m.marca === `ORIGEM ${MARCA}`),
    JSON.stringify(marcas));
  await admin.from('companies').update({ cofico_visivel: true }).eq('id', cofico.id);
  checar('religada: volta tudo, sem perder produto', (await naVitrine()).length === 2);
  checar('desligar não apaga nada',
    (await admin.from('products').select('id').eq('company_id', cofico.id)).data?.length === 2);

  checar('sem erro no console', erros.length === 0, erros.slice(0, 3).join(' | '));
  await ctx.close();
} catch (e) {
  falhas++;
  console.log('\n  !!  erro inesperado: ' + e.message);
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
  console.log('\n  dados de teste apagados');
}

console.log(`\n${criterios - falhas}/${criterios} critérios${falhas ? ` — ${falhas} FALHA(S)` : ' — tudo certo'}`);
process.exit(falhas ? 1 : 0);
