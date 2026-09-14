// Coffee LiVRE — Meus pedidos (área do comprador, primeira versão).
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { navegar, rota } from '../config';
import { reais } from '../visual';
import EntrarComprador from '../checkout/EntrarComprador';
import { meusPedidos, type ResumoDoPedido } from '../checkout/dados';
import { ROTULO_DO_PEDIDO } from '../checkout/estados';
import { dataHora } from '../checkout/eventos';
import '../checkout/checkout.css';
import './pedidos.css';

export default function MeusPedidos() {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<ResumoDoPedido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.auth.getUser();
    setLogado(!!data.user);
    if (!data.user) return;
    try { setPedidos(await meusPedidos()); } catch (e) { setErro(e instanceof Error ? e.message : 'Falhou.'); }
  }

  useEffect(() => { carregar(); window.scrollTo(0, 0); }, []);

  return (
    <main className="wrap ck pd">
      <h1>Meus pedidos</h1>
      {erro && <p className="ck-erro" role="alert">{erro}</p>}
      {logado === null && <p className="ck-sub">Carregando…</p>}
      {logado === false && <EntrarComprador titulo="Entre para ver seus pedidos" aoEntrar={carregar} />}
      {logado && pedidos && pedidos.length === 0 && (
        <div className="ck-bloco">
          <p>Você ainda não fez nenhum pedido.</p>
          <a className="ck-botao principal" href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Escolher cafés</a>
        </div>
      )}
      {logado && pedidos && pedidos.length > 0 && (
        <ul className="pd-lista">
          {pedidos.map(p => {
            const unidades = p.lv_order_items.reduce((s, i) => s + i.quantidade, 0);
            const lojas = [...new Set(p.lv_seller_orders.map(s => s.loja_nome))];
            return (
              <li key={p.id}>
                <a className="pd-cartao" href={rota(`conta/pedidos/${p.numero}`)} data-pedido={p.numero}
                   onClick={e => { e.preventDefault(); navegar(`conta/pedidos/${p.numero}`); }}>
                  <span className="pd-cartao-topo">
                    <b>{p.numero}</b>
                    <em className={`pd-status s-${p.status}`}>{ROTULO_DO_PEDIDO[p.status] ?? p.status}</em>
                  </span>
                  <small>{dataHora(p.created_at)} · {unidades} {unidades === 1 ? 'pacote' : 'pacotes'} · {lojas.join(', ')}</small>
                  <b className="pd-total">R$ {reais(p.total_cents)}</b>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
