import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';

const FLAG = 'show_distributed_brands';
const BRAND = '#8B2214';

interface Brand { id: string; name: string; url: string | null; sort_order: number; is_active: boolean; }

// Gerencia a seção "Marcas que Distribuímos" do rodapé: liga/desliga + adiciona/edita/remove marcas.
export default function DistributedBrandsManager() {
  const [on, setOn] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFlag, setSavingFlag] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  async function loadAll() {
    const [{ data: flag }, { data: bs }] = await Promise.all([
      supabase.from('site_settings').select('value').eq('key', FLAG).maybeSingle(),
      supabase.from('distributed_brands').select('*').order('sort_order'),
    ]);
    setOn(!!flag?.value);
    setBrands((bs as Brand[]) || []);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function toggleFlag() {
    setSavingFlag(true);
    const next = !on;
    const { error } = await supabase.from('site_settings')
      .upsert({ key: FLAG, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (!error) setOn(next);
    setSavingFlag(false);
  }

  async function addBrand() {
    if (!newName.trim()) return;
    setAdding(true);
    const maxOrder = brands.reduce((m, b) => Math.max(m, b.sort_order), 0);
    const { error } = await supabase.from('distributed_brands').insert({
      name: newName.trim(), url: newUrl.trim() || null, sort_order: maxOrder + 1, is_active: true,
    });
    if (!error) { setNewName(''); setNewUrl(''); loadAll(); }
    else alert('Erro ao adicionar: ' + error.message);
    setAdding(false);
  }

  async function updateBrand(id: string, patch: Partial<Brand>) {
    setBrands(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b)); // otimista
    await supabase.from('distributed_brands').update(patch).eq('id', id);
  }

  async function removeBrand(id: string, name: string) {
    if (!confirm(`Remover a marca "${name}" do rodapé?`)) return;
    await supabase.from('distributed_brands').delete().eq('id', id);
    loadAll();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-[#8B2214]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Marcas que Distribuímos</h3>
            <p className="text-sm text-gray-500">Aparecem no rodapé da loja</p>
          </div>
        </div>
        <button type="button" onClick={toggleFlag} disabled={loading || savingFlag} role="switch" aria-checked={on}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#8B2214]' : 'bg-gray-300'} disabled:opacity-50`}
          title={on ? 'Seção ligada' : 'Seção desligada'}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {!on && <p className="text-xs text-amber-600 mb-4 bg-amber-50 rounded-lg px-3 py-2">A seção está <strong>desligada</strong> — não aparece na loja. Ligue o interruptor acima para exibir as marcas abaixo.</p>}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#8B2214]" /></div>
      ) : (
        <div className="space-y-2">
          {brands.map(b => (
            <div key={b.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <input value={b.name} onChange={e => setBrands(bs => bs.map(x => x.id === b.id ? { ...x, name: e.target.value } : x))}
                onBlur={e => updateBrand(b.id, { name: e.target.value.trim() })}
                className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-sm font-medium" placeholder="Nome da marca" />
              <input value={b.url || ''} onChange={e => setBrands(bs => bs.map(x => x.id === b.id ? { ...x, url: e.target.value } : x))}
                onBlur={e => updateBrand(b.id, { url: e.target.value.trim() || null })}
                className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-xs text-gray-500" placeholder="Link (opcional: /marcas/x ou https://...)" />
              <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0" title="Aparece na loja">
                <input type="checkbox" checked={b.is_active} onChange={e => updateBrand(b.id, { is_active: e.target.checked })} className="accent-[#8B2214]" /> ativa
              </label>
              <button onClick={() => removeBrand(b.id, b.name)} className="text-gray-300 hover:text-red-600 flex-shrink-0" title="Remover"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {brands.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Nenhuma marca ainda. Adicione abaixo.</p>}

          {/* Adicionar nova */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova marca — ex.: Café Canaan"
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Link (opcional)"
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={addBrand} disabled={adding || !newName.trim()}
              className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50 flex-shrink-0" style={{ background: BRAND }}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
