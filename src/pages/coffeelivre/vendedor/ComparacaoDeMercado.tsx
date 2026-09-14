// Seller Central — comparação de mercado e preço em um clique.
//
// DADO → CONTEXTO → RECOMENDAÇÃO → AÇÃO.
//
// O painel mostra onde o café está entre equivalentes de verdade; o
// Copiloto diz o que faria; o vendedor escolhe e confirma; o banco aplica,
// confere o piso, registra quem, quando, de quanto para quanto e por quê.
// Desfazer existe enquanto for seguro — quem decide isso é o servidor.
//
// Nunca "seja o mais barato". Preço é uma dimensão, não a estratégia.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  compararComMercado, recomendarPreco, ROTULO_DO_ATRIBUTO,
  type OpcaoDePreco, type Posicao, type ProdutoDeMercado,
} from '../comparacao';
import { montarEscada } from '../escada';
import { carregarCalculadora, type DadosDaCalculadora } from '../calculadora/dados';
import { calcularPedido, ehErro } from '../calculadora/economia';
import {
  aplicarPreco, carregarMercadoPublico, carregarMeuProduto, desfazerPreco, historicoDePreco, resumoDaRecomendacao,
  type LinhaDoHistorico, type MeuProdutoNoMercado,
} from './mercado';
import type { Avisar } from './SellerCentral';

const brl = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brlSinal = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${brl(Math.abs(c))}`;
const pct = (bps: number) =>
  `${bps > 0 ? '+' : bps < 0 ? '−' : ''}${(Math.abs(bps) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const POSICAO: Record<Posicao, string> = {
  abaixo_da_faixa: 'Abaixo da faixa dos equivalentes',
  faixa_inferior: 'Na metade de menor preço',
  na_mediana: 'Junto da mediana',
  faixa_superior: 'Na metade de maior preço',
  acima_da_faixa: 'Acima da faixa dos equivalentes',
};

const ORIGEM: Record<string, string> = {
  manual: 'Edição manual', copiloto: 'LiVRE Copiloto', promocao: 'Promoção', automatico: 'Automático',
  desfazer: 'Desfeito', admin: 'Equipe Coffee LiVRE',
};

export default function ComparacaoDeMercado({ produtoId, avisar, aoAlterarPreco, alteracoesNaoSalvas = 0 }: {
  produtoId: string;
  avisar: Avisar;
  /** Chamado depois de aplicar ou desfazer, para o editor trazer o preço sem perder o que não foi salvo. */
  aoAlterarPreco: () => void | Promise<void>;
  /** Quantos campos o vendedor editou e ainda não salvou no formulário. */
  alteracoesNaoSalvas?: number;
}) {
  const [meu, setMeu] = useState<MeuProdutoNoMercado | null>(null);
  const [mercado, setMercado] = useState<ProdutoDeMercado[] | null>(null);
  const [historico, setHistorico] = useState<LinhaDoHistorico[]>([]);
  const [calc, setCalc] = useState<DadosDaCalculadora | null>(null);
  const [escolhida, setEscolhida] = useState<OpcaoDePreco | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verSemelhantes, setVerSemelhantes] = useState(false);

  const recarregar = useCallback(async () => {
    const [m, h] = await Promise.all([carregarMeuProduto(produtoId), historicoDePreco(produtoId)]);
    setMeu(m);
    setHistorico(h);
  }, [produtoId]);

  useEffect(() => {
    recarregar();
    carregarMercadoPublico().then(setMercado);
    carregarCalculadora().then(setCalc).catch(() => setCalc(null));
  }, [recarregar]);

  const analise = useMemo(() => {
    if (!meu || !mercado || meu.produto.precoCents <= 0) return null;
    const comparacao = compararComMercado(meu.produto, mercado);
    return { comparacao, recomendacao: recomendarPreco(comparacao, meu.produto, meu.pisoCents) };
  }, [meu, mercado]);

  /** Líquido estimado por pacote no LiVRE Zero, cartão, sem frete. */
  function liquido(precoCents: number): { valor: number; completo: boolean } | null {
    if (!calc || !meu?.produto.gramaturaG) return null;
    const r = calcularPedido(calc.regras, { plataforma: 'coffeelivre', modalidade: 'zero' }, {
      precoCents, gramaturaG: meu.produto.gramaturaG, quantidade: 1, volumeMensal: 0, pisoCents: null, pagamento: 'cartao',
    }, calc.premissas);
    return ehErro(r) ? null : { valor: r.liquidoUnidadeCents, completo: r.completo };
  }

  function escolher(o: OpcaoDePreco) {
    setErro(null);
    if (o.chave === 'manter') {
      setEscolhida(null);
      avisar({ tipo: 'ok', texto: 'Preço mantido. Nada foi alterado.' });
      return;
    }
    setEscolhida(o);
  }

  async function confirmar() {
    if (!escolhida || !analise) return;
    setAplicando(true);
    setErro(null);
    try {
      const r = await aplicarPreco(
        produtoId, escolhida.precoCents, `${escolhida.rotulo} — ${analise.recomendacao.titulo}`,
        resumoDaRecomendacao(analise.comparacao, analise.recomendacao, escolhida.chave),
      );
      avisar({
        tipo: 'ok',
        texto: r.status === 'em_moderacao'
          ? `Preço alterado para ${brl(escolhida.precoCents)}. A queda foi grande e o produto voltou para moderação.`
          : `Preço alterado para ${brl(escolhida.precoCents)}.`,
      });
      setEscolhida(null);
      await recarregar();
      aoAlterarPreco();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aplicar o preço.');
    } finally {
      setAplicando(false);
    }
  }

  async function desfazer(h: LinhaDoHistorico) {
    try {
      await desfazerPreco(h.id);
      avisar({ tipo: 'ok', texto: `Alteração desfeita. O preço voltou para ${brl(h.precoAnteriorCents ?? 0)}.` });
      await recarregar();
      aoAlterarPreco();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível desfazer.' });
    }
  }

  if (!meu || !mercado) {
    return <section className="sc-cartao sc-mercado"><h2>Comparação de mercado</h2><p className="sc-sub">Carregando…</p></section>;
  }
  if (!analise) {
    return (
      <section className="sc-cartao sc-mercado">
        <h2>Comparação de mercado</h2>
        <p className="sc-sub">Informe o preço do produto para compará-lo com cafés equivalentes.</p>
      </section>
    );
  }

  const { comparacao: c, recomendacao: r } = analise;
  const e = c.estatisticas;
  const atual = meu.produto.precoCents;
  const piso = meu.pisoCents;
  const recomendada = r.opcoes.find(o => o.chave === 'recomendado');

  return (
    <section className="sc-cartao sc-mercado" aria-labelledby="sc-mercado-titulo">
      <div className="sc-mercado-topo">
        <div>
          <h2 id="sc-mercado-titulo">Comparação de mercado</h2>
          <p className="sc-sub">
            Cafés no ar com a mesma gramatura, classificação, espécie, torra e moagem
            {meu.produto.atributos.certificacoes?.includes('ABIC') ? ', e com ABIC' : ''}. Só dados públicos da vitrine.
          </p>
        </div>
      </div>

      <div className={`sc-mercado-rec ${r.tipo}`} data-campo="recomendacao">
        <small>LiVRE Copiloto</small>
        <b>{r.titulo}</b>
        <p>{r.explicacao}</p>
        {r.sugestaoCents != null && recomendada && !recomendada.abaixoDoPiso && (
          <button type="button" className="sc-botao sc-botao-principal" onClick={() => escolher(recomendada)}>
            Aplicar preço sugerido · {brl(r.sugestaoCents)}
          </button>
        )}
      </div>

      {e ? (
        <dl className="sc-metricas">
          <div><dt>Seu preço</dt><dd data-campo="seu-preco">{brl(atual)}</dd><small>{brl(e.seuKgCents)}/kg</small></div>
          <div><dt>Mediana</dt><dd data-campo="mediana">{brl(e.medianaPacoteCents)}</dd><small>{brl(e.medianaKgCents)}/kg</small></div>
          <div><dt>Menor equivalente</dt><dd>{brl(e.menorPacoteCents)}</dd><small>{brl(e.menorKgCents)}/kg</small></div>
          <div><dt>Maior equivalente</dt><dd>{brl(e.maiorPacoteCents)}</dd><small>{brl(e.maiorKgCents)}/kg</small></div>
          <div><dt>Distância da mediana</dt><dd data-campo="distancia">{pct(e.distanciaBps)}</dd><small>{POSICAO[e.posicao]}</small></div>
          <div><dt>Equivalentes</dt><dd>{e.quantidade}</dd><small>cafés na comparação direta</small></div>
          <div><dt>Seu piso</dt><dd data-campo="piso">{piso != null ? brl(piso) : 'Não definido'}</dd><small>{piso == null ? 'Defina no passo 5' : atual >= piso ? `preço atual ${brl(atual - piso)} acima do piso` : `preço atual ${brl(piso - atual)} abaixo do piso`}</small></div>
        </dl>
      ) : null}

      {r.opcoes.length > 0 && (
        <div className="sc-opcoes" role="group" aria-label="Opções de preço">
          {r.opcoes.map(o => {
            const igual = o.chave !== 'manter' && o.precoCents === atual;
            return (
              <button key={o.chave} type="button" disabled={o.abaixoDoPiso || igual}
                      className={escolhida?.chave === o.chave ? 'on' : ''}
                      title={o.abaixoDoPiso ? 'Abaixo do seu preço mínimo' : undefined}
                      onClick={() => escolher(o)}>
                <span>{o.rotulo}</span>
                <b>{brl(o.precoCents)}</b>
                {o.abaixoDoPiso && <small>abaixo do seu piso</small>}
              </button>
            );
          })}
        </div>
      )}

      {escolhida && (() => {
        const novo = escolhida.precoCents;
        const liqNovo = liquido(novo);
        const liqAtual = liquido(atual);
        const escada = meu.vendaPorQuantidade && meu.faixas.length
          ? montarEscada(novo, meu.faixas, { pisoCents: piso }).filter(d => d.quantidade > 1)
          : [];
        const furam = escada.filter(d => d.abaixoDoPiso);
        return (
          <div className="sc-confirmar" role="dialog" aria-label="Confirmar novo preço">
            <b>Confirmar novo preço</b>
            <dl className="sc-confirmar-grade">
              <div><dt>Novo preço</dt><dd data-campo="novo-preco">{brl(novo)}</dd></div>
              <div><dt>Hoje</dt><dd>{brl(atual)}</dd></div>
              <div>
                <dt>Líquido estimado por pacote</dt>
                <dd>{liqNovo ? `${liqNovo.completo ? '' : 'até '}${brl(liqNovo.valor)}` : '—'}</dd>
              </div>
              <div><dt>Distância do piso</dt><dd data-campo="distancia-piso">{piso != null ? brlSinal(novo - piso) : 'Sem piso definido'}</dd></div>
              <div>
                <dt>Impacto por pacote</dt>
                <dd>{brlSinal(novo - atual)} no preço{liqNovo && liqAtual ? ` · ${brlSinal(liqNovo.valor - liqAtual.valor)} no líquido` : ''}</dd>
              </div>
            </dl>
            <p className="sc-sub">Líquido estimado no LiVRE Zero, pagamento no cartão, sem frete. Valores ilustrativos da fase de apresentação.</p>
            {alteracoesNaoSalvas > 0 && (
              <p className="sc-sub" data-campo="aviso-nao-salvo">
                Você tem {alteracoesNaoSalvas === 1 ? '1 alteração' : `${alteracoesNaoSalvas} alterações`} não salva{alteracoesNaoSalvas === 1 ? '' : 's'} no formulário.
                Aplicar este preço grava só o preço; o resto continua na tela para você salvar.
              </p>
            )}
            {escada.length > 0 && (
              <div className="sc-confirmar-escada">
                <small>Sua escada de quantidade com o novo preço</small>
                <ul>
                  {escada.map(d => (
                    <li key={d.quantidade} className={d.abaixoDoPiso ? 'abaixo' : ''}>
                      {d.quantidade} unidades: {brl(d.unitario_cents)} cada{d.abaixoDoPiso ? ' · abaixo do seu piso' : ''}
                    </li>
                  ))}
                </ul>
                {furam.length > 0 && (
                  <p className="sc-erro" data-campo="escada-alerta">
                    Com este preço, a faixa de {furam.map(d => d.quantidade).join(', ')} unidades fica abaixo do seu piso.
                    O preço de 1 unidade respeita o piso; revise as faixas no passo 5 se quiser.
                  </p>
                )}
              </div>
            )}
            {erro && <p className="sc-erro" role="alert">{erro}</p>}
            <div className="sc-rodape-editor">
              <button type="button" className="sc-botao" onClick={() => setEscolhida(null)} disabled={aplicando}>Cancelar</button>
              <span className="sc-espaco" />
              <button type="button" className="sc-botao sc-botao-principal" onClick={confirmar} disabled={aplicando}>
                {aplicando ? 'Aplicando…' : 'Confirmar e aplicar'}
              </button>
            </div>
          </div>
        );
      })()}

      {c.diretos.length > 0 && (
        <div className="sc-equivalentes">
          <small className="sc-rotulo">Comparação direta</small>
          <ul>
            {c.diretos.map(d => (
              <li key={d.produto.id}>
                <span><b>{d.produto.titulo}</b><small>{d.produto.lojaNome}</small></span>
                <span className="valores"><b>{brl(d.produto.precoCents)}</b><small>{brl(d.precoKgCents)}/kg</small></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.semelhantes.length > 0 && (
        <div className="sc-equivalentes">
          <button type="button" className="sc-link" aria-expanded={verSemelhantes} onClick={() => setVerSemelhantes(v => !v)}>
            {verSemelhantes ? 'Esconder' : 'Ver'} produtos semelhantes ({c.semelhantes.length}) — fora da mediana
          </button>
          {verSemelhantes && (
            <ul>
              {c.semelhantes.map(d => (
                <li key={d.produto.id} className="semelhante">
                  <span>
                    <b>{d.produto.titulo}</b>
                    <small>{d.produto.lojaNome} · difere em {d.diferencas.map(x => x.replace(/^(\w+)/, m => ROTULO_DO_ATRIBUTO[m] ?? m)).join(', ')}</small>
                  </span>
                  <span className="valores"><b>{brl(d.produto.precoCents)}</b><small>{brl(d.precoKgCents)}/kg</small></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="sc-historico" data-campo="historico">
        <small className="sc-rotulo">Histórico de preço</small>
        {historico.length === 0 ? (
          <p className="sc-sub">Nenhuma alteração de preço registrada ainda.</p>
        ) : (
          <ul>
            {historico.map((h, i) => {
              const podeDesfazer = i === 0 && !h.desfeitoEm && h.origem !== 'desfazer' && h.precoAnteriorCents != null;
              return (
                <li key={h.id}>
                  <span>
                    <b>{h.precoAnteriorCents != null ? `${brl(h.precoAnteriorCents)} → ` : ''}{brl(h.precoNovoCents)}</b>
                    <small>{ORIGEM[h.origem] ?? h.origem} · {quando(h.criadoEm)}{h.desfeitoEm ? ' · desfeita' : ''}</small>
                    {h.motivo && <small>{h.motivo}</small>}
                  </span>
                  {podeDesfazer && (
                    <button type="button" className="sc-botao" onClick={() => desfazer(h)}>Desfazer</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
