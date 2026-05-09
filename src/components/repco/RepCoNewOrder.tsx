import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SEGMENT_LABEL } from '../../constants/segments';

interface Client { id: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string; segment: string | null; forma_pagamento: string | null; }
interface Product { id: string; name: string; image_url: string | null; }
interface PriceEntry { product_id: string; price: number; volume_discount: number; volume_min_qty: number; }
interface OrderItem { product: Product; price: PriceEntry; quantity: number; }
interface Props { repId: string; onOrderCreated?: () => void; }

export function RepCoNewOrder({ repId, onOrderCreated }: Props) {
  const [step, setStep] = useState<'client'|'products'|'review'>('client');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [isPersonalDelivery, setIsPersonalDelivery] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { fetchClients(); }, [repId]);

  async function fetchClients() {
    const { data } = await supabase.from('representative_clients').select('id,razao_social,nome_fantasia,cnpj,segment,forma_pagamento').eq('representative_id', repId).eq('status', 'active').order('razao_social');
    setClients(data || []);
  }

  async function fetchProductsAndPrices(segment: string) {
    setLoading(true);
    const [{ data: prods }, { data: priceData }] = await Promise.all([
      supabase.from('products').select('id,name,image_url').eq('is_active', true).order('name'),
      supabase.from('price_lists').select('product_id,price,volume_discount,volume_min_qty').eq('segment', segment).eq('is_active', true),
    ]);
    setProducts(prods || []);
    setPrices(priceData || []);
    setLoading(false);
  }

  function selectClient(client: Client) {
    setSelectedClient(client);
    setPaymentMethod(client.forma_pagamento || 'pix');
    setItems([]);
    if (client.segment) fetchProductsAndPrices(client.segment);
    setStep('products');
  }

  const getPrice = (pid: string) => prices.find(p => p.product_id === pid);
  const getQty = (pid: string) => items.find(i => i.product.id === pid)?.quantity ?? 0;
  const effectivePrice = (entry: PriceEntry, qty: number) => entry.volume_discount > 0 && qty >= entry.volume_min_qty ? entry.price * (1 - entry.volume_discount / 100) : entry.price;

  function updateQty(product: Product, delta: number) {
    const pe = getPrice(product.id);
    if (!pe) return;
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      const newQty = (existing?.quantity ?? 0) + delta;
      if (newQty <= 0) return prev.filter(i => i.product.id !== product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i);
      return [...prev, { product, price: pe, quantity: 1 }];
    });
  }

  const calcTotal = () => items.reduce((s, item) => s + effectivePrice(item.price, item.quantity) * item.quantity, 0);
  const fmt = (v: string) => v.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');

  async function handleSubmit() {
    if (items.length === 0) { setError('Adicione pelo menos um produto.'); return; }
    if (!selectedClient) return;
    setSubmitting(true); setError('');
    const total = calcTotal();
    const description = items.map(i => `${i.product.name} x${i.quantity} (R$ ${effectivePrice(i.price, i.quantity).toFixed(2)})`).join(', ');
    const { error: err } = await supabase.from('representative_orders').insert({
      representative_id: repId,
      representative_client_id: selectedClient.id,
      description, total_amount: total,
      payment_method: paymentMethod,
      is_personal_delivery: isPersonalDelivery,
      status: 'new',
      notes: notes || null,
    });
    if (err) { setError('Erro ao criar pedido: ' + err.message); setSubmitting(false); return; }
    setSuccess(true); setSubmitting(false); onOrderCreated?.();
  }

  if (success) return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">✅</div>
      <h3 className="text-lg font-semibold text-gray-800">Pedido enviado!</h3>
      <p className="text-sm text-gray-500">O pedido foi registrado e está aguardando processamento.</p>
      <button onClick={() => { setSuccess(false); setStep('client'); setSelectedClient(null); setItems([]); setNotes(''); }}
        className="mt-4 bg-[#a4240e] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c]">Novo Pedido</button>
    </div>
  );

  const stepLabels = ['Cliente', 'Produtos', 'Revisão'];
  const stepKeys = ['client', 'products', 'review'];

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {stepKeys.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-[#a4240e] text-white' : stepKeys.indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
            <span className={step === s ? 'text-[#a4240e]' : 'text-gray-400'}>{stepLabels[i]}</span>
            {i < 2 && <span className="text-gray-300">›</span>}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Step 1: Client */}
      {step === 'client' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selecione o cliente:</p>
          {clients.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">Cadastre clientes primeiro na aba "Clientes"</div> : clients.map(c => (
            <div key={c.id} onClick={() => selectClient(c)} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#a4240e]/40 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-gray-900 text-sm">{c.nome_fantasia || c.razao_social}</p><p className="text-xs text-gray-400">{fmt(c.cnpj)}</p></div>
                {c.segment && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{SEGMENT_LABEL[c.segment] ?? c.segment}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Products */}
      {step === 'products' && selectedClient && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-semibold text-gray-900">{selectedClient.nome_fantasia || selectedClient.razao_social}</p>{selectedClient.segment && <p className="text-xs text-[#a4240e]">{SEGMENT_LABEL[selectedClient.segment]}</p>}</div>
            <button onClick={() => setStep('client')} className="text-xs text-gray-400 hover:text-gray-600">‹ Trocar</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a4240e]"/></div> : (
            <>
              {!selectedClient.segment && <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-xs">Cliente sem segmento — preços podem não estar disponíveis.</div>}
              <div className="space-y-2">
                {products.map(product => {
                  const pe = getPrice(product.id);
                  const qty = getQty(product.id);
                  const ep = pe ? effectivePrice(pe, qty) : null;
                  const hasDisc = pe && pe.volume_discount > 0 && qty >= pe.volume_min_qty;
                  return (
                    <div key={product.id} className={`bg-white border rounded-xl p-3 ${qty > 0 ? 'border-[#a4240e]/40' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">☕</div>}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                          {pe ? <p className={`text-xs font-medium ${hasDisc ? 'text-green-600' : 'text-[#a4240e]'}`}>R$ {ep?.toFixed(2)}{hasDisc && <span className="ml-1 bg-green-50 px-1 rounded">-{pe.volume_discount}%</span>}{pe.volume_discount > 0 && qty < pe.volume_min_qty && <span className="text-gray-400 ml-1">desc. c/ {pe.volume_min_qty}+ un.</span>}</p>
                          : <p className="text-xs text-gray-400">Sem preço p/ este segmento</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {qty > 0 ? (<>
                            <button onClick={() => updateQty(product, -1)} className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-100">−</button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button onClick={() => updateQty(product, 1)} className="w-7 h-7 rounded-full bg-[#a4240e] text-white flex items-center justify-center text-sm hover:bg-[#8a1f0c]">+</button>
                          </>) : <button onClick={() => pe && updateQty(product, 1)} disabled={!pe} className="px-3 py-1.5 bg-[#a4240e] text-white rounded-lg text-xs font-semibold hover:bg-[#8a1f0c] disabled:opacity-30 disabled:cursor-not-allowed">Adicionar</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {items.length > 0 && (
                <div className="sticky bottom-0 bg-white border border-[#a4240e]/30 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">{items.reduce((s, i) => s + i.quantity, 0)} itens</p><p className="font-bold text-[#a4240e]">R$ {calcTotal().toFixed(2)}</p></div>
                    <button onClick={() => setStep('review')} className="bg-[#a4240e] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c]">Revisar ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && selectedClient && (
        <div className="space-y-4">
          <button onClick={() => setStep('products')} className="text-xs text-gray-400 hover:text-gray-600">‹ Voltar</button>
          <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-1">Cliente</p><p className="font-semibold text-gray-900">{selectedClient.nome_fantasia || selectedClient.razao_social}</p>{selectedClient.segment && <p className="text-xs text-[#a4240e]">{SEGMENT_LABEL[selectedClient.segment]}</p>}</div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase">Itens</p>
            {items.map(item => { const ep = effectivePrice(item.price, item.quantity); return (
              <div key={item.product.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                <div><p className="text-sm text-gray-800">{item.product.name}</p><p className="text-xs text-gray-400">R$ {ep.toFixed(2)} × {item.quantity}</p></div>
                <p className="text-sm font-semibold text-gray-900">R$ {(ep * item.quantity).toFixed(2)}</p>
              </div>
            ); })}
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold"><span className="text-gray-700">Total</span><span className="text-[#a4240e]">R$ {calcTotal().toFixed(2)}</span></div>
          </div>
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none">
                <option value="pix">PIX</option><option value="boleto">Boleto</option><option value="a_vista">À Vista</option>
              </select></div>
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <input type="checkbox" id="pd" checked={isPersonalDelivery} onChange={e => setIsPersonalDelivery(e.target.checked)} className="w-4 h-4 accent-[#a4240e]"/>
              <label htmlFor="pd" className="text-sm text-amber-800 cursor-pointer">Entrega pessoal (+2,5% bônus na comissão)</label>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Instruções especiais..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none resize-none"/></div>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="w-full bg-[#a4240e] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#8a1f0c] disabled:opacity-50 transition-colors">
            {submitting ? 'Enviando...' : `Confirmar Pedido — R$ ${calcTotal().toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  );
}
