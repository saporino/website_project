// Cadastro de cliente PJ pela COFICO — a porta central.
//
// Quatro passos, nesta ordem de propósito:
//   1. código     — confere ANTES de a pessoa digitar a ficha inteira; descobrir
//                   no fim que o código estava errado é a pior hora.
//   2. acesso     — e-mail (o do convite, travado) + senha. Acesso permanente:
//                   da próxima vez entra por e-mail e senha, sem o código.
//   3. empresa    — CNPJ puxa razão social e endereço da Receita (grátis).
//   4. marcas     — o PRÓPRIO cliente diz o que compra. Pode marcar as duas.
//
// O que este cadastro NÃO faz: conceder crédito, prazo de pagamento ou limite.
// Isso é decisão comercial do admin, e o banco impede por policy, não só aqui.
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { lookupCnpj } from '../../lib/cnpjLookup';
import { linkPortalPJ } from './config';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { Loader2, Check, KeyRound, Building2, Mail, Lock, Coffee, AlertCircle } from 'lucide-react';

// As marcas que o cliente pode declarar. São LINHAS DE PRODUTO, não empresas:
// quem fatura continua sendo a empresa vendedora do pedido.
const MARCAS = ['Café Saporino', 'Tropeiro Paulista'];

type Passo = 'codigo' | 'acesso' | 'empresa' | 'pronto';

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');
const formatarCNPJ = (v: string) => {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

export default function CadastroPJ() {
  const [passo, setPasso] = useState<Passo>('codigo');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [emailConvite, setEmailConvite] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');

  const [cnpj, setCnpj] = useState('');
  const [razao, setRazao] = useState('');
  const [fantasia, setFantasia] = useState('');
  const [comprador, setComprador] = useState('');
  const [emailEmpresa, setEmailEmpresa] = useState('');
  const [whats, setWhats] = useState('');
  const [endereco, setEndereco] = useState('');
  const [marcas, setMarcas] = useState<string[]>([]);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  async function conferirCodigo() {
    setErro(''); setOcupado(true);
    const { data, error } = await supabase.rpc('repco_validate_invite_pj', { p_code: codigo.trim() });
    setOcupado(false);
    if (error) { setErro('Não foi possível conferir o código agora. Tente de novo.'); return; }
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.valido) { setErro(r?.motivo ?? 'Código inválido.'); return; }
    setEmailConvite(r.email ?? '');
    setPasso('acesso');
  }

  async function criarAcesso() {
    setErro('');
    if (senha.length < 8) { setErro('A senha precisa ter ao menos 8 caracteres.'); return; }
    if (senha !== senha2) { setErro('As duas senhas não são iguais.'); return; }
    setOcupado(true);

    // A conta nasce na Edge Function, não no navegador: com a confirmação de
    // e-mail ligada, o signUp daqui não devolve sessão e o cadastro morria no
    // último passo com "Sessão necessária". O convite já prova o endereço.
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cliente-pj-conta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        // O gateway exige um JWT. Aqui ainda não existe sessão — é justamente a
        // conta que está sendo criada — então vai a chave anônima, que é pública
        // por natureza. Quem decide se o cadastro vale é o CÓDIGO, conferido
        // dentro da função com a chave de serviço.
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ codigo: codigo.trim(), senha }),
    });
    const r = await resp.json().catch(() => ({}));
    if (!resp.ok || !r?.ok) {
      setOcupado(false);
      setErro(r?.error ?? 'Não foi possível criar o acesso. Tente de novo.');
      return;
    }

    // Agora sim: sessão de verdade, pelo caminho normal de login.
    const { error: eLogin } = await supabase.auth.signInWithPassword({ email: emailConvite, password: senha });
    setOcupado(false);
    if (eLogin) {
      setErro(r.jaExistia
        ? 'Esta conta já existe e a senha não confere. Use a senha que você criou antes.'
        : 'Conta criada, mas não foi possível entrar. Tente novamente.');
      return;
    }
    setPasso('empresa');
  }

  async function puxarCnpj(valor: string) {
    if (soDigitos(valor).length !== 14) return;
    setBuscandoCnpj(true); setErro('');
    try {
      const d = await lookupCnpj(valor);
      setRazao(r => r || d.razao_social);
      setFantasia(f => f || d.nome_fantasia);
      setEndereco(e => e || [d.endereco, d.cidade, d.uf, d.cep].filter(Boolean).join(' — '));
      if (d.situacao && d.situacao.toUpperCase() !== 'ATIVA') {
        setErro(`Atenção: a Receita informa a situação "${d.situacao}" para este CNPJ.`);
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível consultar a Receita.');
    } finally { setBuscandoCnpj(false); }
  }

  async function enviarCadastro() {
    setErro('');
    if (soDigitos(cnpj).length !== 14) { setErro('Informe um CNPJ com 14 dígitos.'); return; }
    if (!razao.trim()) { setErro('Informe a razão social.'); return; }
    if (marcas.length === 0) { setErro('Selecione ao menos uma marca de café.'); return; }
    setOcupado(true);
    const { error } = await supabase.rpc('cliente_pj_registrar', {
      p_code: codigo.trim(),
      p_cnpj: soDigitos(cnpj),
      p_razao_social: razao.trim(),
      p_nome_fantasia: fantasia.trim() || null,
      p_nome_comprador: comprador.trim() || null,
      p_email_comprador: (emailEmpresa.trim() || emailConvite) || null,
      p_whatsapp: whats.trim() || null,
      p_endereco: endereco.trim() || null,
      p_marcas: marcas,
    });
    setOcupado(false);
    if (error) { setErro(error.message); return; }
    setPasso('pronto');
  }

  const campo = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2214]/30 focus:border-[#8B2214]';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1.5';

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col">
      <CoficoHeader />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cadastro de cliente</h1>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            COFICO Brasil — cadastro por convite. Você precisa do código que recebeu.
          </p>

          {/* trilha dos passos */}
          <div className="flex items-center gap-2 mb-6">
            {(['codigo', 'acesso', 'empresa'] as Passo[]).map((p, i) => {
              const ordem = ['codigo', 'acesso', 'empresa', 'pronto'];
              const atual = ordem.indexOf(passo);
              const feito = ordem.indexOf(p) < atual;
              const aqui = p === passo;
              return (
                <div key={p} className="flex items-center gap-2 flex-1">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    feito ? 'bg-[#8B2214] text-white' : aqui ? 'bg-[#8B2214] text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {feito ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={`text-xs ${aqui ? 'font-semibold text-gray-900' : 'text-gray-400'} hidden sm:inline`}>
                    {p === 'codigo' ? 'Código' : p === 'acesso' ? 'Acesso' : 'Empresa'}
                  </span>
                  {i < 2 && <span className="flex-1 h-px bg-gray-200" />}
                </div>
              );
            })}
          </div>

          {erro && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{erro}</span>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">

            {passo === 'codigo' && (
              <>
                <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                  <KeyRound className="w-5 h-5 text-[#8B2214]" /> Seu código de convite
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Digite o código que a COFICO Brasil enviou para você. Ele vale uma única vez.
                </p>
                <input value={codigo} onChange={e => { setCodigo(e.target.value.toUpperCase()); setErro(''); }}
                  placeholder="Ex.: A1B2C3" maxLength={10} autoFocus
                  className={`${campo} text-center text-2xl font-mono font-bold tracking-[0.3em]`} />
                <button onClick={conferirCodigo} disabled={ocupado || !codigo.trim()}
                  className="mt-4 w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Continuar
                </button>
              </>
            )}

            {passo === 'acesso' && (
              <>
                <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                  <Lock className="w-5 h-5 text-[#8B2214]" /> Crie seu acesso
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Da próxima vez você entra com este e-mail e senha — <strong>sem precisar do código</strong>.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={rotulo}>E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={emailConvite} readOnly className={`${campo} pl-9 bg-gray-50 text-gray-600`} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">O convite está preso a este e-mail.</p>
                  </div>
                  <div>
                    <label className={rotulo}>Senha (mínimo 8 caracteres)</label>
                    <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className={campo} />
                  </div>
                  <div>
                    <label className={rotulo}>Repita a senha</label>
                    <input type="password" value={senha2} onChange={e => setSenha2(e.target.value)} className={campo} />
                  </div>
                </div>
                <button onClick={criarAcesso} disabled={ocupado || !senha || !senha2}
                  className="mt-4 w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Criar acesso
                </button>
              </>
            )}

            {passo === 'empresa' && (
              <>
                <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                  <Building2 className="w-5 h-5 text-[#8B2214]" /> Dados da empresa
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Digite o CNPJ que o restante vem da Receita Federal automaticamente.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={rotulo}>CNPJ *</label>
                    <div className="relative">
                      <input value={cnpj}
                        onChange={e => { const v = formatarCNPJ(e.target.value); setCnpj(v); if (soDigitos(v).length === 14) puxarCnpj(v); }}
                        placeholder="00.000.000/0000-00" inputMode="numeric" className={campo} />
                      {buscandoCnpj && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8B2214]" />}
                    </div>
                  </div>
                  <div>
                    <label className={rotulo}>Razão social *</label>
                    <input value={razao} onChange={e => setRazao(e.target.value)} className={campo} />
                  </div>
                  <div>
                    <label className={rotulo}>Nome fantasia</label>
                    <input value={fantasia} onChange={e => setFantasia(e.target.value)} className={campo} />
                  </div>
                  <div>
                    <label className={rotulo}>Endereço</label>
                    <input value={endereco} onChange={e => setEndereco(e.target.value)} className={campo} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={rotulo}>Nome do comprador</label>
                      <input value={comprador} onChange={e => setComprador(e.target.value)} className={campo} />
                    </div>
                    <div>
                      <label className={rotulo}>Telefone / WhatsApp</label>
                      <input value={whats} onChange={e => setWhats(e.target.value)} inputMode="tel" className={campo} />
                    </div>
                  </div>
                  <div>
                    <label className={rotulo}>E-mail para pedidos</label>
                    <input value={emailEmpresa} onChange={e => setEmailEmpresa(e.target.value)} type="email"
                      placeholder={emailConvite} className={campo} />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-1">
                      <Coffee className="w-4 h-4 text-[#8B2214]" /> Qual marca de café você está comprando?
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Pode marcar as duas, se comprar de ambas.</p>
                    <div className="space-y-2">
                      {MARCAS.map(m => (
                        <label key={m} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${
                          marcas.includes(m) ? 'border-[#8B2214] bg-[#f5f0ef]' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={marcas.includes(m)}
                            onChange={e => setMarcas(v => e.target.checked ? [...v, m] : v.filter(x => x !== m))}
                            className="w-4 h-4 accent-[#8B2214]" />
                          <span className="font-medium text-gray-800">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button onClick={enviarCadastro} disabled={ocupado}
                  className="mt-5 w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Enviar cadastro
                </button>
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  O cadastro passa por análise comercial. Condições de pagamento e limite de compra
                  são definidos pela COFICO Brasil depois da aprovação.
                </p>
              </>
            )}

            {passo === 'pronto' && (
              <div className="text-center py-4">
                <span className="w-14 h-14 rounded-full bg-[#f5f0ef] text-[#8B2214] inline-flex items-center justify-center mb-3">
                  <Check className="w-7 h-7" />
                </span>
                <h2 className="text-xl font-bold text-gray-900">Cadastro enviado</h2>
                <p className="text-sm text-gray-500 mt-2 mb-5">
                  Recebemos os dados de <strong>{razao}</strong>. Nossa equipe comercial vai analisar e
                  entrar em contato. Você já pode acessar seu perfil a qualquer momento com
                  <strong> {emailConvite}</strong> e a senha que criou.
                </p>
                <a href={linkPortalPJ('minha-empresa')}
                  className="inline-block bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg px-6 py-3 text-sm">
                  Ver meu cadastro
                </a>
              </div>
            )}
          </div>

          {passo === 'codigo' && (
            <p className="text-center text-sm text-gray-500 mt-5">
              Já tem cadastro? <a href={linkPortalPJ('minha-empresa')} className="text-[#8B2214] font-semibold hover:underline">Entrar no meu perfil</a>
            </p>
          )}
        </div>
      </main>

      <CoficoFooter />
    </div>
  );
}
