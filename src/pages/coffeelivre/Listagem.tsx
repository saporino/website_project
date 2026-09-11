// Coffee LiVRE — listagem com filtros, usada pela categoria e pela busca.
//
// Os filtros NÃO são escritos à mão: saem dos atributos que a categoria
// declara. É o que faz "Cafés especiais" oferecer processo e pontuação e
// "Moedores" oferecer material e voltagem, sem nenhuma condição especial
// no código.
//
// Filtragem no navegador de propósito. Nesta escala é instantânea e
// honesta; um motor de busca com faceta seria infraestrutura para um
// problema que ainda não temos.
import { useMemo, useState } from 'react';
import ProductCard from './ProductCard';
import type { ItemDaVitrine, AtributoFiltravel } from './catalogo';

type Ordem = 'relevancia' | 'menor' | 'maior' | 'nome';

const ORDENS: [Ordem, string][] = [
  ['relevancia', 'Mais relevantes'],
  ['menor', 'Menor preço'],
  ['maior', 'Maior preço'],
  ['nome', 'Nome'],
];

export default function Listagem({ itens, filtros, valores, aoAdicionar }: {
  itens: ItemDaVitrine[];
  filtros: AtributoFiltravel[];
  /** produto → { chave do atributo: valor } */
  valores: Map<string, Record<string, string>>;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, Set<string>>>({});
  const [ordem, setOrdem] = useState<Ordem>('relevancia');

  /**
   * Opções de cada filtro saem dos produtos que estão na tela, não da
   * definição do atributo: oferecer "Conilon" quando nenhum produto é
   * conilon leva a pessoa a um resultado vazio.
   */
  const opcoesReais = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const f of filtros) {
      const vistos = new Set<string>();
      for (const i of itens) {
        const v = valores.get(i.id)?.[f.chave];
        if (v) vistos.add(v);
      }
      if (vistos.size > 1) mapa[f.chave] = [...vistos].sort();
    }
    return mapa;
  }, [filtros, itens, valores]);

  const filtrados = useMemo(() => {
    const ativos = Object.entries(escolhas).filter(([, s]) => s.size > 0);
    const lista = itens.filter(i => {
      const meus = valores.get(i.id) ?? {};
      return ativos.every(([chave, set]) => set.has(meus[chave] ?? ''));
    });
    const preco = (i: ItemDaVitrine) => i.preco_cents ?? 0;
    if (ordem === 'menor') return [...lista].sort((a, b) => preco(a) - preco(b));
    if (ordem === 'maior') return [...lista].sort((a, b) => preco(b) - preco(a));
    if (ordem === 'nome') return [...lista].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    return lista;
  }, [itens, valores, escolhas, ordem]);

  function alternar(chave: string, valor: string) {
    setEscolhas(atual => {
      const set = new Set(atual[chave] ?? []);
      if (set.has(valor)) set.delete(valor); else set.add(valor);
      return { ...atual, [chave]: set };
    });
  }

  const temFiltroAtivo = Object.values(escolhas).some(s => s.size > 0);
  const chavesComOpcao = Object.keys(opcoesReais);

  return (
    <div className="listagem">
      <aside className="filtros">
        {chavesComOpcao.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--cinza)' }}>
            Não há variação suficiente entre estes produtos para filtrar.
          </p>
        ) : (
          <>
            {filtros.filter(f => opcoesReais[f.chave]).map(f => (
              <div className="filtro-grupo" key={f.chave}>
                <h4>{f.rotulo}</h4>
                <div className="filtro-opcoes">
                  {opcoesReais[f.chave].map(v => (
                    <button
                      key={v}
                      type="button"
                      className={escolhas[f.chave]?.has(v) ? 'on' : ''}
                      onClick={() => alternar(f.chave, v)}
                    >
                      {v}{f.unidade ? ` ${f.unidade}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {temFiltroAtivo && (
              <button type="button" className="limpar-filtros" onClick={() => setEscolhas({})}>
                Limpar filtros
              </button>
            )}
          </>
        )}
      </aside>

      <div>
        <div className="barra-resultado">
          <span className="conta">
            {filtrados.length === itens.length
              ? `${itens.length} ${itens.length === 1 ? 'produto' : 'produtos'}`
              : `${filtrados.length} de ${itens.length} produtos`}
          </span>
          <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
            {ORDENS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <p className="vazio">Nenhum produto com esses filtros. Tente tirar um deles.</p>
        ) : (
          <div className="grade">
            {filtrados.map(i => <ProductCard key={i.id} item={i} aoAdicionar={aoAdicionar} />)}
          </div>
        )}
      </div>
    </div>
  );
}
