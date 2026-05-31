import { useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, CheckCircle, Clock, Hourglass } from 'lucide-react';

interface Payout {
  id: string;
  amount: number;
  payment_method: string | null;
  scheduled_payment_date: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  status: string;
  paid_at: string | null;
  proof_url: string | null;
  proof_filename: string | null;
  representative_commissions: {
    total_rate: number | null;
    base_rate: number | null;
    pix_bonus: number | null;
    delivery_bonus: number | null;
    representative_orders: {
      order_number: string | null;
      description: string | null;
      representative_clients: { razao_social: string } | null;
    } | null;
  } | null;
}

interface BoletoComm {
  id: string;
  commission_amount: number;
  total_rate: number | null;
  representative_orders: {
    order_number: string | null;
    representative_clients: { razao_social: string } | null;
  } | null;
  representative_commission_payouts: { amount: number }[];
}

interface Props { repId: string; }

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : 'A definir';

type Tab = 'avista' | 'aprazo' | 'pagas';

export function RepCoCommissions({ repId }: Props) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [boletoComms, setBoletoComms] = useState<BoletoComm[]>([]);
  const [tab, setTab] = useState<Tab>('avista');
  const [loading, setLoading] = useState(true);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: po } = await supabase
        .from('representative_commission_payouts')
        .select('id, amount, payment_method, scheduled_payment_date, cycle_start, cycle_end, status, paid_at, proof_url, proof_filename, representative_commissions ( total_rate, base_rate, pix_bonus, delivery_bonus, representative_orders ( order_number, description, representative_clients ( razao_social ) ) )')
        .eq('representative_id', repId)
        .order('scheduled_payment_date', { ascending: false });

      const { data: bc } = await supabase
        .from('representative_commissions')
        .select('id, commission_amount, total_rate, representative_orders ( order_number, representative_clients ( razao_social ) ), representative_commission_payouts ( amount )')
        .eq('representative_id', repId)
        .eq('payment_method', 'boleto')
        .order('created_at', { ascending: false });

      if (!active) return;
      setPayouts((po as unknown as Payout[]) || []);
      setBoletoComms((bc as unknown as BoletoComm[]) || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [repId]);

  useEffect(() => {
    payouts
      .filter(p => p.status === 'paid' && p.proof_url && !proofUrls[p.id])
      .forEach(async (p) => {
        const { data } = await supabase.storage.from('invoices').createSignedUrl(p.proof_url as string, 3600);
        if (data?.signedUrl) setProofUrls(prev => ({ ...prev, [p.id]: data.signedUrl }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payouts]);

  const orderOf = (p: Payout) => p.representative_commissions?.representative_orders;
  const clientOf = (p: Payout) => orderOf(p)?.representative_clients?.razao_social || 'Cliente';

  const avista = payouts.filter(p => p.payment_method === 'pix' && p.status === 'scheduled');
  const aprazoScheduled = payouts.filter(p => p.payment_method === 'boleto' && p.status === 'scheduled');
  const paid = payouts.filter(p => p.status === 'paid');

  const boletoPending = boletoComms
    .map(c => {
      const released = (c.representative_commission_payouts || []).reduce((s, x) => s + (x.amount || 0), 0);
      return { ...c, remaining: (c.commission_amount || 0) - released };
    })
    .filter(c => c.remaining > 0.009);

  const totalReceber = [...avista, ...aprazoScheduled].reduce((s, p) => s + p.amount, 0);
  const totalAguardando = boletoPending.reduce((s, c) => s + c.remaining, 0);
  const totalRecebido = paid.reduce((s, p) => s + p.amount, 0);

  function groupByDate(list: Payout[]): [string, Payout[]][] {
    const map = new Map<string, Payout[]>();
    list.forEach(p => {
      const k = p.scheduled_payment_date || 'A definir';
      map.set(k, [...(map.get(k) || []), p]);
    });
    return Array.from(map.entries());
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'avista', label: 'À Vista (PIX)' },
    { key: 'aprazo', label: 'A Prazo (Boleto)' },
    { key: 'pagas', label: 'Pagas' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Comissões</h2>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-700">A receber</span></div>
          <p className="text-2xl font-bold text-amber-700">{fmt(totalReceber)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Hourglass className="w-4 h-4 text-gray-500" /><span className="text-sm font-medium text-gray-600">Aguardando cliente</span></div>
          <p className="text-2xl font-bold text-gray-700">{fmt(totalAguardando)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Recebido</span></div>
          <p className="text-2xl font-bold text-green-700">{fmt(totalRecebido)}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold w-fit">
        {tabs.map((t, idx) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 border-r border-gray-200 last:border-0 transition-all ${idx === 0 ? 'rounded-l-xl' : idx === tabs.length - 1 ? 'rounded-r-xl' : ''} ${tab === t.key ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#a4240e]" /></div>
      ) : (
        <>
          {tab === 'avista' && (
            avista.length === 0
              ? <Empty text="Nenhuma comissão à vista pendente" />
              : <div className="space-y-5">
                  {groupByDate(avista).map(([date, list]) => (
                    <Block key={date} title={`Cai em ${fmtDate(date)}`} total={list.reduce((s, p) => s + p.amount, 0)}>
                      {list.map(p => <Row key={p.id} order={orderOf(p)?.order_number} client={clientOf(p)} rate={p.representative_commissions?.total_rate} amount={p.amount} />)}
                    </Block>
                  ))}
                </div>
          )}

          {tab === 'aprazo' && (
            (aprazoScheduled.length === 0 && boletoPending.length === 0)
              ? <Empty text="Nenhuma comissão a prazo" />
              : <div className="space-y-6">
                  {boletoPending.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aguardando o cliente pagar</p>
                      {boletoPending.map(c => (
                        <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{c.representative_orders?.order_number || '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{c.representative_orders?.representative_clients?.razao_social || 'Cliente'}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="font-bold text-gray-700">{fmt(c.remaining)}</p>
                            <p className="text-xs text-gray-400">libera quando o boleto for pago</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {aprazoScheduled.length > 0 && (
                    <div className="space-y-5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmado — a receber</p>
                      {groupByDate(aprazoScheduled).map(([date, list]) => (
                        <Block key={date} title={`Cai em ${fmtDate(date)}`} total={list.reduce((s, p) => s + p.amount, 0)}>
                          {list.map(p => <Row key={p.id} order={orderOf(p)?.order_number} client={clientOf(p)} rate={p.representative_commissions?.total_rate} amount={p.amount} />)}
                        </Block>
                      ))}
                    </div>
                  )}
                </div>
          )}

          {tab === 'pagas' && (
            paid.length === 0
              ? <Empty text="Nenhuma comissão recebida ainda" />
              : <div className="space-y-5">
                  {groupByDate(paid).map(([date, list]) => {
                    const proofItem = list.find(p => p.proof_url);
                    const proofSrc = proofItem ? proofUrls[proofItem.id] : undefined;
                    const paidOn = list[0].paid_at ? list[0].paid_at.slice(0, 10) : date;
                    return (
                      <Block key={date} title={`Pago em ${fmtDate(paidOn)}`} total={list.reduce((s, p) => s + p.amount, 0)} green>
                        {list.map(p => <Row key={p.id} order={orderOf(p)?.order_number} client={clientOf(p)} rate={p.representative_commissions?.total_rate} amount={p.amount} />)}
                        {proofItem && (
                          <div className="mt-3 pt-3 border-t border-green-100">
                            <p className="text-xs font-medium text-green-700 mb-2">Comprovante do pagamento</p>
                            {proofSrc
                              ? <a href={proofSrc} target="_blank" rel="noopener noreferrer"><img src={proofSrc} alt="Comprovante do pagamento" className="max-h-48 rounded-lg border border-gray-200" /></a>
                              : <p className="text-xs text-gray-400">{proofItem.proof_filename || 'Carregando comprovante…'}</p>}
                          </div>
                        )}
                      </Block>
                    );
                  })}
                </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p>{text}</p>
    </div>
  );
}

function Block({ title, total, green, children }: { title: string; total: number; green?: boolean; children: ReactNode }) {
  return (
    <div className={`border rounded-xl overflow-hidden ${green ? 'border-green-200' : 'border-gray-200'}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${green ? 'bg-green-50' : 'bg-gray-50'}`}>
        <span className={`text-sm font-semibold ${green ? 'text-green-700' : 'text-gray-700'}`}>{title}</span>
        <span className={`text-sm font-bold ${green ? 'text-green-700' : 'text-gray-900'}`}>{fmt(total)}</span>
      </div>
      <div className="bg-white p-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({ order, client, rate, amount }: { order?: string | null; client: string; rate?: number | null; amount: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{order || '—'} <span className="text-gray-400 font-normal">· {client}</span></p>
        {rate != null && <p className="text-xs text-gray-400">Taxa {rate}%</p>}
      </div>
      <p className="font-semibold text-gray-900 flex-shrink-0 ml-3">{fmt(amount)}</p>
    </div>
  );
}
