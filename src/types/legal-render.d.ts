// `scripts/legal-render.mjs` é JavaScript de build (roda em Node, no postbuild). O teste
// `src/lib/legalCofico.test.ts` o importa para provar que ele e o renderizador do React
// produzem exatamente o mesmo HTML. Esta declaração só dá tipo a esse import.
declare module '*/scripts/legal-render.mjs' {
  export const LEGAL: { atualizado: string; vars: Record<string, string>; documentos: unknown[] };
  export const CLASSE_LINK: string;
  export function renderInline(texto: string, vars: Record<string, string>): string;
  export function corpoDoDocumento(doc: unknown, vars: Record<string, string>): string;
  export function paginaEstatica(doc: unknown, vars: Record<string, string>, atualizado: string): string;
}
