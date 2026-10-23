// Footer PRÓPRIO da COFICO. Rodapé usa APENAS a linha institucional pedida.
// A razão social V. Medeiros de Santi Ltda NUNCA aparece aqui (vai só no JSON-LD e nas
// páginas legais, onde é obrigatório identificar o controlador).
//
// Os links legais são URLs REAIS (não hash) porque a Meta exige URL direta e indexável.
// `linkLegal` resolve o caminho por domínio: /privacidade no domínio da COFICO,
// /coficobrasil/privacidade quando a página está servida sob o site da Saporino.
import { COFICO, linkLegal, linkTrabalheConosco } from './config';

export default function CoficoFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">COFICO Brasil · Est. 2026 · CNPJ {COFICO.cnpj}</p>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {/* A vaga é da COFICO: o rodapé dela é que tem de ter a porta. */}
          <a href={linkTrabalheConosco()} className="font-semibold text-cofico-ink hover:underline">Trabalhe com a COFICO</a>
          <a href={linkLegal('privacidade')} className="text-neutral-500 hover:text-cofico-ink transition-colors">Política de Privacidade</a>
          <a href={linkLegal('termos')} className="text-neutral-500 hover:text-cofico-ink transition-colors">Termos de Uso</a>
          <a href={linkLegal('exclusao-de-dados')} className="text-neutral-500 hover:text-cofico-ink transition-colors">Exclusão de dados</a>
        </nav>
      </div>
    </footer>
  );
}
