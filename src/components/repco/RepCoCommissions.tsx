import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, CheckCircle, Clock } from 'lucide-react';

interface Commission { id: string; order_amount: number; base_rate: number; pix_bonus: number; delivery_bonus: number; total_rate: number; commission_amount: number; status: 'pending' | 'paid'; paid_at: string | null; created_at: string; representative_orders: { order_number: string; description: string } | null; }
interface Props { repId: string; }

export function RepCoCommissions({ repId }: Props) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [tab, setTab] = useState<'pending' | 'paid'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from('representative_commissions')
        .select('*, representative_orders(order_number, description)')
        .eq('representative_id', repId)
        .order('created_at', { ascending: false });
      setCommissions(data || []);
      setLoading(false);
    };
    fetch();
  }, [repId]);

  const filtered = commissions.filter(c => c.status === tab);
  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Comissões</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">R$ {totalPending.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Recebidas</span>
          </div>
          <p className="text-2xl font-bold text-green-700">R$ {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      {/* Tab filter */}
      <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold w-fit">
        {(['pending', 'paid'] as const).map((t, idx) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : 'rounded-r-xl'} ${tab === t ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t === 'pending' ? 'Pendentes' : 'Pagas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#a4240e]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p>Nenhuma comissão {tab === 'pending' ? 'pendente' : 'paga'}</p></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pedido</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Valor Pedido</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Taxa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Comissão</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{tab === 'paid' ? 'Pago em' : 'Data'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{c.representative_orders?.order_number}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[150px]">{c.representative_orders?.description}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">R$ {c.order_amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{c.total_rate}%</p>
                    <p className="text-xs text-gray-400">
                      {c.base_rate}%{c.pix_bonus > 0 ? ` + ${c.pix_bonus}% PIX` : ''}{c.delivery_bonus > 0 ? ` + ${c.delivery_bonus}% entrega` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">R$ {c.commission_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {tab === 'paid' && c.paid_at ? new Date(c.paid_at).toLocaleDateString('pt-BR') : new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
