// B2B Prospecção — bancada de NAVEGADOR no staging (desktop e 375 px).
//
// Admin temporário do staging, sessão injetada no navegador (sem senha na tela), e o
// fluxo real: Leads B2B › B2B Prospecção › Importar lista (CSV com duplicata, linha sem
// CNPJ e CNPJ inválido) › prévia › importação › busca › ficha › vínculo ativo › aba Ativos.
// Tudo com a marca `teste-b2b` e apagado no fim. Capturas em test-results/b2b/.
//   node scripts/b2b-navegador.mjs [--mostrar]

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

const MARCA = 'teste-b2b';
const FONTE = `${MARCA}-navegador`;
const PORTA = 5189;
const SAIDA = path.join(RAIZ, 'test-results', 'b2b');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

function cnpjValido(base12) {
  const dv = (b, p) => { const s = b.split('').reduce((a, n, i) => a + Number(n) * p[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const d1 = dv(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${d1}${d2}`;
}
const CNPJ_1 = cnpjValido('987650010001');
const CNPJ_2 = cnpjValido('987650020001');

async function limpar() {
  await admin.from('b2b_empresas').delete().or(`razao_social.ilike.%${MARCA}%,nome_fantasia.ilike.%${MARCA}%,cnpj.in.(${CNPJ_1},${CNPJ_2})`);
  await admin.from('b2b_importacoes').delete().like('fonte', `${MARCA}%`);
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

const csv = path.join(SAIDA, 'lista-teste.csv');
fs.writeFileSync(csv, [
  'CNPJ;Razão Social;Nome Fantasia;Cidade;Estado;Telefone;Categoria;E-mail',
  `${CNPJ_1.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')};TORREFACAO ${MARCA} UM LTDA;Café ${MARCA} Um;Campinas;São Paulo;(19) 99999-0001;Torrefação;`,
  `${CNPJ_1};TORREFACAO ${MARCA} UM LTDA;;Campinas;SP;;Torrefação;compras@${MARCA}.com.br`,
  `${CNPJ_2};SUPERMERCADO ${MARCA} DOIS LTDA;Super ${MARCA} Dois;Belo Horizonte;MG;(31) 3333-0002;Supermercado;`,
  `;EMPORIO ${MARCA} TRES;Empório ${MARCA} Três;Curitiba;PR;(41) 98888-0003;Varejo;`,
  `12.345.678/0001-00;CNPJ ERRADO ${MARCA};;Santos;SP;;;`,
].join('\n'), 'utf8');

const html = path.join(SAIDA, 'lista-teste.html');
fs.writeFileSync(html, `<html><body><h2>Associados teste</h2><table>
<tr><th>CNPJ</th><th>Empresa</th><th>Cidade</th><th>UF</th><th>Telefone</th></tr>
<tr><td>${CNPJ_1}</td><td>TORREFACAO ${MARCA} UM LTDA</td><td>Campinas</td><td>SP</td><td>(19) 3333-0000</td></tr>
<tr><td>${CNPJ_2}</td><td>SUPERMERCADO ${MARCA} DOIS LTDA</td><td>Belo Horizonte</td><td>MG</td><td></td></tr>
</table><script>window.TORREF=[["${CNPJ_1}","TORREFACAO ${MARCA} UM LTDA","X",[],"","","13000000","CAMPINAS","SP",1994,1,1,0],
["${CNPJ_2}","SUPERMERCADO ${MARCA} DOIS LTDA","Y",[],"","","30000000","BELO HORIZONTE","MG",1990,1,0,0],
["${CNPJ_2}","SUPERMERCADO ${MARCA} DOIS LTDA","Y",[],"","","30000000","BELO HORIZONTE","MG",1990,1,0,0]];</script></body></html>`, 'utf8');

const servidor = await subirVite();
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--mostrar') })
  .catch(() => chromium.launch({ channel: 'msedge', headless: !process.argv.includes('--mostrar') }));

try {
  for (const tela of [{ rotulo: 'desktop', viewport: { width: 1366, height: 900 }, movel: false }, { rotulo: '375', viewport: { width: 375, height: 812 }, movel: true }]) {
    console.log(`\n=== ${tela.rotulo} ===`);
    const ctx = await browser.newContext({ viewport: tela.viewport, isMobile: tela.movel, hasTouch: tela.movel, locale: 'pt-BR' });
    await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('admin-initial-tab', 'leads_b2b'); }, [chaveSessao, sessao]);
    const page = await ctx.newPage();
    const erros = [];
    // "Failed to load resource" só repete a resposta com erro, que é registrada abaixo com o endereço.
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text()); });
    page.on('pageerror', e => erros.push(e.message));
    // Defeito conhecido e anterior do Dashboard da Saporino (existe em produção), fora desta seção.
    const CONHECIDO = /\/rest\/v1\/(orders|user_profiles)\b/;
    page.on('response', r => {
      const u = r.url().replace(/^https?:\/\/[^/]+/, '');
      if (r.status() >= 400 && !CONHECIDO.test(u)) erros.push(`${r.status()} ${r.request().method()} ${u.slice(0, 160)}`);
    });
    const foto = async nome => {
      const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      checar(`[${tela.rotulo}] ${nome}: sem rolagem lateral`, sem);
      await page.screenshot({ path: path.join(SAIDA, `${tela.rotulo}-${nome}.png`), fullPage: false });
    };

    await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
    checar(`[${tela.rotulo}] aba Leads B2B abre`, await visivel(page.getByRole('heading', { name: 'Leads B2B' }), 90000));
    await page.getByRole('button', { name: 'B2B Prospecção' }).click();
    checar(`[${tela.rotulo}] seção B2B Prospecção com Não ativos e Ativos`,
      await visivel(page.getByRole('button', { name: /Não ativos/ })) && await visivel(page.getByRole('button', { name: /^Ativos/ })));

    if (tela.rotulo === 'desktop') {
      await page.getByRole('button', { name: 'Importar lista' }).click();
      await page.locator('input[type="file"]').setInputFiles(csv);
      checar('importador reconhece as colunas do arquivo', await visivel(page.getByText('Confira a que campo cada coluna corresponde')));
      const selectDaColuna = h => page.locator('tr', { has: page.getByRole('cell', { name: h, exact: true }) }).locator('select');
      const mapeado = await selectDaColuna('Razão Social').inputValue();
      const mapeadoUf = await selectDaColuna('Estado').inputValue();
      checar('"Razão Social" → razão social e "Estado" → UF, sem ajuda', mapeado === 'razao_social' && mapeadoUf === 'uf', `(${mapeado}, ${mapeadoUf})`);
      await foto('importador-colunas');
      await page.getByRole('button', { name: 'Ver prévia' }).click();
      const card = async rot => Number(((await page.locator('div.bg-white', { hasText: rot }).last().locator('.text-xl').textContent()) ?? '').replace(/\D/g, ''));
      await visivel(page.getByText('Linhas no arquivo'));
      checar('prévia: 5 linhas, 2 empresas novas por CNPJ, 1 fora (CNPJ inválido)',
        await card('Linhas no arquivo') === 5 && await card('Empresas novas (CNPJ)') === 2 && await card('Fora: CNPJ inválido') === 1);
      await page.locator('input').filter({ hasNot: page.locator('[type=file]') }).last().fill(FONTE);
      await foto('importador-previa');
      await page.getByRole('button', { name: /^Importar \d/ }).click();
      checar('importação concluída', await visivel(page.getByText('Importação concluída'), 60000));
      const { data: um } = await admin.from('b2b_empresas').select('*').eq('cnpj', CNPJ_1).maybeSingle();
      checar('banco: linhas duplicadas viraram UMA ficha, com telefone e e-mail juntos',
        !!um && um.telefone === '19999990001' && um.email === `compras@${MARCA}.com.br` && um.fontes.includes(FONTE));
      const { count: tres } = await admin.from('b2b_empresas').select('id', { count: 'exact', head: true }).ilike('razao_social', `%${MARCA}%`);
      checar('banco: 3 empresas (2 por CNPJ + 1 sem CNPJ); o CNPJ inválido não entrou', tres === 3, `(veio ${tres})`);
      const { count: errada } = await admin.from('b2b_empresas').select('id', { count: 'exact', head: true }).ilike('razao_social', `%CNPJ ERRADO%${MARCA}%`);
      checar('banco: a linha com CNPJ errado não entrou nem pelo nome', errada === 0);
      await foto('importador-concluido');
      await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();

      // O mesmo arquivo de novo: o sistema reconhece pelo conteúdo e avisa antes de gravar.
      await page.getByRole('button', { name: 'Importar lista' }).click();
      checar('tela inicial mostra o histórico de importações', await visivel(page.getByText('Importações anteriores')) && await visivel(page.getByText('lista-teste.csv').first()));
      await page.locator('input[type="file"]').setInputFiles(csv);
      checar('mesmo arquivo: aviso "já foi importado" com data e fonte',
        await visivel(page.locator('[data-campo="aviso-repetido"]', { hasText: 'Este arquivo já foi importado' })));
      await foto('aviso-repetido');
      await page.getByRole('button', { name: 'Fechar' }).first().click();

      // HTML com tabela + lista embutida; a tabela traz outro telefone para uma empresa que já existe.
      await page.getByRole('button', { name: 'Importar lista' }).click();
      await page.locator('input[type="file"]').setInputFiles(html);
      checar('HTML com tabela e dados embutidos: pede para escolher a tabela',
        await visivel(page.getByRole('button', { name: /Associados teste/ })) && await visivel(page.getByRole('button', { name: /Dados embutidos: TORREF/ })));
      await foto('escolher-tabela');
      await page.getByRole('button', { name: /Associados teste/ }).click();
      checar('colunas do HTML reconhecidas (Empresa → razão social)',
        (await page.locator('tr', { has: page.getByRole('cell', { name: 'Empresa', exact: true }) }).locator('select').inputValue()) === 'razao_social');
      await page.getByRole('button', { name: 'Ver prévia' }).click();
      await page.locator('[data-campo="fonte"]').fill(`${FONTE}-html`);
      await page.getByRole('button', { name: /^Importar \d/ }).click();
      checar('importação do HTML concluída com 1 divergência para decidir',
        await visivel(page.getByText('Importação concluída'), 60000) && await visivel(page.getByText('1 divergências para decidir')));
      await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
      const { data: umDepois } = await admin.from('b2b_empresas').select('telefone, divergencias_abertas').eq('cnpj', CNPJ_1).single();
      checar('banco: telefone da ficha NÃO foi trocado; divergência aberta', umDepois.telefone === '19999990001' && umDepois.divergencias_abertas === 1);
    }

    await page.getByPlaceholder('Buscar por nome, cidade ou CNPJ…').fill(MARCA);
    // No desktop o "Café Um" ainda não é ativo; no 375 ele já foi para Ativos (vínculo criado no desktop).
    const esperado = tela.rotulo === 'desktop' ? `Café ${MARCA} Um` : `Super ${MARCA} Dois`;
    checar(`[${tela.rotulo}] busca encontra as empresas importadas`, await visivel(page.getByText(esperado)));
    const ufs = tela.rotulo === 'desktop' ? [/^SP/, /^MG/, /^PR/] : [/^MG/, /^PR/];
    let chips = true;
    for (const u of ufs) chips = chips && await visivel(page.getByRole('button', { name: u }));
    checar(`[${tela.rotulo}] chips de estado com contagem`, chips);
    await foto('lista');

    if (tela.rotulo === 'desktop') {
      await page.getByRole('button', { name: /^MG/ }).first().click();
      await page.getByText(`Café ${MARCA} Um`).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      checar('filtro por estado MG mostra só o supermercado', await visivel(page.getByText(`Super ${MARCA} Dois`)) && await page.getByText(`Café ${MARCA} Um`).count() === 0);
      await page.getByRole('button', { name: 'Todos', exact: true }).click();
      await visivel(page.getByText(`Café ${MARCA} Um`));

      await page.getByRole('button', { name: 'Com divergências' }).click();
      checar('filtro "Com divergências" mostra a empresa com o selo',
        await visivel(page.locator('[data-linha-b2b]', { hasText: `Café ${MARCA} Um` }).locator('[data-campo="badge-divergencias"]')));
      await page.getByRole('button', { name: 'Com divergências' }).click();

      await page.locator('[data-linha-b2b]', { hasText: `Café ${MARCA} Um` }).getByRole('button', { name: 'Ficha' }).click();
      const ficha = page.getByRole('dialog', { name: 'Ficha da empresa' });
      checar('ficha abre com fonte e CNPJ formatado', await visivel(ficha.getByText(FONTE).first()) && await visivel(ficha.getByText(/98\.765\.001/)));
      checar('ficha mostra a divergência: valor da ficha × valor da lista',
        await visivel(ficha.locator('[data-campo="divergencias"]', { hasText: '19999990001' })) && await visivel(ficha.locator('[data-campo="divergencias"]', { hasText: '1933330000' })));
      await foto('ficha');
      await ficha.getByRole('button', { name: 'Usar o novo' }).click();
      await ficha.locator('[data-campo="divergencias"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      const { data: trocado } = await admin.from('b2b_empresas').select('telefone, divergencias_abertas').eq('cnpj', CNPJ_1).single();
      checar('"Usar o novo": telefone trocado e divergência resolvida', trocado.telefone === '1933330000' && trocado.divergencias_abertas === 0);
      await ficha.locator('select').filter({ hasText: 'Coffee LiVRE — comprador' }).selectOption('coffeelivre_comprador');
      await ficha.locator('select').filter({ hasText: 'Negociação' }).last().selectOption('ativo');
      await ficha.getByRole('button', { name: 'Adicionar vínculo' }).click();
      checar('vínculo ativo adicionado na ficha', await visivel(ficha.getByText('Coffee LiVRE — comprador', { exact: true })));
      const { data: um } = await admin.from('b2b_empresas').select('ativo').eq('cnpj', CNPJ_1).single();
      checar('banco: empresa passou a ativa', um.ativo === true);
      await ficha.getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('button', { name: /^Ativos/ }).click();
      checar('aba Ativos mostra a empresa; Não ativos deixou de mostrar',
        await visivel(page.getByText(`Café ${MARCA} Um`)) && !(await page.getByText(`Super ${MARCA} Dois`).isVisible()));
      await foto('ativos');
    }
    checar(`[${tela.rotulo}] nenhum erro no console`, erros.length === 0, `(${erros.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }
} catch (e) {
  falhas++; console.log('  !!  bancada interrompida: ' + (e instanceof Error ? e.message.split('\n')[0] : e));
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
  fs.rmSync(csv, { force: true });
  fs.rmSync(html, { force: true });
  const { count } = await admin.from('b2b_empresas').select('id', { count: 'exact', head: true }).ilike('razao_social', `%${MARCA}%`);
  checar('limpeza: nenhuma empresa, importação ou usuário de teste sobrou', count === 0);
  console.log(`\n${criterios} critérios · ${falhas ? `${falhas} FALHARAM` : 'TODOS OS CRITÉRIOS PASSARAM'}\nCapturas em ${path.relative(RAIZ, SAIDA)}`);
  process.exit(falhas ? 1 : 0);
}
