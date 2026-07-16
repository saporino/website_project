import { useState, useEffect, Suspense, lazy, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, Eye, Plus, Upload, Phone, Mail, Map, Search, Smartphone, ArrowRightLeft, Tag, ExternalLink, BarChart3, Users, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from 'sonner';
import PriceListManager from './PriceListManager';
import RepCoInviteCodes, { RepInviteBadge } from './RepCoInviteCodes';
import UserRolesManager from './UserRolesManager';
import CoffeeMarketIndex from './CoffeeMarketIndex';
import RepCoOrdersManager from './RepCoOrdersManager';
import RepCoCommissionsManager from './RepCoCommissionsManager';
import RepCoPayoutBlocks from './RepCoPayoutBlocks';
import ProspectionAdmin from './ProspectionAdmin';
import RepCoMobilePreview from './RepCoMobilePreview';

const RepCoLiveMap = lazy(() => import('./RepCoLiveMap'));

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
  invoice_xml_url: string | null;
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
type RepClient = {
  id: string;
  razao_social: string | null;
  nome_fantasia?: string | null;
  nome_completo?: string | null;
  cnpj: string | null;
  cpf?: string | null;
  segment?: string | null;
  status?: string | null;
  tem_gondola?: boolean | null;
  geofence_radius_m?: number | null;
};

const NO_COMMISSION_NOTE = 'SEM COMISSÃO - admin marcou como não-comissionável';

export function RepCoManagement({ refreshKey = 0 }: { refreshKey?: number }) {
  const { profile } = useAuth();
  const { activeCompanyId, activeCompany } = useCompany();
  const isAdmin = profile?.is_admin === true;
  const isFlatCommission = activeCompany?.commission_model === 'flat';
  const [adminTab, setAdminTab] = useState<AdminTab>('list');
  const [adminView, setAdminView] = useState<'list' | 'map' | 'price-list' | 'prospection'>('list');
  const [detailTab, setDetailTab] = useState<'pedidos' | 'clientes' | 'comissoes' | 'precos'>('pedidos');
  const [reps, setReps] = useState<Representative[]>([]);
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);
  const [orders, setOrders] = useState<RepOrder[]>([]);
  const [commissions, setCommissions] = useState<RepCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [canalFilter, setCanalFilter] = useState<'todos'|'site'|'repco'|'marketplaces'>('todos');


  // New order form
  const [orderForm, setOrderForm] = useState({
    description: '',
    total_amount: '',
    payment_method: 'a_vista',
    is_personal_delivery: false,
    representative_client_id: '',
  });
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [clients, setClients] = useState<RepClient[]>([]);
  const [orderRepresentativeId, setOrderRepresentativeId] = useState('');
  const [orderClients, setOrderClients] = useState<RepClient[]>([]);
  const [transferClientId, setTransferClientId] = useState<string | null>(null);
  const [transferRepresentativeId, setTransferRepresentativeId] = useState('');
  const [previews, setPreviews] = useState<{ id: number; repId: string | null; isTrainingMode: boolean }[]>([]);
  const previewSeq = useRef(0);
  // "Ver como rep" — dropdown para escolher o rep, ações DESBLOQUEADAS (admin pode ajudar)
  const openPreview = (repId: string | null = null) =>
    setPreviews(p => (p.length >= 6 ? p : [...p, { id: ++previewSeq.current, repId, isTrainingMode: false }]));
  const closePreview = (id: number) => setPreviews(p => p.filter(x => x.id !== id));
  // "Ver todos" — UMA janela de treinamento genérica, sem rep específico, broadcast ao vivo
  const openAllPreviews = () => {
    setPreviews([{ id: ++previewSeq.current, repId: null, isTrainingMode: true }]);
  };
  // Edição dos dados do representante (admin)
  const [editing, setEditing] = useState(false);
  const [savingRep, setSavingRep] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', cpf: '', cnpj: '', commission_rate: 5, has_personal_delivery: false });
  // % fixo do rep NESTA empresa (modelo flat, ex. Fazendinha) — tabela representative_company_settings
  const [flatRate, setFlatRate] = useState<number>(0);
  async function openEditRep() {
    if (!selectedRep) return;
    setEditForm({
      full_name: selectedRep.full_name || '', email: selectedRep.email || '', phone: selectedRep.phone || '',
      cpf: selectedRep.cpf || '', cnpj: selectedRep.cnpj || '',
      commission_rate: selectedRep.commission_rate ?? 5, has_personal_delivery: !!selectedRep.has_personal_delivery,
    });
    if (isFlatCommission && activeCompanyId) {
      const { data } = await supabase.from('representative_company_settings')
        .select('commission_rate').eq('representative_id', selectedRep.id).eq('company_id', activeCompanyId).maybeSingle();
      setFlatRate(Number(data?.commission_rate ?? 0));
    }
    setEditing(true);
  }
  async function handleSaveRep() {
    if (!selectedRep) return;
    setSavingRep(true);
    const { error } = await supabase.from('representatives').update({
      full_name: editForm.full_name || null, email: editForm.email || null, phone: editForm.phone || null,
      cpf: editForm.cpf || null, cnpj: editForm.cnpj || null,
      commission_rate: Number(editForm.commission_rate) || 0, has_personal_delivery: editForm.has_personal_delivery,
    }).eq('id', selectedRep.id);
    // No modelo flat, grava o % fixo do rep para a empresa ativa (não afeta a fórmula Saporino)
    if (!error && isFlatCommission && activeCompanyId) {
      const { error: e2 } = await supabase.from('representative_company_settings')
        .upsert({ representative_id: selectedRep.id, company_id: activeCompanyId, commission_rate: Number(flatRate) || 0, active: true },
          { onConflict: 'representative_id,company_id' });
      if (e2) { setSavingRep(false); toast.error('Erro ao salvar % da empresa: ' + e2.message); return; }
    }
    setSavingRep(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Dados do representante atualizados');
    setSelectedRep({ ...selectedRep, ...editForm } as Representative);
    setEditing(false);
    fetchReps();
  }

  // Product selector for order form
  interface OrderProduct { id: string; name: string; price: number; image_url: string | null; stock: number; in_stock: boolean; }
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderCart, setOrderCart] = useState<Record<string, number>>({});
  const [orderProductSearch, setOrderProductSearch] = useState('');
  const [manualDeliveryBonus, setManualDeliveryBonus] = useState(false);
  const [manualPixBonus, setManualPixBonus] = useState(false);
  const [payCommission, setPayCommission] = useState(true);

  const fetchOrderProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, price, image_url, stock, in_stock').eq('company_id', activeCompanyId).eq('is_active', true).order('name');
    if (data) setOrderProducts(data);
  };

  const filteredOrderProducts = useMemo(() => {
    if (!orderProductSearch.trim()) return orderProducts;
    const q = orderProductSearch.toLowerCase();
    return orderProducts.filter(p => p.name.toLowerCase().includes(q));
  }, [orderProducts, orderProductSearch]);

  const orderCartTotal = useMemo(() => {
    return Object.entries(orderCart).reduce((sum, [pid, qty]) => {
      const p = orderProducts.find(pr => pr.id === pid);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [orderCart, orderProducts]);

  const orderCartDescription = useMemo(() => {
    return Object.entries(orderCart)
      .filter(([, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const p = orderProducts.find(pr => pr.id === pid);
        return p ? `${p.name} x${qty} (R$ ${p.price.toFixed(2)})` : '';
      })
      .filter(Boolean)
      .join(', ');
  }, [orderCart, orderProducts]);

  function updateOrderCart(productId: string, delta: number) {
    setOrderCart(prev => {
      const product = orderProducts.find(p => p.id === productId);
      if (!product) return prev;
      const current = prev[productId] || 0;
      const next = Math.max(0, Math.min(current + delta, product.stock));
      if (next <= 0) { const { [productId]: _, ...rest } = prev; return rest; }
      return { ...prev, [productId]: next };
    });
  }

  function getClientName(client: RepClient) {
    return client.nome_fantasia || client.razao_social || client.nome_completo || 'Cliente sem nome';
  }

  function getClientDocument(client: RepClient) {
    return client.cnpj || client.cpf || 'sem documento';
  }

  function openNewOrderForm() {
    const repId = selectedRep?.id || activeReps[0]?.id || '';
    setOrderRepresentativeId(repId);
    setOrderForm(f => ({ ...f, representative_client_id: '' }));
    setShowNewOrder(prev => !prev);
  }

  // Ao (re)clicar na aba RepCo (refreshKey muda), volta pra lista de representantes —
  // mesmo que estivesse na Tabela de Preços / Prospecção / detalhe de um rep.
  useEffect(() => { setAdminView('list'); setSelectedRep(null); fetchReps(); fetchSnoozedClients(); }, [refreshKey]);

  // Ao trocar de empresa, recarrega reps + volta pra lista (o detalhe é por empresa)
  useEffect(() => { setAdminTab('list'); setSelectedRep(null); fetchReps(); fetchSnoozedClients(); /* eslint-disable-next-line */ }, [activeCompanyId]);

  // Deep-link: ao voltar do mapa de prospecção, abre direto a sub-view Prospecção (não a lista).
  useEffect(() => {
    if (localStorage.getItem('repco-initial-view') === 'prospection') {
      setAdminView('prospection');
      localStorage.removeItem('repco-initial-view');
    }
  }, []);

  useEffect(() => {
    function handleRefresh() {
      fetchReps();
      fetchSnoozedClients();
      if (selectedRep) fetchRepDetail(selectedRep);
    }
    window.addEventListener('admin:repco-updated', handleRefresh);
    window.addEventListener('admin:prospection-updated', handleRefresh);
    window.addEventListener('admin:price-list-updated', handleRefresh);
    window.addEventListener('repco:orders-updated', handleRefresh);
    window.addEventListener('repco:clients-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('admin:repco-updated', handleRefresh);
      window.removeEventListener('admin:prospection-updated', handleRefresh);
      window.removeEventListener('admin:price-list-updated', handleRefresh);
      window.removeEventListener('repco:orders-updated', handleRefresh);
      window.removeEventListener('repco:clients-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [selectedRep]);

  function notifyRepCoUpdated(representativeId = selectedRep?.id) {
    window.dispatchEvent(new CustomEvent('admin:repco-updated'));
    window.dispatchEvent(new CustomEvent('repco:orders-updated', { detail: { representativeId } }));
  }

  const [snoozedClients, setSnoozedClients] = useState<any[]>([]);
  async function fetchSnoozedClients() {
    const { data } = await supabase
      .from('representative_clients')
      .select('id, nome_fantasia, razao_social, snooze_count')
      .eq('company_id', activeCompanyId)
      .eq('snooze_admin_alert', true)
      .eq('is_active_client', true);
    if (data) setSnoozedClients(data);
  }

  const fetchReps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('representatives')
      .select('*')
      .order('created_at', { ascending: false });
    setReps(data || []);
    setLoading(false);
  };

  const activeReps = useMemo(() => reps.filter(rep => rep.status === 'active'), [reps]);
  const orderSelectableReps = useMemo(() => {
    if (!selectedRep || selectedRep.status === 'active') return activeReps;
    return [selectedRep, ...activeReps.filter(rep => rep.id !== selectedRep.id)];
  }, [activeReps, selectedRep]);

  const fetchOrderClients = async (representativeId: string) => {
    if (!representativeId) {
      setOrderClients([]);
      return;
    }

    const { data, error } = await supabase
      .from('representative_clients')
      .select('id, razao_social, nome_fantasia, nome_completo, cnpj, cpf, segment, status')
      .eq('representative_id', representativeId)
      .eq('company_id', activeCompanyId)
      .eq('status', 'active')
      .order('razao_social', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar clientes do representante');
      setOrderClients([]);
      return;
    }

    setOrderClients(data || []);
  };

  useEffect(() => {
    if (showNewOrder) fetchOrderClients(orderRepresentativeId || selectedRep?.id || '');
  }, [showNewOrder, orderRepresentativeId, selectedRep?.id]);

  const fetchRepDetail = async (rep: Representative) => {
    setSelectedRep(rep);
    setAdminTab('detail');

    const [ordersRes, commissionsRes, clientsRes] = await Promise.all([
      supabase.from('representative_orders')
        .select('*, representative_clients(razao_social, cnpj)')
        .eq('representative_id', rep.id)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false }),
      supabase.from('representative_commissions')
        .select('*, representative_orders(order_number)')
        .eq('representative_id', rep.id)
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false }),
      supabase.from('representative_clients')
        .select('id, razao_social, nome_fantasia, nome_completo, cnpj, cpf, segment, status, tem_gondola, geofence_radius_m')
        .eq('representative_id', rep.id)
        .eq('company_id', activeCompanyId)
        .eq('status', 'active')
        .order('razao_social', { ascending: true }),
    ]);

    setOrders(ordersRes.data || []);
    setCommissions(commissionsRes.data || []);
    setClients(clientsRes.data || []);
    setOrderRepresentativeId(rep.id);
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
    notifyRepCoUpdated(rep.id);
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
    notifyRepCoUpdated(rep.id);
  };

  const handleCreateOrder = async () => {
    const cartItems = Object.entries(orderCart).filter(([, qty]) => qty > 0);
    const representativeId = orderRepresentativeId || selectedRep?.id || '';
    if (!representativeId) {
      toast.error('Selecione o representante do pedido');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }
    const description = orderCartDescription;
    const total = orderCartTotal;

    const { data: order, error } = await supabase.from('representative_orders').insert({
      representative_id: representativeId,
      representative_client_id: orderForm.representative_client_id || null,
      company_id: activeCompanyId,
      description,
      total_amount: total,
      original_amount: total,
      payment_method: manualPixBonus ? 'pix' : orderForm.payment_method,
      is_personal_delivery: manualDeliveryBonus || orderForm.is_personal_delivery,
      // bônus PIX/entrega só existem no modelo fórmula (Saporino); Fazendinha = % fixo
      pix_bonus_eligible: manualPixBonus && !isFlatCommission,
      channel: 'repco',
      status: 'new',
    }).select().single();

    if (error || !order) { toast.error('Erro ao criar pedido'); return; }

    // If pay_commission is false, we mark a note (the trigger will still create but admin can cancel)
    if (!payCommission) {
      await supabase.from('representative_orders').update({ notes: NO_COMMISSION_NOTE }).eq('id', order.id);
    }

    if (nfFile) await uploadNF(order.id, nfFile);

    toast.success('Pedido criado!');
    setShowNewOrder(false);
    setOrderForm({ description: '', total_amount: '', payment_method: 'a_vista', is_personal_delivery: false, representative_client_id: '' });
    setOrderCart({});
    setManualDeliveryBonus(false);
    setManualPixBonus(false);
    setPayCommission(true);
    setNfFile(null);
    if (selectedRep) fetchRepDetail(selectedRep);
    notifyRepCoUpdated();
  };

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

  const uploadNF = async (orderId: string, file: File) => {
    const extension = file.name.toLowerCase().endsWith('.xml') ? 'xml' : 'pdf';
    const path = `nf/${orderId}/${extension}-${Date.now()}.${extension}`;
    const currentOrder = orders.find(order => order.id === orderId);
    const previousRef = extension === 'xml' ? currentOrder?.invoice_xml_url : currentOrder?.invoice_pdf_url;
    const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload da NF'); return false; }
    await removeInvoiceFileIfPossible(previousRef || null);
    const field = extension === 'xml' ? 'invoice_xml_url' : 'invoice_pdf_url';
    const { data: updatedOrder, error: updateErr } = await supabase.from('representative_orders').update({
      [extension === 'xml' ? 'invoice_xml_url' : 'invoice_pdf_url']: path,
      invoice_number: file.name,
    }).eq('id', orderId).select('id, invoice_pdf_url, invoice_xml_url, invoice_number').single();
    if (updateErr || !updatedOrder) {
      toast.error(updateErr?.message || 'Erro ao vincular NF ao pedido');
      return false;
    }
    setOrders(current => current.map(order => (
      order.id === orderId ? { ...order, [field]: path, invoice_number: file.name } : order
    )));
    return true;
  };

  const handleMarkCommissionPaid = async (commission: RepCommission) => {
    const { error } = await supabase.from('representative_commissions').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', commission.id);
    if (error) { toast.error('Erro'); return; }
    toast.success('Comissão marcada como paga!');
    if (selectedRep) fetchRepDetail(selectedRep);
    notifyRepCoUpdated();
  };
  void handleMarkCommissionPaid;

  // Admin corrige gôndola / raio de geocerca de qualquer cliente (Bloco 1)
  const updateClientGondola = async (clientId: string, patch: { tem_gondola?: boolean; geofence_radius_m?: number }) => {
    const { error } = await supabase.from('representative_clients').update(patch).eq('id', clientId);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...patch } : c));
  };

  const handleTransferClient = async (client: RepClient) => {
    if (!transferRepresentativeId || transferRepresentativeId === selectedRep?.id) {
      toast.error('Selecione outro representante ativo');
      return;
    }

    const nextRep = reps.find(rep => rep.id === transferRepresentativeId);
    const confirmed = window.confirm(`Transferir ${getClientName(client)} para ${nextRep?.full_name || 'outro representante'}?\n\nOs pedidos antigos continuam no representante original.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('representative_clients')
      .update({ representative_id: transferRepresentativeId })
      .eq('id', client.id);

    if (error) {
      toast.error('Erro ao transferir cliente');
      return;
    }

    toast.success('Cliente transferido');
    setTransferClientId(null);
    setTransferRepresentativeId('');
    if (selectedRep) fetchRepDetail(selectedRep);
    notifyRepCoUpdated();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-[#f5f0ef] text-[#8B2214]',
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

  const filteredReps = reps.filter(r => {
    const matchesCanal =
      canalFilter === 'todos' ? true :
      canalFilter === 'repco' ? true :
      canalFilter === 'site' ? false :
      canalFilter === 'marketplaces' ? false :
      true;
    const matchesStatus =
      statusFilter === 'all' ? true :
      r.status === statusFilter;
    return matchesCanal && matchesStatus;
  });
  const pendingCount = reps.filter(r => r.status === 'pending').length;
  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);

  // DETAIL VIEW
  if (adminTab === 'detail' && selectedRep) {
    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setAdminTab('list'); setSelectedRep(null); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Voltar
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{selectedRep.full_name}</h2>
            <div className="flex items-center gap-3 mt-1">
              {statusBadge(selectedRep.status)}
              <span className="text-sm text-gray-500">CPF: {selectedRep.cpf || '—'}</span>
              {selectedRep.phone && <a href={`https://wa.me/55${selectedRep.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-green-600 hover:underline"><Phone className="w-3.5 h-3.5" />{selectedRep.phone}</a>}
              {selectedRep.user_id && <RepInviteBadge userId={selectedRep.user_id} />}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={openEditRep} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              <Pencil className="w-4 h-4" /> Editar
            </button>
            <button onClick={() => openPreview(selectedRep.id)} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              <Smartphone className="w-4 h-4" /> Ver como representante
            </button>
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

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(false)}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <h3 className="font-bold text-gray-900">Editar representante</h3>
                <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 hover:bg-gray-100"><XCircle className="h-5 w-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3 p-4">
                {[{ k: 'full_name', l: 'Nome completo' }, { k: 'email', l: 'E-mail' }, { k: 'phone', l: 'WhatsApp / Telefone' }, { k: 'cpf', l: 'CPF' }, { k: 'cnpj', l: 'CNPJ' }].map(f => (
                  <div key={f.k}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{f.l}</label>
                    <input value={(editForm as any)[f.k]} onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))} className="h-[34px] w-full rounded border border-gray-300 px-3 text-sm" />
                  </div>
                ))}
                {isFlatCommission ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">% de comissão em {activeCompany?.fantasia || 'nesta empresa'} (fixo)</label>
                    <input type="number" step="0.5" value={flatRate} onChange={e => setFlatRate(parseFloat(e.target.value) || 0)} className="h-[34px] w-full rounded border border-gray-300 px-3 text-sm" />
                    <p className="mt-1 text-[11px] text-gray-400">% fixo sobre a venda, sem bônus de PIX/entrega. Vale só para esta empresa.</p>
                  </div>
                ) : (<>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Comissão base (%)</label>
                  <input type="number" step="0.5" value={editForm.commission_rate} onChange={e => setEditForm(p => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))} className="h-[34px] w-full rounded border border-gray-300 px-3 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={editForm.has_personal_delivery} onChange={e => setEditForm(p => ({ ...p, has_personal_delivery: e.target.checked }))} />
                  Entrega pessoal liberada (+2,5%)
                </label>
                </>)}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
                <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSaveRep} disabled={savingRep} className="rounded-lg bg-[#8B2214] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">{savingRep ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        )}

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
            <button onClick={()=>setDetailTab('clientes')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab==='clientes'?'border-[#a4240e] text-[#a4240e]':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Clientes
            </button>
          </div>
        </div>

        {detailTab === 'precos' && <PriceListManager fixedSegment={selectedRep ? undefined : undefined} refreshKey={refreshKey} />}

        {detailTab === 'clientes' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Clientes do representante</h3>
              <p className="text-sm text-gray-500 mt-1">Transfira clientes sem alterar pedidos antigos nem histórico de comissão.</p>
            </div>

            {clients.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">Nenhum cliente ativo para este representante.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clients.map(client => {
                  const isTransferring = transferClientId === client.id;
                  return (
                    <div key={client.id} className="px-6 py-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{getClientName(client)}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                            <span>{getClientDocument(client)}</span>
                            {client.segment && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{client.segment}</span>}
                          </div>
                          {/* Gôndola (Bloco 1) — admin corrige tem_gondola + raio da geocerca */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">Gôndola:</span>
                            {[{v:true,l:'Sim'},{v:false,l:'Não'}].map(o=>(
                              <button key={String(o.v)} onClick={()=>updateClientGondola(client.id,{tem_gondola:o.v})}
                                className={`text-xs px-2.5 py-1 rounded-full border ${client.tem_gondola===o.v?'bg-[#8B2214] text-white border-[#8B2214]':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{o.l}</button>
                            ))}
                            {client.tem_gondola==null && <span className="text-xs text-gray-400">(não respondido)</span>}
                            {client.tem_gondola===true && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">· raio
                                <input type="number" min={30} max={1000} step={10} defaultValue={client.geofence_radius_m ?? 100}
                                  onBlur={e=>{const v=parseInt(e.target.value)||100; if(v!==(client.geofence_radius_m??100)) updateClientGondola(client.id,{geofence_radius_m:v});}}
                                  className="w-16 h-7 px-2 border border-gray-300 rounded text-xs" /> m
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          {isTransferring ? (
                            <>
                              <select
                                value={transferRepresentativeId}
                                onChange={e => setTransferRepresentativeId(e.target.value)}
                                className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white"
                              >
                                <option value="">Escolher novo representante</option>
                                {activeReps
                                  .filter(rep => rep.id !== selectedRep.id)
                                  .map(rep => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}
                              </select>
                              <button
                                onClick={() => handleTransferClient(client)}
                                className="h-9 px-3 rounded-lg text-sm font-semibold bg-[#a4240e] text-white hover:bg-[#8a1f0c]"
                              >
                                Confirmar transferência
                              </button>
                              <button
                                onClick={() => { setTransferClientId(null); setTransferRepresentativeId(''); }}
                                className="h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setTransferClientId(client.id); setTransferRepresentativeId(''); }}
                              className="h-9 px-3 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              Transferir cliente
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {detailTab === 'pedidos' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Pedidos</h3>
            <button onClick={openNewOrderForm}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#a4240e] text-white text-sm font-semibold rounded-lg hover:bg-[#8a1f0c] transition-colors">
              <Plus className="w-4 h-4" /> Lançar Pedido
            </button>
          </div>

          {/* New order form */}
          {showNewOrder && (
            <div className="p-6 bg-[#f8f7f5] border-b border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-4">Novo Pedido RepCo</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Representante do pedido</label>
                  <select
                    value={orderRepresentativeId}
                    onChange={e => {
                      setOrderRepresentativeId(e.target.value);
                      setOrderForm(f => ({ ...f, representative_client_id: '' }));
                    }}
                    className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded"
                  >
                    <option value="">Selecionar representante</option>
                    {orderSelectableReps.map(rep => <option key={rep.id} value={rep.id}>{rep.full_name}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">O pedido e a comissão serão vinculados ao representante escolhido.</p>
                </div>
                {/* Cliente */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
                  <select value={orderForm.representative_client_id} onChange={e => setOrderForm(f => ({ ...f, representative_client_id: e.target.value }))}
                    disabled={!orderRepresentativeId}
                    className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-400">
                    <option value="">— Selecionar cliente —</option>
                    {orderClients.map(c => <option key={c.id} value={c.id}>{getClientName(c)} ({getClientDocument(c)})</option>)}
                  </select>
                </div>

                {/* Product selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Produtos *</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={orderProductSearch}
                      onChange={e => setOrderProductSearch(e.target.value)}
                      onFocus={() => { if (orderProducts.length === 0) fetchOrderProducts(); }}
                      placeholder="Buscar produto..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 border border-gray-200 rounded-lg bg-white p-2">
                    {orderProducts.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Clique para carregar produtos...</p>
                    ) : filteredOrderProducts.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado</p>
                    ) : filteredOrderProducts.map(product => {
                      const qty = orderCart[product.id] || 0;
                      const isOut = !product.in_stock || product.stock === 0;
                      return (
                        <div key={product.id} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isOut ? 'opacity-50' : qty > 0 ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'}`}>
                          <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                            {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Café</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-[#a4240e] font-medium">R$ {product.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {qty > 0 ? (<>
                              <button onClick={() => updateOrderCart(product.id, -1)} className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-100 text-xs">−</button>
                              <span className="w-5 text-center text-sm font-bold">{qty}</span>
                              <button onClick={() => updateOrderCart(product.id, 1)} disabled={qty >= product.stock} className="w-6 h-6 rounded-full bg-[#a4240e] text-white flex items-center justify-center hover:bg-[#8a1f0c] disabled:opacity-30 text-xs">+</button>
                            </>) : (
                              <button onClick={() => !isOut && updateOrderCart(product.id, 1)} disabled={isOut}
                                className="px-2 py-1 bg-[#a4240e] text-white rounded-md text-xs font-semibold hover:bg-[#8a1f0c] disabled:opacity-30 disabled:cursor-not-allowed">
                                {isOut ? 'Esgotado' : 'Adicionar'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(orderCart).length > 0 && (
                    <div className="mt-2 bg-white border border-[#a4240e]/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Itens selecionados:</p>
                      {Object.entries(orderCart).filter(([,q]) => q > 0).map(([pid, qty]) => {
                        const p = orderProducts.find(pr => pr.id === pid);
                        if (!p) return null;
                        return <div key={pid} className="flex justify-between text-sm"><span className="text-gray-700">{p.name} × {qty}</span><span className="font-medium">R$ {(p.price * qty).toFixed(2)}</span></div>;
                      })}
                      <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 font-bold text-sm">
                        <span>Total</span><span className="text-[#a4240e]">R$ {orderCartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Forma de pagamento + NF */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
                    <select value={orderForm.payment_method} onChange={e => setOrderForm(f => ({ ...f, payment_method: e.target.value }))}
                      className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded">
                      <option value="a_vista">À Vista</option>
                      <option value="boleto">Boleto</option>
                      <option value="pix">PIX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nota Fiscal (PDF/XML)</label>
                    <input type="file" accept=".pdf,.xml" onChange={e => setNfFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#a4240e] file:text-white hover:file:bg-[#8a1f0c] cursor-pointer" />
                  </div>
                </div>

                {/* Comissão manual */}
                <div className="space-y-2 border-t border-amber-200 pt-3 mt-1">
                  <p className="text-xs font-medium text-gray-600">Comissão do representante:</p>
                  {isFlatCommission ? (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      {activeCompany?.fantasia || 'Esta empresa'} usa <strong>% fixo por representante</strong> — sem bônus de PIX ou entrega.
                    </p>
                  ) : (<>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="manual_delivery" checked={manualDeliveryBonus}
                      onChange={e => setManualDeliveryBonus(e.target.checked)}
                      className="w-4 h-4 accent-[#a4240e]" />
                    <label htmlFor="manual_delivery" className="text-sm text-gray-700">Entrega pessoal (+2,5%)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="manual_pix" checked={manualPixBonus}
                      onChange={e => setManualPixBonus(e.target.checked)}
                      className="w-4 h-4 accent-[#a4240e]" />
                    <label htmlFor="manual_pix" className="text-sm text-gray-700">Pagamento PIX (+0,5%)</label>
                  </div>
                  </>)}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="pay_commission" checked={payCommission}
                      onChange={e => setPayCommission(e.target.checked)}
                      className="w-4 h-4 accent-[#a4240e]" />
                    <label htmlFor="pay_commission" className="text-sm text-gray-700">Pagar comissão ao representante por este pedido</label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleCreateOrder} disabled={Object.keys(orderCart).length === 0}
                  className="px-5 py-2 bg-[#a4240e] text-white text-sm font-semibold rounded-lg hover:bg-[#8a1f0c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Criar Pedido{orderCartTotal > 0 ? ` — R$ ${orderCartTotal.toFixed(2)}` : ''}
                </button>
                <button onClick={() => { setShowNewOrder(false); setOrderCart({}); setOrderProductSearch(''); }} className="px-5 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

        </div>
        )}

        {detailTab === 'pedidos' && (
          <RepCoOrdersManager representativeId={selectedRep?.id} refreshKey={refreshKey} />
        )}

        {detailTab === 'comissoes' && <RepCoPayoutBlocks representativeId={selectedRep?.id} refreshKey={refreshKey} />}

        {detailTab === 'comissoes' && (
          <RepCoCommissionsManager representativeId={selectedRep?.id} refreshKey={refreshKey} />
        )}
        {previews.map((pv, i) => (
          <RepCoMobilePreview
            key={pv.id}
            offsetIndex={i}
            representatives={reps}
            initialRepresentativeId={pv.repId ?? selectedRep?.id}
            isTrainingMode={pv.isTrainingMode}
            onClose={() => closePreview(pv.id)}
          />
        ))}
      </div>
    );
  }

  // PRICE LIST VIEW
  if (adminView === 'price-list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setAdminView('list')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            Voltar aos Representantes
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tabela de Preços Global</h2>
            <p className="text-sm text-gray-500">Preços B2B por segmento — válidos para todos os representantes</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <PriceListManager refreshKey={refreshKey} />
        </div>
      </div>
    );
  }

  if (adminView === 'prospection') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setAdminView('list')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            Voltar aos Representantes
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Prospecção RepCo</h2>
            <p className="text-sm text-gray-500">Listas CSV e leads de prospecção para representantes</p>
          </div>
        </div>
        <ProspectionAdmin refreshKey={refreshKey} />
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      <RepCoInviteCodes />
      <UserRolesManager />
      {/* Row 1: Title + Action buttons */}
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Representantes Comerciais</h2>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-600 mt-1 font-medium">{pendingCount} aguardando aprovação</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAdminView('price-list')}
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Tag className="w-4 h-4" />
            Tabela de Preços
          </button>
          <button onClick={() => setAdminView('prospection')}
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            Prospecção
          </button>
          <button onClick={() => { window.history.pushState({}, '', '/repco/inteligencia'); window.dispatchEvent(new PopStateEvent('popstate')); }}
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Inteligência
          </button>
          <button onClick={() => openPreview()}
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" />
            Ver como rep
          </button>
          <button onClick={openAllPreviews} title="Abrir o espelho de todos os reps ativos"
            className="h-9 px-3.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Ver todos
          </button>
          <button onClick={() => setAdminView(v => v === 'map' ? 'list' : 'map')}
            className={`h-9 px-3.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border ${
              adminView === 'map' ? 'bg-red-50 border-[#8B2214] text-[#8B2214]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Map className="w-4 h-4" />
            {adminView === 'map' ? 'Ver lista' : 'Mapa ao vivo'}
          </button>
          {isAdmin && (
            <>
              <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />
              <button onClick={() => window.location.href = '/repco'}
                className="h-9 px-4 rounded-lg text-sm font-semibold bg-[#8B2214] text-white hover:bg-[#6d1a10] transition-colors flex items-center gap-1.5 shadow-sm">
                <ExternalLink className="w-4 h-4" />
                Abrir Portal RepCo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mercado do Café Cru (CEPEA/ESALQ) — referência de preço do grão verde */}
      <CoffeeMarketIndex />

      {/* Row 2: Canal filter + Status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
          {(['todos','site','repco','marketplaces'] as const).map((canal, idx) => (
            <button key={canal} onClick={() => setCanalFilter(canal)}
              className={`h-9 px-4 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : idx === 3 ? 'rounded-r-xl' : ''} ${canalFilter === canal ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {canal === 'todos' ? 'Todos' : canal === 'site' ? 'Site' : canal === 'repco' ? 'RepCo' : 'Marketplaces'}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold">
          {(['all','pending','active','blocked'] as const).map((s, idx) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`h-9 px-4 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : idx === 3 ? 'rounded-r-xl' : ''} ${statusFilter === s ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendentes' : s === 'active' ? 'Ativos' : 'Bloqueados'}
            </button>
          ))}
        </div>
      </div>

      {snoozedClients.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">
            {snoozedClients.length} cliente(s) adiados 2+ vezes sem comprar
          </p>
          <p className="text-xs text-red-600 mb-3">Considere transferir para outro representante ou contatar diretamente.</p>
          {snoozedClients.slice(0, 3).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-1 border-b border-red-100 last:border-0">
              <div>
                <span className="text-sm text-gray-700">{c.nome_fantasia || c.razao_social}</span>
                <span className="text-xs text-gray-400 ml-2">({c.snooze_count}x adiado)</span>
              </div>
              <button
                onClick={async () => {
                  await supabase.from('representative_clients')
                    .update({ is_active_client: false, deactivated_at: new Date().toISOString() })
                    .eq('id', c.id);
                  fetchSnoozedClients();
                }}
                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">
                Desativar
              </button>
            </div>
          ))}
        </div>
      )}

      {adminView === 'map' && (
        // isolate: contém os z-index internos do Leaflet (markers ~600, controles ~800)
        // para não vazarem por cima das janelas flutuantes do espelho.
        <div className="relative z-0" style={{ isolation: 'isolate' }}>
          <Suspense fallback={<div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"/></div>}>
            <RepCoLiveMap />
          </Suspense>
        </div>
      )}

      {previews.map((pv, i) => (
        <RepCoMobilePreview
          key={pv.id}
          offsetIndex={i}
          representatives={reps}
          initialRepresentativeId={pv.repId ?? selectedRep?.id}
          isTrainingMode={pv.isTrainingMode}
          onClose={() => closePreview(pv.id)}
        />
      ))}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
        </div>
      ) : filteredReps.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <p className="text-4xl mb-3">
            {canalFilter === 'site' ? 'Site' : canalFilter === 'marketplaces' ? 'Marketplaces' : 'RepCo'}
          </p>
          <p className="text-gray-500 font-medium">
            {canalFilter === 'site' ? 'Nenhum cliente do site ainda' :
             canalFilter === 'marketplaces' ? 'Nenhum cliente de marketplace cadastrado ainda — disponível após integração com ML, Amazon, Shopee e TikTok' :
             'Nenhum representante encontrado'}
          </p>
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
