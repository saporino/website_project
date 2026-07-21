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

type TabType = 'dashboard' | 'orders' | 'products' | 'customers' | 'shipping' | 'settings' | 'repco' | 'inventory' | 'messages';

export function AdminDashboard() {
  const { user, profile, signOut, loading } = useAuth();
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
  });

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

  if (!user || !profile?.is_admin) {
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

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard' },
    { id: 'orders' as TabType, label: 'Pedidos' },
    { id: 'products' as TabType, label: 'Produtos' },
    { id: 'customers' as TabType, label: 'Clientes' },
    { id: 'shipping' as TabType, label: 'Transportadoras' },
    { id: 'repco' as TabType, label: 'RepCo' },
    { id: 'messages' as TabType, label: 'Mensagens' },
    { id: 'inventory' as TabType, label: 'Inventário' },
    { id: 'settings' as TabType, label: 'Configurações' },
  ];

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
                <p className="text-sm font-semibold text-gray-900">{profile.full_name}</p>
                <p className="text-xs text-gray-500">Administrador</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
