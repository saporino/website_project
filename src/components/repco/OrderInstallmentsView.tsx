import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, CheckCircle, Clock } from 'lucide-react';

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string | null;
  boleto_url: string | null;
  boleto_filename: string | null;
  proof_url: string | null;
  proof_filename: string | null;
  status: string;
  paid_at: string | null;
}

interface Props { orderId: string; }

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function OrderInstallmentsView({ orderId }: Props) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstallments();
  }, [orderId]);

  async function fetchInstallments() {
    setLoading(true);
    const { data } = await supabase
      .from('representative_order_installments')
      .select('*')
      .eq('order_id', orderId)
      .order('installment_number');
    setInstallments(data || []);
    setLoading(false);
  }

  async function handleDownloadBoleto(inst: Installment) {
    if (!inst.boleto_url) return;
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(inst.boleto_url, 3600);
    if (error || !data?.signedUrl) return;
    triggerDownload(data.signedUrl, inst.boleto_filename || `boleto-parcela-${inst.installment_number}.pdf`);
  }

  if (loading) return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="animate-pulse h-4 bg-gray-100 rounded w-32" />
    </div>
  );

  if (installments.length === 0) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
      <p className="text-xs font-semibold text-gray-600">
        Boletos ({installments.length} parcela{installments.length > 1 ? 's' : ''})
      </p>
      {installments.map(inst => {
        const isPaid = inst.status === 'paid';
        const dueLabel = inst.due_date
          ? new Date(inst.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
          : 'Data a definir';
        return (
          <div
            key={inst.id}
            className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3 ${
              isPaid
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isPaid
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${isPaid ? 'text-green-700' : 'text-gray-800'}`}>
                  Parcela {inst.installment_number} &mdash; {fmt(inst.amount)}
                </p>
                <p className="text-xs text-gray-400">
                  {isPaid
                    ? `Pago em ${inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('pt-BR') : '—'}`
                    : `Vencimento: ${dueLabel}`
                  }
                </p>
                {inst.proof_filename && (
                  <p className="text-xs text-green-600 mt-0.5">\ud83d\udcb3 {inst.proof_filename}</p>
                )}
              </div>
            </div>
            {inst.boleto_url && (
              <button
                onClick={() => handleDownloadBoleto(inst)}
                className="flex items-center gap-1 text-xs font-medium text-[#a4240e] hover:underline flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Boleto
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
