// Seller Central — a casa do vendedor dentro do Coffee LiVRE.
//
// Tem cabeçalho próprio de propósito: o vendedor está TRABALHANDO, não
// comprando. O cabeçalho da loja, com busca, carrinho e categorias, seria
// ruído aqui. A ponte para a vitrine continua a um clique, em "Ver loja".
//
// Pedidos e Financeiro aparecem na navegação como "em breve", sem tela
// vazia por trás: esconder daria a impressão de que não estão no plano;
// abrir uma tela vazia daria a impressão de defeito.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { MARCA, navegar, rota } from '../config';
import { carregarContexto, sair, type Contexto } from './sessao';
import { carregarCategorias, type CategoriaDoCadastro } from './dados';
import Entrar from './Entrar';
import VisaoGeral from './VisaoGeral';
import ProdutosDoVendedor from './ProdutosDoVendedor';
import EditorDeProduto from './EditorDeProduto';
import EstoqueDoVendedor from './EstoqueDoVendedor';
import MinhaLoja from './MinhaLoja';
import './vendedor.css';

export interface Aviso { tipo: 'ok' | 'erro'; texto: string }
export type Avisar = (a: Aviso) => void;

const MENU: { chave: string; rotulo: string; caminho: string | null }[] = [
  { chave: '', rotulo: 'Visão geral', caminho: 'vendedor' },
  { chave: 'produtos', rotulo: 'Produtos', caminho: 'vendedor/produtos' },
  { chave: 'estoque', rotulo: 'Estoque', caminho: 'vendedor/estoque' },
  { chave: 'loja', rotulo: 'Minha loja', caminho: 'vendedor/loja' },
  { chave: 'pedidos', rotulo: 'Pedidos', caminho: null },
  { chave: 'financeiro', rotulo: 'Financeiro', caminho: null },
];

export default function SellerCentral({ subrota }: { subrota: string }) {
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDoCadastro[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const recarregar = useCallback(async () => {
    setContexto(await carregarContexto());
  }, []);

  useEffect(() => {
    recarregar();
    carregarCategorias().then(setCategorias);
    // Entrar e sair mudam a sessão; a tela acompanha sem recarregar a página.
    const { data } = supabase.auth.onAuthStateChange(() => { recarregar(); });
    return () => data.subscription.unsubscribe();
  }, [recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const partes = subrota.split('/').filter(Boolean);
  const pagina = partes[0] ?? '';

  if (!contexto) {
    return <div className="sc-carregando">Carregando…</div>;
  }

  if (contexto.tipo === 'anonimo') {
    return <Entrar />;
  }

  if (contexto.tipo === 'sem_vinculo') {
    return (
      <div className="sc-entrar">
        <div className="sc-entrar-caixa">
          <img src={MARCA.logo} alt={MARCA.titulo} className="sc-entrar-logo" />
          <h1>Esta conta não está ligada a uma loja</h1>
          <p>
            Você entrou como <b>{contexto.email}</b>, mas esse usuário ainda não foi vinculado a
            nenhum vendedor do Coffee LiVRE. Se você vende conosco, peça o vínculo à equipe.
          </p>
          <div className="sc-entrar-acoes">
            <button type="button" className="sc-botao" onClick={() => sair()}>Sair</button>
            <a href={rota('vender')} onClick={e => { e.preventDefault(); navegar('vender'); }}>Quero vender</a>
          </div>
        </div>
      </div>
    );
  }

  const ctx = contexto.contexto;
  const avisar: Avisar = a => setAviso(a);

  let conteudo: React.ReactNode;
  if (!ctx.loja) {
    conteudo = (
      <div className="sc-cartao">
        <h2>Sua loja ainda não foi criada</h2>
        <p className="sc-sub">A loja nasce quando a equipe aprova o seu cadastro. Assim que isso acontecer, ela aparece aqui.</p>
      </div>
    );
  } else if (pagina === '') {
    conteudo = <VisaoGeral contexto={ctx} categorias={categorias} />;
  } else if (pagina === 'produtos' && !partes[1]) {
    conteudo = <ProdutosDoVendedor contexto={ctx} categorias={categorias} avisar={avisar} />;
  } else if (pagina === 'produtos') {
    const id = partes[1] === 'novo' ? null : partes[1];
    conteudo = (
      <EditorDeProduto
        key={partes[1]}
        produtoId={id}
        loja={ctx.loja}
        categorias={categorias}
        avisar={avisar}
      />
    );
  } else if (pagina === 'estoque') {
    conteudo = <EstoqueDoVendedor contexto={ctx} />;
  } else if (pagina === 'loja') {
    conteudo = <MinhaLoja loja={ctx.loja} avisar={avisar} aoSalvar={recarregar} />;
  } else {
    conteudo = (
      <div className="sc-cartao">
        <h2>Página não encontrada</h2>
        <p className="sc-sub">Esse endereço não existe no Seller Central.</p>
      </div>
    );
  }

  return (
    <div className="sc">
      <header className="sc-topo">
        <div className="sc-topo-dentro">
          <a href={rota('vendedor')} className="sc-marca" onClick={e => { e.preventDefault(); navegar('vendedor'); }}>
            <img src={MARCA.logo} alt={MARCA.titulo} />
            <span>Seller Central</span>
          </a>
          <div className="sc-topo-direita">
            <span className="sc-quem">{ctx.loja?.nome ?? ctx.sellerNome}</span>
            {ctx.loja?.ativa && (
              <a href={rota(`loja/${ctx.loja.slug}`)} onClick={e => { e.preventDefault(); navegar(`loja/${ctx.loja!.slug}`); }}>
                Ver loja
              </a>
            )}
            <button type="button" onClick={() => sair()}>Sair</button>
          </div>
        </div>
        <nav className="sc-menu" aria-label="Seller Central">
          {MENU.map(m => m.caminho ? (
            <a
              key={m.chave}
              href={rota(m.caminho)}
              className={pagina === m.chave ? 'on' : ''}
              onClick={e => { e.preventDefault(); navegar(m.caminho!); }}
            >
              {m.rotulo}
            </a>
          ) : (
            <span key={m.chave} className="sc-menu-breve" title="Entra quando o checkout e os pedidos existirem">
              {m.rotulo} <small>em breve</small>
            </span>
          ))}
        </nav>
      </header>

      {ctx.loja?.is_demo && (
        <div className="sc-faixa-demo">Loja de demonstração · dados fictícios</div>
      )}

      {aviso && (
        <div className={`sc-aviso ${aviso.tipo}`} role="status">
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar">✕</button>
        </div>
      )}

      <main className="sc-conteudo">{conteudo}</main>
    </div>
  );
}
