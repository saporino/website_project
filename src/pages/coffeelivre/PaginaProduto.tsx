// Coffee LiVRE — página de um café.
//
// O PRODUTO é a identidade e dono do Passport. A VARIANTE é o que se
// compra: tem gramatura, moagem, preço efetivo e o estoque. Quando o café
// tem mais de uma, a página deixa escolher; quando tem uma só, a escolha
// nem aparece.
//
// O QR impresso não aponta para cá pelo slug: aponta para `/q/<código>`,
// que resolve e chega aqui com `?v=` na variante certa.
import { useEffect, useState } from 'react';
import { CoffeeBag, ICONES_CATEGORIA } from './svg';
import CoffeePassport from './CoffeePassport';
import ProductCarousel from './ProductCarousel';
import NaoEncontrado from './NaoEncontrado';
import { navegar, rota, rotaDoProduto } from './config';
import EscadaDeQuantidade from './EscadaDeQuantidade';
import {
  buscarProduto, passaporteDoProduto, atributosDoProduto, listarVitrine, escadaDoProduto, variantesDoProduto,
  type ItemDaVitrine, type CampoDoPassport, type EscadaDoProduto, type VarianteAVenda,
} from './catalogo';
import { montarEscada } from './escada';
import { aindaCabe, situacaoDoEstoque } from './estoque';
import { pacoteDoProduto, partesDoPreco, reais, porcentagemOff, parcelas, ehCafe } from './visual';

export default function PaginaProduto({ slug, varianteInicial, noCarrinho, aoAdicionar, aoAdicionarDoCartao }: {
  slug: string;
  varianteInicial: string | null;
  /** Unidades desta variante que já estão no carrinho. */
  noCarrinho: (varianteId: string) => number;
  /** Recebe a quantidade escolhida, o unitário JÁ com a faixa e a variante. */
  aoAdicionar: (item: ItemDaVitrine, quantidade: number, unitario_cents: number, variante: VarianteAVenda) => void;
  aoAdicionarDoCartao: (item: ItemDaVitrine) => void;
}) {
  const [item, setItem] = useState<ItemDaVitrine | null>(null);
  const [passport, setPassport] = useState<CampoDoPassport[]>([]);
  const [ficha, setFicha] = useState<CampoDoPassport[]>([]);
  const [daLoja, setDaLoja] = useState<ItemDaVitrine[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escada, setEscada] = useState<EscadaDoProduto | null>(null);
  const [variantes, setVariantes] = useState<VarianteAVenda[]>([]);
  const [varianteId, setVarianteId] = useState<string | null>(null);
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
        const [pass, at, irmaos, esc, vars] = await Promise.all([
          passaporteDoProduto(p.id),
          atributosDoProduto(p.id),
          listarVitrine({ lojaId: p.store_id }),
          p.venda_por_quantidade ? escadaDoProduto(p.id) : Promise.resolve(null),
          variantesDoProduto(p.id),
        ]);
        if (!vivo) return;
        setPassport(pass);
        setFicha(at);
        setDaLoja(irmaos.filter(i => i.id !== p.id));
        setQuantidade(1);
        setEscada(esc);
        setVariantes(vars);
        const inicial = vars.find(v => v.id === varianteInicial) ?? vars.find(v => v.padrao) ?? vars[0];
        setVarianteId(inicial?.id ?? null);
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [slug, varianteInicial]);

  if (carregando) return <main className="wrap"><p className="vazio" style={{ marginTop: 24 }}>Carregando…</p></main>;
  if (!item) return <NaoEncontrado oQue="Este café não foi encontrado." />;

  const variante = variantes.find(v => v.id === varianteId) ?? null;
  const precoBase = variante?.preco_cents ?? item.preco_cents;
  const degraus = escada ? montarEscada(precoBase, escada.faixas, { pisoCents: escada.piso_cents }) : [];

  // Estoque da VARIANTE, descontado o que já está no carrinho.
  const disponivel = variante?.disponivel ?? 0;
  const jaNoCarrinho = variante ? noCarrinho(variante.id) : 0;
  const cabe = aindaCabe(disponivel, jaNoCarrinho);
  const situacao = situacaoDoEstoque(disponivel);
  // A quantidade escolhida nunca fica acima do que cabe: se o estoque
  // encolheu ou o carrinho encheu, a escolha desce sozinha.
  const qtd = Math.max(1, Math.min(quantidade, cabe));
  const podeComprar = !!variante && cabe > 0;

  const degrauAtual = degraus.find(d => d.quantidade === qtd);
  // Sem escada, o preço mostrado é o da variante; com escada, é o da faixa.
  const unitarioAtual = degrauAtual?.unitario_cents ?? precoBase ?? 0;
  const totalAtual = degrauAtual?.total_cents ?? unitarioAtual;
  const [r, c] = partesDoPreco(unitarioAtual);
  // O "de" compara com o preço do produto. Variante com preço próprio não
  // tem "de" honesto para mostrar.
  const mesmoPreco = precoBase === item.preco_cents;
  const off = mesmoPreco ? porcentagemOff(item.preco_de_cents, item.preco_cents) : null;
  const parc = parcelas(precoBase);
  const cafe = ehCafe(item);
  const pacote = pacoteDoProduto(item);
  const chavesDoPassport = new Set(passport.map(p => p.chave));
  const fichaExtra = ficha.filter(f => !chavesDoPassport.has(f.chave));

  const textoDoEstoque = !variante ? 'Indisponível'
    : situacao === 'esgotado' ? 'Esgotado'
    : cabe === 0 ? 'Todo o estoque disponível já está no seu carrinho'
    : situacao === 'ultimas' ? (disponivel === 1 ? 'Última unidade' : `Últimas ${disponivel} unidades`)
    : 'Em estoque';

  // O endereço impresso é o do código permanente. Sem código (não deveria
  // acontecer: todo produto nasce com um), cai na URL do produto.
  const urlPermanente = item.qr_codigo
    ? `${window.location.origin}${rota(`q/${item.qr_codigo}`)}`
    : `${window.location.origin}${rotaDoProduto(item.slug)}`;

  function escolherVariante(v: VarianteAVenda) {
    setVarianteId(v.id);
    setQuantidade(1);
    // Quem copiar o endereço leva a versão que está vendo.
    window.history.replaceState({}, '', `${rotaDoProduto(item!.slug)}?v=${v.id}`);
  }

  function comprar() {
    if (!podeComprar || !variante) return;
    aoAdicionar(item!, qtd, unitarioAtual, variante);
  }

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

          <CoffeePassport campos={passport} nivel={item.nivel_passport} urlPermanente={urlPermanente} />

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
          {qtd === 1 && mesmoPreco && item.preco_de_cents ? <p className="de">R$ {reais(item.preco_de_cents)}</p> : null}
          <div className="preco">
            <span className="rs">R$</span>{r}<sup>{c}</sup>
            {qtd === 1 && off ? <span className="off">{off}% OFF</span> : null}
          </div>
          {qtd > 1 && <p className="parc">por pacote, levando {qtd}</p>}
          {parc ? <p className="parc">{parc}</p> : null}
          {(variante?.gramatura_g ?? item.peso_g) ? <p className="nota">Peso: {variante?.gramatura_g ?? item.peso_g} g</p> : null}

          {variantes.length > 1 && (
            <div className="variantes">
              <b className="escada-titulo">Versão</b>
              <div className="variantes-opcoes">
                {variantes.map(v => (
                  <button
                    type="button"
                    key={v.id}
                    className={`variante${v.id === varianteId ? ' on' : ''}${v.disponivel <= 0 ? ' esgotada' : ''}`}
                    aria-pressed={v.id === varianteId}
                    onClick={() => escolherVariante(v)}
                  >
                    <span>{v.nome}</span>
                    {v.disponivel <= 0 && <small>esgotada</small>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`estoque-status ${situacao}`} role="status">{textoDoEstoque}</p>

          <EscadaDeQuantidade degraus={degraus} escolhido={qtd} maximo={cabe} aoEscolher={setQuantidade} />

          {qtd > 1 && (
            <p className="total-escolhido">
              Total de {qtd} pacotes: <b>R$ {reais(totalAtual)}</b>
            </p>
          )}

          <a
            className={`comprar${podeComprar ? '' : ' off'}`}
            href="#"
            aria-disabled={!podeComprar}
            onClick={e => { e.preventDefault(); comprar(); }}
          >
            {situacao === 'esgotado' ? 'Esgotado' : 'Comprar agora'}
          </a>
          <button className="ao-carrinho" onClick={comprar} disabled={!podeComprar}>
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
          <ProductCarousel idTrilho="trilhoDaLoja" itens={daLoja} aoAdicionar={aoAdicionarDoCartao} />
        </section>
      )}
    </main>
  );
}
