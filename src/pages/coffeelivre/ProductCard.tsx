import { useState } from 'react';
import { CoffeeBag, IconeSelo, IconeCoracao, ICONES_CATEGORIA } from './svg';
import { navegar } from './config';
import type { ItemDaVitrine } from './catalogo';
import { pacoteDoProduto, seloDoProduto, partesDoPreco, reais, porcentagemOff, parcelas, ehCafe } from './visual';

/**
 * Ilustração do item. Café vira pacote na cor da loja; equipamento vira o
 * ícone grande da categoria — desenhar um moedor como pacote de café
 * seria mentir na vitrine.
 */
function Ilustracao({ item }: { item: ItemDaVitrine }) {
  if (ehCafe(item)) {
    const p = pacoteDoProduto(item);
    return <CoffeeBag cor={p.cor} fita={p.fita} rotulo={p.rotulo} tipo={p.tipo} />;
  }
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true">
      <rect x="10" y="20" width="100" height="110" rx="10" fill="var(--etiqueta)" />
      <g transform="translate(36 46) scale(2)" fill="none" stroke={item.loja_cor || '#3A2318'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICONES_CATEGORIA[item.categoria_icone ?? 'maquina'] ?? ICONES_CATEGORIA.maquina}
      </g>
    </svg>
  );
}

export default function ProductCard({ item, comEstoque, aoAdicionar }: {
  item: ItemDaVitrine;
  /** Barra de estoque só nas Ofertas do dia, e só com preço anterior. */
  comEstoque?: boolean;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const [favorito, setFavorito] = useState(false);
  const [adicionado, setAdicionado] = useState(false);
  const [reaisParte, centavosParte] = partesDoPreco(item.preco_cents);
  const off = porcentagemOff(item.preco_de_cents, item.preco_cents);
  const parc = parcelas(item.preco_cents);
  const selo = seloDoProduto(item);
  // Derivado do id, não sorteado: o mockup precisa ser estável entre
  // recargas, senão o investidor vê o número mudar sozinho.
  const vendido = 45 + (item.slug.length * 7) % 50;
  const freteGratis = (item.preco_cents ?? 0) >= 9900;
  // Esgotado continua na vitrine — some da compra, não do catálogo.
  const esgotado = !item.variante_padrao_id || item.disponivel <= 0;

  function abrir(e: React.MouseEvent) {
    // Cliques nos controles do cartão não navegam.
    if ((e.target as HTMLElement).closest('button')) return;
    navegar(`cafe/${item.slug}`);
  }

  function adicionar() {
    if (esgotado) return;
    aoAdicionar(item);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1400);
  }

  return (
    <article className="prod" onClick={abrir} style={{ cursor: 'pointer' }}>
      <button className={`fav${favorito ? ' on' : ''}`} aria-label="Favoritar" onClick={() => setFavorito(v => !v)}>
        <IconeCoracao />
      </button>
      <div className="img"><Ilustracao item={item} /></div>
      {selo ? <span className={`selo ${selo[0]}`}>{selo[1]}</span> : null}
      <h3>{item.titulo}</h3>
      <p className="loja">por {item.loja_nome} <IconeSelo /></p>
      <p className="de">{item.preco_de_cents ? 'R$ ' + reais(item.preco_de_cents) : ''}</p>
      <div className="preco">
        <span className="rs">R$</span>{reaisParte}<sup>{centavosParte}</sup>
        {off ? <span className="off">{off}% OFF</span> : null}
      </div>
      {parc ? <p className="parc">{parc}</p> : null}
      <p className={`frete ${freteGratis ? 'full' : ''}`}>{freteGratis ? 'Frete grátis' : 'Calcular frete'}</p>
      {/* O selo da pontuacao existia no HTML aprovado e e o que separa um
          especial num scroll rapido. Some quando nao ha nota. */}
      {item.pontuacao ? <span className="pont">Pontuação SCA {item.pontuacao}</span> : null}
      {/* "restam" é o vendável real da variante padrão. */}
      {comEstoque && item.preco_de_cents && !esgotado ? (
        <div className="estoque">
          <div className="barra"><i style={{ width: `${vendido}%` }} /></div>
          <small>{vendido}% vendido · restam {item.disponivel} un.</small>
        </div>
      ) : null}
      <div className="add">
        <button className={esgotado ? 'esgotado' : adicionado ? 'ok' : ''} onClick={adicionar} disabled={esgotado}>
          {esgotado ? 'Esgotado' : adicionado ? '✓ Adicionado' : 'Adicionar ao carrinho'}
        </button>
      </div>
    </article>
  );
}
