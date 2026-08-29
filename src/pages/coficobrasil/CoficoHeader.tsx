// Header PRÓPRIO da COFICO (não reaproveita o Header do App.tsx, que é const local não exportado).
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV: [string, string][] = [
  ['#o-que-fazemos', 'O que fazemos'],
  ['#marcas', 'Marcas'],
  ['#produtos', 'Produtos'],
  ['#atuacao', 'Atuação'],
  ['#contato', 'Contato'],
];

export default function CoficoHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Logo COFICO — border-radius 0 (rounded-none), tom acessível cofico.ink */}
        <a href="#topo" className="flex items-center gap-2" aria-label="COFICO Brasil — início">
          <span className="inline-flex items-center bg-cofico-ink text-white font-black tracking-tight text-lg px-2.5 py-1 rounded-none">COFICO</span>
          <span className="hidden sm:inline text-sm font-medium text-neutral-500">Brasil</span>
        </a>
        <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
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
          {NAV.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="text-sm font-medium text-neutral-700">{label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
