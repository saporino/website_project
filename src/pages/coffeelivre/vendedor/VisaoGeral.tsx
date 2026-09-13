// Seller Central — visão geral.
//
// A primeira tela responde quatro perguntas, nessa ordem: quanto vendi,
// quantos produtos tenho, quanto tenho em estoque, e o que precisa da
// minha atenção. Tudo o que não responde a uma delas fica fora daqui.
//
// O LiVRE Copiloto não só aponta: quando a recomendação é um preço, o
// botão aplica — com confirmação, dentro do piso, registrado no histórico.
import { useCallback, useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { recomendacoes, type Recomendacao, type SinalDeMercado } from '../copiloto';
import { listarProdutosDoVendedor, RECEBIMENTO, type CategoriaDoCadastro, type LinhaDeProduto } from './dados';
import { aplicarPreco, recomendacoesDeMercado, resumoDaRecomendacao, type RecomendacaoDeMercadoDoProduto } from './mercado';
import type { ContextoDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';

const brl = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VisaoGeral({ contexto, categorias, avisar }: {
  contexto: ContextoDoVendedor;
  categorias: CategoriaDoCadastro[];
  avisar: Avisar;
}) {
  const [produtos, setProdutos] = useState<LinhaDeProduto[] | null>(null);
  const [mercado, setMercado] = useState<RecomendacaoDeMercadoDoProduto[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const carregar = useCallback(async () => {
    if (!categorias.length) return;
    setProdutos(await listarProdutosDoVendedor(contexto.sellerId, categorias));
    // A comparação é complemento: se falhar, o resto da visão geral fica.
    recomendacoesDeMercado(contexto.sellerId).then(setMercado).catch(() => setMercado([]));
  }, [contexto.sellerId, categorias]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!produtos) return <div className="sc-cartao">Carregando…</div>;

  const publicados = produtos.filter(p => p.status === 'ativo').length;
  const emModeracao = produtos.filter(p => p.status === 'em_moderacao').length;
  const unidades = produtos.reduce((s, p) => s + p.estoque, 0);
  const lojaAtiva = !!contexto.loja?.ativa;
  const sinais: SinalDeMercado[] = mercado.map(m => ({
    produtoId: m.produtoId,
    titulo: m.titulo,
    tipo: m.recomendacao.tipo,
    tituloDaRecomendacao: m.recomendacao.titulo,
    explicacao: m.recomendacao.explicacao,
    sugestaoCents: m.recomendacao.sugestaoCents,
  }));
  const dicas: Recomendacao[] = recomendacoes({ lojaAtiva, produtos, mercado: sinais });
  const recebimento = RECEBIMENTO[contexto.pagamentoStatus] ?? RECEBIMENTO.nao_iniciado;

  async function aplicar(d: Recomendacao) {
    if (!d.aplicarPreco) return;
    const m = mercado.find(x => x.produtoId === d.aplicarPreco!.produtoId);
    if (!m) return;
    setAplicando(true);
    try {
      const r = await aplicarPreco(
        d.aplicarPreco.produtoId, d.aplicarPreco.precoCents,
        `Preço recomendado pelo LiVRE — ${m.recomendacao.titulo}`,
        resumoDaRecomendacao(m.comparacao, m.recomendacao, 'recomendado'),
      );
      avisar({
        tipo: 'ok',
        texto: r.status === 'em_moderacao'
          ? `Preço alterado para ${brl(d.aplicarPreco.precoCents)}. O produto voltou para moderação.`
          : `Preço de ${m.titulo.split(' — ')[0]} alterado para ${brl(d.aplicarPreco.precoCents)}.`,
      });
      setConfirmando(null);
      await carregar();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível aplicar o preço.' });
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="sc-pilha">
      <div className="sc-titulo">
        <h1>Olá, {contexto.loja?.nome ?? contexto.sellerNome}</h1>
        <p className="sc-sub">
          {lojaAtiva ? 'Sua loja está no ar.' : 'Sua loja aguarda aprovação da equipe.'}
        </p>
      </div>

      <section className="sc-numeros">
        <div className="sc-numero">
          <small>Vendas</small>
          <b>R$ 0,00</b>
          {/* Honesto: não há pedido nesta fase. Zero de verdade vale mais,
              diante de investidor, que número inventado. */}
          <span>Os pedidos entram quando o checkout existir</span>
        </div>
        <div className="sc-numero">
          <small>Produtos</small>
          <b>{produtos.length}</b>
          <span>{publicados} publicado{publicados === 1 ? '' : 's'}{emModeracao ? ` · ${emModeracao} em moderação` : ''}</span>
        </div>
        <div className="sc-numero">
          <small>Estoque no CD</small>
          <b>{unidades.toLocaleString('pt-BR')}</b>
          <span>unidade{unidades === 1 ? '' : 's'} disponíve{unidades === 1 ? 'l' : 'is'}</span>
        </div>
        <div className={`sc-numero${dicas.length ? ' atencao' : ''}`}>
          <small>Precisa de atenção</small>
          <b>{dicas.length}</b>
          <span>{dicas.length ? 'veja o Copiloto abaixo' : 'tudo em ordem'}</span>
        </div>
      </section>

      <section className="sc-cartao sc-recebimento">
        <div>
          <b>Recebimento de vendas</b>
          <p className="sc-sub">
            {contexto.pagamentoStatus === 'verificado'
              ? 'Sua loja está habilitada para receber o valor das vendas.'
              : 'Antes das vendas reais, sua loja precisa estar habilitada para receber. Nesta fase de demonstração não há cobrança nem pagamento.'}
          </p>
        </div>
        <span className={`sc-situacao ${recebimento.classe}`}>{recebimento.rotulo}</span>
      </section>

      <section className="sc-cartao sc-copiloto">
        <div className="sc-copiloto-topo">
          <h2>LiVRE Copiloto</h2>
          <span className="sc-sub">O que fazer agora, em ordem de importância</span>
        </div>
        {dicas.length === 0 ? (
          <p className="sc-copiloto-vazio">
            Nada pedindo sua atenção. Seus produtos estão publicados, com Passport completo e desconto por quantidade.
          </p>
        ) : (
          <ul className="sc-dicas">
            {dicas.map(d => (
              <li key={d.tipo} className="sc-dica" data-tipo={d.tipo}>
                <div>
                  <b>{d.titulo}</b>
                  <p>{d.explicacao}</p>
                </div>
                <div className="sc-dica-aplicar">
                  {d.aplicarPreco && (confirmando === d.aplicarPreco.produtoId ? (
                    <>
                      <button type="button" className="sc-botao sc-botao-principal" disabled={aplicando} onClick={() => aplicar(d)}>
                        {aplicando ? 'Aplicando…' : `Confirmar ${brl(d.aplicarPreco.precoCents)}`}
                      </button>
                      <button type="button" className="sc-botao" disabled={aplicando} onClick={() => setConfirmando(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="sc-botao sc-botao-principal" onClick={() => setConfirmando(d.aplicarPreco!.produtoId)}>
                      Aplicar {brl(d.aplicarPreco.precoCents)}
                    </button>
                  ))}
                  <a
                    href={rota(d.acao.caminho)}
                    className="sc-botao"
                    onClick={e => { e.preventDefault(); navegar(d.acao.caminho); }}
                  >
                    {d.acao.rotulo}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sc-atalhos">
        <a href={rota('vendedor/produtos/novo')} className="sc-botao sc-botao-principal"
           onClick={e => { e.preventDefault(); navegar('vendedor/produtos/novo'); }}>
          Cadastrar café
        </a>
        <a href={rota('vendedor/produtos')} className="sc-botao"
           onClick={e => { e.preventDefault(); navegar('vendedor/produtos'); }}>
          Ver meus produtos
        </a>
      </section>
    </div>
  );
}
