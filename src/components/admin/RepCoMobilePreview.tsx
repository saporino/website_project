import { Suspense, lazy, useMemo, useState, type ElementType } from 'react';
import { Home, ClipboardList, Users, ShoppingBag, Map, RefreshCw, X } from 'lucide-react';
import RepCoHome from '../repco/RepCoHome';
import RepCoProspection from '../repco/RepCoProspection';
import RepCoClients from '../repco/RepCoClients';
import { RepCoOrders } from '../repco/RepCoOrders';

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

const TABS: { id: PreviewTab; label: string; icon: ElementType }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'prospection', label: 'Prospecção', icon: ClipboardList },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { id: 'rotas', label: 'Rotas', icon: Map },
];

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
      return <RepCoOrders key={propsKey} repId={selectedRep.id} />;
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
          <div className="rounded-[2.2rem] border border-gray-700 bg-gray-900 p-2 shadow-2xl">
            <div className="relative h-[820px] w-[390px] max-h-[calc(100vh-7rem)] overflow-hidden rounded-[1.8rem] bg-[#f8f7f5]">
              <div className="absolute left-1/2 top-2 z-20 h-1.5 w-24 -translate-x-1/2 rounded-full bg-gray-900/20" />

              <header className="border-b border-gray-200 bg-white px-4 pb-3 pt-5">
                <div className="flex items-center gap-3">
                  <img src="/saporino-logo.png" alt="Saporino" className="h-8 w-auto object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">Portal RepCo</p>
                    <p className="truncate text-xs text-gray-500">{selectedRep?.full_name || 'Selecione um representante'}</p>
                  </div>
                </div>
                <select
                  value={representativeId}
                  onChange={event => setRepresentativeId(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#a4240e]"
                >
                  {availableReps.length === 0 && <option value="">Nenhum representante ativo</option>}
                  {availableReps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name}
                    </option>
                  ))}
                </select>
              </header>

              <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex min-w-max items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                        activeTab === tab.id ? 'bg-[#a4240e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              <main className="h-[calc(100%-154px)] overflow-y-auto px-4 py-4">
                {renderContent()}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
