// Frota da COFICO — veículos + documentos + manutenção (óleo/revisões), com alerta de vencimento.
// Documentos privados em representative-docs (bucket privado que já tem policy de upload/leitura),
// sob pasta cofico/vehicles/<id>/. Admin-only (RLS).
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, ChevronDown, ChevronUp, Plus, Loader2, Paperclip, FileText, Wrench, AlertTriangle } from 'lucide-react';

const TIPOS: [string, string][] = [
  ['utilitario', 'Utilitário'], ['vuc', 'VUC'], ['van', 'Van'], ['toco', 'Toco'],
  ['truck', 'Truck'], ['carreta', 'Carreta'], ['bitrem', 'Bitrem'], ['moto', 'Moto'], ['outro', 'Outro'],
];
const TIPO_LABEL = Object.fromEntries(TIPOS);
const DOC_TIPOS: [string, string][] = [
  ['crlv', 'CRLV'], ['seguro', 'Apólice de seguro'], ['licenciamento', 'Licenciamento'],
  ['tacografo', 'Tacógrafo'], ['antt', 'ANTT/RNTRC'], ['laudo', 'Laudo'], ['outro', 'Outro'],
];

interface Vehicle {
  id: string; tipo: string; placa: string | null; renavam: string | null;
  marca: string | null; modelo: string | null; ano: number | null; km_atual: number | null;
  crlv_validade: string | null; seguradora: string | null; apolice: string | null; seguro_validade: string | null;
  licenciamento_validade: string | null; tacografo_validade: string | null; antt_rntrc: string | null;
  oleo_ultima_data: string | null; oleo_ultimo_km: number | null; oleo_proximo_km: number | null;
  status: string; notes: string | null;
}

function expiry(date: string | null): 'ok' | 'soon' | 'expired' | null {
  if (!date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return 'ok';
}
const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

export default function CoficoFrota() {
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [{ data: v }, { data: co }] = await Promise.all([
      supabase.from('fleet_vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('id').eq('is_operator', true).limit(1).maybeSingle(),
    ]);
    setVehicles((v as Vehicle[]) || []);
    if (co?.id) setCompanyId(co.id);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!f.placa && !f.modelo) { setErr('Informe ao menos placa ou modelo.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('fleet_vehicles').insert({
      company_id: companyId || null,
      tipo: f.tipo || 'utilitario',
      placa: f.placa || null, renavam: f.renavam || null,
      marca: f.marca || null, modelo: f.modelo || null,
      ano: f.ano ? Number(f.ano) : null, km_atual: f.km_atual ? Number(f.km_atual) : null,
      crlv_validade: f.crlv_validade || null,
      seguradora: f.seguradora || null, apolice: f.apolice || null, seguro_validade: f.seguro_validade || null,
      licenciamento_validade: f.licenciamento_validade || null, tacografo_validade: f.tacografo_validade || null,
      antt_rntrc: f.antt_rntrc || null,
      oleo_proximo_km: f.oleo_proximo_km ? Number(f.oleo_proximo_km) : null,
      status: 'ativo',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setF({}); setShowForm(false); load();
  }

  const inp = (k: string, ph: string, type = 'text') => (
    <input type={type} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph}
      className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-gray-900"><Truck className="w-5 h-5 text-[#8B2214]" /> Frota — veículos ({vehicles.length})</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 h-[36px] px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10]">
              <Plus className="w-4 h-4" /> Adicionar veículo
            </button>
          ) : (
            <div className="rounded-lg border border-[#8B2214] p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select value={f.tipo || 'utilitario'} onChange={e => setF({ ...f, tipo: e.target.value })} className="h-[36px] px-2 text-sm border border-gray-300 rounded bg-white">
                  {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {inp('placa', 'Placa')}{inp('marca', 'Marca')}{inp('modelo', 'Modelo')}
                {inp('ano', 'Ano', 'number')}{inp('renavam', 'RENAVAM')}{inp('km_atual', 'KM atual', 'number')}{inp('antt_rntrc', 'ANTT/RNTRC')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="text-[11px] text-gray-500">CRLV vence<br/>{inp('crlv_validade', '', 'date')}</label>
                <label className="text-[11px] text-gray-500">Licenciamento vence<br/>{inp('licenciamento_validade', '', 'date')}</label>
                <label className="text-[11px] text-gray-500">Tacógrafo vence<br/>{inp('tacografo_validade', '', 'date')}</label>
                <label className="text-[11px] text-gray-500">Óleo — próximo KM<br/>{inp('oleo_proximo_km', '', 'number')}</label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {inp('seguradora', 'Seguradora')}{inp('apolice', 'Nº apólice')}
                <label className="text-[11px] text-gray-500">Seguro vence<br/>{inp('seguro_validade', '', 'date')}</label>
              </div>
              {err && <p className="text-[11px] text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={add} disabled={saving} className="h-[36px] px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar veículo'}</button>
                <button onClick={() => { setShowForm(false); setErr(''); }} className="h-[36px] px-3 rounded-lg border border-gray-300 text-sm text-gray-600">Cancelar</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-sm text-gray-400">Carregando…</p> : vehicles.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum veículo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map(v => {
                const alerts = [v.crlv_validade, v.seguro_validade, v.licenciamento_validade, v.tacografo_validade].map(expiry);
                const anyExpired = alerts.includes('expired'); const anySoon = alerts.includes('soon');
                return (
                  <div key={v.id} className="border border-gray-200 rounded-lg">
                    <button onClick={() => setExpandedId(id => id === v.id ? null : v.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] font-medium shrink-0">{TIPO_LABEL[v.tipo] || v.tipo}</span>
                        <span className="font-semibold text-gray-900 shrink-0">{v.placa || '(sem placa)'}</span>
                        <span className="text-sm text-gray-500 truncate">{[v.marca, v.modelo, v.ano].filter(Boolean).join(' ')}</span>
                      </span>
                      {(anyExpired || anySoon) && <span className={`flex items-center gap-1 text-[11px] shrink-0 ${anyExpired ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle className="w-3.5 h-3.5" /> {anyExpired ? 'Doc vencido' : 'Vence em breve'}</span>}
                    </button>
                    {expandedId === v.id && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-3 text-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                          <Field label="CRLV vence" value={fmtDate(v.crlv_validade)} state={expiry(v.crlv_validade)} />
                          <Field label="Seguro vence" value={fmtDate(v.seguro_validade)} state={expiry(v.seguro_validade)} />
                          <Field label="Licenciamento" value={fmtDate(v.licenciamento_validade)} state={expiry(v.licenciamento_validade)} />
                          <Field label="Tacógrafo" value={fmtDate(v.tacografo_validade)} state={expiry(v.tacografo_validade)} />
                          <Field label="KM atual" value={v.km_atual != null ? String(v.km_atual) : '—'} />
                          <Field label="Próx. óleo (KM)" value={v.oleo_proximo_km != null ? String(v.oleo_proximo_km) : '—'} />
                          <Field label="Seguradora" value={[v.seguradora, v.apolice].filter(Boolean).join(' · ') || '—'} />
                          <Field label="ANTT/RNTRC" value={v.antt_rntrc || '—'} />
                        </div>
                        <VehicleDocs vehicleId={v.id} />
                        <VehicleMaintenance vehicleId={v.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, state }: { label: string; value: string; state?: 'ok' | 'soon' | 'expired' | null }) {
  const color = state === 'expired' ? 'text-red-600 font-semibold' : state === 'soon' ? 'text-amber-600 font-semibold' : 'text-gray-700';
  return <div><span className="text-gray-400">{label}: </span><span className={color}>{value}</span></div>;
}

// --- documentos do veículo (upload em representative-docs, pasta cofico/vehicles/<id>) ---
function VehicleDocs({ vehicleId }: { vehicleId: string }) {
  const [docs, setDocs] = useState<{ id: string; tipo: string; validade: string | null; doc_path: string | null; doc_name: string | null }[]>([]);
  const [tipo, setTipo] = useState('crlv');
  const [validade, setValidade] = useState('');
  const [up, setUp] = useState(false);

  async function load() {
    const { data } = await supabase.from('fleet_documents').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
    setDocs(data || []);
  }
  useEffect(() => { load(); }, [vehicleId]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUp(true);
    try {
      const path = `cofico/vehicles/${vehicleId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('representative-docs').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await supabase.from('fleet_documents').insert({ vehicle_id: vehicleId, tipo, validade: validade || null, doc_path: path, doc_name: file.name });
      setValidade(''); await load();
    } catch (err: any) { alert('Erro no upload: ' + (err.message || err)); }
    finally { setUp(false); e.target.value = ''; }
  }
  async function openDoc(path: string) {
    const { data } = await supabase.storage.from('representative-docs').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Documentos do veículo</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="h-[32px] px-2 text-xs border border-gray-300 rounded bg-white">
          {DOC_TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="h-[32px] px-2 text-xs border border-gray-300 rounded" title="Validade (opcional)" />
        <label className="h-[32px] px-3 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-1">
          {up ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Anexar
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={upload} />
        </label>
      </div>
      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-2 text-xs">
              <button onClick={() => d.doc_path && openDoc(d.doc_path)} className="flex items-center gap-1 text-[#8B2214] hover:underline">
                <FileText className="w-3.5 h-3.5" /> {(DOC_TIPOS.find(t => t[0] === d.tipo)?.[1]) || d.tipo}
              </button>
              <span className="text-gray-400 truncate">{d.doc_name}{d.validade ? ` · vence ${fmtDate(d.validade)}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- manutenção (óleo/revisão) ---
function VehicleMaintenance({ vehicleId }: { vehicleId: string }) {
  const [items, setItems] = useState<{ id: string; tipo: string; data: string | null; km: number | null; custo: number | null; obs: string | null }[]>([]);
  const [m, setM] = useState<Record<string, string>>({ tipo: 'troca_oleo' });
  const TP: [string, string][] = [['troca_oleo', 'Troca de óleo'], ['revisao', 'Revisão'], ['pneu', 'Pneu'], ['freio', 'Freio'], ['eletrica', 'Elétrica'], ['outro', 'Outro']];

  async function load() {
    const { data } = await supabase.from('fleet_maintenance').select('*').eq('vehicle_id', vehicleId).order('data', { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, [vehicleId]);

  async function add() {
    await supabase.from('fleet_maintenance').insert({
      vehicle_id: vehicleId, tipo: m.tipo || 'revisao', data: m.data || null,
      km: m.km ? Number(m.km) : null, custo: m.custo ? Number(m.custo) : null, obs: m.obs || null,
    });
    setM({ tipo: 'troca_oleo' }); load();
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Manutenção (óleo / revisões)</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={m.tipo} onChange={e => setM({ ...m, tipo: e.target.value })} className="h-[32px] px-2 text-xs border border-gray-300 rounded bg-white">
          {TP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={m.data || ''} onChange={e => setM({ ...m, data: e.target.value })} className="h-[32px] px-2 text-xs border border-gray-300 rounded" />
        <input type="number" value={m.km || ''} onChange={e => setM({ ...m, km: e.target.value })} placeholder="KM" className="h-[32px] px-2 text-xs border border-gray-300 rounded w-20" />
        <input type="number" value={m.custo || ''} onChange={e => setM({ ...m, custo: e.target.value })} placeholder="R$" className="h-[32px] px-2 text-xs border border-gray-300 rounded w-20" />
        <input value={m.obs || ''} onChange={e => setM({ ...m, obs: e.target.value })} placeholder="Obs" className="h-[32px] px-2 text-xs border border-gray-300 rounded flex-1 min-w-[120px]" />
        <button onClick={add} className="h-[32px] px-3 text-xs font-semibold rounded bg-[#8B2214] text-white">Registrar</button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 text-xs">
          {items.map(it => (
            <li key={it.id} className="text-gray-600">
              <span className="font-medium">{TP.find(t => t[0] === it.tipo)?.[1] || it.tipo}</span>
              {it.data ? ` · ${fmtDate(it.data)}` : ''}{it.km != null ? ` · ${it.km} km` : ''}{it.custo != null ? ` · R$ ${it.custo}` : ''}{it.obs ? ` · ${it.obs}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
