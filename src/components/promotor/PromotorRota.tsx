import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  distMeters, getPosition, capturePhoto, compressImage, uploadVisitPhoto,
  auditLog, broadcastVisitState, updateVisitSafe, getPending, retryPending,
} from '../../lib/promoterVisit';
import { MapPin, Navigation2, Camera, CheckCircle, XCircle, Play, RefreshCw, Plus, ChevronRight, Clock } from 'lucide-react';

// Bloco 3 — Minha rota / Visitas de hoje do promotor + fluxo da visita em etapas.
// Loja = representative_clients (via vw_promoter_stores). Nada comercial aparece aqui.

interface Store { id: string; razao_social: string | null; nome_fantasia: string | null; endereco_completo: string | null; municipio: string | null; lat: number | null; lng: number | null; geofence_radius_m: number | null; }
interface Visit {
  id: string; route_id: string | null; representative_client_id: string; company_id: string | null;
  stop_order: number | null; priority: string | null; scheduled_at: string | null; estimated_minutes: number | null;
  status: string; arrival_at: string | null; departure_at: string | null; duration_minutes: number | null;
  is_scheduled: boolean; not_visited_reason: string | null; notes: string | null;
  checkin_geofence_ok: boolean | null;
}
interface Props { promoterId: string; promoterName: string; }

const STATUS_LABEL: Record<string, string> = {
  nao_iniciada: 'Não iniciada', em_deslocamento: 'Em deslocamento', em_atendimento: 'Em atendimento',
  concluida: 'Concluída', concluida_com_pendencia: 'Concluída c/ pendência', nao_realizada: 'Não realizada',
};
const STATUS_CLS: Record<string, string> = {
  nao_iniciada: 'bg-gray-100 text-gray-600', em_deslocamento: 'bg-blue-100 text-blue-700', em_atendimento: 'bg-amber-100 text-amber-700',
  concluida: 'bg-green-100 text-green-700', concluida_com_pendencia: 'bg-orange-100 text-orange-700', nao_realizada: 'bg-red-100 text-red-700',
};
const NOT_VISITED_REASONS: [string, string][] = [
  ['loja_fechada', 'Loja fechada'], ['acesso_negado', 'Acesso negado'], ['endereco_incorreto', 'Endereço incorreto'],
  ['problema_saude', 'Problema de saúde'], ['problema_transporte', 'Problema de transporte'],
  ['rota_alterada', 'Rota alterada'], ['loja_sem_operacao', 'Loja sem operação'], ['outro', 'Outro'],
];

export default function PromotorRota({ promoterId, promoterName }: Props) {
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [flowVisit, setFlowVisit] = useState<Visit | null>(null);
  const [nvVisit, setNvVisit] = useState<Visit | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(getPending().length);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: sts }, { data: routes }] = await Promise.all([
      supabase.from('vw_promoter_stores').select('*'),
      supabase.from('promoter_routes').select('id').eq('promoter_id', promoterId).eq('route_date', today).eq('status', 'published'),
    ]);
    const storeMap: Record<string, Store> = {};
    ((sts as Store[]) || []).forEach(s => { storeMap[s.id] = s; });
    setStores(storeMap);
    const routeIds = (routes || []).map((r: { id: string }) => r.id);
    let q = supabase.from('promoter_visits').select('*').eq('promoter_id', promoterId).order('stop_order', { ascending: true });
    if (routeIds.length) q = q.or(`route_id.in.(${routeIds.join(',')}),and(route_id.is.null,created_at.gte.${today})`);
    else q = q.is('route_id', null).gte('created_at', today);
    const { data: vs } = await q;
    setVisits(((vs as Visit[]) || []).filter(v => !( v as any ).cancelled_at));
    setLoading(false);
  }, [promoterId]);

  useEffect(() => { load(); getPosition().then(p => p && setCoords({ lat: p.lat, lng: p.lng })); }, [load]);

  const storeOf = (v: Visit) => stores[v.representative_client_id];
  const nameOf = (v: Visit) => { const s = storeOf(v); return s?.nome_fantasia || s?.razao_social || 'Loja'; };
  const pend = visits.filter(v => !['concluida', 'concluida_com_pendencia', 'nao_realizada'].includes(v.status));
  const done = visits.filter(v => ['concluida', 'concluida_com_pendencia', 'nao_realizada'].includes(v.status));
  const next = pend[0] || null;
  const shown = showDone ? visits : pend;

  async function addExtraVisit(storeId: string) {
    const { data, error } = await supabase.from('promoter_visits').insert({
      promoter_id: promoterId, representative_client_id: storeId,
      company_id: stores[storeId]?.lat !== undefined ? (stores[storeId] as any).company_id ?? null : null,
      is_scheduled: false, status: 'nao_iniciada',
    }).select('*').single();
    if (!error && data) { setAddOpen(false); setVisits(p => [...p, data as Visit]); auditLog('promoter_visits', data.id, 'visita_adicional', { storeId }); }
  }

  async function retry() { const n = await retryPending(); setPendingCount(getPending().length); if (n > 0) load(); }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;

  if (flowVisit) return <VisitFlow visit={flowVisit} store={storeOf(flowVisit)} promoterId={promoterId} promoterName={promoterName}
    storeName={nameOf(flowVisit)} onExit={() => { setFlowVisit(null); load(); setPendingCount(getPending().length); }} />;

  return (
    <div className="space-y-4 pb-6">
      {pendingCount > 0 && (
        <button onClick={retry} className="w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-3 py-2.5 text-sm font-medium">
          <RefreshCw className="w-4 h-4" /> {pendingCount} atualização(ões) não enviada(s) — tocar para reenviar
        </button>
      )}

      {/* Cabeçalho do dia */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-gray-900">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</p>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] border border-[#ddd0cc] bg-[#f8f7f5] rounded-lg px-2.5 py-1.5"><Plus className="w-3.5 h-3.5" /> Visita adicional</button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#f8f7f5] rounded-lg py-2"><p className="text-xl font-bold text-gray-900">{visits.length}</p><p className="text-[11px] text-gray-500">Programadas</p></div>
          <div className="bg-[#f8f7f5] rounded-lg py-2"><p className="text-xl font-bold text-green-600">{done.filter(v => v.status !== 'nao_realizada').length}</p><p className="text-[11px] text-gray-500">Concluídas</p></div>
          <div className="bg-[#f8f7f5] rounded-lg py-2"><p className="text-xl font-bold text-amber-600">{pend.length}</p><p className="text-[11px] text-gray-500">Pendentes</p></div>
        </div>
        {next && (
          <button onClick={() => setFlowVisit(next)} className="mt-3 w-full flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white font-bold py-3 rounded-xl">
            <Play className="w-4 h-4" /> Iniciar próxima visita — {nameOf(next)}
          </button>
        )}
        {!next && visits.length > 0 && <p className="mt-3 text-center text-sm text-green-700 font-medium">✓ Rota do dia concluída!</p>}
        {visits.length === 0 && <p className="mt-3 text-center text-sm text-gray-400">Nenhuma visita programada para hoje.</p>}
      </div>

      {/* Filtro padrão: só o que falta */}
      {done.length > 0 && (
        <button onClick={() => setShowDone(s => !s)} className="text-xs text-[#8B2214] font-medium underline">
          {showDone ? 'Esconder concluídas' : `Ver concluídas (${done.length})`}
        </button>
      )}

      {/* Cards por loja */}
      <div className="space-y-2">
        {shown.map(v => {
          const s = storeOf(v);
          const d = coords && s?.lat != null && s?.lng != null ? distMeters(coords.lat, coords.lng, Number(s.lat), Number(s.lng)) : null;
          const active = !['concluida', 'concluida_com_pendencia', 'nao_realizada'].includes(v.status);
          return (
            <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{v.stop_order ? `${v.stop_order}. ` : ''}{nameOf(v)}</p>
                  <p className="text-xs text-gray-500 truncate">{s?.endereco_completo || s?.municipio || ''}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[v.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[v.status] || v.status}</span>
                    {v.priority && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{v.priority}</span>}
                    {v.scheduled_at && <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{new Date(v.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {d != null && <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`}</span>}
                    {!v.is_scheduled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">adicional</span>}
                  </div>
                </div>
                {active && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {s?.lat != null && s?.lng != null && (
                      <div className="flex gap-1">
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Google Maps"><Navigation2 className="w-4 h-4" /></a>
                        <a href={`https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`} target="_blank" rel="noreferrer" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold flex items-center" title="Waze">W</a>
                      </div>
                    )}
                    <button onClick={() => setFlowVisit(v)} className="px-3 py-1.5 bg-[#8B2214] text-white text-xs font-bold rounded-lg">{v.status === 'em_atendimento' ? 'Continuar' : 'Iniciar'}</button>
                    <button onClick={() => setNvVisit(v)} className="px-3 py-1 text-[11px] text-red-500 underline">não realizada</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visita adicional — escolher loja */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-gray-900">Visita adicional (fora de rota)</p>
            {Object.values(stores).map(s => (
              <button key={s.id} onClick={() => addExtraVisit(s.id)} className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50">
                <span className="text-sm text-gray-800 truncate">{s.nome_fantasia || s.razao_social}</span>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
            {Object.keys(stores).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhuma loja vinculada a você ainda.</p>}
          </div>
        </div>
      )}

      {/* Não realizada */}
      {nvVisit && <NotVisitedModal visit={nvVisit} storeName={nameOf(nvVisit)} onClose={ok => { setNvVisit(null); if (ok) load(); }} />}
    </div>
  );
}

// ---------- Fluxo da visita: 5 etapas, salvamento a cada etapa ----------
function VisitFlow({ visit, store, storeName, promoterId, promoterName, onExit }: {
  visit: Visit; store?: Store; storeName: string; promoterId: string; promoterName: string; onExit: () => void;
}) {
  const draftKey = `promotor-visita-${visit.id}`;
  const [step, setStep] = useState<number>(() => {
    const d = JSON.parse(localStorage.getItem(draftKey) || '{}');
    if (visit.status === 'em_atendimento') return d.step && d.step > 1 ? d.step : 2;
    return 1;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [justif, setJustif] = useState('');
  const [needJustif, setNeedJustif] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [photos, setPhotos] = useState<{ kind: string; url: string }[]>([]);
  const [notes, setNotes] = useState(visit.notes || '');

  const saveDraft = useCallback((s: number) => localStorage.setItem(draftKey, JSON.stringify({ step: s, ts: Date.now() })), [draftKey]);

  useEffect(() => {
    supabase.from('promoter_visit_photos').select('kind,photo_url').eq('visit_id', visit.id)
      .then(({ data }) => setPhotos((data || []).map((p: any) => ({ kind: p.kind, url: p.photo_url }))));
  }, [visit.id]);

  const radius = Number(store?.geofence_radius_m) || 100;
  const fence = useMemo(() => {
    if (!gps || store?.lat == null || store?.lng == null) return null;
    const d = distMeters(gps.lat, gps.lng, Number(store.lat), Number(store.lng));
    return { dist: Math.round(d), ok: d <= radius };
  }, [gps, store, radius]);

  async function doCheckin() {
    setBusy(true); setErr('');
    const p = await getPosition();
    setGps(p);
    if (!p) { setErr('Não consegui pegar o GPS. Ative a localização e tente de novo.'); setBusy(false); return; }
    const d = store?.lat != null && store?.lng != null ? distMeters(p.lat, p.lng, Number(store.lat), Number(store.lng)) : null;
    const ok = d == null ? null : d <= radius;
    if (ok === false && !justif.trim()) { setNeedJustif(true); setBusy(false); return; }
    const patch = {
      arrival_at: new Date().toISOString(), status: 'em_atendimento',
      checkin_lat: p.lat, checkin_lng: p.lng, checkin_accuracy_m: p.accuracy,
      checkin_distance_m: d != null ? Math.round(d) : null, checkin_geofence_ok: ok,
      checkin_justification: ok === false ? justif.trim() : null,
    };
    const sent = await updateVisitSafe(visit.id, patch);
    await supabase.from('promoter_visit_locations').insert({ visit_id: visit.id, lat: p.lat, lng: p.lng, accuracy_m: p.accuracy, captured_at: new Date().toISOString(), source: 'checkin' });
    auditLog('promoter_visits', visit.id, 'checkin', { geofence_ok: ok, dist: d, sent });
    broadcastVisitState({ type: 'checkin', visitId: visit.id, clientId: visit.representative_client_id, clientName: storeName, promoterName, at: new Date().toISOString() });
    setJustif(''); setNeedJustif(false); setStep(2); saveDraft(2); setBusy(false);
  }

  async function takePhoto(kind: string) {
    setBusy(true); setErr('');
    try {
      const f = await capturePhoto();
      if (!f) { setBusy(false); return; }
      const blob = await compressImage(f);
      const url = await uploadVisitPhoto(promoterId, visit.id, kind, blob);
      const p = await getPosition();
      await supabase.from('promoter_visit_photos').insert({
        visit_id: visit.id, kind, photo_url: url, lat: p?.lat ?? null, lng: p?.lng ?? null,
        taken_at: new Date().toISOString(), company_id: visit.company_id,
      });
      setPhotos(prev => [...prev, { kind, url }]);
    } catch (e) { setErr('Falha ao enviar a foto: ' + (e instanceof Error ? e.message : e)); }
    setBusy(false);
  }

  const has = (kind: string) => photos.some(p => p.kind === kind);

  async function doCheckout() {
    if (!has('gondola_antes') || !has('gondola_depois')) { setErr('Falta a foto da gôndola (antes e depois).'); return; }
    setBusy(true); setErr('');
    const p = await getPosition();
    const d = p && store?.lat != null && store?.lng != null ? distMeters(p.lat, p.lng, Number(store.lat), Number(store.lng)) : null;
    const ok = d == null ? null : d <= radius;
    if (ok === false && !justif.trim()) { setNeedJustif(true); setBusy(false); return; }
    const dur = visit.arrival_at ? Math.round((Date.now() - new Date(visit.arrival_at).getTime()) / 60000) : null;
    const patch = {
      departure_at: new Date().toISOString(), status: 'concluida',
      checkout_lat: p?.lat ?? null, checkout_lng: p?.lng ?? null, checkout_accuracy_m: p?.accuracy ?? null,
      checkout_distance_m: d != null ? Math.round(d) : null, checkout_geofence_ok: ok,
      checkout_justification: ok === false ? justif.trim() : null,
      duration_minutes: dur, notes: notes || null,
    };
    const sent = await updateVisitSafe(visit.id, patch);
    if (p) await supabase.from('promoter_visit_locations').insert({ visit_id: visit.id, lat: p.lat, lng: p.lng, accuracy_m: p.accuracy, captured_at: new Date().toISOString(), source: 'checkout' });
    auditLog('promoter_visits', visit.id, 'checkout', { geofence_ok: ok, duration: dur, sent });
    broadcastVisitState({ type: 'checkout', visitId: visit.id, clientId: visit.representative_client_id, clientName: storeName, promoterName, at: new Date().toISOString() });
    localStorage.removeItem(draftKey);
    setBusy(false); onExit();
  }

  const steps = ['Check-in', 'Foto inicial', 'Auditoria', 'Foto final', 'Check-out'];

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <button onClick={onExit} className="text-sm text-gray-400">Sair</button>
        <div className="min-w-0"><p className="font-bold text-gray-900 truncate">{storeName}</p><p className="text-[11px] text-gray-400">salvo automaticamente a cada etapa</p></div>
      </div>
      {/* progresso */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 < step ? 'bg-green-500' : i + 1 === step ? 'bg-[#8B2214]' : 'bg-gray-200'}`} />
            <p className={`text-[9px] mt-0.5 text-center ${i + 1 === step ? 'text-[#8B2214] font-bold' : 'text-gray-400'}`}>{s}</p>
          </div>
        ))}
      </div>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-gray-800">Check-in na loja</p>
          <p className="text-sm text-gray-500">Vamos registrar sua chegada com o GPS. Raio da loja: {radius} m.</p>
          {fence && !fence.ok && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Você está a {fence.dist} m da loja (fora do raio). Justifique para continuar — o supervisor verá a exceção.</p>}
          {needJustif && (
            <textarea value={justif} onChange={e => setJustif(e.target.value)} rows={2} placeholder="Justificativa (obrigatória fora da geocerca)…"
              className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm" />
          )}
          <button onClick={doCheckin} disabled={busy} className="w-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            {busy ? 'Registrando…' : 'Fazer check-in'}
          </button>
        </div>
      )}

      {step === 2 && (
        <PhotoStep title="Foto inicial da gôndola (obrigatória)" hint="Foto geral, antes de arrumar. Direto da câmera — a galeria não vale."
          mainKind="gondola_antes" extraKinds={[['etiqueta','Etiqueta'],['ponto_extra','Ponto extra'],['deposito','Depósito'],['avaria','Avaria'],['validade','Validade'],['concorrencia','Concorrência']]}
          photos={photos} busy={busy} onShoot={takePhoto}
          canNext={has('gondola_antes')} onNext={() => { setStep(3); saveDraft(3); }} />
      )}

      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
          <p className="text-3xl">📋</p>
          <p className="font-semibold text-gray-800">Auditoria por SKU</p>
          <p className="text-sm text-gray-400">A conferência produto a produto chega no próximo bloco. Siga para a foto final.</p>
          <button onClick={() => { setStep(4); saveDraft(4); }} className="w-full bg-[#8B2214] text-white font-bold py-3 rounded-xl">Continuar</button>
        </div>
      )}

      {step === 4 && (
        <PhotoStep title="Foto final da gôndola (obrigatória)" hint="Depois de arrumada/abastecida."
          mainKind="gondola_depois" extraKinds={[]} photos={photos} busy={busy} onShoot={takePhoto}
          canNext={has('gondola_depois')} onNext={() => { setStep(5); saveDraft(5); }} />
      )}

      {step === 5 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-gray-800">Check-out</p>
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full ${has('gondola_antes') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{has('gondola_antes') ? '✓' : '✗'} foto antes</span>
            <span className={`px-2 py-1 rounded-full ${has('gondola_depois') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{has('gondola_depois') ? '✓' : '✗'} foto depois</span>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações da visita (opcional)…" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          {needJustif && (
            <textarea value={justif} onChange={e => setJustif(e.target.value)} rows={2} placeholder="Você está fora da geocerca — justifique (o supervisor verá)…" className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm" />
          )}
          <button onClick={doCheckout} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
            <CheckCircle className="w-5 h-5" /> {busy ? 'Finalizando…' : 'Finalizar visita'}
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoStep({ title, hint, mainKind, extraKinds, photos, busy, onShoot, canNext, onNext }: {
  title: string; hint: string; mainKind: string; extraKinds: [string, string][];
  photos: { kind: string; url: string }[]; busy: boolean;
  onShoot: (kind: string) => void; canNext: boolean; onNext: () => void;
}) {
  const main = photos.filter(p => p.kind === mainKind);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="font-semibold text-gray-800">{title}</p>
      <p className="text-xs text-gray-400">{hint}</p>
      {main.length > 0 && (
        <div className="flex gap-2 flex-wrap">{main.map((p, i) => <img key={i} src={p.url} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />)}</div>
      )}
      <button onClick={() => onShoot(mainKind)} disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
        <Camera className="w-5 h-5" /> {busy ? 'Enviando…' : main.length ? 'Tirar outra' : 'Abrir câmera'}
      </button>
      {extraKinds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {extraKinds.map(([k, l]) => (
            <button key={k} onClick={() => onShoot(k)} disabled={busy} className="text-xs px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              📷 {l}{photos.some(p => p.kind === k) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}
      <button onClick={onNext} disabled={!canNext} className="w-full border-2 border-[#8B2214] text-[#8B2214] font-bold py-2.5 rounded-xl disabled:opacity-30">Próxima etapa</button>
    </div>
  );
}

function NotVisitedModal({ visit, storeName, onClose }: { visit: Visit; storeName: string; onClose: (ok: boolean) => void }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!reason || !notes.trim()) return;
    setBusy(true);
    const p = await getPosition();
    await updateVisitSafe(visit.id, {
      status: 'nao_realizada', not_visited_reason: reason, not_visited_notes: notes.trim(),
      checkin_lat: p?.lat ?? null, checkin_lng: p?.lng ?? null, arrival_at: new Date().toISOString(),
    });
    auditLog('promoter_visits', visit.id, 'nao_realizada', { reason });
    setBusy(false); onClose(true);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={() => onClose(false)}>
      <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-gray-900 flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" /> Visita não realizada — {storeName}</p>
        <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm">
          <option value="">Motivo…</option>
          {NOT_VISITED_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Justificativa (obrigatória)…" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        <button onClick={save} disabled={busy || !reason || !notes.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-40">Registrar</button>
      </div>
    </div>
  );
}

// ---------- Histórico ----------
export function PromotorHistorico({ promoterId }: { promoterId: string }) {
  const [visits, setVisits] = useState<(Visit & { clientName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [{ data: vs }, { data: sts }] = await Promise.all([
        supabase.from('promoter_visits').select('*').eq('promoter_id', promoterId).order('created_at', { ascending: false }).limit(60),
        supabase.from('vw_promoter_stores').select('id,razao_social,nome_fantasia'),
      ]);
      const nm = new Map((sts || []).map((s: any) => [s.id, s.nome_fantasia || s.razao_social]));
      setVisits(((vs as Visit[]) || []).map(v => ({ ...v, clientName: (nm.get(v.representative_client_id) as string) || 'Loja' })));
      setLoading(false);
    })();
  }, [promoterId]);
  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;
  if (visits.length === 0) return <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">Nenhuma visita registrada ainda.</div>;
  return (
    <div className="space-y-2 pb-6">
      {visits.map(v => (
        <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{v.clientName}</p>
            <p className="text-[11px] text-gray-400">{new Date(v.arrival_at || (v as any).created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{v.duration_minutes != null ? ` · ${v.duration_minutes} min` : ''}</p>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_CLS[v.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[v.status] || v.status}</span>
        </div>
      ))}
    </div>
  );
}
