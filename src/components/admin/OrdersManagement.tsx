import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getTrackingUrl } from '../../lib/tracking';
import { Printer, Tag, Package, Search, Filter,
  ChevronDown, ChevronUp, FileText, Truck, CheckCircle,
  Clock, AlertCircle, Upload, ExternalLink, Save, X, Building2, UserCircle } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_series: string;
  invoice_key: string;
  invoice_total: number;
  invoice_xml_url?: string;
  invoice_pdf_url?: string;
  status: string;
}

interface Shipment {
  id: string;
  carrier_name?: string;
  tracking_code?: string;
  label_url?: string;
  status: string;
  dispatch_date?: string;
  tracking_events?: any[];
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  cpf?: string;
  cep?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  shipping_address?: string;
  total_amount: number;
  shipping_cost: number;
  status: string;
  order_status: string;
  payment_status?: string;
  carrier_name?: string;
  tracking_code?: string;
  package_weight?: number;
  package_height?: number;
  package_width?: number;
  package_length?: number;
  label_url?: string;
  is_gift?: boolean;
  shipping_recipient?: string;
  tracking_events?: any[];
  created_at: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    product_id: string;
    products: { name: string; weight_grams: number };
  }>;
  invoices?: Invoice[];
  shipments?: Shipment[];
  account_type?: string; // from user_profiles join
}

const ORDER_STATUSES = [
  { key: 'created', label: 'Criado', color: 'bg-gray-100 text-gray-700', icon: '📋' },
  { key: 'payment_pending', label: 'Ag. Pagamento', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  { key: 'payment_approved', label: 'Pago', color: 'bg-blue-100 text-blue-800', icon: '💳' },
  { key: 'invoice_pending', label: 'Ag. Nota Fiscal', color: 'bg-orange-100 text-orange-800', icon: '🧾' },
  { key: 'ready_for_shipment', label: 'Pronto p/ Envio', color: 'bg-purple-100 text-purple-800', icon: '📦' },
  { key: 'label_generated', label: 'Etiqueta Gerada', color: 'bg-indigo-100 text-indigo-800', icon: '🏷️' },
  { key: 'shipped', label: 'Enviado', color: 'bg-cyan-100 text-cyan-800', icon: '🚚' },
  { key: 'delivered', label: 'Entregue', color: 'bg-green-100 text-green-800', icon: '✅' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: '❌' },
];

// Legacy status map
const LEGACY_STATUS: Record<string, string> = {
  pending: 'payment_pending',
  paid: 'payment_approved',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

function getOrderStatus(order: Order): string {
  if (order.order_status) return order.order_status;
  return LEGACY_STATUS[order.status] || 'created';
}

function getStatusInfo(statusKey: string) {
  return ORDER_STATUSES.find(s => s.key === statusKey) || ORDER_STATUSES[0];
}

export function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'PF' | 'PJ'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Record<string, string>>({});

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, unit_price, product_id, products(name, weight_grams)), invoices(*), shipments(*), user_profiles!orders_user_id_fkey(account_type)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Flatten account_type from nested user_profiles
      const enriched = (data || []).map((o: any) => ({
        ...o,
        account_type: o.user_profiles?.account_type || 'PF',
      }));
      setOrders(enriched);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
    if (!activeSection[orderId]) {
      setActiveSection(prev => ({ ...prev, [orderId]: 'overview' }));
    }
  };

  const setSection = (orderId: string, section: string) => {
    setActiveSection(prev => ({ ...prev, [orderId]: section }));
  };

  const filteredOrders = orders.filter(order => {
    const status = getOrderStatus(order);
    const matchesFilter = filter === 'all' || status === filter;
    const matchesCustomer = customerFilter === 'all' || (order.account_type || 'PF') === customerFilter;
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesCustomer && matchesSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
    </div>
  );

  return (
    <div>
        <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Gerenciamento de Pedidos</h2>
          {/* PF/PJ Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
            {(['all', 'PF', 'PJ'] as const).map((type, idx) => (
              <button key={type} onClick={() => setCustomerFilter(type)}
                className={`flex items-center gap-1.5 px-4 py-2.5 border-r border-gray-200 last:border-0 transition-all ${
                  idx === 0 ? 'rounded-l-xl' : idx === 2 ? 'rounded-r-xl' : ''
                } ${
                  customerFilter === type ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {type === 'PJ' ? <Building2 className="w-3.5 h-3.5" /> : type === 'PF' ? <UserCircle className="w-3.5 h-3.5" /> : null}
                {type === 'all' ? 'Todos' : type}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Buscar por número, nome ou email..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
            <option value="all">Todos os Status</option>
            {ORDER_STATUSES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order}
              expanded={expandedOrderId === order.id}
              section={activeSection[order.id] || 'overview'}
              onToggle={() => toggleExpand(order.id)}
              onSetSection={(s) => setSection(order.id, s)}
              onRefresh={loadOrders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, expanded, section, onToggle, onSetSection, onRefresh }: any) {
  const status = getOrderStatus(order);
  const statusInfo = getStatusInfo(status);
  const invoice = order.invoices?.[0];
  const shipment = order.shipments?.[0];

  return (
    <div className={`bg-white rounded-xl shadow-sm transition-all ${expanded ? 'border-2 border-[#a4240e]' : 'border border-gray-200 hover:shadow-md'}`}>
      {/* Summary Row */}
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-gray-900">Pedido {order.order_number}</h3>
                {order.account_type === 'PJ' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                    <Building2 className="w-3 h-3" />PJ
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    <UserCircle className="w-3 h-3" />PF
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{order.customer_name} • {new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.label}
            </span>
            <span className="text-xl font-bold text-[#a4240e]">R$ {order.total_amount?.toFixed(2)}</span>
            {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded Sections */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Section Tabs */}
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50">
            {[
              { key: 'overview', label: '📋 Visão Geral' },
              { key: 'package', label: '📦 Embalagem' },
              { key: 'invoice', label: `🧾 Nota Fiscal${invoice ? ' ✅' : ''}` },
              { key: 'logistics', label: '🚚 Logística' },
            ].map(tab => (
              <button key={tab.key} onClick={() => onSetSection(tab.key)}
                className={`flex-shrink-0 px-5 py-3 text-sm font-medium transition-colors ${section === tab.key ? 'border-b-2 border-[#a4240e] text-[#a4240e] bg-white' : 'text-gray-600 hover:text-gray-800'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {section === 'overview' && <OverviewSection order={order} onRefresh={onRefresh} />}
            {section === 'package' && <PackageSection order={order} onRefresh={onRefresh} />}
            {section === 'invoice' && <InvoiceSection order={order} invoice={invoice} onRefresh={onRefresh} />}
            {section === 'logistics' && <LogisticsSection order={order} shipment={shipment} invoice={invoice} onRefresh={onRefresh} />}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSection({ order, onRefresh }: any) {
  const updateStatus = async (status: string) => {
    await supabase.from('orders').update({ order_status: status, status }).eq('id', order.id);
    onRefresh();
  };

  const printOrder = () => {
    const totalWeight = order.order_items?.reduce((sum: number, item: any) =>
      sum + (item.products?.weight_grams || 0) * item.quantity, 0) || 0;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Pedido ${order.order_number}</title><style>
      @page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;padding:20px}
      h1{color:#a4240e;border-bottom:3px solid #a4240e;padding-bottom:10px}
      table{width:100%;border-collapse:collapse}.total{font-size:20px;font-weight:bold;color:#a4240e;text-align:right;margin-top:20px}
      th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5}
      .box{background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:15px}
    </style></head><body>
    <h1>CAFÉ SAPORINO — PEDIDO ${order.order_number}</h1>
    <div class="box"><strong>Cliente:</strong> ${order.customer_name}<br><strong>E-mail:</strong> ${order.customer_email}<br><strong>Telefone:</strong> ${order.customer_phone}</div>
    <div class="box"><strong>Endereço:</strong> ${order.address_street || ''}, ${order.address_number || ''}<br>${order.address_city || ''} - ${order.address_state || ''} • CEP: ${order.cep || ''}</div>
    <table><thead><tr><th>Produto</th><th>Qtd</th><th>Peso Unit.</th><th>Preço Unit.</th><th>Subtotal</th></tr></thead><tbody>
    ${order.order_items?.map((i: any) => `<tr><td>${i.products?.name}</td><td>${i.quantity}</td><td>${i.products?.weight_grams}g</td><td>R$ ${i.unit_price.toFixed(2)}</td><td>R$ ${(i.unit_price * i.quantity).toFixed(2)}</td></tr>`).join('')}
    </tbody></table>
    <div><p>Peso total: ${totalWeight}g (${(totalWeight / 1000).toFixed(2)}kg)</p></div>
    <div class="total">TOTAL: R$ ${order.total_amount?.toFixed(2)}</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cliente</p>
          <p className="font-semibold">{order.customer_name}</p>
          <p className="text-sm text-gray-600">{order.customer_email}</p>
          <p className="text-sm text-gray-600">{order.customer_phone}</p>
        </div>
        <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Endereço</p>
          <p className="text-sm">{order.address_street}, {order.address_number}</p>
          <p className="text-sm">{order.address_neighborhood}</p>
          <p className="text-sm">{order.address_city} - {order.address_state}</p>
          <p className="text-sm font-mono">CEP: {order.cep}</p>
        </div>
        <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Produtos</p>
          {order.order_items?.map((item: any, i: number) => (
            <p key={i} className="text-sm">{item.quantity}x {item.products?.name}</p>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <select value={getOrderStatus(order)}
          onChange={(e) => updateStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]">
          {ORDER_STATUSES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
        </select>
        <button onClick={printOrder}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
          <Printer className="w-4 h-4" /><span>Imprimir Pedido</span>
        </button>
      </div>
    </div>
  );
}

function PackageSection({ order, onRefresh }: any) {
  const [weight, setWeight] = useState(order.package_weight || '');
  const [height, setHeight] = useState(order.package_height || '');
  const [width, setWidth] = useState(order.package_width || '');
  const [length, setLength] = useState(order.package_length || '');
  const [saving, setSaving] = useState(false);

  const totalWeight = order.order_items?.reduce((sum: number, i: any) =>
    sum + (i.products?.weight_grams || 0) * i.quantity, 0) || 0;

  const savePackage = async () => {
    setSaving(true);
    const updates: any = {
      package_weight: parseFloat(String(weight)) || null,
      package_height: parseFloat(String(height)) || null,
      package_width: parseFloat(String(width)) || null,
      package_length: parseFloat(String(length)) || null,
    };

    // Check if order becomes ready_for_shipment
    const currentStatus = getOrderStatus(order);
    const invoice = order.invoices?.[0];
    const hasInvoice = invoice?.status === 'attached';
    const hasDimensions = updates.package_weight && updates.package_height && updates.package_width && updates.package_length;

    if (hasDimensions && hasInvoice &&
      (currentStatus === 'payment_approved' || currentStatus === 'invoice_pending' || currentStatus === 'invoice_attached')) {
      updates.order_status = 'ready_for_shipment';
      updates.status = 'ready_for_shipment';
    }

    await supabase.from('orders').update(updates).eq('id', order.id);
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-sm text-amber-800">
          <strong>⚖️ Peso estimado dos produtos:</strong> {totalWeight}g ({(totalWeight / 1000).toFixed(3)}kg)
          <br /><span className="text-xs">Inclua o peso da embalagem ao preencher abaixo</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Peso total (kg)', value: weight, setter: setWeight, placeholder: 'ex: 0.850' },
          { label: 'Altura (cm)', value: height, setter: setHeight, placeholder: 'ex: 15' },
          { label: 'Largura (cm)', value: width, setter: setWidth, placeholder: 'ex: 20' },
          { label: 'Comprimento (cm)', value: length, setter: setLength, placeholder: 'ex: 30' },
        ].map(field => (
          <div key={field.label}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
            <input type="number" step="0.001" value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
          </div>
        ))}
      </div>

      <button onClick={savePackage} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors text-sm font-medium disabled:opacity-60">
        <Save className="w-4 h-4" />
        <span>{saving ? 'Salvando...' : 'Salvar Dimensões'}</span>
      </button>
    </div>
  );
}

function InvoiceSection({ order, invoice, onRefresh }: any) {
  const [number, setNumber] = useState(invoice?.invoice_number || '');
  const [series, setSeries] = useState(invoice?.invoice_series || '1');
  const [key, setKey] = useState(invoice?.invoice_key || '');
  const [total, setTotal] = useState(invoice?.invoice_total || '');
  const [xmlUrl, setXmlUrl] = useState(invoice?.invoice_xml_url || '');
  const [pdfUrl, setPdfUrl] = useState(invoice?.invoice_pdf_url || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingXml, setUploadingXml] = useState(false);

  const uploadFile = async (file: File, type: 'pdf' | 'xml'): Promise<string | null> => {
    const setter = type === 'pdf' ? setUploadingPdf : setUploadingXml;
    setter(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${order.id}/${type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 60 * 24 * 365);
      return data?.signedUrl || null;
    } catch (e: any) {
      alert(`Erro no upload: ${e.message}`);
      return null;
    } finally {
      setter(false);
    }
  };

  const saveInvoice = async () => {
    if (!number || !key) { alert('Preencha o número e a chave da NF'); return; }
    setSaving(true);
    try {
      const data = {
        order_id: order.id,
        invoice_number: number.trim(),
        invoice_series: series.trim() || '1',
        invoice_key: key.trim(),
        invoice_total: parseFloat(String(total)) || 0,
        invoice_xml_url: xmlUrl || null,
        invoice_pdf_url: pdfUrl || null,
        status: 'attached',
      };

      if (invoice?.id) {
        await supabase.from('invoices').update(data).eq('id', invoice.id);
      } else {
        await supabase.from('invoices').insert([data]);
      }

      // Check if order goes to ready_for_shipment
      const hasDimensions = order.package_weight && order.package_height && order.package_width && order.package_length;
      const currentStatus = getOrderStatus(order);
      const statusUpdate: any = { order_status: 'invoice_pending', status: 'invoice_pending' };

      if (hasDimensions &&
        (currentStatus === 'payment_approved' || currentStatus === 'invoice_pending')) {
        statusUpdate.order_status = 'ready_for_shipment';
        statusUpdate.status = 'ready_for_shipment';
      }
      await supabase.from('orders').update(statusUpdate).eq('id', order.id);
      onRefresh();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {invoice && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-semibold text-green-800">NF Vinculada — NF {invoice.invoice_number} / Série {invoice.invoice_series}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Número NF *</label>
          <input type="text" value={number} onChange={(e) => setNumber(e.target.value)}
            placeholder="123456" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Série *</label>
          <input type="text" value={series} onChange={(e) => setSeries(e.target.value)}
            placeholder="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Valor NF (R$)</label>
          <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)}
            placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Chave NF-e (44 dígitos) *</label>
        <input type="text" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="00000000000000000000000000000000000000000000"
          maxLength={44}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#a4240e]" />
        <p className="text-xs text-gray-400 mt-1">{key.replace(/\D/g, '').length}/44 dígitos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">PDF da NF</label>
          <div className="flex gap-2">
            <input type="text" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="URL do PDF ou faça upload >"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]" />
            <label className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm whitespace-nowrap">
              {uploadingPdf ? <div className="animate-spin h-4 w-4 border-b-2 border-gray-600 rounded-full" /> : <Upload className="w-4 h-4" />}
              <input type="file" accept=".pdf" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const url = await uploadFile(f, 'pdf'); if (url) setPdfUrl(url); } }} />
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">XML da NF</label>
          <div className="flex gap-2">
            <input type="text" value={xmlUrl} onChange={(e) => setXmlUrl(e.target.value)}
              placeholder="URL do XML ou faça upload >"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e]" />
            <label className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 text-sm whitespace-nowrap">
              {uploadingXml ? <div className="animate-spin h-4 w-4 border-b-2 border-gray-600 rounded-full" /> : <Upload className="w-4 h-4" />}
              <input type="file" accept=".xml" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const url = await uploadFile(f, 'xml'); if (url) setXmlUrl(url); } }} />
            </label>
          </div>
        </div>
      </div>

      <button onClick={saveInvoice} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors text-sm font-medium disabled:opacity-60">
        <FileText className="w-4 h-4" />
        <span>{saving ? 'Salvando...' : invoice ? 'Atualizar Nota Fiscal' : 'Vincular Nota Fiscal'}</span>
      </button>
    </div>
  );
}

function LogisticsSection({ order, shipment, invoice, onRefresh }: any) {
  const [trackingCode, setTrackingCode] = useState(shipment?.tracking_code || order.tracking_code || '');
  const [saving, setSaving] = useState(false);
  const currentStatus = getOrderStatus(order);
  const canGenerateLabel = currentStatus === 'ready_for_shipment' || currentStatus === 'label_generated';
  const canConfirmDispatch = currentStatus === 'label_generated';

  const printLabel = () => {
    const inv = invoice;
    const w = window.open('', '_blank');
    if (!w) return;
    const trackCode = trackingCode || shipment?.tracking_code || 'AGUARDANDO POSTAGEM';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(getTrackingUrl(trackCode, order.carrier_name || 'correios'))}`;
    w.document.write(`<!DOCTYPE html><html><head><title>Etiqueta ${order.order_number}</title><style>
      @page{size:10cm 15cm;margin:0}body{width:10cm;height:15cm;margin:0;padding:8mm;font-family:Arial,sans-serif;box-sizing:border-box;font-size:10px}
      .box{border:2px solid #000;padding:8px;height:calc(15cm - 16mm);display:flex;flex-direction:column}
      .sec{margin-bottom:8px}.sec-title{font-weight:bold;font-size:9px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:4px;text-transform:uppercase}
      .big{font-size:13px;font-weight:bold}.track{font-size:11px;font-weight:bold;text-align:center;padding:5px;background:#f0f0f0;border:1px solid #000;margin-top:auto}
      .row{display:flex;justify-content:space-between;align-items:flex-start}
    </style></head><body><div class="box">
    <div class="sec"><div class="sec-title">Remetente</div>
      <strong>Café Saporino</strong><br>Rua Exemplo, 123 — Barueri/SP<br>CEP: 06454-000
    </div>
    <div class="sec"><div class="sec-title">Destinatário</div>
      <div class="big">${order.shipping_recipient || order.customer_name}</div>
      ${order.address_street || ''}, ${order.address_number || ''}${order.address_complement ? ', ' + order.address_complement : ''}<br>
      ${order.address_neighborhood || ''}<br>
      ${order.address_city || ''} - ${order.address_state || ''}<br>
      <strong>CEP: ${order.cep || ''}</strong>
    </div>
    <div class="sec"><div class="sec-title">Envio</div>
      <div class="row">
        <div><strong>Transportadora:</strong> ${order.shipping_carrier_name || order.carrier_name || 'A definir'}<br>
        <strong>Pedido:</strong> ${order.order_number}<br>
        ${inv ? `<strong>NF:</strong> ${inv.invoice_number}/${inv.invoice_series}` : ''}
        </div>
        ${trackCode !== 'AGUARDANDO POSTAGEM' ? `<img src="${qrUrl}" width="80" height="80" />` : ''}
      </div>
    </div>
    <div class="track">${trackCode}</div>
    </div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 250);
    // Update order status to label_generated if coming from ready_for_shipment
    if (currentStatus === 'ready_for_shipment') {
      supabase.from('orders').update({ order_status: 'label_generated', status: 'label_generated' }).eq('id', order.id).then(() => onRefresh());
    }
  };

  const confirmDispatch = async () => {
    if (!trackingCode) { alert('Insira o código de rastreamento antes de confirmar o despacho'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    // Save shipment
    if (shipment?.id) {
      await supabase.from('shipments').update({ tracking_code: trackingCode, status: 'shipped', dispatch_date: now }).eq('id', shipment.id);
    } else {
      await supabase.from('shipments').insert([{
        order_id: order.id,
        carrier_name: order.shipping_carrier_name || order.carrier_name,
        tracking_code: trackingCode,
        status: 'shipped',
        dispatch_date: now,
      }]);
    }
    await supabase.from('orders').update({
      order_status: 'shipped', status: 'shipped',
      tracking_code: trackingCode, dispatch_date: now,
    }).eq('id', order.id);
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Status timeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {['payment_approved', 'invoice_pending', 'ready_for_shipment', 'label_generated', 'shipped', 'delivered'].map((s, i) => {
          const info = getStatusInfo(s);
          const statuses = ['payment_approved', 'invoice_pending', 'ready_for_shipment', 'label_generated', 'shipped', 'delivered'];
          const currentIdx = statuses.indexOf(getOrderStatus(order));
          const isActive = i <= currentIdx;
          return (
            <div key={s} className="flex items-center">
              <div className={`flex flex-col items-center min-w-[70px] ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-[#a4240e] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {info.icon}
                </div>
                <p className="text-[9px] text-center mt-1 leading-tight text-gray-600">{info.label}</p>
              </div>
              {i < 5 && <div className={`w-6 h-0.5 flex-shrink-0 mb-4 ${i < currentIdx ? 'bg-[#a4240e]' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {/* Action prompt */}
      {!canGenerateLabel && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Para gerar a etiqueta:</strong>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {!invoice && <li>Vincule a Nota Fiscal (aba NF)</li>}
              {!order.package_weight && <li>Preencha o peso e dimensões (aba Embalagem)</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Tracking code */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Código de Rastreamento</label>
        <div className="flex gap-2">
          <input type="text" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="BR123456789BR"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#a4240e]" />
          {trackingCode && (
            <a href={getTrackingUrl(trackingCode, order.shipping_carrier_name || order.carrier_name || 'correios')}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors">
              <ExternalLink className="w-4 h-4" /><span>Rastrear</span>
            </a>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button onClick={printLabel} disabled={!canGenerateLabel}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
          <Tag className="w-4 h-4" />
          <span>{currentStatus === 'label_generated' ? 'Reimprimir Etiqueta' : 'Gerar Etiqueta'}</span>
        </button>

        {canConfirmDispatch && (
          <button onClick={confirmDispatch} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-60">
            <Truck className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Confirmar Despacho'}</span>
          </button>
        )}

        {currentStatus === 'shipped' && (
          <button onClick={async () => {
            await supabase.from('orders').update({ order_status: 'delivered', status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', order.id);
            if (shipment?.id) await supabase.from('shipments').update({ status: 'delivered' }).eq('id', shipment.id);
            onRefresh();
          }}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>Marcar como Entregue</span>
          </button>
        )}
      </div>
    </div>
  );
}
