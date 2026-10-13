// Gera o HTML ESTÁTICO das páginas legais da COFICO a partir de src/pages/coficobrasil/legal.json.
//
// Por que estático: a Meta (e qualquer crawler) precisa LER a política sem executar
// JavaScript. O app React monta depois e substitui este conteúdo pelo dele — as classes
// são as mesmas, então o visual não pisca.
//
// `renderInline` é cópia da função em src/pages/coficobrasil/legalMarkup.ts. As duas são
// comparadas em src/lib/legalCofico.test.ts; se uma mudar sem a outra, o teste quebra.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LEGAL = JSON.parse(
  readFileSync(resolve('src/pages/coficobrasil/legal.json'), 'utf8'));

const escapar = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CLASSE_LINK = 'text-cofico-ink hover:underline';

export function renderInline(texto, vars) {
  let t = texto.replace(/\{(\w+)\}/g, (inteiro, chave) => vars[chave] ?? inteiro);
  t = escapar(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, rotulo, url) => {
    const externo = /^https?:\/\//i.test(url);
    const extra = externo ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${url}" class="${CLASSE_LINK}"${extra}>${rotulo}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/([\w.+-]+@[\w.-]+\.\w{2,})/g,
    `<a href="mailto:$1" class="${CLASSE_LINK}">$1</a>`);
  return t;
}

// As classes abaixo acompanham CoficoPolicyPages.tsx. Mudou lá, muda aqui.
const C = {
  h2: 'text-xl md:text-2xl font-bold text-neutral-900 mt-8 mb-3',
  ul: 'list-disc pl-6',
  li: 'mb-1',
  aviso: 'rounded-lg border border-cofico-ink/30 bg-cofico-ink/5 p-4 text-sm',
};

export function corpoDoDocumento(doc, vars) {
  const linha = (b) => {
    if (b.h2) return `<h2 class="${C.h2}">${renderInline(b.h2, vars)}</h2>`;
    if (b.ul) return `<ul class="${C.ul}">${b.ul.map(i => `<li class="${C.li}">${renderInline(i, vars)}</li>`).join('')}</ul>`;
    if (b.aviso) return `<div class="${C.aviso}">${renderInline(b.aviso, vars)}</div>`;
    return `<p>${renderInline(b.p ?? '', vars)}</p>`;
  };
  return doc.blocos.map(linha).join('\n        ');
}

/** O miolo que vai dentro de <div id="root">: mesmo esqueleto visual da página React. */
export function paginaEstatica(doc, vars, atualizado) {
  return `<div class="min-h-screen bg-white">
      <header class="border-b border-neutral-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="../" class="font-semibold text-neutral-900">COFICO <span class="text-cofico-ink">Brasil</span></a>
          <a href="../" class="text-sm text-neutral-500">&larr; Voltar ao site</a>
        </div>
      </header>
      <main class="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <h1 class="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">${escapar(doc.h1)}</h1>
        <p class="text-sm text-neutral-500 mb-8"><strong>Última atualização:</strong> ${escapar(atualizado)}</p>
        <div class="text-neutral-700 leading-relaxed space-y-4">
        ${corpoDoDocumento(doc, vars)}
        </div>
      </main>
      <footer class="border-t border-neutral-200 bg-neutral-50 py-8 text-center text-sm text-neutral-500">
        <p>COFICO Brasil &middot; Est. 2026 &middot; CNPJ ${escapar(vars.cnpj)}</p>
        <p class="mt-2">
          <a href="privacidade" class="${CLASSE_LINK}">Política de Privacidade</a> &middot;
          <a href="termos" class="${CLASSE_LINK}">Termos de Uso</a> &middot;
          <a href="exclusao-de-dados" class="${CLASSE_LINK}">Exclusão de dados</a>
        </p>
      </footer>
    </div>`;
}
