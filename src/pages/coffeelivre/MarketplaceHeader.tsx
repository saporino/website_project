import { useState } from 'react';
import { MARCA, navegar, rota } from './config';
import type { Categoria } from './catalogo';
import type { MostrarToast } from './tipos';

export default function MarketplaceHeader({ itens, pulsando, categorias, aoAvisar, aoAbrirCarrinho }: {
  /** Unidades, não linhas: é o que vai baixar do estoque. */
  itens: number;
  pulsando: boolean;
  categorias: Categoria[];
  aoAvisar: MostrarToast;
  aoAbrirCarrinho: () => void;
}) {
  const [busca, setBusca] = useState('');
  // O menu do celular. Sem ele, acima de 860px a navegação inteira sumia:
  // nove destinos desapareciam e o visitante de telefone ficava sem saída.
  const [menuAberto, setMenuAberto] = useState(false);

  function submeterBusca(e: React.FormEvent) {
    e.preventDefault();
    const termo = busca.trim();
    if (!termo) { aoAvisar({ antes: 'Escreva o que você procura.' }); return; }
    setMenuAberto(false);
    navegar(`busca?q=${encodeURIComponent(termo)}`);
  }

  const irPara = (caminho: string) => { setMenuAberto(false); navegar(caminho); };

  return (
    <header className="hdr">
      <div className="wrap hdr-top">
        <a className="logo" href={rota()} aria-label="Coffee LiVRE — início"
           onClick={e => { e.preventDefault(); irPara(''); }}>
          <img src={MARCA.logo} alt={MARCA.titulo} width="193" height="50" />
        </a>
        <form className="busca" role="search" onSubmit={submeterBusca}>
          <input
            name="q" type="search" placeholder="Buscar cafés, torrefações, regiões e acessórios..."
            aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)}
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
        {/* Só aparece no celular, onde o menu horizontal não cabe. */}
        <button
          className="menu-botao"
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto(v => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuAberto ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        <button className="cep" onClick={() => aoAvisar({ antes: 'Informe seu CEP para ver prazos e fretes (mockup)' })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span><small>Enviar para</small>Informe seu CEP</span>
        </button>

        <nav className="menu">
          <div className="dd">
            <button>Categorias ▾</button>
            <div className="dd-painel"><ul>
              {categorias.map(c => (
                <li key={c.id}>
                  <a href={rota(`categoria/${c.slug}`)} onClick={e => { e.preventDefault(); irPara(`categoria/${c.slug}`); }}>{c.nome}</a>
                </li>
              ))}
            </ul></div>
          </div>
          <a href="#ofertas">Ofertas</a>
          <a href="#">Cupons</a>
          <a href="#lojas">Torrefações</a>
          <a href="#regioes">Origens</a>
          <a href="#">Assinaturas</a>
          <a href={rota('vender')} onClick={e => { e.preventDefault(); irPara('vender'); }}>Vender</a>
          <a href="#">Ajuda</a>
        </nav>

        <div className="conta">
          <a className="txt" href="#">Crie a sua conta</a>
          <a className="txt" href="#">Entre</a>
          <a className="txt" href="#">Compras</a>
          <a className="cart" href="#" aria-label="Carrinho"
             onClick={e => { e.preventDefault(); aoAbrirCarrinho(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h2.2l2.3 11h10.8l2-7.5H6.3" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" />
            </svg>
            <span className={`qt${pulsando ? ' pulse' : ''}`} id="qt">{itens}</span>
          </a>
        </div>
      </div>

      {/* Gaveta do celular: as mesmas categorias e os mesmos destinos que o
          menu horizontal mostra no desktop. */}
      {menuAberto && (
        <div className="menu-gaveta">
          <div className="wrap">
            <p className="menu-titulo">Categorias</p>
            {categorias.map(c => (
              <a key={c.id} href={rota(`categoria/${c.slug}`)} onClick={e => { e.preventDefault(); irPara(`categoria/${c.slug}`); }}>
                {c.nome}
              </a>
            ))}
            <p className="menu-titulo">Navegar</p>
            <a href="#ofertas" onClick={() => setMenuAberto(false)}>Ofertas</a>
            <a href="#lojas" onClick={() => setMenuAberto(false)}>Torrefações</a>
            <a href="#regioes" onClick={() => setMenuAberto(false)}>Origens</a>
            <a href={rota('vender')} onClick={e => { e.preventDefault(); irPara('vender'); }}>Venda no Coffee LiVRE</a>
          </div>
        </div>
      )}
    </header>
  );
}
