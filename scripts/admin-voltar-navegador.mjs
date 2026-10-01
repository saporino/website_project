// "Voltar" das telas de fora do painel — bancada de NAVEGADOR no staging.
//
// Regra: voltar devolve a pessoa AO LUGAR DE ONDE SAIU, nunca ao Dashboard.
// Hoje isso vale para a Inteligência Comercial (abre em RepCo › Representantes) e para o
// mapa de prospecção (abre em RepCo › Prospecção).
//   node scripts/admin-voltar-navegador.mjs [--mostrar]

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

const MARCA = 'teste-voltar';
const PORTA = 5197;
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  await admin.from('companies').delete().like('name', `${MARCA}%`);
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
const { data: empresa } = await admin.from('companies')
  .insert({ name: `${MARCA} Empresa`, fantasia: MARCA, is_active: true, is_operator: false, sort_order: 1 }).select('id').single();
const email = `${MARCA}-admin@coffeelivre.test`;
const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const { data: criado, error: ec } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (ec) throw new Error(ec.message);
await admin.from('user_profiles').upsert({ id: criado.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
const { data: login, error: el } = await cli.auth.signInWithPassword({ email, password: senha });
if (el) throw new Error(el.message);

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  await ctx.addInitScript(([k, v, emp]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('admin-initial-tab', 'repco');
    localStorage.setItem('active-company-id', emp);
  }, [`sb-${ambiente.ref}-auth-token`, JSON.stringify(login.session), empresa.id]);
  const page = await ctx.newPage();

  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  checar('RepCo abre', await visivel(page.getByRole('heading', { name: 'Representantes Comerciais' }), 90000));

  await page.getByRole('button', { name: 'Inteligência' }).click();
  checar('Inteligência Comercial abre', await visivel(page.getByRole('heading', { name: 'Inteligência Comercial' }), 30000));
  await page.getByRole('button').first().click();  // seta de voltar
  checar('voltar devolve para RepCo › Representantes, não para o Dashboard',
    await visivel(page.getByRole('heading', { name: 'Representantes Comerciais' }), 30000));

  await page.getByRole('button', { name: 'Prospecção' }).click();
  const abriuProspeccao = await visivel(page.getByRole('button', { name: /Mapa|mapa/ }), 20000);
  if (abriuProspeccao) {
    await page.getByRole('button', { name: /Mapa|mapa/ }).first().click();
    if (await visivel(page.getByRole('heading', { name: 'Mapa de prospecção' }), 30000)) {
      await page.getByRole('button').first().click();
      const voltou = await visivel(page.getByRole('heading', { name: /Prospecção/ }), 30000);
      if (!voltou) console.log('      na tela:', JSON.stringify((await page.locator('h1,h2,h3').allTextContents()).slice(0, 8)),
        '· guardado:', await page.evaluate(() => [localStorage.getItem('admin-initial-tab'), localStorage.getItem('repco-initial-view')]));
      checar('voltar do mapa devolve para RepCo › Prospecção', voltou);
    } else checar('mapa de prospecção abre', false, 'não abriu');
  } else {
    console.log('  --  Prospecção sem botão de mapa neste ambiente (sem lista carregada): parte pulada');
  }
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
