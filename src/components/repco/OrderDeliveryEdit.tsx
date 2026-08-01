// Editor inline da Entrega do pedido (responsável + transportadora + frete).
// Editável só enquanto o pedido NÃO foi despachado e NÃO tem NF (invoice_pdf_url).
// O update dispara o guard/auditoria do banco (3.1). Não mexe em produto/pagamento.
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Pencil, Check, X, Lock } from 'lucide-react';

interface Props {
  orderId: string;
  deliveryMode: string | null;
  carrierId: string | null;
  freight: number;
  locked: boolean;      // despachado ou com NF
  lockReason?: string;
  onSaved: () => void;
}
const MODE_LABEL: Record<string, string> = {
  cofico: 'COFICO', transportadora: 'Transportadora', propria: 'Entrega própria', retirada: 'Retirada',
};

export default function OrderDeliveryEdit({ orderId, deliveryMode, carrierId, freight, locked, lockReason, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; name: string; is_own: boolean }[]>([]);
  const [mode, setMode] = useState<string>(deliveryMode || 'cofico');
  const [cid, setCid] = useState<string>(carrierId || '');
  const [fr, setFr] = useState<number>(Number(freight) || 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (editing && carriers.length === 0) {
      supabase.from('shipping_carriers').select('id,name,is_own').eq('is_active', true)
        .order('is_own', { ascending: false }).order('name')
        .then(({ data }) => setCarriers((data as { id: string; name: string; is_own: boolean }[]) || []));
    }
  }, [editing, carriers.length]);

  function cancel() {
    setMode(deliveryMode || 'cofico'); setCid(carrierId || ''); setFr(Number(freight) || 0);
    setErr(''); setEditing(false);
  }

  async function save() {
    setSaving(true); setErr('');
    const resolvedCarrier = mode === 'cofico' ? (carriers.find(c => c.is_own)?.id ?? null)
      : mode === 'transportadora' ? (cid || null) : null;
    const { error } = await supabase.from('representative_orders').update({
      delivery_mode: mode,
      carrier_id: resolvedCarrier,
      freight_amount: mode === 'retirada' ? 0 : (Number(fr) || 0),
    }).eq('id', orderId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(false); onSaved();
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
          <Truck className="w-4 h-4 text-[#8B2214] shrink-0" />
          <span className="truncate">
            Entrega: <span className="font-semibold">{MODE_LABEL[deliveryMode || 'cofico'] || '—'}</span>
            {Number(freight) > 0 && <> · Frete R$ {Number(freight).toLocaleString('pt-BR')}</>}
          </span>
        </div>
        {locked ? (
          <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0"><Lock className="w-3 h-3" /> {lockReason || 'Travado'}</span>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline shrink-0">
            <Pencil className="w-3.5 h-3.5" /> Editar entrega
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-[#8B2214] p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700">Editar entrega</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(Object.keys(MODE_LABEL)).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${mode === m ? 'border-[#8B2214] bg-red-50 text-[#8B2214]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {mode === 'transportadora' && (
          <select value={cid} onChange={e => setCid(e.target.value)} className="h-[34px] px-2 text-sm border border-gray-300 rounded bg-white">
            {carriers.filter(c => !c.is_own).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {mode !== 'retirada' && (
          <input type="number" value={fr} onChange={e => setFr(Math.max(0, parseFloat(e.target.value) || 0))} min="0" step="0.01"
            placeholder="Frete (R$)" className="h-[34px] px-3 text-sm border border-gray-300 rounded" />
        )}
      </div>
      {err && <p className="text-[11px] text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 h-[34px] rounded-lg bg-[#8B2214] text-white text-xs font-semibold hover:bg-[#6d1a10] disabled:opacity-60 flex items-center justify-center gap-1">
          <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button onClick={cancel} disabled={saving} className="h-[34px] px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}
