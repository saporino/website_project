// Página SEPARADA de Produtos da COFICO (vitrine/loja). Aberta pelo menu "Produtos"
// (hash #loja, tratado dentro de CoficoBrasilPage — sem depender do router do App.tsx).
// SEM preço para o visitante: preço é liberado para cliente cadastrado (camada Casa Cofico).
import { useEffect } from 'react';
import { ArrowRight, FileText, Lock } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';

type CatalogoProduto = { nome: string; tag?: string; img: string; fallback: string; pdf?: string };
const CATALOGO: { marca: string; produtos: CatalogoProduto[] }[] = [
  {
    marca: 'Café Saporino',
    produtos: [
      { nome: 'Saporino Clássico Tradicional', tag: '100% Arábica · 500g', img: '/cofico/saporino-classico.png', fallback: '/saporino-logo.png' },
      { nome: 'Tropeiro Paulista Tradicional', tag: '500g', img: '/cofico/tropeiro-tradicional.png', fallback: '/saporino-logo.png' },
      { nome: 'Tropeiro Paulista Extra Forte', tag: '500g', img: '/cofico/tropeiro-extra-forte.png', fallback: '/saporino-logo.png' },
      { nome: 'Café Serrão Tradicional', tag: '500g', img: '/cofico/serrao-tradicional.png', fallback: '/saporino-logo.png' },
      { nome: 'Café Serrão Extra Forte', tag: '500g', img: '/cofico/serrao-extra-forte.png', fallback: '/saporino-logo.png' },
    ],
  },
  {
    marca: 'Café Fazendinha',
    produtos: [
      { nome: 'Fazendinha Tradicional', tag: '500g', img: '/cofico/fazendinha-tradicional.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-fazendinha-tradicional.pdf' },
      { nome: 'Fazendinha Extra Forte', tag: '500g', img: '/cofico/fazendinha-extra-forte.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-fazendinha-extra-forte.pdf' },
      { nome: 'Horizon Coffee', tag: '500g', img: '/cofico/horizon-coffee.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-horizon-coffee.pdf' },
      { nome: 'Café São Felipe', tag: '100% Arábica · 500g', img: '/cofico/cafe-sao-felipe.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-sao-felipe.pdf' },
    ],
  },
];
const CADASTRO_WA = `https://wa.me/55${COFICO.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Vim pelo site da COFICO e quero comprar no atacado / receber a tabela de preços. Tenho CNPJ ativo.')}`;

export default function CoficoProdutosPage() {
  useEffect(() => { document.title = 'Produtos — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-20">
        {/* Voltar / breadcrumb */}
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Produtos</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Nossos produtos</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">O que a COFICO distribui em São Paulo. Vendemos por atacado, com pedido mínimo e frete cotado por destino.</p>

        {/* Faixa de atacado — preços liberados para cliente cadastrado (modelo B2B) */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-cofico-ink/30 bg-neutral-50 px-6 py-5">
          <p className="text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Preços de atacado sob cadastro.</span> Preços e condições comerciais são liberados para clientes com CNPJ ativo.
          </p>
          <a href={CADASTRO_WA} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-5 py-3 rounded-none hover:opacity-90 w-fit flex-shrink-0">
            Quero comprar no atacado <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>

        {/* Catálogo por marca */}
        {CATALOGO.map(({ marca, produtos }) => (
          <div key={marca} className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cofico-ink">{marca}</h2>
            <div className="mt-5 grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {produtos.map((p) => (
                <article key={p.nome} className="bg-white border border-neutral-200 flex flex-col">
                  <div className="h-40 flex items-center justify-center bg-neutral-50 p-4">
                    <img src={p.img} alt={p.nome} loading="lazy" className="max-h-full w-auto object-contain"
                      onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = p.fallback; } }} />
                  </div>
                  <div className="p-4 flex flex-col flex-1 border-t border-neutral-200">
                    <h3 className="text-sm font-semibold leading-snug">{p.nome}</h3>
                    {p.tag && <p className="mt-1 text-xs text-neutral-500">{p.tag}</p>}

                    {/* Preço BLOQUEADO: só clientes cadastrados veem. */}
                    <div className="mt-3">
                      <div className="h-5 w-24 rounded-sm bg-gradient-to-r from-neutral-200 to-neutral-100" aria-hidden="true" />
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                        <Lock className="w-3.5 h-3.5 text-cofico-ink" aria-hidden="true" /> Preço para clientes cadastrados
                      </p>
                    </div>

                    <a href={CADASTRO_WA} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-3 py-2.5 rounded-none hover:opacity-90">
                      Entrar para comprar
                    </a>
                    {p.pdf && (
                      <a href={p.pdf} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-cofico-ink hover:underline">
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ficha técnica
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-10 text-sm text-neutral-500">
          Portfólio em expansão. É distribuidor ou marca e quer estar aqui?{' '}
          <a href={`mailto:${COFICO.email}`} className="font-semibold text-cofico-ink hover:underline">Fale com a gente</a>.
        </p>
      </section>

      <CoficoFooter />
    </div>
  );
}
