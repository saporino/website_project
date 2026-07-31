// Postbuild — SEO estático por rota pública.
// Para cada rota da LISTA abaixo, clona o dist/index.html e SUBSTITUI o <head> de SEO da
// Saporino (title, description, canonical, og:*, twitter:*, JSON-LD) pelo da rota — NÃO soma.
// Assim o crawler (WhatsApp/Facebook/LinkedIn, que não roda JS) recebe o head correto.
// Dirigido por lista: novas páginas institucionais entram em ROUTES, sem reescrever o script.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const env = (k, d = '') => process.env[k] || d;

// Configuráveis por env (com fallback pro valor atual). Vercel injeta env no build.
const COFICO_BASE = env('VITE_COFICO_BASE_URL', 'https://www.cafesaporino.com.br/coficobrasil').replace(/\/+$/, '');
const ASSET_ORIGIN = 'https://www.cafesaporino.com.br'; // origem que serve /og/... hoje
const coficoSameAs = [env('VITE_COFICO_INSTAGRAM'), env('VITE_COFICO_LINKEDIN'), env('VITE_COFICO_GOOGLE')].filter(Boolean);

// ── LISTA DE ROTAS PÚBLICAS COM SEO PRÓPRIO ──────────────────────────────
// Adicione novas páginas institucionais aqui (path, out, title, description, canonical, ogImage, jsonLd).
const ROUTES = [
  {
    path: '/coficobrasil',
    out: 'coficobrasil.html',
    title: 'COFICO Brasil — Operador logístico e distribuidor de alimentos',
    description: 'Operador logístico e distribuidor de alimentos com atuação no Estado de São Paulo.',
    canonical: COFICO_BASE,
    ogSiteName: 'COFICO Brasil',
    ogImage: `${ASSET_ORIGIN}/og/cofico-og-1200x630.png`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'COFICO BRASIL',
      legalName: 'V. Medeiros de Santi Ltda',
      taxID: '66.006.929/0001-36',
      description: 'operador logístico e distribuidor de alimentos',
      areaServed: 'Estado de São Paulo',
      url: COFICO_BASE,
      ...(coficoSameAs.length ? { sameAs: coficoSameAs } : {}),
    },
  },
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
  // Validação: exatamente 1 og:title, 1 canonical, 1 JSON-LD (garante que substituiu, não somou).
  const n = (re) => (html.match(re) || []).length;
  const [nOg, nCanon, nLd] = [n(/property="og:title"/g), n(/rel="canonical"/g), n(/application\/ld\+json/g)];
  if (nOg !== 1 || nCanon !== 1 || nLd !== 1) {
    throw new Error(`SEO inválido em ${r.out}: og:title=${nOg}, canonical=${nCanon}, ld+json=${nLd} (esperado 1/1/1)`);
  }
  writeFileSync(resolve(DIST, r.out), html, 'utf8');
  console.log(`✓ ${r.out} — head próprio (og:title=1 · canonical=1 · ld+json=1) · canonical=${r.canonical}`);
}
