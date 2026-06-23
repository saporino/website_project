import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Upload, Loader2, Trash2, Plus } from 'lucide-react';

interface Popup {
  id: string;
  name: string;
  enabled: boolean;
  logo_url: string | null;
  logo_scale: number | null;
  image_url: string | null;
  eyebrow: string | null;
  headline: string | null;
  subtext: string | null;
  disclaimer: string | null;
  button_text: string | null;
  button_link: string | null;
  show_days: number;
  sort_order: number;
}

const BUCKET = 'product-images';
const DESTINOS = [
  { v: 'cadastro', label: 'Cadastro do cliente' },
  { v: 'login', label: 'Entrar (login)' },
  { v: '#products', label: 'Catálogo de cafés' },
  { v: '/assinatura', label: 'Página de assinatura' },
];

export function PopupSettings() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('popup_settings').select('*').order('sort_order').order('name');
    setPopups((data as Popup[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Popup>) => {
    setPopups(list => list.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('popup_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const addPopup = async () => {
    setAdding(true);
    const sort_order = (popups.reduce((m, p) => Math.max(m, p.sort_order), 0) || 0) + 1;
    await supabase.from('popup_settings').insert({
      name: 'Novo popup', enabled: false, show_days: 30, button_text: 'Quero', button_link: 'cadastro', sort_order,
    });
    await load();
    setAdding(false);
  };

  const removePopup = async (p: Popup) => {
    if (!confirm(`Excluir o popup "${p.name}"? Essa ação não tem volta.`)) return;
    setPopups(list => list.filter(x => x.id !== p.id));
    await supabase.from('popup_settings').delete().eq('id', p.id);
  };

  if (loading) return <div className="bg-white border border-gray-200 rounded-xl p-6 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>;

  const ligados = popups.filter(p => p.enabled).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#8B2214]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Popups Promocionais (Home)</h3>
              <p className="text-sm text-gray-600">Crie vários e ligue/desligue cada um. {ligados > 1 ? `${ligados} ligados — o site alterna entre eles.` : ligados === 1 ? '1 ligado.' : 'Nenhum ligado.'}</p>
            </div>
          </div>
          <button onClick={addPopup} disabled={adding}
            className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar popup
          </button>
        </div>
      </div>

      {popups.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Nenhum popup ainda. Clique em <strong>Adicionar popup</strong>.
        </div>
      )}

      {popups.map(p => (
        <PopupCard key={p.id} p={p} onUpdate={update} onRemove={removePopup} />
      ))}
    </div>
  );
}

function PopupCard({ p, onUpdate, onRemove }: { p: Popup; onUpdate: (id: string, patch: Partial<Popup>) => void; onRemove: (p: Popup) => void }) {
  const [uploading, setUploading] = useState<'logo_url' | 'image_url' | null>(null);

  const handleUpload = async (file: File, key: 'logo_url' | 'image_url') => {
    setUploading(key);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `popup/${key === 'logo_url' ? 'logo-' : ''}${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      onUpdate(p.id, { [key]: pub.publicUrl } as Partial<Popup>);
    } catch (e) {
      console.error('Erro no upload do popup:', e);
      alert('Erro ao enviar a imagem.');
    } finally {
      setUploading(null);
    }
  };

  const selVal = (link: string | null) => (!link ? '' : DESTINOS.some(d => d.v === link) ? link : '__custom__');

  const field = (label: string, key: keyof Popup, placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type="text" defaultValue={(p[key] as string) || ''} placeholder={placeholder}
        onBlur={(e) => { if (e.target.value !== ((p[key] as string) || '')) onUpdate(p.id, { [key]: e.target.value } as any); }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
    </div>
  );

  return (
    <div className={`bg-white border rounded-xl p-6 ${p.enabled ? 'border-green-300' : 'border-gray-200'}`}>
      {/* Cabeçalho do card: nome + liga/desliga + excluir */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nome (só no admin)</label>
          <input type="text" defaultValue={p.name}
            onBlur={(e) => { if (e.target.value !== p.name) onUpdate(p.id, { name: e.target.value || 'Popup' }); }}
            className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-[#8B2214]" />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-700">{p.enabled ? 'Ligado' : 'Desligado'}</p>
            <p className="text-[10px] text-gray-400">{p.enabled ? 'visível no site' : 'oculto'}</p>
          </div>
          <button onClick={() => onUpdate(p.id, { enabled: !p.enabled })} role="switch" aria-checked={p.enabled}
            className={`relative w-14 h-8 rounded-full transition-colors ${p.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${p.enabled ? 'translate-x-6' : ''}`} />
          </button>
          <button onClick={() => onRemove(p)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Excluir popup">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Logo (cabeçalho do popup)</label>
            <div className="flex items-center gap-3">
              <div className="h-12 w-28 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {p.logo_url ? <img src={p.logo_url} alt="" className="max-h-10 max-w-full object-contain" /> : <span className="text-[10px] text-gray-400 text-center px-1">Saporino (padrão)</span>}
              </div>
              <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-white text-xs font-semibold ${uploading === 'logo_url' ? 'bg-gray-400' : 'bg-[#8B2214] hover:bg-[#6d1a10]'}`}>
                {uploading === 'logo_url' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Trocar logo
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploading === 'logo_url'}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'logo_url'); e.target.value = ''; }} />
              </label>
              {p.logo_url && (
                <button onClick={() => onUpdate(p.id, { logo_url: null })} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg">Usar Saporino</button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-gray-500">Tamanho:</span>
              {([['P', 1], ['M', 1.6], ['G', 2.4], ['GG', 3.4]] as [string, number][]).map(([lbl, val]) => (
                <button key={lbl} type="button" onClick={() => onUpdate(p.id, { logo_scale: val })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${Math.abs((p.logo_scale || 1) - val) < 0.01 ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#8B2214]'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {field('Chapéu (linha pequena em cima)', 'eyebrow', 'Ex.: Café fresquinho, todo dia')}
          {field('Título', 'headline', 'Ex.: Ganhe 10% na primeira compra')}
          {field('Subtítulo', 'subtext', 'Ex.: Cadastre-se e receba seu cupom.')}
          {field('Texto do botão', 'button_text', 'Ex.: Quero meu cupom')}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Botão leva para</label>
            <select value={selVal(p.button_link)} onChange={(e) => onUpdate(p.id, { button_link: e.target.value === '__custom__' ? 'https://' : e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#8B2214]">
              {DESTINOS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              <option value="__custom__">Link personalizado…</option>
            </select>
            {selVal(p.button_link) === '__custom__' && (
              <input type="text" defaultValue={p.button_link || ''} placeholder="https://..."
                onBlur={(e) => onUpdate(p.id, { button_link: e.target.value })}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
            )}
          </div>
          {field('Aviso legal (letrinha embaixo)', 'disclaimer', 'Ex.: Válido na 1ª compra, 1 por CPF...')}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reexibir após (dias)</label>
            <input type="number" min={1} defaultValue={p.show_days}
              onBlur={(e) => onUpdate(p.id, { show_days: parseInt(e.target.value) || 30 })}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Foto (lado direito do popup)</label>
          <div className="aspect-[3/4] max-w-[220px] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-3">
            {p.image_url
              ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sem foto</div>}
          </div>
          <div className="flex gap-2">
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-white text-sm font-semibold ${uploading === 'image_url' ? 'bg-gray-400' : 'bg-[#8B2214] hover:bg-[#6d1a10]'}`}>
              {uploading === 'image_url' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading === 'image_url'}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'image_url'); e.target.value = ''; }} />
            </label>
            {p.image_url && (
              <button onClick={() => onUpdate(p.id, { image_url: null })} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Foto vertical (ex.: 3:4) fica melhor no lado direito.</p>
        </div>
      </div>
    </div>
  );
}
