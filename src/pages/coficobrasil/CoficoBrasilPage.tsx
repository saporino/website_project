// Página pública /coficobrasil — STANDALONE (marca COFICO própria; nenhum componente Saporino;
// nenhum link absoluto para cafesaporino.com.br). Conteúdo final aprovado. Marca Canaan não aparece.
import { useEffect } from 'react';
import {
  Warehouse, PackageCheck, Truck, Radar, Cpu, Coffee, MapPin, Mail, Phone, Instagram,
  ExternalLink, Building2, Store, UtensilsCrossed, Boxes,
} from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import CoficoMap from './CoficoMap';
import { COFICO } from './config';

const FAZEMOS = [
  { icon: Warehouse, t: 'Recebimento e armazenagem', d: 'Conferência na entrada, controle de lote e de validade, armazenagem seca em centro de distribuição próprio em Várzea Paulista.' },
  { icon: PackageCheck, t: 'Separação e expedição', d: 'Separação por FIFO e FEFO — primeiro que entra sai primeiro, primeiro que vence sai primeiro. Carga fracionada por cliente e por região.' },
  { icon: Truck, t: 'Entrega', d: 'Frota própria em rota programada, com comprovante digital de entrega.' },
  { icon: Radar, t: 'Controle e rastreio', d: 'Estoque e status do pedido acompanhados em tempo real pela nossa plataforma.' },
];

const ROTA_REGULAR = [
  'São Paulo capital — Zona Norte, Sul, Leste e Oeste', 'Grande São Paulo', 'Jundiaí e Várzea Paulista',
  'Campinas e região', 'Sorocaba e região', 'Litoral e Baixada Santista',
];
const INTERIOR = [
  'Piracicaba', 'São Carlos', 'Araraquara', 'Ribeirão Preto', 'Franca', 'Barretos',
  'São José do Rio Preto', 'Votuporanga', 'Bauru', 'Marília', 'São José dos Campos e Vale do Paraíba',
];

const PARA_QUEM = [
  { icon: Building2, t: 'Redes e grandes contas', d: 'Abastecimento programado de múltiplas lojas, com carga fracionada por unidade.' },
  { icon: Boxes, t: 'Distribuidores e atacado', d: 'Entregas de volume, com pedido mínimo e frete cotado por destino.' },
  { icon: Store, t: 'Mercados e atacarejos', d: '' },
  { icon: UtensilsCrossed, t: 'Food service, padarias e cafeterias', d: '' },
];

export default function CoficoBrasilPage() {
  useEffect(() => { document.title = 'COFICO Brasil — Operador logístico e distribuidor de alimentos em SP'; }, []);

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
          Recebemos, armazenamos, separamos e entregamos café e alimentos secos em todo o Estado de São Paulo. Distribuidora exclusiva do Café Fazendinha.
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
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FAZEMOS.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-7">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-5 text-base font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TECNOLOGIA PRÓPRIA */}
      <section className="border-t border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-start gap-4 max-w-3xl">
            <Cpu className="w-8 h-8 text-cofico flex-shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Tecnologia própria</h2>
              <p className="mt-4 text-neutral-300 text-lg leading-relaxed">
                Operamos com sistema proprietário. Cada pedido nasce no aplicativo do representante, percorre a separação com rastreio de lote e termina em comprovante de entrega com foto e localização. A indústria que distribui conosco acompanha o que entrou, o que saiu e onde está.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MARCAS */}
      <section id="marcas" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Marcas que distribuímos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="border border-neutral-200 p-8">
              <Coffee className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold">Café Fazendinha</h3>
              <p className="mt-1 text-sm text-neutral-500">Distribuição exclusiva no Estado de São Paulo</p>
              <p className="mt-4 text-sm text-neutral-700 font-medium">Tradicional · Extra Forte · Horizon Coffee · São Felipe</p>
            </article>
          </div>
          <p className="mt-6 text-sm text-neutral-500">Portfólio em expansão.</p>
        </div>
      </section>

      {/* ATUAÇÃO — cobertura e mapa */}
      <section id="atuacao" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Onde entregamos</h2>
          <p className="mt-3 text-neutral-600">Centro de distribuição em Várzea Paulista, São Paulo.</p>

          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
            {/* mapa */}
            <div className="bg-white border border-neutral-200 p-4">
              <CoficoMap />
            </div>
            {/* colunas de cobertura (texto — fonte acessível da informação) */}
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-cofico-ink">Rota regular</h3>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {ROTA_REGULAR.map((c) => <li key={c} className="flex gap-2"><MapPin className="w-4 h-4 text-cofico-ink flex-shrink-0 mt-0.5" aria-hidden="true" />{c}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Interior — entrega programada</h3>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {INTERIOR.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-10 text-neutral-600 max-w-3xl leading-relaxed">
            Atendemos todo o Estado de São Paulo. Fora da rota regular, trabalhamos com pedido mínimo e frete cotado conforme volume e destino.
          </p>
        </div>
      </section>

      {/* PARA QUEM ENTREGAMOS */}
      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Para quem entregamos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {PARA_QUEM.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-7">
                <Icon className="w-6 h-6 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold">{t}</h3>
                {d && <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{d}</p>}
              </article>
            ))}
          </div>
          <p className="mt-8 text-lg text-neutral-800 font-medium max-w-2xl">
            Trabalhamos melhor com volume. Quanto maior o pedido, mais longe a gente chega.
          </p>
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="border-t border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Contato</h2>
          <ul className="mt-8 space-y-3 text-neutral-200">
            <li><a href={`mailto:${COFICO.email}`} className="inline-flex items-center gap-2 hover:text-white"><Mail className="w-5 h-5 text-cofico" aria-hidden="true" /> {COFICO.email}</a></li>
            <li><a href={`tel:+55${COFICO.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-2 hover:text-white"><Phone className="w-5 h-5 text-cofico" aria-hidden="true" /> {COFICO.phone}</a></li>
            <li><a href={COFICO.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><Instagram className="w-5 h-5 text-cofico" aria-hidden="true" /> @coficobrasil</a></li>
            <li><a href={COFICO.maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-white"><MapPin className="w-5 h-5 text-cofico" aria-hidden="true" /> Como chegar <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></a></li>
          </ul>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
