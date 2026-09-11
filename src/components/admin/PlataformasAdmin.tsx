// Plataformas — as plataformas próprias que não são a operação da Saporino.
//
// POR QUE ESTE AGRUPADOR EXISTE: a barra do admin tem dezessete abas e
// mistura três coisas diferentes — operação da Saporino, plataformas
// próprias e ferramentas. O Coffee LiVRE precisava entrar e não cabia mais
// uma aba no topo.
//
// POR QUE NÃO "Rede COFICO": o nome subordinaria o Coffee LiVRE à COFICO, e
// ele é marca independente. Nome interno vaza — vira rótulo em conversa e
// em captura de tela. "Plataformas" é literal e não hierarquiza.
//
// O Coffee Network continua inteiro, com as mesmas sub-abas de sempre. O
// que muda é um clique a mais para chegar nele.
import { useState } from 'react';
import { Coffee, Store } from 'lucide-react';
import CoffeeNetworkAdmin from './CoffeeNetworkAdmin';
import CoffeeLivreAdmin from './coffeelivre/CoffeeLivreAdmin';

type Plataforma = 'network' | 'livre';

const PLATAFORMAS: { id: Plataforma; label: string; descricao: string; icon: typeof Coffee }[] = [
  { id: 'network', label: 'Coffee Network', descricao: 'Oferta, solicitação e match entre participantes', icon: Coffee },
  { id: 'livre', label: 'Coffee LiVRE', descricao: 'Marketplace vertical de café', icon: Store },
];

export default function PlataformasAdmin() {
  const [ativa, setAtiva] = useState<Plataforma>('network');

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-4 md:p-6">
      <div className="mb-5 flex flex-wrap gap-2">
        {PLATAFORMAS.map(p => (
          <button
            key={p.id}
            onClick={() => setAtiva(p.id)}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-colors ${
              ativa === p.id
                ? 'border-[#8B2214] bg-white shadow-sm'
                : 'border-gray-200 bg-white/60 hover:border-gray-300'
            }`}
          >
            <span className={`grid h-9 w-9 place-items-center rounded-lg ${
              ativa === p.id ? 'bg-[#f5f0ef] text-[#8B2214]' : 'bg-gray-100 text-gray-400'
            }`}>
              <p.icon className="h-5 w-5" />
            </span>
            <span>
              <span className={`block text-sm font-semibold ${ativa === p.id ? 'text-gray-900' : 'text-gray-500'}`}>
                {p.label}
              </span>
              <span className="block text-[11px] text-gray-400">{p.descricao}</span>
            </span>
          </button>
        ))}
      </div>

      {/* O Coffee Network já traz o próprio fundo e respiro; o Coffee LiVRE
          é filho deste contêiner. */}
      {ativa === 'network' ? (
        <div className="-m-4 md:-m-6"><CoffeeNetworkAdmin /></div>
      ) : (
        <CoffeeLivreAdmin />
      )}
    </div>
  );
}
