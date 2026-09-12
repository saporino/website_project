// Coffee LiVRE — página de um café.
//
// É a URL permanente do produto e o destino do QR. Tudo vem do banco; o
// que o vendedor não preencheu simplesmente não aparece.
import { useEffect, useState } from 'react';
import { CoffeeBag, ICONES_CATEGORIA } from './svg';
import CoffeePassport from './CoffeePassport';
import ProductCarousel from './ProductCarousel';
import NaoEncontrado from './NaoEncontrado';
import { navegar, rota, rotaDoProduto } from './config';
import EscadaDeQuantidade from './EscadaDeQuantidade';
import {
  buscarProduto, passaporteDoProduto, atributosDoProduto, listarVitrine, escadaDoProduto,
  type ItemDaVitrine, type CampoDoPassport,
} from './catalogo';
import { montarEscada, type Degrau } from './escada';
import { pacoteDoProduto, partesDoPreco, reais, porcentagemOff, parcelas, ehCafe } from './visual';

export default function PaginaProduto({ slug, aoAdicionar }: {
  slug: string;
  /** Recebe a quantidade escolhida e o unitário JÁ com a faixa aplicada. */
  aoAdicionar: (item: ItemDaVitrine, quantidade: number, unitario_cents: number) => void;
}) {
  const [item, setItem] = useState<ItemDaVitrine | null>(null);
  const [passport, setPassport] = useState<CampoDoPassport[]>([]);
  const [ficha, setFicha] = useState<CampoDoPassport[]>([]);
  const [daLoja, setDaLoja] = useState<ItemDaVitrine[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [degraus, setDegraus] = useState<Degrau[]>([]);
  // A quantidade é escolhida ANTES do carrinho. Começa em 1: sugerir 4 de
  // saída seria empurrar volume para quem só queria experimentar.
  const [quantidade, setQuantidade] = useState(1);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    window.scrollTo(0, 0);
    (async () => {
      const p = await buscarProduto(slug);
      if (!vivo) return;
      setItem(p);
      if (p) {
        const [pass, at, irmaos, esc] = await Promise.all([
          passaporteDoProduto(p.id),
          atributosDoProduto(p.id),
          listarVitrine({ lojaId: p.store_id }),
          p.venda_por_quantidade ? escadaDoProduto(p.id) : Promise.resolve(null),
        ]);
        if (!vivo) return;
        setPassport(pass);
        setFicha(at);
        setDaLoja(irmaos.filter(i => i.id !== p.id));
        setQuantidade(1);
        setDegraus(esc ? montarEscada(p.preco_cents, esc.faixas, { pisoCents: esc.piso_cents }) : []);
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [slug]);

  if (carregando) return <main className="wrap"><p className="vazio" style={{ marginTop: 24 }}>Carregando…</p></main>;
  if (!item) return <NaoEncontrado oQue="Este café não foi encontrado." />;

  const degrauAtual = degraus.find(d => d.quantidade === quantidade);
  // Sem escada, o preço mostrado é o do produto; com escada, é o da faixa.
  const unitarioAtual = degrauAtual?.unitario_cents ?? item.preco_cents ?? 0;
  const totalAtual = degrauAtual?.total_cents ?? unitarioAtual;
  const [r, c] = partesDoPreco(unitarioAtual);
  const off = porcentagemOff(item.preco_de_cents, item.preco_cents);
  const parc = parcelas(item.preco_cents);
  const cafe = ehCafe(item);
  const pacote = pacoteDoProduto(item);
  // Ficha técnica é o que sobra: atributos que não entram no passaporte,
  // como material e voltagem de um equipamento.
  const chavesDoPassport = new Set(passport.map(p => p.chave));
  const fichaExtra = ficha.filter(f => !chavesDoPassport.has(f.chave));

  return (
    <main className="wrap pag">
      <p className="migalha">
        <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a>
        {item.categoria_slug && <>
          {' › '}
          <a href={rota(`categoria/${item.categoria_slug}`)} onClick={e => { e.preventDefault(); navegar(`categoria/${item.categoria_slug}`); }}>
            {item.categoria_nome}
          </a>
        </>}
      </p>

      <div className="produto">
        <div>
          <div className="produto-arte">
            {cafe ? (
              <CoffeeBag cor={pacote.cor} fita={pacote.fita} rotulo={pacote.rotulo} tipo={pacote.tipo} />
            ) : (
              <svg viewBox="0 0 120 150" aria-hidden="true">
                <rect x="10" y="20" width="100" height="110" rx="10" fill="var(--etiqueta)" />
                <g transform="translate(36 46) scale(2)" fill="none" stroke={item.loja_cor || '#3A2318'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {ICONES_CATEGORIA[item.categoria_icone ?? 'maquina'] ?? ICONES_CATEGORIA.maquina}
                </g>
              </svg>
            )}
          </div>

          <CoffeePassport
            campos={passport}
            nivel={item.nivel_passport}
            urlPermanente={`${window.location.origin}${rotaDoProduto(item.slug)}`}
          />

          {item.descricao && (
            <section className="passport">
              <div className="passport-topo"><h2>Sobre este {cafe ? 'café' : 'produto'}</h2></div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{item.descricao}</p>
            </section>
          )}

          {fichaExtra.length > 0 && (
            <section className="passport">
              <div className="passport-topo"><h2>Ficha técnica</h2></div>
              <div className="passport-campos">
                {fichaExtra.map(f => (
                  <div className="passport-campo" key={f.chave}>
                    <small>{f.rotulo}</small>
                    <b>{f.valor}{f.unidade ? ` ${f.unidade}` : ''}</b>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="produto-compra">
          {item.is_demo && <span className="selo-demo">Demonstração</span>}
          <h1 style={{ marginTop: item.is_demo ? 10 : 0 }}>{item.titulo}</h1>
          {/* O "de" e o "% OFF" comparam com o preco anterior do produto.
              Com a faixa aplicada, a base da comparacao muda, e mostrar os
              dois juntos faria "R$ 22,90 · 24% OFF" — numeros que nao
              conversam. A partir de 2 pacotes, quem explica o desconto e a
              propria escada. */}
          {quantidade === 1 && item.preco_de_cents ? <p className="de">R$ {reais(item.preco_de_cents)}</p> : null}
          <div className="preco">
            <span className="rs">R$</span>{r}<sup>{c}</sup>
            {quantidade === 1 && off ? <span className="off">{off}% OFF</span> : null}
          </div>
          {quantidade > 1 && <p className="parc">por pacote, levando {quantidade}</p>}
          {parc ? <p className="parc">{parc}</p> : null}
          {item.peso_g ? <p className="nota">Peso: {item.peso_g} g</p> : null}

          <EscadaDeQuantidade degraus={degraus} escolhido={quantidade} aoEscolher={setQuantidade} />

          {quantidade > 1 && (
            <p className="total-escolhido">
              Total de {quantidade} pacotes: <b>R$ {reais(totalAtual)}</b>
            </p>
          )}

          <a
            className="comprar"
            href="#"
            onClick={e => { e.preventDefault(); aoAdicionar(item, quantidade, unitarioAtual); }}
          >
            Comprar agora
          </a>
          <button className="ao-carrinho" onClick={() => aoAdicionar(item, quantidade, unitarioAtual)}>
            Adicionar ao carrinho
          </button>
          <p className="passport-nota" style={{ marginTop: 10 }}>
            Checkout e pagamento entram numa fase seguinte. Nesta demonstração o carrinho só conta itens.
          </p>

          <div className="vendido-por">
            <span className="av" style={{ background: item.loja_cor ?? '#3A2318' }}>{item.loja_iniciais}</span>
            <span>
              <small>Vendido por</small>
              <b>{item.loja_nome}</b>
              <a href={rota(`loja/${item.loja_slug}`)} onClick={e => { e.preventDefault(); navegar(`loja/${item.loja_slug}`); }}>
                Ver a loja
              </a>
            </span>
          </div>
        </aside>
      </div>

      {daLoja.length > 0 && (
        <section className="secao">
          <div className="sec-h">
            <h2>Outros produtos de {item.loja_nome}</h2>
            <a href={rota(`loja/${item.loja_slug}`)} onClick={e => { e.preventDefault(); navegar(`loja/${item.loja_slug}`); }}>Ver a loja</a>
          </div>
          <ProductCarousel idTrilho="trilhoDaLoja" itens={daLoja} aoAdicionar={i => aoAdicionar(i, 1, i.preco_cents ?? 0)} />
        </section>
      )}
    </main>
  );
}
