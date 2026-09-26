// Página FILTROS E COADORES da COFICO (#filtros) — linha própria, vendida junto com o café.
//
// REGRA DE CONTEÚDO: sem número inventado. Tamanho, marca, quantidade por caixa e preço
// saem da tabela, com o comercial. Aqui fica só o que existe de fato.
import { useEffect } from 'react';
import { ArrowRight, Filter, Layers, Recycle, ShoppingBag } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';
import { whatsAppCofico } from './conteudo';

const WA_FILTROS = whatsAppCofico(COFICO.phone, 'Olá! Vim pelo site da COFICO e quero a tabela de filtros e coadores.');

const LINHAS = [
  { icon: Filter, t: 'Filtro de papel', d: 'Para coador de plástico e cafeteira elétrica, nos tamanhos que a sua operação usa. Caixa fechada para revenda ou consumo.' },
  { icon: Layers, t: 'Coador de pano', d: 'O coador de sempre, para quem faz café na hora. Tamanhos para casa, padaria e cozinha industrial.' },
  { icon: Recycle, t: 'Coador permanente', d: 'Coador reutilizável, sem descarte diário — opção para quem quer reduzir custo por xícara.' },
];

export default function CoficoFiltrosPage() {
  useEffect(() => { document.title = 'Filtros e coadores de café — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Filtros e coadores</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Filtros e coadores</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Quem vende café vende filtro junto. A COFICO entrega os dois no mesmo pedido, na mesma rota,
          para mercados, padarias, cafeterias e cozinhas industriais.
        </p>
        <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
          Pedir a tabela <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">O que temos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {LINHAS.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-8">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Tamanhos, marcas e quantidade por caixa: peça a tabela — cotamos em cima do seu volume.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Compre junto com o café</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Café, filtro e embalagem no mesmo pedido, com pedido mínimo e frete cotado por destino.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#loja" className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" /> Ver o catálogo
            </a>
            <a href="#embalagens" className="inline-flex items-center border border-neutral-300 text-neutral-900 text-sm font-semibold px-6 py-3.5 hover:border-cofico-ink hover:text-cofico-ink transition-colors">
              Ver embalagens
            </a>
          </div>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
