// Página SEPARADA de Produtos da COFICO (vitrine/loja). Aberta pelo menu "Produtos"
// (hash #loja, tratado dentro de CoficoBrasilPage — sem depender do router do App.tsx).
// Estilo dos cards = loja Saporino (produto "flutuante" com halo, pill de categoria,
// descrição, botão redondo), mas com o VERMELHO da COFICO (1 vermelho por marca).
// SEM preço para o visitante: preço é liberado para cliente cadastrado (camada Casa Cofico).
import { useEffect } from 'react';
import { ArrowRight, FileText, Lock, ShoppingBag } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { COFICO } from './config';

type CatalogoProduto = { nome: string; cat: string; desc?: string; peso: string; img: string; fallback: string; pdf?: string };
const CATALOGO: { marca: string; produtos: CatalogoProduto[] }[] = [
  {
    marca: 'Café Saporino',
    produtos: [
      { nome: 'Saporino Clássico Tradicional', cat: 'Café Moído', desc: 'Café tradicional de torra média, com sabor equilibrado, aroma marcante e bebida suave, ideal para o consumo diário.', peso: '500g', img: '/cofico/saporino-classico.png', fallback: '/saporino-logo.png' },
      { nome: 'Tropeiro Paulista Tradicional', cat: 'Café Moído', desc: 'Café Tropeiro Paulista de torra média escura, encorpado e intenso, inspirado no sabor do café da roça.', peso: '500g', img: '/cofico/tropeiro-tradicional.png', fallback: '/saporino-logo.png' },
      { nome: 'Tropeiro Paulista Extra Forte', cat: 'Café Moído', desc: 'Torra escura, encorpado e intenso — para quem aprecia café forte.', peso: '500g', img: '/cofico/tropeiro-extra-forte.png', fallback: '/saporino-logo.png' },
      { nome: 'Café Serrão Tradicional', cat: 'Café Moído', desc: 'Torra média, sabor equilibrado e bebida suave.', peso: '500g', img: '/cofico/serrao-tradicional.png', fallback: '/saporino-logo.png' },
      { nome: 'Café Serrão Extra Forte', cat: 'Café Moído', desc: 'Torra escura, encorpado e marcante.', peso: '500g', img: '/cofico/serrao-extra-forte.png', fallback: '/saporino-logo.png' },
    ],
  },
  {
    marca: 'Café Fazendinha',
    produtos: [
      { nome: 'Fazendinha Tradicional', cat: 'Café Moído', desc: 'Torra média, sabor equilibrado para o dia a dia.', peso: '500g', img: '/cofico/fazendinha-tradicional.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-fazendinha-tradicional.pdf' },
      { nome: 'Fazendinha Extra Forte', cat: 'Café Moído', desc: 'Torra escura, encorpado e intenso.', peso: '500g', img: '/cofico/fazendinha-extra-forte.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-fazendinha-extra-forte.pdf' },
      { nome: 'Horizon Coffee', cat: 'Café Moído', desc: 'Café torrado e moído.', peso: '500g', img: '/cofico/horizon-coffee.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-horizon-coffee.pdf' },
      { nome: 'Café São Felipe', cat: 'Café Moído', desc: '100% Arábica.', peso: '500g', img: '/cofico/cafe-sao-felipe.png', fallback: '/cofico/fazendinha.png', pdf: '/cofico/ficha-sao-felipe.pdf' },
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
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-cofico-ink/30 bg-neutral-50 px-6 py-5 rounded-2xl">
          <p className="text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">Preços de atacado sob cadastro.</span> Preços e condições comerciais são liberados para clientes com CNPJ ativo.
          </p>
          <a href={CADASTRO_WA} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-5 py-3 rounded-full hover:bg-cofico-dark transition-colors w-fit flex-shrink-0">
            Quero comprar no atacado <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>

        {/* Catálogo por marca — cards estilo loja Saporino (flutuante) */}
        {CATALOGO.map(({ marca, produtos }) => (
          <div key={marca} className="mt-14">
            <h2 className="text-sm font-bold uppercase tracking-wide text-cofico-ink">{marca}</h2>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {produtos.map((p) => (
                <div key={p.nome} className="bg-white flex flex-col group">
                  {/* imagem flutuante com halo suave (separa do fundo branco) */}
                  <div className="relative aspect-square bg-white flex items-center justify-center">
                    <div className="absolute inset-0" aria-hidden="true"
                      style={{ background: 'radial-gradient(circle at 50% 46%, rgba(224,32,32,0.08) 0%, rgba(0,0,0,0.045) 38%, transparent 68%)' }} />
                    <img src={p.img} alt={p.nome} loading="lazy"
                      className="relative z-10 w-4/5 h-4/5 object-contain drop-shadow-xl transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = p.fallback; } }} />
                  </div>

                  <div className="p-3 flex-1 flex flex-col">
                    <div className="mb-1">
                      <span className="inline-block bg-cofico-ink text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">{p.cat}</span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{p.nome}</h3>
                    {p.desc && <p className="text-gray-400 mb-1 text-[11px] leading-snug line-clamp-3 hidden sm:block">{p.desc}</p>}

                    <div className="mt-auto pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">{p.peso}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                          <Lock className="w-3 h-3 text-cofico-ink" aria-hidden="true" /> cadastrado
                        </span>
                      </div>
                      <a href={CADASTRO_WA} target="_blank" rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 bg-cofico-ink text-white hover:bg-cofico-dark transition-colors">
                        <ShoppingBag className="w-4 h-4" aria-hidden="true" /> Entrar para comprar
                      </a>
                      {p.pdf && (
                        <a href={p.pdf} target="_blank" rel="noopener noreferrer"
                          className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-cofico-ink hover:underline">
                          <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Ficha técnica
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-12 text-sm text-neutral-500">
          Portfólio em expansão. É distribuidor ou marca e quer estar aqui?{' '}
          <a href={`mailto:${COFICO.email}`} className="font-semibold text-cofico-ink hover:underline">Fale com a gente</a>.
        </p>
      </section>

      <CoficoFooter />
    </div>
  );
}
