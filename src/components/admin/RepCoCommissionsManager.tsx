import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Commission {
  id: string; representative_id: string; order_id: string;
  order_amount: number; base_rate: number; pix_bonus: number;
  delivery_bonus: number; total_rate: number; commission_amount: number;
  status: string; payment_method: string | null; scheduled_payment_date: string | null;
  payment_cycle_start: string | null; payment_cycle_end: string | null;
  paid_at: string | null; proof_url: string | null;
  rep_name?: string; order_number?: string; client_name?: string;
}

export default function RepCoCommissionsManager({ representativeId, refreshKey = 0 }: { representativeId?: string; refreshKey?: number }) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'pending'|'paid'>('pending');
  const [paymentFilter, setPaymentFilter] = useState<'all'|'pix'|'boleto'>('all');
  const [uploading, setUploading] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string|null>(null);

  useEffect(() => { fetchCommissions(); }, [representativeId, filter, paymentFilter, refreshKey]);
  useEffect(() => {
    function handleRefresh() {
      fetchCommissions();
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

  async function fetchCommissions() {
    setLoading(true);
    let query = supabase.from('representative_commissions')
      .select('*, representatives(full_name), representative_orders(order_number, representative_clients(nome_fantasia, razao_social))')
      .order('scheduled_payment_date', { ascending: true });
    if (representativeId) query = query.eq('representative_id', representativeId);
    if (filter !== 'all') query = query.eq('status', filter);
    if (paymentFilter === 'pix') query = query.in('payment_method', ['pix','a_vista']);
    if (paymentFilter === 'boleto') query = query.eq('payment_method', 'boleto');
    const { data } = await query;
    if (data) setCommissions(data.map((c: any) => ({
      ...c,
      rep_name: c.representatives?.full_name || '—',
      order_number: c.representative_orders?.order_number || '—',
      client_name: c.representative_orders?.representative_clients?.nome_fantasia ||
                   c.representative_orders?.representative_clients?.razao_social || '—',
    })));
    setLoading(false);
  }

  async function uploadProofAndPay(commissionId: string, file: File) {
    setUploading(commissionId);
    const path = `commissions/${commissionId}/proof-${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from('invoices').getPublicUrl(path);
      await supabase.from('representative_commissions').update({
        proof_url: url.publicUrl, status: 'paid', paid_at: new Date().toISOString(),
      }).eq('id', commissionId);
      fetchCommissions();
      window.dispatchEvent(new CustomEvent('admin:repco-updated'));
    }
    setUploading(null);
  }

  const totalPending = commissions.filter(c=>c.status==='pending').reduce((s,c)=>s+c.commission_amount,0);
  const totalPaid = commissions.filter(c=>c.status==='paid').reduce((s,c)=>s+c.commission_amount,0);

  const grouped = commissions.reduce((acc,c) => {
    const key = c.scheduled_payment_date||'sem_data';
    if (!acc[key]) acc[key]=[];
    acc[key].push(c);
    return acc;
  }, {} as Record<string,Commission[]>);

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"/></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">A pagar</p>
          <p className="text-lg font-semibold text-amber-600">R$ {totalPending.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Pago este mês</p>
          <p className="text-lg font-semibold text-green-600">R$ {totalPaid.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all','pending','paid'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter===f?'bg-white text-amber-700 shadow-sm':'text-gray-500'}`}>
              {f==='all'?'Todas':f==='pending'?'Pendentes':'Pagas'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all','pix','boleto'] as const).map(f=>(
            <button key={f} onClick={()=>setPaymentFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${paymentFilter===f?'bg-white text-amber-700 shadow-sm':'text-gray-500'}`}>
              {f==='all'?'Todos':f==='pix'?'PIX':'Boleto'}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(grouped).sort().map(([date, items]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200"/>
            <span className="text-xs font-medium text-gray-500 px-2">
              {date==='sem_data'
                ? 'Aguardando pagamento do cliente'
                : `Pagar em ${new Date(date).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}`}
            </span>
            <div className="h-px flex-1 bg-gray-200"/>
          </div>
          {items.map(comm => {
            const isSelected = selectedId===comm.id;
            const isPix = ['pix','a_vista'].includes(comm.payment_method||'');
            return (
              <div key={comm.id} className={`bg-white border rounded-xl overflow-hidden ${isSelected?'border-amber-400':'border-gray-200'}`}>
                <div className="p-3 cursor-pointer flex items-center gap-3" onClick={()=>setSelectedId(isSelected?null:comm.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{comm.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comm.status==='paid'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>
                        {comm.status==='paid'?'Pago':'Pendente'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isPix?'bg-green-50 text-green-600':'bg-blue-50 text-blue-600'}`}>
                        {isPix?'PIX':'Boleto'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{comm.client_name}</p>
                    {!representativeId&&<p className="text-xs text-gray-400">{comm.rep_name}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-amber-700">R$ {comm.commission_amount.toFixed(2).replace('.',',')}</p>
                    <p className="text-xs text-gray-400">{comm.total_rate}% s/ R$ {comm.order_amount.toFixed(2).replace('.',',')}</p>
                  </div>
                </div>
                {isSelected&&(
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-gray-400">Base:</span> <span className="text-gray-700">{comm.base_rate}%</span></div>
                      <div><span className="text-gray-400">Entrega:</span> <span className="text-gray-700">+{comm.delivery_bonus}%</span></div>
                      <div><span className="text-gray-400">PIX:</span> <span className="text-gray-700">+{comm.pix_bonus}%</span></div>
                    </div>
                    {comm.payment_cycle_start&&(
                      <p className="text-xs text-gray-400">
                        Ciclo: {new Date(comm.payment_cycle_start).toLocaleDateString('pt-BR')} — {new Date(comm.payment_cycle_end!).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {comm.status==='pending'&&(
                      <button onClick={()=>{setSelectedId(comm.id);fileRef.current?.click();}}
                        disabled={uploading===comm.id}
                        className="w-full text-xs bg-[#8B2214] text-white py-2 rounded-lg hover:bg-[#6d1a10] disabled:opacity-50">
                        {uploading===comm.id?'Enviando...':'+ Upload comprovante de pagamento'}
                      </button>
                    )}
                    {comm.status==='paid'&&comm.proof_url&&(
                      <a href={comm.proof_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 block">✓ Ver comprovante</a>
                    )}
                    {comm.paid_at&&<p className="text-xs text-gray-400">Pago em {new Date(comm.paid_at).toLocaleDateString('pt-BR')}</p>}
                  </div>
                )}
              </div>
            );
          })}
          <div className="text-right pr-1">
            <span className="text-xs text-gray-500">
              Subtotal: R$ {items.reduce((s,c)=>s+c.commission_amount,0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </span>
          </div>
        </div>
      ))}

      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
        onChange={e=>{const f=e.target.files?.[0];if(f&&selectedId)uploadProofAndPay(selectedId,f);}}/>
    </div>
  );
}
