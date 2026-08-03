// Admin — Leads B2B (formulário Para Seu Negócio). Pipeline de status + converter em cliente do RepCo.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ChevronDown, ChevronUp, UserPlus, Mail, Phone, Globe, MapPin } from 'lucide-react';

const STATUS: [string, string][] = [
  ['novo', 'Novo'], ['em_contato', 'Em contato'], ['em_negociacao', 'Em negociação'], ['ativo', 'Ativo'], ['perdido', 'Perdido'],
];
const STATUS_COLOR: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700', em_contato: 'bg-amber-100 text-amber-700',
  em_negociacao: 'bg-purple-100 text-purple-700', ativo: 'bg-green-100 text-green-700', perdido: 'bg-gray-100 text-gray-500',
};

interface Lead {
  id: string; nome: string | null; empresa: string | null; telefone: string | null; email: string | null;
  site: string | null; redes_sociais: string | null; cidade: string | null; uf: string | null; descricao: string | null;
  tipos_cafe: string[] | null; formato: string | null; torras: string[] | null; grao_tipo: string | null;
  volume_valor: number | null; volume_unidade: string | null; embalagens: string[] | null;
  modalidade: string | null; num_pessoas: number | null;
  status: string; converted_client_id: string | null; created_at: string;
}
interface Company { id: string; fantasia: string | null; name: string }
interface Rep { id: string; full_name: string; company_id: string }

export default function B2BLeadsManagement() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [cv, setCv] = useState({ company: '', rep: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: co }, { data: rp }] = await Promise.all([
      supabase.from('b2b_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,fantasia,name').eq('is_active', true).eq('is_operator', false).order('sort_order'),
      supabase.from('representatives').select('id,full_name,company_id').eq('status', 'active').order('full_name'),
    ]);
    setLeads((l as Lead[]) || []); setCompanies((co as Company[]) || []); setReps((rp as Rep[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    leads.forEach(l => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leads]);
  const visible = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  async function setStatus(id: string, status: string) {
    await supabase.from('b2b_leads').update({ status }).eq('id', id);
    load();
  }

  async function convert(lead: Lead) {
    if (!cv.company || !cv.rep) { setMsg({ t: 'err', m: 'Escolha empresa e representante.' }); return; }
    setBusy(true); setMsg(null);
    const { data: client, error } = await supabase.from('representative_clients').insert({
      representative_id: cv.rep, company_id: cv.company,
      razao_social: lead.empresa || lead.nome || 'Cliente B2B',
      nome_fantasia: lead.empresa || null,
      status: 'active',
    }).select('id').single();
    if (error || !client) { setBusy(false); setMsg({ t: 'err', m: 'Erro ao criar cliente: ' + (error?.message || '') }); return; }
    await supabase.from('b2b_leads').update({ status: 'ativo', converted_client_id: client.id }).eq('id', lead.id);
    setBusy(false); setConvertId(null); setCv({ company: '', rep: '' });
    setMsg({ t: 'ok', m: 'Cliente criado e lead marcado como Ativo. Ajuste os dados do cliente no RepCo.' });
    load();
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Leads B2B</h2>
        <p className="text-sm text-gray-500">Contatos do formulário "Para Seu Negócio". Acompanhe o funil e converta em cliente.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === 'all' ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200'}`}>Todos ({leads.length})</button>
        {STATUS.map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200'}`}>{lbl} ({counts[k] || 0})</button>
        ))}
      </div>

      {msg && <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${msg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.m}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">Nenhum lead nesse filtro.</div>
      ) : (
        <div className="space-y-3">
          {visible.map(l => (
            <div key={l.id} className="bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between gap-3 p-4">
                <button onClick={() => setExpandedId(id => id === l.id ? null : l.id)} className="flex items-center gap-2 min-w-0 text-left">
                  {expandedId === l.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{l.empresa || l.nome || '—'}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLOR[l.status] || ''}`}>{STATUS.find(s => s[0] === l.status)?.[1] || l.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {[l.nome, l.cidade && `${l.cidade}${l.uf ? '/' + l.uf : ''}`, l.volume_valor && `${l.volume_valor} ${l.volume_unidade}/mês`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
                <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="text-xs px-2 py-1.5 rounded border border-gray-300 bg-white shrink-0">
                  {STATUS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                </select>
              </div>

              {expandedId === l.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                    {l.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {l.email}</span>}
                    {l.telefone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {l.telefone}</span>}
                    {l.site && <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-gray-400" /> {l.site}</span>}
                    {(l.cidade || l.uf) && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {[l.cidade, l.uf].filter(Boolean).join('/')}</span>}
                    {l.redes_sociais && <span className="col-span-2">Redes: {l.redes_sociais}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {(l.tipos_cafe || []).map(t => <span key={t} className="px-2 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] font-medium">{t}</span>)}
                    {l.formato && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{l.formato === 'grao' ? `Grão${l.grao_tipo ? ' · ' + l.grao_tipo : ''}` : 'Moído'}</span>}
                    {(l.torras || []).map(t => <span key={t} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{t}</span>)}
                    {(l.embalagens || []).map(t => <span key={t} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{t}</span>)}
                    {l.modalidade && <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">{l.modalidade}</span>}
                    {l.num_pessoas ? <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{l.num_pessoas} pessoas</span> : null}
                  </div>
                  {l.descricao && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{l.descricao}</p>}

                  {l.converted_client_id ? (
                    <p className="text-xs text-green-700">✓ Convertido em cliente do RepCo.</p>
                  ) : convertId === l.id ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Empresa</label>
                        <select value={cv.company} onChange={e => setCv({ ...cv, company: e.target.value, rep: '' })} className="h-9 px-2 text-sm border border-gray-300 rounded bg-white">
                          <option value="">—</option>
                          {companies.map(c => <option key={c.id} value={c.id}>{c.fantasia || c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Representante</label>
                        <select value={cv.rep} onChange={e => setCv({ ...cv, rep: e.target.value })} className="h-9 px-2 text-sm border border-gray-300 rounded bg-white">
                          <option value="">—</option>
                          {reps.filter(r => r.company_id === cv.company).map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                        </select>
                      </div>
                      <button onClick={() => convert(l)} disabled={busy} className="h-9 px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-60">{busy ? 'Criando…' : 'Confirmar'}</button>
                      <button onClick={() => { setConvertId(null); setMsg(null); }} className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-600">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => { setConvertId(l.id); setMsg(null); }} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10]">
                      <UserPlus className="w-4 h-4" /> Tornar cliente
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
