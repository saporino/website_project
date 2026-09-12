import { ArteLoja } from './svg';
import { navegar, rota } from './config';

export default function SellerCta() {
  return (
    <section className="secao" id="vender">
      <div className="bn b" style={{ minHeight: '200px' }}>
        <h3>Você produz, torra ou embala café? <em>Venda no Coffee LiVRE.</em></h3>
        <p>Sua loja oficial para compradores de todo o Brasil, com pagamento, logística e vitrine prontos.</p>
        <a className="cta" href={rota('vender')} onClick={e => { e.preventDefault(); navegar('vender'); }}>Quero vender</a>
        <svg className="deco" viewBox="0 0 220 190"><ArteLoja /></svg>
      </div>
    </section>
  );
}
