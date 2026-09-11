import { ArteKit, ArteCaixote } from './svg';

/** Os dois banners lado a lado. Viram um por linha abaixo de 860px. */
export default function PromoBanners() {
  return (
    <section className="secao duplo">
      <div className="bn a">
        <h3>Kit Degustação: <em>4 origens, 1 preço</em></h3>
        <p>Compare perfis sensoriais lado a lado. Ideal para presentear.</p>
        <a className="cta" href="#">Montar meu kit</a>
        <svg className="deco" viewBox="0 0 220 190"><ArteKit /></svg>
      </div>
      <div className="bn b">
        <h3>Para o seu negócio: <em>preço de atacado</em></h3>
        <p>Cafeterias, padarias, escritórios e hotéis compram direto das torrefações.</p>
        <a className="cta" href="#">Comprar para empresa</a>
        <svg className="deco" viewBox="0 0 220 190"><ArteCaixote /></svg>
      </div>
    </section>
  );
}
