import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, Clock, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';

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

interface Props {
  orderId: string;
  onChanged?: () => void;
}

export default function OrderInstallmentsPanel({ orderId, onChanged }: Props) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editDue, setEditDue] = useState<Record<string, string>>({});

  useEffect(() => { fetchInstallments(); }, [orderId]);

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

  async function saveDueDate(instId: string, date: string) {
    await supabase
      .from('representative_order_installments')
      .update({ due_date: date })
      .eq('id', instId);
    setEditDue(prev => { const n = { ...prev }; delete n[instId]; return n; });
    fetchInstallments();
    onChanged?.();
  }

  function openFilePicker(instId: string, kind: 'boleto' | 'proof') {
    setUploading(`${instId}:${kind}`);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'boleto'
      ? 'application/pdf,.pdf'
      : 'application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png';
    input.style.display = 'none';

    const cleanup = () => {
      window.removeEventListener('focus', focusHandler);
      try { input.remove(); } catch {}
    };
    const focusHandler = () => {
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          setUploading(null);
          cleanup();
        }
      }, 500);
    };
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) { setUploading(null); return; }
      await uploadFile(instId, kind, file);
    });
    document.body.appendChild(input);
    window.addEventListener('focus', focusHandler, { once: true });
    input.click();
  }

  async function uploadFile(instId: string, kind: 'boleto' | 'proof', file: File) {
    const inst = installments.find(i => i.id === instId);
    if (!inst) { setUploading(null); return; }
    const ext = file.name.split('.').pop();
    const path = `${kind}/${orderId}/${instId}-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(path, file, { upsert: true });
    if (error || !data) {
      toast.error(`Erro ao enviar ${kind === 'boleto' ? 'boleto' : 'comprovante'}: ${error?.message}`);
      setUploading(null);
      return;
    }
    const storagePath = data.path || path;
    const updates: Partial<Installment> =
      kind === 'boleto'
        ? { boleto_url: storagePath, boleto_filename: file.name }
        : { proof_url: storagePath, proof_filename: file.name, status: 'paid', paid_at: new Date().toISOString() };
    const { error: updateError } = await supabase
      .from('representative_order_installments')
      .update(updates)
      .eq('id', instId);
    if (updateError) {
      toast.error(`Erro ao atualizar parcela: ${updateError.message}`);
    } else {
      toast.success(kind === 'boleto' ? 'Boleto anexado' : 'Comprovante anexado — parcela marcada como paga');
    }
    setUploading(null);
    fetchInstallments();
    onChanged?.();
  }

  async function openStoredFile(storagePath: string) {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) { toast.error('Erro ao abrir arquivo'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  if (loading) return (
    <div className="space-y-1 py-1">
      {[1, 2].map(i => (
        <div key={i} className="animate-pulse h-10 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );

  if (installments.length === 0) return (
    <p className="text-xs text-gray-400 py-1">Nenhuma parcela registrada</p>
  );

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">
        Parcelas ({installments.length})
      </p>
      {installments.map(inst => {
        const isPaid = inst.status === 'paid';
        const bKey = `${inst.id}:boleto`;
        const pKey = `${inst.id}:proof`;
        const dueValue = editDue[inst.id] ?? (inst.due_date || '');
        return (
          <div
            key={inst.id}
            className={`rounded-lg border p-3 space-y-2 ${
              isPaid ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isPaid
                  ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  : <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
                <span className="text-xs font-semibold text-gray-800">
                  Parcela {inst.installment_number} &mdash; {fmt(inst.amount)}
                </span>
                {isPaid && (
                  <span className="text-xs text-green-700 font-medium">
                    Pago {inst.paid_at ? new Date(inst.paid_at).toLocaleDateString('pt-BR') : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Data de vencimento */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 flex-shrink-0">Vencimento:</label>
              <input
                type="date"
                value={dueValue}
                onChange={e => setEditDue(prev => ({ ...prev, [inst.id]: e.target.value }))}
                onBlur={e => { if (e.target.value && e.target.value !== inst.due_date) saveDueDate(inst.id, e.target.value); }}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#a4240e]"
              />
            </div>

            {/* Boleto */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Boleto:</span>
              {inst.boleto_url ? (
                <>
                  <button
                    onClick={() => openStoredFile(inst.boleto_url!)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Eye className="w-3 h-3" /> {inst.boleto_filename || 'Ver'}
                  </button>
                  <button
                    onClick={() => openFilePicker(inst.id, 'boleto')}
                    disabled={uploading === bKey}
                    className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                  >
                    {uploading === bKey ? 'Enviando...' : 'Substituir'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => openFilePicker(inst.id, 'boleto')}
                  disabled={uploading === bKey}
                  className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />
                  {uploading === bKey ? 'Enviando...' : '+ Boleto'}
                </button>
              )}
            </div>

            {/* Comprovante */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Comprovante:</span>
              {inst.proof_url ? (
                <>
                  <button
                    onClick={() => openStoredFile(inst.proof_url!)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                  >
                    <Eye className="w-3 h-3" /> {inst.proof_filename || 'Ver'}
                  </button>
                  <button
                    onClick={() => openFilePicker(inst.id, 'proof')}
                    disabled={uploading === pKey}
                    className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                  >
                    {uploading === pKey ? 'Enviando...' : 'Substituir'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => openFilePicker(inst.id, 'proof')}
                  disabled={uploading === pKey}
                  className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />
                  {uploading === pKey ? 'Enviando...' : '+ Comprovante'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
