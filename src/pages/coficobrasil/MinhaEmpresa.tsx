// Portal do cliente PJ — o perfil da empresa dele, na COFICO.
//
// O que ele vê aqui é SÓ o que é dele: a policy `cliente_pj_le_a_propria_ficha`
// decide isso no banco, não esta tela. Se alguém abrir o DevTools e trocar o id,
// o banco devolve vazio.
//
// O que ele NÃO vê e NÃO edita: limite de crédito, score, forma e prazo de
// pagamento. São condições comerciais do admin — bloqueadas por policy.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { linkPortalPJ } from './config';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { Loader2, Building2, Coffee, Package, Mail, Lock, Clock, Check, AlertCircle, LogOut } from 'lucide-react';

const MARCAS = ['Café Saporino', 'Tropeiro Paulista'];

/** O banco guarda só dígitos; quem lê reconhece o CNPJ pela pontuação. */
const formatarCNPJ = (v: string | null) => {
  const d = (v || '').replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const SITUACAO: Record<string, { texto: string; cls: string; icone: JSX.Element }> = {
  rascunho:  { texto: 'Rascunho',          cls: 'bg-gray-100 text-gray-600',     icone: <Clock className="w-3.5 h-3.5" /> },
  em_analise:{ texto: 'Em análise',        cls: 'bg-amber-100 text-amber-700',   icone: <Clock className="w-3.5 h-3.5" /> },
  aprovado:  { texto: 'Cadastro aprovado', cls: 'bg-green-100 text-green-700',   icone: <Check className="w-3.5 h-3.5" /> },
  recusado:  { texto: 'Não aprovado',      cls: 'bg-red-100 text-red-600',       icone: <AlertCircle className="w-3.5 h-3.5" /> },
};

export default function MinhaEmpresa() {
  const { user, loading: carregandoAuth } = useAuth();
  const [ficha, setFicha] = useState<any>(null);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');

  // Login direto aqui, para o cliente não ter que achar outra porta.
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState('');
  const [recuperando, setRecuperando] = useState(false);
  const [avisoSenha, setAvisoSenha] = useState('');

  useEffect(() => {
    if (carregandoAuth) return;
    if (!user) { setCarregando(false); return; }
    (async () => {
      const { data: f } = await supabase
        .from('representative_clients')
        .select('id, razao_social, nome_fantasia, cnpj, endereco_completo, nome_comprador, email_comprador, whatsapp_comprador, status_cadastro, cadastrado_em')
        .eq('user_id', user.id)
        .maybeSingle();
      setFicha(f);
      if (f) {
        const [{ data: m }, { data: p }] = await Promise.all([
          supabase.from('cliente_marcas').select('marca').eq('cliente_id', f.id).eq('ativa', true),
          supabase.from('representative_orders')
            .select('id, order_number, created_at, status, total_amount')
            .eq('representative_client_id', f.id)
            .order('created_at', { ascending: false }).limit(10),
        ]);
        setMarcas((m ?? []).map((x: any) => x.marca));
        setPedidos(p ?? []);
      }
      setCarregando(false);
    })();
  }, [user, carregandoAuth]);

  async function entrar() {
    setErroLogin(''); setAvisoSenha(''); setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) setErroLogin('E-mail ou senha incorretos.');
  }

  /**
   * Recuperação de senha pelo caminho que o site já usa (`resetPasswordForEmail`
   * → /reset-password). Nenhum sistema de login novo: é o mesmo do resto.
   *
   * A resposta é sempre a mesma, exista a conta ou não. Dizer "este e-mail não
   * está cadastrado" entrega a terceiros quem é cliente da COFICO.
   */
  async function recuperarSenha() {
    const alvo = email.trim().toLowerCase();
    if (!alvo) { setErroLogin('Escreva seu e-mail acima e clique de novo.'); return; }
    setErroLogin(''); setRecuperando(true);
    await supabase.auth.resetPasswordForEmail(alvo, {
      redirectTo: `${window.location.origin}/reset-password`,
    }).catch(() => {});
    setRecuperando(false);
    setAvisoSenha(`Se houver uma conta para ${alvo}, o link de nova senha chega em alguns minutos. Confira também o spam.`);
  }

  async function alternarMarca(m: string, ligar: boolean) {
    if (!ficha) return;
    setSalvando(true); setAviso('');
    if (ligar) {
      // Pode já existir desativada: reativar preserva o histórico, que é o ponto.
      const { error } = await supabase.from('cliente_marcas')
        .upsert({ cliente_id: ficha.id, marca: m, ativa: true, desativada_em: null, escolhida_por: user!.id },
                { onConflict: 'cliente_id,marca' });
      if (!error) setMarcas(v => [...v, m]);
      else setAviso('Não foi possível salvar agora.');
    } else {
      const { error } = await supabase.from('cliente_marcas')
        .update({ ativa: false, desativada_em: new Date().toISOString() })
        .eq('cliente_id', ficha.id).eq('marca', m);
      if (!error) setMarcas(v => v.filter(x => x !== m));
      else setAviso('Não foi possível salvar agora.');
    }
    setSalvando(false);
  }

  const moldura = (conteudo: JSX.Element) => (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col">
      <CoficoHeader />
      <main className="flex-1 px-4 py-10">{conteudo}</main>
      <CoficoFooter />
    </div>
  );

  if (carregandoAuth || carregando) {
    return moldura(<div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>);
  }

  // Sem sessão: entrar.
  if (!user) {
    return moldura(
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Entrar</h1>
        <p className="text-sm text-gray-500 mb-6">Acesse o perfil da sua empresa na COFICO Brasil.</p>
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          {erroLogin && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{erroLogin}</span>
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Seu e-mail"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={senha} onChange={e => setSenha(e.target.value)} type="password" placeholder="Sua senha"
              onKeyDown={e => e.key === 'Enter' && entrar()}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <button onClick={entrar} disabled={entrando || !email || !senha}
            className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {entrando && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
          </button>

          {avisoSenha && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{avisoSenha}</p>
          )}
          <button onClick={recuperarSenha} disabled={recuperando}
            className="w-full text-xs text-gray-500 hover:text-[#8B2214] disabled:opacity-50">
            {recuperando ? 'Enviando…' : 'Esqueci minha senha'}
          </button>
        </div>
        <div className="mt-5 border border-dashed border-gray-300 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-gray-800">Primeiro acesso</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Recebeu um código de convite da COFICO Brasil? É por aqui que você começa.
          </p>
          <a href={linkPortalPJ('cadastro')}
            className="inline-block border border-[#8B2214] text-[#8B2214] hover:bg-[#f5f0ef] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
            Usar meu código de convite
          </a>
        </div>
      </div>
    );
  }

  // Logado, mas sem ficha: a conta não é de cliente PJ.
  if (!ficha) {
    return moldura(
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Nenhuma empresa cadastrada</h1>
        <p className="text-sm text-gray-500 mb-5">
          Esta conta ainda não tem um cadastro de empresa. Se você recebeu um código de convite,
          é por ele que o cadastro começa.
        </p>
        <a href={linkPortalPJ('cadastro')} className="inline-block bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg px-6 py-3 text-sm">
          Usar meu código
        </a>
      </div>
    );
  }

  const s = SITUACAO[ficha.status_cadastro] ?? SITUACAO.em_analise;
  const linha = (rotulo: string, valor: string | null) => valor ? (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd className="text-sm text-gray-900 font-medium mt-0.5">{valor}</dd>
    </div>
  ) : null;

  return moldura(
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{ficha.nome_fantasia || ficha.razao_social}</h1>
          <p className="text-sm text-gray-500">Perfil da empresa — COFICO Brasil</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 ${s.cls}`}>
          {s.icone} {s.texto}
        </span>
      </div>

      {ficha.status_cadastro === 'em_analise' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Seu cadastro está em análise pela equipe comercial. Você será avisado quando for aprovado.
        </div>
      )}

      {/* dados cadastrais */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-2">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </span>
          Dados cadastrais
        </h2>
        <dl>
          {linha('Razão social', ficha.razao_social)}
          {linha('Nome fantasia', ficha.nome_fantasia)}
          {linha('CNPJ', formatarCNPJ(ficha.cnpj))}
          {linha('Endereço', ficha.endereco_completo)}
          {linha('Comprador', ficha.nome_comprador)}
          {linha('E-mail', ficha.email_comprador)}
          {linha('Telefone', ficha.whatsapp_comprador)}
        </dl>
        <p className="text-[11px] text-gray-400 mt-3">
          Para corrigir algum dado, fale com a equipe comercial da COFICO Brasil.
        </p>
      </section>

      {/* marcas — o cliente escolhe */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
            <Coffee className="w-5 h-5" />
          </span>
          Qual marca de café você está comprando?
        </h2>
        <p className="text-xs text-gray-500 mb-3 ml-11">Pode marcar as duas. Dá para mudar quando quiser.</p>
        {aviso && <p className="text-xs text-red-600 mb-2">{aviso}</p>}
        <div className="space-y-2">
          {MARCAS.map(m => (
            <label key={m} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${
              marcas.includes(m) ? 'border-[#8B2214] bg-[#f5f0ef]' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="checkbox" checked={marcas.includes(m)} disabled={salvando}
                onChange={e => alternarMarca(m, e.target.checked)} className="w-4 h-4 accent-[#8B2214]" />
              <span className="font-medium text-gray-800">{m}</span>
            </label>
          ))}
        </div>
      </section>

      {/* pedidos */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </span>
          Meus pedidos
        </h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-gray-500 ml-11">Nenhum pedido ainda.</p>
        ) : (
          <div className="space-y-2">
            {pedidos.map(p => (
              <div key={p.id} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2.5 text-sm">
                <span className="font-mono font-semibold text-gray-800">{p.order_number}</span>
                <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                <span className="ml-auto font-semibold text-gray-900">
                  {Number(p.total_amount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={async () => {
          if (!confirm('Sair da sua conta?')) return;
          await supabase.auth.signOut();
          window.location.href = linkPortalPJ('minha-empresa');
        }}
        className="inline-flex items-center gap-2 border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors">
        <LogOut className="w-4 h-4" aria-hidden="true" /> Sair da conta
      </button>
    </div>
  );
}
