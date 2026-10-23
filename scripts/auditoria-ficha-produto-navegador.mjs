// A FICHA DO PRODUTO CABE DENTRO DELA MESMA? — bancada de NAVEGADOR no staging.
//
// Ele abriu a ficha e os botões de peso estavam FORA do quadro, invadindo a coluna
// seguinte. O defeito não é "o peso": é a classe inteira — qualquer fileira de
// controles cujo conteúdo não encolhe vaza para fora do cartão, e só se descobre
// quando alguém repara numa captura de tela.
//
// Esta bancada mede. Para cada fileira de controles da ficha ela compara a largura
// do conteúdo com a largura da caixa (`scrollWidth` × `clientWidth`) e compara o
// retângulo de cada controle com o do formulário. Nada opina; tudo é medido.
//
//   node scripts/auditoria-ficha-produto-navegador.mjs [--mostrar]

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

const MARCA = 'teste-ficha-produto';
const PORTA = 5198;
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

// Larguras em que a ficha precisa caber. O notebook dele é 1366; a janela estreita
// é onde um `flex-1` que não encolhe aparece primeiro.
const LARGURAS = [1366, 1180, 1024];

try {
  for (const largura of LARGURAS) {
    console.log(`\n· janela de ${largura}px`);
    const ctx = await browser.newContext({ viewport: { width: largura, height: 950 }, locale: 'pt-BR' });
    await ctx.addInitScript(([k, v, emp]) => {
      localStorage.setItem(k, v);
      localStorage.setItem('admin-initial-tab', 'products');
      localStorage.setItem('active-company-id', emp);
    }, [`sb-${ambiente.ref}-auth-token`, JSON.stringify(login.session), empresa.id]);
    const page = await ctx.newPage();

    await page.goto(servidor.base + '/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (!await visivel(page.getByRole('heading', { name: 'Gerenciamento de Produtos' }), 90000)) {
      checar('Produtos abre', false, 'a aba não carregou'); await ctx.close(); continue;
    }
    await page.getByRole('button', { name: 'Adicionar Produto' }).click();
    if (!await visivel(page.getByRole('heading', { name: 'Novo Produto' }), 30000)) {
      checar('a ficha abre', false, 'o formulário não apareceu'); await ctx.close(); continue;
    }

    // O formulário é a moldura: nada de dentro pode ultrapassar a borda dele.
    const medidas = await page.evaluate(() => {
      const rotulo = (txt) => [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(txt));
      const fora = (el) => {
        const caixa = el.closest('form') ?? el.closest('[class*="rounded"]');
        const a = el.getBoundingClientRect(), b = caixa.getBoundingClientRect();
        return { vaza: Math.round(a.right - b.right), rolaDeLado: el.scrollWidth - el.clientWidth };
      };
      const r = {};
      for (const [chave, texto] of [['peso', 'Peso (gramas)'], ['canais', 'Onde pode ser vendido']]) {
        const l = rotulo(texto);
        if (!l) { r[chave] = null; continue; }
        const fileira = l.nextElementSibling?.matches('div') ? l.nextElementSibling
          : [...l.parentElement.children].find(c => c !== l && c.tagName === 'DIV');
        r[chave] = fileira ? fora(fileira) : null;
        // E cada controle da fileira, um a um: a caixa pode caber e o botão vazar.
        if (fileira) {
          const b = fileira.getBoundingClientRect();
          r[chave].piorBotao = Math.max(0, ...[...fileira.querySelectorAll('button')]
            .map(x => Math.round(x.getBoundingClientRect().right - b.right)));
        }
      }
      r.paginaRolaDeLado = document.documentElement.scrollWidth - document.documentElement.clientWidth;

      // VARREDURA DA CLASSE INTEIRA, não só dos dois rótulos acima. Ele disse que
      // o defeito "deve estar no site todo"; a única resposta honesta é medir tudo
      // o que a ficha desenha. Qualquer caixa cujo conteúdo é mais largo do que ela
      // está escondendo algo de quem usa.
      const form = document.querySelector('form') ?? document.body;
      r.vazamentos = [...form.querySelectorAll('*')]
        .filter(el => el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflowX === 'visible')
        .slice(0, 12)
        .map(el => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (+${el.scrollWidth - el.clientWidth}px): ${el.textContent.trim().slice(0, 40)}`);
      return r;
    });

    for (const [chave, titulo] of [['peso', 'os pesos'], ['canais', 'os canais de venda']]) {
      const m = medidas[chave];
      if (!m) { checar(`${titulo}: fileira encontrada`, false, 'não achei o rótulo na tela'); continue; }
      checar(`${titulo} cabem dentro da ficha`, m.vaza <= 1, `vazam ${m.vaza}px para fora da borda`);
      checar(`${titulo} não precisam de rolagem lateral`, m.rolaDeLado <= 1, `${m.rolaDeLado}px escondidos`);
      checar(`${titulo}: nenhum botão passa da fileira`, (m.piorBotao ?? 0) <= 1, `o pior passa ${m.piorBotao}px`);
    }
    checar('a página não rola de lado', medidas.paginaRolaDeLado <= 1, `${medidas.paginaRolaDeLado}px`);
    checar('nenhuma outra fileira da ficha esconde conteúdo', medidas.vazamentos.length === 0,
      '\n      ' + medidas.vazamentos.join('\n      '));
    await ctx.close();
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
