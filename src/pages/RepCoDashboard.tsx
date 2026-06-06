import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { supabase } from '../lib/supabase';
import { RepCoProfile } from '../components/repco/RepCoProfile';
import RepCoClients from '../components/repco/RepCoClients';
import { RepCoOrders } from '../components/repco/RepCoOrders';
import { RepCoCommissions } from '../components/repco/RepCoCommissions';
import { RepCoPerformance } from '../components/repco/RepCoPerformance';
import RepCoNewOrder from '../components/repco/RepCoNewOrder';
import RepCoHome from '../components/repco/RepCoHome';
import RepCoProspection from '../components/repco/RepCoProspection';
import RepCoDeliveries from '../components/repco/RepCoDeliveries';
import RepCoFieldMap from '../components/repco/RepCoFieldMap';
import RepCoCalculatorFab from '../components/repco/RepCoCalculatorFab';
import { usePresence } from '../hooks/usePresence';
import { useGeolocation } from '../hooks/useGeolocation';
import { Briefcase, User, Users, ShoppingBag, DollarSign, TrendingUp, Clock, LogOut, ShoppingCart, Home, ClipboardList, Radio, Truck, MoreHorizontal, Map } from 'lucide-react';
import { useTrainingListener, espelhoTabToRepTab } from '../lib/training';


interface Representative {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  cnpj: string;
  email?: string;
  status: 'pending' | 'active' | 'blocked';
  commission_rate: number;
  experience_start_date: string | null;
  has_personal_delivery: boolean;
}

type RepCoTab = 'inicio' | 'profile' | 'clients' | 'orders' | 'commissions' | 'performance' | 'novo_pedido' | 'entregas' | 'prospection' | 'mapa';

export function RepCoDashboard() {
  const { user, profile, signOut } = useAuth();
  const [rep, setRep] = useState<Representative | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RepCoTab>('inicio');
  const [refreshVersion, setRefreshVersion] = useState<Record<RepCoTab, number>>({
    inicio: 0,
    profile: 0,
    clients: 0,
    orders: 0,
    commissions: 0,
    performance: 0,
    novo_pedido: 0,
    entregas: 0,
    prospection: 0,
    mapa: 0,
  });
  const [preSelectedClientId, setPreSelectedClientId] = useState<string | null>(null);
  const [preFilledClientData, setPreFilledClientData] = useState<any>(null);
  const [highlightDeliveryId, setHighlightDeliveryId] = useState<string | null>(null);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({ full_name: profile?.full_name || '', cpf: '', phone: '', cnpj: '' });
  const [submitting, setSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const { coords } = useGeolocation({
    enabled: !!rep && rep.status === 'active',
  });

  usePresence({
    representativeId: rep?.id ?? '',
    currentTab: activeTab,
    coords: coords ?? null,
    enabled: !!rep && rep.status === 'active',
  });

  // Modo Treinamento ao vivo: segue a tela do instrutor.
  // Ligado: espelha a aba do instrutor. Desligado: volta para Início.
  const training = useTrainingListener(rep?.id);
  useEffect(() => {
    if (training?.active && training.tab) {
      setActiveTab(espelhoTabToRepTab(training.tab) as RepCoTab);
    } else if (training?.active === false) {
      // Instrutor desligou → rep volta para Início
      setActiveTab('inicio');
    }
  }, [training]);

  // Calculadora segue o instrutor durante treinamento ao vivo
  const [calcOpen, setCalcOpen] = useState(false);
  useEffect(() => {
    if (training?.active) setCalcOpen(!!training.calcOpen);
  }, [training]);

  useEffect(() => { if (user) fetchRep(); }, [user]);

  function refreshTabs(...tabsToRefresh: RepCoTab[]) {
    setRefreshVersion(current => {
      const next = { ...current };
      tabsToRefresh.forEach(tab => {
        next[tab] += 1;
      });
      return next;
    });
  }

  function openTab(tab: RepCoTab) {
    setActiveTab(tab);
    refreshTabs(tab);
  }

  const fetchRep = async () => {
    setLoading(true);
    const { data } = await supabase.from('representatives').select('*').eq('user_id', user!.id).maybeSingle();
    setRep(data);
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!regForm.full_name || !regForm.cpf) return;
    setSubmitting(true);
    const { error } = await supabase.from('representatives').insert({
      user_id: user!.id,
      full_name: regForm.full_name,
      cpf: regForm.cpf,
      phone: regForm.phone,
      cnpj: regForm.cnpj || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (!error) fetchRep();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm w-full">
          <Briefcase className="w-12 h-12 text-[#a4240e] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Portal RepCo</h2>
          <p className="text-gray-500 mb-6">Faça login para acessar o portal de Representante Comercial.</p>
          <button onClick={() => setAuthOpen(true)}
            className="w-full px-6 py-3 bg-[#8B2214] text-white font-semibold rounded-xl hover:bg-[#6d1a10] transition-colors">
            Entrar
          </button>
          <button onClick={() => setAuthOpen(true)}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700">
            Ainda não tem conta? Criar conta
          </button>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" loginContext="rep" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
      </div>
    );
  }

  // No registration yet
  if (!rep && !showRegForm) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-[#a4240e]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Portal RepCo</h2>
          <p className="text-gray-500 mb-6">Você ainda não possui cadastro como Representante Comercial Saporino.</p>
          <button onClick={() => setShowRegForm(true)}
            className="w-full px-6 py-3 bg-[#a4240e] text-white font-semibold rounded-xl hover:bg-[#8a1f0c] transition-colors">
            Cadastrar como RepCo
          </button>
          <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
            className="w-full mt-3 px-6 py-3 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Voltar ao site
          </button>
        </div>
      </div>
    );
  }

  // Registration form
  if (!rep && showRegForm) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Cadastro de Representante Comercial</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
              <input value={regForm.full_name} onChange={e => setRegForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
              <input value={regForm.cpf} onChange={e => setRegForm(f => ({ ...f, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ (se PJ)</label>
              <input value={regForm.cnpj} onChange={e => setRegForm(f => ({ ...f, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleRegister} disabled={submitting}
              className="flex-1 px-6 py-3 bg-[#a4240e] text-white font-semibold rounded-xl hover:bg-[#8a1f0c] transition-colors disabled:opacity-60">
              {submitting ? 'Enviando...' : 'Enviar Cadastro'}
            </button>
            <button onClick={() => setShowRegForm(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending approval
  if (rep?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cadastro em Análise</h2>
          <p className="text-gray-500 mb-2">Seu cadastro foi recebido e está sendo analisado pelo administrador.</p>
          <p className="text-sm text-gray-400">Você receberá acesso ao portal assim que for aprovado.</p>
        </div>
      </div>
    );
  }

  // Blocked
  if (rep?.status === 'blocked') {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Bloqueado</h2>
          <p className="text-gray-500">Entre em contato com o administrador para mais informações.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: RepCoTab; label: string; icon: React.ElementType }[] = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'prospection', label: 'Prospecção', icon: ClipboardList },
    { id: 'mapa', label: 'Mapa', icon: Map },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'novo_pedido', label: 'Novo Pedido', icon: ShoppingCart },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'entregas', label: 'Entregas', icon: Truck },
    { id: 'commissions', label: 'Comissões', icon: DollarSign },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
  ];
  // Mobile: barra inferior corporativa = 4 principais + "Mais" (o resto em sheet)
  const MOBILE_PRIMARY: RepCoTab[] = ['inicio', 'clients', 'novo_pedido', 'entregas'];
  const primaryTabs = tabs.filter(t => MOBILE_PRIMARY.includes(t.id));
  const moreTabs = tabs.filter(t => !MOBILE_PRIMARY.includes(t.id));

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      {training?.active && (
        <>
          <div className="fixed inset-x-0 top-0 z-[101] flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
            <Radio className="h-4 w-4 animate-pulse" />
            Treinamento ao vivo — acompanhe seu instrutor{training.instructor ? ` (${training.instructor})` : ''}. Sua tela está em modo demonstração.
          </div>
          <div className="fixed inset-0 z-[100] cursor-not-allowed" aria-hidden title="Treinamento ao vivo — tela travada" />
        </>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/saporino-logo-tight.png" alt="Saporino" className="h-9 w-auto object-contain" />
            <div>
              <p className="font-bold text-gray-900 text-sm">RepCo</p>
              <p className="text-xs text-gray-500">{rep!.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.is_admin && (
              <button
                onClick={() => {
                  localStorage.setItem('admin-initial-tab', 'repco');
                  window.history.pushState({}, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                ⚙️ Voltar ao Admin
              </button>
            )}
            <button onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Voltar ao site
            </button>
            <button onClick={async () => { await signOut(); window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Banner de treinamento ao vivo */}
      {training?.active && (
        <div className="bg-[#8B2214] text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 animate-pulse">
          <span className="inline-block w-2 h-2 rounded-full bg-white" />
          Treinamento ao vivo — sua tela está sendo guiada pelo instrutor
          <span className="inline-block w-2 h-2 rounded-full bg-white" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-24 md:pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <nav className="hidden md:flex border-b border-gray-200 p-1.5 gap-0.5">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => openTab(tab.id)}
                className={`flex-1 px-2 py-2 rounded-lg font-medium text-xs text-center whitespace-nowrap transition-all ${
                  activeTab === tab.id ? 'bg-[#a4240e] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="p-8">
            {activeTab === 'inicio' && (
              <RepCoHome
                representativeId={rep!.id}
                refreshKey={refreshVersion.inicio}
                onNavigateToClient={(clientId) => { setPreSelectedClientId(clientId); openTab('novo_pedido'); }}
              />
            )}
            {activeTab === 'profile' && <RepCoProfile rep={rep!} onUpdate={fetchRep} />}
            {activeTab === 'clients' && <RepCoClients representativeId={rep!.id} refreshKey={refreshVersion.clients} initialData={preFilledClientData} onInitialDataConsumed={() => setPreFilledClientData(null)} />}
            {activeTab === 'novo_pedido' && (
              <RepCoNewOrder
                representativeId={rep!.id}
                preSelectedClientId={preSelectedClientId}
                onOrderCreated={() => {
                  setPreSelectedClientId(null);
                  refreshTabs('inicio', 'clients', 'orders');
                  openTab('orders');
                }}
              />
            )}
            {activeTab === 'orders' && <RepCoOrders repId={rep!.id} refreshKey={refreshVersion.orders} />}
            {activeTab === 'entregas' &&<RepCoDeliveries representativeId={rep!.id} currentLat={coords?.lat} currentLng={coords?.lng} refreshKey={refreshVersion.entregas}
              highlightOrderId={highlightDeliveryId} onHighlightConsumed={() => setHighlightDeliveryId(null)} />}
            {activeTab === 'mapa' && (
              <div style={{height:'calc(100vh - 200px)'}}>
                <RepCoFieldMap representativeId={rep!.id} currentLat={coords?.lat} currentLng={coords?.lng} refreshKey={refreshVersion.mapa}
                  onEditLead={(data) => { setPreFilledClientData(data); openTab('clients'); }}
                  onFinalizeDelivery={(orderId) => {
                    setHighlightDeliveryId(orderId);
                    openTab('entregas');
                    refreshTabs('entregas');
                  }} />
              </div>
            )
}
            {activeTab === 'prospection' && <RepCoProspection representativeId={rep!.id} currentLat={coords?.lat} currentLng={coords?.lng} refreshKey={refreshVersion.prospection} />}
            {activeTab === 'commissions' && <RepCoCommissions repId={rep!.id} />}
            {activeTab === 'performance' && <RepCoPerformance repId={rep!.id} />}
          </div>
        </div>
      </div>

      {/* Calculadora de Preço — botão flutuante; segue o instrutor no treinamento */}
      <RepCoCalculatorFab open={calcOpen} onOpenChange={setCalcOpen}
        syncState={training?.active ? training.calcState : undefined}
        readOnly={!!training?.active} />

      {/* Barra de navegação inferior (mobile) — padrão corporativo */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-gray-200 bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.06)] md:hidden">
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          const on = activeTab === tab.id && !moreOpen;
          return (
            <button key={tab.id} onClick={() => { openTab(tab.id); setMoreOpen(false); }}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${on ? 'text-[#a4240e]' : 'text-gray-500'}`}>
              <Icon className="h-5 w-5" /><span className="max-w-full truncate px-0.5">{tab.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(v => !v)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${moreOpen ? 'text-[#a4240e]' : 'text-gray-500'}`}>
          <MoreHorizontal className="h-5 w-5" /><span>Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-0 bottom-[54px] z-40 rounded-t-2xl border-t border-gray-200 bg-white p-3 shadow-2xl">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Mais opções</p>
            <div className="grid grid-cols-3 gap-2">
              {moreTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { openTab(tab.id); setMoreOpen(false); }}
                    className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[11px] font-medium transition-colors ${activeTab === tab.id ? 'bg-[#a4240e] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <Icon className="h-5 w-5" /><span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
