import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, DollarSign, ShoppingBag, Award } from 'lucide-react';

interface Props { repId: string; }

interface MonthData { month: string; orders: number; revenue: number; commission: number; }

export function RepCoPerformance({ repId }: Props) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: orders } = await supabase.from('representative_orders')
        .select('total_amount, created_at, status')
        .eq('representative_id', repId)
        .eq('status', 'completed');

      const { data: comms } = await supabase.from('representative_commissions')
        .select('commission_amount, created_at')
        .eq('representative_id', repId);

      // Group by month
      const map = new Map<string, MonthData>();
      (orders || []).forEach(o => {
        const month = o.created_at.slice(0, 7);
        const cur = map.get(month) || { month, orders: 0, revenue: 0, commission: 0 };
        map.set(month, { ...cur, orders: cur.orders + 1, revenue: cur.revenue + o.total_amount });
      });
      (comms || []).forEach(c => {
        const month = c.created_at.slice(0, 7);
        const cur = map.get(month) || { month, orders: 0, revenue: 0, commission: 0 };
        map.set(month, { ...cur, commission: cur.commission + c.commission_amount });
      });

      const sorted = Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
      setData(sorted);
      setLoading(false);
    };
    fetch();
  }, [repId]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCommission = data.reduce((s, d) => s + d.commission, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#a4240e]" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Performance</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">Total Pedidos</span></div>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-600" /><span className="text-xs text-gray-500">Receita Total</span></div>
          <p className="text-2xl font-bold text-gray-900">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-[#a4240e]" /><span className="text-xs text-gray-500">Comissões Totais</span></div>
          <p className="text-2xl font-bold text-[#a4240e]">R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Bar chart */}
      {data.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl text-gray-500">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Nenhuma venda registrada ainda</p>
          <p className="text-sm text-gray-400 mt-1">Os dados aparecerão aqui após as primeiras vendas concluídas</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-bold text-gray-900 mb-6">Receita por Mês (últimos 12 meses)</h3>
          <div className="flex items-end gap-3 h-48">
            {[...data].reverse().map(d => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end" style={{ height: '160px' }}>
                  <div
                    className="w-full bg-gradient-to-t from-[#a4240e] to-[#c4341e] rounded-t-lg transition-all hover:opacity-80 cursor-default"
                    style={{ height: `${Math.max((d.revenue / maxRevenue) * 160, 4)}px` }}
                    title={`R$ ${d.revenue.toFixed(2)}`}
                  />
                </div>
                <p className="text-xs text-gray-500 font-medium">{formatMonth(d.month)}</p>
                <p className="text-xs text-gray-700 font-semibold">{d.orders}x</p>
              </div>
            ))}
          </div>

          {/* Monthly table */}
          <div className="mt-8 border-t border-gray-100 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left py-2">Mês</th>
                  <th className="text-right py-2">Pedidos</th>
                  <th className="text-right py-2">Receita</th>
                  <th className="text-right py-2">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(d => (
                  <tr key={d.month} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{formatMonth(d.month)}</td>
                    <td className="py-2 text-right text-gray-600">{d.orders}</td>
                    <td className="py-2 text-right text-gray-700">R$ {d.revenue.toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold text-[#a4240e]">R$ {d.commission.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
