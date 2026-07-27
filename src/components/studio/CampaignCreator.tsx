import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Megaphone, Loader2 } from 'lucide-react';

const PLATFORMS: [string, string][] = [
  ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['ecommerce', 'E-commerce'],
];

// Cria uma campanha (studio_campaigns) a partir da análise de um vídeo.
export default function CampaignCreator({ videoId, companyId, initialTitle, initialContent, promptUsed, onClose, onCreated }: {
  videoId: string; companyId: string | null;
  initialTitle?: string; initialContent?: string; promptUsed?: string;
  onClose: () => void; onCreated?: () => void;
}) {
  const [platform, setPlatform] = useState('instagram');
  const [title, setTitle] = useState(initialTitle || '');
  const [content, setContent] = useState(initialContent || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error('Dê um título à campanha.'); return; }
    setSaving(true);
    const { error } = await supabase.from('studio_campaigns').insert({
      video_id: videoId, company_id: companyId, title: title.trim(), platform,
      content, prompt_used: promptUsed || null,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao criar campanha: ' + error.message); return; }
    toast.success('Campanha criada!');
    onCreated?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#8B2214]" />
            <h3 className="font-bold text-gray-900">Criar campanha</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Plataforma</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(([k, l]) => (
                <button key={k} onClick={() => setPlatform(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${platform === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Título da campanha</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Reels — Pilão dia seguinte"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Conteúdo / legenda</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Agendar para (opcional)</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[11px] text-gray-400 mt-1">Sem data = salva como rascunho. Com data = agendada.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Criar campanha
          </button>
        </div>
      </div>
    </div>
  );
}
