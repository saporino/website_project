import { useState } from 'react';
import { LOGO, ALT_LOGO, menuCategorias } from './mockData';
import type { MostrarToast } from './tipos';

export default function MarketplaceHeader({ itens, pulsando, aoAvisar }: {
  itens: number;
  pulsando: boolean;
  aoAvisar: MostrarToast;
}) {
  const [busca, setBusca] = useState('');

  return (
    <header className="hdr">
      <div className="wrap hdr-top">
        <a className="logo" href="#" aria-label="Coffee LiVRE — início">
          <img src={LOGO} alt={ALT_LOGO} width="193" height="50" />
        </a>
        <form
          className="busca"
          role="search"
          onSubmit={e => { e.preventDefault(); aoAvisar({ antes: 'Busca por ', forte: busca || 'tudo', depois: ' (mockup)' }); }}
        >
          <input
            name="q"
            type="search"
            placeholder="Buscar cafés, torrefações, regiões e acessórios..."
            aria-label="Buscar"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <button aria-label="Buscar">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" />
            </svg>
          </button>
        </form>
        <div className="promo-top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#351E14" strokeWidth="2">
            <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" />
          </svg>
          <span>Frete grátis <b>acima de R$ 99</b></span>
        </div>
      </div>
      <div className="wrap hdr-bot">
        <button className="cep" onClick={() => aoAvisar({ antes: 'Informe seu CEP para ver prazos e fretes (mockup)' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span><small>Enviar para</small>Informe seu CEP</span>
        </button>
        <nav className="menu">
          {/* Abre no hover e no foco — quem navega por teclado também alcança. */}
          <div className="dd">
            <button>Categorias ▾</button>
            <div className="dd-painel"><ul>
              {menuCategorias.map(c => <li key={c}><a href="#categorias">{c}</a></li>)}
            </ul></div>
          </div>
          <a href="#ofertas">Ofertas</a>
          <a href="#">Cupons</a>
          <a href="#lojas">Torrefações</a>
          <a href="#regioes">Origens</a>
          <a href="#">Assinaturas</a>
          <a href="#vender">Vender</a>
          <a href="#">Ajuda</a>
        </nav>
        <div className="conta">
          <a className="txt" href="#">Crie a sua conta</a>
          <a className="txt" href="#">Entre</a>
          <a className="txt" href="#">Compras</a>
          <a className="cart" href="#" aria-label="Carrinho">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h2.2l2.3 11h10.8l2-7.5H6.3" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" />
            </svg>
            <span className={`qt${pulsando ? ' pulse' : ''}`} id="qt">{itens}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
