// Studio — uma aba por marca. Bancada de NAVEGADOR no staging (desktop e 375 px).
//
// Admin temporário, sessão injetada (sem senha na tela), Saporino/COFICO de teste com as marcas
// criadas pelo bloco da migration 20260921100000. Fluxo real:
//   abas de marca › Tropeiro › Marca (guardrails do Tropeiro) › Conexões (conta do Tropeiro,
//   Conectar leva brand=<tropeiro>) › Vídeos › Criar post (arte pronta) › contas de destino
//   (Tropeiro, Saporino, COFICO) › cria 2 campanhas › aba Campanhas do Tropeiro mostra só a dela.
// Tudo apagado no fim. Capturas em test-results/studio-marcas/.
//   node scripts/studio-marcas-navegador.mjs [--mostrar]

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

const MARCA = 'teste-studio-nav';
const PORTA = 5191;
const SAIDA = path.join(RAIZ, 'test-results', 'studio-marcas');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

const texto = fs.readFileSync(path.join(RAIZ, 'supabase/migrations/20260921100000_studio_marca_por_aba.sql'), 'utf8');
const blocoDasMarcas = texto.slice(texto.indexOf('do $$'), texto.indexOf('end $$;') + 'end $$;'.length);

async function limpar() {
  const { data } = await admin.from('companies').select('id').in('name', ['Café Saporino Ltda', 'V. Medeiros de Santi Ltda']);
  const ids = (data ?? []).map(c => c.id);
  if (ids.length) {
    const { data: camps } = await admin.from('studio_campaigns').select('media_path').in('company_id', ids);
    const arquivos = (camps ?? []).map(c => c.media_path).filter(Boolean);
    if (arquivos.length) await admin.storage.from('studio-videos').remove([...new Set(arquivos)]);
    await admin.from('studio_campaigns').delete().in('company_id', ids);
    await admin.from('studio_social_connections').delete().in('company_id', ids);
    await admin.from('studio_brand_profiles').delete().in('company_id', ids);
    await admin.from('studio_organizations').delete().in('company_id', ids);
    await admin.from('companies').delete().in('id', ids);
  }
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

// ---------- dados ----------
await limpar();
const { data: emp, error: eEmp } = await admin.from('companies').insert([
  { name: 'Café Saporino Ltda', fantasia: 'CAFE SAPORINO', is_active: true, studio_enabled: true, is_operator: false, sort_order: 1 },
  { name: 'V. Medeiros de Santi Ltda', fantasia: 'COFICO BRASIL', is_active: true, studio_enabled: true, is_operator: true, sort_order: 2 },
]).select('id, name');
if (eEmp) throw new Error(eEmp.message);
const sap = emp.find(e => e.name.startsWith('Café')), cof = emp.find(e => e.name.startsWith('V.'));
const { data: orgs } = await admin.from('studio_organizations').insert([
  { name: `Saporino ${MARCA}`, slug: `${MARCA}-sap`, company_id: sap.id, plan: 'interno', status: 'ativa' },
  { name: `COFICO ${MARCA}`, slug: `${MARCA}-cof`, company_id: cof.id, plan: 'interno', status: 'ativa' },
]).select('id, company_id');
const orgDe = id => orgs.find(o => o.company_id === id).id;
await admin.from('studio_brand_profiles').insert([
  { company_id: sap.id, organization_id: orgDe(sap.id), name: 'Café Saporino', is_primary: true, guardrails: {} },
  { company_id: cof.id, organization_id: orgDe(cof.id), name: 'COFICO Brasil', is_primary: true, guardrails: {} },
]);
const { error: eMig } = await admin.rpc('exec_migration', { q: blocoDasMarcas });
if (eMig) throw new Error(eMig.message);
const { data: perfis } = await admin.from('studio_brand_profiles').select('id, name').in('company_id', [sap.id, cof.id]);
const idDe = n => perfis.find(p => p.name === n).id;
await admin.from('studio_social_connections').insert([
  { brand_id: idDe('Café Saporino'), company_id: sap.id, platform: 'instagram', account_name: '@cafesaporino', status: 'connected', access_token: 'x' },
  { brand_id: idDe('Café Tropeiro Paulista'), company_id: sap.id, platform: 'instagram', account_name: '@cafetropeiropaulista', status: 'connected', access_token: 'y' },
  { brand_id: idDe('COFICO Brasil'), company_id: cof.id, platform: 'instagram', account_name: '@coficobrasil', status: 'connected', access_token: 'z' },
]);

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

// arte de teste (PNG 1x1)
const arte = path.join(SAIDA, 'arte-teste.png');
fs.writeFileSync(arte, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  for (const tela of [{ rotulo: 'desktop', viewport: { width: 1366, height: 900 }, movel: false }, { rotulo: '375', viewport: { width: 375, height: 812 }, movel: true }]) {
    console.log(`\n=== ${tela.rotulo} ===`);
    const ctx = await browser.newContext({ viewport: tela.viewport, isMobile: tela.movel, hasTouch: tela.movel, locale: 'pt-BR' });
    await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('admin-initial-tab', 'studio'); }, [chaveSessao, sessao]);
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });
    page.on('pageerror', e => erros.push(e.message));
    const CONHECIDO = /\/rest\/v1\/(orders|user_profiles|studio_profile_snapshots)\b/;
    page.on('response', r => {
      const u = r.url().replace(/^https?:\/\/[^/]+/, '');
      if (r.status() >= 400 && !CONHECIDO.test(u)) erros.push(`${r.status()} ${r.request().method()} ${u.slice(0, 160)}`);
    });
    const foto = async nome => {
      // compara com a largura da TELA: no celular emulado a janela cresce junto com a página
      const sem = await page.evaluate(vw => document.documentElement.scrollWidth <= vw + 1, tela.viewport.width);
      checar(`[${tela.rotulo}] ${nome}: sem rolagem lateral`, sem);
      await page.screenshot({ path: path.join(SAIDA, `${tela.rotulo}-${nome}.png`), fullPage: false });
    };
    const aba = n => page.getByRole('button', { name: new RegExp('^' + n) });

    await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
    checar(`[${tela.rotulo}] Studio abre`, await visivel(page.getByText('Publicando pela marca:'), 90000));
    const nomes = ['Café Saporino', 'Café Tropeiro Paulista', 'Café Serrão', 'Café do Amor', 'COFICO Brasil', 'Coffee LiVRE'];
    let todas = true;
    for (const n of nomes) if (!(await visivel(aba(n), 5000))) todas = false;
    checar(`[${tela.rotulo}] as 6 marcas aparecem como abas`, todas);
    checar(`[${tela.rotulo}] aba mostra o @ conectado e avisa quem está sem Instagram`,
      await visivel(aba('Café Tropeiro Paulista').getByText('@cafetropeiropaulista'), 5000) && await visivel(aba('Café Serrão').getByText('sem Instagram'), 5000));
    await foto('abas');

    await aba('Café Tropeiro Paulista').click();
    await page.getByRole('button', { name: 'Marca', exact: true }).click();
    const nomeMarca = page.locator('input').first();
    await visivel(nomeMarca);
    checar(`[${tela.rotulo}] Marca: perfil do Tropeiro (nome + guardrails do Tropeiro)`,
      (await nomeMarca.inputValue()) === 'Café Tropeiro Paulista' && (await page.locator('textarea').last().inputValue()).includes('@cafetropeiropaulista'));
    await foto('marca-tropeiro');

    await page.getByRole('button', { name: 'Conexões', exact: true }).click();
    checar(`[${tela.rotulo}] Conexões: conta do Tropeiro, não a da Saporino`,
      await visivel(page.getByText('Conta: @cafetropeiropaulista')) && !(await page.getByText('Conta: @cafesaporino').count()));
    const [popup] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      page.getByRole('button', { name: 'Reconectar' }).first().click(),
    ]);
    const urlPopup = popup?.url() ?? '';
    checar(`[${tela.rotulo}] Conectar abre o login levando a marca do Tropeiro`, urlPopup.includes('instagram-oauth') && urlPopup.includes(`brand=${idDe('Café Tropeiro Paulista')}`), urlPopup.slice(0, 160));
    await popup?.close();
    await foto('conexoes-tropeiro');

    await page.getByRole('button', { name: 'Vídeos', exact: true }).click();
    const input = page.locator('label:has-text("Criar post (arte pronta)") input[type=file]');
    await input.setInputFiles(arte);
    checar(`[${tela.rotulo}] criador de campanha abre`, await visivel(page.getByRole('heading', { name: 'Criar campanha' }), 30000));
    const modal = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'Criar campanha' }) });
    const contas = modal.getByText('Publicar na conta de (marque uma ou várias)');
    checar(`[${tela.rotulo}] contas de destino: Tropeiro, Saporino e COFICO (Serrão e Coffee LiVRE não)`,
      await visivel(contas) && await modal.locator('button:has-text("@cafetropeiropaulista")').count() === 1
        && await modal.locator('button:has-text("@cafesaporino")').count() === 1 && await modal.locator('button:has-text("@coficobrasil")').count() === 1
        && (await modal.locator('button:has-text("Café Serrão"), button:has-text("Coffee LiVRE")').count()) === 0);
    await foto('contas-de-destino');
    await modal.locator('button:has-text("@coficobrasil")').click({ timeout: 8000 });
    await modal.locator('textarea').nth(1).fill(`Legenda ${MARCA}`);
    await foto('criar-campanha');
    await modal.getByRole('button', { name: /Criar 2 campanhas/ }).click();
    await modal.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    checar(`[${tela.rotulo}] cria 2 campanhas e vai para Campanhas`,
      await visivel(page.getByRole('button', { name: 'Campanhas', exact: true }), 5000) && await visivel(page.getByText(`Legenda ${MARCA}`), 30000));
    const { data: rows } = await admin.from('studio_campaigns').select('brand_id, company_id, title').like('content', `Legenda ${MARCA}`);
    checar(`[${tela.rotulo}] no banco: 1 campanha do Tropeiro (Saporino) e 1 da COFICO`,
      rows?.length === 2 && rows.some(r => r.brand_id === idDe('Café Tropeiro Paulista') && r.company_id === sap.id)
        && rows.some(r => r.brand_id === idDe('COFICO Brasil') && r.company_id === cof.id), JSON.stringify(rows));
    const nTropeiro = await page.getByText(`Legenda ${MARCA}`).count();
    checar(`[${tela.rotulo}] aba Campanhas do Tropeiro mostra só a dele`, nTropeiro === 1, `(${nTropeiro}: ${(await page.getByText(`Legenda ${MARCA}`).allTextContents()).join(' || ').slice(0, 200)})`);
    checar(`[${tela.rotulo}] campanha mostra a conta onde vai sair`, await visivel(page.getByText('@cafetropeiropaulista').last()));
    await foto('campanhas-tropeiro');
    await aba('COFICO Brasil').click();
    checar(`[${tela.rotulo}] aba COFICO mostra a campanha dela`, await visivel(page.getByText(`Legenda ${MARCA}`), 10000));
    await admin.from('studio_campaigns').delete().like('content', `Legenda ${MARCA}`);

    checar(`[${tela.rotulo}] sem erro no console ou na rede`, erros.length === 0, erros.slice(0, 5).join(' | '));
    await ctx.close();
  }
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
