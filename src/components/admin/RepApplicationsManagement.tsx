// Admin — Candidaturas de Representante (formulário "Seja um Representante" da /trabalhe-conosco).
// Funil de status + Ver detalhes + Gerar convite (usa o convite unificado, papel Representante) + Rejeitar.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, ChevronDown, ChevronUp, Phone, MapPin, KeyRound, Copy, XCircle } from 'lucide-react';

const STATUS: [string, string][] = [
  ['pendente', 'Pendente'], ['em_analise', 'Em análise'], ['aprovado', 'Aprovado'], ['rejeitado', 'Rejeitado'],
];
const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-blue-100 text-blue-700', em_analise: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-green-100 text-green-700', rejeitado: 'bg-gray-100 text-gray-500',
};

interface Cand {
  id: string; nome_completo: string; whatsapp: string | null; cidade_regiao: string | null;
  experiencia: string | null; carteira_ativa: boolean | null; clientes_aprox: string | null;
  canais: string[] | null; situacao_cadastral: string | null; marcas_atuais: string | null;
  ciente_condicoes: boolean; status: string; obs_admin: string | null; created_at: string;
}

export default function RepApplicationsManagement() {
  const [rows, setRows] = useState<Cand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ id: string; code: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('candidaturas_representante').select('*').order('created_at', { ascending: false });
    setRows((data as Cand[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  async function setStatus(id: string, status: string) {
    await supabase.from('candidaturas_representante').update({ status }).eq('id', id);
    load();
  }

  async function gerarConvite(c: Cand) {
    setBusy(c.id); setMsg(null); setInvite(null);
    // Convite unificado, papel Representante (repco_generate_invite grava role_code 'representante').
    const { data, error } = await supabase.rpc('repco_generate_invite', { p_note: c.nome_completo });
    if (error) { setBusy(null); setMsg({ t: 'err', m: 'Erro ao gerar convite: ' + error.message }); return; }
    const code = Array.isArray(data) ? (data[0] as any)?.code : (data as any)?.code;
    await supabase.from('candidaturas_representante').update({ status: 'aprovado' }).eq('id', c.id);
    setBusy(null);
    if (code) { setInvite({ id: c.id, code }); setExpandedId(c.id); }
    load();
  }

  async function rejeitar(c: Cand) {
    const obs = prompt('Motivo/observação (opcional):');
    if (obs === null) return; // cancelou o prompt
    setBusy(c.id);
    await supabase.from('candidaturas_representante').update({ status: 'rejeitado', obs_admin: obs || null }).eq('id', c.id);
    setBusy(null);
    load();
  }

  const yesno = (b: boolean | null) => b === null ? '—' : b ? 'Sim' : 'Não';

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">Candidaturas de Representante</h2>
        <p className="text-sm text-gray-500">Formulário "Seja um Representante" da página Trabalhe Conosco. Analise, gere o convite ou rejeite.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === 'all' ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200'}`}>Todas ({rows.length})</button>
        {STATUS.map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${filter === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200'}`}>{lbl} ({counts[k] || 0})</button>
        ))}
      </div>

      {msg && <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${msg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.m}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">Nenhuma candidatura nesse filtro.</div>
      ) : (
        <div className="space-y-3">
          {visible.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between gap-3 p-4">
                <button onClick={() => setExpandedId(id => id === c.id ? null : c.id)} className="flex items-center gap-2 min-w-0 text-left">
                  {expandedId === c.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{c.nome_completo}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLOR[c.status] || ''}`}>{STATUS.find(s => s[0] === c.status)?.[1] || c.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {[c.whatsapp, c.cidade_regiao, c.experiencia].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
                <select value={c.status} onChange={e => setStatus(c.id, e.target.value)} className="text-xs px-2 py-1.5 rounded border border-gray-300 bg-white shrink-0">
                  {STATUS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                </select>
              </div>

              {expandedId === c.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                    {c.whatsapp && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {c.whatsapp}</span>}
                    {c.cidade_regiao && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {c.cidade_regiao}</span>}
                    <span>Experiência: <strong>{c.experiencia || '—'}</strong></span>
                    <span>Carteira ativa: <strong>{yesno(c.carteira_ativa)}</strong></span>
                    <span>Clientes ativos (aprox.): <strong>{c.clientes_aprox || '—'}</strong></span>
                    <span>Situação: <strong>{c.situacao_cadastral || '—'}</strong></span>
                    {c.marcas_atuais && <span className="col-span-2">Marcas que representa: {c.marcas_atuais}</span>}
                  </div>
                  {c.canais && c.canais.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {c.canais.map(x => <span key={x} className="px-2 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] font-medium">{x}</span>)}
                    </div>
                  )}
                  {c.obs_admin && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">Obs.: {c.obs_admin}</p>}

                  {invite && invite.id === c.id && (
                    <div className="bg-[#f8f7f5] border-2 border-dashed border-[#8B2214] rounded-xl p-3 flex items-center gap-3">
                      <KeyRound className="w-5 h-5 text-[#8B2214]" />
                      <span className="text-2xl font-mono font-bold tracking-widest text-[#8B2214]">{invite.code}</span>
                      <button onClick={() => navigator.clipboard.writeText(invite.code)} className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 text-xs"><Copy className="w-4 h-4" /> copiar</button>
                      <span className="text-[11px] text-gray-400 ml-auto">envie por WhatsApp · válido 24h · uso único</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    <button onClick={() => gerarConvite(c)} disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-60">
                      {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Gerar convite (Representante)
                    </button>
                    <button onClick={() => rejeitar(c)} disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 hover:text-red-600 disabled:opacity-60">
                      <XCircle className="w-4 h-4" /> Rejeitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
