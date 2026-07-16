import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { capturePhoto, compressImage, uploadVisitPhoto, auditLog } from '../../lib/promoterVisit';
import { Camera, Check, SearchX, ChevronLeft, ChevronRight, PackagePlus } from 'lucide-react';

// Bloco 4 — Etapa 3 da visita: auditoria por SKU (um por tela), ruptura classificada
// PELO BANCO (trigger), abastecimento e trava de 2 fotos na ruptura total.
// Preço aqui é o preço DA GÔNDOLA (da loja) — o promotor nunca vê preço nosso.

interface MixItem { product_id: string; min_frentes: number | null; name: string; product_line: string | null; weight_grams: number | null; barcode: string | null; image_url: string | null; }
interface Audit {
  product_id: string;
  qty_gondola_antes: number | ''; qty_deposito: number | ''; frentes_antes: number | '';
  etiqueta_presente: boolean | null; posicao_correta: boolean | null;
  preco_gondola: number | ''; preco_promocional: number | '';
  lote: string; validade_mais_proxima: string; qty_avariada: number | ''; qty_vencida: number | ''; qty_proxima_vencimento: number | '';
  qty_retirada_deposito: number | ''; qty_abastecida: number | ''; frentes_depois: number | '';
  peps_aplicado: boolean; reorganizado: boolean; etiqueta_corrigida: boolean;
  nao_localizado: boolean; observacoes: string; saved: boolean;
}
const emptyAudit = (pid: string): Audit => ({
  product_id: pid, qty_gondola_antes: '', qty_deposito: '', frentes_antes: '',
  etiqueta_presente: null, posicao_correta: null, preco_gondola: '', preco_promocional: '',
  lote: '', validade_mais_proxima: '', qty_avariada: '', qty_vencida: '', qty_proxima_vencimento: '',
  qty_retirada_deposito: '', qty_abastecida: '', frentes_depois: '',
  peps_aplicado: false, reorganizado: false, etiqueta_corrigida: false,
  nao_localizado: false, observacoes: '', saved: false,
});

// espelho local da regra do banco (feedback instantâneo; o banco é a autoridade)
function statusLocal(a: Audit): string | null {
  if (a.nao_localizado) return 'nao_localizado';
  if (a.qty_gondola_antes === '') return null;
  if (Number(a.qty_gondola_antes) > 0) return 'disponivel';
  if (Number(a.qty_deposito || 0) > 0) return 'ruptura_gondola';
  return 'ruptura_total';
}
const ST_LABEL: Record<string, string> = { disponivel: 'Disponível', ruptura_gondola: 'Ruptura de gôndola (tem no depósito)', ruptura_total: 'RUPTURA TOTAL', nao_localizado: 'Não localizado', fora_mix: 'Fora do mix' };
const ST_CLS: Record<string, string> = { disponivel: 'bg-green-100 text-green-700', ruptura_gondola: 'bg-amber-100 text-amber-800', ruptura_total: 'bg-red-600 text-white', nao_localizado: 'bg-gray-200 text-gray-600', fora_mix: 'bg-gray-100 text-gray-400' };

interface Props { visitId: string; clientId: string; promoterId: string; companyId: string | null; onDone: () => void; }

export default function PromotorAuditoria({ visitId, clientId, promoterId, companyId, onDone }: Props) {
  const [mix, setMix] = useState<MixItem[]>([]);
  const [audits, setAudits] = useState<Record<string, Audit>>({});
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'audit' | 'abastecer' | 'resumo'>('audit');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rupturaFotos, setRupturaFotos] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: ex }, { data: ph }] = await Promise.all([
        supabase.from('vw_promoter_visit_mix').select('*').eq('representative_client_id', clientId).order('name'),
        supabase.from('promoter_visit_audits').select('*').eq('visit_id', visitId),
        supabase.from('promoter_visit_photos').select('product_id,kind').eq('visit_id', visitId).eq('kind', 'sku_ruptura'),
      ]);
      setMix((m as MixItem[]) || []);
      const init: Record<string, Audit> = {};
      ((m as MixItem[]) || []).forEach(it => { init[it.product_id] = emptyAudit(it.product_id); });
      ((ex as any[]) || []).forEach(a => {
        init[a.product_id] = {
          ...emptyAudit(a.product_id),
          ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === null ? (typeof emptyAudit('')[k as keyof Audit] === 'string' ? '' : (typeof emptyAudit('')[k as keyof Audit] === 'boolean' ? false : '')) : v])),
          etiqueta_presente: a.etiqueta_presente, posicao_correta: a.posicao_correta,
          validade_mais_proxima: a.validade_mais_proxima || '', lote: a.lote || '', observacoes: a.observacoes || '',
          saved: true,
        } as Audit;
      });
      setAudits(init);
      const fotos: Record<string, number> = {};
      ((ph as any[]) || []).forEach(p => { if (p.product_id) fotos[p.product_id] = (fotos[p.product_id] || 0) + 1; });
      setRupturaFotos(fotos);
      setLoading(false);
    })();
  }, [visitId, clientId]);

  const cur = mix[idx];
  const a = cur ? (audits[cur.product_id] || emptyAudit(cur.product_id)) : null;
  const st = a ? statusLocal(a) : null;
  const set = (patch: Partial<Audit>) => { if (!cur) return; setAudits(p => ({ ...p, [cur.product_id]: { ...(p[cur.product_id] || emptyAudit(cur.product_id)), ...patch, saved: false } })); };
  const num = (v: string): number | '' => v === '' ? '' : Math.max(0, Math.floor(Number(v)) || 0);

  const precisaAbastecer = useMemo(() => mix.filter(it => {
    const x = audits[it.product_id]; if (!x) return false;
    const s = statusLocal(x);
    const abaixoMin = it.min_frentes != null && x.frentes_antes !== '' && Number(x.frentes_antes) < it.min_frentes;
    return s === 'ruptura_gondola' || abaixoMin;
  }), [mix, audits]);

  async function fotoRuptura(pid: string) {
    setBusy(true); setErr('');
    try {
      const f = await capturePhoto();
      if (!f) { setBusy(false); return; }
      const blob = await compressImage(f);
      const url = await uploadVisitPhoto(promoterId, visitId, 'sku_ruptura', blob);
      await supabase.from('promoter_visit_photos').insert({ visit_id: visitId, kind: 'sku_ruptura', product_id: pid, photo_url: url, taken_at: new Date().toISOString(), company_id: companyId });
      setRupturaFotos(p => ({ ...p, [pid]: (p[pid] || 0) + 1 }));
    } catch (e) { setErr('Falha na foto: ' + (e instanceof Error ? e.message : e)); }
    setBusy(false);
  }

  async function saveCurrent(next: boolean) {
    if (!cur || !a) return;
    const s = statusLocal(a);
    if (s === null) { setErr('Informe pelo menos quanto tem na gôndola.'); return; }
    // ruptura total: exige 2 fotos (SKU + gôndola vazia) antes de avançar
    if (s === 'ruptura_total' && (rupturaFotos[cur.product_id] || 0) < 2) { setErr('Ruptura TOTAL: tire as 2 fotos (o SKU e a gôndola vazia) antes de continuar.'); return; }
    setBusy(true); setErr('');
    const payload: Record<string, unknown> = {
      visit_id: visitId, product_id: cur.product_id, company_id: companyId,
      qty_gondola_antes: a.qty_gondola_antes === '' ? null : a.qty_gondola_antes,
      qty_deposito: a.qty_deposito === '' ? null : a.qty_deposito,
      frentes_antes: a.frentes_antes === '' ? null : a.frentes_antes,
      etiqueta_presente: a.etiqueta_presente, posicao_correta: a.posicao_correta,
      preco_gondola: a.preco_gondola === '' ? null : a.preco_gondola,
      preco_promocional: a.preco_promocional === '' ? null : a.preco_promocional,
      lote: a.lote || null, validade_mais_proxima: a.validade_mais_proxima || null,
      qty_avariada: a.qty_avariada === '' ? null : a.qty_avariada,
      qty_vencida: a.qty_vencida === '' ? null : a.qty_vencida,
      qty_proxima_vencimento: a.qty_proxima_vencimento === '' ? null : a.qty_proxima_vencimento,
      nao_localizado: a.nao_localizado, observacoes: a.observacoes || null,
    };
    const { error } = await supabase.from('promoter_visit_audits').upsert(payload, { onConflict: 'visit_id,product_id' });
    setBusy(false);
    if (error) { setErr('Erro ao salvar: ' + error.message); return; }
    set({ saved: true });
    auditLog('promoter_visit_audits', visitId, 'sku_auditado', { product_id: cur.product_id, status: s });
    if (next) { if (idx < mix.length - 1) setIdx(idx + 1); else setPhase(precisaAbastecer.length ? 'abastecer' : 'resumo'); }
  }

  async function naoLocalizado() {
    if (!cur) return;
    setBusy(true);
    const { error } = await supabase.from('promoter_visit_audits').upsert({ visit_id: visitId, product_id: cur.product_id, company_id: companyId, nao_localizado: true }, { onConflict: 'visit_id,product_id' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    set({ nao_localizado: true, saved: true });
    if (idx < mix.length - 1) setIdx(idx + 1); else setPhase(precisaAbastecer.length ? 'abastecer' : 'resumo');
  }

  async function saveAbastecimento(it: MixItem) {
    const x = audits[it.product_id]; if (!x) return;
    setBusy(true); setErr('');
    const retirada = x.qty_retirada_deposito === '' ? 0 : Number(x.qty_retirada_deposito);
    const dep = x.qty_deposito === '' ? 0 : Number(x.qty_deposito);
    const saldo = Math.max(dep - retirada, 0);
    const { error } = await supabase.from('promoter_visit_audits').upsert({
      visit_id: visitId, product_id: it.product_id, company_id: companyId,
      qty_retirada_deposito: retirada, qty_abastecida: x.qty_abastecida === '' ? 0 : x.qty_abastecida,
      saldo_deposito: saldo, frentes_depois: x.frentes_depois === '' ? null : x.frentes_depois,
      peps_aplicado: x.peps_aplicado, reorganizado: x.reorganizado, etiqueta_corrigida: x.etiqueta_corrigida,
    }, { onConflict: 'visit_id,product_id' });
    setBusy(false);
    if (error) { setErr('Erro: ' + error.message); return; }
    setAudits(p => ({ ...p, [it.product_id]: { ...p[it.product_id], saved: true } }));
  }

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;
  if (mix.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-3">
      <p className="text-3xl">📦</p>
      <p className="text-sm text-gray-500">Esta loja ainda não tem mix de produtos definido pelo escritório. Siga para a foto final.</p>
      <button onClick={onDone} className="w-full bg-[#8B2214] text-white font-bold py-3 rounded-xl">Continuar</button>
    </div>
  );

  const inp = 'w-full h-11 px-3 text-base border border-gray-300 rounded-xl';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';

  if (phase === 'abastecer') return (
    <div className="space-y-3">
      <p className="font-semibold text-gray-800 flex items-center gap-2"><PackagePlus className="w-5 h-5 text-[#8B2214]" /> Abastecimento</p>
      <p className="text-xs text-gray-500">SKUs com ruptura de gôndola ou frentes abaixo do mínimo. O estoque final calcula sozinho — nunca negativo.</p>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {precisaAbastecer.map(it => {
        const x = audits[it.product_id];
        const dep = x.qty_deposito === '' ? 0 : Number(x.qty_deposito);
        const retirada = x.qty_retirada_deposito === '' ? 0 : Number(x.qty_retirada_deposito);
        const finalGondola = (x.qty_gondola_antes === '' ? 0 : Number(x.qty_gondola_antes)) + (x.qty_abastecida === '' ? 0 : Number(x.qty_abastecida));
        return (
          <div key={it.product_id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-900">{it.name}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>Tirou do depósito</label>
                <input type="number" inputMode="numeric" min={0} max={dep} value={x.qty_retirada_deposito}
                  onChange={e => setAudits(p => ({ ...p, [it.product_id]: { ...p[it.product_id], qty_retirada_deposito: e.target.value === '' ? '' : Math.min(Math.max(0, Number(e.target.value) || 0), dep), saved: false } }))} className={inp} /></div>
              <div><label className={lbl}>Colocou na gôndola</label>
                <input type="number" inputMode="numeric" min={0} value={x.qty_abastecida}
                  onChange={e => setAudits(p => ({ ...p, [it.product_id]: { ...p[it.product_id], qty_abastecida: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0), saved: false } }))} className={inp} /></div>
              <div><label className={lbl}>Frentes depois</label>
                <input type="number" inputMode="numeric" min={0} value={x.frentes_depois}
                  onChange={e => setAudits(p => ({ ...p, [it.product_id]: { ...p[it.product_id], frentes_depois: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0), saved: false } }))} className={inp} /></div>
              <div className="bg-[#f8f7f5] rounded-xl px-3 py-2 self-end">
                <p className="text-[11px] text-gray-500">Gôndola final: <strong>{finalGondola}</strong> · Depósito: <strong>{Math.max(dep - retirada, 0)}</strong></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-700">
              {([['peps_aplicado', 'PEPS aplicado'], ['reorganizado', 'Reorganizado'], ['etiqueta_corrigida', 'Etiqueta corrigida']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={x[k] as boolean} onChange={e => setAudits(p => ({ ...p, [it.product_id]: { ...p[it.product_id], [k]: e.target.checked, saved: false } }))} className="w-4 h-4 accent-[#8B2214]" /> {l}
                </label>
              ))}
            </div>
            <button onClick={() => saveAbastecimento(it)} disabled={busy}
              className={`w-full py-2.5 rounded-xl text-sm font-bold ${x.saved ? 'bg-green-100 text-green-700' : 'bg-[#8B2214] text-white'} disabled:opacity-50`}>
              {x.saved ? '✓ Salvo' : 'Salvar abastecimento'}
            </button>
          </div>
        );
      })}
      <button onClick={() => setPhase('resumo')} className="w-full border-2 border-[#8B2214] text-[#8B2214] font-bold py-2.5 rounded-xl">Concluir auditoria</button>
    </div>
  );

  if (phase === 'resumo') {
    const counts: Record<string, number> = {};
    mix.forEach(it => { const s = statusLocal(audits[it.product_id] || emptyAudit(it.product_id)) || 'sem_dado'; counts[s] = (counts[s] || 0) + 1; });
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-800">Auditoria concluída</p>
        <div className="space-y-1 text-sm">
          {Object.entries(counts).map(([s, n]) => (
            <div key={s} className="flex justify-between"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ST_CLS[s] || 'bg-gray-100 text-gray-500'}`}>{ST_LABEL[s] || 'Sem dado'}</span><span className="font-bold">{n}</span></div>
          ))}
        </div>
        <button onClick={onDone} className="w-full bg-[#8B2214] text-white font-bold py-3 rounded-xl">Ir para a foto final</button>
      </div>
    );
  }

  // ---- fase 'audit': UM SKU POR TELA ----
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
        <p className="text-xs text-gray-500 font-medium">SKU {idx + 1} de {mix.length}</p>
        <button onClick={() => setIdx(Math.min(mix.length - 1, idx + 1))} disabled={idx === mix.length - 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
      </div>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {cur && a && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <img src={cur.image_url || '/saporino-logo.png'} className="w-14 h-14 object-cover rounded-lg border border-gray-100 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{cur.name}</p>
              <p className="text-[11px] text-gray-400">{cur.weight_grams ? `${cur.weight_grams}g` : ''}{cur.barcode ? ` · EAN ${cur.barcode}` : ''}{cur.min_frentes != null ? ` · mín. ${cur.min_frentes} frentes` : ''}</p>
            </div>
          </div>
          {st && <div className={`text-center py-1.5 rounded-xl text-sm font-bold ${ST_CLS[st]}`}>{ST_LABEL[st]}</div>}
          {st === 'ruptura_total' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-red-700">Ruptura total: tire as 2 fotos obrigatórias ({rupturaFotos[cur.product_id] || 0}/2)</p>
              <button onClick={() => fotoRuptura(cur.product_id)} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-2.5 rounded-xl disabled:opacity-50">
                <Camera className="w-4 h-4" /> {(rupturaFotos[cur.product_id] || 0) === 0 ? 'Foto do SKU' : 'Foto da gôndola vazia'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={lbl}>Na gôndola (un)</label><input type="number" inputMode="numeric" min={0} value={a.qty_gondola_antes} onChange={e => set({ qty_gondola_antes: num(e.target.value) })} className={inp} /></div>
            <div><label className={lbl}>No depósito (un)</label><input type="number" inputMode="numeric" min={0} value={a.qty_deposito} onChange={e => set({ qty_deposito: num(e.target.value) })} className={inp} /></div>
            <div><label className={lbl}>Frentes</label><input type="number" inputMode="numeric" min={0} value={a.frentes_antes} onChange={e => set({ frentes_antes: num(e.target.value) })} className={inp} /></div>
            <div><label className={lbl}>Preço na gôndola (R$)</label><input type="number" inputMode="decimal" min={0} step="0.01" value={a.preco_gondola} onChange={e => set({ preco_gondola: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} className={inp} /></div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-700">
            {([['etiqueta_presente', 'Etiqueta presente'], ['posicao_correta', 'Posição correta']] as const).map(([k, l]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{l}:</span>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => set({ [k]: v } as Partial<Audit>)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${a[k] === v ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200'}`}>{v ? 'Sim' : 'Não'}</button>
                ))}
              </div>
            ))}
          </div>
          <details className="text-sm">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer">Validade / lote / avaria / promoção</summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div><label className={lbl}>Validade mais próxima</label><input type="date" value={a.validade_mais_proxima} onChange={e => set({ validade_mais_proxima: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Lote</label><input value={a.lote} onChange={e => set({ lote: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Avariadas</label><input type="number" inputMode="numeric" min={0} value={a.qty_avariada} onChange={e => set({ qty_avariada: num(e.target.value) })} className={inp} /></div>
              <div><label className={lbl}>Vencidas</label><input type="number" inputMode="numeric" min={0} value={a.qty_vencida} onChange={e => set({ qty_vencida: num(e.target.value) })} className={inp} /></div>
              <div><label className={lbl}>Perto de vencer</label><input type="number" inputMode="numeric" min={0} value={a.qty_proxima_vencimento} onChange={e => set({ qty_proxima_vencimento: num(e.target.value) })} className={inp} /></div>
              <div><label className={lbl}>Preço promocional (R$)</label><input type="number" inputMode="decimal" min={0} step="0.01" value={a.preco_promocional} onChange={e => set({ preco_promocional: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} className={inp} /></div>
            </div>
            <div className="mt-2"><label className={lbl}>Observações do SKU</label><textarea value={a.observacoes} onChange={e => set({ observacoes: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" /></div>
          </details>
          <div className="flex gap-2">
            <button onClick={naoLocalizado} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-semibold py-3 rounded-xl disabled:opacity-50">
              <SearchX className="w-4 h-4" /> Não localizado
            </button>
            <button onClick={() => saveCurrent(true)} disabled={busy}
              className="flex-[2] flex items-center justify-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white font-bold py-3 rounded-xl disabled:opacity-50">
              <Check className="w-4 h-4" /> {busy ? 'Salvando…' : a.saved ? 'Salvo — próximo' : 'Salvar e próximo'}
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-1 justify-center">
        {mix.map((it, i) => {
          const s = statusLocal(audits[it.product_id] || emptyAudit(it.product_id));
          return <button key={it.product_id} onClick={() => setIdx(i)} className={`w-2.5 h-2.5 rounded-full ${i === idx ? 'ring-2 ring-[#8B2214] ring-offset-1' : ''} ${s === 'disponivel' ? 'bg-green-500' : s === 'ruptura_gondola' ? 'bg-amber-500' : s === 'ruptura_total' ? 'bg-red-600' : s === 'nao_localizado' ? 'bg-gray-400' : 'bg-gray-200'}`} />;
        })}
      </div>
    </div>
  );
}
