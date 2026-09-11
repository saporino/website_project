import { useEffect, useState } from 'react';
import Listagem from './Listagem';
import { navegar, rota } from './config';
import {
  buscarPorTexto, filtrosDaCategoria, atributosDosProdutos,
  type ItemDaVitrine, type AtributoFiltravel,
} from './catalogo';

export default function PaginaBusca({ termo, aoAdicionar }: {
  termo: string;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const [itens, setItens] = useState<ItemDaVitrine[]>([]);
  const [filtros, setFiltros] = useState<AtributoFiltravel[]>([]);
  const [valores, setValores] = useState<Map<string, Record<string, string>>>(new Map());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    window.scrollTo(0, 0);
    (async () => {
      const lista = await buscarPorTexto(termo);
      if (!vivo) return;
      setItens(lista);
      // Os filtros saem das categorias que o resultado alcançou: buscar
      // "café" pode trazer grãos e cápsulas, e cada um traz os seus.
      const cats = [...new Set(lista.map(i => i.category_id).filter(Boolean))] as string[];
      const [fs, vs] = await Promise.all([filtrosDaCategoria(cats), atributosDosProdutos(lista.map(i => i.id))]);
      if (!vivo) return;
      setFiltros(fs);
      setValores(vs);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [termo]);

  return (
    <main className="wrap pag">
      <div className="pag-topo">
        <p className="migalha">
          <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a> › Busca
        </p>
        <h1>Resultados para “{termo}”</h1>
        {!carregando && itens.length > 0 && (
          <p>{itens.length} {itens.length === 1 ? 'produto encontrado' : 'produtos encontrados'}.</p>
        )}
      </div>
      {carregando ? (
        <p className="vazio">Buscando…</p>
      ) : itens.length === 0 ? (
        <p className="vazio">
          Não encontramos nada para “{termo}”. Tente um termo mais curto, como o nome da região ou da torrefação.
        </p>
      ) : (
        <Listagem itens={itens} filtros={filtros} valores={valores} aoAdicionar={aoAdicionar} />
      )}
    </main>
  );
}
