// Coffee LiVRE — estado do carrinho no navegador.
//
// O carrinho é do comprador e fica neste navegador (sobrevive a recarregar).
// Ele NÃO é a verdade de preço nem de estoque: ao abrir o checkout, o banco
// grava o carrinho, recalcula a escada, reserva o estoque e devolve qualquer
// diferença para a tela avisar antes de confirmar.
//
// UMA LINHA POR VARIANTE, porque o estoque é da variante. O unitário de cada
// linha é recalculado pela escada a cada mudança de quantidade (contasDoCarrinho.ts),
// com a mesma função da página do produto.
import { useCallback, useEffect, useRef, useState } from 'react';
import { limitarAoEstoque } from './estoque';
import { totaisDoCarrinho, unitarioDaLinha } from './contasDoCarrinho';
import type { Faixa } from './escada';

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
  /** Unitário cheio da variante. */
  cheio_cents: number;
  /** Faixas da escada; nulo enquanto não foram carregadas. */
  faixas: Faixa[] | null;
}

export interface ItemDoCarrinho extends LinhaNova {
  quantidade: number;
  /** Unitário vigente para a quantidade (escada aplicada). */
  unitario_cents: number;
}

export interface Carrinho {
  itens: ItemDoCarrinho[];
  /** Unidades, não linhas: é o que baixa do estoque. */
  unidades: number;
  total_cents: number;
  economia_cents: number;
  lojas: number;
  /** Devolve quantas unidades de fato entraram (0 quando o estoque não deixa). */
  adicionar: (linha: LinhaNova, quantidade: number, unitario_cents: number) => number;
  quantidadeNoCarrinho: (varianteId: string) => number;
  alterarQuantidade: (varianteId: string, quantidade: number) => void;
  /** O servidor disse quanto há: a linha passa a respeitar esse número. */
  ajustarDisponivel: (varianteId: string, disponivel: number) => void;
  definirFaixas: (produtoId: string, faixas: Faixa[]) => void;
  remover: (varianteId: string) => void;
  limpar: () => void;
}

const CHAVE = 'livre_carrinho_v2';

function lerGuardado(): ItemDoCarrinho[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as ItemDoCarrinho[]) : [];
    return Array.isArray(lista) ? lista.filter(i => i && typeof i.varianteId === 'string' && i.quantidade > 0) : [];
  } catch {
    return [];
  }
}

const comUnitario = (i: ItemDoCarrinho): ItemDoCarrinho => ({ ...i, unitario_cents: unitarioDaLinha(i) });

export function useCarrinho(): Carrinho {
  const [itens, setItens] = useState<ItemDoCarrinho[]>(lerGuardado);
  // A resposta de `adicionar` precisa sair na hora, e o estado do React só
  // atualiza no próximo render. A referência guarda a verdade síncrona.
  const atual = useRef<ItemDoCarrinho[]>(itens);
  const gravar = (novos: ItemDoCarrinho[]) => { atual.current = novos; setItens(novos); };

  useEffect(() => {
    try { window.localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch { /* navegador sem armazenamento: segue em memória */ }
  }, [itens]);

  const adicionar = useCallback((linha: LinhaNova, quantidade: number, unitario_cents: number) => {
    const lista = atual.current;
    const existente = lista.find(i => i.varianteId === linha.varianteId);
    const { quantidade: entra } = limitarAoEstoque(quantidade, linha.disponivel, existente?.quantidade ?? 0);
    if (entra === 0) return 0;
    gravar(existente
      ? lista.map(i => i.varianteId === linha.varianteId
        ? comUnitario({ ...i, disponivel: linha.disponivel, faixas: linha.faixas ?? i.faixas, quantidade: i.quantidade + entra, unitario_cents })
        : i)
      : [...lista, comUnitario({ ...linha, quantidade: entra, unitario_cents })]);
    return entra;
  }, []);

  const alterarQuantidade = useCallback((varianteId: string, quantidade: number) => {
    const lista = atual.current;
    gravar(quantidade <= 0
      ? lista.filter(i => i.varianteId !== varianteId)
      : lista.map(i => i.varianteId === varianteId ? comUnitario({ ...i, quantidade: Math.min(quantidade, i.disponivel) }) : i));
  }, []);

  const ajustarDisponivel = useCallback((varianteId: string, disponivel: number) => {
    const lista = atual.current;
    gravar(lista
      .map(i => i.varianteId === varianteId ? comUnitario({ ...i, disponivel, quantidade: Math.min(i.quantidade, disponivel) }) : i)
      .filter(i => i.quantidade > 0));
  }, []);

  const definirFaixas = useCallback((produtoId: string, faixas: Faixa[]) => {
    gravar(atual.current.map(i => i.produtoId === produtoId ? comUnitario({ ...i, faixas }) : i));
  }, []);

  const remover = useCallback((varianteId: string) => {
    gravar(atual.current.filter(i => i.varianteId !== varianteId));
  }, []);

  const limpar = useCallback(() => gravar([]), []);

  const quantidadeNoCarrinho = (varianteId: string) =>
    itens.find(i => i.varianteId === varianteId)?.quantidade ?? 0;

  const t = totaisDoCarrinho(itens);

  return {
    itens, unidades: t.unidades, total_cents: t.total_cents, economia_cents: t.economia_cents, lojas: t.lojas,
    adicionar, quantidadeNoCarrinho, alterarQuantidade, ajustarDisponivel, definirFaixas, remover, limpar,
  };
}
