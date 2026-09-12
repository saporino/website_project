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
// Estoque sempre por unidade: quatro pacotes são quatro unidades, e não
// um item de kit. É a mesma regra da escada.
import { useCallback, useState } from 'react';
import type { ItemDaVitrine } from './catalogo';

export interface ItemDoCarrinho {
  produtoId: string;
  slug: string;
  titulo: string;
  lojaNome: string;
  lojaSlug: string;
  lojaCor: string | null;
  quantidade: number;
  /** Unitário com a faixa aplicada, congelado na hora de adicionar. */
  unitario_cents: number;
  /** Unitário cheio, para a tela mostrar o que foi economizado. */
  cheio_cents: number;
}

export interface Carrinho {
  itens: ItemDoCarrinho[];
  /** Unidades, não linhas: é o que baixa do estoque. */
  unidades: number;
  total_cents: number;
  economia_cents: number;
  adicionar: (item: ItemDaVitrine, quantidade: number, unitario_cents: number) => void;
  alterarQuantidade: (produtoId: string, quantidade: number) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
}

export function useCarrinho(): Carrinho {
  const [itens, setItens] = useState<ItemDoCarrinho[]>([]);

  const adicionar = useCallback((item: ItemDaVitrine, quantidade: number, unitario_cents: number) => {
    setItens(atual => {
      const existente = atual.find(i => i.produtoId === item.id);
      // Adicionar de novo SOMA as unidades e reaplica o unitário recebido,
      // que já vem calculado para a quantidade total escolhida na página.
      if (existente) {
        return atual.map(i => i.produtoId === item.id
          ? { ...i, quantidade: i.quantidade + quantidade, unitario_cents }
          : i);
      }
      return [...atual, {
        produtoId: item.id,
        slug: item.slug,
        titulo: item.titulo,
        lojaNome: item.loja_nome,
        lojaSlug: item.loja_slug,
        lojaCor: item.loja_cor,
        quantidade,
        unitario_cents,
        cheio_cents: item.preco_cents ?? unitario_cents,
      }];
    });
  }, []);

  const alterarQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setItens(atual => quantidade <= 0
      ? atual.filter(i => i.produtoId !== produtoId)
      : atual.map(i => i.produtoId === produtoId ? { ...i, quantidade } : i));
  }, []);

  const remover = useCallback((produtoId: string) => {
    setItens(atual => atual.filter(i => i.produtoId !== produtoId));
  }, []);

  const limpar = useCallback(() => setItens([]), []);

  const unidades = itens.reduce((s, i) => s + i.quantidade, 0);
  const total_cents = itens.reduce((s, i) => s + i.unitario_cents * i.quantidade, 0);
  const cheio_cents = itens.reduce((s, i) => s + i.cheio_cents * i.quantidade, 0);

  return {
    itens, unidades, total_cents,
    economia_cents: cheio_cents - total_cents,
    adicionar, alterarQuantidade, remover, limpar,
  };
}
