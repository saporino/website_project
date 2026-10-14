// RepCo › WhatsApp — a central, por PAPEL de acesso.
//
// Decisão do Vlademir (14/10/2026): administrador e quem tem papel `atendimento` abrem a
// central SEM precisar de cadastro de representante. É uma central só, dentro do RepCo,
// separada do chat interno "Mensagens".
//
// A porta aqui é cortesia, não segurança: quem decide o que cada pessoa enxerga é a RLS do
// banco. Mesmo que alguém contornasse esta tela, `vw_wa_caixa` não devolveria linha nenhuma
// sem papel na empresa. Esta verificação existe para dar uma resposta clara em vez de uma
// tela vazia sem explicação.
import { useEffect, useState } from 'react';
import { MessageCircle, Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import RepCoWhatsApp from '../components/repco/RepCoWhatsApp';
import { podeAtender } from '../components/repco/whatsappDados';

export default function CentralWhatsApp() {
  const { user, loading } = useAuth();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [login, setLogin] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setAutorizado(false); return; }
    podeAtender().then(r => setAutorizado(r.pode)).catch(() => setAutorizado(false));
  }, [user, loading]);

  // Esperar o `loading` do useAuth antes de decidir: sem isso, um F5 mostra "sem acesso"
  // enquanto a sessão ainda está sendo restaurada.
  if (loading || (user && autorizado === null)) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#8B2214]" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Central de WhatsApp</h2>
          <p className="text-gray-500 mb-5 text-sm">Entre com sua conta para abrir o atendimento.</p>
          <button onClick={() => setLogin(true)}
            className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold py-2.5 rounded-lg transition-colors">
            Entrar
          </button>
        </div>
        <AuthModal isOpen={login} onClose={() => setLogin(false)} initialMode="login" loginContext="central" />
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Sem acesso à central</h2>
          <p className="text-gray-500 text-sm">
            A central de WhatsApp é para administradores e para quem tem o papel
            <strong> atendimento</strong> em alguma empresa. Peça o acesso ao administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs text-gray-500 mb-3">RepCo › <strong>WhatsApp</strong></p>
        <RepCoWhatsApp />
      </div>
    </div>
  );
}
