import { CoffeeBag } from './svg';
import { produtos, brl } from './mockData';

const METODOS = ['Coado / V60', 'Prensa francesa', 'Espresso', 'Moka italiana', 'Cold brew'];

/** Os cinco cards que sobrepõem o hero. Ordem e produtos do HTML oficial. */
export default function HighlightCards() {
  const p0 = produtos[1], p1 = produtos[0], p2 = produtos[6];
  const simples: [string, typeof p0, string | null][] = [
    ['Visto recentemente', p0, null],
    ['Mais vendido da semana', p1, null],
    ['Microlote em destaque', p2, 'Ver microlotes'],
  ];

  return (
    <section className="cards" id="cards">
      {simples.map(([titulo, p, botao]) => (
        <div className="ct" key={titulo}>
          <h3>{titulo}</h3>
          <div className="im"><CoffeeBag cor={p.cor} fita={p.fita} rotulo={p.rot} tipo={p.tipo} /></div>
          <p className="nm">{p.t}</p>
          <p className="pr">R$ {brl(p.por)}</p>
          {botao ? <a className="bt" href="#">{botao}</a> : <p className="fg">Frete grátis</p>}
        </div>
      ))}

      <div className="ct destaque">
        <h3>Primeira compra?</h3>
        <ul>
          <li><i><svg viewBox="0 0 24 24" fill="none" stroke="#2A1911" strokeWidth="2"><path d="M4 8h16v12H4zM2 8h20V5H2zM12 5v15M12 5c-2-3-6-3-6 0M12 5c2-3 6-3 6 0" /></svg></i>10% OFF no primeiro pedido</li>
          <li><i><svg viewBox="0 0 24 24" fill="none" stroke="#2A1911" strokeWidth="2"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /></svg></i>Frete grátis acima de R$ 99</li>
          <li><i><svg viewBox="0 0 24 24" fill="none" stroke="#2A1911" strokeWidth="2"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" /></svg></i>Compra garantida</li>
        </ul>
        <a className="bt" href="#">Criar conta grátis</a>
      </div>

      <div className="ct">
        <h3>Escolha seu método</h3>
        <ul style={{ color: 'var(--texto)' }}>
          {METODOS.map(m => (
            <li key={m}>
              <i style={{ background: 'var(--etiqueta)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#DA6418" strokeWidth="2"><path d="M5 9h12v5a6 6 0 0 1-12 0zM17 10h1.5a2.5 2.5 0 0 1 0 5H17" /></svg>
              </i>{m}
            </li>
          ))}
        </ul>
        <a className="bt" href="#">Ver guia de moagem</a>
      </div>
    </section>
  );
}
