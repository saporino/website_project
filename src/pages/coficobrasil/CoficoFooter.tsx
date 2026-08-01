// Footer PRÓPRIO da COFICO. Rodapé usa APENAS a linha institucional pedida.
// A razão social V. Medeiros de Santi Ltda NUNCA aparece aqui (vai só no JSON-LD, na Tarefa 3).
import { COFICO } from './config';

export default function CoficoFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-sm text-neutral-500">COFICO Brasil · Est. 2026 · CNPJ {COFICO.cnpj}</p>
      </div>
    </footer>
  );
}
