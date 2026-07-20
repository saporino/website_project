import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { supabase } from '../lib/supabase';
import Messenger from '../components/chat/Messenger';
import RepCoHelp from '../components/repco/RepCoHelp';
import PromotorRota, { PromotorHistorico } from '../components/promotor/PromotorRota';
import PromotorOcorrencias from '../components/promotor/PromotorOcorrencias';
import CompanySwitcher from '../components/CompanySwitcher';
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
  const { user, loading: authLoading, signOut, signIn } = useAuth();
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('rota');
  const [moreOpen, setMoreOpen] = useState(false);
  // cadastro por convite
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [code, setCode] = useState('');
  const [codeOk, setCodeOk] = useState(false);
  const [reg, setReg] = useState({ full_name: '', cpf: '', phone: '', email: '', password: '', password2: '' });
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

  // Já está logado (tem conta) e recebeu um código: só vincula o papel de promotor.
  async function registerExisting() {
    if (!reg.full_name.trim()) { setErr('Informe seu nome completo.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('promoter_register_with_code', {
      p_code: code.trim(), p_full_name: reg.full_name.trim(), p_cpf: reg.cpf || null, p_phone: reg.phone || null,
    });
    setBusy(false);
    if (error) { setErr(error.message.includes('ja cadastrado') ? 'Você já tem cadastro de promotor.' : 'Não foi possível concluir. Confira o código.'); return; }
    setShowRegister(false); setCodeOk(false); fetchPromoter();
  }

  // Primeiro acesso (sem conta): o CÓDIGO é a porta. A conta nasce já confirmada (Edge Function),
  // então o promotor entra na hora — sem esperar e-mail de confirmação.
  async function register() {
    if (!reg.full_name.trim()) { setErr('Informe seu nome completo.'); return; }
    if (!reg.email.trim() || !reg.email.includes('@')) { setErr('Informe um e-mail válido.'); return; }
    if (reg.password.length < 6) { setErr('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (reg.password !== reg.password2) { setErr('As senhas não conferem.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promoter-signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(), full_name: reg.full_name.trim(), cpf: reg.cpf || null,
          phone: reg.phone || null, email: reg.email.trim(), password: reg.password,
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || r.error) { setErr(r.error || 'Não foi possível concluir o cadastro.'); setBusy(false); return; }
      // entra direto com a conta recém-criada
      const { error: sErr } = await signIn(reg.email.trim(), reg.password);
      setBusy(false);
      if (sErr) { setErr('Conta criada! Agora faça login com seu e-mail e senha.'); setShowRegister(false); setCodeOk(false); return; }
      setShowRegister(false);
    } catch {
      setBusy(false); setErr('Falha de conexão. Tente de novo.');
    }
  }

  if (authLoading || loading) return <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#8B2214]" /></div>;

  // SEM LOGIN → porta do promotor: o CÓDIGO vem primeiro (não existe "criar conta" solto aqui)
  if (!user) return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full space-y-4">
        <div className="text-center space-y-2">
          <img src="/saporino-logo-tight.png" alt="Saporino" className="h-10 mx-auto object-contain" />
          <h1 className="text-xl font-bold text-gray-900">Área do Promotor</h1>
        </div>
        {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

        {!showRegister ? (<>
          <button onClick={() => setShowLogin(true)} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-3 rounded-xl">
            Já tenho conta — Entrar
          </button>
          <div className="flex items-center gap-3 text-xs text-gray-400"><div className="flex-1 h-px bg-gray-200" />ou<div className="flex-1 h-px bg-gray-200" /></div>
          <button onClick={() => { setShowRegister(true); setErr(''); }} className="w-full border-2 border-[#8B2214] text-[#8B2214] font-semibold py-3 rounded-xl">
            Primeiro acesso — tenho um código
          </button>
          <p className="text-[11px] text-gray-400 text-center">O acesso de promotor é somente por convite do administrador.</p>
        </>) : !codeOk ? (<>
          {/* ETAPA 1: o código é a porta */}
          <p className="text-sm text-gray-500 text-center">Digite o código de convite que o administrador te enviou.</p>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center uppercase tracking-widest font-mono" />
          <button onClick={validateCode} disabled={busy || !code.trim()} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
            {busy ? 'Validando…' : 'Validar código'}
          </button>
          <button onClick={() => { setShowRegister(false); setErr(''); setCode(''); }} className="w-full text-xs text-gray-400 hover:text-gray-600">Voltar</button>
        </>) : (<>
          {/* ETAPA 2: só depois do código válido é que cria a conta */}
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 text-center">✓ Código válido! Agora crie seu acesso.</p>
          <input value={reg.full_name} onChange={e => setReg(p => ({ ...p, full_name: e.target.value }))} placeholder="Nome completo *" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <input value={reg.cpf} onChange={e => setReg(p => ({ ...p, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="CPF" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <input value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} placeholder="WhatsApp" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <input type="email" value={reg.email} onChange={e => setReg(p => ({ ...p, email: e.target.value }))} placeholder="Seu e-mail *" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <input type="password" value={reg.password} onChange={e => setReg(p => ({ ...p, password: e.target.value }))} placeholder="Crie uma senha *" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <input type="password" value={reg.password2} onChange={e => setReg(p => ({ ...p, password2: e.target.value }))} placeholder="Repita a senha *" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm" />
          <button onClick={register} disabled={busy} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-3 rounded-xl disabled:opacity-50">
            {busy ? 'Criando acesso…' : 'Criar meu acesso'}
          </button>
          <button onClick={() => { setCodeOk(false); setErr(''); }} className="w-full text-xs text-gray-400 hover:text-gray-600">Voltar</button>
        </>)}
      </div>
      {showLogin && (
        <AuthModal isOpen={true} onClose={() => setShowLogin(false)} initialMode="login" loginContext="promotor" />
      )}
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
            <button onClick={registerExisting} disabled={busy} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">{busy ? 'Enviando…' : 'Concluir cadastro'}</button>
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
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <CompanySwitcher compact />
            <button onClick={async () => { await signOut(); window.history.pushState({}, '', '/promotor'); window.dispatchEvent(new PopStateEvent('popstate')); }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0" title="Sair"><LogOut className="w-4 h-4" /></button>
          </div>
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
        {activeTab === 'pendencias' && <PromotorOcorrencias promoterId={promoter.id} onOpenChat={() => setActiveTab('mensagens')} />}
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
