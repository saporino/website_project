import { useEffect, useState } from 'react';
import Listagem from './Listagem';
import NaoEncontrado from './NaoEncontrado';
import { navegar, rota } from './config';
import {
  listarCategorias, listarVitrine, filtrosDaCategoria, atributosDosProdutos,
  type Categoria, type ItemDaVitrine, type AtributoFiltravel,
} from './catalogo';

export default function PaginaCategoria({ slug, aoAdicionar }: {
  slug: string;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [itens, setItens] = useState<ItemDaVitrine[]>([]);
  const [filtros, setFiltros] = useState<AtributoFiltravel[]>([]);
  const [valores, setValores] = useState<Map<string, Record<string, string>>>(new Map());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    window.scrollTo(0, 0);
    (async () => {
      const todas = await listarCategorias();
      if (!vivo) return;
      const alvo = todas.find(c => c.slug === slug) ?? null;
      setCategoria(alvo);
      if (alvo) {
        // Categoria-mãe traz os produtos das filhas junto: quem clica em
        // "Cafés" espera ver café, não uma página vazia.
        const filhas = todas.filter(c => c.parent_id === alvo.id).map(c => c.id);
        const ids = [alvo.id, ...filhas];
        const [lista, fs] = await Promise.all([
          listarVitrine({ categoriaIds: ids }),
          filtrosDaCategoria(ids),
        ]);
        if (!vivo) return;
        setItens(lista);
        setFiltros(fs);
        setValores(await atributosDosProdutos(lista.map(i => i.id)));
      }
      if (vivo) setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [slug]);

  if (carregando) return <main className="wrap"><p className="vazio" style={{ marginTop: 24 }}>Carregando…</p></main>;
  if (!categoria) return <NaoEncontrado oQue="Esta categoria não existe ou saiu do ar." />;

  return (
    <main className="wrap pag">
      <div className="pag-topo">
        <p className="migalha">
          <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a> › {categoria.nome}
        </p>
        <h1>{categoria.nome}</h1>
        <p>Filtros montados a partir dos atributos desta categoria.</p>
      </div>
      <Listagem itens={itens} filtros={filtros} valores={valores} aoAdicionar={aoAdicionar} />
    </main>
  );
}
