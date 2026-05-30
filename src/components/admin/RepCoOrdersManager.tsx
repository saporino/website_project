import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface RepCoOrder {
  id: string; order_number: string; representative_id: string;
  total_amount: number; original_amount: number | null; discount_percentage: number | null;
  payment_method: string | null; payment_term: number | null; is_personal_delivery: boolean;
  client_order_number: string | null; has_client_order_number: boolean;
  invoice_pdf_url: string | null; invoice_xml_url: string | null; invoice_number: string | null;
  status: string; notes: string | null; created_at: string; completed_at: string | null;
  pix_bonus_eligible: boolean; client_name?: string; rep_name?: string;
}

type NFUploadStatus = {
  kind: 'info' | 'success' | 'error';
  message: string;
  fileName?: string;
  storagePath?: string;
  invoicePdfUrl?: string | null;
  invoiceXmlUrl?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  new:       { label: 'Novo',      bg: 'bg-blue-100',   text: 'text-blue-700'   },
  pending:   { label: 'Pendente',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Concluído', bg: 'bg-green-100',  text: 'text-green-700'  },
  cancelled: { label: 'Cancelado', bg: 'bg-red-100',    text: 'text-red-700'    },
};

export default function RepCoOrdersManager({ representativeId, refreshKey = 0 }: { representativeId?: string; refreshKey?: number }) {
  const [orders, setOrders] = useState<RepCoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | 'pix' | 'boleto'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<RepCoOrder | null>(null);
  const [uploadingNF, setUploadingNF] = useState<string | null>(null);
  const [nfUploadStatus, setNfUploadStatus] = useState<Record<string, NFUploadStatus>>({});
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const invoiceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { fetchOrders(); }, [representativeId, channelFilter, statusFilter, refreshKey]);
  useEffect(() => {
    function handleRefresh() {
      fetchOrders();
    }
    window.addEventListener('admin:repco-updated', handleRefresh);
    window.addEventListener('repco:orders-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('admin:repco-updated', handleRefresh);
      window.removeEventListener('repco:orders-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [representativeId]);

  function notifyOrdersUpdated() {
    window.dispatchEvent(new CustomEvent('admin:repco-updated'));
    window.dispatchEvent(new CustomEvent('repco:orders-updated', { detail: { representativeId } }));
  }

  async function fetchOrders() {
    setLoading(true);
    let query = supabase.from('representative_orders')
      .select('*, representative_clients(nome_fantasia, razao_social), representatives(full_name)')
      .order('created_at', { ascending: false });
    if (representativeId) query = query.eq('representative_id', representativeId);
    if (channelFilter === 'pix') query = query.in('payment_method', ['pix', 'a_vista']);
    if (channelFilter === 'boleto') query = query.eq('payment_method', 'boleto');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    if (data) setOrders(data.map((o: any) => ({
      ...o,
      client_name: o.representative_clients?.nome_fantasia || o.representative_clients?.razao_social || '—',
      rep_name: o.representatives?.full_name || '—',
    })));
    setLoading(false);
  }

  async function uploadNF(orderId: string, file: File, type: 'pdf' | 'xml') {
    console.log('invoice upload handler invoked', { fileName: file?.name, orderId, type });
    if (!orderId) {
      const message = 'Pedido sem ID. Não foi possível anexar a NF.';
      setNfUploadStatus(current => ({ ...current, unknown: { kind: 'error', message, fileName: file?.name } }));
      toast.error(message);
      return;
    }
    if (!file) {
      const message = 'Nenhum arquivo foi selecionado para upload.';
      setNfUploadStatus(current => ({ ...current, [orderId]: { kind: 'error', message } }));
      toast.error(message);
      return;
    }
    setUploadingNF(orderId);
    setNfUploadStatus(current => ({
      ...current,
      [orderId]: { kind: 'info', message: `Arquivo selecionado: ${file.name}. Enviando NF ${type.toUpperCase()}...`, fileName: file.name },
    }));
    const path = `nf/${orderId}/${type}-${Date.now()}.${type}`;
    const currentOrder = orders.find(order => order.id === orderId);
    const previousRef = type === 'pdf' ? currentOrder?.invoice_pdf_url : currentOrder?.invoice_xml_url;
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (!error && data) {
      const storagePath = data.path || path;
      setNfUploadStatus(current => ({
        ...current,
        [orderId]: {
          kind: 'info',
          message: `Upload concluído. Atualizando pedido ${orderId}...`,
          fileName: file.name,
          storagePath,
        },
      }));
      await removeInvoiceFileIfPossible(previousRef || null);
      const field = type === 'pdf' ? 'invoice_pdf_url' : 'invoice_xml_url';
      const { data: updatedOrder, error: updateError } = await supabase
        .from('representative_orders')
        .update({ [field]: storagePath })
        .eq('id', orderId)
        .select('id, invoice_pdf_url, invoice_xml_url')
        .single();
      if (updateError || !updatedOrder) {
        const message = updateError?.message || 'Erro ao vincular NF ao pedido';
        setNfUploadStatus(current => ({ ...current, [orderId]: { kind: 'error', message } }));
        toast.error(message);
        setUploadingNF(null);
        return;
      }
      setOrders(current => current.map(order => (
        order.id === orderId ? { ...order, [field]: storagePath } : order
      )));
      setNfUploadStatus(current => ({
        ...current,
        [orderId]: {
          kind: 'success',
          message: 'NF anexada com sucesso',
          fileName: file.name,
          storagePath,
          invoicePdfUrl: updatedOrder.invoice_pdf_url,
          invoiceXmlUrl: updatedOrder.invoice_xml_url,
        },
      }));
      toast.success(`NF ${type.toUpperCase()} salva`);
      fetchOrders();
      notifyOrdersUpdated();
    } else if (error) {
      const message = error.message || 'Erro ao enviar NF';
      setNfUploadStatus(current => ({ ...current, [orderId]: { kind: 'error', message } }));
      toast.error(message);
    } else {
      const message = 'Upload da NF não retornou confirmação do Storage';
      setNfUploadStatus(current => ({ ...current, [orderId]: { kind: 'error', message, fileName: file.name } }));
      toast.error(message);
    }
    setUploadingNF(null);
  }

  function handleInvoiceFileChange(event: ChangeEvent<HTMLInputElement>, order: RepCoOrder, type: 'pdf' | 'xml') {
    const file = event.target.files?.[0] || null;
    console.log('invoice upload onChange invoked', { fileName: file?.name || null, orderId: order?.id, type });
    event.currentTarget.value = '';

    if (!order?.id) {
      const message = 'Pedido sem ID. Não foi possível iniciar o upload da NF.';
      setNfUploadStatus(current => ({ ...current, unknown: { kind: 'error', message, fileName: file?.name || undefined } }));
      toast.error(message);
      return;
    }

    if (!file) {
      const message = 'Nenhum arquivo foi selecionado.';
      setNfUploadStatus(current => ({ ...current, [order.id]: { kind: 'error', message } }));
      return;
    }

    void uploadNF(order.id, file, type);
  }

  function getInvoiceInputKey(orderId: string, type: 'pdf' | 'xml') {
    return `${orderId}:${type}`;
  }

  function openInvoiceFilePicker(order: RepCoOrder, type: 'pdf' | 'xml') {
    const key = getInvoiceInputKey(order.id, type);
    const input = invoiceInputRefs.current[key];
    console.log('invoice upload button clicked', { orderId: order.id, type, hasInput: Boolean(input) });

    if (!input) {
      const message = 'Input de upload da NF não foi encontrado para este pedido.';
      setNfUploadStatus(current => ({ ...current, [order.id]: { kind: 'error', message } }));
      toast.error(message);
      return;
    }

    setNfUploadStatus(current => ({
      ...current,
      [order.id]: { kind: 'info', message: `Seletor de arquivo aberto para NF ${type.toUpperCase()}...` },
    }));
    input.click();
  }

  async function uploadPaymentProof(orderId: string, file: File) {
    setUploadingProof(orderId);
    const path = `commissions/${orderId}/proof-${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 60 * 24 * 365);
      await supabase.from('representative_commissions').update({
        proof_url: url?.signedUrl, status: 'paid', paid_at: new Date().toISOString(),
      }).eq('order_id', orderId);
      fetchOrders();
      notifyOrdersUpdated();
    }
    setUploadingProof(null);
  }

  async function markCompleted(orderId: string) {
    const order = orders.find(o => o.id === orderId);
    if (!getInvoicePathFromRef(order?.invoice_pdf_url || null)) {
      toast.error('Anexe a nota fiscal antes de concluir o pedido.');
      return;
    }
    await supabase.from('representative_orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId);
    if (String(order?.notes || '').toUpperCase().includes('SEM COMISS')) {
      await supabase
        .from('representative_commissions')
        .delete()
        .eq('order_id', orderId)
        .eq('status', 'pending');
    }
    fetchOrders();
    notifyOrdersUpdated();
  }

  function getInvoicePathFromRef(fileRef: string | null) {
    if (!fileRef) return null;
    const value = fileRef.trim();
    if (!value || value.includes('/representative-docs/')) return null;
    const marker = '/storage/v1/object/';
    const path = /^https?:\/\//i.test(value) && value.includes(marker)
      ? value.slice(value.indexOf(marker) + marker.length).replace(/^(public|sign)\//, '').replace(/^invoices\//, '').split('?')[0]
      : value.replace(/^\/+/, '');
    return path || null;
  }

  async function removeInvoiceFileIfPossible(fileRef: string | null) {
    const path = getInvoicePathFromRef(fileRef);
    if (path) await supabase.storage.from('invoices').remove([path]);
  }

  async function openStoredInvoice(fileRef: string | null) {
    if (!fileRef) { toast.error('NF sem arquivo vinculado'); return; }
    const path = getInvoicePathFromRef(fileRef);
    if (!path) { toast.error('Link antigo ou inválido da NF. Reenvie a nota pelo bucket invoices.'); return; }
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) { toast.error('Erro ao abrir NF'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function removeOrderInvoice(order: RepCoOrder, type: 'pdf' | 'xml') {
    const label = type === 'pdf' ? 'PDF' : 'XML';
    if (order.status === 'completed') {
      toast.error('Pedido concluído precisa manter a nota fiscal anexada.');
      return;
    }
    if (!window.confirm(`Remover a NF ${label} deste pedido?`)) return;
    const field = type === 'pdf' ? 'invoice_pdf_url' : 'invoice_xml_url';
    await removeInvoiceFileIfPossible(order[field]);
    const { data: updatedOrder, error } = await supabase
      .from('representative_orders')
      .update({ [field]: null })
      .eq('id', order.id)
      .select('id, invoice_pdf_url, invoice_xml_url')
      .single();
    if (error || !updatedOrder) { toast.error(error?.message || `Erro ao remover NF ${label}`); return; }
    setOrders(current => current.map(item => (
      item.id === order.id ? { ...item, [field]: null } : item
    )));
    toast.success(`NF ${label} removida`);
    fetchOrders();
    notifyOrdersUpdated();
  }

  const totalPIX = orders.filter(o => ['pix','a_vista'].includes(o.payment_method||'')).reduce((s,o)=>s+o.total_amount,0);
  const totalBoleto = orders.filter(o => o.payment_method==='boleto').reduce((s,o)=>s+o.total_amount,0);
  const totalPending = orders.filter(o => ['new','pending'].includes(o.status)).length;

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"/></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">PIX / À vista</p>
          <p className="text-lg font-semibold text-green-600">R$ {totalPIX.toLocaleString('pt-BR',{maximumFractionDigits:0})}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Boleto / Prazo</p>
          <p className="text-lg font-semibold text-amber-600">R$ {totalBoleto.toLocaleString('pt-BR',{maximumFractionDigits:0})}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Pendentes</p>
          <p className="text-lg font-semibold text-red-600">{totalPending}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all','pix','boleto'] as const).map(f => (
            <button key={f} onClick={()=>setChannelFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${channelFilter===f?'bg-white text-amber-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {f==='all'?'Todos':f==='pix'?'PIX / À vista':'Boleto / Prazo'}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 bg-white">
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {orders.length===0 ? (
        <div className="text-center py-10 text-gray-400"><p className="text-3xl mb-2">📋</p><p className="text-sm">Nenhum pedido encontrado</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status]??STATUS_CONFIG.new;
            const isSelected = selectedOrder?.id===order.id;
            const isPix = ['pix','a_vista'].includes(order.payment_method||'');
            const hasDiscount = order.discount_percentage&&order.discount_percentage>0;
            return (
              <div key={order.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${isSelected?'border-amber-400':'border-gray-200'}`}>
                <div className="p-3 cursor-pointer flex items-start gap-3" onClick={()=>setSelectedOrder(isSelected?null:order)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{order.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPix?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>
                        {isPix?'PIX':`Boleto ${order.payment_term??0}d`}
                      </span>
                      {order.pix_bonus_eligible&&<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">+0.5% bônus</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{order.client_name} · {new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                    {!representativeId&&<p className="text-xs text-gray-400">{order.rep_name}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {hasDiscount?(<>
                      <p className="text-xs text-gray-400 line-through">R$ {order.original_amount?.toFixed(2).replace('.',',')}</p>
                      <p className="text-sm font-semibold text-gray-800">R$ {order.total_amount.toFixed(2).replace('.',',')}</p>
                      <p className="text-xs text-green-600">-{order.discount_percentage}%</p>
                    </>):(
                      <p className="text-sm font-semibold text-gray-800">R$ {order.total_amount.toFixed(2).replace('.',',')}</p>
                    )}
                  </div>
                </div>
                {isSelected&&(
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Nº pedido cliente:</span>
                      <span className="text-xs text-gray-700">
                        {order.client_order_number||(order.has_client_order_number===false?'Sem número — encaminhar ao fiscal':'—')}
                      </span>
                    </div>
                    {order.notes&&<p className="text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2">{order.notes}</p>}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">Nota fiscal:</p>
                      {nfUploadStatus[order.id] && (
                        <div className={`rounded-lg border px-3 py-2 text-xs ${
                          nfUploadStatus[order.id].kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' :
                          nfUploadStatus[order.id].kind === 'success' ? 'border-green-200 bg-green-50 text-green-700' :
                          'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                          <p className="font-semibold">{nfUploadStatus[order.id].message}</p>
                          {nfUploadStatus[order.id].fileName && <p className="mt-1">Arquivo: {nfUploadStatus[order.id].fileName}</p>}
                          {nfUploadStatus[order.id].storagePath && <p className="mt-1 break-all">Storage path: {nfUploadStatus[order.id].storagePath}</p>}
                          {nfUploadStatus[order.id].invoicePdfUrl && <p className="mt-1 break-all">invoice_pdf_url: {nfUploadStatus[order.id].invoicePdfUrl}</p>}
                          {nfUploadStatus[order.id].invoiceXmlUrl && <p className="mt-1 break-all">invoice_xml_url: {nfUploadStatus[order.id].invoiceXmlUrl}</p>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {order.invoice_pdf_url?(
                          <>
                            <button onClick={()=>openStoredInvoice(order.invoice_pdf_url)} className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg">Ver NF PDF</button>
                            <button type="button" onClick={() => openInvoiceFilePicker(order, 'pdf')} className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                              {uploadingNF===order.id?'Enviando...':'Substituir PDF'}
                            </button>
                            <input id={`repco-nf-pdf-${order.id}`} type="file" accept="application/pdf,.pdf" className="hidden"
                              ref={el => { invoiceInputRefs.current[getInvoiceInputKey(order.id, 'pdf')] = el; }}
                              onChange={e=>handleInvoiceFileChange(e, order, 'pdf')}/>
                            <button onClick={()=>removeOrderInvoice(order, 'pdf')} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
                              Remover PDF
                            </button>
                          </>
                        ):(
                          <>
                            <button type="button" onClick={() => openInvoiceFilePicker(order, 'pdf')} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                              {uploadingNF===order.id?'Enviando...':'+ Upload NF PDF'}
                            </button>
                            <input id={`repco-nf-pdf-${order.id}`} type="file" accept="application/pdf,.pdf" className="hidden"
                              ref={el => { invoiceInputRefs.current[getInvoiceInputKey(order.id, 'pdf')] = el; }}
                              onChange={e=>handleInvoiceFileChange(e, order, 'pdf')}/>
                          </>
                        )}
                        {order.invoice_xml_url?(
                          <>
                            <button onClick={()=>openStoredInvoice(order.invoice_xml_url)} className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg">Ver XML</button>
                            <button type="button" onClick={() => openInvoiceFilePicker(order, 'xml')} className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                              {uploadingNF===order.id?'Enviando...':'Substituir XML'}
                            </button>
                            <input id={`repco-nf-xml-${order.id}`} type="file" accept="application/xml,text/xml,.xml" className="hidden"
                              ref={el => { invoiceInputRefs.current[getInvoiceInputKey(order.id, 'xml')] = el; }}
                              onChange={e=>handleInvoiceFileChange(e, order, 'xml')}/>
                            <button onClick={()=>removeOrderInvoice(order, 'xml')} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50">
                              Remover XML
                            </button>
                          </>
                        ):(
                          <>
                            <button type="button" onClick={() => openInvoiceFilePicker(order, 'xml')} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                              + Upload XML
                            </button>
                            <input id={`repco-nf-xml-${order.id}`} type="file" accept="application/xml,text/xml,.xml" className="hidden"
                              ref={el => { invoiceInputRefs.current[getInvoiceInputKey(order.id, 'xml')] = el; }}
                              onChange={e=>handleInvoiceFileChange(e, order, 'xml')}/>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status==='new'&&order.invoice_pdf_url&&(
                        <button onClick={()=>markCompleted(order.id)} className="text-xs bg-[#8B2214] text-white px-3 py-1.5 rounded-lg hover:bg-[#6d1a10]">Marcar como concluído</button>
                      )}
                      {order.status==='completed'&&(
                        <button onClick={()=>{ invoiceInputRefs.current[`${order.id}:proof`]?.click(); }} disabled={uploadingProof===order.id}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {uploadingProof===order.id?'Enviando...':'+ Comprovante de pagamento'}
                        </button>
                      )}
                      <input ref={el=>{ invoiceInputRefs.current[`${order.id}:proof`]=el; }} type="file" accept=".pdf,.png,.jpg" className="hidden"
                        onChange={e=>{const f=e.target.files?.[0];if(f)uploadPaymentProof(order.id,f);}}/>
                    </div>
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
