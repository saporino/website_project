import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, Loader2 } from 'lucide-react';

// Trava de segurança: permitir (ou não) excluir clientes RepCo que já têm pedidos.
// value=false (padrão) => PROTEGIDO. value=true => permite excluir (modo teste).
const KEY = 'allow_delete_clients_with_orders';

export default function DeleteLockToggle() {
  const [allow, setAllow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', KEY).maybeSingle()
      .then(({ data }) => { setAllow(!!data?.value); setLoading(false); });
  }, []);

  async function toggle() {
    setSaving(true);
    const next = !allow;
    const { error } = await supabase.from('site_settings')
      .upsert({ key: KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (!error) setAllow(next);
    setSaving(false);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-[#8B2214]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Exclusão de clientes com pedidos</h3>
            <p className="text-sm text-gray-500">Trava de segurança que protege o histórico de vendas</p>
          </div>
        </div>
        <button type="button" onClick={toggle} disabled={loading || saving} role="switch" aria-checked={allow}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${allow ? 'bg-amber-500' : 'bg-gray-300'} disabled:opacity-50`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allow ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : allow ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          ⚠️ <strong>Trava DESLIGADA (modo teste).</strong> É possível excluir clientes mesmo com pedidos — o pedido, comissão e a NF são apagados junto. <strong>Ligue de volta antes de ir para produção</strong> para não apagar histórico real.
        </p>
      ) : (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          🔒 <strong>Trava LIGADA (protegido).</strong> Clientes com pedidos <strong>não</strong> podem ser excluídos — protege o histórico de vendas. Recomendado em produção.
        </p>
      )}
    </div>
  );
}
