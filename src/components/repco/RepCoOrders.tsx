import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Printer, MessageCircle, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Order { id: string; order_number: string; description: string; total_amount: number; payment_method: string; is_personal_delivery: boolean; invoice_pdf_url: string | null; invoice_key: string | null; status: string; created_at: string; representative_clients: { razao_social: string } | null; }
interface Props { repId: string; refreshKey?: number; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' },
};

type Filter = 'all' | 'new' | 'pending' | 'completed';

export function RepCoOrders({ repId, refreshKey = 0 }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from('representative_orders')
      .select('*, representative_clients(razao_social)')
      .eq('representative_id', repId)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
  }, [repId, refreshKey]);

  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<{ representativeId?: string }>).detail;
      if (!detail?.representativeId || detail.representativeId === repId) fetchOrders();
    }
    window.addEventListener('repco:orders-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('repco:orders-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [repId]);

  const handleSendWhatsApp = (order: Order, whatsapp: string) => {
    const msg = encodeURIComponent(`Olá! Segue a nota fiscal do pedido ${order.order_number}. Acesse: ${order.invoice_pdf_url}`);
    window.open(`https://wa.me/55${whatsapp.replace(/\D/g,'')}?text=${msg}`, '_blank');
  };

  void handleSendWhatsApp;

  function getInvoicePath(order: Order) {
    const value = order.invoice_pdf_url?.trim();
    if (!value) return null;
    if (value.includes('/storage/v1/object/public/representative-docs/')) return null;
    if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

    const marker = '/storage/v1/object/';
    const markerIndex = value.indexOf(marker);
    if (markerIndex < 0) return value;

    const objectPart = value.slice(markerIndex + marker.length);
    const withoutMode = objectPart.replace(/^(public|sign)\//, '');
    const withoutBucket = withoutMode.replace(/^invoices\//, '');
    return withoutBucket.split('?')[0] || null;
  }

  async function getInvoiceAccessUrl(order: Order) {
    const value = order.invoice_pdf_url?.trim();
    const path = getInvoicePath(order);
    if (!path) return null;

    if (value && /^https?:\/\//i.test(value) && !value.includes('/storage/v1/object/')) {
      return value;
    }

    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  function warnInvalidInvoice() {
    toast.error('Nota fiscal sem acesso válido. Peça ao admin para reenviar a NF.');
  }

  async function openInvoice(order: Order) {
    const url = await getInvoiceAccessUrl(order);
    if (!url) { warnInvalidInvoice(); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function printInvoice(order: Order) {
    const url = await getInvoiceAccessUrl(order);
    if (!url) { warnInvalidInvoice(); return; }
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Não foi possível abrir o PDF da NF para impressão.');
      return;
    }
    setTimeout(() => printWindow.print(), 1200);
  }

  const shareInvoiceWhatsApp = async (order: Order) => {
    const url = await getInvoiceAccessUrl(order);
    if (!url) { warnInvalidInvoice(); return; }
    const msg = encodeURIComponent(`Olá! Acesse a nota fiscal do pedido ${order.order_number}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  async function shareInvoiceEmail(order: Order) {
    const url = await getInvoiceAccessUrl(order);
    if (!url) { warnInvalidInvoice(); return; }
    const subject = encodeURIComponent(`Nota Fiscal ${order.order_number}`);
    const body = encodeURIComponent(`Olá!\n\nAcesse a nota fiscal do pedido ${order.order_number}: ${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
          {(['all','new','pending','completed'] as Filter[]).map((f, idx) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : idx === 3 ? 'rounded-r-xl' : ''} ${filter === f ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? 'Todos' : f === 'new' ? 'Novos' : f === 'pending' ? 'Pendentes' : 'Concluídos'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#a4240e]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500"><FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" /><p>Nenhum pedido encontrado</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const st = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };
            const hasInvoicePdf = Boolean(getInvoicePath(order));
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{order.order_number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      {order.payment_method === 'pix' && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">PIX</span>}
                    </div>
                    <p className="text-sm text-gray-700">{order.description}</p>
                    {order.representative_clients && <p className="text-xs text-gray-400 mt-0.5">{order.representative_clients.razao_social}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">R$ {order.total_amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {hasInvoicePdf && (
                  <div className="mt-4 flex items-center gap-3 pt-4 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">Nota Fiscal:</span>
                    <button onClick={() => openInvoice(order)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#a4240e] hover:underline">
                      <Download className="w-3.5 h-3.5" /> Baixar NF
                    </button>
                    <button onClick={() => printInvoice(order)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
                      <Printer className="w-3.5 h-3.5" /> Imprimir
                    </button>
                    <button onClick={() => shareInvoiceWhatsApp(order)}
                      className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    <button
                      onClick={() => shareInvoiceEmail(order)}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
