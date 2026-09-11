import { ICONES_CATEGORIA } from './svg';
import { categorias } from './mockData';

export default function CategoryGrid() {
  return (
    <section className="secao" id="categorias">
      <div className="sec-h"><h2>Categorias</h2><a href="#">Mostrar todas</a></div>
      <div className="caixa cats" id="cats">
        {categorias.map(([chave, nome]) => (
          <a className="cat" href="#" key={chave}>
            <i>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONES_CATEGORIA[chave]}
              </svg>
            </i>{nome}
          </a>
        ))}
      </div>
    </section>
  );
}
