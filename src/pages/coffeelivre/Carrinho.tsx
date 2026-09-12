// Coffee LiVRE — gaveta do carrinho.
//
// Existe para o comprador conferir o que escolheu: quantidade, preço por
// pacote e total. Não há checkout nesta fase, e a tela diz isso em vez de
// oferecer um botão que não leva a lugar nenhum.
import { navegar } from './config';
import { reais } from './visual';
import type { Carrinho as EstadoDoCarrinho } from './usarCarrinho';

export default function Carrinho({ carrinho, aberto, aoFechar }: {
  carrinho: EstadoDoCarrinho;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;

  return (
    <>
      <div className="carrinho-fundo" onClick={aoFechar} aria-hidden="true" />
      <aside className="carrinho" role="dialog" aria-label="Carrinho">
        <header className="carrinho-topo">
          <b>Seu carrinho</b>
          <button type="button" onClick={aoFechar} aria-label="Fechar">✕</button>
        </header>

        {carrinho.itens.length === 0 ? (
          <p className="carrinho-vazio">Nada aqui ainda. Escolha um café e a quantidade.</p>
        ) : (
          <>
            <div className="carrinho-itens">
              {carrinho.itens.map(i => {
                const noLimite = i.quantidade >= i.disponivel;
                return (
                  <div className="carrinho-item" key={i.varianteId}>
                    <span className="carrinho-av" style={{ background: i.lojaCor ?? '#3A2318' }} aria-hidden="true" />
                    <div className="carrinho-corpo">
                      <button
                        type="button"
                        className="carrinho-titulo"
                        onClick={() => { aoFechar(); navegar(`cafe/${i.slug}`); }}
                      >
                        {i.titulo}
                      </button>
                      <small>{i.varianteNome ? `${i.varianteNome} · ` : ''}por {i.lojaNome}</small>
                      <div className="carrinho-qtd">
                        <button type="button" onClick={() => carrinho.alterarQuantidade(i.varianteId, i.quantidade - 1)} aria-label="Menos um">−</button>
                        <span>{i.quantidade}</span>
                        <button type="button" onClick={() => carrinho.alterarQuantidade(i.varianteId, i.quantidade + 1)}
                                aria-label="Mais um" disabled={noLimite}>+</button>
                        <small>R$ {reais(i.unitario_cents)} por pacote</small>
                      </div>
                      {noLimite && <small className="carrinho-max">Todo o estoque disponível desta versão</small>}
                    </div>
                    <div className="carrinho-valor">
                      <b>R$ {reais(i.unitario_cents * i.quantidade)}</b>
                      <button type="button" onClick={() => carrinho.remover(i.varianteId)}>remover</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="carrinho-rodape">
              <div className="carrinho-linha">
                <span>{carrinho.unidades} {carrinho.unidades === 1 ? 'pacote' : 'pacotes'}</span>
                <b>R$ {reais(carrinho.total_cents)}</b>
              </div>
              {carrinho.economia_cents > 0 && (
                <div className="carrinho-linha economia">
                  <span>Você economizou</span>
                  <b>R$ {reais(carrinho.economia_cents)}</b>
                </div>
              )}
              <p className="carrinho-nota">
                Frete, pagamento e fechamento do pedido entram numa fase seguinte. Nesta
                apresentação o carrinho serve para conferir a escolha.
              </p>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
