// Studio — placar de postagem do dia. Bancada de NAVEGADOR no staging (desktop e 375 px).
//
// O que verifica: o topo da marca diz quantas postagens saíram hoje, quantas faltam, pinta
// verde quando a meta fecha, mostra a semana e não conta agendado como feito.
//   node scripts/studio-meta-navegador.mjs [--mostrar]
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

const MARCA = 'teste-meta-nav';
const EMPRESA = 'Meta Studio Teste Ltda';
const PORTA = 5193;
const SAIDA = path.join(RAIZ, 'test-results', 'studio-meta');
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
const visivel = async (loc, ms = 15000) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };

// ---------- dados ----------
await limpar();
const { data: emp, error: eEmp } = await admin.from('companies')
  .insert({ name: EMPRESA, fantasia: 'META TESTE', is_active: true, studio_enabled: true, sort_order: 91 })
  .select('id').single();
if (eEmp) throw new Error(eEmp.message);
const { data: org } = await admin.from('studio_organizations')
  .insert({ name: `Org ${MARCA}`, slug: MARCA, company_id: emp.id, plan: 'interno', status: 'ativa' }).select('id').single();
const { data: marca } = await admin.from('studio_brand_profiles')
  .insert({ company_id: emp.id, organization_id: org.id, name: 'Marca Meta', is_primary: true, guardrails: {}, meta_posts_dia: 3 })
  .select('id, meta_posts_dia').single();

// Hora de Brasília, para o dia bater com o que a tela calcula.
const emSP = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const hojeAs = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const diasAtras = (n, h) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

const daquiA = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

const campanhas = [
  // hoje: 2 publicadas + 1 agendada → falta 1, agendado NÃO conta
  { status: 'published', published_at: hojeAs(8) },
  { status: 'published', published_at: hojeAs(12) },
  { status: 'scheduled', scheduled_at: hojeAs(20) },
  // ontem e anteontem fecharam a meta → sequência de 2
  ...[1, 2].flatMap(n => [7, 12, 19].map(h => ({ status: 'published', published_at: diasAtras(n, h) }))),
  // semana que vem: 2 agendadas em dias diferentes — é o que ele quer enxergar para programar
  { status: 'scheduled', scheduled_at: daquiA(2, 9) },
  { status: 'scheduled', scheduled_at: daquiA(5, 19) },
];
const { error: eC } = await admin.from('studio_campaigns').insert(campanhas.map((c, i) => ({
  company_id: emp.id, brand_id: marca.id, title: `Campanha ${i}`, platform: 'instagram', ...c,
})));
if (eC) throw new Error(eC.message);

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
    checar(`[${tela.rotulo}] placar aparece no topo`, await visivel(page.getByText(/de 3 postagens hoje/), 60000));
    checar(`[${tela.rotulo}] conta só o que foi ao ar (2 de 3, não 3 de 3)`,
      await visivel(page.getByText('2 de 3 postagens hoje'), 10000));
    checar(`[${tela.rotulo}] diz quanto falta e lembra o agendado`,
      await visivel(page.getByText(/falta 1 \(1 agendada para hoje\)/), 10000));
    checar(`[${tela.rotulo}] mostra a sequência de dias na meta`,
      await visivel(page.getByText(/2 dias seguidos na meta/), 10000));
    checar(`[${tela.rotulo}] oferece as janelas de horário`,
      await visivel(page.getByText(/7h – 9h · 11h – 13h · 18h – 21h/), 10000));
    checar(`[${tela.rotulo}] avisa que o horário é referência, não medição`,
      await visivel(page.getByText(/referência de mercado, não do seu público ainda/), 10000));
    checar(`[${tela.rotulo}] mostra o que já está agendado para os próximos dias`,
      await visivel(page.getByText(/Próximos 7 dias:.*2 postagens agendadas/), 10000));
    checar(`[${tela.rotulo}] aponta os dias que ainda estão vazios`,
      await visivel(page.getByText(/5 dias sem nada/), 10000));
    checar(`[${tela.rotulo}] cada quadradinho mostra o dia do mês`,
      await visivel(page.getByText(new RegExp('^' + String(new Date().getDate()).padStart(2, '0') + '$')), 10000));

    // clicar no dia tem de dizer A QUE HORAS — o número sozinho não responde isso
    const diaDaquiA2 = new Date(); diaDaquiA2.setDate(diaDaquiA2.getDate() + 2);
    const rotuloDia = String(diaDaquiA2.getDate()).padStart(2, '0');
    await page.getByText(new RegExp('^' + rotuloDia + '$')).first().click();
    await page.waitForTimeout(500);
    checar(`[${tela.rotulo}] clicar no dia mostra a hora da postagem agendada`,
      await visivel(page.getByText('09:00'), 8000)
      && await visivel(page.getByText('agendado').first(), 5000));
    checar(`[${tela.rotulo}] a lista do dia diz a rede e o título`,
      await visivel(page.getByText('Instagram').first(), 5000));

    // fecha a meta por fora: a terceira publicação tem de pintar verde sem F5
    const { data: nova } = await admin.from('studio_campaigns').insert({
      company_id: emp.id, brand_id: marca.id, title: 'Fecha a meta', platform: 'instagram',
      status: 'published', published_at: new Date().toISOString(),
    }).select('id').single();
    // espera o aviso do banco chegar, em vez de cronometrar: a inscrição do realtime pode
    // levar um instante a mais na primeira carga da página
    checar(`[${tela.rotulo}] fechou a meta e ficou verde sem F5`,
      await visivel(page.getByText('3 de 3 postagens hoje'), 20000)
      && await visivel(page.getByText('· meta cumprida'), 5000));
    await admin.from('studio_campaigns').delete().eq('id', nova.id);

    // F5 tem de devolver na MESMA aba. Antes voltava sempre no Dashboard e perdia o lugar.
    // Entra aqui porque esta bancada já está dentro do Studio, que é o caso que ele relatou.
    await page.reload({ waitUntil: 'domcontentloaded' });
    checar(`[${tela.rotulo}] F5 continua no Studio, não volta ao Dashboard`,
      await visivel(page.getByText('Saporino Studio'), 60000)
      && (await page.getByRole('heading', { name: 'Dashboard' }).count()) === 0);

    const sem = await page.evaluate(vw => document.documentElement.scrollWidth <= vw + 1, tela.viewport.width);
    checar(`[${tela.rotulo}] sem rolagem lateral`, sem);
    await page.screenshot({ path: path.join(SAIDA, `${tela.rotulo}-meta.png`), fullPage: false });
    checar(`[${tela.rotulo}] sem erro de JavaScript`, erros.length === 0, erros.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.parar();
  await limpar();
}

console.log(`\n${criterios - falhas}/${criterios} critérios · capturas em ${path.relative(RAIZ, SAIDA)}`);
process.exitCode = falhas ? 1 : 0;
