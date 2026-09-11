import { useState } from 'react';
import { CoffeeBag, IconeSelo, IconeCoracao } from './svg';
import { brl, pct, parcelas, estoqueVendido, type Produto } from './mockData';

export default function ProductCard({ p, indice, comEstoque, aoAdicionar }: {
  p: Produto;
  /** Índice do produto na lista original — decide a barra de estoque. */
  indice: number;
  comEstoque?: boolean;
  aoAdicionar: (p: Produto) => void;
}) {
  const [favorito, setFavorito] = useState(false);
  const [adicionado, setAdicionado] = useState(false);
  const [reais, centavos] = brl(p.por).split(',');
  const parc = parcelas(p.por);
  const vendido = estoqueVendido(indice);

  function adicionar() {
    aoAdicionar(p);
    setAdicionado(true);
    // 1400 ms de "✓ Adicionado", como no HTML oficial.
    setTimeout(() => setAdicionado(false), 1400);
  }

  return (
    <article className="prod">
      <button className={`fav${favorito ? ' on' : ''}`} aria-label="Favoritar" onClick={() => setFavorito(v => !v)}>
        <IconeCoracao />
      </button>
      <div className="img"><CoffeeBag cor={p.cor} fita={p.fita} rotulo={p.rot} tipo={p.tipo} /></div>
      {p.selo ? <span className={`selo ${p.selo[0]}`}>{p.selo[1]}</span> : null}
      <h3>{p.t}</h3>
      <p className="loja">por {p.loja} <IconeSelo /></p>
      <p className="de">{p.de ? 'R$ ' + brl(p.de) : ''}</p>
      <div className="preco">
        <span className="rs">R$</span>{reais}<sup>{centavos}</sup>
        {p.de ? <span className="off">{pct(p.de, p.por)}% OFF</span> : null}
      </div>
      {parc ? <p className="parc">{parc}</p> : null}
      <p className={`frete ${p.full ? 'full' : ''}`}>{p.por >= 99 || p.full ? 'Frete grátis' : 'Chegará amanhã'}</p>
      <p className="nota"><b>★ {p.nota.toFixed(1)}</b> ({p.av.toLocaleString('pt-BR')})</p>
      {p.pts ? <span className="pont">Pontuação SCA {p.pts}</span> : null}
      {/* A barra de estoque só aparece nas Ofertas do dia, e só com preço "de". */}
      {comEstoque && p.de ? (
        <div className="estoque">
          <div className="barra"><i style={{ width: `${vendido}%` }} /></div>
          <small>{vendido}% vendido · restam {Math.max(3, Math.round((100 - vendido) / 3))} un.</small>
        </div>
      ) : null}
      <div className="add">
        <button className={adicionado ? 'ok' : ''} onClick={adicionar}>
          {adicionado ? '✓ Adicionado' : 'Adicionar ao carrinho'}
        </button>
      </div>
    </article>
  );
}
