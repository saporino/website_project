// Coffee LiVRE — gaveta do carrinho.
//
// Um carrinho, um bloco por loja. É assim que o pedido nasce (um subpedido por
// vendedor), e é assim que a pessoa entende quem envia o quê. Cada bloco mostra
// o subtotal da loja, a economia da escada e o estoque; o rodapé fecha a conta
// e leva ao checkout. Frete é calculado no checkout, não inventado aqui.
import { navegar } from './config';
import { reais } from './visual';
import { agruparPorLoja } from './contasDoCarrinho';
import type { Carrinho as EstadoDoCarrinho } from './usarCarrinho';

export default function Carrinho({ carrinho, aberto, aoFechar }: {
  carrinho: EstadoDoCarrinho;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  const grupos = agruparPorLoja(carrinho.itens);
  const ir = (caminho: string) => { aoFechar(); navegar(caminho); };

  return (
    <>
      <div className="carrinho-fundo" onClick={aoFechar} aria-hidden="true" />
      <aside className="carrinho" role="dialog" aria-label="Carrinho">
        <header className="carrinho-topo">
          <b>Seu carrinho</b>
          <button type="button" onClick={aoFechar} aria-label="Fechar">✕</button>
        </header>

        {carrinho.itens.length === 0 ? (
          <div className="carrinho-vazio">
            <p>Nada aqui ainda. Escolha um café e a quantidade.</p>
            <button type="button" className="carrinho-link" onClick={() => ir('conta/pedidos')}>Ver meus pedidos</button>
          </div>
        ) : (
          <>
            <div className="carrinho-itens">
              {grupos.map(g => (
                <section className="carrinho-loja" key={g.lojaSlug} aria-label={`Itens de ${g.lojaNome}`}>
                  <header className="carrinho-loja-topo">
                    <span className="carrinho-loja-cor" style={{ background: g.lojaCor ?? '#3A2318' }} aria-hidden="true" />
                    <b>{g.lojaNome}</b>
                    <small>{g.unidades} {g.unidades === 1 ? 'pacote' : 'pacotes'}</small>
                  </header>
                  {g.itens.map(i => {
                    const noLimite = i.quantidade >= i.disponivel;
                    return (
                      <div className="carrinho-item" key={i.varianteId} data-variante={i.varianteId}>
                        <span className="carrinho-av" style={{ background: i.lojaCor ?? '#3A2318' }} aria-hidden="true" />
                        <div className="carrinho-corpo">
                          <button type="button" className="carrinho-titulo" onClick={() => ir(`cafe/${i.slug}`)}>
                            {i.titulo}
                          </button>
                          {i.varianteNome && <small>{i.varianteNome}</small>}
                          <div className="carrinho-qtd">
                            <button type="button" onClick={() => carrinho.alterarQuantidade(i.varianteId, i.quantidade - 1)} aria-label="Menos um">−</button>
                            <span>{i.quantidade}</span>
                            <button type="button" onClick={() => carrinho.alterarQuantidade(i.varianteId, i.quantidade + 1)}
                                    aria-label="Mais um" disabled={noLimite}>+</button>
                            <small>R$ {reais(i.unitario_cents)} por pacote</small>
                          </div>
                          {i.unitario_cents < i.cheio_cents && (
                            <small className="carrinho-escada">Escada: de R$ {reais(i.cheio_cents)} por R$ {reais(i.unitario_cents)}</small>
                          )}
                          <small>{noLimite ? <span className="carrinho-max">Todo o estoque disponível desta versão</span> : `${i.disponivel} em estoque`}</small>
                        </div>
                        <div className="carrinho-valor">
                          <b>R$ {reais(i.unitario_cents * i.quantidade)}</b>
                          <button type="button" onClick={() => carrinho.remover(i.varianteId)}>remover</button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="carrinho-loja-sub" data-campo="subtotal-loja">
                    <span>Subtotal {g.lojaNome}</span>
                    <b>R$ {reais(g.total_cents)}</b>
                  </div>
                  {g.economia_cents > 0 && (
                    <div className="carrinho-loja-economia">Economia na escada: R$ {reais(g.economia_cents)}</div>
                  )}
                </section>
              ))}
            </div>

            <footer className="carrinho-rodape">
              <div className="carrinho-linha menor">
                <span>Produtos ({carrinho.unidades} {carrinho.unidades === 1 ? 'pacote' : 'pacotes'}{carrinho.lojas > 1 ? `, ${carrinho.lojas} lojas` : ''})</span>
                <b>R$ {reais(carrinho.total_cents + carrinho.economia_cents)}</b>
              </div>
              {carrinho.economia_cents > 0 && (
                <div className="carrinho-linha economia">
                  <span>Descontos da escada</span>
                  <b>− R$ {reais(carrinho.economia_cents)}</b>
                </div>
              )}
              <div className="carrinho-linha menor">
                <span>Frete</span>
                <span>calculado no checkout</span>
              </div>
              <div className="carrinho-linha" data-campo="total-carrinho">
                <span>Total dos produtos</span>
                <b>R$ {reais(carrinho.total_cents)}</b>
              </div>
              <button type="button" className="carrinho-fechar" onClick={() => ir('checkout')}>Fechar pedido</button>
              <p className="carrinho-nota">
                Preço e estoque são conferidos de novo ao abrir o checkout. Pagamento e frete desta demonstração são simulados.
              </p>
              <button type="button" className="carrinho-link" onClick={() => ir('conta/pedidos')}>Meus pedidos</button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
