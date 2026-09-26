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

// LINHA PAPEL COFICO — dados do próprio produto (arte da caixa + códigos COFICO).
// Quantidade por caixa master ainda NÃO entra: o Vlademir precisa confirmar (10 ou 40 cartuchos).
const PAPEL = [
  { n: '100', codigo: 'COFI1003040', uso: 'Para coador nº 100 — a medida de 1 a 2 xícaras, do café feito na hora.' },
  { n: '102', codigo: 'COFI1023040', uso: 'A medida mais usada no Brasil, para coador nº 102 e cafeteira elétrica doméstica.' },
  { n: '103', codigo: 'COFI1033040', uso: 'Para coador nº 103, de volume maior — padaria, escritório e cozinha industrial.' },
];

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

      {/* Linha própria da COFICO — marca, código e conteúdo saem da arte da caixa */}
      <section id="linha-papel" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Linha Papel COFICO</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Filtro de papel com a nossa marca, em <strong>100% fibras vegetais</strong>, para filtragem rápida e
            sem gosto de papel. Cada cartucho leva <strong>30 filtros</strong>.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PAPEL.map(({ n, codigo, uso }) => (
              <article key={n} className="bg-white border border-neutral-200 p-6 flex flex-col">
                <div className="aspect-square flex items-center justify-center">
                  <img src={`/cofico/filtro-papel-${n}.png`} alt={`Filtro de papel COFICO ${n}`} loading="lazy"
                    className="w-4/5 h-4/5 object-contain"
                    onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Filtro de Papel COFICO {n}</h3>
                <p className="mt-1 text-sm text-neutral-600 flex-1">{uso}</p>
                <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Conteúdo</dt><dd className="font-medium">30 filtros</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Código</dt><dd className="font-mono text-[13px] font-medium">{codigo}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Quantidade por caixa, pedido mínimo e prazo: <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer" className="font-semibold text-cofico-ink hover:underline">peça a tabela</a>.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-200">
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
