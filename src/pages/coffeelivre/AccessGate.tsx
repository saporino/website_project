// Portão do Coffee LiVRE (fase de apresentação a convidados).
//
// Convite de USO ÚNICO que vira conta própria (Edge Function lv-convite):
//   código → cadastro (perfil + senha, conta com o e-mail do convite) → dali em diante e-mail e senha.
//   "Perdi meu código" manda um código NOVO para o e-mail do convite e cancela o anterior.
// Quem entra: convidado não bloqueado, admin ou vendedor (public.lv_acesso_da_conta).
//
// Compatibilidade: os códigos antigos de lv_demo_access (multiuso, por script) continuam
// abrindo a apresentação até serem desativados, pela sessão local de antes.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MARCA, CHAVE_SESSAO, DEMONSTRACAO_PRIVADA, CHAVE_CODIGO_PENDENTE, CHAVE_MODO_PENDENTE } from './config';

const PADRAO_DIAS = 30;

function sessaoAntigaValida(): boolean {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return false;
    const quando = Number(bruto);
    return Number.isFinite(quando) && Date.now() - quando < PADRAO_DIAS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function encerrarSessao() {
  try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* nada a limpar */ }
  supabase.auth.signOut().catch(() => {});
}

type Modo = 'codigo' | 'cadastro' | 'entrar' | 'perdi' | 'esqueci';
interface Convite { nome: string; empresa: string | null; email: string; ja_tem_conta: boolean }

const MOTIVO: Record<string, string> = {
  invalido: 'Código não encontrado. Confira e tente de novo.',
  expirado: 'Este código expirou. Use "Perdi meu código" para receber um novo.',
  usado: 'Este código já foi usado. Entre com seu e-mail e senha.',
  bloqueado: 'Seu acesso ao Coffee LiVRE foi suspenso. Fale com a COFICO.',
  sem_convite: 'Esta conta não tem convite para o Coffee LiVRE. Use o código que você recebeu.',
};

const campo: React.CSSProperties = { padding: '12px 14px', borderRadius: '6px', border: 0, fontSize: '16px', background: '#fff', color: '#2A1911', width: '100%' };
const botao: React.CSSProperties = { padding: '12px 14px', borderRadius: '6px', border: 0, cursor: 'pointer', background: '#3A2318', color: '#fff', fontWeight: 700, fontSize: '15px' };
const linkBotao: React.CSSProperties = { background: 'none', border: 0, color: '#24150E', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 };

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('lv-convite', { body: corpo });
  if (error) {
    // A função responde 4xx com JSON explicando; o invoke transforma em erro.
    const ctx = (error as { context?: Response }).context;
    const j = ctx ? await ctx.json().catch(() => null) : null;
    if (j) return j as T;
    throw error;
  }
  return data as T;
}

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [liberado, setLiberado] = useState(() => sessaoAntigaValida());
  const [conferindoConta, setConferindoConta] = useState(true);
  const [modo, setModo] = useState<Modo>('codigo');
  const [codigo, setCodigo] = useState('');
  const [convite, setConvite] = useState<Convite | null>(null);
  const [perfil, setPerfil] = useState({ nome: '', empresa: '', telefone: '', cargo: '' });
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!DEMONSTRACAO_PRIVADA) return;
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);

  // Já logado? Confere se a conta tem acesso. Código vindo do rodapé da COFICO abre direto.
  useEffect(() => {
    (async () => {
      let pendente: string | null = null;
      let modoPendente: string | null = null;
      try {
        pendente = sessionStorage.getItem(CHAVE_CODIGO_PENDENTE);
        modoPendente = sessionStorage.getItem(CHAVE_MODO_PENDENTE);
        sessionStorage.removeItem(CHAVE_CODIGO_PENDENTE); sessionStorage.removeItem(CHAVE_MODO_PENDENTE);
      } catch { /* sem armazenamento */ }
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        const { data } = await supabase.rpc('lv_acesso_da_conta');
        const r = data as { liberado: boolean; motivo?: string } | null;
        if (r?.liberado) { setLiberado(true); setConferindoConta(false); return; }
        if (r?.motivo === 'bloqueado') setErro(MOTIVO.bloqueado);
      }
      setConferindoConta(false);
      if (modoPendente === 'entrar') setModo('entrar');
      if (pendente) { setCodigo(pendente); await conferirCodigo(pendente); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (liberado) return <>{children}</>;

  async function conferirCodigo(valor: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try {
      // Falha da função não pode barrar quem tem código antigo: cai para a conferência antiga.
      const r = await chamar<{ ok: boolean; motivo?: string } & Partial<Convite>>({ acao: 'validar', codigo: valor })
        .catch(() => ({ ok: false, motivo: 'invalido' } as { ok: boolean; motivo?: string } & Partial<Convite>));
      if (r.ok) {
        setConvite(r as Convite);
        setPerfil(p => ({ ...p, nome: r.nome ?? '', empresa: r.empresa ?? '' }));
        setEmail(r.email ?? '');
        if (r.ja_tem_conta) { setModo('entrar'); setAviso('Este e-mail já tem conta. Entre com a sua senha: o convite é vinculado na hora.'); }
        else setModo('cadastro');
        return;
      }
      // Código antigo (multiuso, por script) ainda abre a apresentação.
      const { data: antigo } = await supabase.rpc('lv_validar_acesso', { codigo: valor });
      if (antigo === true) {
        try { localStorage.setItem(CHAVE_SESSAO, String(Date.now())); } catch { /* segue */ }
        setLiberado(true);
        return;
      }
      setErro(MOTIVO[r.motivo ?? 'invalido'] ?? MOTIVO.invalido);
    } catch {
      setErro('Não foi possível confirmar agora. Tente novamente em instantes.');
    } finally { setOcupado(false); }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== senha2) { setErro('As duas senhas não são iguais.'); return; }
    if (!perfil.nome.trim()) { setErro('Informe seu nome.'); return; }
    setOcupado(true); setErro(null);
    try {
      const r = await chamar<{ ok: boolean; motivo?: string; erro?: string; email?: string }>({ acao: 'cadastrar', codigo, senha, ...perfil });
      if (!r.ok) {
        if (r.motivo === 'email_ja_tem_conta') { setModo('entrar'); setAviso(r.erro ?? null); return; }
        setErro(r.erro ?? MOTIVO[r.motivo ?? 'invalido'] ?? 'Não foi possível concluir o cadastro.');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: r.email!, password: senha });
      if (error) { setModo('entrar'); setAviso('Cadastro feito. Entre com seu e-mail e senha.'); return; }
      await supabase.rpc('lv_acesso_da_conta');   // registra o primeiro acesso
      setLiberado(true);
    } catch {
      setErro('Não foi possível concluir agora. Tente novamente em instantes.');
    } finally { setOcupado(false); }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error) { setErro('E-mail ou senha incorretos.'); return; }
      if (convite && codigo) {
        const v = await chamar<{ ok: boolean; erro?: string; motivo?: string }>({ acao: 'vincular', codigo, ...perfil });
        if (!v.ok) { setErro(v.erro ?? MOTIVO[v.motivo ?? 'invalido'] ?? 'Não foi possível usar o convite.'); return; }
      }
      const { data } = await supabase.rpc('lv_acesso_da_conta');
      const r = data as { liberado: boolean; motivo?: string } | null;
      if (r?.liberado) { setLiberado(true); return; }
      setErro(MOTIVO[r?.motivo ?? 'sem_convite'] ?? MOTIVO.sem_convite);
    } catch {
      setErro('Não foi possível entrar agora. Tente novamente em instantes.');
    } finally { setOcupado(false); }
  }

  async function perdi(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      const r = await chamar<{ mensagem: string }>({ acao: 'perdi', email });
      setAviso(r.mensagem); setModo('codigo');
    } catch {
      setErro('Não foi possível pedir agora. Tente novamente em instantes.');
    } finally { setOcupado(false); }
  }

  async function esqueci(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` }).catch(() => {});
    setOcupado(false);
    setAviso('Se este e-mail tiver cadastro, enviamos um link para criar uma nova senha.');
    setModo('entrar');
  }

  const trocar = (m: Modo) => { setModo(m); setErro(null); setAviso(null); };

  return (
    <div style={{
      minHeight: '100vh', background: '#DA6418', color: '#3A2318', display: 'grid', placeItems: 'center', padding: '24px',
      fontFamily: '"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <img src={MARCA.logo} alt={MARCA.titulo} style={{ height: '64px', width: 'auto', margin: '0 auto 26px', display: 'block' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#3A2318', lineHeight: 1.25 }}>{MARCA.titulo}</h1>
        <p style={{ fontSize: '14px', marginTop: '10px', color: '#351E14', lineHeight: 1.45 }}>
          {modo === 'cadastro' && convite
            ? `Olá, ${convite.nome}. Complete seu cadastro para entrar.`
            : 'Plataforma em fase de apresentação. Acesso restrito a convidados.'}
        </p>

        {conferindoConta ? (
          <p style={{ marginTop: '22px', fontSize: '14px' }}>Conferindo…</p>
        ) : modo === 'codigo' ? (
          <form onSubmit={e => { e.preventDefault(); conferirCodigo(codigo); }} style={{ marginTop: '22px', display: 'grid', gap: '10px' }} data-portao="codigo">
            <input type="text" value={codigo} onChange={e => { setCodigo(e.target.value.toUpperCase()); setErro(null); }}
              placeholder="Código de convite" aria-label="Código de convite" autoFocus autoComplete="off" style={campo} />
            <button type="submit" disabled={ocupado || !codigo.trim()} style={{ ...botao, opacity: ocupado ? .7 : 1 }}>{ocupado ? 'Conferindo…' : 'Entrar'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '4px' }}>
              <button type="button" onClick={() => trocar('entrar')} style={linkBotao}>Já tenho cadastro</button>
              <button type="button" onClick={() => trocar('perdi')} style={linkBotao}>Perdi meu código</button>
            </div>
          </form>
        ) : modo === 'cadastro' ? (
          <form onSubmit={cadastrar} style={{ marginTop: '22px', display: 'grid', gap: '10px', textAlign: 'left' }} data-portao="cadastro">
            <input value={email} readOnly aria-label="E-mail do convite" style={{ ...campo, background: '#f3e9e2', color: '#5a4034' }} />
            <input value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" aria-label="Seu nome" style={campo} />
            <input value={perfil.empresa} onChange={e => setPerfil(p => ({ ...p, empresa: e.target.value }))} placeholder="Empresa" aria-label="Empresa" style={campo} />
            <input value={perfil.cargo} onChange={e => setPerfil(p => ({ ...p, cargo: e.target.value }))} placeholder="Cargo (opcional)" aria-label="Cargo" style={campo} />
            <input value={perfil.telefone} onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))} placeholder="Telefone / WhatsApp" aria-label="Telefone" inputMode="tel" style={campo} />
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Crie uma senha (mín. 8 caracteres)" aria-label="Senha" autoComplete="new-password" style={campo} />
            <input type="password" value={senha2} onChange={e => setSenha2(e.target.value)} placeholder="Repita a senha" aria-label="Repita a senha" autoComplete="new-password" style={campo} />
            <button type="submit" disabled={ocupado} style={{ ...botao, opacity: ocupado ? .7 : 1 }}>{ocupado ? 'Criando sua conta…' : 'Concluir cadastro'}</button>
            <p style={{ fontSize: '12px', color: '#351E14', margin: 0 }}>Seu código será usado agora e não vale mais depois do cadastro. Dali em diante você entra com e-mail e senha.</p>
          </form>
        ) : modo === 'entrar' ? (
          <form onSubmit={entrar} style={{ marginTop: '22px', display: 'grid', gap: '10px' }} data-portao="entrar">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail" autoComplete="email" style={campo} />
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha" aria-label="Senha" autoComplete="current-password" style={campo} />
            <button type="submit" disabled={ocupado} style={{ ...botao, opacity: ocupado ? .7 : 1 }}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '4px' }}>
              <button type="button" onClick={() => trocar('codigo')} style={linkBotao}>Tenho um código</button>
              <button type="button" onClick={() => trocar('esqueci')} style={linkBotao}>Esqueci minha senha</button>
            </div>
          </form>
        ) : (
          <form onSubmit={modo === 'perdi' ? perdi : esqueci} style={{ marginTop: '22px', display: 'grid', gap: '10px' }} data-portao={modo}>
            <p style={{ fontSize: '13px', margin: 0 }}>
              {modo === 'perdi' ? 'Digite o e-mail do seu convite. Enviamos um código novo, e o anterior deixa de valer.' : 'Digite seu e-mail. Enviamos um link para criar uma nova senha.'}
            </p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" aria-label="E-mail" autoComplete="email" style={campo} />
            <button type="submit" disabled={ocupado || !email.trim()} style={{ ...botao, opacity: ocupado ? .7 : 1 }}>{ocupado ? 'Enviando…' : modo === 'perdi' ? 'Enviar código novo' : 'Enviar link'}</button>
            <button type="button" onClick={() => trocar(modo === 'perdi' ? 'codigo' : 'entrar')} style={linkBotao}>Voltar</button>
          </form>
        )}

        {aviso && <p role="status" style={{ marginTop: '12px', fontSize: '13px', color: '#24150E', background: '#f6d6bf', borderRadius: '6px', padding: '8px 10px' }}>{aviso}</p>}
        {erro && <p role="alert" style={{ marginTop: '12px', fontSize: '13px', color: '#24150E' }}>{erro}</p>}
      </div>
    </div>
  );
}
