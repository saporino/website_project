import { CoffeeBag } from './svg';
import { navegar } from './config';
import type { Loja, ItemDaVitrine } from './catalogo';
import { pacoteDoProduto, ehCafe } from './visual';

export default function StoreGrid({ lojas, itens }: { lojas: Loja[]; itens: ItemDaVitrine[] }) {
  return (
    <section className="secao" id="lojas">
      <div className="sec-h"><h2>Torrefações e produtores oficiais</h2><a href="#lojas">Ver todas as lojas</a></div>
      <div className="lojas" id="lojasGrid">
        {lojas.map(l => {
          // Até três cafés da própria loja na miniatura. Equipamento fica
          // de fora: a miniatura é um pacote e moedor não é pacote.
          const vitrine = itens.filter(i => i.loja_slug === l.slug && ehCafe(i)).slice(0, 3);
          return (
            <div className="lj" key={l.id}>
              <div className="capa" style={{ background: `linear-gradient(120deg,${l.cor ?? '#3A2318'},#3A2318)` }} />
              <div className="av" style={{ color: l.cor ?? '#3A2318' }}>{l.iniciais ?? l.nome.slice(0, 2).toUpperCase()}</div>
              <b>{l.nome}</b><span>{l.especialidade ?? [l.cidade, l.uf].filter(Boolean).join(' · ')}</span>
              <div className="mini">
                {vitrine.map(i => {
                  const p = pacoteDoProduto(i);
                  return <CoffeeBag key={i.id} cor={p.cor} fita={p.fita} rotulo={p.rotulo} tipo={p.tipo} />;
                })}
              </div>
              <a href={`/coffeelivre/loja/${l.slug}`} onClick={e => { e.preventDefault(); navegar(`loja/${l.slug}`); }}>Ver loja</a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
