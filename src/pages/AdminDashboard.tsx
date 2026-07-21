import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Package } from 'lucide-react';
import { OrdersManagement } from '../components/admin/OrdersManagement';
import { ProductsManagement } from '../components/admin/ProductsManagement';
import { ShippingManagement } from '../components/admin/ShippingManagement';
import { StoreSettings } from '../components/admin/StoreSettings';
import { CustomersManagement } from '../components/admin/CustomersManagement';
import { Dashboard } from '../components/admin/Dashboard';
import { RepCoManagement } from '../components/admin/RepCoManagement';
import { AdminNotificationBell } from '../components/admin/AdminNotificationBell';
import CompanySwitcher from '../components/CompanySwitcher';
import GuideToggle from '../components/GuideToggle';
import BatchManagement from '../components/admin/BatchManagement';
import Messenger from '../components/chat/Messenger';
import RepCoHelp from '../components/repco/RepCoHelp';
import PromotersAdmin from '../components/admin/PromotersAdmin';
import RepCoCommissionsManager from '../components/admin/RepCoCommissionsManager';
import RepCoPayoutBlocks from '../components/admin/RepCoPayoutBlocks';

type TabType = 'dashboard' | 'orders' | 'products' | 'customers' | 'shipping' | 'settings' | 'repco' | 'inventory' | 'messages' | 'ajuda' | 'promotores' | 'comissoes';

// RBAC — "um console, abas por papel". O admin vê tudo; cada papel de console vê só o seu.
// A trava REAL dos dados é a RLS no banco (esconder aba é só a fachada).
const ROLE_TABS: Record<string, TabType[]> = {
  supervisor: ['promotores', 'messages'],
  gerente_comercial: ['repco', 'messages'],
  contabilidade: ['comissoes', 'messages'],
};
const ALL_ADMIN_TABS: TabType[] = ['dashboard', 'orders', 'products', 'customers', 'shipping', 'repco', 'messages', 'inventory', 'settings', 'ajuda'];
const ROLE_LABEL: Record<string, string> = { supervisor: 'Supervisor', gerente_comercial: 'Gerente Comercial', contabilidade: 'Contabilidade' };
const TAB_DEFS: { id: TabType; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'products', label: 'Produtos' },
  { id: 'customers', label: 'Clientes' },
  { id: 'shipping', label: 'Transportadoras' },
  { id: 'repco', label: 'RepCo' },
  { id: 'promotores', label: 'Promotores' },
  { id: 'comissoes', label: 'Comissões' },
  { id: 'messages', label: 'Mensagens' },
  { id: 'inventory', label: 'Inventário' },
  { id: 'settings', label: 'Configurações' },
  { id: 'ajuda', label: 'Ajuda' },
];

export function AdminDashboard() {
  const { user, profile, roles, signOut, loading } = useAuth();
  const isAdmin = profile?.is_admin === true;
  // Papéis de console (não-admin) que este usuário tem
  const consoleRoles = roles.filter(r => ROLE_TABS[r]);
  // Abas que este usuário pode ver
  const allowedTabs: TabType[] = isAdmin
    ? ALL_ADMIN_TABS
    : Array.from(new Set(consoleRoles.flatMap(r => ROLE_TABS[r])));
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [refreshVersion, setRefreshVersion] = useState<Record<TabType, number>>({
    dashboard: 0,
    messages: 0,
    orders: 0,
    products: 0,
    customers: 0,
    shipping: 0,
    settings: 0,
    repco: 0,
    inventory: 0,
    ajuda: 0,
    promotores: 0,
    comissoes: 0,
  });

  // Se a aba ativa não é permitida pro papel, cai na primeira aba permitida
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs.join(','), activeTab]);

  // Deep-link: if another page stored a target tab in localStorage, activate it
  useEffect(() => {
    const target = localStorage.getItem('admin-initial-tab') as TabType | null;
    if (target) {
      openTab(target);
      localStorage.removeItem('admin-initial-tab');
    }
  }, []);

  function refreshTabs(...tabsToRefresh: TabType[]) {
    setRefreshVersion(current => {
      const next = { ...current };
      tabsToRefresh.forEach(tab => {
        next[tab] += 1;
      });
      return next;
    });
  }

  function openTab(tab: TabType) {
    setActiveTab(tab);
    refreshTabs(tab);
  }

  // Aguarda o Supabase restaurar a sessão antes de verificar permissões
  // Sem isso, F5 mostra "Acesso Negado" porque user=null enquanto carrega
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
      </div>
    );
  }

  // Acesso: admin (tudo) OU quem tem um papel de console (supervisor/gerente/contabilidade)
  if (!user || (!isAdmin && allowedTabs.length === 0)) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  const tabs = TAB_DEFS.filter(t => allowedTabs.includes(t.id));
  const roleTitle = isAdmin ? 'Administrador' : (consoleRoles.map(r => ROLE_LABEL[r]).filter(Boolean).join(' · ') || 'Equipe');

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
              <p className="text-sm text-gray-500">Café Saporino</p>
            </div>
            <div className="flex items-center space-x-3">
              <GuideToggle />
              <CompanySwitcher />
              <AdminNotificationBell onNavigate={(tab) => openTab(tab as TabType)} />
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Voltar para Loja
              </button>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500">{roleTitle}</p>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex p-1.5 gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => openTab(tab.id)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap text-center ${
                    activeTab === tab.id
                      ? 'bg-[#a4240e] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'orders' && <OrdersManagement refreshKey={refreshVersion.orders} />}
            {activeTab === 'products' && <ProductsManagement />}
            {activeTab === 'customers' && <CustomersManagement refreshKey={refreshVersion.customers} />}
            {activeTab === 'shipping' && <ShippingManagement />}
            {activeTab === 'repco' && <RepCoManagement refreshKey={refreshVersion.repco} />}
            {activeTab === 'messages' && <Messenger currentUserId={user!.id} />}
            {activeTab === 'inventory' && <BatchManagement refreshKey={refreshVersion.inventory} />}
            {activeTab === 'settings' && <StoreSettings />}
            {activeTab === 'ajuda' && (
              <div className="p-6">
                <RepCoHelp audience="admin" onContactSupport={() => openTab('messages')} />
              </div>
            )}
            {activeTab === 'promotores' && (
              <div className="p-6"><PromotersAdmin /></div>
            )}
            {activeTab === 'comissoes' && (
              <div className="p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Comissões</h2>
                  <p className="text-sm text-gray-500">Ver, pagar e anexar comprovantes — de todos os representantes.</p>
                </div>
                <RepCoPayoutBlocks refreshKey={refreshVersion.comissoes} />
                <RepCoCommissionsManager refreshKey={refreshVersion.comissoes} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
