// Coffee LiVRE — home oficial.
//
// Porte fiel de docs/marketplace/coffee-livre-home-laranja.html: mesma árvore
// de elementos, mesmas classes, mesmos textos. O CSS vive em coffeelivre.css,
// escopado sob .livre-root para não vazar para o resto do site.
import { useEffect, useRef, useState } from 'react';
import './coffeelivre.css';
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
import { produtos, maisIdx, type Produto } from './mockData';
import type { MensagemToast } from './tipos';

function Home() {
  const [itens, setItens] = useState(0);
  const [pulsando, setPulsando] = useState(false);
  const [mensagem, setMensagem] = useState<MensagemToast | null>(null);
  const relogioToast = useRef<number | undefined>(undefined);

  // scroll-behavior:smooth vive no <html>, então escopar em .livre-root não
  // funcionaria. A classe entra ao montar e sai ao desmontar: nenhuma outra
  // rota é afetada.
  useEffect(() => {
    document.documentElement.classList.add('livre-scroll');
    return () => { document.documentElement.classList.remove('livre-scroll'); };
  }, []);


  function avisar(m: MensagemToast) {
    setMensagem(m);
    window.clearTimeout(relogioToast.current);
    relogioToast.current = window.setTimeout(() => setMensagem(null), 2600);
  }

  function adicionar(p: Produto) {
    setItens(q => q + 1);
    setPulsando(true);
    setTimeout(() => setPulsando(false), 220);
    // O toast mostra só a parte do nome antes do travessão, como no HTML.
    avisar({ forte: p.t.split(' — ')[0], depois: ' foi adicionado ao carrinho' });
  }

  return (
    <div className="livre-root">
      <MarketplaceHeader itens={itens} pulsando={pulsando} aoAvisar={avisar} />
      <HeroCarousel />

      <main className="wrap">
        <HighlightCards />
        <BenefitsBar />
        <HarvestBanner />

        <section className="secao" id="ofertas">
          <div className="sec-h"><h2>Ofertas do dia</h2><a href="#">Mostrar todas as ofertas</a></div>
          <ProductCarousel
            idTrilho="trilhoOfertas"
            indices={produtos.map((_, i) => i)}
            comEstoque
            aoAdicionar={adicionar}
          />
        </section>

        <PromoBanners />
        <CategoryGrid />

        <section className="secao">
          <div className="sec-h"><h2>Mais vendidos em Cafés Especiais</h2><a href="#">Ver mais</a></div>
          <ProductCarousel idTrilho="trilhoMais" indices={maisIdx} aoAdicionar={adicionar} />
        </section>

        <OriginGrid />
        <StoreGrid />
        <SellerCta />
      </main>

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

  return <AccessGate><Home /></AccessGate>;
}
