// Seller Central — visão geral.
//
// A primeira tela responde quatro perguntas, nessa ordem: quanto vendi,
// quantos produtos tenho, quanto tenho em estoque, e o que precisa da
// minha atenção. Tudo o que não responde a uma delas fica fora daqui.
import { useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { recomendacoes, type Recomendacao } from '../copiloto';
import { listarProdutosDoVendedor, type CategoriaDoCadastro, type LinhaDeProduto } from './dados';
import type { ContextoDoVendedor } from './sessao';

export default function VisaoGeral({ contexto, categorias }: {
  contexto: ContextoDoVendedor;
  categorias: CategoriaDoCadastro[];
}) {
  const [produtos, setProdutos] = useState<LinhaDeProduto[] | null>(null);

  useEffect(() => {
    if (!categorias.length) return;
    listarProdutosDoVendedor(contexto.sellerId, categorias).then(setProdutos);
  }, [contexto.sellerId, categorias]);

  if (!produtos) return <div className="sc-cartao">Carregando…</div>;

  const publicados = produtos.filter(p => p.status === 'ativo').length;
  const emModeracao = produtos.filter(p => p.status === 'em_moderacao').length;
  const unidades = produtos.reduce((s, p) => s + p.estoque, 0);
  const lojaAtiva = !!contexto.loja?.ativa;
  const dicas: Recomendacao[] = recomendacoes({ lojaAtiva, produtos });

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
              <li key={d.tipo} className="sc-dica">
                <div>
                  <b>{d.titulo}</b>
                  <p>{d.explicacao}</p>
                </div>
                <a
                  href={rota(d.acao.caminho)}
                  className="sc-botao"
                  onClick={e => { e.preventDefault(); navegar(d.acao.caminho); }}
                >
                  {d.acao.rotulo}
                </a>
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
