import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getTrackingEvents, getTrackingUrl, TrackingResult } from '../lib/tracking';
import { Search, Truck, CheckCircle, Clock, Package, ArrowLeft, ExternalLink, FileText } from 'lucide-react';

const CARRIER_OPTIONS = [
  { value: 'correios', label: 'Correios' },
  { value: 'jadlog', label: 'Jadlog' },
  { value: 'bbm', label: 'BBM Logística' },
  { value: 'total-express', label: 'Total Express' },
];

const ORDER_PREFIXES = ['PF', 'PJ', 'RC', 'ML', 'SH', 'AZ', 'TK'];

interface OrderResult {
  order_number: string;
  status: string;
  customer_name?: string;
  created_at: string;
  paid_at?: string;
  completed_at?: string;
  order_type?: string;
  client_name?: string;
}

const STATUS_STEPS = [
  { key: 'created', label: 'Criado', icon: FileText },
  { key: 'paid', label: 'Pago', icon: CheckCircle },
  { key: 'processing', label: 'Em separação', icon: Package },
  { key: 'shipped', label: 'Enviado', icon: Truck },
  { key: 'delivered', label: 'Entregue', icon: CheckCircle },
];

function getStatusIndex(status: string): number {
  const map: Record<string, number> = {
    new: 0, pending: 0, created: 0,
    paid: 1, confirmed: 1, approved: 1,
    processing: 2, preparing: 2,
    shipped: 3, in_transit: 3, sent: 3,
    delivered: 4, completed: 4,
  };
  return map[status] ?? 0;
}

export function TrackingPage() {
  const [code, setCode] = useState('');
  const [searchMode, setSearchMode] = useState<'tracking' | 'order'>('order');
  const [carrier, setCarrier] = useState('correios');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  const isOrderNumber = (input: string) => {
    const upper = input.toUpperCase().trim();
    return ORDER_PREFIXES.some(p => upper.startsWith(p) && /^\d+$/.test(upper.slice(p.length)));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    setOrderResult(null);
    setSearchError('');

    const normalized = code.trim().toUpperCase();

    // Auto-detect: if it looks like an order number, search by order
    if (searchMode === 'order' || isOrderNumber(normalized)) {
      await searchByOrderNumber(normalized);
    } else {
      await searchByTrackingCode(normalized);
    }

    setLoading(false);
  };

  async function searchByOrderNumber(orderNum: string) {
    // Try site orders first
    const { data: siteOrder } = await supabase
      .from('orders')
      .select('order_number, status, customer_name, created_at, paid_at, order_type')
      .eq('order_number', orderNum)
      .single();

    if (siteOrder) {
      setOrderResult({
        order_number: siteOrder.order_number,
        status: siteOrder.status,
        customer_name: siteOrder.customer_name,
        created_at: siteOrder.created_at,
        paid_at: siteOrder.paid_at,
        order_type: siteOrder.order_type,
      });
      return;
    }

    // Try RepCo orders
    const { data: repcoOrder } = await supabase
      .from('representative_orders')
      .select('order_number, status, created_at, completed_at, representative_clients(nome_fantasia, razao_social)')
      .eq('order_number', orderNum)
      .single();

    if (repcoOrder) {
      const client = repcoOrder.representative_clients as any;
      setOrderResult({
        order_number: repcoOrder.order_number,
        status: repcoOrder.status,
        created_at: repcoOrder.created_at,
        completed_at: repcoOrder.completed_at,
        client_name: client?.nome_fantasia || client?.razao_social || undefined,
      });
      return;
    }

    setSearchError('Pedido não encontrado. Verifique o número e tente novamente.');
  }

  async function searchByTrackingCode(trackingCode: string) {
    try {
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('*, orders(order_number, customer_name)')
        .eq('tracking_code', trackingCode)
        .limit(1)
        .single();

      const effectiveCarrier = shipmentData?.carrier_name || carrier;
      const trackResult = await getTrackingEvents(trackingCode, effectiveCarrier);
      setResult(trackResult);
    } catch {
      const trackResult = await getTrackingEvents(trackingCode, carrier);
      setResult(trackResult);
    }
  }

  const statusIdx = orderResult ? getStatusIndex(orderResult.status) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-4">
          <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rastrear Pedido</h1>
            <p className="text-sm text-gray-500">Acompanhe sua entrega em tempo real</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Search Form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#a4240e]/10 flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#a4240e]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Consultar Pedido</h2>
              <p className="text-sm text-gray-500">Digite o número do pedido ou código de rastreio</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
            <button
              onClick={() => setSearchMode('order')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                searchMode === 'order' ? 'bg-white text-[#a4240e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📦 Nº do Pedido
            </button>
            <button
              onClick={() => setSearchMode('tracking')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                searchMode === 'tracking' ? 'bg-white text-[#a4240e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🚚 Código de Rastreio
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {searchMode === 'order' ? 'Número do Pedido' : 'Código de Rastreamento'}
              </label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={searchMode === 'order' ? 'Ex: PF000001, RC000001, PJ000001' : 'Ex: BR123456789BR ou JD00000000000BR'}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all" />
            </div>
            {searchMode === 'tracking' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Transportadora</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
                  {CARRIER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            )}
            <button type="submit" disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#a4240e] text-white rounded-xl font-semibold hover:bg-[#8a1f0c] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full" /><span>Consultando...</span></>
              ) : (
                <><Search className="w-5 h-5" /><span>Rastrear</span></>
              )}
            </button>
          </form>
        </div>

        {/* Order Result */}
        {searched && !loading && orderResult && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{orderResult.order_number}</h3>
                {orderResult.customer_name && <p className="text-sm text-gray-500">{orderResult.customer_name}</p>}
                {orderResult.client_name && <p className="text-sm text-gray-500">{orderResult.client_name}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Criado em {new Date(orderResult.created_at).toLocaleDateString('pt-BR')} às {new Date(orderResult.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                statusIdx >= 4 ? 'bg-green-100 text-green-700' :
                statusIdx >= 3 ? 'bg-blue-100 text-blue-700' :
                statusIdx >= 1 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {STATUS_STEPS[Math.min(statusIdx, 4)].label}
              </span>
            </div>

            {/* Status Timeline */}
            <div className="flex items-center justify-between relative">
              {/* Progress bar background */}
              <div className="absolute top-5 left-6 right-6 h-1 bg-gray-200 rounded-full" />
              {/* Progress bar fill */}
              <div
                className="absolute top-5 left-6 h-1 bg-[#a4240e] rounded-full transition-all duration-500"
                style={{ width: `calc(${(statusIdx / 4) * 100}% - 48px)` }}
              />

              {STATUS_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i <= statusIdx;
                const isCurrent = i === statusIdx;
                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: '20%' }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCurrent ? 'bg-[#a4240e] text-white ring-4 ring-[#a4240e]/20' :
                      isActive ? 'bg-[#a4240e] text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs mt-2 font-medium text-center ${isActive ? 'text-[#a4240e]' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {orderResult.paid_at && (
              <p className="text-xs text-green-600 mt-4">
                ✅ Pagamento confirmado em {new Date(orderResult.paid_at).toLocaleDateString('pt-BR')}
              </p>
            )}
            {orderResult.completed_at && (
              <p className="text-xs text-green-600 mt-1">
                ✅ Concluído em {new Date(orderResult.completed_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Search Error */}
        {searched && !loading && searchError && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Pedido não encontrado</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">{searchError}</p>
            </div>
          </div>
        )}

        {/* Tracking Code Results */}
        {searched && !loading && !orderResult && !searchError && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {result?.error || result?.events.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum evento encontrado</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Pode ser que o objeto ainda não tenha sido postado ou o código esteja incorreto.
                  Tente novamente em algumas horas.
                </p>
              </div>
            ) : result && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{result.code}</h3>
                    <p className="text-sm text-gray-500">{CARRIER_OPTIONS.find(c => c.value === result.carrier)?.label || result.carrier}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={getTrackingUrl(result.code, result.carrier)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors font-medium">
                      <ExternalLink className="w-4 h-4" /><span>Site oficial</span>
                    </a>
                  </div>
                </div>

                {result.isDelivered && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm font-semibold text-green-800">📦 Objeto entregue ao destinatário!</p>
                  </div>
                )}

                <div className="space-y-3">
                  {result.events.map((evt, i) => (
                    <div key={i} className={`flex gap-3 p-4 rounded-xl ${i === 0 ? 'bg-[#a4240e]/5 border border-[#a4240e]/20' : 'bg-gray-50'}`}>
                      <div className="flex-shrink-0 mt-1">
                        {i === 0
                          ? <CheckCircle className="w-5 h-5 text-[#a4240e]" />
                          : <Clock className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${i === 0 ? 'text-[#a4240e]' : 'text-gray-900'}`}>{evt.description}</p>
                        {evt.location && <p className="text-xs text-gray-500 mt-0.5">📍 {evt.location}</p>}
                        <p className="text-xs text-gray-400 mt-1">{evt.date}{evt.time ? ` às ${evt.time}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Info */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">💡 Informações</h3>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li>• Digite o número do pedido (ex: PF000001) para ver o status</li>
            <li>• Para rastrear a entrega, use o código de rastreio da transportadora</li>
            <li>• O código de rastreamento é enviado por e-mail após o despacho</li>
            <li>• Atualizações podem levar até 24h para aparecer</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
