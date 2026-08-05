// Rotas despachadas da COFICO — pra ENXERGAR pra onde foram os pedidos ao despachar.
// Lista as rotas (delivery_routes) e, ao expandir, as paradas (delivery_stops) com pedido/cliente/empresa/status.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Route as RouteIcon, ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';

const ROUTE_STATUS: Record<string, { label: string; cls: string }> = {
  planned: { label: 'Planejada', cls: 'bg-gray-100 text-gray-600' },
  dispatched: { label: 'Despachada', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em rota', cls: 'bg-amber-100 text-amber-700' },
  done: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  canceled: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
};
const STOP_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'text-gray-500' },
  en_route: { label: 'A caminho', cls: 'text-amber-600' },
  arrived: { label: 'Chegou', cls: 'text-blue-600' },
  delivered: { label: 'Entregue', cls: 'text-green-700 font-semibold' },
  failed: { label: 'Falhou', cls: 'text-red-600' },
};
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

interface Route {
  id: string; scheduled_date: string | null; status: string; total_stops: number | null;
  dispatched_at: string | null; driver_id: string | null;
  drivers: { full_name: string } | null;
}
interface Stop {
  id: string; stop_order: number | null; status: string; client_name: string | null;
  companies: { fantasia: string | null } | null;
  representative_orders: { order_number: string | null } | null;
}

export default function CoficoRotas() {
  const [open, setOpen] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stops, setStops] = useState<Record<string, Stop[]>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_routes')
      .select('id,scheduled_date,status,total_stops,dispatched_at,driver_id,drivers(full_name)')
      .neq('status', 'canceled')
      .order('created_at', { ascending: false })
      .limit(40);
    setRoutes((data as unknown as Route[]) || []);
    setLoading(false);
  }
  useEffect(() => { if (open && routes.length === 0) load(); }, [open]);

  async function toggleRoute(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!stops[id]) {
      const { data } = await supabase
        .from('delivery_stops')
        .select('id,stop_order,status,client_name,companies(fantasia),representative_orders(order_number)')
        .eq('route_id', id)
        .order('stop_order', { ascending: true });
      setStops(s => ({ ...s, [id]: (data as unknown as Stop[]) || [] }));
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-gray-900"><RouteIcon className="w-5 h-5 text-[#8B2214]" /> Rotas despachadas</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          {loading ? (
            <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma rota despachada ainda. Monte e despache uma rota na fila abaixo.</p>
          ) : (
            <div className="space-y-2">
              {routes.map(r => {
                const st = ROUTE_STATUS[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={r.id} className="border border-gray-200 rounded-lg">
                    <button onClick={() => toggleRoute(r.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
                      <span className="flex items-center gap-2 min-w-0">
                        {expandedId === r.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                        <span className="font-semibold text-gray-900 shrink-0">Saída {fmtDate(r.scheduled_date)}</span>
                        <span className="text-sm text-gray-500 truncate">{r.drivers?.full_name || 'sem motorista'} · {r.total_stops ?? 0} parada(s)</span>
                      </span>
                    </button>
                    {expandedId === r.id && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                        {!stops[r.id] ? (
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Carregando paradas…</p>
                        ) : stops[r.id].length === 0 ? (
                          <p className="text-xs text-gray-400">Sem paradas.</p>
                        ) : (
                          <ol className="space-y-1.5">
                            {stops[r.id].map(s => {
                              const ss = STOP_STATUS[s.status] || { label: s.status, cls: 'text-gray-500' };
                              return (
                                <li key={s.id} className="flex items-center gap-2 text-sm">
                                  <span className="w-5 h-5 rounded-full bg-[#8B2214] text-white text-[11px] flex items-center justify-center shrink-0">{s.stop_order ?? '?'}</span>
                                  <span className="font-medium text-gray-900 shrink-0">{s.representative_orders?.order_number || '—'}</span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] shrink-0">{s.companies?.fantasia || '—'}</span>
                                  <span className="flex-1 min-w-0 truncate text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.client_name || '—'}</span>
                                  <span className={`text-xs shrink-0 ${ss.cls}`}>{ss.label}</span>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
