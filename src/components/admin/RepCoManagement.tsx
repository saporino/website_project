import { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Eye, Plus, DollarSign, Upload, Download, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import PriceListManager from './PriceListManager';

interface Representative {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  commission_rate: number;
  has_personal_delivery: boolean;
  experience_start_date: string | null;
  status: 'pending' | 'active' | 'blocked';
  approved_at: string | null;
  created_at: string;
  notes: string | null;
}

interface RepOrder {
  id: string;
  order_number: string;
  description: string;
  total_amount: number;
  payment_method: string;
  is_personal_delivery: boolean;
  invoice_pdf_url: string | null;
  invoice_key: string | null;
  status: string;
  created_at: string;
  representative_clients: { razao_social: string; cnpj: string } | null;
}

interface RepCommission {
  id: string;
  order_id: string;
  order_amount: number;
  total_rate: number;
  commission_amount: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  representative_orders: { order_number: string } | null;
}

type AdminTab = 'list' | 'detail';

export function RepCoManagement() {
  const [adminTab, setAdminTab] = useState<AdminTab>('list');
  const [detailTab, setDetailTab] = useState<'pedidos' | 'comissoes' | 'precos'>('pedidos');
  const [reps, setReps] = useState<Representative[]>([]);
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);
  const [orders, setOrders] = useState<RepOrder[]>([]);
  const [commissions, setCommissions] = useState<RepCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New order form
  const [orderForm, setOrderForm] = useState({
    description: '',
    total_amount: '',
    payment_method: 'a_vista',
    is_personal_delivery: false,
    representative_client_id: '',
  });
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [clients, setClients] = useState<{ id: string; razao_social: string; cnpj: string }[]>([]);

  useEffect(() => { fetchReps(); }, []);

  const fetchReps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('representatives')
      .select('*')
      .order('created_at', { ascending: false });
    setReps(data || []);
    setLoading(false);
  };

  const fetchRepDetail = async (rep: Representative) => {
    setSelectedRep(rep);
    setAdminTab('detail');

    const [ordersRes, commissionsRes, clientsRes] = await Promise.all([
      supabase.from('representative_orders')
        .select('*, representative_clients(razao_social, cnpj)')
        .eq('representative_id', rep.id)
        .order('created_at', { ascending: false }),
      supabase.from('representative_commissions')
        .select('*, representative_orders(order_number)')
        .eq('representative_id', rep.id)
        .order('created_at', { ascending: false }),
      supabase.from('representative_clients')
        .select('id, razao_social, cnpj')
        .eq('representative_id', rep.id)
        .eq('status', 'active'),
    ]);

    setOrders(ordersRes.data || []);
    setCommissions(commissionsRes.data || []);
    setClients(clientsRes.data || []);
  };

  const handleApprove = async (rep: Representative) => {
    const { error } = await supabase.from('representatives').update({
      status: 'active',
      approved_at: new Date().toISOString(),
      experience_start_date: new Date().toISOString().split('T')[0],
    }).eq('id', rep.id);
    if (error) { toast.error('Erro ao aprovar'); return; }
    toast.success(`${rep.full_name} aprovado!`);
    fetchReps();
    if (selectedRep?.id === rep.id) setSelectedRep({ ...rep, status: 'active' });
  };

  const handleBlock = async (rep: Representative) => {
    const reason = prompt('Motivo do bloqueio (opcional):');
    const { error } = await supabase.from('representatives').update({
      status: 'blocked',
      blocked_reason: reason || null,
    }).eq('id', rep.id);
    if (error) { toast.error('Erro ao bloquear'); return; }
    toast.success(`${rep.full_name} bloqueado.`);
    fetchReps();
  };

  const handleCreateOrder = async () => {
    if (!selectedRep || !orderForm.description || !orderForm.total_amount) {
      toast.error('Preencha descrição e valor');
      return;
    }
    const { data: order, error } = await supabase.from('representative_orders').insert({
      representative_id: selectedRep.id,
      representative_client_id: orderForm.representative_client_id || null,
      description: orderForm.description,
      total_amount: parseFloat(orderForm.total_amount),
      payment_method: orderForm.payment_method,
      is_personal_delivery: orderForm.is_personal_delivery,
      status: 'new',
    }).select().single();

    if (error || !order) { toast.error('Erro ao criar pedido'); return; }

    if (nfFile) await uploadNF(order.id, nfFile);

    toast.success('Pedido criado!');
    setShowNewOrder(false);
    setOrderForm({ description: '', total_amount: '', payment_method: 'a_vista', is_personal_delivery: false, representative_client_id: '' });
    setNfFile(null);
    fetchRepDetail(selectedRep);
  };

  const uploadNF = async (orderId: string, file: File) => {
    const path = `nf/${orderId}/${file.name}`;
    const { error: upErr } = await supabase.storage.from('representative-docs').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload da NF'); return; }
    const { data: urlData } = supabase.storage.from('representative-docs').getPublicUrl(path);
    await supabase.from('representative_orders').update({
      invoice_pdf_url: urlData.publicUrl,
      invoice_number: file.name,
    }).eq('id', orderId);
  };

  const handleUploadNFExisting = async (order: RepOrder, file: File) => {
    await uploadNF(order.id, file);
    toast.success('NF enviada!');
    if (selectedRep) fetchRepDetail(selectedRep);
  };

  const handleMarkCommissionPaid = async (commission: RepCommission) => {
    const { error } = await supabase.from('representative_commissions').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', commission.id);
    if (error) { toast.error('Erro'); return; }
    toast.success('Comissão marcada como paga!');
    if (selectedRep) fetchRepDetail(selectedRep);
  };

  const handleCompleteOrder = async (order: RepOrder) => {
    const { error } = await supabase.from('representative_orders').update({ status: 'completed' }).eq('id', order.id);
    if (error) { toast.error('Erro ao concluir pedido'); return; }
    toast.success('Pedido concluído! Comissão calculada automaticamente.');
    if (selectedRep) fetchRepDetail(selectedRep);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      active: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-700',
      new: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente', active: 'Ativo', blocked: 'Bloqueado',
      new: 'Novo', completed: 'Concluído', cancelled: 'Cancelado',
    };
    return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${map[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>;
  };

  const filteredReps = statusFilter === 'all' ? reps : reps.filter(r => r.status === statusFilter);
  const pendingCount = reps.filter(r => r.status === 'pending').length;
  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);

  // ── DETAIL VIEW ──
  if (adminTab === 'detail' && selectedRep) {
    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setAdminTab('list'); setSelectedRep(null); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            ← Voltar
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{selectedRep.full_name}</h2>
            <div className="flex items-center gap-3 mt-1">
              {statusBadge(selectedRep.status)}
              <span className="text-sm text-gray-500">CPF: {selectedRep.cpf || '—'}</span>
              {selectedRep.phone && <a href={`https://wa.me/55${selectedRep.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-green-600 hover:underline"><Phone className="w-3.5 h-3.5" />{selectedRep.phone}</a>}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedRep.status === 'pending' && (
              <button onClick={() => handleApprove(selectedRep)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">
                <CheckCircle className="w-4 h-4" /> Aprovar
              </button>
            )}
            {selectedRep.status === 'active' && (
              <button onClick={() => handleBlock(selectedRep)} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
                <XCircle className="w-4 h-4" /> Bloquear
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Pedidos</p>
            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Comissões Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">R$ {totalPending.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Clientes Cadastrados</p>
            <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
          </div>
        </div>

        {/* Inner tabs */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex gap-1">
            {([{key:'pedidos',label:'Pedidos'},{key:'comissoes',label:'Comissões'},{key:'precos',label:'Tabela de Preços'}] as const).map(tab=>(
              <button key={tab.key} onClick={()=>setDetailTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab===tab.key?'border-[#a4240e] text-[#a4240e]':'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {detailTab === 'precos' && <PriceListManager />}

        {detailTab === 'pedidos' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Pedidos</h3>
            <button onClick={() => setShowNewOrder(!showNewOrder)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#a4240e] text-white text-sm font-semibold rounded-lg hover:bg-[#8a1f0c] transition-colors">
              <Plus className="w-4 h-4" /> Lançar Pedido
            </button>
          </div>

          {/* New order form */}
          {showNewOrder && (
            <div className="p-6 bg-amber-50 border-b border-amber-200">
              <h4 className="font-semibold text-gray-900 mb-4">Novo Pedido RepCo</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
                  <select value={orderForm.representative_client_id} onChange={e => setOrderForm(f => ({ ...f, representative_client_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
                    <option value="">— Selecionar cliente —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.razao_social} ({c.cnpj})</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                  <input value={orderForm.description} onChange={e => setOrderForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Pedido café especial 10kg" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total (R$) *</label>
                  <input type="number" value={orderForm.total_amount} onChange={e => setOrderForm(f => ({ ...f, total_amount: e.target.value }))}
                    placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
                  <select value={orderForm.payment_method} onChange={e => setOrderForm(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
                    <option value="a_vista">À Vista</option>
                    <option value="boleto">Boleto</option>
                    <option value="pix">PIX (+0,5% comissão)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="personal_delivery" checked={orderForm.is_personal_delivery}
                    onChange={e => setOrderForm(f => ({ ...f, is_personal_delivery: e.target.checked }))}
                    className="w-4 h-4 accent-[#a4240e]" />
                  <label htmlFor="personal_delivery" className="text-sm text-gray-700">Entrega pessoal (+2,5% se &gt; 90 dias)</label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nota Fiscal (PDF/XML)</label>
                  <input type="file" accept=".pdf,.xml" onChange={e => setNfFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#a4240e] file:text-white hover:file:bg-[#8a1f0c] cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleCreateOrder} className="px-5 py-2 bg-[#a4240e] text-white text-sm font-semibold rounded-lg hover:bg-[#8a1f0c] transition-colors">Criar Pedido</button>
                <button onClick={() => setShowNewOrder(false)} className="px-5 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {/* Orders list */}
          {orders.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">Nenhum pedido ainda</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map(order => (
                <div key={order.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{order.order_number}</span>
                        {statusBadge(order.status)}
                        {order.payment_method === 'pix' && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">PIX</span>}
                        {order.is_personal_delivery && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Entrega Pessoal</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{order.description}</p>
                      {order.representative_clients && <p className="text-xs text-gray-400 mt-0.5">{order.representative_clients.razao_social}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">R$ {order.total_amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* NF section */}
                  <div className="mt-3 flex items-center gap-3">
                    {order.invoice_pdf_url ? (
                      <a href={order.invoice_pdf_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-[#a4240e] hover:underline">
                        <Download className="w-3.5 h-3.5" /> Baixar NF
                      </a>
                    ) : (
                      <label className="flex items-center gap-1.5 text-xs font-medium text-amber-600 cursor-pointer hover:text-amber-700">
                        <Upload className="w-3.5 h-3.5" /> Enviar NF
                        <input type="file" accept=".pdf,.xml" className="hidden"
                          onChange={e => { if (e.target.files?.[0]) handleUploadNFExisting(order, e.target.files[0]); }} />
                      </label>
                    )}
                    {order.status === 'new' || order.status === 'pending' ? (
                      <button onClick={() => handleCompleteOrder(order)}
                        className="text-xs font-medium text-green-700 hover:text-green-800 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Marcar Concluído
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {detailTab === 'comissoes' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Comissões</h3>
          </div>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">Nenhuma comissão ainda</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {commissions.map(c => (
                <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.representative_orders?.order_number}</p>
                    <p className="text-xs text-gray-500">Base R$ {c.order_amount.toFixed(2)} × {c.total_rate}%</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">R$ {c.commission_amount.toFixed(2)}</span>
                    {c.status === 'pending' ? (
                      <button onClick={() => handleMarkCommissionPaid(c)}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Pagar
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Pago em {new Date(c.paid_at!).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Representantes Comerciais</h2>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-1 font-medium">⚠ {pendingCount} aguardando aprovação</p>
          )}
        </div>
        {/* Status filter */}
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
          {(['all','pending','active','blocked'] as const).map((s, idx) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : idx === 3 ? 'rounded-r-xl' : ''} ${statusFilter === s ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendentes' : s === 'active' ? 'Ativos' : 'Bloqueados'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
        </div>
      ) : filteredReps.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum representante encontrado</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Representante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cadastro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReps.map(rep => (
                <tr key={rep.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{rep.full_name}</p>
                      <p className="text-xs text-gray-500">CPF: {rep.cpf || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {rep.email && <span className="flex items-center gap-1 text-xs text-gray-600"><Mail className="w-3 h-3" />{rep.email}</span>}
                      {rep.phone && <span className="flex items-center gap-1 text-xs text-gray-600"><Phone className="w-3 h-3" />{rep.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(rep.status)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(rep.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchRepDetail(rep)}
                        className="flex items-center gap-1 text-xs font-medium text-[#a4240e] hover:underline">
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </button>
                      {rep.status === 'pending' && (
                        <button onClick={() => handleApprove(rep)}
                          className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline">
                          <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                        </button>
                      )}
                      {rep.status === 'active' && (
                        <button onClick={() => handleBlock(rep)}
                          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                          <XCircle className="w-3.5 h-3.5" /> Bloquear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
