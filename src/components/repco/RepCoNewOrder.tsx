import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SEGMENT_LABEL } from '../../constants/segments';
import { useCompany } from '../../contexts/CompanyContext';
import BoletoCombinationPicker from './BoletoCombinationPicker';

type FiscalOrderType = 'resale' | 'taxpayer_consumer' | 'non_taxpayer_consumer';

interface Client {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  segment: string | null;
  forma_pagamento: string | null;
  default_fiscal_order_type: FiscalOrderType | null;
}
interface Product { id: string; name: string; image_url: string | null; stock: number; in_stock: boolean; }
interface PriceEntry { product_id: string; segment: string; price: number; volume_discount: number; volume_min_qty: number; }
interface OrderItem { product: Product; price: PriceEntry; quantity: number; unit: 'pacote' | 'fardo'; }
interface Props { representativeId: string; onOrderCreated?: () => void; preSelectedClientId?: string | null; }

const FISCAL_ORDER_LABEL: Record<FiscalOrderType, string> = {
  resale: 'Revenda',
  taxpayer_consumer: 'Consumidor contribuinte',
  non_taxpayer_consumer: 'Consumidor não contribuinte',
};

function StockIndicator({ stock, inStock }: { stock: number; inStock: boolean }) {
  if (!inStock || stock === 0) return <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/><span className="text-xs text-red-500 font-medium">Esgotado</span></span>;
  if (stock <= 10) return <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"/><span className="text-xs text-yellow-600">{stock} un. restantes</span></span>;
  return <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/><span className="text-xs text-gray-500">{stock} un.</span></span>;
}

export default function RepCoNewOrder({ representativeId, onOrderCreated, preSelectedClientId }: Props) {
  const { activeCompanyId, activeCompany } = useCompany();
  const [step, setStep] = useState<'client'|'products'|'review'>('client');
  const [clients, setClients] = useState<Client[]>([]);
  const [blocked, setBlocked] = useState<Record<string, string>>({});
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pix'); // à vista: 'pix' ou 'dinheiro'
  const [isPersonalDelivery, setIsPersonalDelivery] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [clientOrderNumber, setClientOrderNumber] = useState('');
  const [hasClientOrderNumber, setHasClientOrderNumber] = useState(true);
  const [paymentTerm, setPaymentTerm] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [, setPaymentTerms] = useState<number[]>([0,7,14,21,28,30]);
  const [boletoOffsets, setBoletoOffsets] = useState<number[]>([]);
  const [fiscalOrderType, setFiscalOrderType] = useState<FiscalOrderType>('non_taxpayer_consumer');

  useEffect(() => { if (activeCompanyId) fetchClients(); }, [representativeId, activeCompanyId]);
  // Empresa que não aceita dinheiro (ex.: Fazendinha) nunca fica em "dinheiro".
  useEffect(() => { if (activeCompany && !activeCompany.allow_cash && paymentMethod === 'dinheiro') setPaymentMethod('pix'); }, [activeCompany, paymentMethod]);
  useEffect(() => {
    if (preSelectedClientId && clients.length > 0) {
      const c = clients.find(c => c.id === preSelectedClientId);
      if (c) selectClient(c);
    }
  }, [preSelectedClientId, clients]);

  async function fetchClients() {
    const { data } = await supabase.from('representative_clients').select('id,razao_social,nome_fantasia,cnpj,cpf,segment,forma_pagamento,prazo_pagamento,default_fiscal_order_type').eq('representative_id', representativeId).eq('company_id', activeCompanyId).eq('status','active').order('razao_social');
    if (data) setClients(data);
    const { data: blk } = await supabase.from('vw_repco_clientes_bloqueados').select('client_id,vencido_em');
    const map: Record<string, string> = {};
    (blk || []).forEach((b: any) => { map[b.client_id] = b.vencido_em; });
    setBlocked(map);
  }

  async function fetchProductsAndPrices(segment: string) {
    setLoading(true);
    setError('');
    setProducts([]);
    setPrices([]);
    const [{ data: prods }, { data: priceData }, { data: termsData }] = await Promise.all([
      supabase.from('products').select('id,name,image_url,stock,in_stock').eq('is_active', true).eq('company_id', activeCompanyId).order('name'),
      supabase.from('price_lists').select('product_id,segment,price,volume_discount,volume_min_qty').eq('segment', segment).eq('company_id', activeCompanyId).eq('is_active', true),
      supabase.from('segment_payment_terms').select('payment_terms').eq('segment', segment).single(),
    ]);
    if (prods) setProducts(prods);
    if (priceData) setPrices(priceData);
    if (prods?.length && (!priceData || priceData.length === 0)) {
      setError(`Nenhum preço encontrado para o segmento ${SEGMENT_LABEL[segment] ?? segment}. Ajuste a Tabela de Preços Global antes de criar o pedido.`);
    }
    if ((termsData as any)?.payment_terms) setPaymentTerms((termsData as any).payment_terms);
    setLoading(false);
  }

  function selectClient(client: Client) {
    setError('');
    if (blocked[client.id]) {
      setError(`Cliente bloqueado — boleto vencido em ${new Date(blocked[client.id] + 'T12:00:00').toLocaleDateString('pt-BR')}. Anexe o comprovante de pagamento para liberar novos pedidos.`);
      return;
    }
    setItems([]);
    setProducts([]);
    setPrices([]);
    if (!client.segment) {
      setSelectedClient(null);
      setError('Este cliente não tem segmento definido. Edite o cadastro do cliente e selecione um segmento antes de criar pedido.');
      return;
    }
    setSelectedClient(client); setPaymentMethod(client.forma_pagamento || 'pix');
    const _prazo: string = ((client as any).prazo_pagamento as string) || '';
    const _prazoNums = (client.forma_pagamento || '').toLowerCase() === 'boleto'
      ? (_prazo.match(/\d+/g)?.map(Number).filter((n: number) => n > 0) || [])
      : [];
    setBoletoOffsets(_prazoNums);
    setPaymentTerm(_prazoNums.length ? _prazoNums[_prazoNums.length - 1] : 0);
    setFiscalOrderType(client.default_fiscal_order_type || (hasValidCnpj(client) ? 'resale' : 'non_taxpayer_consumer'));
    fetchProductsAndPrices(client.segment);
    setStep('products');
  }

  const getPrice = (pid: string) => prices.find(p => p.product_id === pid && p.segment === selectedClient?.segment);
  const getQty = (pid: string) => items.find(i => i.product.id === pid)?.quantity ?? 0;
  const effectivePrice = (pe: PriceEntry, qty: number) => pe.volume_discount > 0 && qty >= pe.volume_min_qty ? pe.price * (1 - pe.volume_discount / 100) : pe.price;

  const UNITS_PER_BUNDLE = 10;
  const [unitByProduct, setUnitByProduct] = useState<Record<string, 'pacote' | 'fardo'>>({});
  const cartUnit = (p: Product): 'pacote' | 'fardo' => items.find(i => i.product.id === p.id)?.unit ?? unitByProduct[p.id] ?? 'pacote';
  const stepOf = (p: Product) => (cartUnit(p) === 'fardo' ? UNITS_PER_BUNDLE : 1);
  const plusDisabled = (p: Product) => { const qn = getQty(p.id); return cartUnit(p) === 'fardo' ? (qn + UNITS_PER_BUNDLE > p.stock) : (qn >= p.stock); };
  function updateQty(product: Product, delta: number, unit: 'pacote' | 'fardo' = 'pacote') {
    if (!product.in_stock || product.stock === 0) return;
    const pe = getPrice(product.id);
    if (!pe) {
      setError('Este produto não tem preço para o segmento do cliente na Tabela de Preços Global.');
      return;
    }
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      const newQty = Math.max(0, Math.min((existing?.quantity ?? 0) + delta, product.stock));
      if (newQty <= 0) return prev.filter(i => i.product.id !== product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i);
      return [...prev, { product, price: pe, quantity: newQty, unit }];
    });
  }

  const calcTotal = () => items.reduce((s, item) => s + effectivePrice(item.price, item.quantity) * item.quantity, 0);
  const fmt = (v: string) => v.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
  const getDigits = (value: string | null | undefined) => value?.replace(/\D/g, '') ?? '';
  const hasValidCnpj = (client: Client) => getDigits(client.cnpj).length === 14;
  const fiscalTypeRequiresCnpj = (type: FiscalOrderType) => type === 'resale' || type === 'taxpayer_consumer';

  async function handleSubmit() {
    if (items.length === 0) { setError('Adicione pelo menos um produto.'); return; }
    if (!selectedClient) return;
    if (!selectedClient.segment) {
      setError('Este cliente não tem segmento definido. Edite o cadastro do cliente e selecione um segmento antes de enviar o pedido.');
      return;
    }
    if (fiscalTypeRequiresCnpj(fiscalOrderType) && !hasValidCnpj(selectedClient)) {
      setError('Revenda e Consumidor contribuinte exigem CNPJ. Para cliente CPF, use Consumidor não contribuinte.');
      return;
    }

    const fiscalLabel = FISCAL_ORDER_LABEL[fiscalOrderType];
    const confirmed = window.confirm(
      `Confirmar envio do pedido como "${fiscalLabel}"?\n\nEssa escolha será salva como padrão para o próximo pedido deste cliente.`
    );
    if (!confirmed) return;

    setSubmitting(true); setError('');
    const originalAmount = calcTotal();
    const finalAmount = originalAmount * (1 - discountPercentage / 100);
    const description = items.map(i => `${i.product.name} x${i.quantity} (R$ ${effectivePrice(i.price, i.quantity).toFixed(2)})`).join(', ');

    const { data: createdOrder, error: err } = await supabase.from('representative_orders').insert({
      representative_id: representativeId,
      representative_client_id: selectedClient.id,
      company_id: activeCompanyId,
      description,
      total_amount: finalAmount,
      original_amount: originalAmount,
      discount_percentage: discountPercentage,
      payment_method: paymentTerm === 0 ? paymentMethod : 'boleto',
      payment_term: paymentTerm,
      is_personal_delivery: isPersonalDelivery,
      client_order_number: hasClientOrderNumber ? (clientOrderNumber || null) : null,
      has_client_order_number: hasClientOrderNumber,
      pix_bonus_eligible: paymentTerm === 0 && paymentMethod === 'pix' && activeCompany?.commission_model === 'formula',
      channel: 'repco',
      status: 'new',
      fiscal_order_type: fiscalOrderType,
      notes: notes || null,
    }).select('id').single();
    if (err || !createdOrder) {
      setSubmitting(false);
      setError('Erro ao enviar pedido. Tente novamente.');
      return;
    }
    const itemRows = items.map(i => ({
      order_id: createdOrder.id,
      product_id: i.product.id,
      representative_id: representativeId,
      quantity: i.quantity,
      unit: i.unit,
      unit_price: effectivePrice(i.price, i.quantity),
    }));
    const { error: itemsErr } = await supabase.from('representative_order_items').insert(itemRows);
    if (itemsErr) {
      setSubmitting(false);
      setError('Pedido criado, mas houve erro ao registrar os itens.');
      return;
    }
    if (paymentTerm > 0 && createdOrder.id) {
      const offsets = boletoOffsets.length ? boletoOffsets : [paymentTerm];
      const cents = Math.round(finalAmount * 100);
      const base = Math.floor(cents / offsets.length);
      const t0 = Date.now();
      const rows = offsets.map((off, idx) => ({
        order_id: createdOrder.id,
        installment_number: idx + 1,
        amount: (idx === offsets.length - 1 ? cents - base * (offsets.length - 1) : base) / 100,
        due_date: new Date(t0 + off * 86400000).toISOString().slice(0, 10),
        status: 'pending',
      }));
      await supabase.from('representative_order_installments').insert(rows);
    }

    const { error: defaultErr } = await supabase.rpc('set_repco_client_default_fiscal_order_type', {
      p_client_id: selectedClient.id,
      p_fiscal_order_type: fiscalOrderType,
    });

    if (defaultErr) {
      setSubmitting(false);
      setError('Pedido criado, mas não foi possível salvar a preferência fiscal do cliente.');
      return;
    }

    setClients(prev => prev.map(client => client.id === selectedClient.id ? { ...client, default_fiscal_order_type: fiscalOrderType } : client));
    setSelectedClient(prev => prev ? { ...prev, default_fiscal_order_type: fiscalOrderType } : prev);
    window.dispatchEvent(new CustomEvent('repco:orders-updated', { detail: { representativeId } }));
    window.dispatchEvent(new CustomEvent('repco:clients-updated', { detail: { representativeId } }));
    setSuccess(true);
    setSubmitting(false);
    onOrderCreated?.();
  }

  if (success) return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">✓</div>
      <h3 className="text-lg font-semibold text-gray-800">Pedido enviado!</h3>
      <p className="text-sm text-gray-500">Registrado e aguardando processamento.</p>
      <button onClick={() => { setSuccess(false); setStep('client'); setSelectedClient(null); setItems([]); setNotes(''); setFiscalOrderType('non_taxpayer_consumer'); }}
        className="bg-[#a4240e] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c]">Novo Pedido</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(['client','products','review'] as const).map((s, i) => {
          const labels = ['Cliente','Produtos','Revisão'];
          const past = ['client','products','review'].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step===s?'bg-[#a4240e] text-white':past?'bg-green-500 text-white':'bg-gray-200 text-gray-500'}`}>{past?'✓':i+1}</span>
              <span className={step===s?'text-[#a4240e]':'text-gray-400'}>{labels[i]}</span>
              {i<2&&<span className="text-gray-300">›</span>}
            </div>
          );
        })}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Step 1 */}
      {step==='client' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selecione o cliente:</p>
          {clients.length===0
            ? <div className="text-center py-8 text-gray-400 text-sm">Cadastre clientes na aba "Clientes"</div>
            : clients.map(c => { const isBlocked = !!blocked[c.id]; return (
              <div key={c.id} onClick={()=>selectClient(c)} className={`border rounded-xl p-4 cursor-pointer transition-all ${isBlocked?'border-red-300 bg-red-50':'bg-white border-gray-200 hover:border-[#a4240e]/40 hover:shadow-sm'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div><p className="font-semibold text-gray-900 text-sm">{c.nome_fantasia||c.razao_social}</p><p className="text-xs text-gray-400">{c.cnpj ? fmt(c.cnpj) : c.cpf}</p></div>
                  {isBlocked
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium whitespace-nowrap">Bloqueado · venc. {new Date(blocked[c.id]+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    : c.segment&&<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{SEGMENT_LABEL[c.segment]??c.segment}</span>}
                </div>
              </div>
            ); })}
        </div>
      )}

      {/* Step 2 */}
      {step==='products' && selectedClient && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-semibold text-gray-900">{selectedClient.nome_fantasia||selectedClient.razao_social}</p>{selectedClient.segment&&<p className="text-xs text-[#a4240e]">{SEGMENT_LABEL[selectedClient.segment]}</p>}</div>
            <button onClick={()=>setStep('client')} className="text-xs text-gray-400 hover:text-gray-600">Trocar</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a4240e]"/></div> : (
            <>
              <div className="space-y-2">
                {products.map(product => {
                  const pe = getPrice(product.id);
                  const qty = getQty(product.id);
                  const ep = pe ? effectivePrice(pe, qty) : null;
                  const isOut = !product.in_stock || product.stock === 0;
                  const hasDisc = pe && pe.volume_discount > 0 && qty >= pe.volume_min_qty;
                  return (
                    <div key={product.id} className={`bg-white border rounded-xl p-3 transition-all ${isOut?'opacity-60 border-gray-100':qty>0?'border-[#a4240e]/40':'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {product.image_url?<img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center text-gray-300">Café</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {pe ? <span className={`text-xs font-medium ${hasDisc?'text-green-600':'text-[#a4240e]'}`}>R$ {ep?.toFixed(2)}{hasDisc&&<span className="ml-1 bg-green-50 px-1 rounded">-{pe.volume_discount}%</span>}</span>
                              : <span className="text-xs text-red-500">Sem preço para {selectedClient.segment ? SEGMENT_LABEL[selectedClient.segment] ?? selectedClient.segment : 'este segmento'}</span>}
                            <StockIndicator stock={product.stock} inStock={product.in_stock} />
                          <div className="flex items-center gap-1 text-[10px]">
                            <button type="button" onClick={()=>setUnitByProduct(m=>({...m,[product.id]:'pacote'}))} disabled={qty>0} className={`px-1.5 py-0.5 rounded ${cartUnit(product)==='pacote'?'bg-[#a4240e] text-white':'bg-gray-100 text-gray-600'} ${qty>0?'opacity-50':''}`}>Pacote</button>
                            <button type="button" onClick={()=>setUnitByProduct(m=>({...m,[product.id]:'fardo'}))} disabled={qty>0||product.stock<UNITS_PER_BUNDLE} className={`px-1.5 py-0.5 rounded ${cartUnit(product)==='fardo'?'bg-[#a4240e] text-white':'bg-gray-100 text-gray-600'} ${(qty>0||product.stock<UNITS_PER_BUNDLE)?'opacity-50':''}`}>Fardo (10)</button>
                          </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {qty>0 ? (<>
                            <button onClick={()=>updateQty(product,-stepOf(product))} className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100">−</button>
                            <span className="w-6 text-center text-sm font-bold">{cartUnit(product)==='fardo'?qty/UNITS_PER_BUNDLE:qty}</span>
                            <button onClick={()=>updateQty(product,stepOf(product))} disabled={plusDisabled(product)} className="w-7 h-7 rounded-full bg-[#a4240e] text-white flex items-center justify-center hover:bg-[#8a1f0c] disabled:opacity-30">+</button>
                          </>) : (
                            <button onClick={()=>!isOut&&updateQty(product,stepOf(product),cartUnit(product))} disabled={isOut||!pe||(cartUnit(product)==='fardo'&&product.stock<UNITS_PER_BUNDLE)}
                              className="px-3 py-1.5 bg-[#a4240e] text-white rounded-lg text-xs font-semibold hover:bg-[#8a1f0c] disabled:opacity-30 disabled:cursor-not-allowed">
                              {isOut?'Esgotado':(cartUnit(product)==='fardo'?'Adicionar fardo':'Adicionar')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {items.length>0 && (
                <div className="sticky bottom-0 bg-white border border-[#a4240e]/30 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">{items.reduce((s,i)=>s+i.quantity,0)} itens</p><p className="font-bold text-[#a4240e]">R$ {calcTotal().toFixed(2)}</p></div>
                    <button onClick={()=>setStep('review')} className="bg-[#a4240e] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c]">Revisar</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3 */}
      {step==='review' && selectedClient && (
        <div className="space-y-4">
          <button onClick={()=>setStep('products')} className="text-xs text-gray-400 hover:text-gray-600">Voltar</button>
          <div className="bg-gray-50 rounded-xl p-4"><p className="font-semibold text-gray-900">{selectedClient.nome_fantasia||selectedClient.razao_social}</p>{selectedClient.segment&&<p className="text-xs text-[#a4240e] mt-0.5">{SEGMENT_LABEL[selectedClient.segment]}</p>}</div>
          <div className="space-y-2">
            {items.map(item => { const ep=effectivePrice(item.price,item.quantity); return (
              <div key={item.product.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                <div className="min-w-0 mr-2">
                  <p className="text-sm text-gray-800">{item.product.name}</p>
                  <p className="text-xs text-gray-400">R$ {ep.toFixed(2)} × {item.unit==='fardo' ? (item.quantity/10)+' fardo(s) ('+item.quantity+' pct)' : item.quantity+' pacote(s)'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>updateQty(item.product,item.unit==='fardo'?-UNITS_PER_BUNDLE:-1)} className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100">−</button>
                    <span className="text-sm font-medium w-6 text-center">{item.unit==='fardo'?item.quantity/UNITS_PER_BUNDLE:item.quantity}</span>
                    <button type="button" onClick={()=>updateQty(item.product,item.unit==='fardo'?UNITS_PER_BUNDLE:1)} disabled={item.unit==='fardo'?item.quantity+UNITS_PER_BUNDLE>item.product.stock:item.quantity>=item.product.stock} className="w-7 h-7 rounded-full bg-[#a4240e] text-white flex items-center justify-center disabled:opacity-40">+</button>
                  </div>
                  <p className="text-sm font-semibold w-20 text-right">R$ {(ep*item.quantity).toFixed(2)}</p>
                </div>
              </div>
            );})}
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold"><span>Total</span><span className="text-[#a4240e]">R$ {calcTotal().toFixed(2)}</span></div>
            <button type="button" onClick={()=>setStep('products')} className="text-xs text-[#a4240e] font-medium hover:underline">+ Adicionar mais produtos</button>
          </div>
          <div className="space-y-3">
            {/* Número do pedido do cliente */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="has_order_number" checked={hasClientOrderNumber}
                  onChange={e=>{setHasClientOrderNumber(e.target.checked);if(!e.target.checked)setClientOrderNumber('');}}
                  className="w-4 h-4 accent-amber-600"/>
                <label htmlFor="has_order_number" className="text-sm text-gray-700 cursor-pointer">Cliente tem número de pedido</label>
              </div>
              {hasClientOrderNumber&&(
                <input type="text" value={clientOrderNumber} onChange={e=>setClientOrderNumber(e.target.value)}
                  placeholder="Nº do pedido do cliente"
                  className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none"/>
              )}
              {!hasClientOrderNumber&&(
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Pedido será encaminhado ao fiscal sem número do cliente</p>
              )}
            </div>
            {/* Condicao de pagamento (a vista / boleto, estilo ERP) */}
            <BoletoCombinationPicker key={selectedClient?.id ?? 'none'}
              initialOffsets={boletoOffsets}
              onChange={(offs) => {
                setBoletoOffsets(offs);
                setPaymentTerm(offs.length ? offs[offs.length - 1] : 0);
                setPaymentMethod(offs.length ? 'boleto' : 'pix');
              }}
            />
            {/* À vista: PIX / Depósito / Dinheiro (Dinheiro só se a empresa aceita). Sempre na conta da empresa com NF. */}
            {paymentTerm === 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Forma (à vista) — sempre na conta da empresa, com NF</label>
                <div className="inline-flex flex-wrap rounded-lg border border-gray-200 overflow-hidden">
                  {([['pix', 'PIX'], ['deposito', 'Depósito bancário'], ...(activeCompany?.allow_cash ? [['dinheiro', 'Dinheiro']] : [])] as [string, string][]).map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                      className={`px-4 py-1.5 text-sm font-semibold border-r border-gray-200 last:border-r-0 ${paymentMethod === m ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'pix'
                  ? (activeCompany?.commission_model === 'formula'
                      ? <p className="text-[11px] text-amber-600 mt-1">PIX à vista com NF → +0,5% de comissão.</p>
                      : <p className="text-[11px] text-gray-400 mt-1">PIX à vista, na conta da empresa com NF.</p>)
                  : <p className="text-[11px] text-gray-400 mt-1">{paymentMethod === 'dinheiro' ? 'Dinheiro recebido na hora' : 'Depósito bancário'} → depositado na conta da empresa com NF.</p>}
              </div>
            )}
            {/* Tipo fiscal/comercial */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo fiscal/comercial do pedido</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(FISCAL_ORDER_LABEL) as FiscalOrderType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFiscalOrderType(type)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      fiscalOrderType === type
                        ? 'border-[#a4240e] bg-red-50 text-[#a4240e]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {FISCAL_ORDER_LABEL[type]}
                  </button>
                ))}
              </div>
              {fiscalTypeRequiresCnpj(fiscalOrderType) && selectedClient && !hasValidCnpj(selectedClient) && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  Revenda e Consumidor contribuinte exigem CNPJ. Para cliente CPF, use Consumidor não contribuinte.
                </p>
              )}
            </div>
            {/* Desconto */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Desconto ao cliente (%) <span className="text-gray-400 font-normal">— comissão calculada sobre preço com desconto</span>
              </label>
              <div className="flex gap-2 items-center">
                <input type="number" value={discountPercentage}
                  onChange={e=>setDiscountPercentage(Math.min(15,Math.max(0,parseFloat(e.target.value)||0)))}
                  min="0" max="15" step="0.5"
                  className="w-24 h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none"/>
                <span className="text-sm text-gray-500">%</span>
                {discountPercentage>0&&(
                  <div className="flex gap-3 text-xs">
                    <span className="text-gray-400 line-through">R$ {calcTotal().toFixed(2)}</span>
                    <span className="text-green-600 font-medium">R$ {(calcTotal()*(1-discountPercentage/100)).toFixed(2)}</span>
                    {paymentTerm===0&&paymentMethod==='pix'&&activeCompany?.commission_model==='formula'&&<span className="text-amber-600">PIX: +0.5% bônus</span>}
                  </div>
                )}
              </div>
            </div>
            {/* Entrega pessoal */}
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <input type="checkbox" id="pd" checked={isPersonalDelivery} onChange={e=>setIsPersonalDelivery(e.target.checked)} className="w-4 h-4 accent-[#a4240e]"/>
              <label htmlFor="pd" className="text-sm text-amber-800 cursor-pointer">Entrega pessoal (+2,5% bônus na comissão)</label>
            </div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Observações..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none resize-none"/>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="w-full bg-[#a4240e] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#8a1f0c] disabled:opacity-50">
            {submitting?'Enviando...':`Confirmar Pedido — R$ ${(calcTotal()*(1-discountPercentage/100)).toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  );
}
