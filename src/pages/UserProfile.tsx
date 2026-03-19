import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Mail, Phone, Package, Calendar, ArrowLeft, FileText, MapPin, ChevronRight, Truck, Gift } from 'lucide-react';

const STATUS_STEPS = [
  { key: 'created', label: 'Pedido Criado', color: 'bg-gray-400' },
  { key: 'payment_pending', label: 'Ag. Pagamento', color: 'bg-yellow-400' },
  { key: 'payment_approved', label: 'Pago', color: 'bg-blue-500' },
  { key: 'invoice_pending', label: 'Em Preparo', color: 'bg-orange-400' },
  { key: 'ready_for_shipment', label: 'Pronto p/ Envio', color: 'bg-purple-500' },
  { key: 'label_generated', label: 'Embalado', color: 'bg-indigo-500' },
  { key: 'shipped', label: 'Enviado', color: 'bg-cyan-500' },
  { key: 'delivered', label: 'Entregue', color: 'bg-green-500' },
];

const LEGACY_MAP: Record<string, string> = {
  pending: 'payment_pending', paid: 'payment_approved',
  shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled',
};

function resolveStatus(order: any): string {
  return order.order_status || LEGACY_MAP[order.status] || 'created';
}

export function UserProfile() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');

  useEffect(() => { if (user) loadOrders(); }, [user]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, unit_price, products(name, weight_grams)), shipments(tracking_code, carrier_name, status)`)
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

  const openOrderDetail = (orderId: string) => {
    window.history.pushState({}, '', `/meu-pedido/${orderId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!user || !profile) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
        <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h1>
        <p className="text-gray-600 mb-6">Você precisa estar logado para acessar esta página.</p>
        <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
          className="px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors">
          Voltar para Início
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Minha Conta</h1>
              <p className="text-sm text-gray-500">Olá, {profile.full_name?.split(' ')[0]}! 👋</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 p-2">
              <button onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'profile' ? 'bg-[#a4240e] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                <User className="w-5 h-5" /><span>Meus Dados</span>
              </button>
              <button onClick={() => setActiveTab('orders')}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'orders' ? 'bg-[#a4240e] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Package className="w-5 h-5" /><span>Meus Pedidos</span>
                {orders.length > 0 && (
                  <span className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${activeTab === 'orders' ? 'bg-white text-[#a4240e]' : 'bg-[#a4240e] text-white'}`}>{orders.length}</span>
                )}
              </button>
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'profile' ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Informações Pessoais</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: <User className="w-5 h-5 text-[#a4240e]" />, label: 'Nome Completo', value: profile.full_name },
                    { icon: <Mail className="w-5 h-5 text-[#a4240e]" />, label: 'E-mail', value: user.email },
                    (profile as any).phone ? { icon: <Phone className="w-5 h-5 text-[#a4240e]" />, label: 'Telefone', value: (profile as any).phone } : null,
                    { icon: <FileText className="w-5 h-5 text-[#a4240e]" />, label: 'Tipo de Conta', value: (profile as any).account_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física' },
                    (profile as any).cpf ? { icon: <FileText className="w-5 h-5 text-[#a4240e]" />, label: 'CPF', value: (profile as any).cpf } : null,
                    (profile as any).cnpj ? { icon: <FileText className="w-5 h-5 text-[#a4240e]" />, label: 'CNPJ', value: (profile as any).cnpj } : null,
                  ].filter(Boolean).map((item: any, i) => (
                    <div key={i} className="p-4 bg-stone-50 rounded-lg border border-gray-200 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">{item.icon}</div>
                      <div><p className="text-sm text-gray-600">{item.label}</p><p className="font-semibold text-gray-900">{item.value}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Histórico de Pedidos</h2>
                  <button onClick={() => { window.history.pushState({}, '', '/rastrear'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                    className="flex items-center gap-2 px-4 py-2 border border-[#a4240e] text-[#a4240e] rounded-lg text-sm font-semibold hover:bg-[#a4240e]/5 transition-colors">
                    <Truck className="w-4 h-4" /><span>Rastrear por código</span>
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-20">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">Nenhum pedido ainda</p>
                    <p className="text-gray-400 mb-6">Que tal começar a comprar nossos cafés?</p>
                    <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                      className="px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors">Ver Produtos</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const status = resolveStatus(order);
                      const stepIndex = STATUS_STEPS.findIndex(s => s.key === status);
                      const currentStep = STATUS_STEPS[stepIndex] || STATUS_STEPS[0];
                      const shipment = order.shipments?.[0];
                      const trackingCode = shipment?.tracking_code || order.tracking_code;
                      const carrier = order.shipping_carrier_name || order.carrier_name || shipment?.carrier_name;

                      return (
                        <div key={order.id} className="border border-gray-200 rounded-xl hover:shadow-md transition-shadow overflow-hidden">
                          {/* Order Header */}
                          <div className="p-5 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-gray-900">Pedido {order.order_number}</h3>
                                {order.is_gift && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                                    <Gift className="w-3 h-3" />Presente
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${currentStep.color}`}>
                                  {currentStep.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-2xl font-bold text-[#a4240e]">R$ {order.total_amount?.toFixed(2)}</span>
                              <button onClick={() => openOrderDetail(order.id)}
                                className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
                                Ver Detalhes <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Status Progress Bar */}
                          <div className="px-5 pb-4">
                            <div className="flex items-center gap-1">
                              {STATUS_STEPS.slice(0, 7).map((step, i) => (
                                <div key={step.key} className="flex items-center flex-1">
                                  <div className={`h-1.5 rounded-full flex-1 transition-all ${i <= stepIndex ? step.color : 'bg-gray-200'}`} />
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1">
                              <p className="text-xs text-gray-400">Pedido realizado</p>
                              <p className="text-xs text-gray-400">Entregue</p>
                            </div>
                          </div>

                          {/* Tracking strip */}
                          {trackingCode && (
                            <div className="px-5 pb-4">
                              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-blue-700 mb-0.5">
                                    <Truck className="w-3 h-3 inline mr-1" />
                                    {carrier || 'Transportadora'} — Código de Rastreio
                                  </p>
                                  <p className="font-mono font-bold text-blue-900 text-sm">{trackingCode}</p>
                                </div>
                                <button onClick={() => { window.history.pushState({}, '', `/rastrear?code=${trackingCode}&carrier=${carrier || 'correios'}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
                                  <MapPin className="w-3 h-3" />Rastrear
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Product list */}
                          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                            <div className="space-y-1">
                              {order.order_items?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{item.quantity}x {item.products?.name}</span>
                                  <span className="font-medium text-gray-900">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
