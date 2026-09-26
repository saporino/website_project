// Página SERVIÇOS da COFICO (#servicos) — o que a COFICO faz PARA uma marca:
// marca própria, impressão em embalagem e distribuição/logística.
//
// "Produtos" é o que a COFICO vende; "Serviços" é o que ela faz. Misturar os dois
// foi o que deixou a home sem lugar para as linhas novas.
import { useEffect } from 'react';
import { ArrowRight, Tag, Printer, Truck } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import CoficoMarcaLeadForm from './CoficoMarcaLeadForm';
import { COFICO } from './config';
import { FAZEMOS, whatsAppCofico } from './conteudo';

const WA_MARCA = whatsAppCofico(COFICO.phone, 'Olá! Vim pelo site da COFICO e quero falar sobre marca própria de café.');

const SERVICOS = [
  { icon: Tag, t: 'Marca própria', d: 'A sua marca de café, do começo ao fim: café, embalagem, arte e entrega. Você vende com a sua marca; a produção e a logística ficam com a gente.', href: '#marca-propria', cta: 'Ver como funciona' },
  { icon: Printer, t: 'Embalagem e impressão', d: 'Embalagem para café e impressão silkscreen da sua marca direto no pacote.', href: '#embalagens', cta: 'Ver embalagens' },
  { icon: Truck, t: 'Distribuição e logística', d: 'Armazenagem, separação, entrega com frota própria e rastreio — a operação que já roda hoje em São Paulo.', href: '#operacao', cta: 'Ver a operação' },
];

export default function CoficoServicosPage() {
  useEffect(() => { document.title = 'Serviços — marca própria, embalagem e distribuição — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Serviços</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">O que fazemos pela sua marca</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Da criação da marca à entrega no ponto de venda. Você escolhe até onde a COFICO entra.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICOS.map(({ icon: Icon, t, d, href, cta }) => (
            <article key={t} className="border border-neutral-200 p-8 flex flex-col">
              <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
              <h2 className="mt-5 text-lg font-semibold">{t}</h2>
              <p className="mt-2 text-sm text-neutral-600 flex-1">{d}</p>
              <a href={href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cofico-ink hover:underline w-fit">
                {cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="marca-propria" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Marca própria</h2>
          <p className="mt-4 text-neutral-600 max-w-3xl">
            Serve para o mercado que quer a marca da própria loja, para a rede que quer um café exclusivo e para
            quem quer entrar no ramo sem montar uma fábrica. A COFICO cuida do café, da embalagem, da arte e da
            entrega; a marca é sua.
          </p>
          <a href={WA_MARCA} target="_blank" rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
            Falar com o comercial <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <div className="mt-12">
            <CoficoMarcaLeadForm />
          </div>
        </div>
      </section>

      <section id="operacao" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Distribuição e logística</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">A operação que roda hoje em São Paulo, da chegada da carga ao comprovante de entrega.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FAZEMOS.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-8">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
