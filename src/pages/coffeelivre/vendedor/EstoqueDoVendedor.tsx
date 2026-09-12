// Seller Central — estoque no CD.
//
// O vendedor LÊ. Estoque no CD é o que a operação recebeu e conferiu
// (seção 5.9 do RAIO-X); deixar o vendedor digitar o próprio estoque seria
// deixar ele vender o que não entregou. O banco garante isso: não existe
// policy de escrita para o vendedor nesta tabela.
//
// Mostra o que o modelo tem hoje e nada além. Data de torra, idade do
// estoque, giro e FEFO dependem do recebimento no CD, que ainda não existe.
import { useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { listarEstoque, SITUACAO, type LinhaDeEstoque } from './dados';
import type { ContextoDoVendedor } from './sessao';

const data = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export default function EstoqueDoVendedor({ contexto }: { contexto: ContextoDoVendedor }) {
  const [linhas, setLinhas] = useState<LinhaDeEstoque[] | null>(null);

  useEffect(() => { listarEstoque(contexto.sellerId).then(setLinhas); }, [contexto.sellerId]);

  const total = (linhas ?? []).reduce((s, l) => s + l.disponivel, 0);

  return (
    <div className="sc-pilha">
      <div className="sc-titulo">
        <h1>Estoque no CD</h1>
        <p className="sc-sub">
          O que foi recebido e conferido no centro de distribuição. {linhas ? `${total.toLocaleString('pt-BR')} unidades disponíveis.` : ''}
        </p>
      </div>

      {!linhas ? (
        <div className="sc-cartao">Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="sc-cartao sc-vazio">
          <b>Nenhum lote no CD</b>
          <p className="sc-sub">
            O estoque aparece aqui depois que suas caixas forem recebidas e conferidas pela operação.
          </p>
        </div>
      ) : (
        <div className="sc-cartao sc-lista estoque">
          <div className="sc-lista-cabeca" aria-hidden="true">
            <span>Produto</span><span>Lote</span><span>Validade</span><span>Entrada</span><span>Disponível</span><span>Situação</span>
          </div>
          {linhas.map(l => {
            const s = SITUACAO[l.produtoStatus] ?? SITUACAO.rascunho;
            return (
              <div key={l.id} className="sc-linha">
                <div className="sc-linha-produto">
                  <a href={rota(`vendedor/produtos/${l.produtoId}`)} onClick={e => { e.preventDefault(); navegar(`vendedor/produtos/${l.produtoId}`); }}>
                    {l.produtoTitulo}
                  </a>
                  {l.sku && <small>{l.sku}</small>}
                </div>
                <div className="sc-linha-dado" data-rotulo="Lote">{l.lote ?? '—'}</div>
                <div className="sc-linha-dado" data-rotulo="Validade">{data(l.validade)}</div>
                <div className="sc-linha-dado" data-rotulo="Entrada">{data(l.entradaEm)}</div>
                <div className="sc-linha-dado" data-rotulo="Disponível">
                  <b>{l.disponivel.toLocaleString('pt-BR')}</b>
                  {l.reservado > 0 && <small> · {l.reservado} reservadas</small>}
                </div>
                <div className="sc-linha-dado" data-rotulo="Situação"><span className={`sc-situacao ${s.classe}`}>{s.rotulo}</span></div>
              </div>
            );
          })}
        </div>
      )}

      <p className="sc-ajuda">
        Data de torra, idade do estoque, previsão de giro e alerta de vencimento entram quando o recebimento no CD estiver
        em operação.
      </p>
    </div>
  );
}
