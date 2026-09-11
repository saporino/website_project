import { ICONES_CATEGORIA } from './svg';
import { navegar } from './config';
import type { Categoria } from './catalogo';

export default function CategoryGrid({ categorias }: { categorias: Categoria[] }) {
  return (
    <section className="secao" id="categorias">
      <div className="sec-h"><h2>Categorias</h2><a href="#categorias">Mostrar todas</a></div>
      <div className="caixa cats" id="cats">
        {categorias.map(c => (
          <a
            className="cat"
            key={c.id}
            href={`/coffeelivre/categoria/${c.slug}`}
            onClick={e => { e.preventDefault(); navegar(`categoria/${c.slug}`); }}
          >
            <i>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONES_CATEGORIA[c.icone ?? 'grao'] ?? ICONES_CATEGORIA.grao}
              </svg>
            </i>{c.nome}
          </a>
        ))}
      </div>
    </section>
  );
}
