import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrderTracking, getTrackingUrl, TrackingResult } from '../lib/tracking';
import {
  ArrowLeft, Package, CheckCircle, Clock, Truck,
  MapPin, ExternalLink, RefreshCw, Gift
} from 'lucide-react';

interface OrderDetailProps {
  orderId: string;
}

const STATUS_STEPS = [
  { key: 'created', label: 'Pedido Criado', icon: '📋' },
  { key: 'payment_pending', label: 'Aguardando Pagamento', icon: '⏳' },
  { key: 'payment_approved', label: 'Pagamento Aprovado', icon: '💳' },
  { key: 'invoice_pending', label: 'Em Processamento', icon: '🧾' },
  { key: 'ready_for_shipment', label: 'Preparando Envio', icon: '📦' },
  { key: 'label_generated', label: 'Etiqueta Gerada', icon: '🏷️' },
  { key: 'shipped', label: 'Enviado', icon: '🚚' },
  { key: 'delivered', label: 'Entregue', icon: '✅' },
];

const LEGACY_MAP: Record<string, string> = {
  pending: 'payment_pending',
  paid: 'payment_approved',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

function resolveStatus(order: any): string {
  return order.order_status || LEGACY_MAP[order.status] || 'created';
}

export function OrderDetailPage({ orderId }: OrderDetailProps) {
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, unit_price, products(name, weight_grams, image_url)), shipments(*)`)
        .eq('id', orderId)
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      setOrder(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTracking = async () => {
    if (!order) return;
    setTrackingLoading(true);
    const result = await getOrderTracking(order.id);
    setTracking(result);
    setTrackingLoading(false);
  };

  const goBack = () => {
    window.history.pushState({}, '', '/meu-perfil');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pedido não encontrado</h1>
        <button onClick={goBack} className="mt-4 px-5 py-2.5 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors">
          Voltar
        </button>
      </div>
    </div>
  );

  const status = resolveStatus(order);
  const stepIndex = STATUS_STEPS.findIndex(s => s.key === status);
  const shipment = order.shipments?.[0];
  const trackingCode = shipment?.tracking_code || order.tracking_code;
  const carrier = order.shipping_carrier_name || order.carrier_name || shipment?.carrier_name;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-4">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pedido {order.order_number}</h1>
            <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Status Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-5">Status do Pedido</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, i) => {
              const isPast = i < stepIndex;
              const isCurrent = i === stepIndex;
              const isFuture = i > stepIndex;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    isPast ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                    isCurrent ? 'bg-[#a4240e] text-white border-2 border-[#a4240e]' :
                    'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }`}>
                    {isPast ? <CheckCircle className="w-4 h-4" /> : <span>{step.icon}</span>}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <p className={`text-sm font-medium ${isCurrent ? 'text-[#a4240e]' : isFuture ? 'text-gray-400' : 'text-gray-700'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className="text-xs bg-[#a4240e]/10 text-[#a4240e] px-2 py-0.5 rounded-full font-semibold">Atual</span>
                    )}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`absolute left-[2.6rem] mt-9 w-0.5 h-3 ${isPast ? 'bg-green-300' : 'bg-gray-200'}`} style={{ position: 'relative', marginLeft: '-100%' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Package className="w-5 h-5 text-[#a4240e]" />Produtos</h2>
          <div className="space-y-3">
            {order.order_items?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-xl flex-shrink-0">☕</div>
                  <div>
                    <p className="font-medium text-gray-900">{item.products?.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity} unidade{item.quantity !== 1 ? 's' : ''} × R$ {item.unit_price.toFixed(2)}</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">R$ {(item.unit_price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>R$ {(order.total_amount - (order.shipping_cost || 0)).toFixed(2)}</span>
            </div>
            {order.shipping_cost > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Frete ({carrier || 'a definir'})</span>
                <span>R$ {order.shipping_cost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-[#a4240e]">R$ {order.total_amount?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#a4240e]" />Endereço de Entrega
          </h2>
          {order.is_gift && (
            <div className="flex items-center gap-2 mb-3 text-sm text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
              <Gift className="w-4 h-4" /><span>Presente para <strong>{order.shipping_recipient}</strong></span>
            </div>
          )}
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold">{order.shipping_recipient || order.customer_name}</p>
            {order.address_street && (
              <p>{order.address_street}, {order.address_number}{order.address_complement ? `, ${order.address_complement}` : ''}</p>
            )}
            {order.address_neighborhood && <p>{order.address_neighborhood}</p>}
            {order.address_city && <p>{order.address_city} - {order.address_state}</p>}
            {order.cep && <p className="font-mono text-xs text-gray-500">CEP: {order.cep}</p>}
          </div>
          {carrier && (
            <p className="mt-3 text-sm text-gray-600 pt-3 border-t border-gray-100">
              <Truck className="w-4 h-4 inline mr-1 text-[#a4240e]" />
              Transportadora: <strong>{carrier}</strong>
            </p>
          )}
        </div>

        {/* Tracking */}
        {(trackingCode || status === 'shipped' || status === 'delivered') && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#a4240e]" />Rastreamento
              </h2>
              <div className="flex gap-2">
                {trackingCode && (
                  <a href={getTrackingUrl(trackingCode, carrier || 'correios')} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                    <ExternalLink className="w-4 h-4" /><span>Site da Transportadora</span>
                  </a>
                )}
                {trackingCode && (
                  <button onClick={loadTracking} disabled={trackingLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${trackingLoading ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                )}
              </div>
            </div>

            {trackingCode ? (
              <>
                <p className="text-sm text-gray-600 mb-2">Código: <span className="font-mono font-bold text-gray-900">{trackingCode}</span></p>

                {!tracking && !trackingLoading && (
                  <button onClick={loadTracking}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-[#a4240e] hover:text-[#a4240e] transition-colors">
                    Clique para consultar eventos de rastreamento
                  </button>
                )}

                {trackingLoading && (
                  <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-500">
                    <div className="animate-spin h-4 w-4 border-b-2 border-[#a4240e] rounded-full" />
                    <span>Consultando...</span>
                  </div>
                )}

                {tracking && tracking.events.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {tracking.events.slice(0, 8).map((evt, i) => (
                      <div key={i} className={`flex gap-3 p-3 rounded-lg ${i === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          {i === 0 ? <CheckCircle className="w-4 h-4 text-blue-600" /> : <Clock className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{evt.description}</p>
                          {evt.location && <p className="text-xs text-gray-500">{evt.location}</p>}
                          <p className="text-xs text-gray-400">{evt.date}{evt.time ? ` às ${evt.time}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tracking && tracking.events.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhum evento de rastreamento ainda. Tente novamente mais tarde.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Seu código de rastreamento será disponibilizado quando o pedido for despachado.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
