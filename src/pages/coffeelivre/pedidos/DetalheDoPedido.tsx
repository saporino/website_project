// Coffee LiVRE — um pedido do comprador: itens por loja, status, entrega, pagamento e histórico.
import { useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { reais } from '../visual';
import { cancelarPedido, pedidoDoComprador, type PedidoDoComprador } from '../checkout/dados';
import { ROTULO_DO_PAGAMENTO, ROTULO_DO_PEDIDO, ROTULO_DO_SUBPEDIDO } from '../checkout/estados';
import { dataHora, rotuloDaOrigem, rotuloDoEvento } from '../checkout/eventos';
import PainelDePagamento from '../pagamento/PainelDePagamento';
import { formatarCep } from '../checkout/validacao';
import '../checkout/checkout.css';
import './pedidos.css';

const R = (c: number) => `R$ ${reais(c)}`;

export default function DetalheDoPedido({ numero }: { numero: string }) {
  const [pedido, setPedido] = useState<PedidoDoComprador | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    try { setPedido(await pedidoDoComprador(numero)); } catch (e) { setErro(e instanceof Error ? e.message : 'Falhou.'); setPedido(null); }
  }
  useEffect(() => { carregar(); window.scrollTo(0, 0); }, [numero]);

  async function cancelar() {
    if (!pedido) return;
    setOcupado(true); setErro(null);
    try { await cancelarPedido(pedido.id, motivo.trim()); setCancelando(false); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível cancelar.'); }
    finally { setOcupado(false); }
  }

  const voltar = <a className="ck-link" href={rota('conta/pedidos')} onClick={e => { e.preventDefault(); navegar('conta/pedidos'); }}>← Meus pedidos</a>;

  if (pedido === undefined) return <main className="wrap ck pd"><p className="ck-sub">Carregando…</p></main>;
  if (pedido === null) {
    return (
      <main className="wrap ck pd">
        {voltar}
        <div className="ck-bloco"><h1>Pedido não encontrado</h1><p className="ck-sub">Confira o número ou entre com a conta que fez a compra.</p></div>
        {erro && <p className="ck-erro">{erro}</p>}
      </main>
    );
  }

  const e = pedido.lv_order_addresses;
  return (
    <main className="wrap ck pd">
      {voltar}
      <header className="pd-cabeca">
        <h1>Pedido {pedido.numero}</h1>
        <em className={`pd-status s-${pedido.status}`} data-campo="status-pedido">{ROTULO_DO_PEDIDO[pedido.status] ?? pedido.status}</em>
      </header>
      <p className="ck-sub">Feito em {dataHora(pedido.created_at)} · Pagamento: {ROTULO_DO_PAGAMENTO[pedido.pagamento_status] ?? pedido.pagamento_status} ({pedido.pagamento_metodo === 'pix' ? 'Pix' : 'Cartão'}, simulado)</p>
      {erro && <p className="ck-erro" role="alert">{erro}</p>}

      <div className="ck-grade">
        <section className="ck-principal">
          {pedido.lv_seller_orders.map(s => (
            <div className="ck-bloco pd-loja" key={s.id} data-subpedido={s.numero}>
              <div className="pd-cartao-topo">
                <h2>{s.loja_nome}</h2>
                <em className={`pd-status s-${s.status}`}>{ROTULO_DO_SUBPEDIDO[s.status] ?? s.status}</em>
              </div>
              <small className="ck-sub">Subpedido {s.numero}</small>
              {s.lv_order_items.map(i => (
                <div className="ck-item" key={i.id}>
                  <span>{i.quantidade} × {i.titulo}{i.variante_nome ? ` · ${i.variante_nome}` : ''}</span>
                  <span>{R(i.unitario_cents)} cada{i.desconto_cents > 0 ? ` (escada −${R(i.desconto_cents)})` : ''}</span>
                  <b>{R(i.total_cents)}</b>
                </div>
              ))}
              {s.lv_shipments.map((x, k) => (
                <div className="ck-linha" key={k}>
                  <span>Entrega: {x.servico} · {x.transportadora}{x.prazo_dias ? ` · até ${x.prazo_dias} dias úteis` : ''}{x.codigo_rastreio ? ` · rastreio ${x.codigo_rastreio}` : ''}</span>
                  <b>{R(s.frete_cents)}</b>
                </div>
              ))}
              <div className="ck-linha forte"><span>Total desta loja</span><b>{R(s.total_cents)}</b></div>
            </div>
          ))}

          <div className="ck-bloco">
            <h2>Histórico</h2>
            <ol className="pd-historico">
              {pedido.lv_order_events.map((ev, k) => (
                <li key={k}><b>{rotuloDoEvento(ev.tipo)}</b><small>{dataHora(ev.created_at)} · {rotuloDaOrigem(ev.origem)}</small></li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="ck-resumo">
          <h2>Resumo</h2>
          <div className="ck-linha"><span>Produtos</span><b>{R(pedido.subtotal_produtos_cents)}</b></div>
          {pedido.desconto_produtos_cents > 0 && <div className="ck-linha economia"><span>Descontos da escada</span><b>− {R(pedido.desconto_produtos_cents)}</b></div>}
          <div className="ck-linha"><span>Frete</span><b>{R(pedido.frete_cents)}</b></div>
          <div className="ck-linha total" data-campo="total-pedido"><span>Total</span><b>{R(pedido.total_cents)}</b></div>
          {e && (
            <>
              <h3>Entregar para</h3>
              <p className="ck-sub">{e.destinatario}<br />{e.logradouro}, {e.numero}{e.complemento ? ` — ${e.complemento}` : ''}<br />{e.bairro} · {e.cidade}/{e.uf} · CEP {formatarCep(e.cep)}</p>
            </>
          )}
          {pedido.status === 'aguardando_pagamento' && (
            <PainelDePagamento
              orderId={pedido.id}
              metodoInicial={pedido.pagamento_metodo === 'cartao' ? 'cartao' : 'pix'}
              valorTotalCents={pedido.total_cents}
              aoMudarStatus={s => { if (s !== pedido.status) carregar(); }}
            />
          )}
          {pedido.status === 'aguardando_pagamento' && !cancelando && (
            <button type="button" className="ck-link" onClick={() => setCancelando(true)}>Cancelar pedido</button>
          )}
          {cancelando && (
            <div className="pd-cancelar">
              <label className="ck-campo"><span>Motivo do cancelamento</span>
                <input value={motivo} onChange={ev => setMotivo(ev.target.value)} />
              </label>
              <div className="ck-acoes">
                <button type="button" className="ck-botao" onClick={() => setCancelando(false)}>Voltar</button>
                <button type="button" className="ck-botao principal" onClick={cancelar} disabled={ocupado || motivo.trim().length < 3}>Confirmar cancelamento</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
