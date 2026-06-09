import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Images, Upload, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Loader2, Move } from 'lucide-react';

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  link_url: string | null;
  sort_order: number;
  active: boolean;
  button_text: string | null;
  button_link: string | null;
  button_x: number;
  button_y: number;
}

const BUCKET = 'product-images';
const PREFIX = 'banners/';

// Destinos prontos para o botao do banner.
const DESTINOS = [
  { v: 'cadastro', label: 'Cadastro do cliente' },
  { v: 'login', label: 'Entrar (login)' },
  { v: '/repco', label: 'Portal do Representante' },
  { v: '#products', label: 'Catálogo de cafés' },
];

export function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('promo_banners')
      .select('*')
      .order('sort_order', { ascending: true });
    setBanners((data as Banner[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${PREFIX}${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      const nextOrder = banners.length ? Math.max(...banners.map(b => b.sort_order)) + 1 : 0;
      const { error: insErr } = await supabase
        .from('promo_banners')
        .insert([{ image_url: pub.publicUrl, sort_order: nextOrder, active: true }]);
      if (insErr) throw insErr;
      await load();
    } catch (e) {
      console.error('Erro no upload do banner:', e);
      alert('Erro ao enviar a imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const update = async (id: string, patch: Partial<Banner>) => {
    setBanners(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
    await supabase.from('promo_banners').update(patch).eq('id', id);
  };
  // Atualiza so o estado local (sem ir ao banco) — usado durante o arraste.
  const patchLocal = (id: string, patch: Partial<Banner>) =>
    setBanners(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)));

  const remove = async (b: Banner) => {
    if (!confirm('Remover este banner do carrossel?')) return;
    const marker = `/${BUCKET}/`;
    const idx = b.image_url.indexOf(marker);
    if (idx >= 0) {
      const p = b.image_url.slice(idx + marker.length);
      try { await supabase.storage.from(BUCKET).remove([p]); } catch { /* arquivo pode ja nao existir */ }
    }
    await supabase.from('promo_banners').delete().eq('id', b.id);
    await load();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const a = banners[i], b = banners[j];
    await Promise.all([
      supabase.from('promo_banners').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('promo_banners').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    await load();
  };

  // Posicao do botao a partir do cursor, em % da miniatura.
  const posFromEvent = (e: React.PointerEvent, container: HTMLElement) => {
    const rect = container.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    return { button_x: Math.round(x * 10) / 10, button_y: Math.round(y * 10) / 10 };
  };

  const selectValue = (link: string | null) =>
    !link ? '' : DESTINOS.some(d => d.v === link) ? link : '__custom__';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Images className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Banners do Carrossel (Home)</h3>
          <p className="text-sm text-gray-600">Imagens que giram no topo da loja. Ideal 1920×600px (PNG ou JPG).</p>
        </div>
      </div>

      <label className={`flex items-center justify-center gap-2 w-full md:w-auto md:inline-flex px-5 py-3 rounded-lg cursor-pointer mb-6 text-white transition-colors ${uploading ? 'bg-gray-400' : 'bg-[#8B2214] hover:bg-[#6d1a10]'}`}>
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        <span className="font-semibold text-sm">{uploading ? 'Enviando...' : 'Adicionar banner'}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
        />
      </label>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#8B2214]" />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          Nenhum banner ainda. Clique em "Adicionar banner" para enviar a primeira imagem.
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((b, i) => (
            <div key={b.id} className={`flex flex-col lg:flex-row gap-4 p-4 rounded-xl border ${b.active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
              {/* Miniatura com botao arrastavel */}
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="relative aspect-[16/5] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img src={b.image_url} alt={b.title || `Banner ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
                  {b.button_text && (
                    <button
                      style={{ left: `${b.button_x}%`, top: `${b.button_y}%`, touchAction: 'none' }}
                      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragId(b.id); }}
                      onPointerMove={(e) => { if (dragId === b.id) patchLocal(b.id, posFromEvent(e, e.currentTarget.parentElement as HTMLElement)); }}
                      onPointerUp={(e) => {
                        if (dragId !== b.id) return;
                        setDragId(null);
                        update(b.id, posFromEvent(e, e.currentTarget.parentElement as HTMLElement));
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 bg-[#8B2214] text-white font-semibold text-[10px] px-2.5 py-1 rounded-full shadow-lg cursor-move flex items-center gap-1 whitespace-nowrap"
                      title="Arraste para posicionar o botão"
                    >
                      <Move className="w-2.5 h-2.5" />{b.button_text}
                    </button>
                  )}
                </div>
                {b.button_text && <p className="text-[11px] text-gray-400 mt-1 text-center">Arraste o botão para encaixá-lo no banner</p>}
              </div>

              {/* Campos */}
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Título (uso interno)</label>
                    <input type="text" defaultValue={b.title || ''} placeholder="Ex.: Promoção de inverno"
                      onBlur={(e) => { if (e.target.value !== (b.title || '')) update(b.id, { title: e.target.value }); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Link ao clicar na imagem (opcional)</label>
                    <input type="text" defaultValue={b.link_url || ''} placeholder="https://... ou /repco"
                      onBlur={(e) => { if (e.target.value !== (b.link_url || '')) update(b.id, { link_url: e.target.value || null }); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                  </div>
                </div>

                {/* Botao sobre o banner */}
                <div className="bg-[#faf7f6] border border-[#ddd0cc] rounded-lg p-3 space-y-3">
                  <p className="text-xs font-bold text-[#8B2214]">Botão sobre o banner (opcional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Texto do botão</label>
                      <input type="text" defaultValue={b.button_text || ''} placeholder='Ex.: Quero o meu!'
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (b.button_text || '')) update(b.id, { button_text: v || null }); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Para onde leva</label>
                      <select
                        value={selectValue(b.button_link)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') update(b.id, { button_link: b.button_link && selectValue(b.button_link) === '__custom__' ? b.button_link : 'https://' });
                          else update(b.id, { button_link: v || null });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                        <option value="">— escolha —</option>
                        {DESTINOS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                        <option value="__custom__">Link personalizado…</option>
                      </select>
                    </div>
                  </div>
                  {selectValue(b.button_link) === '__custom__' && (
                    <input type="text" defaultValue={b.button_link || ''} placeholder="https://..."
                      onBlur={(e) => update(b.id, { button_link: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                  )}
                </div>
              </div>

              {/* Acoes */}
              <div className="flex lg:flex-col items-center justify-between lg:justify-start gap-2 lg:w-32 flex-shrink-0">
                <button onClick={() => update(b.id, { active: !b.active })}
                  title={b.active ? 'Ativo (clique para ocultar)' : 'Oculto (clique para mostrar)'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold w-full justify-center ${b.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {b.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {b.active ? 'Ativo' : 'Oculto'}
                </button>
                <div className="flex gap-1 w-full">
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Subir"
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === banners.length - 1} title="Descer"
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => remove(b)} title="Remover"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold w-full justify-center bg-red-50 text-red-600 hover:bg-red-100">
                  <Trash2 className="w-4 h-4" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
