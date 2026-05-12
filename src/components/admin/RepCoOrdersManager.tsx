import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface RepCoOrder {
  id: string; order_number: string; representative_id: string;
  total_amount: number; original_amount: number | null; discount_percentage: number | null;
  payment_method: string | null; payment_term: number | null; is_personal_delivery: boolean;
  client_order_number: string | null; has_client_order_number: boolean;
  invoice_pdf_url: string | null; invoice_xml_url: string | null; invoice_number: string | null;
  status: string; notes: string | null; created_at: string; completed_at: string | null;
  pix_bonus_eligible: boolean; client_name?: string; rep_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  new:       { label: 'Novo',      bg: 'bg-blue-100',   text: 'text-blue-700'   },
  pending:   { label: 'Pendente',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Concluído', bg: 'bg-green-100',  text: 'text-green-700'  },
  cancelled: { label: 'Cancelado', bg: 'bg-red-100',    text: 'text-red-700'    },
};

export default function RepCoOrdersManager({ representativeId }: { representativeId?: string }) {
  const [orders, setOrders] = useState<RepCoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | 'pix' | 'boleto'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<RepCoOrder | null>(null);
  const [uploadingNF, setUploadingNF] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState<string | null>(null);
  const nfRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchOrders(); }, [representativeId, channelFilter, statusFilter]);

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
    setUploadingNF(orderId);
    const path = `nf/${orderId}/${type}-${Date.now()}.${type}`;
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from('invoices').getPublicUrl(path);
      const field = type === 'pdf' ? 'invoice_pdf_url' : 'invoice_xml_url';
      await supabase.from('representative_orders').update({ [field]: url.publicUrl, status: 'pending' }).eq('id', orderId);
      fetchOrders();
    }
    setUploadingNF(null);
  }

  async function uploadPaymentProof(orderId: string, file: File) {
    setUploadingProof(orderId);
    const path = `commissions/${orderId}/proof-${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from('invoices').getPublicUrl(path);
      await supabase.from('representative_commissions').update({
        proof_url: url.publicUrl, status: 'paid', paid_at: new Date().toISOString(),
      }).eq('order_id', orderId);
      fetchOrders();
    }
    setUploadingProof(null);
  }

  async function markCompleted(orderId: string) {
    await supabase.from('representative_orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId);
    fetchOrders();
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
                      <div className="flex flex-wrap gap-2">
                        {order.invoice_pdf_url?(
                          <a href={order.invoice_pdf_url} target="_blank" rel="noreferrer" className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg">✓ Ver NF PDF</a>
                        ):(
                          <button onClick={()=>nfRef.current?.click()} disabled={uploadingNF===order.id}
                            className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                            {uploadingNF===order.id?'Enviando...':'+ Upload NF PDF'}
                          </button>
                        )}
                        {order.invoice_xml_url?(
                          <a href={order.invoice_xml_url} target="_blank" rel="noreferrer" className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg">✓ Ver XML</a>
                        ):(
                          <button onClick={()=>nfRef.current?.click()} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">+ Upload XML</button>
                        )}
                        <input ref={nfRef} type="file" accept=".pdf,.xml" className="hidden"
                          onChange={e=>{const f=e.target.files?.[0];if(f)uploadNF(order.id,f,f.name.endsWith('.xml')?'xml':'pdf');}}/>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status==='new'&&order.invoice_pdf_url&&(
                        <button onClick={()=>markCompleted(order.id)} className="text-xs bg-[#8B2214] text-white px-3 py-1.5 rounded-lg hover:bg-[#6d1a10]">Marcar como concluído</button>
                      )}
                      {order.status==='completed'&&(
                        <button onClick={()=>proofRef.current?.click()} disabled={uploadingProof===order.id}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                          {uploadingProof===order.id?'Enviando...':'+ Comprovante de pagamento'}
                        </button>
                      )}
                      <input ref={proofRef} type="file" accept=".pdf,.png,.jpg" className="hidden"
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
