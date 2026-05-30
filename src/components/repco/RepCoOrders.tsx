import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Printer, MessageCircle, Mail, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { buildInvoiceShareUrls, extractStoragePath } from '../../utils/invoiceShare';

interface Order {
  id: string;
  order_number: string;
  description: string;
  total_amount: number;
  payment_method: string;
  is_personal_delivery: boolean;
  invoice_pdf_url: string | null;
  invoice_pdf_filename: string | null;
  invoice_xml_url: string | null;
  invoice_xml_filename: string | null;
  payment_proof_filename: string | null;
  invoice_key: string | null;
  status: string;
  created_at: string;
  representative_clients: { razao_social: string } | null;
}

interface Props { repId: string; refreshKey?: number; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:       { label: 'Novo',       color: 'bg-blue-100 text-blue-700'   },
  pending:   { label: 'Pendente',   color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluído',  color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado',  color: 'bg-gray-100 text-gray-600'   },
};

type Filter = 'all' | 'new' | 'pending' | 'completed';

async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function RepCoOrders({ repId, refreshKey = 0 }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase
      .from('representative_orders')
      .select('*, representative_clients(razao_social)')
      .eq('representative_id', repId)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchOrders(); }, [repId, refreshKey]);

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

  async function resolveSignedUrl(fileRef: string | null): Promise<string | null> {
    const path = extractStoragePath(fileRef);
    if (!path) return null;
    return getSignedUrl(path);
  }

  function warnInvalidInvoice() {
    toast.error('Nota fiscal sem acesso válido. Solicite ao admin que reenvie a NF.');
  }

  async function handleDownloadPdf(order: Order) {
    const url = await resolveSignedUrl(order.invoice_pdf_url);
    if (!url) { warnInvalidInvoice(); return; }
    triggerDownload(url, order.invoice_pdf_filename || `NF-${order.order_number}.pdf`);
  }

  async function handlePrintPdf(order: Order) {
    const url = await resolveSignedUrl(order.invoice_pdf_url);
    if (!url) { warnInvalidInvoice(); return; }
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) { toast.error('Não foi possível abrir o PDF para impressão.'); return; }
    setTimeout(() => win.print(), 1200);
  }

  async function handleShareWhatsApp(order: Order) {
    const { whatsappUrl } = buildInvoiceShareUrls(order);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleShareEmail(order: Order) {
    const { mailtoUrl } = buildInvoiceShareUrls(order);
    window.open(mailtoUrl, '_blank');
  }

  async function handleDownloadXml(order: Order) {
    const url = await resolveSignedUrl(order.invoice_xml_url);
    if (!url) { toast.error('XML sem acesso válido. Solicite ao admin que reenvie o arquivo.'); return; }
    triggerDownload(url, order.invoice_xml_filename || `NF-${order.order_number}.xml`);
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
          {(['all', 'new', 'pending', 'completed'] as Filter[]).map((f, idx) => (
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
            const hasPdf = Boolean(extractStoragePath(order.invoice_pdf_url));
            const hasXml = Boolean(extractStoragePath(order.invoice_xml_url));
            const hasProof = Boolean(order.payment_proof_filename);
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5">
                {/* Header do card */}
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
                    <p className="text-xl font-bold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_amount)}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {/* Seção de documentos */}
                {(hasPdf || hasXml || hasProof) && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">

                    {/* NF PDF */}
                    {hasPdf && (
                      <div className="space-y-2">
                        <p className="text-xs text-green-700 flex items-center gap-1.5 font-medium">
                          <span>📄</span>
                          <span>NF PDF:</span>
                          <span className="font-normal truncate max-w-[220px]">
                            {order.invoice_pdf_filename || 'Arquivo anexado'}
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <button onClick={() => handleDownloadPdf(order)}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#a4240e] hover:underline">
                            <Download className="w-3.5 h-3.5" /> Baixar NF
                          </button>
                          <button onClick={() => handlePrintPdf(order)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
                            <Printer className="w-3.5 h-3.5" /> Imprimir
                          </button>
                          <button onClick={() => handleShareWhatsApp(order)}
                            className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700">
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                          <button onClick={() => handleShareEmail(order)}
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                            <Mail className="w-3.5 h-3.5" /> Email
                          </button>
                        </div>
                      </div>
                    )}

                    {/* NF XML */}
                    {hasXml && (
                      <div className="space-y-2">
                        <p className="text-xs text-green-700 flex items-center gap-1.5 font-medium">
                          <span>📄</span>
                          <span>XML:</span>
                          <span className="font-normal truncate max-w-[220px]">
                            {order.invoice_xml_filename || 'Arquivo anexado'}
                          </span>
                        </p>
                        <button onClick={() => handleDownloadXml(order)}
                          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
                          <Download className="w-3.5 h-3.5" /> Baixar XML
                        </button>
                      </div>
                    )}

                    {/* Comprovante de pagamento */}
                    {hasProof && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <p className="text-xs text-green-700 font-medium">
                          Pagamento confirmado:
                          <span className="font-normal ml-1 truncate">{order.payment_proof_filename}</span>
                        </p>
                      </div>
                    )}
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
