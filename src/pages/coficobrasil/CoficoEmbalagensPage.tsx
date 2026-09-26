// Página EMBALAGENS da COFICO (#embalagens) — negócio próprio: venda de embalagem para café
// e impressão silkscreen na embalagem.
//
// REGRA DE CONTEÚDO: nada de especificação inventada. Tipo, tamanho, material, quantidade
// mínima, número de cores e prazo saem do orçamento, com o comercial. O que está escrito
// aqui é só o que a COFICO faz de fato; os detalhes o cliente pede.
import { useEffect } from 'react';
import { ArrowRight, Package, Printer, Palette, ClipboardList, Truck, MessageCircle } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';
import { whatsAppCofico } from './conteudo';

const WA_EMBALAGEM = whatsAppCofico(COFICO.phone, 'Olá! Vim pelo site da COFICO e quero um orçamento de embalagens para café.');
const WA_SILK = whatsAppCofico(COFICO.phone, 'Olá! Vim pelo site da COFICO e quero um orçamento de impressão (silkscreen) na embalagem.');

const LINHAS = [
  { icon: Package, t: 'Embalagem para café torrado e moído', d: 'Embalagem para pacote de café, no tamanho e no material que a sua operação usa. Pedimos o seu formato atual e cotamos igual ou melhor.' },
  { icon: Printer, t: 'Embalagem já impressa', d: 'Você envia a arte, a gente imprime e entrega a embalagem pronta para envasar.' },
  { icon: Palette, t: 'Embalagem neutra', d: 'Sem marca, para quem envasa com etiqueta própria ou ainda está fechando a arte.' },
];

const PASSOS = [
  { icon: MessageCircle, t: '1. Você conta o que precisa', d: 'Tipo de embalagem, tamanho do pacote, quantidade por mês e se vai levar impressão.' },
  { icon: ClipboardList, t: '2. A gente cota', d: 'Volta com o orçamento, a quantidade mínima e o prazo do seu pedido.' },
  { icon: Printer, t: '3. Aprovação da arte', d: 'Na impressão silkscreen, você aprova a prova antes de a produção começar.' },
  { icon: Truck, t: '4. Produção e entrega', d: 'Entregamos em São Paulo pela nossa própria frota, junto com o seu abastecimento de café, se for o caso.' },
];

export default function CoficoEmbalagensPage() {
  useEffect(() => { document.title = 'Embalagens para café e impressão silkscreen — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Embalagens</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Embalagens para café</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          A COFICO fornece a embalagem e imprime a sua marca nela. Quem já compra café com a gente
          resolve tudo no mesmo pedido, com a mesma entrega.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={WA_EMBALAGEM} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
            Pedir orçamento <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <a href="#impressao"
            className="inline-flex items-center border border-neutral-300 text-neutral-900 text-sm font-semibold px-6 py-3.5 hover:border-cofico-ink hover:text-cofico-ink transition-colors">
            Ver impressão silkscreen
          </a>
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">O que fornecemos</h2>
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
            Material, tamanho, quantidade mínima e prazo variam por pedido — a gente cota em cima do seu volume.
          </p>
        </div>
      </section>

      <section id="impressao" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Impressão silkscreen na embalagem</h2>
              <p className="mt-4 text-neutral-600">
                A sua marca impressa direto na embalagem, sem depender de etiqueta colada. Serve para quem está
                lançando a marca, para quem quer uma edição própria e para quem precisa de pouca quantidade.
              </p>
              <p className="mt-3 text-neutral-600">
                Você manda a arte; a gente ajusta ao formato da embalagem, faz a prova e só imprime depois da sua aprovação.
              </p>
              <a href={WA_SILK} target="_blank" rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
                Quero imprimir a minha marca <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {PASSOS.map(({ icon: Icon, t, d }) => (
                <div key={t} className="bg-white border border-neutral-200 p-6">
                  <Icon className="w-6 h-6 text-cofico-ink" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-bold">{t}</h3>
                  <p className="mt-1.5 text-sm text-neutral-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Quer a marca inteira, não só a embalagem?</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            A COFICO também desenvolve marca própria: o café, a embalagem, a arte e a entrega no seu ponto de venda.
          </p>
          <a href="#servicos" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cofico-ink hover:underline">
            Ver marca própria <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
