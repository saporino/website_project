import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Mail, Phone, MapPin, Package, Calendar, CreditCard, ArrowLeft, FileText } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  tracking_code: string;
  carrier_name: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    products: { name: string; weight_grams: number };
  }>;
}

export function UserProfile() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            unit_price,
            products (name, weight_grams)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
          <p className="text-gray-600 mb-6">Você precisa estar logado para acessar esta página.</p>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
          >
            Voltar para Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
                <p className="text-sm text-gray-500">Gerencie seus dados e pedidos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 p-2">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'profile'
                    ? 'bg-[#a4240e] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <User className="w-5 h-5" />
                <span>Meus Dados</span>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === 'orders'
                    ? 'bg-[#a4240e] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Package className="w-5 h-5" />
                <span>Meus Pedidos</span>
                {orders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-white text-[#a4240e] text-xs font-bold rounded-full">
                    {orders.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'profile' ? (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Informações Pessoais</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-[#a4240e]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Nome Completo</p>
                          <p className="font-semibold text-gray-900">{profile.full_name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <Mail className="w-5 h-5 text-[#a4240e]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">E-mail</p>
                          <p className="font-semibold text-gray-900">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {profile.phone && (
                      <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <Phone className="w-5 h-5 text-[#a4240e]" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Telefone</p>
                            <p className="font-semibold text-gray-900">{profile.phone}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#a4240e]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Tipo de Conta</p>
                          <p className="font-semibold text-gray-900">
                            {profile.account_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {profile.cpf && (
                      <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#a4240e]" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">CPF</p>
                            <p className="font-semibold text-gray-900">{profile.cpf}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {profile.cnpj && (
                      <div className="p-4 bg-stone-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-[#a4240e]" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">CNPJ</p>
                            <p className="font-semibold text-gray-900">{profile.cnpj}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Histórico de Pedidos</h2>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-20">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">Nenhum pedido ainda</p>
                    <p className="text-gray-400 mb-6">Que tal começar a comprar nossos cafés?</p>
                    <button
                      onClick={() => {
                        window.history.pushState({}, '', '/');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
                    >
                      Ver Produtos
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              Pedido {order.order_number}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className={`px-3 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right mt-4 lg:mt-0">
                            <p className="text-sm text-gray-600">Total</p>
                            <p className="text-3xl font-bold text-[#a4240e]">
                              R$ {order.total_amount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Produtos:</p>
                          {order.order_items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2">
                              <p className="text-gray-900">
                                {item.quantity}x {item.products.name} ({item.products.weight_grams}g)
                              </p>
                              <p className="font-semibold text-gray-900">
                                R$ {(item.quantity * item.unit_price).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>

                        {order.tracking_code && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <MapPin className="w-5 h-5 text-blue-600" />
                              <p className="font-semibold text-blue-900">Rastreamento</p>
                            </div>
                            <p className="text-sm text-blue-800">
                              <strong>Transportadora:</strong> {order.carrier_name || 'N/A'}
                            </p>
                            <p className="text-sm font-mono font-bold text-blue-900 mt-1">
                              {order.tracking_code}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
