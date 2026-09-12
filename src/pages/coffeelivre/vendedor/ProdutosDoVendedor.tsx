// Seller Central — lista de produtos.
//
// Linha no desktop, cartão no celular: tabela de seis colunas em 375 px é
// ilegível, e o vendedor vai usar isto do telefone.
import { useCallback, useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { reais } from '../visual';
import {
  listarProdutosDoVendedor, publicarProduto, SITUACAO,
  type CategoriaDoCadastro, type LinhaDeProduto,
} from './dados';
import type { ContextoDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';

export function mensagemDePublicacao(status: string, lojaAtiva: boolean): string {
  if (status === 'em_moderacao') return 'Enviado para moderação. A equipe revisa e publica.';
  if (status === 'ativo') return lojaAtiva ? 'Publicado. Já aparece na vitrine.' : 'Publicado. Aparece na vitrine quando sua loja for aprovada.';
  if (status === 'pausado') return 'Despublicado. Continua salvo, fora da vitrine.';
  return 'Situação atualizada.';
}

export default function ProdutosDoVendedor({ contexto, categorias, avisar }: {
  contexto: ContextoDoVendedor;
  categorias: CategoriaDoCadastro[];
  avisar: Avisar;
}) {
  const [produtos, setProdutos] = useState<LinhaDeProduto[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!categorias.length) return;
    setProdutos(await listarProdutosDoVendedor(contexto.sellerId, categorias));
  }, [contexto.sellerId, categorias]);

  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(p: LinhaDeProduto) {
    setOcupado(p.id);
    try {
      const status = await publicarProduto(p.id, p.status !== 'ativo');
      avisar({ tipo: 'ok', texto: mensagemDePublicacao(status, !!contexto.loja?.ativa) });
      await carregar();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível alterar.' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="sc-pilha">
      <div className="sc-titulo sc-titulo-com-acao">
        <div>
          <h1>Produtos</h1>
          <p className="sc-sub">Tudo o que sua loja vende, do rascunho ao publicado.</p>
        </div>
        <a href={rota('vendedor/produtos/novo')} className="sc-botao sc-botao-principal"
           onClick={e => { e.preventDefault(); navegar('vendedor/produtos/novo'); }}>
          Cadastrar café
        </a>
      </div>

      {!produtos ? (
        <div className="sc-cartao">Carregando…</div>
      ) : produtos.length === 0 ? (
        <div className="sc-cartao sc-vazio">
          <b>Nenhum produto ainda</b>
          <p className="sc-sub">O cadastro é guiado e leva poucos minutos.</p>
          <a href={rota('vendedor/produtos/novo')} className="sc-botao sc-botao-principal"
             onClick={e => { e.preventDefault(); navegar('vendedor/produtos/novo'); }}>
            Cadastrar o primeiro café
          </a>
        </div>
      ) : (
        <div className="sc-cartao sc-lista">
          <div className="sc-lista-cabeca" aria-hidden="true">
            <span>Produto</span><span>Preço</span><span>Estoque</span><span>Situação</span><span>Passport</span><span />
          </div>
          {produtos.map(p => {
            const s = SITUACAO[p.status] ?? SITUACAO.rascunho;
            const podeAlternar = !['recusado', 'arquivado', 'em_moderacao'].includes(p.status);
            return (
              <div key={p.id} className="sc-linha">
                <div className="sc-linha-produto">
                  <a href={rota(`vendedor/produtos/${p.id}`)} onClick={e => { e.preventDefault(); navegar(`vendedor/produtos/${p.id}`); }}>
                    {p.titulo}
                  </a>
                  <small>{p.categoriaNome}{p.sku ? ` · ${p.sku}` : ''}</small>
                </div>
                <div className="sc-linha-dado" data-rotulo="Preço">{p.precoCents ? `R$ ${reais(p.precoCents)}` : '—'}</div>
                <div className="sc-linha-dado" data-rotulo="Estoque">{p.estoque.toLocaleString('pt-BR')} un.</div>
                <div className="sc-linha-dado" data-rotulo="Situação"><span className={`sc-situacao ${s.classe}`}>{s.rotulo}</span></div>
                <div className="sc-linha-dado" data-rotulo="Passport">
                  {p.completude === null ? (
                    <small className="sc-sub">Não se aplica</small>
                  ) : (
                    <span className="sc-medidor" title={`${p.completude}% completo`}>
                      <i style={{ width: `${p.completude}%` }} />
                      <em>{p.completude}%</em>
                    </span>
                  )}
                </div>
                <div className="sc-linha-acoes">
                  <a href={rota(`vendedor/produtos/${p.id}`)} onClick={e => { e.preventDefault(); navegar(`vendedor/produtos/${p.id}`); }}>
                    Editar
                  </a>
                  {p.status === 'ativo' && contexto.loja?.ativa && (
                    <a href={rota(`cafe/${p.slug}`)} onClick={e => { e.preventDefault(); navegar(`cafe/${p.slug}`); }}>
                      Ver na loja
                    </a>
                  )}
                  {podeAlternar && (
                    <button type="button" disabled={ocupado === p.id} onClick={() => alternar(p)}>
                      {p.status === 'ativo' ? 'Despublicar' : 'Publicar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
