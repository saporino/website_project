import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { supabase } from '../lib/supabase';
import Messenger from '../components/chat/Messenger';
import RepCoHelp from '../components/repco/RepCoHelp';
import PromotorRota, { PromotorHistorico } from '../components/promotor/PromotorRota';
import { usePromoterPresence } from '../hooks/usePromoterPresence';
import { Route as RouteIcon, ClipboardCheck, AlertTriangle, History, MessageCircle, HelpCircle, LogOut, MoreHorizontal, Clock, Lock } from 'lucide-react';

// Portal do Promotor (/promotor) — Bloco 2: entidade, conta por convite e shell de abas.
// O promotor enxerga SÓ o horizonte operacional (views vw_promoter_*). Nada comercial.

interface Promoter {
  id: string; full_name: string; cpf: string | null; phone: string | null;
  status: 'pending' | 'active' | 'blocked'; blocked_reason: string | null; company_id: string | null;
}

type Tab = 'rota' | 'visitas' | 'pendencias' | 'historico' | 'mensagens' | 'ajuda';

export function PromotorDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('rota');
  const [moreOpen, setMoreOpen] = useState(false);
  // cadastro por convite
  const [showRegister, setShowRegister] = useState(false);
  const [code, setCode] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  const [reg, setReg] = useState({ full_name: '', cpf: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (!authLoading) fetchPromoter(); /* eslint-disable-next-line */ }, [user, authLoading]);

  async function fetchPromoter() {
    if (!user) { setPromoter(null); setLoading(false); return; }
    const { data } = await supabase.from('promoters')
      .select('id,full_name,cpf,phone,status,blocked_reason,company_id')
      .eq('user_id', user.id).maybeSingle();
    setPromoter((data as Promoter) || null);
    setLoading(false);
  }

  usePromoterPresence({ promoterId: promoter?.id || '', currentTab: activeTab, enabled: promoter?.status === 'active' });

  async function validateCode() {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('promoter_validate_invite', { p_code: code.trim() });
    setBusy(false);
    if (error || !data) { setErr('Código inválido ou expirado. Confira com o administrador.'); return; }
    setCodeOk(true);
  }

  async function register() {
    if (!reg.full_name.trim()) { setErr('Informe seu nome completo.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('promoter_register_with_code', {
      p_code: code.trim(), p_full_name: reg.full_name.trim(), p_cpf: reg.cpf || null, p_phone: reg.phone || null,
    });
    setBusy(false);
    if (error) { setErr(error.message.includes('ja cadastrado') ? 'Você já tem cadastro.' : 'Não foi possível concluir. Confira o código.'); return; }
    setShowRegister(false); fetchPromoter();
  }

  if (authLoading || loading) return <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#8B2214]" /></div>;

  // sem login → modal de login (mesmo padrão do RepCo)
  if (!user) return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <AuthModal isOpen={true} onClose={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }} initialMode="login" loginContext="rep" />
    </div>
  );

  // sem cadastro → só por convite
  if (!promoter) return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ef] flex items-center justify-center"><Lock className="w-7 h-7 text-[#8B2214]" /></div>
        <h1 className="text-xl font-bold text-gray-900">Portal do Promotor</h1>
        {!showRegister ? (<>
          <p className="text-sm text-gray-500">Você ainda não possui cadastro de promotor. O acesso é somente por convite do administrador.</p>
          <button onClick={() => setShowRegister(true)} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-2.5 rounded-xl">Tenho um código de convite</button>
        </>) : (<>
          {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          {!codeOk ? (<>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Código do convite"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-center uppercase tracking-widest" />
            <button onClick={validateCode} disabled={busy || !code.trim()} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">{busy ? 'Validando…' : 'Validar código'}</button>
          </>) : (<>
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Código válido! Complete seu cadastro:</p>
            <input value={reg.full_name} onChange={e => setReg(p => ({ ...p, full_name: e.target.value }))} placeholder="Nome completo *" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <input value={reg.cpf} onChange={e => setReg(p => ({ ...p, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="CPF" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <input value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} placeholder="WhatsApp / Telefone" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
            <button onClick={register} disabled={busy} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">{busy ? 'Enviando…' : 'Concluir cadastro'}</button>
          </>)}
          <button onClick={() => { setShowRegister(false); setCodeOk(false); setErr(''); }} className="text-xs text-gray-400 hover:text-gray-600">Voltar</button>
        </>)}
      </div>
    </div>
  );

  if (promoter.status === 'pending') return (
    <CenterCard icon={<Clock className="w-7 h-7 text-amber-600" />} title="Cadastro em análise"
      text="Seu cadastro foi recebido. Você terá acesso assim que for aprovado pelo administrador." onExit={signOut} />
  );
  if (promoter.status === 'blocked') return (
    <CenterCard icon={<Lock className="w-7 h-7 text-red-600" />} title="Acesso bloqueado"
      text={promoter.blocked_reason || 'Entre em contato com o administrador.'} onExit={signOut} />
  );

  // ATIVO — shell com abas (conteúdo das abas chega nos Blocos 3-5)
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'rota', label: 'Minha rota', icon: RouteIcon },
    { id: 'visitas', label: 'Visitas de hoje', icon: ClipboardCheck },
    { id: 'pendencias', label: 'Pendências', icon: AlertTriangle },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'mensagens', label: 'Mensagens', icon: MessageCircle },
    { id: 'ajuda', label: 'Ajuda', icon: HelpCircle },
  ];
  const MOBILE_PRIMARY: Tab[] = ['rota', 'visitas', 'mensagens'];
  const primary = tabs.filter(t => MOBILE_PRIMARY.includes(t.id));
  const more = tabs.filter(t => !MOBILE_PRIMARY.includes(t.id));

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-2 h-16">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img src="/saporino-logo-tight.png" alt="Saporino" className="h-8 sm:h-9 w-auto object-contain flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm leading-tight">Promotor</p>
              <p className="text-xs text-gray-500 truncate whitespace-nowrap overflow-hidden">{promoter.full_name}</p>
            </div>
          </div>
          <button onClick={async () => { await signOut(); window.history.pushState({}, '', '/promotor'); window.dispatchEvent(new PopStateEvent('popstate')); }}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0" title="Sair"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-6">
        {/* Abas desktop */}
        <div className="hidden md:flex gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${activeTab === t.id ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'mensagens' && user && <Messenger currentUserId={user.id} />}
        {activeTab === 'ajuda' && <RepCoHelp onContactSupport={() => setActiveTab('mensagens')} />}
        {(activeTab === 'rota' || activeTab === 'visitas') && <PromotorRota promoterId={promoter.id} promoterName={promoter.full_name} />}
        {activeTab === 'historico' && <PromotorHistorico promoterId={promoter.id} />}
        {activeTab === 'pendencias' && (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
            <p className="text-4xl mb-3">🛠️</p>
            <p className="font-medium text-gray-600">Pendências / Ocorrências</p>
            <p className="text-sm mt-1">Disponível em breve — as ocorrências chegam no bloco do alerta de ruptura.</p>
          </div>
        )}
      </div>

      {/* Barra inferior mobile: 3 primárias + Mais */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex border-t border-gray-200 bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.06)] md:hidden">
        {primary.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setMoreOpen(false); }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${activeTab === t.id && !moreOpen ? 'text-[#8B2214]' : 'text-gray-500'}`}>
            <t.icon className="w-5 h-5" /> {t.label}
          </button>
        ))}
        <button onClick={() => setMoreOpen(o => !o)} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${moreOpen ? 'text-[#8B2214]' : 'text-gray-500'}`}>
          <MoreHorizontal className="w-5 h-5" /> Mais
        </button>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-14 inset-x-3 bg-white rounded-2xl shadow-xl p-3 grid grid-cols-3 gap-2" onClick={e => e.stopPropagation()}>
            {more.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setMoreOpen(false); }}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[11px] font-medium ${activeTab === t.id ? 'bg-[#8B2214] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
                <t.icon className="w-5 h-5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CenterCard({ icon, title, text, onExit }: { icon: React.ReactNode; title: string; text: string; onExit: () => Promise<void> }) {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ef] flex items-center justify-center">{icon}</div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{text}</p>
        <button onClick={onExit} className="text-sm text-gray-400 hover:text-gray-600 underline">Sair</button>
      </div>
    </div>
  );
}
