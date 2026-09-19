// Ficha de uma empresa do B2B Prospecção: cadastro editável, contatos por função,
// vínculos com os nossos negócios (quem decide se ela é "ativa") e a origem de cada dado.
import { useEffect, useState } from 'react';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import { TIPOS, formatarCnpj, normalizarTelefone, type Tipo } from '../../../lib/b2b/normalizar';

type Empresa = Record<string, any> & { id: string; tipo: Tipo; marcas: string[]; fontes: string[]; proveniencia: Record<string, { fonte: string; em: string }> };
interface Contato { id: string; funcao: string; nome: string | null; cargo: string | null; email: string | null; telefone: string | null; whatsapp: string | null }
interface Vinculo { id: string; destino: string; company_id: string | null; etapa: string; proxima_acao: string | null; proxima_acao_em: string | null; responsavel: string | null }
interface Company { id: string; name: string; fantasia: string | null }

const FUNCOES: [string, string][] = [
  ['comprador', 'Comprador'], ['comercial', 'Comercial'], ['gerente_comercial', 'Gerente comercial'], ['vendedor', 'Vendedor'],
  ['administrativo', 'Administrativo'], ['financeiro', 'Financeiro'], ['contabilidade', 'Contabilidade'], ['proprietario', 'Proprietário'], ['outro', 'Outro'],
];
const DESTINOS: [string, string][] = [
  ['cliente_empresa', 'Cliente de uma empresa do grupo'], ['coffeelivre_comprador', 'Coffee LiVRE — comprador'],
  ['coffeelivre_vendedor', 'Coffee LiVRE — vendedor'], ['casa_cofico_marketplace', 'Marketplaces da CASA COFICO'], ['fornecedor', 'Fornecedor'],
];
const ETAPAS: [string, string][] = [
  ['prospeccao', 'Prospecção'], ['contato', 'Contato'], ['negociacao', 'Negociação'], ['ativo', 'Ativo'], ['inativo', 'Inativo'], ['perdido', 'Perdido'],
];

const GRUPOS: { titulo: string; campos: [string, string, string?][] }[] = [
  { titulo: 'Cadastro', campos: [['razao_social', 'Razão social'], ['nome_fantasia', 'Nome fantasia'], ['inscricao_estadual', 'Inscrição estadual'],
    ['cnae_principal', 'CNAE'], ['cnae_descricao', 'Atividade (CNAE)'], ['situacao_cadastral', 'Situação na Receita'], ['porte', 'Porte'], ['data_abertura', 'Abertura', 'date']] },
  { titulo: 'Endereço', campos: [['logradouro', 'Endereço'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'],
    ['municipio', 'Município'], ['uf', 'UF'], ['cep', 'CEP']] },
  { titulo: 'Canais', campos: [['telefone', 'Telefone'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['site', 'Site'], ['instagram', 'Instagram'], ['facebook', 'Facebook']] },
];

const inp = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-sm';
const lbl = 'block text-[11px] font-semibold text-gray-500 mb-0.5';

export default function FichaB2B({ id, aoFechar, aoSalvar }: { id: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [e, setE] = useState<Empresa | null>(null);
  const [original, setOriginal] = useState<Empresa | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [novoContato, setNovoContato] = useState({ funcao: 'comprador', nome: '', cargo: '', email: '', telefone: '' });
  const [novoVinculo, setNovoVinculo] = useState({ destino: 'cliente_empresa', company_id: '', etapa: 'prospeccao' });

  async function carregar() {
    const [a, c, v, co] = await Promise.all([
      supabase.from('b2b_empresas').select('*').eq('id', id).single(),
      supabase.from('b2b_contatos').select('*').eq('empresa_id', id).order('created_at'),
      supabase.from('b2b_vinculos').select('*').eq('empresa_id', id).order('created_at'),
      supabase.from('companies').select('id,name,fantasia').eq('is_active', true).order('sort_order'),
    ]);
    setE(a.data as Empresa); setOriginal(a.data as Empresa);
    setContatos((c.data as Contato[]) ?? []); setVinculos((v.data as Vinculo[]) ?? []); setCompanies((co.data as Company[]) ?? []);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const set = (k: string, v: unknown) => setE(x => (x ? { ...x, [k]: v } : x));

  async function salvar() {
    if (!e || !original) return;
    setSalvando(true);
    const editaveis = [...GRUPOS.flatMap(g => g.campos.map(c => c[0])), 'tipo', 'notas', 'trabalhado', 'abic_certificada'];
    const mudou: Record<string, unknown> = {};
    for (const k of editaveis) {
      let v = e[k];
      if (typeof v === 'string') v = v.trim() || null;
      if ((k === 'telefone' || k === 'whatsapp') && v) v = normalizarTelefone(v) ?? v;
      if (k === 'uf' && v) v = String(v).toUpperCase().slice(0, 2);
      if (v !== original[k]) mudou[k] = v;
    }
    const marcas = (Array.isArray(e.marcas) ? e.marcas : String(e.marcas ?? '').split(',')).map((m: string) => m.trim()).filter(Boolean);
    if (JSON.stringify(marcas) !== JSON.stringify(original.marcas)) mudou.marcas = marcas;
    if (!Object.keys(mudou).length) { setSalvando(false); toast.info('Nada mudou.'); return; }
    const hoje = new Date().toISOString().slice(0, 10);
    const prov = { ...original.proveniencia };
    for (const k of Object.keys(mudou)) if (!['trabalhado', 'notas'].includes(k)) prov[k] = { fonte: 'edição manual', em: hoje };
    const { error } = await supabase.from('b2b_empresas').update({ ...mudou, proveniencia: prov }).eq('id', e.id);
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return; }
    toast.success('Ficha salva.');
    await carregar(); aoSalvar();
  }

  async function adicionarContato() {
    if (!novoContato.nome.trim() && !novoContato.email.trim() && !novoContato.telefone.trim()) { toast.error('Informe nome, e-mail ou telefone.'); return; }
    const tel = normalizarTelefone(novoContato.telefone);
    const { error } = await supabase.from('b2b_contatos').insert({
      empresa_id: id, funcao: novoContato.funcao, nome: novoContato.nome.trim() || null, cargo: novoContato.cargo.trim() || null,
      email: novoContato.email.trim().toLowerCase() || null, telefone: tel ?? (novoContato.telefone.trim() || null),
      whatsapp: tel && tel.length === 11 && tel[2] === '9' ? tel : null,
    });
    if (error) { toast.error(error.message); return; }
    setNovoContato({ funcao: 'comprador', nome: '', cargo: '', email: '', telefone: '' });
    carregar();
  }
  async function removerContato(c: Contato) {
    if (!window.confirm(`Remover o contato ${c.nome ?? c.email ?? ''}?`)) return;
    await supabase.from('b2b_contatos').delete().eq('id', c.id);
    carregar();
  }

  async function adicionarVinculo() {
    if (novoVinculo.destino === 'cliente_empresa' && !novoVinculo.company_id) { toast.error('Escolha a empresa do grupo.'); return; }
    const { error } = await supabase.from('b2b_vinculos').insert({
      empresa_id: id, destino: novoVinculo.destino, etapa: novoVinculo.etapa,
      company_id: novoVinculo.destino === 'cliente_empresa' ? novoVinculo.company_id : null,
    });
    if (error) { toast.error(error.message.includes('duplicate') ? 'Esse vínculo já existe.' : error.message); return; }
    setNovoVinculo({ destino: 'cliente_empresa', company_id: '', etapa: 'prospeccao' });
    await carregar(); aoSalvar();
  }
  async function atualizarVinculo(v: Vinculo, patch: Partial<Vinculo>) {
    const { error } = await supabase.from('b2b_vinculos').update(patch).eq('id', v.id);
    if (error) { toast.error(error.message); return; }
    await carregar(); aoSalvar();
  }
  async function removerVinculo(v: Vinculo) {
    if (!window.confirm('Remover este vínculo? A empresa continua no B2B.')) return;
    await supabase.from('b2b_vinculos').delete().eq('id', v.id);
    await carregar(); aoSalvar();
  }

  const nomeEmpresa = (cid: string | null) => { const c = companies.find(x => x.id === cid); return c ? (c.fantasia || c.name) : ''; };
  const origem = (k: string) => e?.proveniencia?.[k] ? `${e.proveniencia[k].fonte} · ${e.proveniencia[k].em}` : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={aoFechar}>
      <div className="w-full max-w-3xl h-full bg-[#f8f7f5] overflow-y-auto shadow-xl" onClick={ev => ev.stopPropagation()} role="dialog" aria-label="Ficha da empresa">
        {!e ? (
          <div className="flex items-center gap-2 text-gray-500 p-8"><Loader2 className="w-4 h-4 animate-spin" /> Carregando ficha…</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-gray-900">{e.nome_fantasia || e.razao_social || 'Sem nome'}</h3>
                <p className="text-sm text-gray-500">
                  {[e.cnpj ? formatarCnpj(e.cnpj) : 'sem CNPJ', e.municipio && `${e.municipio}${e.uf ? ', ' + e.uf : ''}`,
                    e.ativo ? 'Ativa' : 'Não ativa', e.pessoa_fisica ? 'MEI / pessoa física' : null].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Fontes: {e.fontes.join(', ') || '—'}</p>
              </div>
              <button onClick={aoFechar} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-gray-200"><X className="w-5 h-5" /></button>
            </div>

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Tipo</label>
                  <select value={e.tipo} onChange={ev => set('tipo', ev.target.value)} className={inp}>
                    {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm mt-4">
                  <input type="checkbox" checked={!!e.trabalhado} onChange={ev => set('trabalhado', ev.target.checked)} /> Já trabalhada
                </label>
                <label className="flex items-center gap-2 text-sm mt-4">
                  <input type="checkbox" checked={!!e.abic_certificada} onChange={ev => set('abic_certificada', ev.target.checked)} /> Certificada ABIC
                </label>
              </div>
            </section>

            {GRUPOS.map(g => (
              <section key={g.titulo} className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">{g.titulo}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.campos.map(([k, l, tipoInput]) => (
                    <div key={k}>
                      <label className={lbl} title={origem(k)}>{l}{origem(k) && <span className="font-normal text-gray-400"> · {e.proveniencia[k].fonte}</span>}</label>
                      <input type={tipoInput ?? 'text'} value={e[k] ?? ''} onChange={ev => set(k, ev.target.value)} className={inp} />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-800 mb-3">Café e observações</h4>
              <label className={lbl}>Marcas (separadas por vírgula)</label>
              <input value={Array.isArray(e.marcas) ? e.marcas.join(', ') : e.marcas ?? ''} onChange={ev => set('marcas', ev.target.value)} className={inp + ' mb-3'} />
              <label className={lbl}>Notas</label>
              <textarea value={e.notas ?? ''} onChange={ev => set('notas', ev.target.value)} rows={4} className={inp} />
            </section>

            <div className="flex justify-end">
              <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold hover:bg-saporino-deep disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar ficha'}
              </button>
            </div>

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-800 mb-1">Vínculos com o grupo</h4>
              <p className="text-xs text-gray-500 mb-3">Com algum vínculo na etapa <b>Ativo</b>, a empresa passa para "Ativos". Ela nunca sai do B2B.</p>
              {vinculos.length === 0 && <p className="text-sm text-gray-400 mb-3">Nenhum vínculo ainda.</p>}
              <div className="space-y-2 mb-3">
                {vinculos.map(v => (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 border border-gray-100 rounded-lg p-2">
                    <span className="text-sm font-semibold text-gray-800 flex-1 min-w-[180px]">
                      {DESTINOS.find(d => d[0] === v.destino)?.[1]}{v.company_id ? ` · ${nomeEmpresa(v.company_id)}` : ''}
                    </span>
                    <select value={v.etapa} onChange={ev => atualizarVinculo(v, { etapa: ev.target.value })} className="px-2 py-1 rounded border border-gray-300 text-xs">
                      {ETAPAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <input placeholder="Próxima ação" defaultValue={v.proxima_acao ?? ''} onBlur={ev => ev.target.value !== (v.proxima_acao ?? '') && atualizarVinculo(v, { proxima_acao: ev.target.value || null })}
                      className="px-2 py-1 rounded border border-gray-300 text-xs w-44" />
                    <input type="date" defaultValue={v.proxima_acao_em ?? ''} onBlur={ev => ev.target.value !== (v.proxima_acao_em ?? '') && atualizarVinculo(v, { proxima_acao_em: ev.target.value || null })}
                      className="px-2 py-1 rounded border border-gray-300 text-xs" />
                    <button onClick={() => removerVinculo(v)} aria-label="Remover vínculo" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={novoVinculo.destino} onChange={ev => setNovoVinculo(n => ({ ...n, destino: ev.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 text-sm">
                  {DESTINOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {novoVinculo.destino === 'cliente_empresa' && (
                  <select value={novoVinculo.company_id} onChange={ev => setNovoVinculo(n => ({ ...n, company_id: ev.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 text-sm">
                    <option value="">Empresa do grupo…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.fantasia || c.name}</option>)}
                  </select>
                )}
                <select value={novoVinculo.etapa} onChange={ev => setNovoVinculo(n => ({ ...n, etapa: ev.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 text-sm">
                  {ETAPAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button onClick={adicionarVinculo} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-saporino/40 text-saporino text-sm font-semibold hover:bg-[#f5f0ef]">
                  <Plus className="w-4 h-4" /> Adicionar vínculo
                </button>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-800 mb-3">Contatos</h4>
              {contatos.length === 0 && <p className="text-sm text-gray-400 mb-3">Nenhum contato ainda.</p>}
              <div className="space-y-1.5 mb-3">
                {contatos.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-lg p-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f0ef] text-saporino font-semibold">{FUNCOES.find(f => f[0] === c.funcao)?.[1]}</span>
                    <span className="font-semibold text-gray-800">{c.nome ?? '—'}</span>
                    {c.cargo && <span className="text-gray-500">{c.cargo}</span>}
                    {c.email && <a href={`mailto:${c.email}`} className="text-saporino underline">{c.email}</a>}
                    {c.telefone && <span className="text-gray-600 tabular-nums">{c.telefone}</span>}
                    {c.whatsapp && <a href={`https://wa.me/55${c.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-700 font-semibold">WhatsApp</a>}
                    <button onClick={() => removerContato(c)} aria-label="Remover contato" className="ml-auto p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <select value={novoContato.funcao} onChange={ev => setNovoContato(n => ({ ...n, funcao: ev.target.value }))} className={inp}>
                  {FUNCOES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input placeholder="Nome" value={novoContato.nome} onChange={ev => setNovoContato(n => ({ ...n, nome: ev.target.value }))} className={inp} />
                <input placeholder="Cargo" value={novoContato.cargo} onChange={ev => setNovoContato(n => ({ ...n, cargo: ev.target.value }))} className={inp} />
                <input placeholder="E-mail" value={novoContato.email} onChange={ev => setNovoContato(n => ({ ...n, email: ev.target.value }))} className={inp} />
                <input placeholder="Telefone" value={novoContato.telefone} onChange={ev => setNovoContato(n => ({ ...n, telefone: ev.target.value }))} className={inp} />
                <button onClick={adicionarContato} className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-saporino/40 text-saporino text-sm font-semibold hover:bg-[#f5f0ef]">
                  <Plus className="w-4 h-4" /> Contato
                </button>
              </div>
            </section>

            <p className="text-xs text-gray-400 pb-6">Documentos, logos e fotos do café entram na próxima etapa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
