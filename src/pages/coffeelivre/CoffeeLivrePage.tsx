// Coffee LiVRE — raiz da experiência pública.
//
// Faz três coisas: o portão, o roteador interno e o carrinho de contagem.
// Todo o resto mora nas páginas.
//
// O roteador é o mesmo padrão do projeto: lê o caminho e escuta popstate.
// Nada aqui conhece "coficobrasil.com.br" — os caminhos saem do config, e
// é por isso que a mudança para coffeelivre.com.br não exige reescrever
// tela nenhuma.
import { useCallback, useEffect, useRef, useState } from 'react';
import './coffeelivre.css';
import './coffeelivre-paginas.css';
import AccessGate from './AccessGate';
import MarketplaceHeader from './MarketplaceHeader';
import HeroCarousel from './HeroCarousel';
import HighlightCards from './HighlightCards';
import BenefitsBar from './BenefitsBar';
import HarvestBanner from './HarvestBanner';
import ProductCarousel from './ProductCarousel';
import PromoBanners from './PromoBanners';
import CategoryGrid from './CategoryGrid';
import OriginGrid from './OriginGrid';
import StoreGrid from './StoreGrid';
import SellerCta from './SellerCta';
import Newsletter from './Newsletter';
import MarketplaceFooter from './MarketplaceFooter';
import Toast from './Toast';
import PaginaProduto from './PaginaProduto';
import PaginaCategoria from './PaginaCategoria';
import PaginaBusca from './PaginaBusca';
import PaginaLoja from './PaginaLoja';
import PaginaVender from './PaginaVender';
import NaoEncontrado from './NaoEncontrado';
import { BASE, rota } from './config';
import { listarVitrine, listarLojas, listarCategorias, type ItemDaVitrine, type Loja, type Categoria } from './catalogo';
import type { MensagemToast } from './tipos';

type Rota =
  | { nome: 'home' }
  | { nome: 'categoria'; slug: string }
  | { nome: 'produto'; slug: string }
  | { nome: 'loja'; slug: string }
  | { nome: 'busca'; termo: string }
  | { nome: 'vender' }
  | { nome: 'nada' };

/** Caminho do navegador vira rota interna. Só isto sabe a forma das URLs. */
function lerRota(): Rota {
  const caminho = window.location.pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '');
  if (!caminho) return { nome: 'home' };
  const [secao, resto] = [caminho.split('/')[0], caminho.split('/').slice(1).join('/')];
  if (secao === 'vender') return { nome: 'vender' };
  if (secao === 'busca') {
    return { nome: 'busca', termo: new URLSearchParams(window.location.search).get('q') ?? '' };
  }
  if (!resto) return { nome: 'nada' };
  if (secao === 'categoria') return { nome: 'categoria', slug: resto };
  if (secao === 'cafe' || secao === 'produto') return { nome: 'produto', slug: resto };
  if (secao === 'loja') return { nome: 'loja', slug: resto };
  return { nome: 'nada' };
}

function Experiencia() {
  const [rotaAtual, setRotaAtual] = useState<Rota>(lerRota);
  const [itens, setItens] = useState(0);
  const [pulsando, setPulsando] = useState(false);
  const [mensagem, setMensagem] = useState<MensagemToast | null>(null);
  const relogioToast = useRef<number | undefined>(undefined);

  // Catálogo da home. Carregado uma vez e compartilhado pelas seções.
  const [vitrine, setVitrine] = useState<ItemDaVitrine[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    const aoVoltar = () => setRotaAtual(lerRota());
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  // scroll-behavior:smooth vive no <html>, então escopar em .livre-root
  // não funcionaria. A classe entra ao montar e sai ao desmontar.
  useEffect(() => {
    document.documentElement.classList.add('livre-scroll');
    return () => { document.documentElement.classList.remove('livre-scroll'); };
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [v, l, c] = await Promise.all([listarVitrine(), listarLojas(), listarCategorias()]);
      if (!vivo) return;
      setVitrine(v);
      setLojas(l);
      // Só as folhas viram atalho de categoria: "Cafés" e "Equipamentos"
      // são agrupadores e apareceriam ao lado dos próprios filhos.
      setCategorias(c.filter(x => x.parent_id));
    })();
    return () => { vivo = false; };
  }, []);

  const avisar = useCallback((m: MensagemToast) => {
    setMensagem(m);
    window.clearTimeout(relogioToast.current);
    relogioToast.current = window.setTimeout(() => setMensagem(null), 2600);
  }, []);

  const adicionar = useCallback((item: ItemDaVitrine) => {
    setItens(q => q + 1);
    setPulsando(true);
    setTimeout(() => setPulsando(false), 220);
    avisar({ forte: item.titulo.split(' — ')[0], depois: ' foi adicionado ao carrinho' });
  }, [avisar]);

  // Ofertas do dia: quem tem preço anterior. Mais vendidos: o resto.
  const ofertas = vitrine.filter(i => i.preco_de_cents);
  const maisVendidos = vitrine.filter(i => !i.preco_de_cents).concat(ofertas.slice(0, 4));

  return (
    <div className="livre-root">
      <MarketplaceHeader itens={itens} pulsando={pulsando} categorias={categorias} aoAvisar={avisar} />

      {/* Dado de demonstração se anuncia. Número que parece real e não é
          vale menos, numa conversa com investidor, que número declarado. */}
      <div className="faixa-demo">
        Demonstração privada · vendedores, produtos e preços são fictícios
      </div>

      {rotaAtual.nome === 'home' && (
        <>
          <HeroCarousel />
          <main className="wrap">
            <HighlightCards itens={vitrine} />
            <BenefitsBar />
            <HarvestBanner />

            <section className="secao" id="ofertas">
              <div className="sec-h"><h2>Ofertas do dia</h2><a href={rota('categoria/cafes')}>Mostrar todas as ofertas</a></div>
              <ProductCarousel idTrilho="trilhoOfertas" itens={ofertas} comEstoque aoAdicionar={adicionar} />
            </section>

            <PromoBanners />
            <CategoryGrid categorias={categorias} />

            <section className="secao">
              <div className="sec-h"><h2>Mais vendidos em Cafés Especiais</h2><a href={rota('categoria/cafes-especiais')}>Ver mais</a></div>
              <ProductCarousel idTrilho="trilhoMais" itens={maisVendidos} aoAdicionar={adicionar} />
            </section>

            <OriginGrid />
            <StoreGrid lojas={lojas} itens={vitrine} />
            <SellerCta />
          </main>
        </>
      )}

      {rotaAtual.nome === 'produto' && <PaginaProduto slug={rotaAtual.slug} aoAdicionar={adicionar} />}
      {rotaAtual.nome === 'categoria' && <PaginaCategoria slug={rotaAtual.slug} aoAdicionar={adicionar} />}
      {rotaAtual.nome === 'loja' && <PaginaLoja slug={rotaAtual.slug} aoAdicionar={adicionar} />}
      {rotaAtual.nome === 'busca' && <PaginaBusca termo={rotaAtual.termo} aoAdicionar={adicionar} />}
      {rotaAtual.nome === 'vender' && <PaginaVender />}
      {rotaAtual.nome === 'nada' && <NaoEncontrado oQue="O endereço não corresponde a nenhuma página do Coffee LiVRE." />}

      <Newsletter aoAvisar={avisar} />
      <MarketplaceFooter />
      <Toast mensagem={mensagem} />
    </div>
  );
}

export default function CoffeeLivrePage() {
  // Ícone da aba. O título por rota vive no App.tsx, junto com os outros —
  // o efeito do componente pai roda depois do filho e sobrescreveria daqui.
  useEffect(() => {
    const icone = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const anterior = icone?.href ?? null;
    if (icone) icone.href = '/coffeelivre/coffee-livre-icon.png';
    return () => { if (icone && anterior) icone.href = anterior; };
  }, []);

  return <AccessGate><Experiencia /></AccessGate>;
}
