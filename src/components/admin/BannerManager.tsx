import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { bannerButtonStyle } from '../../lib/bannerButton';
import { Images, Upload, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Loader2 } from 'lucide-react';

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
  button_scale: number;
  overlay_image_url: string | null;
  overlay_x: number;
  overlay_y: number;
  overlay_scale: number;
}

const BUCKET = 'product-images';
const PREFIX = 'banners/';

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

  // Upload de imagem sobreposta (ex.: QR code) para um banner.
  const handleOverlayUpload = async (banner: Banner, file: File) => {
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${PREFIX}overlay-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      await update(banner.id, { overlay_image_url: pub.publicUrl, overlay_x: 50, overlay_y: 50, overlay_scale: 1 });
    } catch (e) {
      console.error('Erro no upload da imagem sobreposta:', e);
      alert('Erro ao enviar a imagem. Tente novamente.');
    }
  };

  const removeOverlay = async (banner: Banner) => {
    const marker = `/${BUCKET}/`;
    if (banner.overlay_image_url) {
      const idx = banner.overlay_image_url.indexOf(marker);
      if (idx >= 0) { try { await supabase.storage.from(BUCKET).remove([banner.overlay_image_url.slice(idx + marker.length)]); } catch { /* ok */ } }
    }
    await update(banner.id, { overlay_image_url: null });
  };

  const update = async (id: string, patch: Partial<Banner>) => {
    setBanners(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)));
    await supabase.from('promo_banners').update(patch).eq('id', id);
  };
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
          <p className="text-sm text-gray-600">Imagens que giram no topo da loja. Mantenha todas no mesmo tamanho.</p>
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
        <div className="space-y-6">
          {banners.map((b, i) => (
            <div key={b.id} className={`p-4 rounded-xl border ${b.active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
              {/* Preview GRANDE com botao arrastavel proporcional */}
              <div
                className="relative w-full aspect-[3/1] rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                style={{ containerType: 'inline-size' }}
              >
                <img src={b.image_url} alt={b.title || `Banner ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
                {b.button_text && (
                  <button
                    style={{ ...bannerButtonStyle(b.button_x, b.button_y, b.button_scale ?? 1), touchAction: 'none' }}
                    onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragId(b.id); }}
                    onPointerMove={(e) => { if (dragId === b.id) patchLocal(b.id, posFromEvent(e, e.currentTarget.parentElement as HTMLElement)); }}
                    onPointerUp={(e) => { if (dragId !== b.id) return; setDragId(null); update(b.id, posFromEvent(e, e.currentTarget.parentElement as HTMLElement)); }}
                    className="absolute bg-[#8B2214] text-white font-semibold rounded-full shadow-lg cursor-move whitespace-nowrap select-none"
                    title="Arraste para posicionar"
                  >
                    {b.button_text}
                  </button>
                )}
                {b.overlay_image_url && (
                  <img
                    src={b.overlay_image_url} alt="overlay" draggable={false}
                    style={{ left: `${b.overlay_x}%`, top: `${b.overlay_y}%`, transform: 'translate(-50%, -50%)', width: `${20 * (b.overlay_scale ?? 1)}cqw`, touchAction: 'none' }}
                    onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragId(b.id + ':ov'); }}
                    onPointerMove={(e) => { if (dragId === b.id + ':ov') { const p = posFromEvent(e, e.currentTarget.parentElement as HTMLElement); patchLocal(b.id, { overlay_x: p.button_x, overlay_y: p.button_y }); } }}
                    onPointerUp={(e) => { if (dragId !== b.id + ':ov') return; setDragId(null); const p = posFromEvent(e, e.currentTarget.parentElement as HTMLElement); update(b.id, { overlay_x: p.button_x, overlay_y: p.button_y }); }}
                    className="absolute cursor-move drop-shadow-lg rounded-md select-none"
                    title="Arraste para posicionar"
                  />
                )}
              </div>
              {(b.button_text || b.overlay_image_url) && <p className="text-xs text-gray-400 mt-1 text-center">Arraste o botão/imagem para posicionar · ajuste o tamanho abaixo</p>}

              {/* Campos + acoes */}
              <div className="flex flex-col lg:flex-row gap-4 mt-4">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Título (uso interno)</label>
                      <input type="text" defaultValue={b.title || ''} placeholder="Ex.: Promoção de inverno"
                        onBlur={(e) => { if (e.target.value !== (b.title || '')) update(b.id, { title: e.target.value }); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Ao clicar no banner, leva para</label>
                      <select
                        value={selectValue(b.link_url)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') update(b.id, { link_url: selectValue(b.link_url) === '__custom__' ? b.link_url : 'https://' });
                          else update(b.id, { link_url: v || null });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#8B2214] focus:border-transparent">
                        <option value="">— nada (não clicável) —</option>
                        {DESTINOS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                        <option value="__custom__">Link personalizado…</option>
                      </select>
                      {selectValue(b.link_url) === '__custom__' && (
                        <input type="text" defaultValue={b.link_url || ''} placeholder="https://..."
                          onBlur={(e) => update(b.id, { link_url: e.target.value || null })}
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                      )}
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
                            if (v === '__custom__') update(b.id, { button_link: selectValue(b.button_link) === '__custom__' ? b.button_link : 'https://' });
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
                    {/* Tamanho do botao */}
                    {b.button_text && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tamanho do botão: {Math.round((b.button_scale ?? 1) * 100)}%</label>
                        <input type="range" min={0.5} max={2} step={0.05}
                          value={b.button_scale ?? 1}
                          onChange={(e) => patchLocal(b.id, { button_scale: parseFloat(e.target.value) })}
                          onMouseUp={(e) => update(b.id, { button_scale: parseFloat((e.target as HTMLInputElement).value) })}
                          onTouchEnd={(e) => update(b.id, { button_scale: parseFloat((e.target as HTMLInputElement).value) })}
                          className="w-full accent-[#8B2214]" />
                      </div>
                    )}
                  </div>

                  {/* Imagem sobreposta (QR code, selo, etc.) */}
                  <div className="bg-[#faf7f6] border border-[#ddd0cc] rounded-lg p-3 space-y-3">
                    <p className="text-xs font-bold text-[#8B2214]">Imagem sobreposta — QR code, selo (opcional)</p>
                    {b.overlay_image_url ? (
                      <div className="flex items-center gap-3">
                        <img src={b.overlay_image_url} alt="" className="w-12 h-12 object-contain rounded border border-gray-200 bg-white" />
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Tamanho: {Math.round((b.overlay_scale ?? 1) * 100)}%</label>
                          <input type="range" min={0.4} max={3} step={0.05} value={b.overlay_scale ?? 1}
                            onChange={(e) => patchLocal(b.id, { overlay_scale: parseFloat(e.target.value) })}
                            onMouseUp={(e) => update(b.id, { overlay_scale: parseFloat((e.target as HTMLInputElement).value) })}
                            onTouchEnd={(e) => update(b.id, { overlay_scale: parseFloat((e.target as HTMLInputElement).value) })}
                            className="w-full accent-[#8B2214]" />
                        </div>
                        <button onClick={() => removeOverlay(b)} className="text-xs text-red-600 hover:underline whitespace-nowrap">Remover</button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-white text-xs font-semibold bg-[#8B2214] hover:bg-[#6d1a10]">
                        <Upload className="w-4 h-4" /> Enviar imagem (ex.: QR)
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOverlayUpload(b, f); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                </div>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
