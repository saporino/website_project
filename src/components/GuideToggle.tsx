import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { isGuideOn, setGuideOn } from '../lib/guide';

// Botão liga/desliga do "Guia: pra onde foi". Fica no cabeçalho do Admin e do RepCo.
export default function GuideToggle() {
  const [on, setOn] = useState(isGuideOn());
  useEffect(() => {
    const h = () => setOn(isGuideOn());
    window.addEventListener('guide-mode-changed', h);
    return () => window.removeEventListener('guide-mode-changed', h);
  }, []);
  const toggle = () => { const n = !on; setGuideOn(n); setOn(n); };
  return (
    <button
      onClick={toggle}
      title={on
        ? 'Guia ligado: mostra pra onde cada coisa vai. Clique para desligar.'
        : 'Guia desligado. Clique para ligar e ver pra onde cada coisa vai (bom enquanto aprende o site).'}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
        on ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
      }`}
    >
      <Compass className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Guia {on ? 'ligado' : 'desligado'}</span>
    </button>
  );
}
