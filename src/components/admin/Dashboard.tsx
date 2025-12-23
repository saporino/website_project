import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, DollarSign, ShoppingBag, Users, Package, AlertCircle } from 'lucide-react';

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  revenueThisMonth: number;
  ordersThisMonth: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    revenueThisMonth: 0,
    ordersThisMonth: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        { data: orders },
        { data: customers },
        { data: products },
        { data: pendingOrdersData },
        { data: monthOrders },
        { data: orderItems },
      ] = await Promise.all([
        supabase.from('orders').select('total_amount, created_at'),
        supabase.from('user_profiles').select('id'),
        supabase.from('products').select('id'),
        supabase.from('orders').select('id').eq('status', 'pending'),
        supabase
          .from('orders')
          .select('total_amount, created_at')
          .gte('created_at', firstDayOfMonth.toISOString()),
        supabase.from('order_items').select(`
          quantity,
          unit_price,
          products (name)
        `),
      ]);

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const revenueThisMonth = monthOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

      const productSales: Record<string, TopProduct> = {};
      orderItems?.forEach((item: any) => {
        const productName = item.products?.name || 'Produto desconhecido';
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += item.quantity;
        productSales[productName].revenue += item.quantity * Number(item.unit_price);
      });

      const topProductsArray = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      setStats({
        totalRevenue,
        totalOrders: orders?.length || 0,
        totalCustomers: customers?.length || 0,
        totalProducts: products?.length || 0,
        pendingOrders: pendingOrdersData?.length || 0,
        revenueThisMonth,
        ordersThisMonth: monthOrders?.length || 0,
      });
      setTopProducts(topProductsArray);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Receita Total',
      value: `R$ ${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
      subtitle: `R$ ${stats.revenueThisMonth.toFixed(2)} este mês`,
    },
    {
      title: 'Total de Pedidos',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'bg-blue-100 text-blue-600',
      subtitle: `${stats.ordersThisMonth} este mês`,
    },
    {
      title: 'Clientes',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
      subtitle: 'Total cadastrados',
    },
    {
      title: 'Produtos',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-orange-100 text-orange-600',
      subtitle: 'No catálogo',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">Visão geral do seu negócio</p>
      </div>

      {stats.pendingOrders > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-yellow-900">
                {stats.pendingOrders} {stats.pendingOrders === 1 ? 'Pedido Pendente' : 'Pedidos Pendentes'}
              </h3>
              <p className="text-yellow-800 mt-1">
                Você tem pedidos aguardando processamento. Clique na aba "Pedidos" para visualizar.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm text-gray-500">{card.subtitle}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#a4240e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Produtos Mais Vendidos</h3>
              <p className="text-sm text-gray-600">Top 5 produtos por quantidade</p>
            </div>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma venda ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#a4240e] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.quantity} unidades vendidas</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#a4240e]">R$ {product.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#a4240e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Resumo do Mês</h3>
              <p className="text-sm text-gray-600">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-700 mb-1">Receita do Mês</p>
              <p className="text-3xl font-bold text-green-900">R$ {stats.revenueThisMonth.toFixed(2)}</p>
              <p className="text-sm text-green-600 mt-2">
                Média: R$ {stats.ordersThisMonth > 0 ? (stats.revenueThisMonth / stats.ordersThisMonth).toFixed(2) : '0.00'} por pedido
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-700 mb-1">Pedidos do Mês</p>
              <p className="text-3xl font-bold text-blue-900">{stats.ordersThisMonth}</p>
              <p className="text-sm text-blue-600 mt-2">
                {stats.pendingOrders > 0
                  ? `${stats.pendingOrders} aguardando processamento`
                  : 'Todos os pedidos processados'}
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm font-medium text-purple-700 mb-1">Taxa de Crescimento</p>
              <p className="text-3xl font-bold text-purple-900">
                {stats.totalOrders > 0
                  ? ((stats.ordersThisMonth / stats.totalOrders) * 100).toFixed(1)
                  : '0'}%
              </p>
              <p className="text-sm text-purple-600 mt-2">Do total de pedidos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
