import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from 'sonner';
import { UserCheck, ChevronDown, ChevronUp, CheckCircle, XCircle, Plus, Copy, Store, Loader2, Route as RouteIcon, ArrowUp, ArrowDown } from 'lucide-react';

// Admin → RepCo → "Promotores" (Bloco 2): aprovar/bloquear promotor, gerar código
// de convite de promotor e vincular lojas (só clientes com tem_gondola = true).

interface Promoter { id: string; full_name: string; cpf: string | null; phone: string | null; status: string; company_id: string | null; created_at: string }
interface Invite { code: string; note: string | null; expires_at: string }
interface StoreRow { id: string; razao_social: string | null; nome_fantasia: string | null; municipio: string | null; company_id: string | null; linked: boolean; linkId: string | null }

export default function PromotersAdmin() {
  const { activeCompanyId, companies } = useCompany();
  const [open, setOpen] = useState(false);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [note, setNote] = useState('');
  const [gen, setGen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [linking, setLinking] = useState<Promoter | null>(null);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // montagem de rota (Bloco 3)
  const [routeFor, setRouteFor] = useState<Promoter | null>(null);
  const [routeDate, setRouteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [routeStores, setRouteStores] = useState<StoreRow[]>([]);
  const [routeSel, setRouteSel] = useState<string[]>([]);
  const [routeInfo, setRouteInfo] = useState<string>('');
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const [{ data: ps }, { data: inv }] = await Promise.all([
      supabase.from('promoters').select('id,full_name,cpf,phone,status,company_id,created_at').order('created_at', { ascending: false }),
      supabase.rpc('promoter_list_invites'),
    ]);
    setPromoters((ps as Promoter[]) || []);
    setInvites((inv as Invite[]) || []);
  }
  useEffect(() => { if (open) load(); }, [open]);

  async function generate() {
    setGen(true); setFresh(null);
    const { data, error } = await supabase.rpc('promoter_generate_invite', { p_note: note.trim() || null });
    setGen(false);
    if (error) { toast.error('Erro ao gerar: ' + error.message); return; }
    const code = Array.isArray(data) ? (data[0] as any)?.code : (data as any)?.code;
    if (code) { setFresh(code); setNote(''); load(); }
  }

  async function setStatus(p: Promoter, status: 'active' | 'blocked') {
    let reason: string | null = null;
    if (status === 'blocked') reason = prompt('Motivo do bloqueio (opcional):');
    setBusy(p.id);
    const { error } = await supabase.from('promoters').update({
      status, blocked_reason: reason,
      ...(status === 'active' ? { approved_at: new Date().toISOString() } : {}),
    }).eq('id', p.id);
    setBusy(null);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(status === 'active' ? `${p.full_name} aprovado!` : `${p.full_name} bloqueado.`);
    load();
  }

  async function setCompany(p: Promoter, companyId: string) {
    const { error } = await supabase.from('promoters').update({ company_id: companyId || null }).eq('id', p.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    load();
  }

  async function openLinking(p: Promoter) {
    setLinking(p); setStores([]);
    // só lojas com gôndola (a regra do módulo)
    const [{ data: cls }, { data: links }] = await Promise.all([
      supabase.from('representative_clients').select('id,razao_social,nome_fantasia,municipio,company_id').eq('tem_gondola', true).eq('status', 'active').order('razao_social'),
      supabase.from('promoter_clients').select('id,representative_client_id,is_active').eq('promoter_id', p.id),
    ]);
    const linkBy = new Map((links || []).map((l: any) => [l.representative_client_id, l]));
    setStores(((cls as any[]) || []).map(c => {
      const l = linkBy.get(c.id);
      return { ...c, linked: !!l && l.is_active, linkId: l?.id || null };
    }));
  }

  async function toggleStore(s: StoreRow) {
    if (!linking) return;
    setBusy(s.id);
    if (s.linkId) {
      const { error } = await supabase.from('promoter_clients').update({ is_active: !s.linked }).eq('id', s.linkId);
      if (error) { toast.error(error.message); setBusy(null); return; }
    } else {
      const { error } = await supabase.from('promoter_clients').insert({ promoter_id: linking.id, representative_client_id: s.id, company_id: s.company_id });
      if (error) { toast.error(error.message); setBusy(null); return; }
    }
    setBusy(null);
    openLinking(linking);
  }

  // ---- Rota do dia (Bloco 3): escolher lojas vinculadas, ordenar e publicar ----
  async function openRoute(p: Promoter, date = routeDate) {
    setRouteFor(p); setRouteSel([]); setRouteInfo('');
    const [{ data: links }, { data: route }] = await Promise.all([
      supabase.from('promoter_clients').select('representative_client_id, representative_clients(id,razao_social,nome_fantasia,municipio,company_id)').eq('promoter_id', p.id).eq('is_active', true),
      supabase.from('promoter_routes').select('id,status').eq('promoter_id', p.id).eq('route_date', date).maybeSingle(),
    ]);
    const sts: StoreRow[] = ((links as any[]) || []).map(l => ({ ...(l.representative_clients || {}), linked: true, linkId: null }));
    setRouteStores(sts);
    if (route) {
      const { data: vs } = await supabase.from('promoter_visits').select('representative_client_id,stop_order').eq('route_id', route.id).order('stop_order');
      setRouteSel(((vs as any[]) || []).map(v => v.representative_client_id));
      setRouteInfo(`Já existe rota ${route.status === 'published' ? 'publicada' : 'rascunho'} nesta data — publicar substitui as paradas não iniciadas.`);
    }
  }
  function toggleRouteStore(id: string) { setRouteSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  function moveRouteStore(id: string, dir: -1 | 1) {
    setRouteSel(p => { const i = p.indexOf(id); const j = i + dir; if (i < 0 || j < 0 || j >= p.length) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }
  async function publishRoute() {
    if (!routeFor || routeSel.length === 0) return;
    setPublishing(true);
    // upsert da rota do dia
    const { data: existing } = await supabase.from('promoter_routes').select('id').eq('promoter_id', routeFor.id).eq('route_date', routeDate).maybeSingle();
    let routeId = existing?.id as string | undefined;
    if (!routeId) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: nr, error } = await supabase.from('promoter_routes').insert({
        promoter_id: routeFor.id, route_date: routeDate, status: 'published', published_at: new Date().toISOString(),
        company_id: routeFor.company_id, created_by: user?.id ?? null,
      }).select('id').single();
      if (error || !nr) { toast.error('Erro ao criar rota: ' + (error?.message || '')); setPublishing(false); return; }
      routeId = nr.id;
    } else {
      await supabase.from('promoter_routes').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', routeId);
      // remove paradas ainda não iniciadas (admin pode; visita concluída nunca sai)
      await supabase.from('promoter_visits').delete().eq('route_id', routeId).eq('status', 'nao_iniciada');
    }
    const { data: kept } = await supabase.from('promoter_visits').select('representative_client_id').eq('route_id', routeId);
    const keptSet = new Set((kept || []).map((k: any) => k.representative_client_id));
    const rows = routeSel.filter(id => !keptSet.has(id)).map((id) => ({
      route_id: routeId, promoter_id: routeFor.id, representative_client_id: id,
      company_id: routeStores.find(s => s.id === id)?.company_id ?? null,
      stop_order: routeSel.indexOf(id) + 1, status: 'nao_iniciada', is_scheduled: true,
    }));
    if (rows.length) {
      const { error } = await supabase.from('promoter_visits').insert(rows);
      if (error) { toast.error('Erro nas paradas: ' + error.message); setPublishing(false); return; }
    }
    toast.success(`Rota de ${routeDate.split('-').reverse().join('/')} publicada (${routeSel.length} loja(s)).`);
    setPublishing(false); setRouteFor(null);
  }

  const badge = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  const label = (s: string) => s === 'active' ? 'Ativo' : s === 'blocked' ? 'Bloqueado' : 'Pendente';

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center"><UserCheck className="w-5 h-5" /></div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900">Promotores</h3>
            <p className="text-xs text-gray-500">Aprovar, bloquear, gerar convite e vincular as lojas (com gôndola) que cada promotor atende.</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Convite */}
          <div className="bg-[#f8f7f5] border border-[#ddd0cc] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Código de convite de promotor (24h, uso único)</p>
            <div className="flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Observação (ex.: nome do promotor)" className="flex-1 h-9 px-3 text-sm border border-gray-300 rounded-lg" />
              <button onClick={generate} disabled={gen} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-3 rounded-lg disabled:opacity-50">
                {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Gerar
              </button>
            </div>
            {fresh && (
              <div className="mt-2 flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                <span className="font-mono font-bold text-lg tracking-widest text-green-700">{fresh}</span>
                <button onClick={() => navigator.clipboard.writeText(fresh)} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> copiar</button>
                <span className="text-[11px] text-gray-400 ml-auto">mande para o promotor entrar em /promotor</span>
              </div>
            )}
            {invites.length > 0 && (
              <div className="mt-2 space-y-1">
                {invites.map(i => (
                  <div key={i.code} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono font-semibold">{i.code}</span>{i.note && <span>· {i.note}</span>}
                    <span className="ml-auto">expira {new Date(i.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de promotores */}
          {promoters.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum promotor cadastrado ainda. Gere um convite acima.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {promoters.map(p => (
                <div key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-500">{p.cpf ? `CPF ${p.cpf} · ` : ''}{p.phone || ''}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge(p.status)}`}>{label(p.status)}</span>
                    <select value={p.company_id || ''} onChange={e => setCompany(p, e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-lg" title="Empresa do promotor">
                      <option value="">Todas as empresas</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.fantasia || c.name}</option>)}
                    </select>
                    {p.status !== 'active' && (
                      <button onClick={() => setStatus(p, 'active')} disabled={busy === p.id} className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 border border-green-200 bg-green-50 rounded-lg px-2.5 py-1.5 hover:bg-green-100 disabled:opacity-50"><CheckCircle className="w-3.5 h-3.5" /> Aprovar</button>
                    )}
                    {p.status === 'active' && (
                      <button onClick={() => setStatus(p, 'blocked')} disabled={busy === p.id} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5 hover:bg-red-100 disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Bloquear</button>
                    )}
                    <button onClick={() => linking?.id === p.id ? setLinking(null) : openLinking(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] border border-[#ddd0cc] bg-[#f8f7f5] rounded-lg px-2.5 py-1.5 hover:bg-[#f0e9e7]">
                      <Store className="w-3.5 h-3.5" /> Lojas
                    </button>
                    <button onClick={() => routeFor?.id === p.id ? setRouteFor(null) : openRoute(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] border border-[#ddd0cc] bg-[#f8f7f5] rounded-lg px-2.5 py-1.5 hover:bg-[#f0e9e7]">
                      <RouteIcon className="w-3.5 h-3.5" /> Rota
                    </button>
                  </div>
                  {routeFor?.id === p.id && (
                    <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-600">Rota de {p.full_name}</p>
                        <input type="date" value={routeDate} onChange={e => { setRouteDate(e.target.value); openRoute(p, e.target.value); }} className="h-8 px-2 text-xs border border-gray-300 rounded-lg ml-auto" />
                      </div>
                      {routeInfo && <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">{routeInfo}</p>}
                      {routeStores.length === 0 ? <p className="text-xs text-gray-400">Vincule lojas ao promotor primeiro (botão Lojas).</p> : (<>
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {routeStores.map(s => {
                            const idx = routeSel.indexOf(s.id);
                            return (
                              <div key={s.id} className="flex items-center gap-2 text-sm text-gray-700 py-0.5">
                                <input type="checkbox" checked={idx >= 0} onChange={() => toggleRouteStore(s.id)} className="w-4 h-4 accent-[#8B2214]" />
                                {idx >= 0 && <span className="w-5 h-5 rounded-full bg-[#8B2214] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>}
                                <span className="truncate flex-1">{s.nome_fantasia || s.razao_social}</span>
                                {idx >= 0 && (<span className="flex gap-0.5 flex-shrink-0">
                                  <button onClick={() => moveRouteStore(s.id, -1)} className="p-1 rounded hover:bg-gray-200"><ArrowUp className="w-3.5 h-3.5 text-gray-500" /></button>
                                  <button onClick={() => moveRouteStore(s.id, 1)} className="p-1 rounded hover:bg-gray-200"><ArrowDown className="w-3.5 h-3.5 text-gray-500" /></button>
                                </span>)}
                              </div>
                            );
                          })}
                        </div>
                        <button onClick={publishRoute} disabled={publishing || routeSel.length === 0}
                          className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-bold py-2 rounded-lg disabled:opacity-40">
                          {publishing ? 'Publicando…' : `Publicar rota (${routeSel.length} loja(s))`}
                        </button>
                      </>)}
                    </div>
                  )}
                  {linking?.id === p.id && (
                    <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Lojas que {p.full_name} atende <span className="text-gray-400 font-normal">(só clientes com gôndola)</span></p>
                      {stores.length === 0 ? <p className="text-xs text-gray-400">Nenhum cliente com gôndola marcada. Marque "tem gôndola = Sim" no cadastro do cliente primeiro.</p> : (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {stores.map(s => (
                            <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-0.5">
                              <input type="checkbox" checked={s.linked} disabled={busy === s.id} onChange={() => toggleStore(s)} className="w-4 h-4 accent-[#8B2214]" />
                              <span className="truncate">{s.nome_fantasia || s.razao_social}</span>
                              {s.municipio && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{s.municipio}</span>}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400">Empresa ativa no seletor: {companies.find(c => c.id === activeCompanyId)?.fantasia || '—'} · o promotor com "Todas as empresas" audita o catálogo de todas.</p>
        </div>
      )}
    </div>
  );
}
