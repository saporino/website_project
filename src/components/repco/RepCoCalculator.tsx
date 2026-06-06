import { useState, useMemo, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalcState } from '../../lib/training';

// Calculadora de Preço RepCo — markup/margem/custo/venda + simulação de lucro do cliente
// + desconto conjunto (Saporino + Cliente) para competir no mercado.

type Field = 'markup' | 'margem' | 'custo' | 'venda';

const FIELD_LABEL: Record<Field, string> = {
  markup: 'Markup %', margem: 'Margem %', custo: 'Preço de Custo', venda: 'Preço de Venda',
};

const fmt = (v: number | null | undefined) =>
  v != null && isFinite(v) ? v.toFixed(2).replace('.', ',') : '';

function parse(raw: string): number | null {
  const r = (raw || '').trim();
  if (!r || r === '-' || r.endsWith(',') || r.endsWith('.')) return null;
  const n = parseFloat(r.replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}
const pctVal = (raw: string) => { const n = parse(raw); return n != null ? n : 0; };

export default function RepCoCalculator({ syncState, onStateChange, readOnly = false }: {
  syncState?: CalcState | null;   // recebe estado do instrutor (treinamento)
  onStateChange?: (s: CalcState) => void; // emite estado (instrutor → broadcast)
  readOnly?: boolean;             // mirror só-leitura
} = {}) {
  const [raw, setRaw] = useState<Record<Field, string>>({ markup: '', margem: '', custo: '', venda: '' });
  const [order, setOrder] = useState<Field[]>([]); // ordem digitada — 2 últimos = ativos
  const [desc, setDesc] = useState('');
  const [imp, setImp] = useState('');
  const [splitRep, setSplitRep] = useState('');
  const [splitCli, setSplitCli] = useState('');

  // Aplica estado recebido do instrutor (treinamento ao vivo)
  const lastSync = useRef('');
  useEffect(() => {
    if (!syncState) return;
    const key = JSON.stringify(syncState);
    if (key === lastSync.current) return;
    lastSync.current = key;
    setRaw(syncState.raw);
    setOrder(syncState.order as Field[]);
    setDesc(syncState.desc); setImp(syncState.imp);
    setSplitRep(syncState.splitRep); setSplitCli(syncState.splitCli);
  }, [syncState]);

  // Emite estado quando muda (instrutor → broadcast). Não emite em modo mirror.
  useEffect(() => {
    if (readOnly || !onStateChange) return;
    onStateChange({ raw, order, desc, imp, splitRep, splitCli });
  }, [raw, order, desc, imp, splitRep, splitCli, readOnly]);

  const active = order.slice(-2);

  // Calcula os 4 campos a partir dos 2 ativos
  const c = useMemo(() => {
    let mk = active.includes('markup') ? parse(raw.markup) : null;
    let mg = active.includes('margem') ? parse(raw.margem) : null;
    let cp = active.includes('custo') ? parse(raw.custo) : null;
    let sp = active.includes('venda') ? parse(raw.venda) : null;
    const have = [mk, mg, cp, sp].filter(x => x != null).length;
    if (have >= 2) {
      if (cp != null && mk != null && sp == null) sp = cp * (1 + mk / 100);
      else if (cp != null && mg != null && sp == null && mg < 100) sp = cp / (1 - mg / 100);
      else if (sp != null && mk != null && cp == null) cp = sp / (1 + mk / 100);
      else if (sp != null && mg != null && cp == null) cp = sp * (1 - mg / 100);
      else if (cp != null && sp != null) { mk = (sp - cp) / cp * 100; mg = (sp - cp) / sp * 100; }
      if (cp != null && sp != null) {
        if (mk == null) mk = (sp - cp) / cp * 100;
        if (mg == null) mg = (sp - cp) / sp * 100;
      }
    }
    return { mk, mg, cp, sp };
  }, [raw, active.join(',')]);

  function onType(field: Field, value: string) {
    setRaw(r => ({ ...r, [field]: value }));
    setOrder(o => {
      if (value.trim() === '') return o.filter(f => f !== field);
      const next = [...o.filter(f => f !== field), field];
      if (next.length > 2) {
        const evict = next[0];
        setRaw(r => ({ ...r, [evict]: '' }));
        return next.slice(1);
      }
      return next;
    });
  }

  function clearAll() {
    setRaw({ markup: '', margem: '', custo: '', venda: '' });
    setOrder([]); setDesc(''); setImp(''); setSplitRep(''); setSplitCli('');
  }

  const displayVal = (field: Field, computed: number | null) =>
    active.includes(field) ? raw[field] : fmt(computed);
  const isCalc = (field: Field) => !active.includes(field) && c.cp != null && c.sp != null;

  const ready = c.cp != null && c.sp != null;
  const cp = c.cp ?? 0, sp = c.sp ?? 0;

  // ── Simulação de lucratividade do cliente ──
  const descN = pctVal(desc), impN = pctVal(imp);
  const custoEfetivo = cp * (1 - descN / 100) * (1 + impN / 100);
  const descValor = cp - cp * (1 - descN / 100);
  const impValor = cp * (1 - descN / 100) * (impN / 100);
  const lucroAntes = sp - cp, margemAntes = sp > 0 ? lucroAntes / sp * 100 : 0, markupAntes = cp > 0 ? lucroAntes / cp * 100 : 0;
  const lucroDepois = sp - custoEfetivo, margemDepois = sp > 0 ? lucroDepois / sp * 100 : 0, markupDepois = custoEfetivo > 0 ? lucroDepois / custoEfetivo * 100 : 0;
  const corDepois = lucroDepois >= lucroAntes ? '#16a34a' : '#dc2626';

  // ── Desconto conjunto ──
  const splitRepN = pctVal(splitRep), splitCliN = pctVal(splitCli);
  const novaShelf = sp - splitRepN - splitCliN;
  const totalDesc = splitRepN + splitCliN;
  const saporinoRecebe = custoEfetivo - splitRepN;
  const novoCustoCliente = custoEfetivo - splitRepN;
  const novoLucroCliente = novaShelf - novoCustoCliente;
  const novaMargemCliente = novaShelf > 0 ? novoLucroCliente / novaShelf * 100 : 0;
  const showSplit = ready && (splitRepN > 0 || splitCliN > 0);

  // Estilos reutilizáveis
  const fieldBox = 'relative';
  const inputCls = (field: Field) =>
    `w-full pt-7 pb-2.5 px-3 rounded-xl border text-xl font-bold outline-none transition-all ${
      isCalc(field) ? 'bg-[#f9f6f5] text-gray-500 border-[#ddd0cc]' : 'bg-white text-gray-900 border-[#ddd0cc] focus:border-[#8B2214] focus:ring-2 focus:ring-[#8B2214]/10'
    }`;
  const labelCls = 'absolute top-1.5 left-3 text-[10px] font-semibold text-[#8B2214] uppercase tracking-wide pointer-events-none';

  return (
    <div className="max-w-md mx-auto space-y-3">
      {/* Markup / Margem */}
      <div className="grid grid-cols-2 gap-2.5">
        {(['markup', 'margem'] as Field[]).map(f => (
          <div className={fieldBox} key={f}>
            <label className={labelCls}>{FIELD_LABEL[f]}</label>
            <input inputMode="decimal" placeholder="0,00" className={inputCls(f)} readOnly={readOnly}
              value={displayVal(f, f === 'markup' ? c.mk : c.mg)}
              onChange={e => onType(f, e.target.value)}
              onDoubleClick={() => !readOnly && onType(f, '')} />
          </div>
        ))}
      </div>

      {/* Custo / Venda */}
      {(['custo', 'venda'] as Field[]).map(f => (
        <div className={fieldBox} key={f}>
          <label className={labelCls}>{FIELD_LABEL[f]}</label>
          <input inputMode="decimal" placeholder="0,00" className={inputCls(f)} readOnly={readOnly}
            value={displayVal(f, f === 'custo' ? c.cp : c.sp)}
            onChange={e => onType(f, e.target.value)}
            onDoubleClick={() => !readOnly && onType(f, '')} />
        </div>
      ))}

      {/* Hint */}
      <p className="text-center text-[11px] text-gray-500 min-h-[16px]">
        {active.length >= 2
          ? <>✏️ Entrada: <strong className="text-[#8B2214]">{active.map(f => FIELD_LABEL[f]).join(' + ')}</strong></>
          : active.length === 1
            ? <>✏️ {FIELD_LABEL[active[0]]} — digite mais 1 campo</>
            : 'Digite valores em 2 campos para calcular'}
      </p>

      {ready && (
        <>
          {/* Simulação de Lucratividade do Cliente */}
          <div className="rounded-xl border border-[#e8e0de] bg-white p-3.5">
            <h4 className="text-[11px] font-bold text-[#8B2214] uppercase tracking-wide mb-2">Simulação de Lucratividade do Cliente</h4>
            <p className="text-[11px] text-gray-500 mb-3 leading-snug">
              O <strong>Preço de Venda</strong> (prateleira) permanece fixo.<br/>
              Desconto reduz o custo → lucro <span className="text-green-600">sobe ↑</span> · Imposto aumenta o custo → lucro <span className="text-red-600">cai ↓</span>
            </p>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 flex-1">🏷️ Desconto concedido ao cliente</span>
              <div className="flex items-center border border-[#ddd0cc] rounded-lg px-2.5 py-1.5 gap-1 w-[90px] focus-within:border-[#8B2214]">
                <input inputMode="decimal" readOnly={readOnly} value={desc} onChange={e => setDesc(e.target.value)} placeholder="0" className="w-full text-sm font-bold text-right outline-none bg-transparent" />
                <span className="text-xs text-gray-400 font-semibold">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 flex-1">🧾 Imposto do cliente (ICMS etc.)</span>
              <div className="flex items-center border border-[#ddd0cc] rounded-lg px-2.5 py-1.5 gap-1 w-[90px] focus-within:border-[#8B2214]">
                <input inputMode="decimal" readOnly={readOnly} value={imp} onChange={e => setImp(e.target.value)} placeholder="0" className="w-full text-sm font-bold text-right outline-none bg-transparent" />
                <span className="text-xs text-gray-400 font-semibold">%</span>
              </div>
            </div>

            {/* Detalhamento custo efetivo */}
            <div className="mt-3 rounded-lg bg-[#f9f6f5] p-2.5 text-xs">
              <div className="flex justify-between mb-1"><span className="text-gray-500">Custo original do cliente</span><span className="font-semibold text-gray-600">R$ {fmt(cp)}</span></div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">– Desconto aplicado</span><span className="font-semibold text-green-600">{descN > 0 ? '– R$ ' + fmt(descValor) : '—'}</span></div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">+ Imposto do cliente</span><span className="font-semibold text-red-600">{impN > 0 ? '+ R$ ' + fmt(impValor) : '—'}</span></div>
              <div className="h-px bg-[#ddd0cc] my-1.5" />
              <div className="flex justify-between"><span className="font-bold text-gray-700">Custo efetivo do cliente</span><span className="font-bold text-[#8B2214]">R$ {fmt(custoEfetivo)}</span></div>
            </div>

            {/* Comparativo */}
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <div className="rounded-lg bg-gray-100 border border-gray-200 p-2.5">
                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1.5">Sem ajuste</p>
                <Row k="Lucro/un." v={'R$ ' + fmt(lucroAntes)} big />
                <Row k="Margem" v={fmt(margemAntes) + ' %'} />
                <Row k="Markup" v={fmt(markupAntes) + ' %'} />
              </div>
              <div className="rounded-lg bg-[#f0faf4] border border-[#c6e8d4] p-2.5">
                <p className="text-[10px] font-bold text-green-600 uppercase mb-1.5">Com ajuste</p>
                <Row k="Lucro/un." v={'R$ ' + fmt(lucroDepois)} big color={corDepois} />
                <Row k="Margem" v={fmt(margemDepois) + ' %'} color={corDepois} />
                <Row k="Markup" v={fmt(markupDepois) + ' %'} color={corDepois} />
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 px-2.5 py-2 bg-white border border-[#e8e0de] rounded-lg">
              <span className="text-[11px] text-gray-500">🏪 Preço de prateleira (não muda)</span>
              <span className="text-sm font-bold text-gray-900">R$ {fmt(sp)}</span>
            </div>
          </div>

          {/* Desconto Conjunto */}
          <div className="rounded-xl border border-[#e8e0de] bg-white p-3.5">
            <h4 className="text-[11px] font-bold text-gray-900 uppercase tracking-wide mb-1">🤝 Desconto Conjunto — Competir no Mercado</h4>
            <p className="text-[11px] text-gray-500 mb-3 leading-snug">
              Cada parte cede R$ para baixar a prateleira e chegar no preço da concorrência. <strong>Zero = não participa.</strong>
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 flex-1">☕ Desconto da Saporino (R$)</span>
              <div className="flex items-center border border-[#ddd0cc] rounded-lg px-2.5 py-1.5 gap-1 w-[100px] focus-within:border-[#8B2214]">
                <span className="text-xs text-gray-400 font-semibold">R$</span>
                <input inputMode="decimal" readOnly={readOnly} value={splitRep} onChange={e => setSplitRep(e.target.value)} placeholder="0,00" className="w-full text-sm font-bold text-right outline-none bg-transparent" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 flex-1">🏪 Desconto do Cliente (R$)</span>
              <div className="flex items-center border border-[#ddd0cc] rounded-lg px-2.5 py-1.5 gap-1 w-[100px] focus-within:border-[#8B2214]">
                <span className="text-xs text-gray-400 font-semibold">R$</span>
                <input inputMode="decimal" readOnly={readOnly} value={splitCli} onChange={e => setSplitCli(e.target.value)} placeholder="0,00" className="w-full text-sm font-bold text-right outline-none bg-transparent" />
              </div>
            </div>

            {showSplit && (
              <div className="mt-3">
                <div className="rounded-lg p-3 mb-2.5 flex justify-between items-center" style={{ background: 'linear-gradient(135deg,#8B2214,#6d1a10)' }}>
                  <div>
                    <p className="text-[10px] text-white/70 font-semibold uppercase">Novo Preço de Prateleira</p>
                    <p className="text-[11px] text-white/60">↓ R$ {fmt(totalDesc)} de desconto total</p>
                  </div>
                  <span className="text-2xl font-extrabold text-white">R$ {fmt(novaShelf)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="rounded-lg bg-[#fff8f7] border border-[#f0d8d5] p-2.5">
                    <p className="text-[10px] font-bold text-[#8B2214] uppercase mb-2">☕ Saporino</p>
                    <Row k={(descN > 0 || impN > 0) ? 'Preço efetivo' : 'Preço de venda'} v={'R$ ' + fmt(custoEfetivo)} />
                    <Row k="Desconto dado" v={splitRepN > 0 ? '– R$ ' + fmt(splitRepN) : '—'} color={splitRepN > 0 ? '#dc2626' : '#aaa'} />
                    <div className="h-px bg-[#f0d8d5] my-1" />
                    <Row k="Recebe por un." v={'R$ ' + fmt(saporinoRecebe)} big color="#8B2214" />
                  </div>
                  <div className="rounded-lg bg-[#f0faf4] border border-[#c6e8d4] p-2.5">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-2">🏪 Cliente</p>
                    <Row k="Cede" v={splitCliN > 0 ? '– R$ ' + fmt(splitCliN) : 'Nada'} color={splitCliN > 0 ? '#16a34a' : '#16a34a'} />
                    <Row k="Novo lucro/un." v={'R$ ' + fmt(novoLucroCliente)} big color={novoLucroCliente >= 0 ? '#16a34a' : '#dc2626'} />
                    <Row k="Nova margem" v={fmt(novaMargemCliente) + ' %'} />
                  </div>
                </div>

                <div className="rounded-lg bg-[#f9f6f5] p-2.5 text-[11px]">
                  <div className="flex justify-between mb-1"><span className="text-gray-500">Prateleira anterior</span><span className="font-semibold text-gray-600">R$ {fmt(sp)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Nova prateleira</span><span className="font-bold text-[#8B2214]">R$ {fmt(novaShelf)}</span></div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {readOnly ? (
        <p className="text-center text-[11px] text-[#8B2214] font-semibold py-2">📡 Acompanhando o instrutor — visualização ao vivo</p>
      ) : (
        <>
          <button onClick={clearAll} className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#ddd0cc] bg-white py-3 text-sm font-semibold text-gray-600 hover:bg-[#f5f0ef] transition-colors">
            <Trash2 className="w-4 h-4" /> Limpar Tudo
          </button>
          <p className="text-center text-[10px] text-gray-400">Toque duplo em qualquer campo para limpá-lo</p>
        </>
      )}
    </div>
  );
}

function Row({ k, v, big, color }: { k: string; v: string; big?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-baseline mb-0.5">
      <span className="text-[10px] text-gray-500">{k}</span>
      <span className={big ? 'text-[13px] font-bold' : 'text-[11px] font-semibold'} style={{ color: color || (big ? '#333' : '#666') }}>{v}</span>
    </div>
  );
}
