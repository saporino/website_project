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
import { Loader2, Building2, Coffee, Package, Mail, Lock, Clock, Check, AlertCircle, LogOut,
  Users, MapPin } from 'lucide-react';
import { Secao, Linha, Texto, ContatosDoDepartamento, salvarContatos, campo, rotulo } from './FichaSecoes';
import { type Contato, type Completude, quantoFalta, formatarCNPJ as fCNPJ,
  formatarTelefone, formatarCEP, PAPEIS } from './fichaPJ';

const MARCAS = ['Café Saporino', 'Tropeiro Paulista'];


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
  const [motivoDecisao, setMotivoDecisao] = useState<string | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [completude, setCompletude] = useState<Completude | null>(null);
  // Rascunho dos campos da empresa: o que o cliente digita antes de salvar.
  const [emp, setEmp] = useState<any>({});
  const [ent, setEnt] = useState<any>({});

  useEffect(() => {
    if (carregandoAuth) return;
    if (!user) { setCarregando(false); return; }
    (async () => {
      const { data: f } = await supabase
        .from('representative_clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setFicha(f);
      if (f) {
        const [{ data: m }, { data: p }, { data: dec }, { data: ct }, { data: comp }] = await Promise.all([
          supabase.from('cliente_marcas').select('marca').eq('cliente_id', f.id).eq('ativa', true),
          supabase.from('representative_orders')
            .select('id, order_number, created_at, status, total_amount')
            .eq('representative_client_id', f.id)
            .order('created_at', { ascending: false }).limit(10),
          // A policy deixa o cliente ler as decisões da PRÓPRIA ficha, e só.
          supabase.from('cliente_pj_decisoes').select('motivo, decisao')
            .eq('cliente_id', f.id).order('decidido_em', { ascending: false }).limit(1),
          supabase.from('cliente_contatos').select('*').eq('cliente_id', f.id).eq('ativo', true),
          supabase.rpc('ficha_pj_completude', { p_cliente: f.id }),
        ]);
        setMarcas((m ?? []).map((x: any) => x.marca));
        setPedidos(p ?? []);
        setMotivoDecisao(dec?.[0]?.motivo ?? null);
        setContatos((ct ?? []).map((x: any) => ({
          tipo: x.tipo, nome: x.nome, cargo: x.cargo, email: x.email,
          telefone: x.telefone, whatsapp: x.whatsapp,
        })));
        setCompletude((comp as Completude) ?? null);
        setEmp({
          razao_social: f.razao_social ?? '', nome_fantasia: f.nome_fantasia ?? '',
          inscricao_estadual: f.inscricao_estadual ?? '',
          telefone_comercial: f.telefone_comercial ?? '', email_institucional: f.email_institucional ?? '',
          endereco_completo: f.endereco_completo ?? '', cep: f.cep ?? '',
          municipio: f.municipio ?? '', uf: f.uf ?? '', bairro: f.bairro ?? '',
          observacoes_cadastrais: f.observacoes_cadastrais ?? '',
        });
        setEnt({
          entrega_mesmo_endereco: f.entrega_mesmo_endereco !== false,
          entrega_cep: f.entrega_cep ?? '', entrega_logradouro: f.entrega_logradouro ?? '',
          entrega_numero: f.entrega_numero ?? '', entrega_complemento: f.entrega_complemento ?? '',
          entrega_bairro: f.entrega_bairro ?? '', entrega_municipio: f.entrega_municipio ?? '',
          entrega_uf: f.entrega_uf ?? '', entrega_referencia: f.entrega_referencia ?? '',
        });
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

  /** Relê a completude depois de salvar, para o "o que falta" não mentir. */
  async function recarregarCompletude() {
    if (!ficha) return;
    const { data } = await supabase.rpc('ficha_pj_completude', { p_cliente: ficha.id });
    setCompletude((data as Completude) ?? null);
  }

  async function salvarEmpresa(): Promise<string | null> {
    if (!ficha) return 'Ficha não carregada.';
    if (!emp.razao_social?.trim()) return 'A razão social é obrigatória.';
    const { error } = await supabase.from('representative_clients').update({
      razao_social: emp.razao_social.trim(),
      nome_fantasia: emp.nome_fantasia?.trim() || null,
      inscricao_estadual: emp.inscricao_estadual?.trim() || null,
      telefone_comercial: emp.telefone_comercial?.trim() || null,
      email_institucional: emp.email_institucional?.trim().toLowerCase() || null,
      endereco_completo: emp.endereco_completo?.trim() || null,
      cep: emp.cep?.trim() || null,
      municipio: emp.municipio?.trim() || null,
      uf: emp.uf?.trim().toUpperCase() || null,
      bairro: emp.bairro?.trim() || null,
      observacoes_cadastrais: emp.observacoes_cadastrais?.trim() || null,
    }).eq('id', ficha.id);
    if (error) return traduzir(error.message);
    setFicha({ ...ficha, ...emp });
    await recarregarCompletude();
    return null;
  }

  async function salvarEntrega(): Promise<string | null> {
    if (!ficha) return 'Ficha não carregada.';
    const { error } = await supabase.from('representative_clients').update({
      entrega_mesmo_endereco: !!ent.entrega_mesmo_endereco,
      entrega_cep: ent.entrega_cep?.trim() || null,
      entrega_logradouro: ent.entrega_logradouro?.trim() || null,
      entrega_numero: ent.entrega_numero?.trim() || null,
      entrega_complemento: ent.entrega_complemento?.trim() || null,
      entrega_bairro: ent.entrega_bairro?.trim() || null,
      entrega_municipio: ent.entrega_municipio?.trim() || null,
      entrega_uf: ent.entrega_uf?.trim().toUpperCase() || null,
      entrega_referencia: ent.entrega_referencia?.trim() || null,
    }).eq('id', ficha.id);
    if (error) return traduzir(error.message);
    setFicha({ ...ficha, ...ent });
    return null;
  }

  async function salvarOsContatos(): Promise<string | null> {
    if (!ficha) return 'Ficha não carregada.';
    const e = await salvarContatos(ficha.id, contatos);
    if (!e) await recarregarCompletude();
    return e;
  }

  /** A mensagem do Postgres não serve para o cliente ler. */
  function traduzir(msg: string): string {
    if (/row-level security|violates/i.test(msg))
      return 'Este campo não pode ser alterado por aqui. Fale com a equipe comercial da COFICO Brasil.';
    return 'Não foi possível salvar agora. Tente de novo em instantes.';
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
        {/* <form> de verdade, com autocomplete declarado. Sem isto o Chrome via uma senha
            solta, achava uma credencial salva para o domínio e preenchia SÓ a senha — o
            e-mail ficava vazio, porque sem `autocomplete="username"` ele não consegue parear
            os dois campos. Resultado: a tela abria com a senha já preenchida e pedindo o
            e-mail, o que parece defeito (e pode submeter a senha de outra conta).
            O <form> também dá o Enter para enviar de graça, sem onKeyDown. */}
        <form className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
          onSubmit={(e) => { e.preventDefault(); entrar(); }}>
          {erroLogin && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{erroLogin}</span>
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Seu e-mail"
              name="email" autoComplete="username" aria-label="Seu e-mail"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={senha} onChange={e => setSenha(e.target.value)} type="password" placeholder="Sua senha"
              name="password" autoComplete="current-password" aria-label="Sua senha"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <button type="submit" disabled={entrando || !email || !senha}
            className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg py-3 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {entrando && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
          </button>

          {avisoSenha && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{avisoSenha}</p>
          )}
          <button type="button" onClick={recuperarSenha} disabled={recuperando}
            className="w-full text-xs text-gray-500 hover:text-[#8B2214] disabled:opacity-50">
            {recuperando ? 'Enviando…' : 'Esqueci minha senha'}
          </button>
        </form>
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
  const falta = quantoFalta(completude);

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

      {/* A situação precisa ser dita por extenso, não só pelo selo: o selo diz
          "Reprovado" e o cliente fica sem saber o que fazer. Quando houver
          motivo, ele aparece — a LGPD dá ao titular o direito de entender uma
          decisão que o afeta, e na prática é o que permite corrigir e voltar. */}
      {ficha.status_cadastro === 'em_analise' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Seu cadastro está em análise pela equipe comercial. Você será avisado quando for aprovado.
        </div>
      )}
      {ficha.status_cadastro === 'aprovado' && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          <strong>Cadastro aprovado.</strong> Sua empresa já está cadastrada na COFICO Brasil.
          Condições comerciais — forma de pagamento, prazo e limite de compra — são combinadas
          separadamente com a equipe.
        </div>
      )}
      {ficha.status_cadastro === 'recusado' && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
          <strong>Cadastro não aprovado.</strong>
          {motivoDecisao ? <> Motivo: {motivoDecisao}</> : null}
          <br />
          Se puder corrigir o que foi apontado, fale com a equipe comercial da COFICO Brasil.
        </div>
      )}

      {/* O que ainda falta — para o cliente saber onde parar e voltar. */}
      {falta.faltando.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-bold text-gray-900">Complete seu cadastro</p>
            <span className="text-sm font-semibold text-[#8B2214]">{falta.feitos} de {falta.total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-[#8B2214] rounded-full transition-all"
              style={{ width: `${Math.round((falta.feitos / falta.total) * 100)}%` }} />
          </div>
          <p className="text-sm text-gray-500">
            Falta preencher: <strong className="text-gray-700">{falta.faltando.join(' · ')}</strong>
          </p>
          <p className="text-[11px] text-gray-400 mt-2">
            Pode preencher aos poucos. O que você salvar fica guardado.
          </p>
        </div>
      )}

      {/* Dados da empresa */}
      <Secao titulo="Dados da empresa" icone={<Building2 className="w-5 h-5" />}
        resumo={ficha.razao_social} completa={!!completude?.empresa && !!completude?.endereco}
        onSalvar={salvarEmpresa}>
        {(editando) => editando ? (
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">CNPJ</p>
              <p className="text-sm font-semibold text-gray-900">{fCNPJ(ficha.cnpj)}</p>
              {ficha.status_cadastro === 'aprovado' && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Cadastro aprovado: CNPJ e razão social passam pela equipe comercial.
                </p>
              )}
            </div>
            <Texto label="Razão social *" valor={emp.razao_social}
              onChange={v => setEmp({ ...emp, razao_social: v })} />
            <Texto label="Nome fantasia" valor={emp.nome_fantasia}
              onChange={v => setEmp({ ...emp, nome_fantasia: v })} />
            <Texto label="Inscrição estadual" valor={emp.inscricao_estadual}
              onChange={v => setEmp({ ...emp, inscricao_estadual: v })}
              dica="Se a empresa for isenta, escreva ISENTO." />
            <div className="grid gap-3 sm:grid-cols-2">
              <Texto label="Telefone comercial" valor={emp.telefone_comercial}
                onChange={v => setEmp({ ...emp, telefone_comercial: formatarTelefone(v) })} />
              <Texto label="E-mail da empresa" valor={emp.email_institucional} tipo="email"
                onChange={v => setEmp({ ...emp, email_institucional: v })} />
            </div>
            <Texto label="Endereço completo" valor={emp.endereco_completo}
              onChange={v => setEmp({ ...emp, endereco_completo: v })}
              placeholder="Rua, número, complemento" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Texto label="CEP" valor={emp.cep} onChange={v => setEmp({ ...emp, cep: formatarCEP(v) })} />
              <Texto label="Bairro" valor={emp.bairro} onChange={v => setEmp({ ...emp, bairro: v })} />
              <Texto label="Cidade" valor={emp.municipio} onChange={v => setEmp({ ...emp, municipio: v })} />
            </div>
            <Texto label="UF" valor={emp.uf} onChange={v => setEmp({ ...emp, uf: v.slice(0, 2) })} />
            <div>
              <label className={rotulo}>Observações</label>
              <textarea value={emp.observacoes_cadastrais} rows={2}
                onChange={e => setEmp({ ...emp, observacoes_cadastrais: e.target.value })}
                placeholder="Algo que a COFICO precise saber sobre seu cadastro."
                className={campo} />
            </div>
          </div>
        ) : (
          <dl>
            <Linha rotulo="Razão social" valor={ficha.razao_social} />
            <Linha rotulo="Nome fantasia" valor={ficha.nome_fantasia} />
            <Linha rotulo="CNPJ" valor={fCNPJ(ficha.cnpj)} />
            <Linha rotulo="Inscrição estadual" valor={ficha.inscricao_estadual} />
            <Linha rotulo="Telefone" valor={ficha.telefone_comercial} />
            <Linha rotulo="E-mail da empresa" valor={ficha.email_institucional} />
            <Linha rotulo="Endereço" valor={ficha.endereco_completo} />
            <Linha rotulo="Observações" valor={ficha.observacoes_cadastrais} />
          </dl>
        )}
      </Secao>

      {/* Contatos por departamento */}
      <Secao titulo="Contatos da empresa" icone={<Users className="w-5 h-5" />}
        resumo={contatos.length ? `${contatos.length} contato(s)` : null}
        completa={!!completude?.comprador && !!completude?.financeiro && !!completude?.fiscal}
        onSalvar={salvarOsContatos}>
        {(editando) => editando ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Quem compra, quem paga o boleto e quem recebe a nota fiscal.
            </p>
            <ContatosDoDepartamento contatos={contatos} onChange={setContatos} />
          </>
        ) : contatos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum contato cadastrado ainda. A COFICO precisa saber quem faz o pedido,
            quem recebe o boleto e quem recebe a nota fiscal.
          </p>
        ) : (
          <div className="space-y-2">
            {contatos.map((c, i) => {
              const papel = PAPEIS.find(p => p.tipo === c.tipo);
              return (
                <div key={i} className="border border-gray-100 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-semibold text-[#8B2214] uppercase tracking-wide">
                    {papel?.titulo ?? c.tipo}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {c.nome}{c.cargo ? <span className="text-gray-500 font-normal"> · {c.cargo}</span> : null}
                  </p>
                  <p className="text-xs text-gray-500 break-words">
                    {[c.email, c.telefone, c.whatsapp && `WhatsApp ${c.whatsapp}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      {/* Endereço de entrega */}
      <Secao titulo="Endereço de entrega" icone={<MapPin className="w-5 h-5" />}
        resumo={ent.entrega_mesmo_endereco ? 'Mesmo endereço do cadastro' : ent.entrega_logradouro}
        onSalvar={salvarEntrega}>
        {(editando) => editando ? (
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={!!ent.entrega_mesmo_endereco} className="w-4 h-4 accent-[#8B2214]"
                onChange={e => setEnt({ ...ent, entrega_mesmo_endereco: e.target.checked })} />
              <span className="font-medium text-gray-800">Entregar no mesmo endereço do cadastro</span>
            </label>
            {!ent.entrega_mesmo_endereco && (
              <div className="space-y-3 border-l-2 border-[#f5f0ef] pl-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Texto label="CEP" valor={ent.entrega_cep}
                    onChange={v => setEnt({ ...ent, entrega_cep: formatarCEP(v) })} />
                  <Texto label="Rua" valor={ent.entrega_logradouro}
                    onChange={v => setEnt({ ...ent, entrega_logradouro: v })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Texto label="Número" valor={ent.entrega_numero}
                    onChange={v => setEnt({ ...ent, entrega_numero: v })} />
                  <Texto label="Complemento" valor={ent.entrega_complemento}
                    onChange={v => setEnt({ ...ent, entrega_complemento: v })} />
                  <Texto label="Bairro" valor={ent.entrega_bairro}
                    onChange={v => setEnt({ ...ent, entrega_bairro: v })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Texto label="Cidade" valor={ent.entrega_municipio}
                    onChange={v => setEnt({ ...ent, entrega_municipio: v })} />
                  <Texto label="UF" valor={ent.entrega_uf}
                    onChange={v => setEnt({ ...ent, entrega_uf: v.slice(0, 2) })} />
                </div>
                <Texto label="Ponto de referência ou horário de entrega" valor={ent.entrega_referencia}
                  onChange={v => setEnt({ ...ent, entrega_referencia: v })}
                  placeholder="Ex.: recebemos das 8h às 11h, portão dos fundos." />
              </div>
            )}
          </div>
        ) : ent.entrega_mesmo_endereco ? (
          <p className="text-sm text-gray-700">
            Mesmo endereço do cadastro: {ficha.endereco_completo || '— ainda não preenchido —'}
          </p>
        ) : (
          <dl>
            <Linha rotulo="Endereço" valor={[ent.entrega_logradouro, ent.entrega_numero, ent.entrega_complemento].filter(Boolean).join(', ')} />
            <Linha rotulo="Bairro" valor={ent.entrega_bairro} />
            <Linha rotulo="Cidade" valor={[ent.entrega_municipio, ent.entrega_uf].filter(Boolean).join(' — ')} />
            <Linha rotulo="CEP" valor={ent.entrega_cep} />
            <Linha rotulo="Referência" valor={ent.entrega_referencia} />
          </dl>
        )}
      </Secao>

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
