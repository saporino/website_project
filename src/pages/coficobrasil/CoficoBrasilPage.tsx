// Página pública /coficobrasil — STANDALONE (Header/Footer/layout próprios; nenhum
// componente da Saporino; nenhum link absoluto para cafesaporino.com.br). Vai migrar
// para domínio próprio. Copy corporativa, PT-BR, sem superlativo vazio, sem foto de
// banco de imagem (tipografia + cor + espaço em branco). Marca Canaan NÃO aparece.
import { useEffect } from 'react';
import { Truck, Boxes, MapPin, Mail, Phone, Instagram, Linkedin } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';

export default function CoficoBrasilPage() {
  // Título do navegador (client-side). O SEO real do crawler é a Tarefa 3 (a aprovar).
  useEffect(() => { document.title = 'COFICO Brasil — Operador logístico e distribuidor de alimentos'; }, []);

  const hasContact = COFICO.email || COFICO.phone || COFICO.instagram || COFICO.linkedin || COFICO.google;

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <p className="text-cofico-ink text-xs font-semibold uppercase tracking-[0.2em]">COFICO Brasil</p>
        <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
          Operador logístico e distribuidor de alimentos.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-neutral-600 max-w-2xl leading-relaxed">
          Logística e distribuição de alimentos com atuação no Estado de São Paulo.
        </p>
        <div className="mt-9">
          <a href="#contato" className="inline-flex items-center bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 rounded-none hover:opacity-90 transition-opacity">
            Fale com a gente
          </a>
        </div>
      </section>

      {/* O QUE FAZEMOS */}
      <section id="o-que-fazemos" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">O que fazemos</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <article className="border border-neutral-200 p-8">
              <Truck className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold">Distribuição de alimentos</h3>
              <p className="mt-2 text-neutral-600 leading-relaxed">
                Levamos alimentos da indústria ao ponto de venda no Estado de São Paulo.
              </p>
            </article>
            <article className="border border-neutral-200 p-8">
              <Boxes className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold">Operação logística</h3>
              <p className="mt-2 text-neutral-600 leading-relaxed">
                Movimentação e entrega de alimentos com foco em confiabilidade.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* MARCAS DISTRIBUÍDAS */}
      <section id="marcas" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Marcas distribuídas</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">Marcas que a COFICO distribui.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="bg-white border border-neutral-200 p-8">
              <h3 className="text-lg font-semibold">Café Fazendinha</h3>
              <p className="mt-2 text-neutral-600">Marca de café distribuída pela COFICO.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ATUAÇÃO */}
      <section id="atuacao" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Área de atuação</h2>
          <p className="mt-4 flex items-center gap-2 text-lg text-neutral-700">
            <MapPin className="w-5 h-5 text-cofico-ink" aria-hidden="true" /> Estado de São Paulo
          </p>
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="border-t border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Contato</h2>
          {hasContact ? (
            <ul className="mt-8 space-y-3 text-neutral-200">
              {COFICO.email && (
                <li><a href={`mailto:${COFICO.email}`} className="inline-flex items-center gap-2 hover:text-white"><Mail className="w-5 h-5 text-cofico" aria-hidden="true" /> {COFICO.email}</a></li>
              )}
              {COFICO.phone && (
                <li><a href={`tel:${COFICO.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 hover:text-white"><Phone className="w-5 h-5 text-cofico" aria-hidden="true" /> {COFICO.phone}</a></li>
              )}
              {COFICO.instagram && (
                <li><a href={COFICO.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Instagram className="w-5 h-5 text-cofico" aria-hidden="true" /> Instagram</a></li>
              )}
              {COFICO.linkedin && (
                <li><a href={COFICO.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Linkedin className="w-5 h-5 text-cofico" aria-hidden="true" /> LinkedIn</a></li>
              )}
            </ul>
          ) : (
            <p className="mt-6 text-neutral-400">Canais de contato em breve.</p>
          )}
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
