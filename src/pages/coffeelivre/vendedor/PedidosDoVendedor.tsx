// Seller Central — Pedidos.
//
// Lista em cartões (não tabela: no celular uma tabela de pedidos é ilegível) com
// filtro por situação, e o detalhe de cada subpedido com o próximo passo. Os
// valores financeiros aparecem para conferência e não são editáveis: comissão,
// tarifa, taxa e repasse ficaram congelados no momento da compra.
import { useCallback, useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { reais } from '../visual';
import { ACAO_DO_VENDEDOR, ROTULO_DO_SUBPEDIDO, proximoPassoDoVendedor, type StatusDoSubpedido } from '../checkout/estados';
import { dataHora, rotuloDaOrigem, rotuloDoEvento } from '../checkout/eventos';
import {
  avancarStatus, enderecoDoPedido, eventosDoSubpedido, pedidosDaLoja, subpedidoDaLoja,
  type EnderecoDeEntrega, type SubpedidoDaLoja,
} from './pedidos';
import type { ContextoDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';
import './pedidos-vendedor.css';

const R = (c: number | null) => (c == null ? 'não disponível' : `R$ ${reais(c)}`);

const FILTROS: { chave: string; rotulo: string; status: StatusDoSubpedido[] }[] = [
  { chave: 'todos', rotulo: 'Todos', status: [] },
  { chave: 'novos', rotulo: 'Novos', status: ['confirmado'] },
  { chave: 'separacao', rotulo: 'Em separação', status: ['separacao'] },
  { chave: 'prontos', rotulo: 'Prontos', status: ['pronto_para_envio'] },
  { chave: 'enviados', rotulo: 'Enviados', status: ['enviado'] },
  { chave: 'entregues', rotulo: 'Entregues', status: ['entregue'] },
  { chave: 'cancelados', rotulo: 'Cancelados', status: ['cancelado'] },
  { chave: 'aguardando', rotulo: 'Aguardando pagamento', status: ['aguardando_pagamento'] },
];

export default function PedidosDoVendedor({ contexto, avisar, pedidoId }: {
  contexto: ContextoDoVendedor;
  avisar: Avisar;
  pedidoId: string | null;
}) {
  return pedidoId
    ? <DetalheDoSubpedido contexto={contexto} avisar={avisar} id={pedidoId} />
    : <ListaDePedidos contexto={contexto} />;
}

function ListaDePedidos({ contexto }: { contexto: ContextoDoVendedor }) {
  const [pedidos, setPedidos] = useState<SubpedidoDaLoja[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    pedidosDaLoja(contexto.sellerId).then(setPedidos).catch(e => setErro(e instanceof Error ? e.message : 'Falhou.'));
  }, [contexto.sellerId]);

  const atual = FILTROS.find(f => f.chave === filtro)!;
  const visiveis = (pedidos ?? []).filter(p => atual.status.length === 0 || atual.status.includes(p.status));
  const contar = (f: typeof FILTROS[number]) => (pedidos ?? []).filter(p => f.status.length === 0 || f.status.includes(p.status)).length;

  return (
    <section className="sc-cartao">
      <h2>Pedidos</h2>
      <p className="sc-sub">Cada pedido aqui é a parte da sua loja numa compra. Pedidos novos aparecem depois do pagamento aprovado.</p>
      {erro && <p className="sc-erro" role="alert">{erro}</p>}
      <div className="pv-filtros" role="tablist" aria-label="Situação dos pedidos">
        {FILTROS.map(f => (
          <button key={f.chave} type="button" role="tab" aria-selected={filtro === f.chave}
                  className={filtro === f.chave ? 'on' : ''} onClick={() => setFiltro(f.chave)}>
            {f.rotulo} <small>{contar(f)}</small>
          </button>
        ))}
      </div>
      {pedidos === null ? <p className="sc-sub">Carregando…</p>
        : visiveis.length === 0 ? <p className="sc-sub">Nenhum pedido nesta situação.</p>
        : (
          <ul className="pv-lista">
            {visiveis.map(p => {
              const unidades = p.lv_order_items.reduce((s, i) => s + i.quantidade, 0);
              return (
                <li key={p.id}>
                  <a className="pv-cartao" href={rota(`vendedor/pedidos/${p.id}`)} data-subpedido={p.numero}
                     onClick={e => { e.preventDefault(); navegar(`vendedor/pedidos/${p.id}`); }}>
                    <span className="pv-topo">
                      <b>{p.numero}</b>
                      <em className={`pv-status s-${p.status}`}>{ROTULO_DO_SUBPEDIDO[p.status]}</em>
                    </span>
                    <small>{dataHora(p.created_at)}</small>
                    <span className="pv-itens">
                      {p.lv_order_items.map(i => `${i.quantidade} × ${i.titulo}${i.variante_nome ? ` (${i.variante_nome})` : ''}`).join(' · ')}
                    </span>
                    <span className="pv-rodape"><small>{unidades} {unidades === 1 ? 'unidade' : 'unidades'}</small><b>{R(p.total_cents)}</b></span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

function DetalheDoSubpedido({ contexto, avisar, id }: { contexto: ContextoDoVendedor; avisar: Avisar; id: string }) {
  const [p, setP] = useState<SubpedidoDaLoja | null | undefined>(undefined);
  const [endereco, setEndereco] = useState<EnderecoDeEntrega | null>(null);
  const [eventos, setEventos] = useState<{ tipo: string; origem: string; created_at: string }[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const s = await subpedidoDaLoja(id, contexto.sellerId);
    setP(s);
    if (s) {
      const [e, ev] = await Promise.all([enderecoDoPedido(s.order_id), eventosDoSubpedido(s.id)]);
      setEndereco(e);
      setEventos(ev);
    }
  }, [id, contexto.sellerId]);

  useEffect(() => { carregar().catch(() => setP(null)); }, [carregar]);

  if (p === undefined) return <section className="sc-cartao"><p className="sc-sub">Carregando…</p></section>;
  if (p === null) return <section className="sc-cartao"><h2>Pedido não encontrado</h2></section>;

  const proximo = proximoPassoDoVendedor(p.status);

  async function avancar() {
    if (!proximo) return;
    setOcupado(true);
    try {
      await avancarStatus(p!.id, proximo);
      avisar({ tipo: 'ok', texto: `Pedido ${p!.numero}: ${ROTULO_DO_SUBPEDIDO[proximo].toLowerCase()}.` });
      await carregar();
    } catch (e) {
      avisar({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível mudar o status.' });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pv-detalhe">
      <a className="pv-voltar" href={rota('vendedor/pedidos')} onClick={e => { e.preventDefault(); navegar('vendedor/pedidos'); }}>← Pedidos</a>
      <section className="sc-cartao">
        <div className="pv-topo">
          <h2>Pedido {p.numero}</h2>
          <em className={`pv-status s-${p.status}`} data-campo="status-subpedido">{ROTULO_DO_SUBPEDIDO[p.status]}</em>
        </div>
        <p className="sc-sub">Feito em {dataHora(p.created_at)}</p>
        {proximo && ACAO_DO_VENDEDOR[proximo] && (
          <button type="button" className="sc-botao sc-botao-principal" onClick={avancar} disabled={ocupado}>
            {ocupado ? 'Salvando…' : ACAO_DO_VENDEDOR[proximo]}
          </button>
        )}
        {p.status === 'aguardando_pagamento' && <p className="sc-sub">Aguardando o pagamento do comprador. Não separe ainda.</p>}
      </section>

      <section className="sc-cartao">
        <h3>Itens</h3>
        {p.lv_order_items.map(i => (
          <div className="pv-item" key={i.id}>
            <span>
              <b>{i.quantidade} × {i.titulo}</b>
              <small>{[i.variante_nome, i.gramatura_g ? `${i.gramatura_g} g` : null, i.sku ? `SKU ${i.sku}` : null].filter(Boolean).join(' · ')}</small>
              {i.lotes?.length > 0 && <small>Lotes: {i.lotes.map(l => `${l.lote ?? 'sem código'} (${l.quantidade})`).join(', ')}</small>}
            </span>
            <b>{R(i.total_cents)}</b>
          </div>
        ))}
      </section>

      <section className="sc-cartao">
        <h3>Valores</h3>
        <p className="sc-sub">Congelados no momento da compra. Só a equipe Coffee LiVRE altera.</p>
        <dl className="pv-valores" data-campo="valores">
          <div><dt>Produtos</dt><dd>{R(p.subtotal_produtos_cents)}</dd></div>
          <div><dt>Descontos da escada</dt><dd>− {R(p.desconto_produtos_cents)}</dd></div>
          <div><dt>Frete (entrega)</dt><dd>{R(p.frete_cents)}</dd></div>
          <div><dt>Total do pedido</dt><dd>{R(p.total_cents)}</dd></div>
          <div><dt>Comissão Coffee LiVRE{p.politica_comercial?.comissao_bps != null ? ` (${(p.politica_comercial.comissao_bps / 100).toLocaleString('pt-BR')}%)` : ''}</dt><dd>− {R(p.comissao_plataforma_cents)}</dd></div>
          <div><dt>Tarifa operacional</dt><dd>− {R(p.tarifa_operacional_cents)}</dd></div>
          <div><dt>Taxa de pagamento</dt><dd>− {R(p.taxa_pagamento_cents)}</dd></div>
          <div className="forte"><dt>Repasse estimado</dt><dd data-campo="repasse">{R(p.repasse_seller_cents)}</dd></div>
        </dl>
        {!p.politica_completa && <p className="sc-sub">Algum custo da política não estava disponível: o repasse fica sem valor em vez de supor zero.</p>}
      </section>

      <section className="sc-cartao">
        <h3>Entrega</h3>
        {p.lv_shipments.map((s, k) => (
          <p className="sc-sub" key={k}>{s.servico} · {s.transportadora}{s.prazo_dias ? ` · até ${s.prazo_dias} dias úteis` : ''}{s.peso_g ? ` · ${(s.peso_g / 1000).toLocaleString('pt-BR')} kg` : ''} · origem CD Coffee LiVRE</p>
        ))}
        {endereco
          ? <p className="sc-sub">{endereco.destinatario} · {endereco.logradouro}, {endereco.numero}{endereco.complemento ? ` — ${endereco.complemento}` : ''} · {endereco.bairro} · {endereco.cidade}/{endereco.uf} · CEP {endereco.cep}</p>
          : <p className="sc-sub">O endereço aparece depois do pagamento aprovado.</p>}
      </section>

      <section className="sc-cartao">
        <h3>Histórico</h3>
        <ol className="pv-historico">
          {eventos.map((e, k) => <li key={k}><b>{rotuloDoEvento(e.tipo)}</b><small>{dataHora(e.created_at)} · {rotuloDaOrigem(e.origem)}</small></li>)}
        </ol>
      </section>
    </div>
  );
}
