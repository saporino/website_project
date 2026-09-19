// Coffee LiVRE — bancada de NAVEGADOR dos convites (staging): admin convida pela tela, convidado
// entra pelo rodapé da COFICO, cadastra e passa; código repassado é recusado; "perdi meu código";
// bloqueio tira o acesso. Desktop e 375 px. Tudo com a marca `teste-convite-nav` e apagado no fim.
//   node scripts/coffeelivre-convites-navegador.mjs [--mostrar]

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

const MARCA = 'teste-convite-nav';
const EMAIL = r => `${MARCA}-${r}@coffeelivre.test`;
const PORTA = 5190;
const SAIDA = path.join(RAIZ, 'test-results', 'convites');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };
const visivel = async (loc, ms = 20000) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };

async function limpar() {
  await admin.from('lv_convites').delete().like('email', `${MARCA}%`);
  for (let p = 1; p <= 20; p++) {
    const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const u of (data?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(u.id);
    if (!data?.users || data.users.length < 200) break;
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

await limpar();
const senhaAdm = crypto.randomBytes(18).toString('base64url') + 'Aa1!';
const { data: adm } = await admin.auth.admin.createUser({ email: EMAIL('admin'), password: senhaAdm, email_confirm: true });
await admin.from('user_profiles').upsert({ id: adm.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
const { data: login } = await cli.auth.signInWithPassword({ email: EMAIL('admin'), password: senhaAdm });
const chaveSessao = `sb-${ambiente.ref}-auth-token`;

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

async function contexto(tela, { comoAdmin = false } = {}) {
  const ctx = await browser.newContext({ viewport: tela.viewport, isMobile: tela.movel, hasTouch: tela.movel, locale: 'pt-BR' });
  if (comoAdmin) await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('admin-initial-tab', 'repco'); }, [chaveSessao, JSON.stringify(login.session)]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog', d => d.accept());
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  const foto = async nome => {
    const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    checar(`[${tela.rotulo}] ${nome}: sem rolagem lateral`, sem);
    await page.screenshot({ path: path.join(SAIDA, `${tela.rotulo}-${nome}.png`) });
  };
  return { ctx, page, erros, foto };
}

try {
  for (const tela of [{ rotulo: 'desktop', viewport: { width: 1366, height: 900 }, movel: false }, { rotulo: '375', viewport: { width: 375, height: 812 }, movel: true }]) {
    console.log(`\n=== ${tela.rotulo} ===`);
    const email = EMAIL(`convidado-${tela.rotulo}`);

    // 1. Admin convida pela tela.
    const a = await contexto(tela, { comoAdmin: true });
    await a.page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await a.page.getByRole('button', { name: /Convites \(representante, promotor e Coffee LiVRE\)/ }).click({ timeout: 90000 });
    await a.page.getByRole('button', { name: 'Coffee LiVRE (convidado)' }).click();
    const quadro = a.page.locator('[data-convites="coffeelivre"]');
    await quadro.getByLabel('Nome do convidado').fill(`Convidado ${tela.rotulo}`);
    await quadro.getByLabel('Empresa').fill('Torrefação Teste');
    await quadro.getByLabel('E-mail do convidado').fill(email);
    await quadro.getByLabel('Validade do código').selectOption('1');
    await quadro.getByRole('button', { name: 'Convidar' }).click();
    const campoCodigo = a.page.locator('[data-campo="codigo-convite"]');
    checar(`[${tela.rotulo}] admin convida: código aparece uma vez na tela`, await visivel(campoCodigo));
    const codigo = (await campoCodigo.textContent())?.trim() ?? '';
    checar(`[${tela.rotulo}] aviso de que o e-mail não saiu no staging (sem Resend) e o convite na lista`,
      await visivel(a.page.getByText(/não saiu/)) && await visivel(a.page.locator(`[data-convite="${email}"]`, { hasText: 'Aguardando cadastro' })));
    await a.foto('admin-convite');

    // 2. Convidado entra pelo rodapé da COFICO e faz o cadastro.
    const v = await contexto(tela);
    await v.page.goto(servidor.base + '/coficobrasil', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const rodape = v.page.locator('[data-rodape="coffeelivre"]');
    await rodape.scrollIntoViewIfNeeded({ timeout: 60000 });
    checar(`[${tela.rotulo}] rodapé da COFICO tem a caixinha do Coffee LiVRE`, await visivel(rodape.getByLabel('Código de convite')));
    await rodape.getByLabel('Código de convite').fill(codigo.toLowerCase());
    await v.foto('rodape-cofico');
    await rodape.getByRole('button', { name: 'Entrar' }).click();
    const cadastro = v.page.locator('[data-portao="cadastro"]');
    checar(`[${tela.rotulo}] código do rodapé abre o cadastro com o e-mail do convite`,
      await visivel(cadastro, 60000) && (await cadastro.getByLabel('E-mail do convite').inputValue()) === email);
    await v.foto('cadastro');
    const senha = crypto.randomBytes(9).toString('base64url') + 'Aa1!';
    await cadastro.getByLabel('Telefone').fill('11999990000');
    await cadastro.getByLabel('Senha', { exact: true }).fill(senha);
    await cadastro.getByLabel('Repita a senha').fill(senha);
    await cadastro.getByRole('button', { name: 'Concluir cadastro' }).click();
    await v.page.locator('[data-portao]').first().waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    checar(`[${tela.rotulo}] cadastro concluído: entra no Coffee LiVRE`, await v.page.locator('[data-portao]').count() === 0);
    await v.foto('dentro');

    // 3. O mesmo código repassado para outra pessoa.
    const o = await contexto(tela);
    await o.page.goto(servidor.base + '/coffeelivre', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await o.page.getByLabel('Código de convite').fill(codigo);
    await o.page.getByRole('button', { name: 'Entrar' }).click();
    checar(`[${tela.rotulo}] código repassado é recusado: "já foi usado"`, await visivel(o.page.getByText(/já foi usado/)));
    // "Perdi meu código" responde igual para qualquer e-mail.
    await o.page.getByRole('button', { name: 'Já tenho cadastro' }).click();
    await o.page.getByRole('button', { name: 'Tenho um código' }).click();
    await o.page.getByRole('button', { name: 'Perdi meu código' }).click();
    await o.page.getByLabel('E-mail').fill(EMAIL('qualquer'));
    await o.page.getByRole('button', { name: 'Enviar código novo' }).click();
    checar(`[${tela.rotulo}] "perdi meu código" responde sem revelar se houve convite`, await visivel(o.page.getByText(/Se houver um convite para este e-mail/)));
    await o.foto('perdi-codigo');
    await o.ctx.close();

    // 4. Admin vê "usado por" e bloqueia; o convidado perde o acesso.
    await a.page.reload({ waitUntil: 'domcontentloaded' });
    await a.page.getByRole('button', { name: /Convites \(representante, promotor e Coffee LiVRE\)/ }).click({ timeout: 90000 });
    await a.page.getByRole('button', { name: 'Coffee LiVRE (convidado)' }).click();
    checar(`[${tela.rotulo}] admin vê "Usado por Convidado (Torrefação Teste)"`,
      await visivel(a.page.locator(`[data-convite="${email}"]`, { hasText: `Usado por Convidado ${tela.rotulo} (Torrefação Teste)` })));
    await a.page.locator(`[data-convidado="${email}"]`).getByRole('button', { name: 'Bloquear acesso' }).click();
    checar(`[${tela.rotulo}] bloqueio aplicado`, await visivel(a.page.locator(`[data-convidado="${email}"]`).getByRole('button', { name: 'Liberar acesso' })));
    await a.foto('admin-usado-bloqueado');
    await v.page.reload({ waitUntil: 'domcontentloaded' });
    checar(`[${tela.rotulo}] convidado bloqueado volta ao portão com aviso`, await visivel(v.page.getByText(/acesso ao Coffee LiVRE foi suspenso/), 30000));

    checar(`[${tela.rotulo}] nenhum erro de JavaScript`, a.erros.length + v.erros.length === 0, [...a.erros, ...v.erros].slice(0, 3).join(' | '));
    await a.ctx.close(); await v.ctx.close();
  }
} catch (e) {
  falhas++; console.log('  !!  bancada interrompida: ' + (e instanceof Error ? e.message.split('\n')[0] : e));
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
  console.log(`\n${criterios} critérios · ${falhas ? `${falhas} FALHARAM` : 'TODOS OS CRITÉRIOS PASSARAM'}\nCapturas em ${path.relative(RAIZ, SAIDA)}`);
  process.exit(falhas ? 1 : 0);
}
