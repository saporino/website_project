// Coffee LiVRE — pedidos (visão mínima da operação).
//
// Inspecionar, não operar um ERP: pedido pai, subpedidos por vendedor,
// comprador, pagamento, reservas de estoque por lote e o histórico. A única
// ação é cancelar (antes do envio), pela mesma função do banco que confere
// estados, devolve estoque e abre reembolso pendente quando já estava pago.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { ShoppingBag, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface Pedido {
  id: string;
  numero: string;
  status: string;
  pagamento_status: string;
  pagamento_metodo: string;
  comprador_nome: string;
  comprador_email: string;
  total_cents: number;
  frete_cents: number;
  comissao_plataforma_cents: number | null;
  repasse_sellers_cents: number | null;
  is_demo: boolean;
  created_at: string;
  lv_seller_orders: { id: string; numero: string; loja_nome: string; status: string; total_cents: number; repasse_seller_cents: number | null }[];
}

interface Detalhe {
  itens: { titulo: string; variante_nome: string | null; quantidade: number; unitario_cents: number; total_cents: number; loja_nome: string; comissao_cents: number | null }[];
  reservas: { lote: string | null; validade: string | null; quantidade: number; status: string; expira_em: string }[];
  eventos: { tipo: string; origem: string; created_at: string }[];
  reembolsos: { tipo: string; valor_cents: number; status: string; motivo: string }[];
}

const STATUS = ['aguardando_pagamento', 'pago', 'em_processamento', 'parcialmente_enviado', 'enviado', 'entregue', 'cancelado', 'reembolsado'];
const brl = (c: number | null) => (c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const data = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function LivrePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = supabase.from('lv_orders')
      .select('id, numero, status, pagamento_status, pagamento_metodo, comprador_nome, comprador_email, total_cents, frete_cents, comissao_plataforma_cents, repasse_sellers_cents, is_demo, created_at, lv_seller_orders(id, numero, loja_nome, status, total_cents, repasse_seller_cents)')
      .order('created_at', { ascending: false }).limit(100);
    if (filtro) q = q.eq('status', filtro);
    const { data: d, error } = await q;
    if (error) toast.error('Não foi possível carregar os pedidos.');
    setPedidos((d as Pedido[]) ?? []);
    setCarregando(false);
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrir(p: Pedido) {
    if (aberto === p.id) { setAberto(null); return; }
    setAberto(p.id);
    setDetalhe(null);
    setMotivo('');
    const [itens, reservas, eventos, reembolsos] = await Promise.all([
      supabase.from('lv_order_items').select('titulo, variante_nome, quantidade, unitario_cents, total_cents, loja_nome, comissao_cents').eq('order_id', p.id),
      supabase.from('lv_stock_reservations').select('lote, validade, quantidade, status, expira_em').eq('order_id', p.id).order('created_at'),
      supabase.from('lv_order_events').select('tipo, origem, created_at').eq('order_id', p.id).order('created_at'),
      supabase.from('lv_refunds').select('tipo, valor_cents, status, motivo').eq('order_id', p.id),
    ]);
    setDetalhe({
      itens: (itens.data as Detalhe['itens']) ?? [], reservas: (reservas.data as Detalhe['reservas']) ?? [],
      eventos: (eventos.data as Detalhe['eventos']) ?? [], reembolsos: (reembolsos.data as Detalhe['reembolsos']) ?? [],
    });
  }

  async function cancelar(p: Pedido) {
    const { error } = await supabase.rpc('lv_pedido_cancelar', { p_order: p.id, p_motivo: motivo.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido ${p.numero} cancelado.`);
    setAberto(null);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">Pedidos</h3>
          <p className="text-sm text-gray-500">Pedido pai, subpedidos por vendedor, pagamento, reservas por lote e histórico. Valores congelados na compra.</p>
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} aria-label="Filtrar por status"
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Todos os status</option>
          {STATUS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          <ShoppingBag className="mx-auto mb-2 h-6 w-6 text-gray-300" /> Nenhum pedido.
        </div>
      ) : (
        <ul className="space-y-2">
          {pedidos.map(p => (
            <li key={p.id} className="rounded-xl border border-gray-200 bg-white" data-pedido={p.numero}>
              <button type="button" onClick={() => abrir(p)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
                {aberto === p.id ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="font-semibold text-gray-900">{p.numero}</span>
                <span className="rounded-full bg-[#f5f0ef] px-2 py-0.5 text-xs font-semibold text-[#8B2214]">{p.status.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-500">pagamento {p.pagamento_status.replace(/_/g, ' ')} · {p.pagamento_metodo}</span>
                {p.is_demo && <span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-500">demo</span>}
                <span className="ml-auto text-sm font-semibold">{brl(p.total_cents)}</span>
                <span className="w-full text-xs text-gray-500">
                  {data(p.created_at)} · {p.comprador_nome} ({p.comprador_email}) · {p.lv_seller_orders.length} subpedido(s): {p.lv_seller_orders.map(s => s.loja_nome).join(', ')}
                </span>
              </button>

              {aberto === p.id && (
                <div className="space-y-4 border-t border-gray-100 p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    {p.lv_seller_orders.map(s => (
                      <div key={s.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between"><b>{s.numero} · {s.loja_nome}</b><span className="text-xs">{s.status.replace(/_/g, ' ')}</span></div>
                        <div className="mt-1 text-xs text-gray-500">Total {brl(s.total_cents)} · repasse {brl(s.repasse_seller_cents)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600">Frete {brl(p.frete_cents)} · comissão {brl(p.comissao_plataforma_cents)} · repasses {brl(p.repasse_sellers_cents)}</div>

                  {!detalhe ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : (
                    <>
                      <div>
                        <h4 className="mb-1 font-semibold">Itens</h4>
                        {detalhe.itens.map((i, k) => (
                          <div key={k} className="flex justify-between border-b border-gray-50 py-1">
                            <span>{i.quantidade} × {i.titulo}{i.variante_nome ? ` (${i.variante_nome})` : ''} <span className="text-xs text-gray-400">· {i.loja_nome}</span></span>
                            <span>{brl(i.total_cents)} <span className="text-xs text-gray-400">comissão {brl(i.comissao_cents)}</span></span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="mb-1 font-semibold">Estoque reservado</h4>
                        {detalhe.reservas.length === 0 ? <p className="text-xs text-gray-400">Sem reservas.</p> : detalhe.reservas.map((r, k) => (
                          <div key={k} className="text-xs text-gray-600">
                            Lote {r.lote ?? '—'}{r.validade ? ` (validade ${new Date(r.validade + 'T00:00').toLocaleDateString('pt-BR')})` : ''} · {r.quantidade} un. · {r.status}{r.status === 'ativa' ? ` até ${data(r.expira_em)}` : ''}
                          </div>
                        ))}
                      </div>
                      {detalhe.reembolsos.length > 0 && (
                        <div>
                          <h4 className="mb-1 font-semibold">Reembolsos</h4>
                          {detalhe.reembolsos.map((r, k) => <div key={k} className="text-xs text-gray-600">{r.tipo} · {brl(r.valor_cents)} · {r.status} · {r.motivo}</div>)}
                        </div>
                      )}
                      <div>
                        <h4 className="mb-1 font-semibold">Eventos</h4>
                        <ol className="space-y-0.5 border-l-2 border-gray-100 pl-3">
                          {detalhe.eventos.map((e, k) => <li key={k} className="text-xs"><b>{e.tipo.replace(/_/g, ' ')}</b> <span className="text-gray-400">· {e.origem} · {data(e.created_at)}</span></li>)}
                        </ol>
                      </div>
                    </>
                  )}

                  {['aguardando_pagamento', 'pago', 'em_processamento'].includes(p.status) && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                      <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo do cancelamento" aria-label="Motivo do cancelamento"
                             className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                      <button type="button" disabled={motivo.trim().length < 3} onClick={() => cancelar(p)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">
                        Cancelar pedido
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
