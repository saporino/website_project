// Página MÁQUINAS DE CAFÉ da COFICO (#maquinas).
//
// REGRA DE CONTEÚDO: sem modelo, marca, preço ou condição (venda, locação, comodato)
// inventados — isso é conversa de comercial. Aqui fica o que a COFICO oferece e para quem.
import { useEffect } from 'react';
import { ArrowRight, Coffee, Wrench, Store } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';
import { whatsAppCofico } from './conteudo';

const WA_MAQUINAS = whatsAppCofico(COFICO.phone, 'Olá! Vim pelo site da COFICO e quero falar sobre máquinas de café.');

const BLOCOS = [
  { icon: Coffee, t: 'Máquinas para o seu ponto de venda', d: 'Equipamento para quem serve café: padaria, cafeteria, mercado, escritório e cozinha industrial.' },
  { icon: Store, t: 'Com o café junto', d: 'A máquina e o abastecimento de café no mesmo fornecedor, com entrega na mesma rota.' },
  { icon: Wrench, t: 'Instalação e suporte', d: 'A gente combina instalação, treinamento da equipe e manutenção no fechamento do negócio.' },
];

export default function CoficoMaquinasPage() {
  useEffect(() => { document.title = 'Máquinas de café — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Máquinas de café</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Máquinas de café</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Do café à xícara: além de abastecer, a COFICO fornece o equipamento que serve o café no seu balcão.
        </p>
        <a href={WA_MAQUINAS} target="_blank" rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
          Falar com o comercial <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCOS.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-8">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h2 className="mt-5 text-lg font-semibold">{t}</h2>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Modelos, condições e prazo: fale com o comercial — montamos a proposta pelo seu consumo de café.
          </p>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
