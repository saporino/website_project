import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getTrackingEvents, getTrackingUrl, TrackingResult } from '../lib/tracking';
import { Search, Truck, CheckCircle, Clock, Package, ArrowLeft, ExternalLink } from 'lucide-react';

const CARRIER_OPTIONS = [
  { value: 'correios', label: 'Correios' },
  { value: 'jadlog', label: 'Jadlog' },
  { value: 'bbm', label: 'BBM Logística' },
  { value: 'total-express', label: 'Total Express' },
];

export function TrackingPage() {
  const [code, setCode] = useState('');
  const [carrier, setCarrier] = useState('correios');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setSearched(true);
    setResult(null);

    // First try to find by order tracking code in DB
    try {
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('*, orders(order_number, customer_name)')
        .eq('tracking_code', code.trim().toUpperCase())
        .limit(1)
        .single();

      const effectiveCarrier = shipmentData?.carrier_name || carrier;
      const trackResult = await getTrackingEvents(code.trim(), effectiveCarrier);
      setResult(trackResult);
    } catch {
      const trackResult = await getTrackingEvents(code.trim(), carrier);
      setResult(trackResult);
    }

    setLoading(false);
  };

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
              <h2 className="font-bold text-gray-900">Consultar Rastreamento</h2>
              <p className="text-sm text-gray-500">Digite o código de rastreio do seu pedido</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código de Rastreamento</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: BR123456789BR ou JD00000000000BR"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl font-mono text-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Transportadora</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
                {CARRIER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
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

        {/* Results */}
        {searched && !loading && (
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
            <li>• O código de rastreamento é enviado por e-mail após o despacho</li>
            <li>• Atualizações podem levar até 24h para aparecer</li>
            <li>• Para pedidos com conta, acesse <strong>Meu Perfil → Meus Pedidos</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
