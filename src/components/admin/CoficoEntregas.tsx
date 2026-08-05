// COFICO Entregas — fila de pedidos aguardando entrega (só delivery_mode='cofico', não despachados)
// e montagem MANUAL de rota (seleciona pedidos, ordena paradas, atribui motorista, despacha).
// Separado por empresa contratante. Nada de valores de margem/prestador aqui (3.2 = só operacional).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Package, MapPin, ArrowUp, ArrowDown, X, Loader2, Boxes } from 'lucide-react';
import CoficoDrivers from './CoficoDrivers';
import CoficoFrota from './CoficoFrota';
import CoficoRotas from './CoficoRotas';

interface QueueRow {
  order_id: string; order_number: string; company_id: string; company_name: string;
  client_name: string | null; client_fantasia: string | null; address: string | null;
  bairro: string | null; uf: string | null; lat: number | null; lng: number | null;
  total_amount: number; freight_amount: number; weight_kg: number; created_at: string;
}
interface Driver { id: string; full_name: string; vehicle_desc: string | null; }

export default function CoficoEntregas() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [driverId, setDriverId] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: q }, { data: d }] = await Promise.all([
      supabase.from('vw_cofico_delivery_queue').select('*').order('created_at', { ascending: true }),
      supabase.from('drivers').select('id,full_name,vehicle_desc').eq('status', 'active').order('full_name'),
    ]);
    setQueue((q as QueueRow[]) || []);
    setDrivers((d as Driver[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const companies = useMemo(() => {
    const m = new Map<string, string>();
    queue.forEach(r => m.set(r.company_id, r.company_name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [queue]);

  const visible = companyFilter === 'all' ? queue : queue.filter(r => r.company_id === companyFilter);
  const selectedRows = selected.map(id => queue.find(r => r.order_id === id)).filter(Boolean) as QueueRow[];
  const totalWeight = selectedRows.reduce((s, r) => s + (Number(r.weight_kg) || 0), 0);
  const mixedCompanies = new Set(selectedRows.map(r => r.company_id)).size > 1;

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const move = (i: number, dir: -1 | 1) => setSelected(s => {
    const n = [...s]; const j = i + dir; if (j < 0 || j >= n.length) return s;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  async function dispatch() {
    if (!selected.length) return;
    setDispatching(true); setMsg(null);
    const { error } = await supabase.rpc('cofico_dispatch_route', {
      p_driver_id: driverId || null,
      p_scheduled_date: scheduledDate || null,
      p_order_ids: selected,
    });
    setDispatching(false);
    if (error) { setMsg({ type: 'err', text: error.message }); return; }
    setMsg({ type: 'ok', text: `Rota despachada com ${selected.length} parada(s).` });
    setSelected([]); setDriverId('');
    load();
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">COFICO Entregas</h2>
        <p className="text-sm text-gray-500">Fila de entregas pela COFICO, por empresa. Monte a rota do dia e despache.</p>
      </div>

      <CoficoDrivers />
      <CoficoFrota />
      <CoficoRotas />

      {/* filtro por empresa contratante */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCompanyFilter('all')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${companyFilter === 'all' ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
          Todas ({queue.length})
        </button>
        {companies.map(c => (
          <button key={c.id} onClick={() => setCompanyFilter(c.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border ${companyFilter === c.id ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {c.name} ({queue.filter(r => r.company_id === c.id).length})
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* FILA */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando fila…</div>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <Package className="w-8 h-8 mx-auto mb-2" /> Nenhum pedido aguardando entrega pela COFICO.
            </div>
          ) : visible.map(r => {
            const isSel = selected.includes(r.order_id);
            return (
              <button key={r.order_id} onClick={() => toggle(r.order_id)}
                className={`w-full text-left bg-white border rounded-xl p-4 transition-colors ${isSel ? 'border-[#8B2214] ring-1 ring-[#8B2214]' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.order_number}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] font-medium">{r.company_name}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 truncate">{r.client_name || r.client_fantasia || '—'}</p>
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {[r.address, r.bairro, r.uf].filter(Boolean).join(' · ') || 'Sem endereço'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-gray-900">{Number(r.weight_kg).toLocaleString('pt-BR')} kg</div>
                    <div className="text-[11px] text-gray-400">Frete R$ {Number(r.freight_amount).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* MONTAGEM DE ROTA */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-5 h-5 text-[#8B2214]" />
            <h3 className="font-semibold text-gray-900">Montar rota</h3>
          </div>

          {selected.length === 0 ? (
            <p className="text-sm text-gray-400">Selecione pedidos na fila para montar a rota (a ordem dos cliques vira a ordem das paradas).</p>
          ) : (
            <>
              {mixedCompanies && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2">
                  Rota mista (empresas diferentes) — ok. Cada parada mantém sua empresa; o financeiro apura separado.
                </p>
              )}
              <ol className="space-y-2 mb-3">
                {selectedRows.map((r, i) => (
                  <li key={r.order_id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-[#8B2214] text-white text-[11px] flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate">{r.order_number} · {r.client_name || '—'}</span>
                    <span className="text-xs text-gray-400 shrink-0">{Number(r.weight_kg).toLocaleString('pt-BR')}kg</span>
                    <button onClick={() => move(i, -1)} className="p-1 text-gray-400 hover:text-gray-700"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => move(i, 1)} className="p-1 text-gray-400 hover:text-gray-700"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggle(r.order_id)} className="p-1 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ol>

              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2 mb-3">
                <span className="text-gray-500 flex items-center gap-1"><Boxes className="w-4 h-4" /> {selected.length} parada(s)</span>
                <span className="font-semibold text-gray-900">{totalWeight.toLocaleString('pt-BR')} kg</span>
              </div>

              <label className="block text-[11px] text-gray-500 mb-1">Motorista</label>
              <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full h-[36px] px-2 text-sm border border-gray-300 rounded mb-3 bg-white">
                <option value="">— atribuir depois —</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.vehicle_desc ? ` · ${d.vehicle_desc}` : ''}</option>)}
              </select>

              <label className="block text-[11px] text-gray-500 mb-1">Data de saída</label>
              <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full h-[36px] px-2 text-sm border border-gray-300 rounded mb-4" />

              <button onClick={dispatch} disabled={dispatching}
                className="w-full h-[40px] rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-60 flex items-center justify-center gap-2">
                {dispatching ? <><Loader2 className="w-4 h-4 animate-spin" /> Despachando…</> : <>Despachar rota</>}
              </button>
              {drivers.length === 0 && <p className="text-[11px] text-gray-400 mt-2">Nenhum motorista cadastrado ainda — dá pra despachar e atribuir depois.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
