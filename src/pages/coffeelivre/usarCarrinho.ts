// Coffee LiVRE — carrinho da demonstração.
//
// Vive no navegador. Não há pedido, pagamento nem reserva de estoque
// nesta fase, e o carrinho não finge que há.
//
// O que ele guarda é o essencial para a próxima fase não recomeçar: a
// QUANTIDADE e o preço unitário JÁ COM A FAIXA aplicada, congelado no
// momento em que a pessoa adicionou. Preço que muda entre a vitrine e o
// checkout é a forma mais rápida de perder a venda.
//
// UMA LINHA POR VARIANTE, porque o estoque é da variante: 250 g e 500 g do
// mesmo café são prateleiras diferentes. E o carrinho nunca passa do que a
// variante tem para vender — nem somando duas vezes o mesmo pacote.
//
// Limite desta fase: o estoque vale no navegador, com o número que a
// vitrine trouxe. Reserva e conferência no servidor entram com o checkout.
import { useCallback, useRef, useState } from 'react';
import { limitarAoEstoque } from './estoque';

/** O que a tela manda para o carrinho. */
export interface LinhaNova {
  varianteId: string;
  produtoId: string;
  slug: string;
  titulo: string;
  /** Nulo quando o produto só tem uma variante: repetir o nome seria ruído. */
  varianteNome: string | null;
  lojaNome: string;
  lojaSlug: string;
  lojaCor: string | null;
  /** Vendável da variante no momento em que foi adicionada. */
  disponivel: number;
  /** Unitário cheio, para a tela mostrar o que foi economizado. */
  cheio_cents: number;
}

export interface ItemDoCarrinho extends LinhaNova {
  quantidade: number;
  /** Unitário com a faixa aplicada, congelado na hora de adicionar. */
  unitario_cents: number;
}

export interface Carrinho {
  itens: ItemDoCarrinho[];
  /** Unidades, não linhas: é o que baixa do estoque. */
  unidades: number;
  total_cents: number;
  economia_cents: number;
  /** Devolve quantas unidades de fato entraram (0 quando o estoque não deixa). */
  adicionar: (linha: LinhaNova, quantidade: number, unitario_cents: number) => number;
  quantidadeNoCarrinho: (varianteId: string) => number;
  alterarQuantidade: (varianteId: string, quantidade: number) => void;
  remover: (varianteId: string) => void;
  limpar: () => void;
}

export function useCarrinho(): Carrinho {
  const [itens, setItens] = useState<ItemDoCarrinho[]>([]);
  // A resposta de `adicionar` precisa sair na hora, e o estado do React só
  // atualiza no próximo render. A referência guarda a verdade síncrona.
  const atual = useRef<ItemDoCarrinho[]>([]);
  const gravar = (novos: ItemDoCarrinho[]) => { atual.current = novos; setItens(novos); };

  const adicionar = useCallback((linha: LinhaNova, quantidade: number, unitario_cents: number) => {
    const lista = atual.current;
    const existente = lista.find(i => i.varianteId === linha.varianteId);
    const { quantidade: entra } = limitarAoEstoque(quantidade, linha.disponivel, existente?.quantidade ?? 0);
    if (entra === 0) return 0;
    // Adicionar de novo SOMA as unidades e reaplica o unitário recebido,
    // que já vem calculado para a quantidade escolhida na página.
    gravar(existente
      ? lista.map(i => i.varianteId === linha.varianteId
        ? { ...i, disponivel: linha.disponivel, quantidade: i.quantidade + entra, unitario_cents }
        : i)
      : [...lista, { ...linha, quantidade: entra, unitario_cents }]);
    return entra;
  }, []);

  const alterarQuantidade = useCallback((varianteId: string, quantidade: number) => {
    const lista = atual.current;
    gravar(quantidade <= 0
      ? lista.filter(i => i.varianteId !== varianteId)
      : lista.map(i => i.varianteId === varianteId ? { ...i, quantidade: Math.min(quantidade, i.disponivel) } : i));
  }, []);

  const remover = useCallback((varianteId: string) => {
    gravar(atual.current.filter(i => i.varianteId !== varianteId));
  }, []);

  const limpar = useCallback(() => gravar([]), []);

  const quantidadeNoCarrinho = (varianteId: string) =>
    itens.find(i => i.varianteId === varianteId)?.quantidade ?? 0;

  const unidades = itens.reduce((s, i) => s + i.quantidade, 0);
  const total_cents = itens.reduce((s, i) => s + i.unitario_cents * i.quantidade, 0);
  const cheio_cents = itens.reduce((s, i) => s + i.cheio_cents * i.quantidade, 0);

  return {
    itens, unidades, total_cents,
    economia_cents: cheio_cents - total_cents,
    adicionar, quantidadeNoCarrinho, alterarQuantidade, remover, limpar,
  };
}
