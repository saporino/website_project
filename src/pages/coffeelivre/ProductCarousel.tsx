import { useRef } from 'react';
import ProductCard from './ProductCard';
import { SetaEsquerda, SetaDireita } from './svg';
import type { ItemDaVitrine } from './catalogo';

export default function ProductCarousel({ itens, comEstoque, idTrilho, aoAdicionar }: {
  itens: ItemDaVitrine[];
  comEstoque?: boolean;
  idTrilho: string;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  // Uma largura visível por clique, como o scrollBy do HTML original.
  const rolar = (sentido: number) =>
    trilho.current?.scrollBy({ left: sentido * trilho.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="caixa">
      <button className="seta esq" aria-label="Anterior" onClick={() => rolar(-1)}><SetaEsquerda largura="2.6" /></button>
      <div className="trilho" id={idTrilho} ref={trilho}>
        {itens.map(i => <ProductCard key={i.id} item={i} comEstoque={comEstoque} aoAdicionar={aoAdicionar} />)}
      </div>
      <button className="seta dir" aria-label="Próximo" onClick={() => rolar(1)}><SetaDireita largura="2.6" /></button>
    </div>
  );
}
