import { useState, useEffect, useCallback } from 'react';
import { Palette, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Brand {
  id: string; company_id: string | null; name: string; is_primary: boolean;
  colors: any; tone: string | null; audience: string | null; product_line: string | null;
  dos: string | null; donts: string | null; logo_url: string | null; product_images: any; notes: string | null;
}

// Perfil da Marca (Brand Kit): a IA usa isto pra adaptar TODA análise pra sua marca.
export default function BrandProfile({ companyId }: { companyId: string | null }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Partial<Brand>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('studio_brand_profiles').select('*')
      .eq('company_id', companyId).order('is_primary', { ascending: false }).limit(1).maybeSingle();
    setBrand(data as Brand | null);
    setF((data as Brand) || { name: '', tone: '', audience: '', product_line: '', dos: '', donts: '', logo_url: '', notes: '' });
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!f.name?.trim()) { toast.error('Dê um nome à marca.'); return; }
    setSaving(true);
    const payload: any = {
      company_id: companyId, name: f.name.trim(), is_primary: true,
      tone: f.tone || null, audience: f.audience || null, product_line: f.product_line || null,
      dos: f.dos || null, donts: f.donts || null, logo_url: f.logo_url || null, notes: f.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = brand
      ? await supabase.from('studio_brand_profiles').update(payload).eq('id', brand.id)
      : await supabase.from('studio_brand_profiles').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Perfil da marca salvo! A IA vai usar isso nas próximas análises.');
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;

  const Campo = ({ label, k, rows = 2, hint }: { label: string; k: keyof Brand; rows?: number; hint?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 mb-1">{hint}</p>}
      <textarea value={(f[k] as string) || ''} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))} rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-[#f8f7f5] border border-[#ddd0cc] rounded-xl p-4 text-sm text-gray-600 flex items-start gap-2">
        <Palette className="w-4 h-4 text-[#8B2214] mt-0.5 flex-shrink-0" />
        <span>Este é o <strong>Perfil da Marca</strong>. A IA usa ele pra <strong>adaptar toda análise pra Café Saporino</strong> — cores, tom, pacote. Quando lançar submarcas/linhas, criamos um perfil pra cada.</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da marca</label>
          <input value={f.name || ''} onChange={e => setF(p => ({ ...p, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <Campo label="Tom de voz" k="tone" hint="Como a marca fala (ex.: tradição mineira, calorosa, autêntica)" />
        <Campo label="Público-alvo" k="audience" />
        <Campo label="Linha de produtos" k="product_line" />
        <Campo label="SEMPRE (o que a IA deve garantir)" k="dos" rows={3} hint="Ex.: mostrar o pacote vermelho Saporino, usar #8B2214, remeter à tradição de Minas" />
        <Campo label="NUNCA (o que evitar)" k="donts" rows={2} hint="Ex.: nunca usar marca de concorrente na peça final" />
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Logo (URL)</label>
          <input value={f.logo_url || ''} onChange={e => setF(p => ({ ...p, logo_url: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          {f.logo_url && <img src={f.logo_url} alt="logo" className="mt-2 h-12 object-contain" />}
        </div>
        <Campo label="Observações" k="notes" />
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar perfil
          </button>
        </div>
      </div>
    </div>
  );
}
