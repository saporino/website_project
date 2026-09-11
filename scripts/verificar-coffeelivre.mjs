// Verificador do porte da home Coffee LiVRE.
//
// Compara docs/marketplace/coffee-livre-home-laranja.html (fonte de verdade)
// com os arquivos gerados em src/pages/coffeelivre/. Node puro, sem
// dependência nova e sem parser de HTML: o que interessa aqui são quatro
// medidas grosseiras mas honestas — classes, textos, contagem de elementos e
// contagem de SVG.
//
// Uso: node scripts/verificar-coffeelivre.mjs
//
// O QUE ELE VERIFICA DEPOIS DA UNIDADE 3: a FIDELIDADE VISUAL da home —
// classes, CSS e textos fixos. O que ele NAO verifica mais: produto, loja
// e categoria, que sairam do codigo e foram para o banco na unidade 3.
// Continuar cobrando "Cafe Fazendinha" no JSX seria cobrar justamente o
// que a auditoria mandou tirar.
//
// Diferenca que sobra nao e necessariamente erro: o porte troca innerHTML
// por map de componentes. O relatorio serve para que toda diferenca tenha
// um motivo escrito, nao para chegar a zero.

import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ORIGEM = path.join(RAIZ, 'docs/marketplace/coffee-livre-home-laranja.html');
const PASTA = path.join(RAIZ, 'src/pages/coffeelivre');

const html = fs.readFileSync(ORIGEM, 'utf8');
const arquivos = fs.readdirSync(PASTA).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
const jsx = arquivos.map(f => fs.readFileSync(path.join(PASTA, f), 'utf8')).join('\n');
// Dois arquivos: o gerado do HTML oficial e o das paginas internas, que
// nao existem no HTML e por isso vivem fora do arquivo gerado.
const cssGerado = fs.readFileSync(path.join(PASTA, 'coffeelivre.css'), 'utf8');
const cssPaginas = fs.readFileSync(path.join(PASTA, 'coffeelivre-paginas.css'), 'utf8');
const css = cssGerado + '\n' + cssPaginas;

const corpo = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));

let problemas = 0;
const secao = t => console.log('\n=== ' + t + ' ===');
const ok = t => console.log('  ok  ' + t);
const falha = t => { problemas++; console.log('  !!  ' + t); };

// ---------------------------------------------------------------------
// 1. Classes CSS — toda classe do HTML precisa aparecer no JSX
// ---------------------------------------------------------------------
secao('CLASSES');
const classesDoHtml = new Set();
const guardar = v => v.split(/\s+/).forEach(c => { if (c && !c.includes('$')) classesDoHtml.add(c); });
for (const m of corpo.matchAll(/class="([^"]+)"/g)) guardar(m[1]);
for (const m of script.matchAll(/class="([^"]+)"/g)) guardar(m[1]);

// A classe pode chegar ao porte por className, por array de slides ou pelos
// dados — o que importa e existir, nao por qual caminho.
const dadosBrutos = fs.readFileSync(path.join(PASTA, 'mockData.ts'), 'utf8');
const porteTodo = jsx + dadosBrutos;
const escapar = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A borda da direita aceita `$` porque a classe pode vir seguida de
// interpolação, como em className={`fav${favorito ? ' on' : ''}`}.
const citada = c => new RegExp('[\'"`\\s>]' + escapar(c) + '[\'"`\\s$<]').test(porteTodo);

// So a parte literal de cada className conta; o que esta dentro de ${...} e
// expressao JavaScript, nao nome de classe.
const classesDoJsx = new Set();
for (const m of jsx.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
  (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).forEach(c => c && classesDoJsx.add(c));
}
const semUso = [...classesDoHtml].filter(c => !citada(c)).sort();
if (semUso.length) falha(`classes do HTML ausentes no JSX: ${semUso.join(', ')}`);
else ok(`todas as ${classesDoHtml.size} classes do HTML aparecem no JSX`);

// Toda classe do JSX tem de existir no CSS escopado (pega erro de digitação).
const semRegra = [...classesDoJsx].filter(c => !css.includes('.' + c)).sort();
if (semRegra.length) falha(`classes usadas no JSX sem regra no CSS: ${semRegra.join(', ')}`);
else ok('toda classe usada no JSX tem regra no CSS');

// ---------------------------------------------------------------------
// 2. Textos visíveis
// ---------------------------------------------------------------------
secao('TEXTOS');
const textos = new Set();
// Texto entre tags no corpo, e texto dentro dos template literals do script.
const visivel = corpo.replace(/\son\w+="[^"]*"/g, '');
for (const m of visivel.matchAll(/>([^<>{}]{3,})</g)) {
  const t = m[1].replace(/\s+/g, ' ').trim();
  if (t && !/^[\d.,%\s]+$/.test(t) && !t.startsWith('$')) textos.add(t);
}
// As origens ainda vivem em mockData.ts; produtos, lojas e categorias
// foram para o banco na unidade 3 e nao sao mais cobrados aqui.
{
  const bloco = script.match(/const regs=\[(.*?)\];/s);
  if (bloco) for (const m of bloco[1].matchAll(/'([^']{3,})'/g)) {
    if (!m[1].startsWith('#')) textos.add(m[1]);
  }
}

const dados = fs.readFileSync(path.join(PASTA, 'mockData.ts'), 'utf8');
const tudo = jsx + dados;
const normal = s => s.replace(/\s+/g, ' ').trim();
// O menu "Categorias" do cabecalho era fixo no HTML e passou a vir do
// banco na U3. Estes rotulos viraram linha de lv_categories.
const MIGROU_PARA_O_BANCO = new Set([
  'Cafe em graos', 'Café em grãos', 'Café moído', 'Cápsulas e drip bags',
  'Cafés especiais (80+ pts)', 'Orgânicos e certificados', 'Café verde (cru)',
  'Métodos de preparo', 'Máquinas e moedores', 'Para empresas (B2B)',
]);
const faltando = [...textos].filter(t => {
  if (MIGROU_PARA_O_BANCO.has(t)) return false;
  const alvo = normal(t);
  if (tudo.includes(alvo)) return false;
  // Textos partidos por <br>, <em> ou interpolação chegam em pedaços.
  return !alvo.split(/\s{2,}/).every(p => p.length < 4 || tudo.includes(p));
}).sort();
if (faltando.length) falha(`textos do HTML nao encontrados (${faltando.length}):\n      - ${faltando.join('\n      - ')}`);
else ok(`todos os ${textos.size} textos visiveis do HTML estao no porte`);

// ---------------------------------------------------------------------
// 3. Elementos por seção
// ---------------------------------------------------------------------
secao('CONTAGENS');
const conta = (rotulo, esperado, obtido) => {
  if (esperado === obtido) ok(`${rotulo}: ${obtido}`);
  else falha(`${rotulo}: esperado ${esperado}, obtido ${obtido}`);
};
conta('slides do hero', (corpo.match(/class="slide/g) || []).length, (jsx.match(/classe: 's\d'/g) || []).length);
conta('benefícios', (corpo.match(/class="bf"/g) || []).length, (jsx.match(/className="bf"/g) || []).length);
{
  const bloco = script.match(/const regs=\[(.*?)\];/s);
  conta('origens', (bloco[1].match(/\['/g) || []).length, (dados.match(/^\s+\['[^']+', '[^']+', '[^']+', '#/gm) || []).length);
}
conta('colunas do rodapé', (corpo.match(/<h4>/g) || []).length, (dados.match(/^\s+\['(Comprar|Vender|Ajuda|Institucional)'/gm) || []).length);
console.log('  --  catalogo (produtos, lojas, categorias) saiu do codigo e foi para o banco na U3');

// ---------------------------------------------------------------------
// 4. SVGs
// ---------------------------------------------------------------------
secao('SVG');
const svgHtml = (html.match(/<svg/g) || []).length;
const svgJsx = (jsx.match(/<svg/g) || []).length;
console.log(`  HTML: ${svgHtml} tags <svg> (inclui as que o script gera por string)`);
console.log(`  JSX:  ${svgJsx} tags <svg> (as repetidas viraram um componente so)`);
if (svgJsx < 1) falha('nenhum svg no porte');
else ok('svgs portados como componentes');

// Atributo hifenizado que escapou da conversao para camelCase quebra em silêncio.
const HIFENIZADOS = [
  'stroke-width', 'stop-color', 'stop-opacity', 'clip-path', 'fill-rule',
  'stroke-linecap', 'stroke-linejoin', 'text-anchor', 'font-family',
  'font-size', 'font-weight', 'xlink:href', 'preserveAspectratio',
];
const escaparam = HIFENIZADOS.filter(a => new RegExp(`\\s${a}=`).test(jsx));
if (escaparam.length) falha(`atributo SVG hifenizado no JSX: ${escaparam.join(', ')}`);
else ok('nenhum atributo SVG hifenizado sobrou');

// ---------------------------------------------------------------------
// 5. Regras da conversão
// ---------------------------------------------------------------------
secao('REGRAS');
if (/dangerouslySetInnerHTML\s*=/.test(jsx)) falha('dangerouslySetInnerHTML encontrado');
else ok('sem dangerouslySetInnerHTML');
if (/data:image\/png;base64/.test(jsx)) falha('base64 inline no React');
else ok('logo e icone vem de arquivo, sem base64 inline');
if (/data-logo/.test(jsx)) falha('o truque de copiar o src do cabecalho foi portado');
else ok('rodape importa o PNG direto, sem copiar do cabecalho');
const foraDoEscopo = (css.match(/^[a-z*][^{@]*\{/gim) || []).filter(l => !/^html\.livre-scroll/.test(l.trim()));
if (foraDoEscopo.length) falha(`regra CSS fora de .livre-root: ${foraDoEscopo.slice(0, 3).join(' ')}`);
else ok('todo o CSS esta escopado em .livre-root');

// Os valores do CSS precisam bater declaracao por declaracao com o original.
const blocos = t => (t.match(/\{[^{}]*\}/g) || []).map(b => b.replace(/\s+/g, ''));
const doOriginal = blocos(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
const doGerado = new Set(blocos(cssGerado));
const perdidos = doOriginal.filter(b => !doGerado.has(b));
if (perdidos.length) falha(`declaracoes do CSS original ausentes: ${perdidos.length}`);
else ok(`todas as ${doOriginal.length} declaracoes do CSS original estao no arquivo escopado`);

console.log(`\n${problemas === 0 ? 'SEM DIFERENCAS' : problemas + ' DIFERENCA(S)'} a justificar.\n`);
process.exit(0);
