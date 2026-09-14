// Identificação mínima do comprador: e-mail e senha no Supabase Auth.
// Nada de CPF ou telefone aqui — só o necessário para o pedido ter dono.
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { registrarFalha } from '../observabilidade';

export default function EntrarComprador({ titulo, aoEntrar }: { titulo: string; aoEntrar: () => void }) {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) {
          setErro(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : registrarFalha('login', error));
          return;
        }
        aoEntrar();
      } else {
        if (nome.trim().length < 3) { setErro('Informe seu nome.'); return; }
        if (senha.length < 8) { setErro('A senha precisa de pelo menos 8 caracteres.'); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password: senha, options: { data: { full_name: nome.trim() } },
        });
        if (error) { setErro(registrarFalha('login', error, 'Não foi possível criar a conta.')); return; }
        if (!data.session) {
          setAviso('Enviamos um e-mail de confirmação. Confirme o endereço e entre com sua senha.');
          setModo('entrar');
          return;
        }
        aoEntrar();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="ck-entrar" onSubmit={enviar}>
      <h2>{titulo}</h2>
      <p className="ck-sub">{modo === 'entrar' ? 'Entre com sua conta para fechar o pedido e acompanhar a entrega.' : 'Crie sua conta em um passo.'}</p>
      {modo === 'criar' && (
        <label className="ck-campo"><span>Nome</span>
          <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" required />
        </label>
      )}
      <label className="ck-campo"><span>E-mail</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="ck-campo"><span>Senha</span>
        <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
               autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} required />
      </label>
      {erro && <p className="ck-erro" role="alert">{erro}</p>}
      {aviso && <p className="ck-aviso" role="status">{aviso}</p>}
      <button type="submit" className="ck-botao principal" disabled={enviando}>
        {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta e continuar'}
      </button>
      <button type="button" className="ck-link" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(null); }}>
        {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
      </button>
    </form>
  );
}
