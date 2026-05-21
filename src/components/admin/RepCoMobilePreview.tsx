import { Suspense, lazy, useEffect, useMemo, useState, type ElementType } from 'react';
import { Home, ClipboardList, Users, ShoppingBag, Map, RefreshCw, X, FileText } from 'lucide-react';
import RepCoHome from '../repco/RepCoHome';
import RepCoProspection from '../repco/RepCoProspection';
import RepCoClients from '../repco/RepCoClients';
import { supabase } from '../../lib/supabase';

const RepCoRoutes = lazy(() => import('../repco/RepCoRoutes'));

interface Representative {
  id: string;
  full_name: string;
  status: 'pending' | 'active' | 'blocked';
}

interface Props {
  representatives: Representative[];
  initialRepresentativeId?: string | null;
  onClose: () => void;
}

type PreviewTab = 'inicio' | 'prospection' | 'clients' | 'orders' | 'rotas';

interface PreviewOrder {
  id: string;
  order_number: string;
  description: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  representative_clients: { razao_social: string | null; nome_fantasia: string | null } | null;
}

const TABS: { id: PreviewTab; label: string; icon: ElementType }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'prospection', label: 'Prospecção', icon: ClipboardList },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { id: 'rotas', label: 'Rotas', icon: Map },
];

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: 'Novo', className: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' },
};

function ReadOnlyOrdersPreview({ representativeId }: { representativeId: string }) {
  const [orders, setOrders] = useState<PreviewOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchOrders() {
      setLoading(true);
      const { data } = await supabase
        .from('representative_orders')
        .select('id,order_number,description,total_amount,status,created_at,representative_clients(razao_social,nome_fantasia)')
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (mounted) {
        setOrders(
          ((data || []) as any[]).map(order => ({
            ...order,
            representative_clients: Array.isArray(order.representative_clients)
              ? order.representative_clients[0] || null
              : order.representative_clients || null,
          })) as PreviewOrder[]
        );
        setLoading(false);
      }
    }
    fetchOrders();
    return () => {
      mounted = false;
    };
  }, [representativeId]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Pedidos</h3>
        <p className="text-sm text-gray-500">Visualização segura em modo leitura.</p>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          Nenhum pedido encontrado
        </div>
      ) : (
        orders.map(order => {
          const status = ORDER_STATUS[order.status] || { label: order.status, className: 'bg-gray-100 text-gray-600' };
          const clientName = order.representative_clients?.nome_fantasia || order.representative_clients?.razao_social;
          return (
            <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">{order.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  {clientName && <p className="mt-1 truncate text-xs text-gray-500">{clientName}</p>}
                  {order.description && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{order.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">R$ {Number(order.total_amount || 0).toFixed(2).replace('.', ',')}</p>
                  <p className="text-[11px] text-gray-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function RepCoMobilePreview({ representatives, initialRepresentativeId, onClose }: Props) {
  const availableReps = useMemo(
    () => representatives.filter(rep => rep.status === 'active'),
    [representatives]
  );
  const [representativeId, setRepresentativeId] = useState(
    initialRepresentativeId && availableReps.some(rep => rep.id === initialRepresentativeId)
      ? initialRepresentativeId
      : availableReps[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<PreviewTab>('inicio');
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedRep = availableReps.find(rep => rep.id === representativeId) || null;

  function renderContent() {
    if (!selectedRep) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-700">Nenhum representante ativo</p>
            <p className="mt-1 text-xs text-gray-400">Aprove ou selecione um representante ativo para abrir o preview.</p>
          </div>
        </div>
      );
    }

    const propsKey = `${selectedRep.id}-${refreshKey}`;
    if (activeTab === 'inicio') {
      return (
        <RepCoHome
          key={propsKey}
          representativeId={selectedRep.id}
          previewMode
          onNavigateToRoute={() => setActiveTab('rotas')}
          onNavigateToClient={() => setActiveTab('clients')}
        />
      );
    }
    if (activeTab === 'prospection') {
      return <RepCoProspection key={propsKey} representativeId={selectedRep.id} previewMode />;
    }
    if (activeTab === 'clients') {
      return <RepCoClients key={propsKey} representativeId={selectedRep.id} previewMode />;
    }
    if (activeTab === 'orders') {
      return <ReadOnlyOrdersPreview key={propsKey} representativeId={selectedRep.id} />;
    }
    return (
      <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>}>
        <RepCoRoutes key={propsKey} representativeId={selectedRep.id} previewMode />
      </Suspense>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/70 backdrop-blur-sm">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-gray-950/80 px-5 py-3 text-white">
          <div>
            <p className="text-sm font-semibold">Ver como representante</p>
            <p className="text-xs text-white/55">Preview mobile em modo seguro, sem ações de escrita</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey(key => key + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar preview
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Fechar preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto px-4 py-6">
          <div className="rounded-[2.4rem] border-[8px] border-gray-950 bg-gray-950 p-1 shadow-2xl">
            <div className="relative h-[812px] w-[390px] max-h-[calc(100vh-7rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.85rem] bg-[#f5f3ee]">
              <div className="flex items-center justify-between bg-[#8B2214] px-5 pb-1 pt-3 text-[10px] font-semibold text-white/90">
                <span>9:41</span>
                <span>●●●</span>
              </div>

              <header className="bg-[#8B2214] px-4 pb-3 pt-2 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 shadow-sm">
                    <img src="/saporino-logo.png" alt="Saporino" className="h-5 w-auto object-contain" />
                    <span className="text-[11px] font-bold text-[#8B2214]">RepCo</span>
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">Preview</span>
                </div>
                <div className="mt-2 min-w-0">
                  <p className="truncate text-sm font-semibold">{selectedRep?.full_name || 'Selecione um representante'}</p>
                  <p className="text-[11px] text-white/75">Espelho mobile seguro</p>
                </div>
                <select
                  value={representativeId}
                  onChange={event => setRepresentativeId(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-white/60"
                >
                  {availableReps.length === 0 && <option value="">Nenhum representante ativo</option>}
                  {availableReps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name}
                    </option>
                  ))}
                </select>
              </header>

              <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex min-w-max items-center gap-1.5 border-b-2 px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                        activeTab === tab.id ? 'border-[#8B2214] text-[#8B2214]' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              <main className="h-[calc(100%-165px)] overflow-y-auto overflow-x-hidden px-3 py-3">
                {renderContent()}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
