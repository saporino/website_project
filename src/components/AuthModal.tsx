import { useState, FormEvent } from 'react';
import { X, Mail, Lock, User, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal = ({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });

  const { signIn, signUp, resetPassword } = useAuth();

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(loginData.email, loginData.password);

    if (error) {
      setError('Email ou senha incorretos');
      setLoading(false);
      return;
    }

    // Wait a moment for the profile to load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the current user profile to check if admin
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_admin) {
        // User is admin - should not use this button
        await supabase.auth.signOut();
        setError('Administradores devem usar o botão "Admin" para acessar o painel');
        setLoading(false);
      } else {
        // User is not admin - allow normal login
        onClose();
        setLoginData({ email: '', password: '' });
      }
    } else {
      setError('Erro ao carregar perfil');
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!loginData.email || !loginData.password) {
      setError('Por favor, preencha email e senha para acessar como administrador');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await signIn(loginData.email, loginData.password);

    if (error) {
      setError('Email ou senha incorretos');
      setLoading(false);
      return;
    }

    // Wait a moment for the profile to load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the current user profile to check if admin
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_admin) {
        // User is admin, redirect to admin panel
        onClose();
        setLoginData({ email: '', password: '' });
        window.history.pushState({}, '', '/admin');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        // User is not admin
        await supabase.auth.signOut();
        setError('Acesso negado: você não tem permissões de administrador');
        setLoading(false);
      }
    } else {
      setError('Erro ao verificar permissões');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const { error } = await signUp(
      registerData.email,
      registerData.password,
      registerData.fullName,
      registerData.phone
    );

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Usuário já cadastrado');
      } else {
        setError(error.message || 'Erro ao criar conta');
      }
      setLoading(false);
    } else {
      setSuccessMessage('Conta criada com sucesso! Você já pode fazer login.');
      setTimeout(() => {
        setMode('login');
        setSuccessMessage('');
        setRegisterData({ email: '', password: '', fullName: '', phone: '' });
      }, 2000);
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const { error } = await resetPassword(resetEmail);

    if (error) {
      setError('Erro ao enviar e-mail de recuperação');
      setLoading(false);
    } else {
      setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setTimeout(() => {
        setMode('login');
        setSuccessMessage('');
        setResetEmail('');
      }, 3000);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-8 border-b border-gray-100">
          <h2 className="text-3xl font-bold text-gray-900">
            {mode === 'login' ? 'Acessar' : mode === 'register' ? 'Registrar-se' : 'Recuperar Senha'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
              {successMessage}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300"
              >
                {loading ? 'Entrando...' : 'Acessar'}
              </button>

              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  disabled={loading}
                  className="w-full bg-gray-800 text-white py-3 rounded-full font-semibold hover:bg-gray-900 transition-all disabled:bg-gray-400"
                >
                  {loading ? 'Verificando...' : 'Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-gray-600 hover:text-[#a4240e] text-sm font-medium"
                >
                  Esqueceu sua senha?
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-[#a4240e] hover:text-[#8a1f0c] font-medium"
                  >
                    Não tem uma conta? Registre-se
                  </button>
                </div>
              </div>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="João Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefone/WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    required
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="+55 (11) 91771-9798"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">Mínimo de 6 caracteres</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300"
              >
                {loading ? 'Criando conta...' : 'Registrar-se'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#a4240e] hover:text-[#8a1f0c] font-medium"
                >
                  Já tem uma conta? Acessar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
              <p className="text-gray-600">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#a4240e] hover:text-[#8a1f0c] font-medium"
                >
                  Voltar para o login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
