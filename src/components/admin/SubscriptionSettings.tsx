import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Repeat, Plus, Trash2, Save, Loader2, Coffee } from 'lucide-react';

interface Tier { months: number; discount_pct: number; }
interface Settings { id: string; accepting_new: boolean; tiers: Tier[]; }
interface ProdRow { id: string; name: string; subscription_enabled: boolean; }

export function SubscriptionSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<ProdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTiers, setSavingTiers] = useState(false);
  const [tiersSaved, setTiersSaved] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('subscription_settings').select('*').maybeSingle(),
      supabase.from('products').select('id, name, subscription_enabled').order('display_order', { ascending: true }),
    ]);
    if (s) setSettings(s as Settings);
    setProducts((p as ProdRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleAccepting = async () => {
    if (!settings) return;
    const v = !settings.accepting_new;
    setSettings({ ...settings, accepting_new: v });
    await supabase.from('subscription_settings').update({ accepting_new: v, updated_at: new Date().toISOString() }).eq('id', settings.id);
  };

  const setTier = (i: number, field: keyof Tier, value: number) => {
    if (!settings) return;
    const tiers = settings.tiers.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
    setSettings({ ...settings, tiers });
  };
  const addTier = () => settings && setSettings({ ...settings, tiers: [...settings.tiers, { months: 1, discount_pct: 0 }] });
  const removeTier = (i: number) => settings && setSettings({ ...settings, tiers: settings.tiers.filter((_, idx) => idx !== i) });

  const saveTiers = async () => {
    if (!settings) return;
    setSavingTiers(true);
    const clean = [...settings.tiers]
      .map(t => ({ months: Math.max(1, Math.round(t.months || 1)), discount_pct: Math.min(100, Math.max(0, Math.round(t.discount_pct || 0))) }))
      .sort((a, b) => a.months - b.months);
    await supabase.from('subscription_settings').update({ tiers: clean, updated_at: new Date().toISOString() }).eq('id', settings.id);
    setSettings({ ...settings, tiers: clean });
    setSavingTiers(false);
    setTiersSaved(true);
    setTimeout(() => setTiersSaved(false), 2500);
  };

  const toggleProduct = async (p: ProdRow) => {
    const v = !p.subscription_enabled;
    setProducts(ps => ps.map(x => x.id === p.id ? { ...x, subscription_enabled: v } : x));
    await supabase.from('products').update({ subscription_enabled: v }).eq('id', p.id);
  };

  if (loading) {
    return <div className="bg-white border border-gray-200 rounded-xl p-6 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>;
  }
  if (!settings) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Repeat className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Assinatura</h3>
          <p className="text-sm text-gray-600">Liga/desliga novas assinaturas, descontos por compromisso e produtos disponíveis.</p>
        </div>
      </div>

      {/* Liga/desliga */}
      <div className="flex items-center justify-between bg-[#faf7f6] border border-[#ddd0cc] rounded-xl p-4 mb-6">
        <div>
          <p className="font-bold text-gray-900">Aceitar novas assinaturas</p>
          <p className="text-sm text-gray-600">
            {settings.accepting_new
              ? 'Ligado — novos clientes podem assinar.'
              : 'Desligado — novos clientes NÃO conseguem assinar. (Quem já é assinante continua normalmente.)'}
          </p>
        </div>
        <button
          onClick={toggleAccepting}
          role="switch"
          aria-checked={settings.accepting_new}
          className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${settings.accepting_new ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.accepting_new ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      {/* Tiers de desconto */}
      <div className="border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-gray-900">Descontos por compromisso</p>
          <button onClick={addTier} className="flex items-center gap-1 text-sm text-[#8B2214] font-semibold hover:underline">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Quanto mais meses o cliente se compromete, maior o desconto. Ex.: 1 mês = 5%, 12 meses = 20%.</p>
        <div className="space-y-2">
          {settings.tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={t.months}
                  onChange={(e) => setTier(i, 'months', parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
                <span className="text-sm text-gray-600">{t.months === 1 ? 'mês' : 'meses'}</span>
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={100} value={t.discount_pct}
                  onChange={(e) => setTier(i, 'discount_pct', parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
                <span className="text-sm text-gray-600">% de desconto</span>
              </div>
              <button onClick={() => removeTier(i)} className="ml-auto text-red-500 hover:bg-red-50 rounded-lg p-1.5" title="Remover">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={saveTiers} disabled={savingTiers}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#8B2214] text-white rounded-lg hover:bg-[#6d1a10] text-sm font-semibold disabled:bg-gray-400">
            <Save className="w-4 h-4" /> {savingTiers ? 'Salvando...' : 'Salvar descontos'}
          </button>
          {tiersSaved && <span className="text-green-600 text-sm font-medium">✓ Salvo!</span>}
        </div>
      </div>

      {/* Produtos disponíveis na assinatura */}
      <div className="border border-gray-200 rounded-xl p-4">
        <p className="font-bold text-gray-900 mb-1">Produtos disponíveis na assinatura</p>
        <p className="text-xs text-gray-500 mb-3">Marque quais cafés o cliente pode incluir na assinatura.</p>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <Coffee className="w-4 h-4 text-[#8B2214] flex-shrink-0" />
                <span className="text-sm text-gray-800 truncate">{p.name}</span>
              </div>
              <button
                onClick={() => toggleProduct(p)}
                role="switch"
                aria-checked={p.subscription_enabled}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${p.subscription_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${p.subscription_enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Nenhum produto cadastrado.</p>}
        </div>
      </div>
    </div>
  );
}
