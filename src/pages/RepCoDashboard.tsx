import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RepCoProfile } from '../components/repco/RepCoProfile';
import { RepCoClients } from '../components/repco/RepCoClients';
import { RepCoOrders } from '../components/repco/RepCoOrders';
import { RepCoCommissions } from '../components/repco/RepCoCommissions';
import { RepCoPerformance } from '../components/repco/RepCoPerformance';
import { RepCoNewOrder } from '../components/repco/RepCoNewOrder';
import { RepCoRoutes } from '../components/repco/RepCoRoutes';
import { Briefcase, User, Users, ShoppingBag, DollarSign, TrendingUp, Clock, LogOut, ShoppingCart, Map } from 'lucide-react';

interface Representative {
  id: string;
  full_name: string;
  status: 'pending' | 'active' | 'blocked';
  commission_rate: number;
  experience_start_date: string | null;
  has_personal_delivery: boolean;
}

type RepCoTab = 'profile' | 'clients' | 'orders' | 'commissions' | 'performance' | 'novo_pedido' | 'rotas';

export function RepCoDashboard() {
  const { user, profile, signOut } = useAuth();
  const [rep, setRep] = useState<Representative | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RepCoTab>('profile');
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({ full_name: profile?.full_name || '', cpf: '', phone: '', cnpj: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (user) fetchRep(); }, [user]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <Briefcase className="w-12 h-12 text-[#a4240e] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Portal RepCo</h2>
          <p className="text-gray-500">Faça login para acessar o portal de Representante Comercial.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]" />
      </div>
    );
  }

  // No registration yet
  if (!rep && !showRegForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Bloqueado</h2>
          <p className="text-gray-500">Entre em contato com o administrador para mais informações.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: RepCoTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'clients', label: 'Meus Clientes', icon: Users },
    { id: 'novo_pedido', label: 'Novo Pedido', icon: ShoppingCart },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'rotas', label: 'Rotas', icon: Map },
    { id: 'commissions', label: 'Comissões', icon: DollarSign },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#a4240e] rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Portal RepCo</p>
              <p className="text-xs text-gray-500">{rep!.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <nav className="flex border-b border-gray-200 p-2 gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id ? 'bg-[#a4240e] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="p-8">
            {activeTab === 'profile' && <RepCoProfile rep={rep!} onUpdate={fetchRep} />}
            {activeTab === 'clients' && <RepCoClients repId={rep!.id} />}
            {activeTab === 'novo_pedido' && <RepCoNewOrder repId={rep!.id} onOrderCreated={() => setActiveTab('orders')} />}
            {activeTab === 'orders' && <RepCoOrders repId={rep!.id} />}
            {activeTab === 'rotas' && <RepCoRoutes repId={rep!.id} />}
            {activeTab === 'commissions' && <RepCoCommissions repId={rep!.id} />}
            {activeTab === 'performance' && <RepCoPerformance repId={rep!.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
