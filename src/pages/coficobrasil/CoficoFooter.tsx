// Footer PRÓPRIO da COFICO. Rodapé usa APENAS a linha institucional pedida.
// A razão social V. Medeiros de Santi Ltda NUNCA aparece aqui (vai só no JSON-LD, na Tarefa 3).
import { COFICO } from './config';

export default function CoficoFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">COFICO Brasil · Est. 2026 · CNPJ {COFICO.cnpj}</p>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#privacidade" className="text-neutral-500 hover:text-cofico-ink transition-colors">Política de Privacidade</a>
          <a href="#termos" className="text-neutral-500 hover:text-cofico-ink transition-colors">Termos de Uso</a>
        </nav>
      </div>
    </footer>
  );
}
