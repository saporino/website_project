import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Megaphone, Loader2 } from 'lucide-react';

const PLATFORMS: [string, string][] = [
  ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['ecommerce', 'E-commerce'],
];
const STATUSES: [string, string][] = [['draft', 'Rascunho'], ['scheduled', 'Agendada'], ['published', 'Publicada']];

export interface Campaign {
  id: string; video_id: string | null; company_id: string | null;
  title: string; platform: string; content: string | null; prompt_used: string | null;
  status: string; scheduled_at: string | null; created_at: string;
  external_url?: string | null; published_at?: string | null;
}

// Cria (a partir da análise) OU edita uma campanha (studio_campaigns).
export default function CampaignCreator({ videoId, companyId, campaign, initialTitle, initialContent, promptUsed, onClose, onSaved }: {
  videoId?: string | null; companyId: string | null; campaign?: Campaign;
  initialTitle?: string; initialContent?: string; promptUsed?: string;
  onClose: () => void; onSaved?: () => void;
}) {
  const editing = !!campaign;
  const [platform, setPlatform] = useState(campaign?.platform || 'instagram');
  const [title, setTitle] = useState(campaign?.title || initialTitle || '');
  const [content, setContent] = useState(campaign?.content ?? initialContent ?? '');
  const [status, setStatus] = useState(campaign?.status || 'draft');
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
  const [externalUrl, setExternalUrl] = useState(campaign?.external_url || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error('Dê um título à campanha.'); return; }
    setSaving(true);
    const finalStatus = editing ? status : (scheduledAt ? 'scheduled' : 'draft');
    const payload: any = {
      title: title.trim(), platform, content, status: finalStatus,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      external_url: externalUrl.trim() || null,
      // ao marcar publicada manualmente, carimba a data (se ainda não tinha)
      published_at: finalStatus === 'published' ? (campaign?.published_at || new Date().toISOString()) : null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('studio_campaigns').update(payload).eq('id', campaign!.id));
    } else {
      ({ error } = await supabase.from('studio_campaigns').insert({ ...payload, video_id: videoId ?? null, company_id: companyId, prompt_used: promptUsed || null }));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar campanha: ' + error.message); return; }
    toast.success(editing ? 'Campanha atualizada!' : 'Campanha criada!');
    onSaved?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#8B2214]" />
            <h3 className="font-bold text-gray-900">{editing ? 'Editar campanha' : 'Criar campanha'}</h3>
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
          {editing && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Situação</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(([k, l]) => (
                  <button key={k} onClick={() => setStatus(k)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${status === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {editing && status === 'published' && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Link do post (cole depois de postar na mão)</label>
              <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://instagram.com/p/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Agendar para (opcional)</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {!editing && <p className="text-[11px] text-gray-400 mt-1">Sem data = rascunho. Com data = agendada.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} {editing ? 'Salvar' : 'Criar campanha'}
          </button>
        </div>
      </div>
    </div>
  );
}
