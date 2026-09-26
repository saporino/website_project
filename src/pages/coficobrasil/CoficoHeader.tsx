// Header PRÓPRIO da COFICO (não reaproveita o Header do App.tsx, que é const local não exportado).
// "Produtos" abre as linhas que a COFICO vende (café, embalagem, filtro, máquina). Com cada linha
// virando item de menu a barra passava de sete itens e ficava ilegível.
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

const LINHAS: [string, string][] = [
  ['#loja', 'Cafés'],
  ['#embalagens', 'Embalagens e impressão'],
  ['#filtros', 'Filtros e coadores'],
  ['#maquinas', 'Máquinas e moinhos'],
];

const NAV: [string, string][] = [
  ['#marcas', 'Marcas'],
  ['#servicos', 'Serviços'],
  ['#atuacao', 'Atuação'],
  ['#contato', 'Contato'],
];

export default function CoficoHeader() {
  const [open, setOpen] = useState(false);
  const [linhasAbertas, setLinhasAbertas] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Logo COFICO — border-radius 0 (rounded-none), tom acessível cofico.ink */}
        <a href="#topo" className="flex items-center gap-2" aria-label="COFICO Brasil — início">
          <span className="inline-flex items-center bg-cofico-ink text-white font-black tracking-tight text-lg px-2.5 py-1 rounded-none">COFICO</span>
          <span className="hidden sm:inline text-sm font-medium text-neutral-500">Brasil</span>
        </a>
        <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
          {/* Produtos abre no hover e no clique (teclado); sem JS de posicionamento. */}
          <div className="relative group">
            <button type="button" onClick={() => setLinhasAbertas(v => !v)} aria-expanded={linhasAbertas}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-cofico-ink transition-colors">
              Produtos <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className={`absolute left-0 top-full pt-3 ${linhasAbertas ? 'block' : 'hidden'} group-hover:block group-focus-within:block`}>
              <div className="min-w-[230px] bg-white border border-neutral-200 shadow-sm py-2">
                {LINHAS.map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setLinhasAbertas(false)}
                    className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-cofico-ink transition-colors">{label}</a>
                ))}
              </div>
            </div>
          </div>
          {NAV.map(([href, label]) => (
            <a key={href} href={href} className="text-sm font-medium text-neutral-700 hover:text-cofico-ink transition-colors">{label}</a>
          ))}
        </nav>
        <button className="md:hidden p-2 text-neutral-700" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Abrir menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-neutral-200 bg-white px-6 py-4 flex flex-col gap-4" aria-label="Navegação mobile">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">Produtos</span>
          {LINHAS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="pl-3 text-sm font-medium text-neutral-700">{label}</a>
          ))}
          {NAV.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="text-sm font-medium text-neutral-700">{label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
