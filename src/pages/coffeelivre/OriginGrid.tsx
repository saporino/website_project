import { FundoDaOrigem } from './svg';
import { origens } from './mockData';

export default function OriginGrid() {
  return (
    <section className="secao" id="regioes">
      <div className="sec-h"><h2>Compre por origem</h2><a href="#">Mapa das origens</a></div>
      <div className="regioes" id="regs">
        {origens.map(([uf, nome, descricao, c1, c2], i) => (
          <a className="reg" href="#" key={nome}>
            <FundoDaOrigem indice={i} c1={c1} c2={c2} />
            <small>{uf}</small><b>{nome}</b><span>{descricao}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
