import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Coffee, Loader2, Plus, ExternalLink, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const BRAND = '#8B2214';
const brl = (v: number | null) => v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => d.split('-').reverse().join('/');
const pct = (v: number | null) => v == null ? '' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

interface Entry { id: number; ref_date: string; arabica: number | null; conilon: number | null; arabica_var: number | null; conilon_var: number | null; }

// Widget OFICIAL do CEPEA (id 23 = Arábica, 24 = Conilon/Robusta) já com as cores Saporino.
// Usa document.write -> precisa rodar isolado num iframe (se colado direto quebra o React).
const WIDGET = 'https://www.cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=12&largura=400px&corfundo=f5f0ef&cortexto=5c1a10&corlinha=faf6f5&id_indicador%5B%5D=23&id_indicador%5B%5D=24';
const WIDGET_DOC = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:arial,helvetica,sans-serif;background:transparent}table{max-width:100%}</style></head><body><script src="${WIDGET}"><\/script></body></html>`;

export default function CoffeeMarketIndex() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [date, setDate] = useState(today());
  const [arabica, setArabica] = useState('');
  const [conilon, setConilon] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);           // form "Lançar"
  const [showInternal, setShowInternal] = useState(false); // bloco "Registro interno"
  const frameRef = useRef<HTMLIFrameElement>(null);

  function fitFrame() {
    try {
      const f = frameRef.current;
      const h = f?.contentWindow?.document.body?.scrollHeight;
      if (f && h) f.style.height = (h + 12) + 'px';
    } catch { /* cross-origin: ignora, mantém altura padrão */ }
  }

  async function autoUpdate() {
    setAutoBusy(true); setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cepea-cafe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: '{}',
      });
      const r = await res.json();
      if (r.ok) { await load(); setMsg(`Registro interno atualizado (${fmtDate(r.ref_date)}).`); }
      else setMsg('Não consegui atualizar agora: ' + (r.message || r.error || 'fonte indisponível') + '.');
    } catch (e) { setMsg('Erro: ' + (e instanceof Error ? e.message : String(e))); }
    setAutoBusy(false);
  }

  async function load() {
    const { data } = await supabase.from('coffee_market_index').select('id,ref_date,arabica,conilon,arabica_var,conilon_var').order('ref_date', { ascending: false }).limit(30);
    setRows((data as Entry[]) || []);
  }
  useEffect(() => { load(); }, []);

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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] flex items-center justify-center"><Coffee className="w-4 h-4" style={{ color: BRAND }} /></span>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight">Mercado do Café Cru</h3>
            <p className="text-[11px] text-gray-500">Indicador oficial CEPEA/ESALQ · R$/saca 60kg · atualiza sozinho</p>
          </div>
        </div>
        <a href="https://www.cepea.org.br/br/indicador/cafe.aspx" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">CEPEA <ExternalLink className="w-3.5 h-3.5" /></a>
      </div>

      {/* Widget oficial do CEPEA (iframe isolado) */}
      <iframe
        ref={frameRef}
        title="Cotações CEPEA – Café Arábica e Conilon"
        srcDoc={WIDGET_DOC}
        onLoad={() => { fitFrame(); setTimeout(fitFrame, 800); setTimeout(fitFrame, 2500); }}
        className="w-full border-0"
        style={{ height: 460 }}
        sandbox="allow-scripts allow-same-origin"
      />
      <p className="text-[10px] text-gray-400 mt-1">Fonte: CEPEA/ESALQ–USP (uso não comercial, CC BY-NC). Arábica e Conilon/Robusta, R$/saca 60kg.</p>

      {/* Registro interno (nossa série no banco — para automação de reajuste no futuro) */}
      <div className="mt-3 border-t border-gray-100 pt-2">
        <button onClick={() => setShowInternal(v => !v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
          {showInternal ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Registro interno {rows.length ? `(${rows.length} dia${rows.length > 1 ? 's' : ''})` : ''}
        </button>

        {showInternal && (
          <div className="mt-2">
            <p className="text-[11px] text-gray-500 mb-2">Nossa cópia da série no banco (para usar em automações de reajuste). Atualiza sozinha pelo cron; aqui você pode forçar ou lançar manual.</p>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={autoUpdate} disabled={autoBusy} className="inline-flex items-center gap-1 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg">{autoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar</button>
              <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 text-white text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: BRAND }}><Plus className="w-3.5 h-3.5" /> Lançar</button>
            </div>

            {open && (
              <div className="mb-2 rounded-lg bg-[#f8f7f5] border border-gray-100 p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div><label className="block text-[11px] text-gray-500">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                  <div><label className="block text-[11px] text-gray-500">Arábica</label><input value={arabica} onChange={e => setArabica(e.target.value)} placeholder="ex.: 1495,05" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                  <div><label className="block text-[11px] text-gray-500">Conilon</label><input value={conilon} onChange={e => setConilon(e.target.value)} placeholder="ex.: 1018,24" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" /></div>
                  <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</button>
                </div>
              </div>
            )}
            {msg && <p className="text-xs text-gray-600 mb-2">{msg}</p>}

            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-left">
                      <th className="font-medium py-1 pr-2">Data</th>
                      <th className="font-medium py-1 pr-2 text-right">Arábica</th>
                      <th className="font-medium py-1 pr-2 text-right">var/dia</th>
                      <th className="font-medium py-1 pr-2 text-right">Conilon</th>
                      <th className="font-medium py-1 text-right">var/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 15).map(r => (
                      <tr key={r.id} className="border-t border-gray-100">
                        <td className="py-1 pr-2 text-gray-600">{fmtDate(r.ref_date)}</td>
                        <td className="py-1 pr-2 text-right font-medium text-gray-900">{brl(r.arabica)}</td>
                        <td className={`py-1 pr-2 text-right ${(r.arabica_var ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct(r.arabica_var)}</td>
                        <td className="py-1 pr-2 text-right font-medium text-gray-900">{brl(r.conilon)}</td>
                        <td className={`py-1 text-right ${(r.conilon_var ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct(r.conilon_var)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
