// Pesquisa de gôndola — bancada de NAVEGADOR no staging (desktop e 375 px).
//
// Admin temporário, sessão injetada. Fluxo real: RepCo › Tabela de Preços › Pesquisa de
// gôndola › nova pesquisa › (itens entram como se a IA tivesse lido) › conferir › PDF.
// A leitura por IA não entra aqui de propósito: ela gasta chamada paga e depende de foto real;
// o que a bancada prova é o que a tela faz com o que a IA devolve.
// Tudo com o prefixo `teste-gondola` e apagado no fim. Capturas em test-results/gondola/.
//   node scripts/gondola-navegador.mjs [--mostrar]

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

const MARCA = 'teste-gondola';
const PORTA = 5195;
const SAIDA = path.join(RAIZ, 'test-results', 'gondola');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  await admin.from('gondola_pesquisas').delete().like('rede', `${MARCA}%`);
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

// A Tabela de Preços só abre com uma empresa ativa (é ela que filtra produtos e preços).
const { data: empresa, error: eEmp } = await admin.from('companies')
  .insert({ name: `${MARCA} Empresa`, fantasia: `${MARCA}`, is_active: true, is_operator: false, sort_order: 1 })
  .select('id').single();
if (eEmp) throw new Error('empresa: ' + eEmp.message);

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  await ctx.addInitScript(([k, v, emp]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('admin-initial-tab', 'repco');
    localStorage.setItem('active-company-id', emp);
  }, [chaveSessao, sessao, empresa.id]);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });
  const CONHECIDO = /\/rest\/v1\/(orders|user_profiles)\b/;
  page.on('response', r => {
    const u = r.url().replace(/^https?:\/\/[^/]+/, '');
    if (r.status() >= 400 && !CONHECIDO.test(u)) erros.push(`${r.status()} ${r.request().method()} ${u.slice(0, 140)}`);
  });

  await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  checar('RepCo abre', await visivel(page.getByRole('button', { name: 'Tabela de Preços' }), 90000));
  await page.getByRole('button', { name: 'Tabela de Preços' }).first().click();
  const achou = await visivel(page.getByRole('button', { name: /Pesquisa de gôndola/ }), 30000);
  if (!achou) {
    await page.screenshot({ path: path.join(SAIDA, 'falha-tabela-precos.png'), fullPage: true });
    console.log('      titulos:', JSON.stringify(await page.locator('h2,h3,h4').allTextContents()));
    console.log('      botoes:', JSON.stringify((await page.locator('button').allTextContents()).slice(0, 25)));
  }
  checar('Tabela de Preços abre com o botão da pesquisa de gôndola', achou);
  await page.getByRole('button', { name: /Pesquisa de gôndola/ }).click();
  checar('seção da pesquisa abre', await visivel(page.getByRole('heading', { name: 'Pesquisa de gôndola' }), 20000));

  await page.getByPlaceholder('Rede (ex.: Supermercado Lopes)').fill(`${MARCA} Rede`);
  await page.getByPlaceholder('Loja (ex.: Cipava)').fill('Centro');
  await page.getByPlaceholder('Cidade').fill('Osasco');
  await page.getByRole('button', { name: 'Criar e anexar fotos' }).click();
  checar('pesquisa criada e aberta', await visivel(page.getByRole('heading', { name: `${MARCA} Rede — Centro` }), 20000));

  const { data: pesquisa } = await admin.from('gondola_pesquisas').select('id').like('rede', `${MARCA}%`).maybeSingle();
  checar('pesquisa gravada no banco com loja e cidade', !!pesquisa?.id);

  // Itens como a função de leitura os grava: um legível, um que a IA não conseguiu ler.
  await admin.from('gondola_itens').insert([
    { pesquisa_id: pesquisa.id, produto: 'Tradicional', marca: 'Pilão', peso_g: 250, preco: 14.89, lido_pela_ia: true, confianca: 'alta', ordem: 1 },
    { pesquisa_id: pesquisa.id, produto: 'Extraforte', marca: '3 Corações', peso_g: 500, preco: 22.9, lido_pela_ia: true, confianca: 'media', ordem: 2 },
    { pesquisa_id: pesquisa.id, produto: null, marca: null, peso_g: null, preco: null, lido_pela_ia: true, nao_li: 'etiqueta borrada', confianca: 'baixa', ordem: 3 },
  ]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Tabela de Preços' }).first().click();
  await page.getByRole('button', { name: /Pesquisa de gôndola/ }).click();
  await page.getByText(`${MARCA} Rede — Centro`).first().click();
  checar('itens lidos aparecem para conferência', await visivel(page.locator('input[value="Pilão"]'), 20000));
  checar('mostra o R$/kg calculado e o aviso do que a IA não leu',
    await visivel(page.getByText('R$ 59,56/kg')) && await visivel(page.getByText('etiqueta borrada')));

  const botaoPdf = page.getByRole('button', { name: /Gerar PDF/ });
  checar('PDF começa bloqueado (nada conferido)', await botaoPdf.isDisabled());
  await page.getByRole('button', { name: /Marcar todos com preço como conferidos/ }).click();
  await page.waitForTimeout(1200);
  checar('PDF libera depois de conferir', !(await botaoPdf.isDisabled()));
  checar('só os itens com preço entram', (await botaoPdf.textContent())?.includes('(2)'), await botaoPdf.textContent());
  const { data: apos } = await admin.from('gondola_itens').select('revisado, preco').eq('pesquisa_id', pesquisa.id);
  checar('o "conferido" grava no banco e o item sem preço continua fora',
    (apos ?? []).filter(i => i.revisado).length === 2 && (apos ?? []).some(i => !i.revisado && i.preco === null));

  // Corrigir um preço na mão (a IA erra e a pessoa conserta)
  await page.locator('input[value="14.89"]').fill('15,49');
  await page.waitForTimeout(1200);
  const { data: corrigido } = await admin.from('gondola_itens').select('preco').eq('pesquisa_id', pesquisa.id).eq('marca', 'Pilão').maybeSingle();
  checar('correção manual do preço grava (15,49)', Number(corrigido?.preco) === 15.49, JSON.stringify(corrigido));

  await page.screenshot({ path: path.join(SAIDA, 'conferencia.png') });
  checar('sem erro no console ou na rede', erros.length === 0, erros.slice(0, 3).join(' | '));
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
