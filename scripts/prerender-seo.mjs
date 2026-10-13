// Postbuild — SEO estático por rota pública.
// Para cada rota da LISTA abaixo, clona o dist/index.html e SUBSTITUI o <head> de SEO da
// Saporino (title, description, canonical, og:*, twitter:*, JSON-LD) pelo da rota — NÃO soma.
// Assim o crawler (WhatsApp/Facebook/LinkedIn, que não roda JS) recebe o head correto.
// Dirigido por lista: novas páginas institucionais entram em ROUTES, sem reescrever o script.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGAL, paginaEstatica } from './legal-render.mjs';

const DIST = resolve('dist');
const env = (k, d = '') => process.env[k] || d;

// Configuráveis por env (com fallback pro valor atual). Vercel injeta env no build.
const COFICO_BASE = env('VITE_COFICO_BASE_URL', 'https://www.coficobrasil.com.br').replace(/\/+$/, '');
const ASSET_ORIGIN = env('VITE_COFICO_BASE_URL', 'https://www.coficobrasil.com.br').replace(/\/+$/, ''); // domínio próprio da COFICO serve /og/...
const coficoSameAs = [env('VITE_COFICO_INSTAGRAM'), env('VITE_COFICO_LINKEDIN'), env('VITE_COFICO_GOOGLE')].filter(Boolean);

// ── LISTA DE ROTAS PÚBLICAS COM SEO PRÓPRIO ──────────────────────────────
// Adicione novas páginas institucionais aqui (path, out, title, description, canonical, ogImage, jsonLd).
const ROUTES = [
  {
    path: '/coficobrasil',
    out: 'coficobrasil.html',
    title: 'COFICO Brasil — Desenvolvimento comercial e distribuição de marcas de alimentos em SP',
    description: 'Levamos marcas de alimentos ao mercado no Estado de São Paulo: distribuição oficial, força de vendas própria, armazenagem e entrega com tecnologia proprietária. Centro de distribuição em Várzea Paulista.',
    canonical: COFICO_BASE,
    ogSiteName: 'COFICO Brasil',
    ogImage: `${ASSET_ORIGIN}/og/cofico-og-1200.png`,
    favicon: '/icons/cofico-icon-512.png',            // COFICO tem favicon próprio (não herda o da Saporino)
    faviconApple: '/icons/cofico-apple-touch-icon.png',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'COFICO BRASIL',
      legalName: 'V. Medeiros de Santi Ltda',
      taxID: '66.006.929/0001-36',
      description: 'desenvolvimento comercial e distribuição de marcas de alimentos',
      areaServed: 'Estado de São Paulo',
      url: COFICO_BASE,
      sameAs: ['https://instagram.com/coficobrasil', 'https://maps.app.goo.gl/rYKCPWBXWpKzJFZD7', ...coficoSameAs],
    },
  },
  // ── Páginas legais da COFICO ────────────────────────────────────────────
  // A Meta exige URL direta e conteúdo LEGÍVEL SEM JAVASCRIPT. Por isso estas rotas, além
  // do <head> próprio, recebem o texto da política já montado dentro do <div id="root">:
  // o crawler lê o HTML cru; o React monta depois e substitui pelo mesmo conteúdo.
  // Texto e marcação vêm de src/pages/coficobrasil/legal.json (fonte única).
  ...LEGAL.documentos.map(doc => ({
    path: `/${doc.slug}`,
    out: `cofico-${doc.slug}.html`,
    title: doc.titulo,
    description: doc.descricao,
    canonical: `${COFICO_BASE}/${doc.slug}`,
    ogSiteName: 'COFICO Brasil',
    ogImage: `${ASSET_ORIGIN}/og/cofico-og-1200.png`,
    favicon: '/icons/cofico-icon-512.png',
    faviconApple: '/icons/cofico-apple-touch-icon.png',
    // noindex NÃO: a Meta precisa alcançar a página, e política pública é indexável.
    corpo: paginaEstatica(doc, LEGAL.vars, LEGAL.atualizado),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: doc.h1,
      description: doc.descricao,
      url: `${COFICO_BASE}/${doc.slug}`,
      inLanguage: 'pt-BR',
      dateModified: LEGAL.atualizado,
      publisher: {
        '@type': 'Organization',
        name: 'COFICO BRASIL',
        legalName: LEGAL.vars.razao,
        taxID: LEGAL.vars.cnpj,
        url: COFICO_BASE,
      },
    },
  })),
];

// Remove SÓ o SEO existente (mantém charset, viewport, favicon, GA, script de limpeza de SW).
function stripSeo(html) {
  return html
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/[ \t]*<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/[ \t]*<link\s+rel="canonical"[^>]*>\s*/i, '')
    .replace(/[ \t]*<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/[ \t]*<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/[ \t]*<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/i, '');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHead(r) {
  return [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}" />`,
    `<link rel="canonical" href="${esc(r.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(r.ogSiteName)}" />`,
    `<meta property="og:title" content="${esc(r.title)}" />`,
    `<meta property="og:description" content="${esc(r.description)}" />`,
    `<meta property="og:url" content="${esc(r.canonical)}" />`,
    `<meta property="og:image" content="${esc(r.ogImage)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(r.title)}" />`,
    `<meta name="twitter:description" content="${esc(r.description)}" />`,
    `<meta name="twitter:image" content="${esc(r.ogImage)}" />`,
    `<script type="application/ld+json">${JSON.stringify(r.jsonLd)}</script>`,
  ].join('\n    ');
}

const index = readFileSync(resolve(DIST, 'index.html'), 'utf8');
for (const r of ROUTES) {
  let html = stripSeo(index).replace('</head>', `    ${buildHead(r)}\n  </head>`);
  // Favicon próprio da rota (ex.: COFICO não pode herdar o ícone da Saporino na aba/Google).
  if (r.favicon) html = html.replace('/icons/saporino-icon-512.png', r.favicon);
  if (r.faviconApple) html = html.replace('/icons/apple-touch-icon.png', r.faviconApple);
  // Corpo estático: entra DENTRO do #root. O React usa createRoot().render() (não hydrate),
  // então ele simplesmente substitui este conteúdo ao montar — sem erro de hidratação.
  if (r.corpo) {
    const vazio = /<div id="root"([^>]*)><\/div>/;
    if (!vazio.test(html)) throw new Error(`${r.out}: não achei <div id="root"></div> para inserir o corpo estático.`);
    html = html.replace(vazio, (_m, attrs) => `<div id="root"${attrs}>${r.corpo}</div>`);
  }
  // Validação: exatamente 1 og:title, 1 canonical, 1 JSON-LD (garante que substituiu, não somou).
  const n = (re) => (html.match(re) || []).length;
  const [nOg, nCanon, nLd] = [n(/property="og:title"/g), n(/rel="canonical"/g), n(/application\/ld\+json/g)];
  if (nOg !== 1 || nCanon !== 1 || nLd !== 1) {
    throw new Error(`SEO inválido em ${r.out}: og:title=${nOg}, canonical=${nCanon}, ld+json=${nLd} (esperado 1/1/1)`);
  }
  // Sem JS, o texto tem de estar ali. Uma política vazia é reprovada pela Meta.
  if (r.corpo && !/<h1[^>]*>/.test(html)) throw new Error(`${r.out}: corpo estático sem <h1>.`);
  writeFileSync(resolve(DIST, r.out), html, 'utf8');
  console.log(`✓ ${r.out} — head próprio (og:title=1 · canonical=1 · ld+json=1)${r.corpo ? ' · corpo estático ' + r.corpo.length + ' bytes' : ''} · canonical=${r.canonical}`);
}
