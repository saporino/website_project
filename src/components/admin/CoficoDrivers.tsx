// Cadastro simples de motoristas da COFICO (própria). Alimenta o seletor de motorista no despacho.
// Vincular a um login (pra o motorista entrar no app) vem na etapa do app do motorista.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, ChevronDown, ChevronUp, Loader2, Truck } from 'lucide-react';

interface Driver {
  id: string; full_name: string; phone: string | null; vehicle_desc: string | null;
  vehicle_plate: string | null; cnh: string | null; status: string;
}

export default function CoficoDrivers() {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ nome: '', telefone: '', veiculo: '', placa: '', cnh: '' });

  async function load() {
    setLoading(true);
    const [{ data: d }, { data: co }] = await Promise.all([
      supabase.from('drivers').select('id,full_name,phone,vehicle_desc,vehicle_plate,cnh,status').order('full_name'),
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
    const { error } = await supabase.from('drivers').insert({
      full_name: f.nome.trim(),
      phone: f.telefone.trim() || null,
      vehicle_desc: f.veiculo.trim() || null,
      vehicle_plate: f.placa.trim() || null,
      cnh: f.cnh.trim() || null,
      company_id: companyId || null,
      status: 'active',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setF({ nome: '', telefone: '', veiculo: '', placa: '', cnh: '' });
    load();
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
          {/* form */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Nome *" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
            <input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="Telefone" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
            <input value={f.veiculo} onChange={e => setF({ ...f, veiculo: e.target.value })} placeholder="Veículo (ex.: Fiorino)" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
            <input value={f.placa} onChange={e => setF({ ...f, placa: e.target.value })} placeholder="Placa" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
            <input value={f.cnh} onChange={e => setF({ ...f, cnh: e.target.value })} placeholder="CNH" className="h-[36px] px-3 text-sm border border-gray-300 rounded" />
          </div>
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
            <ul className="divide-y divide-gray-100">
              {drivers.map(dv => (
                <li key={dv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{dv.full_name}</span>
                    <span className="text-gray-400"> · {[dv.vehicle_desc, dv.vehicle_plate, dv.phone].filter(Boolean).join(' · ') || 'sem veículo'}</span>
                  </div>
                  <button onClick={() => toggleStatus(dv)}
                    className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${dv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {dv.status === 'active' ? 'Ativo' : 'Inativo'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
