import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CLIENT_SEGMENTS, MARKETPLACE_SEGMENTS, SUPERMARKET_SEGMENTS, SEGMENT_LABEL } from '../../constants/segments';
import EcommercePriceIntel from './EcommercePriceIntel';
import MarketOverviewSP from './MarketOverviewSP';

const SUPER_OVERVIEW = 'super_todos';

// segmento de marketplace (UI) -> chave do marketplace na inteligência de preços
const MARKETPLACE_KEY: Record<string, { key: string; label: string }> = {
  mercado_livre: { key: 'mercadolivre', label: 'Mercado Livre' },
  amazon: { key: 'amazon', label: 'Amazon' },
  shopee: { key: 'shopee', label: 'Shopee' },
  tiktok_shop: { key: 'tiktok', label: 'TikTok Shop' },
};

// segmento de supermercado SP (UI) -> chave da fonte na inteligência de preços (mesma chave do banco)
const SUPER_KEY: Record<string, { key: string; label: string }> = Object.fromEntries(
  SUPERMARKET_SEGMENTS.map(s => [s.value, { key: s.value, label: s.label }])
);
const INTEL_KEY: Record<string, { key: string; label: string }> = { ...MARKETPLACE_KEY, ...SUPER_KEY };

interface Product { id: string; name: string; image_url: string | null; price: number; is_active: boolean; }
interface PriceListEntry { id: string; product_id: string; segment: string; price: number; volume_discount: number; volume_min_qty: number; is_active: boolean; }
interface Props { fixedSegment?: string; refreshKey?: number; }

export default function PriceListManager({ fixedSegment, refreshKey = 0 }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListEntry[]>([]);
  const [selectedSegment, setSelectedSegment] = useState(fixedSegment ?? CLIENT_SEGMENTS[0].value);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { price: string; volume_discount: string; volume_min_qty: string }>>({});
  const [saved, setSaved] = useState<string | null>(null);

  // If fixedSegment changes from parent, sync it
  useEffect(() => { if (fixedSegment) setSelectedSegment(fixedSegment); }, [fixedSegment]);
  useEffect(() => { fetchData(); }, [refreshKey]);
  useEffect(() => {
    function handleRefresh() {
      fetchData();
    }
    window.addEventListener('admin:price-list-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('admin:price-list-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: prods }, { data: prices }] = await Promise.all([
      supabase.from('products').select('id,name,image_url,price,is_active').eq('is_active', true).order('name'),
      supabase.from('price_lists').select('*'),
    ]);
    if (prods) setProducts(prods);
    if (prices) {
      setPriceLists(prices);
      const vals: typeof editValues = {};
      prices.forEach(p => { vals[`${p.product_id}_${p.segment}`] = { price: p.price.toFixed(2), volume_discount: p.volume_discount.toFixed(2), volume_min_qty: String(p.volume_min_qty) }; });
      setEditValues(vals);
    }
    setLoading(false);
  }

  const getKey = (pid: string, seg: string) => `${pid}_${seg}`;
  const getEntry = (pid: string, seg: string) => priceLists.find(p => p.product_id === pid && p.segment === seg);
  const getVal = (pid: string, seg: string) => { const k = getKey(pid, seg); const prod = products.find(p => p.id === pid); return editValues[k] ?? { price: prod?.price.toFixed(2) ?? '0.00', volume_discount: '0.00', volume_min_qty: '1' }; };

  function handleChange(pid: string, seg: string, field: string, value: string) {
    const k = getKey(pid, seg);
    setEditValues(prev => ({ ...prev, [k]: { ...getVal(pid, seg), [field]: value } }));
  }

  async function handleSave(pid: string, seg: string) {
    const k = getKey(pid, seg);
    const vals = getVal(pid, seg);
    const price = parseFloat(vals.price);
    if (isNaN(price) || price <= 0) return;
    setSaving(k);
    const existing = getEntry(pid, seg);
    const payload = { price, volume_discount: parseFloat(vals.volume_discount) || 0, volume_min_qty: parseInt(vals.volume_min_qty) || 1, is_active: true };
    if (existing) await supabase.from('price_lists').update(payload).eq('id', existing.id);
    else await supabase.from('price_lists').insert({ product_id: pid, segment: seg, ...payload });
    await fetchData();
    window.dispatchEvent(new CustomEvent('admin:price-list-updated'));
    setSaving(null); setSaved(k); setTimeout(() => setSaved(null), 2000);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  return (
    <div className="space-y-5">
      {/* Segment selector — hidden when fixedSegment is provided */}
      {!fixedSegment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Representantes B2B</p>
            <div className="flex flex-wrap gap-2">
              {CLIENT_SEGMENTS.map(seg => (
                <button key={seg.value} onClick={() => setSelectedSegment(seg.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSegment === seg.value ? 'bg-[#a4240e] text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                  {seg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-amber-200 pt-3">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Marketplaces</p>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_SEGMENTS.map(seg => (
                <button key={seg.value} onClick={() => setSelectedSegment(seg.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSegment === seg.value ? 'bg-purple-700 text-white' : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'}`}>
                  {seg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-amber-200 pt-3">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Supermercados SP</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedSegment(SUPER_OVERVIEW)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${selectedSegment === SUPER_OVERVIEW ? 'bg-teal-800 text-white' : 'bg-teal-700 text-white hover:bg-teal-800'}`}>
                ★ Todas (visão geral)
              </button>
              {SUPERMARKET_SEGMENTS.map(seg => (
                <button key={seg.value} onClick={() => setSelectedSegment(seg.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedSegment === seg.value ? 'bg-teal-700 text-white' : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                  {seg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {fixedSegment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-amber-700 font-medium">Segmento fixo:</span>
          <span className="text-sm font-semibold text-amber-900">{SEGMENT_LABEL[fixedSegment] ?? fixedSegment}</span>
        </div>
      )}

      {/* Visão geral de todos os supermercados SP + posição dos nossos cafés */}
      {selectedSegment === SUPER_OVERVIEW && (
        <div className="border border-gray-200 rounded-xl p-4 bg-[#f8f7f5]">
          <MarketOverviewSP />
        </div>
      )}

      {/* Marketplace/Supermercado selecionado -> painel de inteligência de preços (concorrentes) */}
      {INTEL_KEY[selectedSegment] && (
        <div className="border border-gray-200 rounded-xl p-4 bg-[#f8f7f5]">
          <EcommercePriceIntel marketplace={INTEL_KEY[selectedSegment].key} label={INTEL_KEY[selectedSegment].label} />
        </div>
      )}

      {/* Tabela de preços da Saporino só faz sentido p/ segmentos de venda (B2B/marketplace), não p/ supermercado concorrente */}
      {!SUPER_KEY[selectedSegment] && selectedSegment !== SUPER_OVERVIEW && (<>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">Tabela de Preços — {SEGMENT_LABEL[selectedSegment] ?? selectedSegment}</h4>
        <span className="text-xs text-gray-500">{products.length} produtos</span>
      </div>

      <div className="space-y-2">
        {products.map(product => {
          const k = getKey(product.id, selectedSegment);
          const vals = getVal(product.id, selectedSegment);
          const isSaving = saving === k;
          const isSaved = saved === k;
          const hasEntry = !!getEntry(product.id, selectedSegment);
          const priceNum = parseFloat(vals.price) || 0;
          const discountNum = parseFloat(vals.volume_discount) || 0;
          const finalPrice = priceNum * (1 - discountNum / 100);

          return (
            <div key={product.id} className={`bg-white border rounded-xl p-4 transition-all ${hasEntry ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">☕</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">Base: R$ {product.price.toFixed(2)}{hasEntry && <span className="ml-2 text-green-600 font-medium">✓ preço definido</span>}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-center"><label className="block text-xs text-gray-500 mb-1">Preço (R$)</label><input type="number" value={vals.price} onChange={e => handleChange(product.id, selectedSegment, 'price', e.target.value)} step="0.01" min="0" className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-[#a4240e] outline-none"/></div>
                  <div className="text-center"><label className="block text-xs text-gray-500 mb-1">Desc.vol.(%)</label><input type="number" value={vals.volume_discount} onChange={e => handleChange(product.id, selectedSegment, 'volume_discount', e.target.value)} step="0.5" min="0" max="100" className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-[#a4240e] outline-none"/></div>
                  <div className="text-center"><label className="block text-xs text-gray-500 mb-1">Qtd mín.</label><input type="number" value={vals.volume_min_qty} onChange={e => handleChange(product.id, selectedSegment, 'volume_min_qty', e.target.value)} step="1" min="1" className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-[#a4240e] outline-none"/></div>
                  {discountNum > 0 && <div className="text-center"><label className="block text-xs text-gray-500 mb-1">Com desc.</label><div className="w-20 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 text-sm text-center text-green-700 font-medium">R$ {finalPrice.toFixed(2)}</div></div>}
                  <div className="text-center"><label className="block text-xs text-transparent mb-1">-</label>
                    <button onClick={() => handleSave(product.id, selectedSegment)} disabled={isSaving}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isSaved ? 'bg-green-500 text-white' : 'bg-[#a4240e] text-white hover:bg-[#8a1f0c] disabled:opacity-50'}`}>
                      {isSaving ? '...' : isSaved ? '✓' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}
