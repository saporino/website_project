import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { BarChart3, ChevronDown, ChevronUp, Camera, AlertTriangle, MessageCircle, Clock, Check } from 'lucide-react';

// Bloco 6 — Painel do supervisor/admin: lê das views vw_promoter_* (não recalcula no front).
const MapaVivo = lazy(() => import('./PromoterLiveMapInner'));

interface Visita { id: string; promoter_id: string; representative_client_id: string; status: string; arrival_at: string | null; duration_minutes: number | null; checkin_geofence_ok: boolean | null; created_at: string; }

export default function PromoterSupervisorPanel() {
  const { activeCompanyId } = useCompany();
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10));
  const [cov, setCov] = useState<any[]>([]);
  const [time, setTime] = useState<any[]>([]);
  const [summ, setSumm] = useState<any>(null);
  const [byProd, setByProd] = useState<any[]>([]);
  const [byClient, setByClient] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [expiry, setExpiry] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [fotoVisita, setFotoVisita] = useState<string | null>(null);
  const [fotos, setFotos] = useState<{ kind: string; photo_url: string }[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [abertas, setAbertas] = useState<any[]>([]);
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  async function load() {
    if (!activeCompanyId) return;
    const co = (q: any) => q.eq('company_id', activeCompanyId); // tudo escopado na empresa do seletor
    const [c, t, s, p, cl, st, ex, vs, cls, prs] = await Promise.all([
      co(supabase.from('vw_promoter_coverage').select('*').gte('dia', de).lte('dia', ate)),
      co(supabase.from('vw_promoter_time').select('*')),
      co(supabase.from('vw_promoter_incidents_summary').select('*')),
      co(supabase.from('vw_ruptura_by_product').select('*').order('rupturas_totais', { ascending: false }).limit(10)),
      co(supabase.from('vw_ruptura_by_client').select('*').order('rupturas_totais', { ascending: false }).limit(10)),
      co(supabase.from('vw_promoter_stock_ops').select('*').gte('dia', de).lte('dia', ate).limit(20)),
      co(supabase.from('vw_promoter_expiry').select('*').limit(20)),
      co(supabase.from('promoter_visits').select('id,promoter_id,representative_client_id,status,arrival_at,duration_minutes,checkin_geofence_ok,created_at').order('created_at', { ascending: false }).limit(20)),
      co(supabase.from('representative_clients').select('id,razao_social,nome_fantasia').eq('tem_gondola', true)),
      co(supabase.from('promoters').select('id,full_name')),
    ]);
    setCov(c.data || []); setTime(t.data || []);
    setSumm((s.data || []).reduce((acc: any, r: any) => ({ abertas: (acc.abertas || 0) + r.abertas, resolvidas: (acc.resolvidas || 0) + r.resolvidas, convertidas: (acc.convertidas || 0) + r.convertidas_em_pedido }), {}));
    setByProd(p.data || []); setByClient(cl.data || []); setStock(st.data || []); setExpiry(ex.data || []);
    setVisitas((vs.data as Visita[]) || []);
    const nm: Record<string, string> = {};
    ((cls.data as any[]) || []).forEach(x => { nm[x.id] = x.nome_fantasia || x.razao_social; });
    ((prs.data as any[]) || []).forEach(x => { nm[x.id] = x.full_name; });
    setNomes(nm);
    // Rupturas em aberto — lista acionável para o gerente comercial contatar o cliente
    const { data: ab } = await co(supabase.from('vw_ruptura_open').select('*').order('horas_aberta', { ascending: false }));
    setAbertas((ab as any[]) || []);
  }

  async function resolverRuptura(id: string) {
    setResolvendo(id);
    await supabase.from('promoter_incidents').update({ status: 'resolvida', closed_at: new Date().toISOString() }).eq('id', id);
    setAbertas(prev => prev.filter(r => r.id !== id));
    setResolvendo(null);
  }

  function tempoAberta(horas: number) {
    const h = Math.floor(horas);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d}d ${h % 24}h`;
  }
  function waLink(tel: string | null) {
    if (!tel) return null;
    let d = String(tel).replace(/\D/g, '');
    if (!d) return null;
    if (!d.startsWith('55')) d = '55' + d;
    return `https://wa.me/${d}`;
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, de, ate, activeCompanyId]);

  async function verFotos(visitId: string) {
    setFotoVisita(visitId);
    const { data } = await supabase.from('promoter_visit_photos').select('kind,photo_url').eq('visit_id', visitId).order('taken_at');
    setFotos((data as any[]) || []);
  }

  const totCov = cov.reduce((a, r) => ({ prog: a.prog + Number(r.programadas || 0), real: a.real + Number(r.realizadas || 0), nao: a.nao + Number(r.nao_realizadas || 0) }), { prog: 0, real: 0, nao: 0 });
  const antes = fotos.filter(f => f.kind === 'gondola_antes');
  const depois = fotos.filter(f => f.kind === 'gondola_depois');

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900">Painel da operação (Promotores)</h3>
            <p className="text-xs text-gray-500">Cobertura, tempo em loja, rupturas, abastecimento, validade e mapa ao vivo.</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-gray-500">Período:</span>
            <input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-lg" />
            <span className="text-gray-400">→</span>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-lg" />
            <button onClick={() => setShowMap(m => !m)} className="ml-auto text-xs font-semibold text-[#8B2214] border border-[#ddd0cc] bg-[#f8f7f5] rounded-lg px-3 py-1.5">{showMap ? 'Fechar mapa' : '🗺️ Mapa ao vivo'}</button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <Kpi label="Programadas" v={totCov.prog} />
            <Kpi label="Realizadas" v={totCov.real} cls="text-green-600" />
            <Kpi label="Não realizadas" v={totCov.nao} cls="text-red-600" />
            <Kpi label="Rupturas abertas" v={summ?.abertas ?? 0} cls="text-red-600" />
            <Kpi label="Resolvidas" v={summ?.resolvidas ?? 0} cls="text-green-600" />
            <Kpi label="Viraram pedido 🎯" v={summ?.convertidas ?? 0} cls="text-[#8B2214]" />
          </div>

          {/* Rupturas em aberto — agir agora (gerente comercial contata o cliente) */}
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 bg-red-50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm font-bold text-red-700">Rupturas em aberto — agir agora</p>
              {abertas.length > 0 && <span className="text-[11px] font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{abertas.length}</span>}
            </div>
            {abertas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma ruptura em aberto 🎉</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {abertas.map(r => {
                  const wa = waLink(r.whatsapp_comprador);
                  const urgente = Number(r.horas_aberta) >= 24;
                  return (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.loja || 'Loja'}
                          <span className="text-gray-400 font-normal"> · {r.municipio || ''}{r.uf ? '/' + r.uf : ''}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.produto || 'Produto'} · {r.category === 'ruptura_total' ? 'ruptura total' : (r.category || '').replace(/_/g, ' ')}
                          {r.representante ? ` · rep: ${r.representante}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${urgente ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <Clock className="w-3 h-3" /> {tempoAberta(Number(r.horas_aberta) || 0)}
                      </span>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">sem WhatsApp</span>
                      )}
                      <button onClick={() => resolverRuptura(r.id)} disabled={resolvendo === r.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg px-2.5 py-1.5 flex-shrink-0 disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> {resolvendo === r.id ? '...' : 'Resolver'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showMap && (
            <Suspense fallback={<div className="h-64 flex items-center justify-center text-sm text-gray-400">Carregando mapa…</div>}>
              <div className="relative z-0" style={{ isolation: 'isolate' }}><MapaVivo /></div>
            </Suspense>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Tabela titulo="Tempo em loja (por promotor)" cols={['Promotor', 'Média (min)', 'Fora da geocerca', 'Visitas']}
              rows={time.map(r => [r.promotor, r.tempo_medio_min ?? '—', r.fora_geocerca, r.visitas])} />
            <Tabela titulo="Ruptura por produto" cols={['Produto', 'Totais', 'Gôndola', 'Auditorias']}
              rows={byProd.map(r => [r.produto, r.rupturas_totais, r.rupturas_gondola, r.auditorias])} />
            <Tabela titulo="Ruptura por loja" cols={['Loja', 'Cidade', 'Totais', 'Auditorias']}
              rows={byClient.map(r => [r.loja, `${r.municipio || ''}${r.uf ? '/' + r.uf : ''}`, r.rupturas_totais, r.auditorias])} />
            <Tabela titulo="Abastecimento" cols={['Promotor', 'Dia', 'Abastecido', 'Frentes antes→depois']}
              rows={stock.map(r => [r.promotor, r.dia?.split('-').reverse().slice(0, 2).join('/'), r.abastecido, `${r.frentes_antes_media ?? '—'} → ${r.frentes_depois_media ?? '—'}`])} />
          </div>
          {expiry.length > 0 && (
            <Tabela titulo="Validade / avarias" cols={['Produto', 'Loja', 'Validade', 'Perto de vencer', 'Vencidas', 'Avariadas']}
              rows={expiry.map(r => [r.produto, r.loja, r.validade_mais_proxima ? new Date(r.validade_mais_proxima + 'T12:00:00').toLocaleDateString('pt-BR') : '—', r.qty_proxima_vencimento ?? 0, r.qty_vencida ?? 0, r.qty_avariada ?? 0])} />
          )}

          {/* Visitas recentes + foto antes × depois */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <p className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50">Visitas recentes (clique para ver antes × depois)</p>
            <div className="divide-y divide-gray-100">
              {visitas.map(v => (
                <div key={v.id}>
                  <button onClick={() => fotoVisita === v.id ? setFotoVisita(null) : verFotos(v.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm">
                    <Camera className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate">{nomes[v.representative_client_id] || 'Loja'} · {nomes[v.promoter_id] || 'Promotor'}</span>
                    {v.checkin_geofence_ok === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">fora da geocerca</span>}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${v.status === 'concluida' ? 'bg-green-100 text-green-700' : v.status === 'nao_realizada' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{v.status.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{new Date(v.arrival_at || v.created_at).toLocaleDateString('pt-BR')}</span>
                  </button>
                  {fotoVisita === v.id && (
                    <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                      <div><p className="text-[11px] font-semibold text-gray-500 mb-1">ANTES</p>
                        {antes.length ? antes.map((f, i) => <a key={i} href={f.photo_url} target="_blank" rel="noreferrer"><img src={f.photo_url} className="w-full rounded-lg border border-gray-200 mb-1" /></a>) : <p className="text-xs text-gray-400">sem foto</p>}</div>
                      <div><p className="text-[11px] font-semibold text-gray-500 mb-1">DEPOIS</p>
                        {depois.length ? depois.map((f, i) => <a key={i} href={f.photo_url} target="_blank" rel="noreferrer"><img src={f.photo_url} className="w-full rounded-lg border border-gray-200 mb-1" /></a>) : <p className="text-xs text-gray-400">sem foto</p>}</div>
                    </div>
                  )}
                </div>
              ))}
              {visitas.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma visita ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, v, cls = 'text-gray-900' }: { label: string; v: number; cls?: string }) {
  return <div className="bg-[#f8f7f5] rounded-xl p-3 text-center"><p className={`text-xl font-bold ${cls}`}>{v}</p><p className="text-[10px] text-gray-500">{label}</p></div>;
}
function Tabela({ titulo, cols, rows }: { titulo: string; cols: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <p className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50">{titulo}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-400">{cols.map(c => <th key={c} className="px-3 py-1.5 text-left font-medium">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 ? <tr><td colSpan={cols.length} className="px-3 py-3 text-center text-gray-300">sem dados</td></tr>
              : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5 text-gray-700">{c as any}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
