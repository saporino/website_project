import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';

interface Payout {
  id: string;
  representative_id: string;
  amount: number;
  payment_method: string;
  cycle_start: string | null;
  cycle_end: string | null;
  scheduled_payment_date: string | null;
  status: string;
  rep_name?: string;
}

interface Props { representativeId?: string | null; refreshKey?: number; }

export default function RepCoPayoutBlocks({ representativeId, refreshKey = 0 }: Props) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => { fetchPayouts(); }, [representativeId, refreshKey]);

  async function fetchPayouts() {
    setLoading(true);
    let q = supabase
      .from('representative_commission_payouts')
      .select('id,representative_id,amount,payment_method,cycle_start,cycle_end,scheduled_payment_date,status,representatives(full_name)')
      .eq('status', 'scheduled')
      .order('scheduled_payment_date', { ascending: true });
    if (representativeId) q = q.eq('representative_id', representativeId);
    const { data } = await q;
    setPayouts(((data as any[]) || []).map(p => ({ ...p, rep_name: p.representatives?.full_name || '–' })));
    setLoading(false);
  }

  const groups: any[] = Object.values(payouts.reduce((acc, p) => {
    const key = [p.representative_id, p.payment_method, p.cycle_start, p.cycle_end].join('|');
    if (!acc[key]) acc[key] = {
      key, items: [] as Payout[], total: 0,
      representative_id: p.representative_id, rep_name: p.rep_name,
      payment_method: p.payment_method, cycle_start: p.cycle_start,
      cycle_end: p.cycle_end, scheduled_payment_date: p.scheduled_payment_date,
    };
    acc[key].items.push(p);
    acc[key].total += Number(p.amount) || 0;
    return acc;
  }, {} as Record<string, any>));

  function startPay(key: string) {
    pendingKey.current = key;
    fileRef.current?.click();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = pendingKey.current;
    e.target.value = '';
    if (!file || !key) return;
    const g = groups.find(x => x.key === key);
    if (!g) return;
    setPaying(key);
    try {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = 'commissions/blocks/' + safe + '-' + Date.now() + '.' + ext;
      const { error: upErr } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
      if (upErr) { setPaying(null); pendingKey.current = null; return; }
      const { data: url } = supabase.storage.from('invoices').getPublicUrl(path);
      let upd = supabase.from('representative_commission_payouts')
        .update({ status: 'paid', paid_at: new Date().toISOString(), proof_url: url.publicUrl, proof_filename: file.name })
        .eq('representative_id', g.representative_id)
        .eq('payment_method', g.payment_method)
        .eq('status', 'scheduled');
      upd = g.cycle_start ? upd.eq('cycle_start', g.cycle_start) : upd.is('cycle_start', null);
      upd = g.cycle_end ? upd.eq('cycle_end', g.cycle_end) : upd.is('cycle_end', null);
      await upd;
      window.dispatchEvent(new CustomEvent('admin:repco-updated'));
      await fetchPayouts();
    } finally {
      setPaying(null);
      pendingKey.current = null;
    }
  }

  const fmt = (n: number) => 'R$ ' + (Number(n) || 0).toFixed(2);
  const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '–';

  return (
    <div className="mb-6">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
      <h3 className="text-sm font-bold text-gray-900 mb-2">Blocos a pagar (comissões agendadas)</h3>
      {loading ? (
        <p className="text-xs text-gray-400">Carregando…</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum bloco agendado no momento.</p>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.key} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{g.rep_name} · {g.payment_method === 'boleto' ? 'Boleto' : 'À vista/PIX'}</p>
                <p className="text-xs text-gray-500">Ciclo {fmtDate(g.cycle_start)}–{fmtDate(g.cycle_end)} · paga em {fmtDate(g.scheduled_payment_date)} · {g.items.length} comissão(ões)</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-[#a4240e]">{fmt(g.total)}</span>
                <button onClick={() => startPay(g.key)} disabled={paying === g.key}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50">
                  {paying === g.key ? 'Pagando…' : 'Pagar bloco'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
