// Página pública /coficobrasil — STANDALONE (marca COFICO própria; nenhum componente Saporino;
// nenhum link absoluto para cafesaporino.com.br). Conteúdo final aprovado. Marca Canaan não aparece.
import { useEffect, useState } from 'react';
import {
  Warehouse, PackageCheck, Truck, Radar, Cpu, MapPin, Mail, Phone, Instagram,
  ExternalLink, Building2, Store, UtensilsCrossed, Boxes, Briefcase, ArrowRight, Users,
  X, Play, FileText,
} from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import CoficoCarousel from './CoficoCarousel';
import CoficoMap from './CoficoMap';
import CoficoProdutosPage from './CoficoProdutosPage';
import { CoficoPrivacidade, CoficoTermos } from './CoficoPolicyPages';
import CoficoCookieConsent from './CoficoCookieConsent';
import { COFICO } from './config';
import { fetchCoficoStats } from './coficoClient';

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

// Nº de regiões atendidas = derivado das listas de cobertura da própria página (dado real, não inventado).
const REGIOES = ROTA_REGULAR.length + INTERIOR.length;
const GRID_COLS: Record<number, string> = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' };
const fmtBR = (n: number) => n.toLocaleString('pt-BR');

// Linha Café Fazendinha — foto da embalagem (kebab-case em /public/cofico) + PDF da ficha técnica.
const FAZENDINHA_LINHA: { nome: string; img: string; pdf: string }[] = [
  { nome: 'Tradicional', img: '/cofico/fazendinha-tradicional.png', pdf: '/cofico/ficha-fazendinha-tradicional.pdf' },
  { nome: 'Extra Forte', img: '/cofico/fazendinha-extra-forte.png', pdf: '/cofico/ficha-fazendinha-extra-forte.pdf' },
  { nome: 'Horizon Coffee', img: '/cofico/horizon-coffee.png', pdf: '/cofico/ficha-horizon-coffee.pdf' },
  { nome: 'São Felipe', img: '/cofico/cafe-sao-felipe.png', pdf: '/cofico/ficha-sao-felipe.pdf' },
];

// Vídeos da Fazendinha — grade estilo Instagram (clica → abre → toca → fecha sozinho no fim).
const FAZENDINHA_VIDEOS = [
  '/cofico/fazendinha-video.mp4',
  '/cofico/fazendinha-video-2.mp4',
  '/cofico/fazendinha-video-3.mp4',
  '/cofico/fazendinha-video-4.mp4',
];

const PARA_QUEM = [
  { icon: Building2, t: 'Redes e grandes contas', d: 'Abastecimento programado de múltiplas lojas, com carga fracionada por unidade.' },
  { icon: Boxes, t: 'Distribuidores e atacado', d: 'Entregas de volume, com pedido mínimo e frete cotado por destino.' },
  { icon: Store, t: 'Mercados e atacarejos', d: '' },
  { icon: UtensilsCrossed, t: 'Food service, cozinhas industriais, padarias e cafeterias', d: '' },
];

export default function CoficoBrasilPage() {
  const [stats, setStats] = useState<{ entregas: number; clientes: number }>({ entregas: 0, clientes: 0 });
  const [showFazendinha, setShowFazendinha] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  // "Produtos" é uma PÁGINA separada dentro da COFICO, controlada pelo hash #loja
  // (sem depender do router do App.tsx). Assim entra/sai da vitrine sem recarregar.
  const viewFromHash = (h: string): 'home' | 'loja' | 'privacidade' | 'termos' =>
    h === '#loja' ? 'loja' : h === '#privacidade' ? 'privacidade' : h === '#termos' ? 'termos' : 'home';
  const [view, setView] = useState<'home' | 'loja' | 'privacidade' | 'termos'>(
    () => (typeof window !== 'undefined' ? viewFromHash(window.location.hash) : 'home'));

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      if (h === '#loja' || h === '#privacidade' || h === '#termos') { setView(viewFromHash(h)); window.scrollTo(0, 0); return; }
      setView('home');
      if (h && h !== '#topo') { setTimeout(() => { const el = document.querySelector(h); if (el) el.scrollIntoView(); }, 30); }
      else window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { if (view === 'home') document.title = 'COFICO Brasil — Desenvolvimento comercial e distribuição de marcas de alimentos em SP'; }, [view]);
  useEffect(() => { let alive = true; fetchCoficoStats().then((s) => { if (alive) setStats(s); }); return () => { alive = false; }; }, []);

  // Números ao vivo. Experiência e regiões são sempre reais; entregas/clientes só aparecem quando > 0
  // (crescem sozinhos conforme a operação COFICO entrega — nunca mostra "+0").
  const anos = new Date().getFullYear() - 1995;
  const numeros = [
    { n: `+${anos}`, label: 'anos de experiência', sub: 'desde 1995' },
    { n: `+${REGIOES}`, label: 'regiões atendidas em SP' },
    ...(stats.clientes > 0 ? [{ n: `+${fmtBR(stats.clientes)}`, label: 'clientes atendidos', sub: '' }] : []),
    ...(stats.entregas > 0 ? [{ n: `+${fmtBR(stats.entregas)}`, label: 'entregas realizadas', sub: '' }] : []),
  ];

  // Vitrine/loja é uma página separada (aberta pelo menu "Produtos").
  if (view === 'loja') return <><CoficoProdutosPage /><CoficoCookieConsent /></>;
  if (view === 'privacidade') return <><CoficoPrivacidade /><CoficoCookieConsent /></>;
  if (view === 'termos') return <><CoficoTermos /><CoficoCookieConsent /></>;

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <p className="text-cofico-ink text-xs font-semibold uppercase tracking-[0.2em]">COFICO Brasil</p>
        <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
          Desenvolvimento comercial e distribuição de marcas de alimentos.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-neutral-600 max-w-2xl leading-relaxed">
          Levamos marcas ao mercado no Estado de São Paulo — da armazenagem à entrega: distribuição oficial, força de vendas própria e logística com tecnologia proprietária.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a href="#contato" className="inline-flex items-center bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 rounded-none hover:opacity-90 transition-opacity">
            Fale com a gente
          </a>
          <a href="#marcas" className="inline-flex items-center border border-neutral-300 text-neutral-900 text-sm font-semibold px-6 py-3.5 rounded-none hover:border-cofico-ink hover:text-cofico-ink transition-colors">
            Conheça as marcas
          </a>
        </div>
      </section>
      <CoficoCarousel />

      {/* MARCAS — logo após o hero: substancia "distribuição de marcas" e atende o CTA "Conheça as marcas" */}
      <section id="marcas" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Marcas que distribuímos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="border border-neutral-200 p-8">
              {/* tenta o arquivo em /cofico/, senão cai no logo que já existe no site */}
              <img src="/cofico/saporino.png" alt="Café Saporino" className="h-28 w-auto object-contain"
                onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = '/saporino-logo.png'; } }} />
              <h3 className="mt-5 text-lg font-semibold">Café Saporino</h3>
              <p className="mt-1 text-sm text-neutral-500">Distribuição exclusiva no Estado de São Paulo</p>
              <p className="mt-4 text-sm text-neutral-700 font-medium">Saporino Clássico Tradicional 100% Arábica · Tropeiro Paulista (Tradicional e Extra Forte) · Café Serrão (Tradicional e Extra Forte)</p>
            </article>
            <button type="button" onClick={() => setShowFazendinha(true)}
              className="text-left border border-neutral-200 p-8 transition-colors hover:border-cofico-ink hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-cofico-ink">
              {/* tenta o arquivo em /cofico/, senão cai no logo do banco */}
              <img src="/cofico/fazendinha.png" alt="Café Fazendinha" className="h-28 w-auto object-contain"
                onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = 'https://rsvoazrkxtdrcjnatzcm.supabase.co/storage/v1/object/public/product-images/companies/f5a47ea4-32d3-4b15-966d-37cb2bb1acf3-1784146393495.jpeg'; } }} />
              <h3 className="mt-5 text-lg font-semibold">Café Fazendinha</h3>
              <p className="mt-1 text-sm text-neutral-500">Distribuição exclusiva no Estado de São Paulo</p>
              <p className="mt-4 text-sm text-neutral-700 font-medium">Tradicional · Extra Forte · Horizon Coffee · São Felipe</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cofico-ink">
                <Play className="w-4 h-4" aria-hidden="true" /> Ver vídeo, produtos e fichas técnicas
              </span>
            </button>
          </div>
          <p className="mt-6 text-sm text-neutral-500">Portfólio em expansão.</p>
        </div>
      </section>

      {/* NOSSOS NÚMEROS — ao vivo (cofico_public_stats); entregas/clientes crescem com a operação */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Nossos números</h2>
          <div className={`mt-10 grid grid-cols-2 gap-8 ${GRID_COLS[numeros.length] ?? 'md:grid-cols-4'}`}>
            {numeros.map((item) => (
              <div key={item.label} className="text-center sm:text-left">
                <div className="text-4xl md:text-5xl font-black text-cofico-ink tracking-tight tabular-nums">{item.n}</div>
                <div className="mt-2 text-sm font-medium text-neutral-700">{item.label}</div>
                {item.sub ? <div className="text-xs text-neutral-400">{item.sub}</div> : null}
              </div>
            ))}
          </div>
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
                Operamos com o <strong className="text-white font-semibold">RepCo by COFICO</strong>, nosso sistema proprietário de pedidos e logística. Cada pedido nasce no aplicativo do representante, percorre a separação com rastreio de lote e termina em comprovante de entrega com foto e localização. Pelo RepCo, a indústria que distribui conosco acompanha, em tempo real, o que entrou, o que saiu e onde está.
              </p>
            </div>
          </div>
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

      {/* TRABALHE COM A COFICO */}
      <section id="trabalhe" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Trabalhe com a COFICO</h2>
          <p className="mt-4 text-lg font-semibold text-neutral-800 max-w-2xl">A gente está no começo. É justamente por isso que é interessante.</p>
          <p className="mt-4 text-neutral-600 max-w-2xl leading-relaxed">
            Somos uma operação nova de logística e distribuição de alimentos em São Paulo, construída com tecnologia própria e com muita coisa ainda por definir. Quem entra agora não recebe um processo pronto — ajuda a desenhar.
          </p>

          {/* Como a gente trabalha */}
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Começo é agora', d: 'Empresa nova, decisão rápida, sem cinco camadas de aprovação.' },
              { t: 'Mão na massa', d: 'Todo mundo aqui faz. Não temos espaço para quem só assiste.' },
              { t: 'Número acima de achismo', d: 'Pedido, estoque, rota e entrega passam por sistema próprio. O que você faz aparece — e é assim que a gente reconhece.' },
              { t: 'Cresce quem entrega', d: 'Estrutura pequena significa que resultado não se perde no caminho.' },
            ].map(({ t, d }) => (
              <div key={t} className="border-t-2 border-cofico-ink pt-4">
                <h3 className="text-base font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>

          {/* Frentes abertas */}
          <div className="mt-16">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">Frentes abertas</h3>
            <p className="mt-2 text-sm text-neutral-500">O cadastro é para profissionais com <strong className="text-neutral-700">MEI e CNPJ ativo</strong>.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { img: '/cofico/vendas.png', icon: Briefcase, t: 'Vendas', roles: 'Representante comercial · Vendas externas', frente: 'vendas' },
                { img: '/cofico/logistica.png', icon: Truck, t: 'Logística', roles: 'Motorista de entrega · Ajudante · Separação e conferência · Parceiro logístico', frente: 'logistica' },
                { img: '/cofico/promotora.png', icon: Users, t: 'Promoção e ponto de venda', roles: 'Promotor(a) de vendas · Merchandising e reposição', frente: 'promocao' },
              ].map(({ img, icon: Icon, t, roles, frente }) => (
                <article key={frente} className="bg-white border border-neutral-200 flex flex-col overflow-hidden">
                  {/* Foto ILUSTRATIVA da função (arquivo em public/cofico/). Sem nome/depoimento. onError esconde se faltar. */}
                  <img src={img} alt={`Ilustração da função — ${t}`} loading="lazy" className="w-full h-56 object-cover object-top bg-neutral-100"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  <div className="p-7 flex flex-col flex-1">
                    <Icon className="w-6 h-6 text-cofico-ink" aria-hidden="true" />
                    <h4 className="mt-4 text-lg font-semibold">{t}</h4>
                    <p className="mt-2 text-sm text-neutral-600 leading-relaxed flex-1">{roles}</p>
                    <a href={`https://wa.me/55${COFICO.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vim pelo site da COFICO e tenho interesse na frente de ${t}. Tenho MEI/CNPJ ativo.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-4 py-2.5 rounded-none hover:opacity-90 w-fit">
                      Quero me cadastrar <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
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

      {/* MODAL — área do Café Fazendinha: vídeo + produtos + fichas técnicas */}
      {showFazendinha && (
        <div className="fixed inset-0 z-[1300] overflow-y-auto bg-black/60" role="dialog" aria-modal="true"
          onClick={() => setShowFazendinha(false)}>
          <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
            <div className="relative w-full max-w-4xl bg-white my-4" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setShowFazendinha(false)} aria-label="Fechar"
                className="absolute top-3 right-3 z-10 p-2 bg-white/90 border border-neutral-200 text-neutral-500 hover:text-neutral-900">
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 sm:p-10">
                {/* cabeçalho */}
                <img src="/cofico/fazendinha.png" alt="Café Fazendinha" className="h-32 sm:h-40 w-auto object-contain" />
                <h3 className="mt-4 text-2xl font-bold tracking-tight">Café Fazendinha</h3>
                <p className="mt-1 text-sm text-neutral-500">Distribuição exclusiva no Estado de São Paulo · Tradicional · Extra Forte · Horizon Coffee · São Felipe</p>

                {/* vídeos — grade estilo Instagram (clica → abre no player → fecha sozinho no fim) */}
                <h4 className="mt-8 text-lg font-semibold">Vídeos</h4>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {FAZENDINHA_VIDEOS.map((src) => (
                    <button key={src} type="button" onClick={() => setActiveVideo(src)}
                      className="group relative aspect-[3/4] bg-black overflow-hidden focus:outline-none focus:ring-2 focus:ring-cofico-ink">
                      <video src={`${src}#t=0.5`} muted playsInline preload="metadata"
                        className="w-full h-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                        <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="w-6 h-6 text-neutral-900 translate-x-0.5" aria-hidden="true" />
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* produtos + fichas técnicas */}
                <h4 className="mt-10 text-lg font-semibold">Nossos produtos</h4>
                <div className="mt-5 grid gap-6 grid-cols-2 lg:grid-cols-4">
                  {FAZENDINHA_LINHA.map((p) => (
                    <div key={p.nome} className="border border-neutral-200 p-4 flex flex-col">
                      <div className="h-36 flex items-center justify-center bg-neutral-50">
                        <img src={p.img} alt={`Café Fazendinha ${p.nome}`} className="max-h-full w-auto object-contain" />
                      </div>
                      <p className="mt-3 font-semibold text-sm">{p.nome}</p>
                      <a href={p.pdf} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cofico-ink hover:underline">
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ficha Técnica — Clicar aqui
                      </a>
                    </div>
                  ))}
                </div>

                <p className="mt-8 text-sm text-neutral-500">
                  Quer distribuir o Café Fazendinha ou receber as fichas técnicas completas?{' '}
                  <a href={`mailto:${COFICO.email}?subject=${encodeURIComponent('Café Fazendinha — informações')}`}
                    className="font-semibold text-cofico-ink hover:underline">Fale com a gente</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER — vídeo em tela cheia; toca sozinho e fecha ao terminar */}
      {activeVideo && (
        <div className="fixed inset-0 z-[1400] bg-black/90 flex items-center justify-center p-4"
          role="dialog" aria-modal="true" onClick={() => setActiveVideo(null)}>
          <button type="button" onClick={() => setActiveVideo(null)} aria-label="Fechar vídeo"
            className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white">
            <X className="w-7 h-7" />
          </button>
          <video
            ref={(el) => { if (el) el.play().catch(() => {}); }}
            src={activeVideo} autoPlay playsInline controls
            onEnded={() => setActiveVideo(null)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full" />
        </div>
      )}

      <CoficoFooter />
      <CoficoCookieConsent />
    </div>
  );
}
