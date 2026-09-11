// Gerador do CSS escopado da home Coffee LiVRE.
//
// Le o <style> de docs/marketplace/coffee-livre-home-laranja.html e reescreve
// so os SELETORES, prefixando tudo com .livre-root. Os valores nao sao
// tocados. Existe para que uma atualizacao do HTML oficial possa ser
// reaplicada sem ninguem redigitar 272 blocos de declaracao na mao.
//
// Uso: node scripts/escopar-css-coffeelivre.mjs
import fs from 'fs';
import path from 'path';
const RAIZ = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'docs/marketplace/coffee-livre-home-laranja.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

const escopo = t =>
  t === ':root' || t === 'body' ? '.livre-root'
  : t === 'html' ? 'html.livre-scroll'
  : '.livre-root ' + t;

// Separa a trivia (quebras de linha e comentarios) do seletor de verdade.
function partir(bruto) {
  let i = 0, trivia = '';
  for (;;) {
    const resto = bruto.slice(i);
    const espaco = resto.match(/^\s+/);
    if (espaco) { trivia += espaco[0]; i += espaco[0].length; continue; }
    if (bruto.startsWith('/*', i)) { const f = bruto.indexOf('*/', i) + 2; trivia += bruto.slice(i, f); i = f; continue; }
    break;
  }
  return [trivia, bruto.slice(i).trim()];
}

function transformar(fonte) {
  let out = '', i = 0;
  while (i < fonte.length) {
    const abre = fonte.indexOf('{', i);
    if (abre === -1) { out += fonte.slice(i); break; }
    const [trivia, sel] = partir(fonte.slice(i, abre));
    if (sel.startsWith('@')) {
      let nivel = 1, j = abre + 1;
      while (j < fonte.length && nivel > 0) { if (fonte[j] === '{') nivel++; else if (fonte[j] === '}') nivel--; j++; }
      out += trivia + sel + '{' + transformar(fonte.slice(abre + 1, j - 1)) + '}';
      i = j;
    } else {
      const fecha = fonte.indexOf('}', abre);
      out += trivia + sel.split(',').map(s => escopo(s.trim())).join(',') + fonte.slice(abre, fecha + 1);
      i = fecha + 1;
    }
  }
  return out;
}

const cabecalho = `/* Coffee LiVRE — CSS da home oficial.
 *
 * GERADO por escopar.mjs a partir de
 * docs/marketplace/coffee-livre-home-laranja.html. Os VALORES sao identicos
 * ao original, declaracao por declaracao. A unica mudanca e o escopo: tudo
 * passa a viver sob .livre-root para nao vazar para o resto do site.
 *   :root e body  -> .livre-root
 *   html          -> html.livre-scroll (a classe entra e sai com a rota)
 *   *, a, button  -> .livre-root *, .livre-root a, .livre-root button
 * As media queries (1100px, 860px, 560px) ficam iguais, com o conteudo
 * escopado do mesmo jeito.
 *
 * NAO converter para utilitarias do Tailwind: fidelidade ao HTML oficial vale
 * mais que padronizacao, e este arquivo e a fonte visual da pagina.
 */

/* --- Preflight do Tailwind, neutralizado SO aqui dentro ---
 * O preflight zera tamanho e peso de titulo. O HTML original conta com o
 * padrao do navegador em dois pontos que nao declaram peso: o h3 dos banners
 * duplos e o h4 do rodape. Sem isto, os dois nascem finos.
 *
 * Vem ANTES das regras da pagina de proposito: mesma especificidade, entao
 * quem declara depois vence — e as declaracoes explicitas do original
 * (.sec-h h2 com 600, .prod h3 com 400) continuam mandando.
 * O preflight global segue intocado.
 */
.livre-root h1,.livre-root h2,.livre-root h3,.livre-root h4,.livre-root h5,.livre-root h6{font-weight:bold}
.livre-root h1{font-size:2em}
.livre-root h2{font-size:1.5em}
.livre-root h3{font-size:1.17em}
.livre-root h4{font-size:1em}
.livre-root svg{display:inline}
.livre-root ul,.livre-root ol{list-style:disc}
.livre-root input::placeholder{color:#9ca3af;opacity:1}
`;

fs.writeFileSync(path.join(RAIZ, 'src/pages/coffeelivre/coffeelivre.css'), cabecalho + transformar(css).trim() + '\n');
const gerado = fs.readFileSync(path.join(RAIZ, 'src/pages/coffeelivre/coffeelivre.css'), 'utf8');
console.log('media queries intactas:', (gerado.match(/^@media/gm) || []).length);
console.log('regras escopadas:', (gerado.match(/\.livre-root/g) || []).length);
console.log('seletor colado em comentario:', /livre-root\s*\/\*/.test(gerado) ? 'SIM (erro)' : 'nao');
