import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Coffee, Loader2, Plus, TrendingUp, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react';

const BRAND = '#8B2214';
const brl = (v: number | null) => v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => d.split('-').reverse().join('/');

interface Entry { id: number; ref_date: string; arabica: number | null; conilon: number | null; }

export default function CoffeeMarketIndex() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [arabica, setArabica] = useState('');
  const [conilon, setConilon] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function autoUpdate() {
    setAutoBusy(true); setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cepea-cafe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: '{}',
      });
      const r = await res.json();
      if (r.ok) { await load(); setMsg(`Atualizado do CEPEA (${fmtDate(r.ref_date)}).`); }
      else setMsg('Não consegui atualizar agora: ' + (r.message || r.error || 'fonte indisponível') + '. Você pode lançar manual.');
    } catch (e) { setMsg('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setAutoBusy(false);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('coffee_market_index').select('id,ref_date,arabica,conilon').order('ref_date', { ascending: false }).limit(30);
    setRows((data as Entry[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const latest = rows[0], prev = rows[1];
  const delta = (cur?: number | null, old?: number | null) => (cur != null && old != null && old !== 0) ? ((cur - old) / old) * 100 : null;
  const dArabica = delta(latest?.arabica, prev?.arabica);
  const dConilon = delta(latest?.conilon, prev?.conilon);

  async function save() {
    setSaving(true); setMsg('');
    const a = parseFloat(arabica.replace(',', '.')); const c = parseFloat(conilon.replace(',', '.'));
    if (!date || (isNaN(a) && isNaN(c))) { setMsg('Informe pelo menos um valor.'); setSaving(false); return; }
    const { error } = await supabase.from('coffee_market_index')
      .upsert({ ref_date: date, arabica: isNaN(a) ? null : a, conilon: isNaN(c) ? null : c }, { onConflict: 'ref_date' });
    if (error) setMsg('Erro: ' + error.message);
    else { setArabica(''); setConilon(''); setOpen(false); await load(); }
    setSaving(false);
  }

  const Var = ({ d }: { d: number | null }) => d == null ? null : (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{d >= 0 ? '+' : ''}{d.toFixed(1)}%
    </span>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] flex items-center justify-center"><Coffee className="w-4 h-4" style={{ color: BRAND }} /></span>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight">Mercado do Café Cru</h3>
            <p className="text-[11px] text-gray-500">Indicador CEPEA/ESALQ · R$/saca 60kg{latest ? ` · ${fmtDate(latest.ref_date)}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://www.cepea.org.br/br/indicador/cafe.aspx" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">CEPEA <ExternalLink className="w-3.5 h-3.5" /></a>
          <button onClick={autoUpdate} disabled={autoBusy} className="inline-flex items-center gap-1 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg">{autoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
          <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: BRAND }}><Plus className="w-3.5 h-3.5" /> Lançar</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND }} /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Arábica</p>
              <div className="flex items-baseline gap-2"><p className="text-xl font-bold text-gray-900">{brl(latest?.arabica ?? null)}</p><Var d={dArabica} /></div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Conilon / Robusta</p>
              <div className="flex items-baseline gap-2"><p className="text-xl font-bold text-gray-900">{brl(latest?.conilon ?? null)}</p><Var d={dConilon} /></div>
            </div>
          </div>

          {open && (
            <div className="mt-3 rounded-lg bg-[#f8f7f5] border border-gray-100 p-3 space-y-2">
              <p className="text-xs text-gray-600">Lance o valor de hoje (olhe no CEPEA e digite — R$/saca):</p>
              <div className="flex flex-wrap items-end gap-2">
                <div><label className="block text-[11px] text-gray-500">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                <div><label className="block text-[11px] text-gray-500">Arábica</label><input value={arabica} onChange={e => setArabica(e.target.value)} placeholder="ex.: 2450,00" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                <div><label className="block text-[11px] text-gray-500">Conilon</label><input value={conilon} onChange={e => setConilon(e.target.value)} placeholder="ex.: 1980,00" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</button>
              </div>
              {msg && <p className="text-xs text-red-600">{msg}</p>}
            </div>
          )}

          {rows.length > 1 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Histórico</p>
              <div className="flex flex-wrap gap-1.5">
                {rows.slice(0, 8).map(r => (
                  <span key={r.id} className="rounded-md border border-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    {fmtDate(r.ref_date)} · A {brl(r.arabica)} · C {brl(r.conilon)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {rows.length === 0 && <p className="text-xs text-gray-400 mt-3">Sem lançamentos ainda. Clique em <strong>Lançar</strong> e digite o valor do CEPEA de hoje.</p>}
        </>
      )}
    </div>
  );
}
