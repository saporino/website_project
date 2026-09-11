import { CoffeeBag } from './svg';
import { lojas, produtos } from './mockData';

export default function StoreGrid() {
  return (
    <section className="secao" id="lojas">
      <div className="sec-h"><h2>Torrefações e produtores oficiais</h2><a href="#">Ver todas as lojas</a></div>
      <div className="lojas" id="lojasGrid">
        {lojas.map(([nome, descricao, sigla, cor, vitrine]) => (
          <div className="lj" key={nome}>
            <div className="capa" style={{ background: `linear-gradient(120deg,${cor},#3A2318)` }} />
            <div className="av" style={{ color: cor }}>{sigla}</div>
            <b>{nome}</b><span>{descricao}</span>
            <div className="mini">
              {vitrine.map(i => (
                <CoffeeBag key={i} cor={produtos[i].cor} fita={produtos[i].fita} rotulo={produtos[i].rot} tipo={produtos[i].tipo} />
              ))}
            </div>
            <a href="#">Ver loja</a>
          </div>
        ))}
      </div>
    </section>
  );
}
