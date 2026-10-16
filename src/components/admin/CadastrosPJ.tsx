// Cadastros PJ recebidos pelo site da COFICO — aprovar ou reprovar.
//
// Vive dentro da aba RepCo do painel, junto dos Convites: quem gera o convite é
// quem depois decide o cadastro que nasceu dele. Separar as duas coisas em abas
// diferentes obrigaria a procurar.
//
// A decisão é tomada no BANCO, pela RPC `cliente_pj_decidir`, que confere
// `is_admin()` e grava o histórico. Esta tela só pergunta — se alguém chamar a
// RPC por fora sem ser admin, o banco recusa do mesmo jeito.
//
// Aprovar NÃO concede crédito, limite, prazo nem boleto. A tela diz isso em voz
// alta porque é a dúvida que aparece na hora de clicar.
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardCheck, Check, X, Loader2, Clock, Building2, RefreshCw } from 'lucide-react';

interface Cadastro {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  status_cadastro: string;
  cadastrado_em: string | null;
  nome_comprador: string | null;
  email_comprador: string | null;
  whatsapp_comprador: string | null;
  endereco_completo: string | null;
  codigo_convite: string | null;
  convidado_por: string | null;
  marcas: string | null;
  pedidos: number;
  inscricao_estadual: string | null;
  telefone_comercial: string | null;
  email_institucional: string | null;
  observacoes_cadastrais: string | null;
  entrega_mesmo_endereco: boolean | null;
  entrega_logradouro: string | null; entrega_numero: string | null;
  entrega_bairro: string | null; entrega_municipio: string | null;
  entrega_uf: string | null; entrega_cep: string | null; entrega_referencia: string | null;
  contatos: { tipo: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null }[] | null;
  completude: Record<string, boolean> | null;
  ultima_decisao: string | null;
  ultimo_motivo: string | null;
  decidido_em: string | null;
  decidido_por: string | null;
}

const SITUACAO: Record<string, { texto: string; cls: string }> = {
  rascunho:   { texto: 'Rascunho',   cls: 'bg-gray-100 text-gray-600' },
  em_analise: { texto: 'Em análise', cls: 'bg-amber-100 text-amber-700' },
  aprovado:   { texto: 'Aprovado',   cls: 'bg-green-100 text-green-700' },
  recusado:   { texto: 'Reprovado',  cls: 'bg-red-100 text-red-600' },
};

const ROTULO_CONTATO: Record<string, string> = {
  comprador: 'Comprador', comprador_substituto: 'Comprador substituto',
  financeiro: 'Financeiro', financeiro_alternativo: 'Financeiro alternativo',
  fiscal: 'Fiscal', contabilidade: 'Contabilidade',
  responsavel_legal: 'Responsável legal', proprietario: 'Proprietário',
  socio_administrador: 'Sócio-administrador', gerente_comercial: 'Gerente',
  gerente_loja: 'Gerente da loja', recebimento: 'Recebimento',
};

const ROTULO_FALTA: Record<string, string> = {
  empresa: 'dados da empresa', fiscal_ie: 'inscrição estadual', contato: 'telefone/e-mail',
  endereco: 'endereço', comprador: 'comprador', financeiro: 'financeiro',
  fiscal: 'fiscal', responsavel: 'responsável legal', marcas: 'marcas',
};

const formatarCNPJ = (v: string | null) => {
  const d = (v || '').replace(/\D/g, '');
  if (d.length !== 14) return v ?? '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};
const data = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function CadastrosPJ({ refreshKey }: { refreshKey?: number }) {
  const [lista, setLista] = useState<Cadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(true);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    setCarregando(true);
    const { data: d, error } = await supabase
      .from('vw_cadastros_pj')
      .select('*')
      .order('cadastrado_em', { ascending: false });
    if (error) setErro(error.message);
    setLista((d as Cadastro[]) ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, [refreshKey]);

  async function decidir(id: string, decisao: 'aprovado' | 'recusado', texto?: string) {
    setErro(''); setDecidindo(id);
    const { error } = await supabase.rpc('cliente_pj_decidir', {
      p_cliente: id, p_decisao: decisao, p_motivo: texto ?? null,
    });
    setDecidindo(null);
    if (error) { setErro(error.message); return; }
    setRecusando(null); setMotivo('');
    carregar();
  }

  const pendentes = lista.filter(c => c.status_cadastro === 'em_analise');
  const decididos = lista.filter(c => c.status_cadastro !== 'em_analise');

  const cartao = (c: Cadastro) => {
    const s = SITUACAO[c.status_cadastro] ?? SITUACAO.em_analise;
    const pendente = c.status_cadastro === 'em_analise';
    const faltando = Object.entries(c.completude ?? {})
      .filter(([, v]) => !v).map(([k]) => ROTULO_FALTA[k] ?? k);
    return (
      <div key={c.id} className="border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{c.nome_fantasia || c.razao_social}</p>
            {c.nome_fantasia && <p className="text-xs text-gray-500 truncate">{c.razao_social}</p>}
          </div>
          <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${s.cls}`}>{s.texto}</span>
        </div>

        <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 text-sm">
          <div><dt className="text-xs text-gray-500">CNPJ</dt><dd className="font-medium text-gray-900">{formatarCNPJ(c.cnpj)}</dd></div>
          <div><dt className="text-xs text-gray-500">Cadastro</dt><dd className="font-medium text-gray-900">{data(c.cadastrado_em)}</dd></div>
          {c.inscricao_estadual && <div><dt className="text-xs text-gray-500">Inscrição estadual</dt><dd className="font-medium text-gray-900">{c.inscricao_estadual}</dd></div>}
          {c.telefone_comercial && <div><dt className="text-xs text-gray-500">Telefone comercial</dt><dd className="font-medium text-gray-900">{c.telefone_comercial}</dd></div>}
          {c.email_institucional && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">E-mail da empresa</dt><dd className="font-medium text-gray-900 break-all">{c.email_institucional}</dd></div>}
          {c.nome_comprador && <div><dt className="text-xs text-gray-500">Contato</dt><dd className="font-medium text-gray-900">{c.nome_comprador}</dd></div>}
          {c.whatsapp_comprador && <div><dt className="text-xs text-gray-500">Telefone</dt><dd className="font-medium text-gray-900">{c.whatsapp_comprador}</dd></div>}
          {c.email_comprador && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">E-mail</dt><dd className="font-medium text-gray-900 break-all">{c.email_comprador}</dd></div>}
          {c.endereco_completo && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Endereço</dt><dd className="text-gray-700">{c.endereco_completo}</dd></div>}
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Marcas que o cliente declarou comprar</dt>
            <dd className="font-medium text-[#8B2214]">{c.marcas || '— nenhuma —'}</dd>
          </div>
          {c.codigo_convite && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-500">Convite</dt>
              <dd className="text-gray-700">
                <span className="font-mono font-semibold">{c.codigo_convite}</span>
                {c.convidado_por && <span className="text-xs text-gray-500"> · gerado por {c.convidado_por}</span>}
              </dd>
            </div>
          )}
        </dl>

        {/* Contatos por departamento — é o que a equipe comercial abre primeiro:
            para quem ligar, para quem mandar o boleto, para quem mandar o XML. */}
        {c.contatos && c.contatos.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Contatos</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.contatos.map((ct, i) => (
                <div key={i} className="border border-gray-100 rounded-lg px-2.5 py-2">
                  <p className="text-[10px] font-bold text-[#8B2214] uppercase tracking-wide">
                    {ROTULO_CONTATO[ct.tipo] ?? ct.tipo}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ct.nome}{ct.cargo ? <span className="text-gray-500 font-normal"> · {ct.cargo}</span> : null}
                  </p>
                  {ct.email && <p className="text-xs text-gray-600 break-all">{ct.email}</p>}
                  {(ct.telefone || ct.whatsapp) && (
                    <p className="text-xs text-gray-500">
                      {[ct.telefone, ct.whatsapp && `WhatsApp ${ct.whatsapp}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entrega, quando for diferente do endereço cadastral */}
        {c.entrega_mesmo_endereco === false && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500">Entregar em outro endereço</p>
            <p className="text-sm text-gray-800">
              {[c.entrega_logradouro, c.entrega_numero, c.entrega_bairro, c.entrega_municipio, c.entrega_uf, c.entrega_cep]
                .filter(Boolean).join(', ')}
            </p>
            {c.entrega_referencia && <p className="text-xs text-gray-500">{c.entrega_referencia}</p>}
          </div>
        )}

        {c.observacoes_cadastrais && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500">Observações do cliente</p>
            <p className="text-sm text-gray-700">{c.observacoes_cadastrais}</p>
          </div>
        )}

        {/* O que falta — para a equipe saber do que cobrar antes de aprovar */}
        {faltando.length > 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            Ainda sem preencher: {faltando.join(' · ')}
          </p>
        )}

        {/* histórico da decisão */}
        {c.ultima_decisao && (
          <p className="mt-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
            {c.ultima_decisao === 'aprovado' ? 'Aprovado' : 'Reprovado'} em {data(c.decidido_em)}
            {c.decidido_por ? ` por ${c.decidido_por}` : ''}
            {c.ultimo_motivo ? ` — ${c.ultimo_motivo}` : ''}
          </p>
        )}

        {pendente && (
          recusando === c.id ? (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              <label className="block text-xs font-semibold text-gray-600">Motivo da reprovação (o cliente vai ler)</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} autoFocus
                placeholder="Ex.: CNPJ com situação irregular na Receita."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => decidir(c.id, 'recusado', motivo)} disabled={!motivo.trim() || decidindo === c.id}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                  {decidindo === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Confirmar reprovação
                </button>
                <button onClick={() => { setRecusando(null); setMotivo(''); }}
                  className="text-sm text-gray-500 hover:text-gray-800 px-3">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 border-t border-gray-100 pt-3 flex flex-wrap gap-2">
              <button onClick={() => decidir(c.id, 'aprovado')} disabled={decidindo === c.id}
                className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {decidindo === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovar cadastro
              </button>
              <button onClick={() => { setRecusando(c.id); setMotivo(''); }} disabled={decidindo === c.id}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600 text-sm font-semibold px-4 py-2 rounded-lg">
                <X className="w-4 h-4" /> Reprovar
              </button>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-gray-900">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </span>
          Cadastros PJ da COFICO
          {pendentes.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full px-2 py-0.5">
              {pendentes.length} aguardando
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400">{aberto ? 'ocultar' : 'abrir'}</span>
      </button>

      {aberto && (
        <div className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">
              Empresas que se cadastraram pelo site com código de convite.
              <strong className="text-gray-700"> Aprovar o cadastro não concede crédito, limite, prazo nem boleto</strong> —
              isso continua sendo decidido por você, cliente a cliente.
            </p>
            <button onClick={carregar} title="Atualizar" className="text-gray-400 hover:text-gray-700 flex-shrink-0">
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#8B2214]" /></div>
          ) : lista.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum cadastro recebido pelo site ainda.</p>
            </div>
          ) : (
            <>
              {pendentes.length > 0 && (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Clock className="w-3.5 h-3.5" /> Aguardando decisão
                  </p>
                  {pendentes.map(cartao)}
                </div>
              )}
              {decididos.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500">Já decididos</p>
                  {decididos.map(cartao)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
