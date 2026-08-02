// Cadastro simples de motoristas da COFICO (própria). Alimenta o seletor de motorista no despacho.
// Vincular a um login (pra o motorista entrar no app) vem na etapa do app do motorista.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, ChevronDown, ChevronUp, Loader2, Truck, Paperclip, FileText, Plus } from 'lucide-react';
import { VehicleList } from './CoficoFrota';

// Documentos exigidos p/ motorista (Lei 13.103/2015: exame toxicológico obrigatório p/ CNH C/D/E;
// aptidão física/mental; MOPP quando carga perigosa).
const DRIVER_DOC_TIPOS: [string, string][] = [
  ['cnh', 'CNH'], ['rg', 'RG'], ['cpf', 'CPF'], ['curriculo', 'Currículo'],
  ['exame_toxicologico', 'Exame toxicológico'], ['exame_medico', 'Exame médico / aptidão'],
  ['mopp', 'MOPP (carga perigosa)'], ['comprovante_residencia', 'Comprovante de residência'],
  ['antt', 'ANTT'], ['outro', 'Outro'],
];
const DTYPE: Record<string, string> = { proprio: 'Nosso', parceiro: 'Parceiro/Agregado' };
const fmtD = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';

interface Driver {
  id: string; full_name: string; phone: string | null; status: string; driver_type: string;
}

export default function CoficoDrivers() {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [f, setF] = useState({ nome: '', telefone: '', tipo: 'proprio' });

  async function load() {
    setLoading(true);
    const [{ data: d }, { data: co }] = await Promise.all([
      supabase.from('drivers').select('id,full_name,phone,status,driver_type').order('full_name'),
      supabase.from('companies').select('id').eq('is_operator', true).limit(1).maybeSingle(),
    ]);
    setDrivers((d as Driver[]) || []);
    if (co?.id) setCompanyId(co.id);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!f.nome.trim()) { setErr('Informe o nome do motorista.'); return; }
    setSaving(true); setErr('');
    const { data: created, error } = await supabase.from('drivers').insert({
      full_name: f.nome.trim(),
      phone: f.telefone.trim() || null,
      driver_type: f.tipo || 'proprio',
      company_id: companyId || null,
      status: 'active',
    }).select('id').single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setF({ nome: '', telefone: '', tipo: 'proprio' });
    await load();
    if (created?.id) setExpandedId(created.id); // auto-abre o recém-criado; os demais ficam recolhidos
  }

  async function toggleStatus(dv: Driver) {
    const next = dv.status === 'active' ? 'blocked' : 'active';
    await supabase.from('drivers').update({ status: next }).eq('id', dv.id);
    load();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-gray-900"><Truck className="w-5 h-5 text-[#8B2214]" /> Motoristas ({drivers.length})</span>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {/* form — motorista NOSSO ou PARCEIRO. Sem carro/placa (carro fica na Frota); documentos no expandir. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} className="h-[36px] px-2 text-sm border border-gray-300 rounded bg-white">
              <option value="proprio">Nosso (funcionário)</option>
              <option value="parceiro">Parceiro / Agregado</option>
            </select>
            <input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Nome *" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
            <input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="Telefone" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
          </div>
          <p className="text-[11px] text-gray-400">Carro e placa ficam na Frota. Aqui é só a pessoa e os documentos dela (CNH, RG, CPF, currículo…).</p>
          {err && <p className="text-[11px] text-red-600">{err}</p>}
          <button onClick={add} disabled={saving} className="inline-flex items-center gap-2 h-[36px] px-4 rounded-lg bg-[#8B2214] text-white text-sm font-semibold hover:bg-[#6d1a10] disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Adicionar motorista
          </button>

          {/* lista */}
          {loading ? (
            <p className="text-sm text-gray-400">Carregando…</p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum motorista cadastrado ainda.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {drivers.map(dv => (
                <div key={dv.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setExpandedId(id => id === dv.id ? null : dv.id)} className="flex items-center gap-2 min-w-0 text-left">
                      {expandedId === dv.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                      <span className="min-w-0 flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f0ef] text-[#8B2214] font-medium shrink-0">{DTYPE[dv.driver_type] || 'Nosso'}</span>
                        <span className="font-medium text-gray-900">{dv.full_name}</span>
                        {dv.phone && <span className="text-gray-400">· {dv.phone}</span>}
                      </span>
                    </button>
                    <button onClick={() => toggleStatus(dv)}
                      className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${dv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {dv.status === 'active' ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  {expandedId === dv.id && (
                    <div className="pl-6 pt-2 space-y-4">
                      <DriverDocs driverId={dv.id} />
                      {dv.driver_type === 'parceiro' && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Veículo(s) do parceiro</p>
                          <VehicleList ownerDriverId={dv.id} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Documentos do motorista (upload em representative-docs, pasta cofico/drivers/<id>).
function DriverDocs({ driverId }: { driverId: string }) {
  const [docs, setDocs] = useState<{ id: string; tipo: string; numero: string | null; validade: string | null; doc_path: string | null; doc_name: string | null }[]>([]);
  const [tipo, setTipo] = useState('cnh');
  const [numero, setNumero] = useState('');
  const [validade, setValidade] = useState('');
  const [up, setUp] = useState(false);

  async function load() {
    const { data } = await supabase.from('driver_documents').select('*').eq('driver_id', driverId).order('created_at', { ascending: false });
    setDocs(data || []);
  }
  useEffect(() => { load(); }, [driverId]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUp(true);
    try {
      const path = `cofico/drivers/${driverId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('representative-docs').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await supabase.from('driver_documents').insert({ driver_id: driverId, tipo, numero: numero || null, validade: validade || null, doc_path: path, doc_name: file.name });
      setNumero(''); setValidade(''); await load();
    } catch (err: any) { alert('Erro no upload: ' + (err.message || err)); }
    finally { setUp(false); e.target.value = ''; }
  }
  async function openDoc(path: string) {
    const { data } = await supabase.storage.from('representative-docs').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Documentos do motorista</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="h-[32px] px-2 text-xs border border-gray-300 rounded bg-white">
          {DRIVER_DOC_TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº (opcional)" className="h-[32px] px-2 text-xs border border-gray-300 rounded w-28" />
        <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="h-[32px] px-2 text-xs border border-gray-300 rounded" title="Validade" />
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
                <FileText className="w-3.5 h-3.5" /> {(DRIVER_DOC_TIPOS.find(t => t[0] === d.tipo)?.[1]) || d.tipo}
              </button>
              <span className="text-gray-400 truncate">{[d.numero, d.doc_name, d.validade ? `vence ${fmtD(d.validade)}` : ''].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
