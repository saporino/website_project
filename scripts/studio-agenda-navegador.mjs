// Studio — agenda no card da peça. Bancada de NAVEGADOR no staging (desktop e 375 px).
//
// O que verifica: a peça diz sozinha quando foi publicada, para quando está agendada e
// quando a publicação falhou — sem precisar abrir a aba Campanhas.
// Admin temporário, sessão injetada, empresa/marca/peça de teste. Tudo apagado no fim.
//   node scripts/studio-agenda-navegador.mjs [--mostrar]

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

const MARCA = 'teste-agenda-nav';
const EMPRESA = 'Agenda Studio Teste Ltda';
const PORTA = 5192;
const SAIDA = path.join(RAIZ, 'test-results', 'studio-agenda');
fs.mkdirSync(SAIDA, { recursive: true });
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  const { data } = await admin.from('companies').select('id').eq('name', EMPRESA);
  const ids = (data ?? []).map(c => c.id);
  if (ids.length) {
    await admin.from('studio_campaigns').delete().in('company_id', ids);
    await admin.from('studio_videos').delete().in('company_id', ids);
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
const { data: emp, error: eEmp } = await admin.from('companies')
  .insert({ name: EMPRESA, fantasia: 'AGENDA TESTE', is_active: true, studio_enabled: true, is_operator: false, sort_order: 90 })
  .select('id').single();
if (eEmp) throw new Error(eEmp.message);
const { data: org } = await admin.from('studio_organizations')
  .insert({ name: `Org ${MARCA}`, slug: MARCA, company_id: emp.id, plan: 'interno', status: 'ativa' }).select('id').single();
const { data: marca } = await admin.from('studio_brand_profiles')
  .insert({ company_id: emp.id, organization_id: org.id, name: 'Marca Agenda', is_primary: true, guardrails: {} }).select('id').single();

// Três peças, uma para cada situação que o card tem de contar sozinho.
const base = { company_id: emp.id, brand_id: marca.id, status: 'completed', storage_path: '', media_type: 'image' };
const { data: pecas, error: ePecas } = await admin.from('studio_videos').insert([
  { ...base, filename: 'peca-publicada.png' },
  { ...base, filename: 'peca-agendada.png' },
  { ...base, filename: 'peca-falhou.png' },
  { ...base, filename: 'peca-rascunho.png' },
]).select('id, filename');
if (ePecas) throw new Error(ePecas.message);
const idDaPeca = n => pecas.find(p => p.filename === n).id;

const ontem = new Date(Date.now() - 26 * 3600e3).toISOString();
const anteontem = new Date(Date.now() - 50 * 3600e3).toISOString();
const daquiTresDias = new Date(Date.now() + 3 * 24 * 3600e3).toISOString();
const { error: eCamp } = await admin.from('studio_campaigns').insert([
  { video_id: idDaPeca('peca-publicada.png'), company_id: emp.id, brand_id: marca.id, title: 'Publicada', platform: 'instagram',
    status: 'published', scheduled_at: ontem, published_at: ontem, external_url: 'https://instagram.com/p/teste' },
  { video_id: idDaPeca('peca-agendada.png'), company_id: emp.id, brand_id: marca.id, title: 'Agendada', platform: 'instagram',
    status: 'scheduled', scheduled_at: daquiTresDias },
  { video_id: idDaPeca('peca-falhou.png'), company_id: emp.id, brand_id: marca.id, title: 'Falhou', platform: 'tiktok',
    status: 'error', scheduled_at: ontem, publish_error: 'token expirado' },
  // Tentativa que falhou e DEPOIS deu certo na mesma rede: não pode gritar em vermelho ao
  // lado da publicada — vira o histórico. Caso real da COFICO (falhou 14:26, saiu 16:10).
  { video_id: idDaPeca('peca-publicada.png'), company_id: emp.id, brand_id: marca.id, title: 'Tentativa velha', platform: 'instagram',
    status: 'error', scheduled_at: anteontem, publish_error: 'Instagram não estava conectado' },
  // Repostagem: não gostou da primeira e postou de novo. O card tem de mostrar a ÚLTIMA.
  { video_id: idDaPeca('peca-publicada.png'), company_id: emp.id, brand_id: marca.id, title: 'Primeira vez', platform: 'instagram',
    status: 'published', scheduled_at: anteontem, published_at: anteontem, external_url: 'https://instagram.com/p/velho' },
  // Peça publicada que foi REPROGRAMADA para o futuro: o card tem de mostrar o que vem,
  // não a publicação antiga. Caso real do "Feliz Domingo" republicado para o dia seguinte.
  { video_id: idDaPeca('peca-falhou.png'), company_id: emp.id, brand_id: marca.id, title: 'Republicada p/ amanhã', platform: 'facebook',
    status: 'published', published_at: ontem, external_url: 'https://instagram.com/p/saiu-ontem' },
  { video_id: idDaPeca('peca-falhou.png'), company_id: emp.id, brand_id: marca.id, title: 'Republicada p/ amanhã', platform: 'facebook',
    status: 'scheduled', scheduled_at: daquiTresDias },
  // Campanha criada e esquecida sem agendar: card mudo faz pensar que o post saiu.
  { video_id: idDaPeca('peca-rascunho.png'), company_id: emp.id, brand_id: marca.id, title: 'Esquecida', platform: 'instagram', status: 'draft' },
]);
if (eCamp) throw new Error(eCamp.message);

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
  for (const tela of [{ rotulo: 'desktop', viewport: { width: 1366, height: 900 }, movel: false },
                      { rotulo: '375', viewport: { width: 375, height: 812 }, movel: true }]) {
    console.log(`\n=== ${tela.rotulo} ===`);
    const ctx = await browser.newContext({ viewport: tela.viewport, isMobile: tela.movel, hasTouch: tela.movel, locale: 'pt-BR' });
    await ctx.addInitScript(([k, v, c]) => {
      localStorage.setItem(k, v);
      localStorage.setItem('admin-initial-tab', 'studio');
      localStorage.setItem('active-company-id', c);
    }, [chaveSessao, sessao, emp.id]);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));

    await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
    checar(`[${tela.rotulo}] Studio abre`, await visivel(page.getByText('peca-publicada.png'), 90000));

    const cartao = nome => page.locator('div').filter({ hasText: nome }).last();

    checar(`[${tela.rotulo}] peça publicada diz quando saiu`,
      await visivel(page.getByText(/Publicado no Instagram em/), 10000));
    checar(`[${tela.rotulo}] peça publicada leva ao post`,
      await visivel(page.getByRole('link', { name: 'ver post' }), 10000));
    checar(`[${tela.rotulo}] peça agendada diz a data e quanto falta`,
      await visivel(page.getByText(/Agendado no Instagram para .* \(em \d+ dias?\)/), 10000));
    checar(`[${tela.rotulo}] peça que falhou avisa e diz o motivo`,
      await visivel(page.getByText(/Não publicou no TikTok.*token expirado/), 10000));
    checar(`[${tela.rotulo}] peça sem campanha não inventa agenda`,
      (await cartao('peca-falhou.png').getByText(/Agendado no/).count()) === 0);
    checar(`[${tela.rotulo}] falha e repostagem antigas ficam fora da tela`,
      (await page.getByText(/Instagram não estava conectado/).count()) === 0
      && (await page.getByText(/Publicado no Instagram em/).count()) === 1);
    checar(`[${tela.rotulo}] oferece o histórico das anteriores`,
      await visivel(page.getByRole('button', { name: /\+2 anteriores/ }), 8000));

    await page.getByRole('button', { name: /\+2 anteriores/ }).click();
    await page.waitForTimeout(400);
    checar(`[${tela.rotulo}] histórico aberto mostra a publicação antiga e a falha`,
      await visivel(page.getByText(/· publicado em/), 5000)
      && await visivel(page.getByText(/· falhou.*Instagram não estava conectado/), 5000));
    await page.getByRole('button', { name: /ocultar histórico/ }).click();
    await page.waitForTimeout(400);
    checar(`[${tela.rotulo}] histórico fecha de novo`,
      (await page.getByText(/· publicado em/).count()) === 0);
    checar(`[${tela.rotulo}] rascunho avisa que ainda não foi ao ar`,
      await visivel(page.getByText(/Campanha de Instagram em rascunho — ainda não foi ao ar/), 8000));
    // peça que já saiu e foi reprogramada: a linha de cima é o que VEM, não o que passou
    checar(`[${tela.rotulo}] republicada mostra o próximo agendamento, não a publicação antiga`,
      await visivel(page.getByText(/Agendado no Facebook para/), 8000)
      && (await page.getByText(/Publicado no Facebook em/).count()) === 0);

    // A hora mostrada tem de ser a de Brasília, não a do aparelho. O agendamento foi
    // gravado em UTC; o card tem de exibir o mesmo instante convertido para SP.
    const horaEsperada = new Date(daquiTresDias).toLocaleTimeString('pt-BR',
      { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    checar(`[${tela.rotulo}] hora aparece em horário de Brasília (${horaEsperada})`,
      await visivel(page.getByText(new RegExp(`Agendado no Instagram para .*${horaEsperada}`)), 8000));

    // Campanhas: o que já foi publicado sai da lista de tarefas e vai para a outra aba.
    await page.getByRole('button', { name: /^Campanhas/ }).click();
    await page.waitForTimeout(800);
    checar(`[${tela.rotulo}] Campanhas abre em "A publicar"`,
      await visivel(page.getByRole('button', { name: /A publicar \(\d+\)/ }), 8000));
    // "Publicada" exato = a etiqueta da campanha; sem exact casaria com o botão "Publicadas".
    checar(`[${tela.rotulo}] publicada não polui a lista de tarefas`,
      (await page.getByText('Publicada', { exact: true }).count()) === 0
      && (await page.getByText('Rascunho', { exact: true }).count()) > 0);
    // O agendador publica por fora enquanto a tela está aberta: a campanha tem de sair de
    // "A publicar" sozinha, senão fica parecendo que não saiu.
    // Campanha DEDICADA a este teste, para não consumir a agendada que os critérios
    // anteriores usam — cada viewport roda sobre o mesmo banco.
    const { data: doAgendador } = await admin.from('studio_campaigns').insert({
      video_id: idDaPeca('peca-rascunho.png'), company_id: emp.id, brand_id: marca.id,
      title: `Do agendador ${tela.rotulo}`, platform: 'facebook', status: 'scheduled', scheduled_at: daquiTresDias,
    }).select('id').single();
    await page.waitForTimeout(2000);
    const apareceu = (await page.getByText(`Do agendador ${tela.rotulo}`).count()) > 0;
    await admin.from('studio_campaigns').update({
      status: 'published', published_at: new Date().toISOString(), external_url: 'https://instagram.com/p/agendador',
    }).eq('id', doAgendador.id);
    await page.waitForTimeout(2500);
    checar(`[${tela.rotulo}] publicada pelo agendador sai de "A publicar" sem F5`,
      apareceu && (await page.getByText(`Do agendador ${tela.rotulo}`).count()) === 0,
      apareceu ? 'continuou na lista depois de publicada' : 'nem chegou a aparecer na lista');
    await admin.from('studio_campaigns').delete().eq('id', doAgendador.id);

    await page.getByRole('button', { name: /Publicadas \(\d+\)/ }).click();
    await page.waitForTimeout(600);
    checar(`[${tela.rotulo}] aba Publicadas guarda o que já saiu`,
      (await page.getByText('Publicada', { exact: true }).count()) > 0);
    await page.getByRole('button', { name: /^Vídeos/ }).click();
    await page.waitForTimeout(600);

    // Realtime: campanha criada FORA da tela (direto no banco, como faria outra aba ou o
    // agendador) tem de aparecer sem F5. Era o que faltava: só vinha depois de recarregar.
    // cada viewport usa a sua, e apaga no fim: os dois rodam sobre o mesmo banco
    const { data: doRealtime, error: eRt } = await admin.from('studio_campaigns').insert({
      video_id: idDaPeca('peca-rascunho.png'), company_id: emp.id, brand_id: marca.id,
      title: `Veio pelo realtime ${tela.rotulo}`, platform: 'tiktok', status: 'scheduled', scheduled_at: daquiTresDias,
    }).select('id').single();
    checar(`[${tela.rotulo}] campanha nova chega sem F5`,
      !eRt && await visivel(page.getByText(/Agendado no TikTok para/), 15000), eRt?.message ?? '');
    if (doRealtime) await admin.from('studio_campaigns').delete().eq('id', doRealtime.id);

    // a captura existe para OLHAR os cards: rola até eles, não até o topo da lista
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('p')].find(p => p.textContent?.includes('peca-publicada.png'));
      el?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(500);
    const sem = await page.evaluate(vw => document.documentElement.scrollWidth <= vw + 1, tela.viewport.width);
    checar(`[${tela.rotulo}] sem rolagem lateral`, sem);
    await page.screenshot({ path: path.join(SAIDA, `${tela.rotulo}-agenda.png`), fullPage: false });

    checar(`[${tela.rotulo}] sem erro de JavaScript`, erros.length === 0, erros.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
}

console.log(`\n${criterios - falhas}/${criterios} critérios · capturas em ${path.relative(RAIZ, SAIDA)}`);
process.exit(falhas ? 1 : 0);
