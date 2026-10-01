// Configurações › Empresas — bancada de NAVEGADOR no staging.
//
// Regra: desativar uma empresa tira ela do SELETOR do topo, mas ela continua na lista de
// Configurações, com aviso e com o caminho de volta. Antes sumia das duas e não havia como religar.
//   node scripts/empresas-navegador.mjs [--mostrar]

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

const MARCA = 'teste-empresas';
const PORTA = 5199;
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
const { data: emps } = await admin.from('companies').insert([
  { name: `${MARCA} Principal`, fantasia: `${MARCA} PRINCIPAL`, is_active: true, is_operator: false, sort_order: 1 },
  { name: `${MARCA} Segunda`, fantasia: `${MARCA} SEGUNDA`, is_active: true, is_operator: false, sort_order: 2 },
]).select('id, name');
const segunda = emps.find(e => e.name.endsWith('Segunda'));

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
    localStorage.setItem('admin-initial-tab', 'settings');
    localStorage.setItem('active-company-id', emp);
  }, [`sb-${ambiente.ref}-auth-token`, JSON.stringify(login.session), emps[0].id]);
  const page = await ctx.newPage();

  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  checar('Configurações › Empresas abre', await visivel(page.getByRole('heading', { name: 'Empresas' }), 90000));
  const linha = page.locator('input[value$="Segunda"]');
  checar('as duas empresas aparecem', await visivel(linha));

  // desativa a segunda pela própria tela (o cartão é o ancestral com borda arredondada)
  const cartaoDa = (sufixo) => page.locator(`input[value$="${sufixo}"]`)
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  const cartao = cartaoDa('Segunda');
  await cartao.locator('input[type=checkbox]').first().uncheck();
  await cartao.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(2000);

  const { data: depois } = await admin.from('companies').select('is_active').eq('id', segunda.id).maybeSingle();
  checar('desativar grava no banco', depois?.is_active === false);
  checar('empresa desativada CONTINUA na lista de Configurações', await visivel(page.locator('input[value$="Segunda"]'), 10000));
  checar('a lista avisa que está desativada e como voltar',
    await visivel(page.getByText(/Desativada — não aparece no seletor/), 10000));

  // e volta pelo mesmo caminho
  const cartao2 = cartaoDa('Segunda');
  await cartao2.locator('input[type=checkbox]').first().check();
  await cartao2.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(2000);
  const { data: devolta } = await admin.from('companies').select('is_active').eq('id', segunda.id).maybeSingle();
  checar('dá para religar pela mesma tela', devolta?.is_active === true);
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
