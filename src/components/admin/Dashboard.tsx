import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp, DollarSign, ShoppingBag, Users, Package,
  AlertCircle, ChevronLeft, ChevronRight, Truck, Building2, UserCircle
} from 'lucide-react';

type CustomerType = 'all' | 'PF' | 'PJ';

interface MonthStats {
  revenuePF: number;
  revenuePJ: number;
  ordersPF: number;
  ordersPJ: number;
  avgTicketPF: number;
  avgTicketPJ: number;
}

interface TopProduct { name: string; quantityPF: number; quantityPJ: number; revenuePF: number; revenuePJ: number; }
interface CarrierStats { name: string; shipmentsPF: number; shipmentsPJ: number; }

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function Dashboard() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [customerFilter, setCustomerFilter] = useState<CustomerType>('all');
  const [monthStats, setMonthStats] = useState<MonthStats>({ revenuePF: 0, revenuePJ: 0, ordersPF: 0, ordersPJ: 0, avgTicketPF: 0, avgTicketPJ: 0 });
  const [totalCustomersPF, setTotalCustomersPF] = useState(0);
  const [totalCustomersPJ, setTotalCustomersPJ] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [carriers, setCarriers] = useState<CarrierStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [selectedYear, selectedMonth]);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isPastOrPresent = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
    if (!isPastOrPresent) return;
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const firstDay = new Date(selectedYear, selectedMonth, 1).toISOString();
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

      // Load orders for selected month with customer profile
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          total_amount, user_id,
          order_items(quantity, unit_price, products(name)),
          shipments(carrier_name),
          user_profiles!orders_user_id_fkey(account_type)
        `)
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .in('payment_status', ['paid', 'approved'])
        .order('created_at');

      // Total customers
      const [{ count: pfCount }, { count: pjCount }, { data: products }] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('account_type', 'PF'),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('account_type', 'PJ'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
      ]);

      // Pending orders
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('order_status', ['created', 'payment_pending']);

      setTotalCustomersPF(pfCount || 0);
      setTotalCustomersPJ(pjCount || 0);
      setTotalProducts((products as any)?.length || 0);
      setPendingOrders(pendingCount || 0);

      // Process orders by PF/PJ
      let revPF = 0, revPJ = 0, ordsPF = 0, ordsPJ = 0;
      const productMap: Record<string, TopProduct> = {};
      const carrierMap: Record<string, CarrierStats> = {};

      (orders || []).forEach((order: any) => {
        const acctType = order.user_profiles?.account_type || 'PF';
        const amount = Number(order.total_amount) || 0;
        const isPF = acctType !== 'PJ';

        if (isPF) { revPF += amount; ordsPF++; }
        else { revPJ += amount; ordsPJ++; }

        // Products
        (order.order_items || []).forEach((item: any) => {
          const pName = item.products?.name || 'Outros';
          if (!productMap[pName]) productMap[pName] = { name: pName, quantityPF: 0, quantityPJ: 0, revenuePF: 0, revenuePJ: 0 };
          const qty = item.quantity || 0;
          const lineRev = qty * (Number(item.unit_price) || 0);
          if (isPF) { productMap[pName].quantityPF += qty; productMap[pName].revenuePF += lineRev; }
          else { productMap[pName].quantityPJ += qty; productMap[pName].revenuePJ += lineRev; }
        });

        // Carriers
        const carrierName = order.shipments?.[0]?.carrier_name || null;
        if (carrierName) {
          if (!carrierMap[carrierName]) carrierMap[carrierName] = { name: carrierName, shipmentsPF: 0, shipmentsPJ: 0 };
          if (isPF) carrierMap[carrierName].shipmentsPF++;
          else carrierMap[carrierName].shipmentsPJ++;
        }
      });

      setMonthStats({
        revenuePF: revPF, revenuePJ: revPJ,
        ordersPF: ordsPF, ordersPJ: ordsPJ,
        avgTicketPF: ordsPF > 0 ? revPF / ordsPF : 0,
        avgTicketPJ: ordsPJ > 0 ? revPJ / ordsPJ : 0,
      });

      setTopProducts(
        Object.values(productMap)
          .sort((a, b) => (b.quantityPF + b.quantityPJ) - (a.quantityPF + a.quantityPJ))
          .slice(0, 5)
      );
      setCarriers(
        Object.values(carrierMap)
          .sort((a, b) => (b.shipmentsPF + b.shipmentsPJ) - (a.shipmentsPF + a.shipmentsPJ))
      );
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Compute totals based on customer filter
  const revenue = customerFilter === 'all' ? monthStats.revenuePF + monthStats.revenuePJ
    : customerFilter === 'PF' ? monthStats.revenuePF : monthStats.revenuePJ;
  const orders = customerFilter === 'all' ? monthStats.ordersPF + monthStats.ordersPJ
    : customerFilter === 'PF' ? monthStats.ordersPF : monthStats.ordersPJ;
  const avgTicket = orders > 0 ? revenue / orders : 0;
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  return (
    <div className="space-y-8">
      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Visão geral do negócio — dados em tempo real</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month Navigator */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button onClick={prevMonth} className="px-3 py-2.5 hover:bg-gray-50 transition-colors border-r border-gray-200">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-4 py-2.5 text-sm font-semibold text-gray-800 min-w-[140px] text-center">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              className="px-3 py-2.5 hover:bg-gray-50 transition-colors border-l border-gray-200 disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* PF/PJ Filter */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-sm font-semibold">
            {(['all', 'PF', 'PJ'] as CustomerType[]).map(type => (
              <button
                key={type}
                onClick={() => setCustomerFilter(type)}
                className={`px-4 py-2.5 transition-all border-r border-gray-200 last:border-0 ${
                  customerFilter === type
                    ? 'bg-[#a4240e] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type === 'all' ? 'Todos' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Orders Alert */}
      {pendingOrders > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 font-medium">
            {pendingOrders} {pendingOrders === 1 ? 'pedido pendente' : 'pedidos pendentes'} aguardando processamento
          </p>
        </div>
      )}

      {/* Top Stat Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
        </div>
      ) : (
        <>
          {/* Revenue Cards — split when "Todos" is selected */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {customerFilter === 'all' ? (
              <>
                {/* PF Revenue */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Receita PF</span>
                    </div>
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">R$ {monthStats.revenuePF.toFixed(2)}</p>
                  <p className="text-xs text-blue-600 mt-1">{monthStats.ordersPF} pedidos · Ticket médio R$ {monthStats.avgTicketPF.toFixed(2)}</p>
                </div>
                {/* PJ Revenue */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Receita PJ</span>
                    </div>
                    <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">R$ {monthStats.revenuePJ.toFixed(2)}</p>
                  <p className="text-xs text-purple-600 mt-1">{monthStats.ordersPJ} pedidos · Ticket médio R$ {monthStats.avgTicketPJ.toFixed(2)}</p>
                </div>
                {/* Total Revenue */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Total Geral</span>
                    <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-900">R$ {(monthStats.revenuePF + monthStats.revenuePJ).toFixed(2)}</p>
                  <p className="text-xs text-green-600 mt-1">{monthStats.ordersPF + monthStats.ordersPJ} pedidos no mês</p>
                </div>
              </>
            ) : (
              <div className={`col-span-1 md:col-span-2 lg:col-span-2 rounded-xl p-5 shadow-sm border ${
                customerFilter === 'PF' ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {customerFilter === 'PF' ? <UserCircle className="w-5 h-5 text-blue-600" /> : <Building2 className="w-5 h-5 text-purple-600" />}
                  <span className={`text-sm font-bold uppercase tracking-wide ${customerFilter === 'PF' ? 'text-blue-700' : 'text-purple-700'}`}>
                    Receita {customerFilter} — {MONTH_NAMES[selectedMonth]}
                  </span>
                </div>
                <p className={`text-4xl font-bold ${customerFilter === 'PF' ? 'text-blue-900' : 'text-purple-900'}`}>R$ {revenue.toFixed(2)}</p>
                <p className={`text-sm mt-2 ${customerFilter === 'PF' ? 'text-blue-600' : 'text-purple-600'}`}>
                  {orders} pedidos · Ticket médio R$ {avgTicket.toFixed(2)}
                </p>
              </div>
            )}

            {/* Orders */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Pedidos</span>
                <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-900">{orders}</p>
              <div className="mt-1 text-xs text-orange-600 space-y-0.5">
                {customerFilter === 'all' && <><p>PF: {monthStats.ordersPF} · PJ: {monthStats.ordersPJ}</p></>}
              </div>
            </div>

            {/* Customers */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-100 border border-teal-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Clientes</span>
                <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-teal-900">
                {customerFilter === 'all' ? totalCustomersPF + totalCustomersPJ : customerFilter === 'PF' ? totalCustomersPF : totalCustomersPJ}
              </p>
              <div className="mt-1 text-xs text-teal-600">
                {customerFilter === 'all' ? `PF: ${totalCustomersPF} · PJ: ${totalCustomersPJ}` : `Cadastros ${customerFilter}`}
              </div>
            </div>

            {/* Products */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-100 border border-rose-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">Produtos</span>
                <div className="w-9 h-9 bg-rose-600 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-rose-900">{totalProducts}</p>
              <p className="text-xs text-rose-600 mt-1">No catálogo</p>
            </div>
          </div>

          {/* Second Row — Top Products + Carriers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#a4240e]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Produtos Mais Vendidos</h3>
                  <p className="text-xs text-gray-500">Top 5 do mês — {MONTH_NAMES[selectedMonth]}</p>
                </div>
              </div>
              {topProducts.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhuma venda neste mês</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => {
                    const totalQty = (customerFilter === 'all' ? p.quantityPF + p.quantityPJ : customerFilter === 'PF' ? p.quantityPF : p.quantityPJ);
                    const totalRev = (customerFilter === 'all' ? p.revenuePF + p.revenuePJ : customerFilter === 'PF' ? p.revenuePF : p.revenuePJ);
                    if (totalQty === 0) return null;
                    const colors = ['bg-[#a4240e]', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500'];
                    return (
                      <div key={p.name} className="flex items-center gap-4 p-3 bg-stone-50 rounded-xl">
                        <div className={`w-8 h-8 ${colors[i]} text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                          {customerFilter === 'all' ? (
                            <p className="text-xs text-gray-500">PF: {p.quantityPF} un · PJ: {p.quantityPJ} un</p>
                          ) : (
                            <p className="text-xs text-gray-500">{totalQty} unidades</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-[#a4240e] text-sm">R$ {totalRev.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Carriers + Month Summary */}
            <div className="space-y-5">
              {/* Carrier Stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-[#a4240e]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Transportadoras</h3>
                    <p className="text-xs text-gray-500">Envios no mês por tipo de cliente</p>
                  </div>
                </div>
                {carriers.length === 0 ? (
                  <div className="text-center py-6">
                    <Truck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Nenhum envio neste mês</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carriers.map(c => {
                      const total = customerFilter === 'all' ? c.shipmentsPF + c.shipmentsPJ : customerFilter === 'PF' ? c.shipmentsPF : c.shipmentsPJ;
                      if (total === 0) return null;
                      return (
                        <div key={c.name} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                            {customerFilter === 'all' && (
                              <p className="text-xs text-gray-500">PF: {c.shipmentsPF} · PJ: {c.shipmentsPJ}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{total}</span>
                            <span className="text-xs text-gray-500">envios</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Monthly Summary Box */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide text-gray-500">Resumo do Mês</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
                    <p className="text-xs text-green-600 font-medium mb-1">Receita</p>
                    <p className="text-base font-bold text-green-900">R$ {revenue.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                    <p className="text-xs text-blue-600 font-medium mb-1">Pedidos</p>
                    <p className="text-base font-bold text-blue-900">{orders}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center">
                    <p className="text-xs text-purple-600 font-medium mb-1">Ticket Médio</p>
                    <p className="text-base font-bold text-purple-900">R$ {avgTicket.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-center">
                    <p className="text-xs text-orange-600 font-medium mb-1">Pendentes</p>
                    <p className="text-base font-bold text-orange-900">{pendingOrders}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
