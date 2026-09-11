import { useEffect, useState } from 'react';
import Listagem from './Listagem';
import NaoEncontrado from './NaoEncontrado';
import { navegar, rota } from './config';
import {
  buscarLoja, listarVitrine, filtrosDaCategoria, atributosDosProdutos,
  type Loja, type ItemDaVitrine, type AtributoFiltravel,
} from './catalogo';

export default function PaginaLoja({ slug, aoAdicionar }: {
  slug: string;
  aoAdicionar: (item: ItemDaVitrine) => void;
}) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [itens, setItens] = useState<ItemDaVitrine[]>([]);
  const [filtros, setFiltros] = useState<AtributoFiltravel[]>([]);
  const [valores, setValores] = useState<Map<string, Record<string, string>>>(new Map());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    window.scrollTo(0, 0);
    (async () => {
      const l = await buscarLoja(slug);
      if (!vivo) return;
      setLoja(l);
      if (l) {
        const lista = await listarVitrine({ lojaId: l.id });
        if (!vivo) return;
        setItens(lista);
        const cats = [...new Set(lista.map(i => i.category_id).filter(Boolean))] as string[];
        const [fs, vs] = await Promise.all([filtrosDaCategoria(cats), atributosDosProdutos(lista.map(i => i.id))]);
        if (!vivo) return;
        setFiltros(fs);
        setValores(vs);
      }
      if (vivo) setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [slug]);

  if (carregando) return <main className="wrap"><p className="vazio" style={{ marginTop: 24 }}>Carregando…</p></main>;
  if (!loja) return <NaoEncontrado oQue="Esta loja não existe ou saiu do ar." />;

  const cor = loja.cor ?? '#3A2318';
  const onde = [loja.cidade, loja.uf].filter(Boolean).join(' · ');

  return (
    <main className="wrap pag">
      <p className="migalha">
        <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a> › Torrefações › {loja.nome}
      </p>

      {/* A loja é parte do marketplace, não um site à parte: mesmo
          cabeçalho, mesmo rodapé, mesma vitrine. */}
      <div className="loja-capa" style={{ background: `linear-gradient(120deg,${cor},#3A2318)` }} />
      <div className="loja-cabeca">
        <div className="av" style={{ color: cor }}>{loja.iniciais ?? loja.nome.slice(0, 2).toUpperCase()}</div>
        <h1>{loja.nome}</h1>
        {onde && <p className="onde">{onde}</p>}
        {loja.chamada && <p className="historia" style={{ fontWeight: 600 }}>{loja.chamada}</p>}
        {loja.historia && <p className="historia">{loja.historia}</p>}
        <div className="loja-selos">
          {loja.especialidade && <span>{loja.especialidade}</span>}
          <span>{itens.length} {itens.length === 1 ? 'produto' : 'produtos'}</span>
          {loja.is_demo && <span className="selo-demo">Vendedor de demonstração</span>}
        </div>
      </div>

      <section className="secao">
        <div className="sec-h"><h2>Produtos de {loja.nome}</h2></div>
        <Listagem itens={itens} filtros={filtros} valores={valores} aoAdicionar={aoAdicionar} />
      </section>
    </main>
  );
}
