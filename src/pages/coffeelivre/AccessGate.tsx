// Portão da demonstração privada do Coffee LiVRE.
//
// PENDENTE FASE 2: esta NÃO é a autenticação do marketplace. É o portão da
// apresentação a convidados. A autenticação de comprador e de vendedor vem
// depois, com Supabase Auth e papéis.
//
// O que mudou nesta rodada: o código saiu do pacote JavaScript. Antes ele
// vinha de uma variável de ambiente e era comparado aqui no navegador, o
// que o deixava legível para qualquer visitante e impossível de trocar sem
// um novo deploy. Agora a conferência acontece no servidor, pela função
// `lv_validar_acesso`, que devolve apenas verdadeiro ou falso. A tabela de
// códigos é admin-only e guarda hash, nunca o código.
//
// Continua sendo barreira de conveniência: quem tem um código válido pode
// passá-lo adiante. O que ganhamos é poder desativar esse código sem
// derrubar os outros, e sem publicar nada.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MARCA, CHAVE_SESSAO, DEMONSTRACAO_PRIVADA } from './config';

const PADRAO_DIAS = 30;

/** Sessão ainda válida? Leitura tolerante: storage bloqueado não quebra a tela. */
function sessaoValida(): boolean {
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
}

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [liberado, setLiberado] = useState(() => sessaoValida());
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);

  // Fora dos buscadores enquanto for apresentação para convidados.
  useEffect(() => {
    if (!DEMONSTRACAO_PRIVADA) return;
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    return () => { document.head.removeChild(m); };
  }, []);

  if (liberado) return <>{children}</>;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (conferindo) return;
    setConferindo(true);
    setErro(null);
    try {
      // A normalização (espaços e caixa) acontece no banco, para as duas
      // pontas concordarem sempre.
      const { data, error } = await supabase.rpc('lv_validar_acesso', { codigo });
      if (error) throw error;
      if (data === true) {
        try { localStorage.setItem(CHAVE_SESSAO, String(Date.now())); } catch { /* sessão anônima entra igual */ }
        setLiberado(true);
        return;
      }
      setErro('Código inválido. Confira e tente de novo.');
    } catch {
      // Rede fora do ar não pode parecer código errado: a pessoa ficaria
      // digitando o código certo sem entender.
      setErro('Não foi possível confirmar agora. Tente novamente em instantes.');
    } finally {
      setConferindo(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#DA6418', color: '#3A2318',
      display: 'grid', placeItems: 'center', padding: '24px',
      fontFamily: '"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <img src={MARCA.logo} alt={MARCA.titulo} style={{ height: '64px', width: 'auto', margin: '0 auto 26px', display: 'block' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#3A2318', lineHeight: 1.25 }}>
          {MARCA.titulo}
        </h1>
        <p style={{ fontSize: '14px', marginTop: '10px', color: '#351E14', lineHeight: 1.45 }}>
          Plataforma em fase de apresentação. Acesso restrito a convidados.
        </p>
        <form onSubmit={entrar} style={{ marginTop: '22px', display: 'grid', gap: '10px' }}>
          <input
            type="password"
            value={codigo}
            onChange={e => { setCodigo(e.target.value); setErro(null); }}
            placeholder="Código de acesso"
            aria-label="Código de acesso"
            autoFocus
            style={{
              padding: '12px 14px', borderRadius: '6px', border: 0, fontSize: '16px',
              background: '#fff', color: '#2A1911', width: '100%',
            }}
          />
          <button type="submit" disabled={conferindo} style={{
            padding: '12px 14px', borderRadius: '6px', border: 0,
            cursor: conferindo ? 'default' : 'pointer', opacity: conferindo ? .7 : 1,
            background: '#3A2318', color: '#fff', fontWeight: 700, fontSize: '15px',
          }}>
            {conferindo ? 'Conferindo…' : 'Entrar'}
          </button>
        </form>
        {erro && (
          <p role="alert" style={{ marginTop: '12px', fontSize: '13px', color: '#24150E' }}>
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
