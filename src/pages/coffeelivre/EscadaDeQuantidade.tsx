// Coffee LiVRE — o seletor de quantidade da página do produto.
//
// A decisão de levar mais acontece AQUI, antes do carrinho. É a diferença
// entre o comprador descobrir a economia na hora de escolher e descobrir
// no checkout, quando já decidiu.
//
// Nenhum número é escrito à mão: tudo vem de `montarEscada`, a mesma
// função que o carrinho usa.
//
// ESTOQUE: faixa que o estoque não cobre aparece desabilitada, não some. A
// configuração do vendedor continua intacta e a faixa volta sozinha quando
// o estoque subir.
import type { Degrau } from './escada';
import { reais } from './visual';

export default function EscadaDeQuantidade({ degraus, escolhido, maximo, aoEscolher }: {
  degraus: Degrau[];
  escolhido: number;
  /** Quantas unidades ainda cabem desta variante (estoque menos carrinho). */
  maximo: number;
  aoEscolher: (quantidade: number) => void;
}) {
  // Um degrau só significa produto sem escada: mostrar uma lista de uma
  // linha seria ruído.
  if (degraus.length < 2) return null;

  return (
    <div className="escada">
      <b className="escada-titulo">Leve mais e pague menos por pacote</b>
      <div className="escada-degraus">
        {degraus.map(d => {
          const selecionado = d.quantidade === escolhido;
          const falta = d.quantidade > maximo;
          return (
            <button
              type="button"
              key={d.quantidade}
              className={`degrau${selecionado && !falta ? ' on' : ''}`}
              onClick={() => aoEscolher(d.quantidade)}
              aria-pressed={selecionado && !falta}
              disabled={falta}
            >
              <span className="degrau-qtd">
                {d.quantidade} {d.quantidade === 1 ? 'pacote' : 'pacotes'}
              </span>
              <span className="degrau-total">R$ {reais(d.total_cents)}</span>
              <span className="degrau-unit">R$ {reais(d.unitario_cents)} por pacote</span>
              {falta ? (
                <span className="degrau-falta">Indisponível no estoque atual</span>
              ) : d.economia_cents > 0 && (
                <span className="degrau-economia">
                  Você economiza R$ {reais(d.economia_cents)}
                </span>
              )}
              {d.melhorCustoPorUnidade && !falta && (
                <span className="degrau-melhor">Melhor custo por pacote</span>
              )}
            </button>
          );
        })}
      </div>
      {/* O frete ainda não entra na conta, e dizer isso vale mais que
          deixar o comprador supor. A diluição por pacote é fase seguinte. */}
      <small className="escada-nota">
        Valores do produto. O frete é calculado na finalização e se dilui quanto mais pacotes você
        levar — essa conta entra numa próxima etapa.
      </small>
    </div>
  );
}
