import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { TrendingUp, DollarSign, ShoppingBag, Award, ChevronLeft, ChevronRight, Sunrise, Sun, Moon } from 'lucide-react';

interface Props { repId: string; }

interface OrderRow { ts: string; amount: number; }

const PRIMARY = '#8B2214';
const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']; // índice 0=Seg ... 6=Dom

const fmtBRL = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBRLshort = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return `R$ ${Math.round(v)}`;
};
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMonth = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS[parseInt(m) - 1]}/${y.slice(2)}`; };
// Segunda=0 ... Domingo=6 (getDay: Dom=0..Sáb=6)
const weekIdxMon = (dow: number) => (dow + 6) % 7;

export function RepCoPerformance({ repId }: Props) {
  const { activeCompanyId } = useCompany();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState<string>('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: ord } = await supabase.from('representative_orders')
        .select('total_amount, created_at')
        .eq('representative_id', repId)
        .eq('company_id', activeCompanyId)
        .eq('status', 'completed');
      const { data: comms } = await supabase.from('representative_commissions')
        .select('commission_amount')
        .eq('representative_id', repId)
        .eq('company_id', activeCompanyId);
      if (!active) return;
      const rows: OrderRow[] = (ord || []).map(o => ({ ts: o.created_at as string, amount: o.total_amount as number }));
      setOrders(rows);
      setTotalCommission((comms || []).reduce((s, c) => s + (c.commission_amount || 0), 0));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [repId, activeCompanyId]);

  // Lista contínua de meses: do mês do pedido mais antigo até o mês atual.
  const months = useMemo(() => {
    const now = new Date();
    let min = new Date(now.getFullYear(), now.getMonth(), 1);
    orders.forEach(o => { const d = new Date(o.ts); const f = new Date(d.getFullYear(), d.getMonth(), 1); if (f < min) min = f; });
    const list: string[] = [];
    const cur = new Date(min);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cur <= end) { list.push(ymKey(cur)); cur.setMonth(cur.getMonth() + 1); }
    return list;
  }, [orders]);

  // Default: mês mais recente com pedidos; senão mês atual.
  useEffect(() => {
    if (selMonth || months.length === 0) return;
    const withOrders = orders.map(o => ymKey(new Date(o.ts)));
    const latest = months.filter(m => withOrders.includes(m)).pop();
    setSelMonth(latest || months[months.length - 1]);
  }, [months, orders, selMonth]);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);

  // Pedidos do mês selecionado
  const monthOrders = useMemo(
    () => orders.filter(o => ymKey(new Date(o.ts)) === selMonth),
    [orders, selMonth]
  );

  const [selY, selM] = selMonth ? selMonth.split('-').map(Number) : [0, 0];
  const daysInMonth = selMonth ? new Date(selY, selM, 0).getDate() : 0;

  // Por dia do mês
  const byDay = useMemo(() => {
    const arr = Array.from({ length: daysInMonth }, () => ({ revenue: 0, orders: 0 }));
    monthOrders.forEach(o => { const d = new Date(o.ts).getDate(); arr[d - 1].revenue += o.amount; arr[d - 1].orders += 1; });
    return arr;
  }, [monthOrders, daysInMonth]);
  const maxDay = Math.max(...byDay.map(d => d.revenue), 1);

  // Por dia da semana (mês selecionado)
  const byWeekday = useMemo(() => {
    const arr = Array.from({ length: 7 }, () => ({ revenue: 0, orders: 0 }));
    monthOrders.forEach(o => { const i = weekIdxMon(new Date(o.ts).getDay()); arr[i].revenue += o.amount; arr[i].orders += 1; });
    return arr;
  }, [monthOrders]);
  const maxWeekday = Math.max(...byWeekday.map(d => d.revenue), 1);

  // Por período do dia (mês selecionado)
  const byPeriod = useMemo(() => {
    const p = { manha: { revenue: 0, orders: 0 }, tarde: { revenue: 0, orders: 0 }, noite: { revenue: 0, orders: 0 } };
    monthOrders.forEach(o => {
      const h = new Date(o.ts).getHours();
      const k = h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
      p[k].revenue += o.amount; p[k].orders += 1;
    });
    return p;
  }, [monthOrders]);

  // Tendência 12 meses (todos os pedidos)
  const trend = useMemo(() => {
    const map = new Map<string, { revenue: number; orders: number }>();
    orders.forEach(o => { const k = ymKey(new Date(o.ts)); const c = map.get(k) || { revenue: 0, orders: 0 }; map.set(k, { revenue: c.revenue + o.amount, orders: c.orders + 1 }); });
    return months.slice(-12).map(m => ({ month: m, ...(map.get(m) || { revenue: 0, orders: 0 }) }));
  }, [orders, months]);
  const maxTrend = Math.max(...trend.map(t => t.revenue), 1);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-4" style={{ borderColor: PRIMARY }} /></div>;

  const idx = months.indexOf(selMonth);
  const goPrev = () => { if (idx > 0) setSelMonth(months[idx - 1]); };
  const goNext = () => { if (idx >= 0 && idx < months.length - 1) setSelMonth(months[idx + 1]); };

  const firstColMon = selMonth ? weekIdxMon(new Date(selY, selM - 1, 1).getDay()) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Performance</h2>

      {/* KPIs gerais */}
      <div className="grid grid-cols-3 gap-4">
        <Stat icon={<ShoppingBag className="w-4 h-4 text-blue-600" />} label="Total Pedidos" value={String(totalOrders)} />
        <Stat icon={<DollarSign className="w-4 h-4 text-green-600" />} label="Receita Total" value={fmtBRL(totalRevenue)} />
        <Stat icon={<Award className="w-4 h-4" style={{ color: PRIMARY }} />} label="Comissões Totais" value={fmtBRL(totalCommission)} valueColor={PRIMARY} />
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl text-gray-500">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Nenhuma venda registrada ainda</p>
          <p className="text-sm text-gray-400 mt-1">Os gráficos aparecem após as primeiras vendas concluídas</p>
        </div>
      ) : (
        <>
          {/* Seletor de mês */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <button onClick={goPrev} disabled={idx <= 0} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{selMonth ? fmtMonth(selMonth) : '—'}</p>
              <p className="text-xs text-gray-500">{monthOrders.length} pedido(s) · {fmtBRL(monthOrders.reduce((s, o) => s + o.amount, 0))}</p>
            </div>
            <button onClick={goNext} disabled={idx >= months.length - 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Painel 1 — Vendas por dia do mês */}
          <Panel title="Vendas por dia do mês" hint={`escala até ${fmtBRLshort(maxDay)}`}>
            <div className="flex items-end gap-[3px] h-44">
              {byDay.map((d, i) => {
                const day = i + 1;
                const dow = new Date(selY, selM - 1, day).getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center justify-end h-full group">
                    <div className="w-full rounded-t transition-all group-hover:opacity-80"
                      style={{ height: `${d.revenue > 0 ? Math.max((d.revenue / maxDay) * 150, 3) : 0}px`, background: weekend ? '#d9b3ad' : PRIMARY }}
                      title={`${WEEK_LABELS[weekIdxMon(dow)]}, dia ${day} · ${fmtBRL(d.revenue)} · ${d.orders} pedido(s)`} />
                    <span className="text-[9px] text-gray-400 mt-1">{day % 5 === 0 || day === 1 ? day : ''}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Painel 2 + 3 lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Por dia da semana">
              <div className="space-y-2">
                {byWeekday.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8">{WEEK_LABELS[i]}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(d.revenue / maxWeekday) * 100}%`, background: PRIMARY, minWidth: d.revenue > 0 ? '4px' : 0 }} />
                    </div>
                    <span className="text-xs text-gray-700 font-medium w-20 text-right">{fmtBRLshort(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Horário dos pedidos">
              <div className="grid grid-cols-3 gap-3 pt-2">
                <PeriodCard icon={<Sunrise className="w-5 h-5" />} label="Manhã" sub="até 12h" data={byPeriod.manha} />
                <PeriodCard icon={<Sun className="w-5 h-5" />} label="Tarde" sub="12h–18h" data={byPeriod.tarde} />
                <PeriodCard icon={<Moon className="w-5 h-5" />} label="Noite" sub="após 18h" data={byPeriod.noite} />
              </div>
            </Panel>
          </div>

          {/* Painel 4 — Calendário heatmap */}
          <Panel title="Mapa do mês (intensidade de venda por dia)">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_LABELS.map(w => <div key={w} className="text-[10px] text-gray-400 text-center font-medium">{w}</div>)}
              {Array.from({ length: firstColMon }).map((_, i) => <div key={`b${i}`} />)}
              {byDay.map((d, i) => {
                const intensity = d.revenue > 0 ? 0.18 + (d.revenue / maxDay) * 0.82 : 0;
                return (
                  <div key={i} className="aspect-square rounded-md flex items-center justify-center text-[10px] border border-gray-100"
                    style={{ background: intensity > 0 ? `rgba(139,34,20,${intensity})` : '#f8f7f5', color: intensity > 0.55 ? '#fff' : '#9ca3af' }}
                    title={`Dia ${i + 1} · ${fmtBRL(d.revenue)} · ${d.orders} pedido(s)`}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Painel 5 — Tendência 12 meses */}
          <Panel title="Tendência (últimos 12 meses)">
            <div className="flex items-end gap-2 h-40">
              {trend.map(t => (
                <div key={t.month} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div className="w-full rounded-t transition-all group-hover:opacity-80"
                    style={{ height: `${t.revenue > 0 ? Math.max((t.revenue / maxTrend) * 130, 3) : 0}px`, background: t.month === selMonth ? PRIMARY : '#c98579' }}
                    title={`${fmtMonth(t.month)} · ${fmtBRL(t.revenue)} · ${t.orders} pedido(s)`} />
                  <span className="text-[9px] text-gray-400 mt-1">{fmtMonth(t.month)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, valueColor }: { icon: ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold" style={{ color: valueColor || '#111827' }}>{value}</p>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-bold text-gray-900">{title}</h3>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function PeriodCard({ icon, label, sub, data }: { icon: ReactNode; label: string; sub: string; data: { revenue: number; orders: number } }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center">
      <div className="flex justify-center mb-1" style={{ color: PRIMARY }}>{icon}</div>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
      <p className="text-sm font-bold text-gray-900 mt-1">{data.orders}</p>
      <p className="text-[10px] text-gray-500">{fmtBRLshort(data.revenue)}</p>
    </div>
  );
}
