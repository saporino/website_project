// Seller Central — entrada do vendedor.
//
// Login de verdade, pelo Supabase Auth. Não existe acesso de demonstração
// embutido aqui: o vendedor da apresentação entra com um usuário real,
// criado pela equipe e ligado à loja dele.
import { useState } from 'react';
import { MARCA, navegar, rota } from '../config';
import { entrar } from './sessao';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (entrando) return;
    setEntrando(true);
    setErro(null);
    const falha = await entrar(email, senha);
    setEntrando(false);
    // Deu certo: a própria Seller Central percebe a sessão nova e troca a
    // tela. Nada a fazer aqui.
    if (falha) setErro(falha);
  }

  return (
    <div className="sc-entrar">
      <div className="sc-entrar-caixa">
        <img src={MARCA.logo} alt={MARCA.titulo} className="sc-entrar-logo" />
        <h1>Seller Central</h1>
        <p>Acesso para vendedores aprovados do Coffee LiVRE.</p>

        <form onSubmit={enviar} className="sc-form">
          <label className="sc-campo">
            <span>E-mail</span>
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="sc-campo">
            <span>Senha</span>
            <input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} />
          </label>
          {erro && <p className="sc-erro" role="alert">{erro}</p>}
          <button type="submit" className="sc-botao sc-botao-principal" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="sc-entrar-rodape">
          Ainda não vende no Coffee LiVRE?{' '}
          <a href={rota('vender')} onClick={e => { e.preventDefault(); navegar('vender'); }}>Peça sua entrada</a>
          {' · '}
          <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Voltar à loja</a>
        </p>
      </div>
    </div>
  );
}
