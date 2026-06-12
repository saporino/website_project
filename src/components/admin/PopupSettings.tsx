import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Upload, Loader2, Trash2 } from 'lucide-react';

interface Popup {
  id: string;
  enabled: boolean;
  image_url: string | null;
  eyebrow: string | null;
  headline: string | null;
  subtext: string | null;
  disclaimer: string | null;
  button_text: string | null;
  button_link: string | null;
  show_days: number;
}

const BUCKET = 'product-images';
const DESTINOS = [
  { v: 'cadastro', label: 'Cadastro do cliente' },
  { v: 'login', label: 'Entrar (login)' },
  { v: '#products', label: 'Catálogo de cafés' },
  { v: '/assinatura', label: 'Página de assinatura' },
];

export function PopupSettings() {
  const [p, setP] = useState<Popup | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('popup_settings').select('*').maybeSingle();
    setP(data as Popup);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (patch: Partial<Popup>) => {
    if (!p) return;
    setP({ ...p, ...patch });
    await supabase.from('popup_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', p.id);
  };

  const handleUpload = async (file: File) => {
    if (!p) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `popup/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      await update({ image_url: pub.publicUrl });
    } catch (e) {
      console.error('Erro no upload do popup:', e);
      alert('Erro ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const selVal = (link: string | null) => (!link ? '' : DESTINOS.some(d => d.v === link) ? link : '__custom__');

  if (loading) return <div className="bg-white border border-gray-200 rounded-xl p-6 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>;
  if (!p) return null;

  const field = (label: string, key: keyof Popup, placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type="text" defaultValue={(p[key] as string) || ''} placeholder={placeholder}
        onBlur={(e) => { if (e.target.value !== ((p[key] as string) || '')) update({ [key]: e.target.value } as any); }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Popup Promocional (Home)</h3>
          <p className="text-sm text-gray-600">Aparece 1x por visitante. Edite o texto, a foto e o destino do botão.</p>
        </div>
      </div>

      {/* Liga/desliga */}
      <div className="flex items-center justify-between bg-[#faf7f6] border border-[#ddd0cc] rounded-xl p-4 mb-6">
        <div>
          <p className="font-bold text-gray-900">Mostrar popup</p>
          <p className="text-sm text-gray-600">{p.enabled ? 'Ligado — visitantes novos veem o popup.' : 'Desligado.'}</p>
        </div>
        <button onClick={() => update({ enabled: !p.enabled })} role="switch" aria-checked={p.enabled}
          className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${p.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${p.enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Coluna texto */}
        <div className="space-y-3">
          {field('Chapéu (linha pequena em cima)', 'eyebrow', 'Ex.: Café fresquinho, todo dia')}
          {field('Título', 'headline', 'Ex.: Ganhe 10% na primeira compra')}
          {field('Subtítulo', 'subtext', 'Ex.: Cadastre-se e receba seu cupom.')}
          {field('Texto do botão', 'button_text', 'Ex.: Quero meu cupom')}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Botão leva para</label>
            <select value={selVal(p.button_link)} onChange={(e) => update({ button_link: e.target.value === '__custom__' ? 'https://' : e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#8B2214]">
              {DESTINOS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
              <option value="__custom__">Link personalizado…</option>
            </select>
            {selVal(p.button_link) === '__custom__' && (
              <input type="text" defaultValue={p.button_link || ''} placeholder="https://..."
                onBlur={(e) => update({ button_link: e.target.value })}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
            )}
          </div>
          {field('Aviso legal (letrinha embaixo)', 'disclaimer', 'Ex.: Válido na 1ª compra, 1 por CPF...')}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reexibir após (dias)</label>
            <input type="number" min={1} defaultValue={p.show_days}
              onBlur={(e) => update({ show_days: parseInt(e.target.value) || 30 })}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
          </div>
        </div>

        {/* Coluna foto */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Foto (lado direito do popup)</label>
          <div className="aspect-[3/4] max-w-[220px] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-3">
            {p.image_url
              ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sem foto</div>}
          </div>
          <div className="flex gap-2">
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-white text-sm font-semibold ${uploading ? 'bg-gray-400' : 'bg-[#8B2214] hover:bg-[#6d1a10]'}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
            </label>
            {p.image_url && (
              <button onClick={() => update({ image_url: null })} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
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
