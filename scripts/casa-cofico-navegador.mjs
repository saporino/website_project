// CASA COFICO — bancada de NAVEGADOR.
//
// Prova que a sub-aba monta, aparece no lugar certo e não quebra. O DADO que
// ela mostra vem de `ecommerce_price_snapshots`, que no staging está vazio —
// então aqui o teste é de estrutura, e está dito. O conteúdo é conferido por
// consulta ao banco de produção, à parte.
//
//   node scripts/casa-cofico-navegador.mjs [--mostrar]

import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);

const MARCA = 'casacofico';
let falhas = 0;
const checar = (o, ok) => { console.log((ok ? '  ok   ' : '  FALHA') + '  ' + o); if (!ok) falhas++; };
const visivel = async (loc, ms = 20000) => {
  try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; }
};

async function subirVite() {
  // --mode staging e obrigatorio: sem ele o Vite le o .env de PRODUCAO, o app
  // conversa com outro banco, e a sessao de staging injetada no localStorage
  // nao vale nada — a tela mostra "Acesso restrito" e parece defeito de
  // permissao quando e so o ambiente errado.
  const vite = spawn(process.execPath,
    [path.join(RAIZ, 'node_modules/vite/bin/vite.js'), '--port', '5199', '--strictPort', '--mode', 'staging'],
    { cwd: RAIZ, stdio: 'ignore' });
  const base = 'http://localhost:5199';
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) return { base, parar: () => vite.kill() }; } catch { /* subindo */ }
    await new Promise(r => setTimeout(r, 500));
  }
  vite.kill(); throw new Error('o Vite não respondeu');
}

async function limpar() {
  const { data: us } = await admin.auth.admin.listUsers();
  for (const u of us?.users ?? []) {
    if (u.email?.startsWith(MARCA)) await admin.auth.admin.deleteUser(u.id);
  }
}

await limpar();
// O painel admin precisa de uma empresa ativa para abrir o RepCo. Sem ela a
// aba nem aparece — e o sintoma parece falta de permissao.
const { data: empresa } = await admin.from('companies')
  .insert({ name: 'CASA COFICO Teste', fantasia: 'CASACOFICO', is_active: true, is_operator: false, sort_order: 1 })
  .select('id').single();

const email = `${MARCA}-admin@coffeelivre.test`;
const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const { data: criado, error: ec } = await admin.auth.admin.createUser(
  { email, password: senha, email_confirm: true });
if (ec) throw new Error(ec.message);
const { error: ep } = await admin.from('user_profiles')
  .upsert({ id: criado.user.id, full_name: 'Admin CASA COFICO', is_admin: true });
if (ep) throw new Error('perfil: ' + ep.message);
const { data: conf } = await admin.from('user_profiles')
  .select('is_admin').eq('id', criado.user.id).maybeSingle();
console.log('  perfil admin no banco:', conf?.is_admin);

const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
const { data: login, error: el } = await cli.auth.signInWithPassword({ email, password: senha });
if (el) throw new Error(el.message);

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 950 }, locale: 'pt-BR' });
  await ctx.addInitScript(([k, v, emp]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('admin-initial-tab', 'repco');
    localStorage.setItem('active-company-id', emp);
  }, [`sb-${ambiente.ref}-auth-token`, JSON.stringify(login.session), empresa.id]);
  const page = await ctx.newPage();

  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push(String(e)));

  // Entra pelo /admin e navega, como a pessoa faz. Abrir /repco/inteligencia
  // direto mostrou "Acesso restrito" — ver a nota no fim do arquivo.
  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  const abriu = await visivel(page.getByRole('heading', { name: 'Representantes Comerciais' }), 45000);
  checar('RepCo abre', abriu);
  if (!abriu) { console.log('PAGINA:', (await page.innerText('body')).slice(0, 400)); }
  await page.getByRole('button', { name: 'Inteligência' }).click({ timeout: 60000 });
  checar('Inteligência Comercial abre',
    await visivel(page.getByRole('heading', { name: 'Inteligência Comercial' }), 90000));

  checar('a sub-aba CASA COFICO existe',
    await visivel(page.getByRole('button', { name: /CASA COFICO/i }), 20000));
  checar('e a aba das nossas vendas continua lá',
    await visivel(page.getByRole('button', { name: /Nossas vendas/i }), 10000));

  if (falhas) {
    console.log('--- o que a pagina mostrou ---');
    const diag = await page.evaluate(() => ({
      chaves: Object.keys(localStorage),
      temToken: Object.keys(localStorage).some(k => k.includes('auth-token')),
    }));
    console.log('localStorage:', JSON.stringify(diag));
    console.log('erros no console:', erros.length);
    erros.slice(0, 5).forEach(e => console.log('   >', String(e).slice(0, 160)));
    console.log((await page.innerText('body')).slice(0, 700));
    await page.screenshot({ path: 'casa-cofico.png' });
    throw new Error('parando para diagnostico');
  }
  await page.getByRole('button', { name: /CASA COFICO/i }).click();
  // Sem coleta no staging, a tela mostra o estado vazio — e mostrá-lo é o
  // comportamento certo: melhor dizer "não há coleta" do que fingir número.
  const vazio = await visivel(page.getByText(/Nenhuma coleta ainda/i), 20000);
  const comDado = await visivel(page.getByText(/Prateleira de 500 g/i), 5000);
  checar('a aba responde (estado vazio ou régua)', vazio || comDado);

  if (vazio) console.log('       (staging sem coleta: estado vazio, como esperado)');

  await page.getByRole('button', { name: /Nossas vendas/i }).click();
  checar('dá para voltar para as nossas vendas',
    await visivel(page.getByText(/Faturamento/i), 20000));

  checar('nenhum erro de JavaScript no console', erros.length === 0);
  if (erros.length) erros.slice(0, 3).forEach(e => console.log('       ' + e.slice(0, 120)));

  await page.screenshot({ path: 'casa-cofico.png', fullPage: false });
  console.log('\n  imagem: casa-cofico.png');
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
