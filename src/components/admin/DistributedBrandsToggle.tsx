import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, Loader2 } from 'lucide-react';

// Liga/desliga a seção "Marcas que Distribuímos" (rodapé da loja). Guardado em site_settings.
const KEY = 'show_distributed_brands';

export default function DistributedBrandsToggle() {
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', KEY).maybeSingle()
      .then(({ data }) => { setOn(!!data?.value); setLoading(false); });
  }, []);

  async function toggle() {
    setSaving(true);
    const next = !on;
    const { error } = await supabase.from('site_settings')
      .upsert({ key: KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (!error) setOn(next);
    setSaving(false);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
          <Store className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Marcas que Distribuímos</h3>
          <p className="text-sm text-gray-500">Seção no rodapé da loja (Café Canaan, etc.)</p>
        </div>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <button type="button" onClick={toggle} disabled={loading || saving} role="switch" aria-checked={on}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-[#8B2214]' : 'bg-gray-300'} disabled:opacity-50`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : on ? 'Aparecendo na loja' : 'Oculta (não aparece na loja)'}
        </span>
      </label>
    </div>
  );
}
