// Marcação mínima dos textos legais da COFICO (fonte: legal.json).
//
// Existe uma CÓPIA desta função em `scripts/legal-render.mjs`, usada no build para gerar o
// HTML estático das páginas legais (que precisam ser legíveis sem JavaScript). As duas são
// comparadas, texto por texto, em `src/lib/legalCofico.test.ts` — se uma mudar sem a outra,
// o teste quebra. Não é elegante ter duas; é verificável, e isso é o que importa aqui.
//
// Entende, dentro de um texto:
//   **negrito**            → <strong>
//   *ênfase*               → <em>
//   [rótulo](url)          → <a>   (link externo abre em nova aba)
//   {email} {telefone} …   → valores de `vars` (e-mail vira mailto:)

export type Vars = Record<string, string>;

export interface Bloco { h2?: string; p?: string; ul?: string[]; aviso?: string }
export interface Documento {
  slug: string; titulo: string; h1: string; descricao: string; blocos: Bloco[];
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CLASSE_LINK = 'text-cofico-ink hover:underline';

export function renderInline(texto: string, vars: Vars): string {
  // Curingas primeiro: o valor entra como texto e é escapado junto com o resto.
  let t = texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => vars[chave] ?? inteiro);
  t = escapar(t);

  // Links: [rótulo](url). Interno (começa com /) navega no mesmo site; externo abre fora.
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, rotulo: string, url: string) => {
    const externo = /^https?:\/\//i.test(url);
    const extra = externo ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${url}" class="${CLASSE_LINK}"${extra}>${rotulo}</a>`;
  });

  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  // E-mail solto (veio de um curinga) vira link clicável.
  t = t.replace(/([\w.+-]+@[\w.-]+\.\w{2,})/g,
    `<a href="mailto:$1" class="${CLASSE_LINK}">$1</a>`);

  return t;
}
