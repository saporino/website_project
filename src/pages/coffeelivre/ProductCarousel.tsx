import { useRef } from 'react';
import ProductCard from './ProductCard';
import { SetaEsquerda, SetaDireita } from './svg';
import { produtos, type Produto } from './mockData';

export default function ProductCarousel({ indices, comEstoque, idTrilho, aoAdicionar }: {
  indices: number[];
  comEstoque?: boolean;
  idTrilho: string;
  aoAdicionar: (p: Produto) => void;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  // Uma largura visível por clique, exatamente como o scrollBy do HTML.
  const rolar = (sentido: number) =>
    trilho.current?.scrollBy({ left: sentido * trilho.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="caixa">
      <button className="seta esq" aria-label="Anterior" onClick={() => rolar(-1)}><SetaEsquerda largura="2.6" /></button>
      <div className="trilho" id={idTrilho} ref={trilho}>
        {indices.map((i, pos) => (
          <ProductCard key={`${i}-${pos}`} p={produtos[i]} indice={i} comEstoque={comEstoque} aoAdicionar={aoAdicionar} />
        ))}
      </div>
      <button className="seta dir" aria-label="Próximo" onClick={() => rolar(1)}><SetaDireita largura="2.6" /></button>
    </div>
  );
}
