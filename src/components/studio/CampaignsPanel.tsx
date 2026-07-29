import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Pencil, Trash2, Clock, Film, Send, Loader2, Instagram, Music2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import CampaignCreator, { type Campaign } from './CampaignCreator';

interface Row extends Campaign { studio_videos?: { filename: string } | null; publish_error?: string | null; }

const PLAT_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', ecommerce: 'E-commerce' };
const ST: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Agendada', cls: 'bg-amber-100 text-amber-800' },
  published: { label: 'Publicada', cls: 'bg-green-100 text-green-700' },
  error: { label: 'Falhou', cls: 'bg-red-100 text-red-700' },
};

export default function CampaignsPanel({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [confirmPub, setConfirmPub] = useState<Row | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('studio_campaigns')
      .select('*, studio_videos(filename)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setRows((data as Row[]) || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function remove(r: Row) {
    if (!confirm(`Excluir a campanha "${r.title}"?`)) return;
    const { error } = await supabase.from('studio_campaigns').delete().eq('id', r.id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    setRows(prev => prev.filter(x => x.id !== r.id));
    toast.success('Campanha excluída.');
  }

  const PUBLISHABLE: Record<string, { fn: string; label: string }> = {
    instagram: { fn: 'publish-instagram', label: 'Instagram' },
    tiktok: { fn: 'publish-tiktok', label: 'TikTok' },
  };

  // clica em "Publicar agora": se falta arte, manda anexar; senão abre a confirmação
  function askPublish(r: Row) {
    if (!r.media_path) { toast.error('Anexe a arte final da Saporino na campanha (Editar) antes de publicar.'); setEditing(r); return; }
    if (r.platform === 'tiktok' && r.media_type !== 'video') { toast.error('TikTok só publica vídeo. Anexe um vídeo MP4 (9:16) na campanha.'); setEditing(r); return; }
    setConfirmPub(r);
  }

  async function doPublish(r: Row) {
    const target = PUBLISHABLE[r.platform];
    if (!target) return;
    setConfirmPub(null); setPublishingId(r.id);
    const t = toast.loading(`Publicando no ${target.label}… (vídeo pode levar 1-2 min)`);
    const { data, error } = await supabase.functions.invoke(target.fn, { body: { campaign_id: r.id } });
    toast.dismiss(t); setPublishingId(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Falha ao publicar.');
      load();
      return;
    }
    toast.success((data as any)?.message || `Publicado no ${target.label}! 🎉`);
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;

  if (!rows.length) return (
    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
      <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="text-sm">Nenhuma campanha ainda. Crie uma a partir da análise de um vídeo (aba Vídeos → Ver Análise → Publicar).</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rows.map(r => {
        const st = ST[r.status] || ST.draft;
        return (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f0ef] text-[#8B2214]">{PLAT_LABEL[r.platform] || r.platform}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  {r.studio_videos?.filename && <span className="inline-flex items-center gap-1"><Film className="w-3 h-3" />{r.studio_videos.filename}</span>}
                  {r.scheduled_at && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                </p>
                {r.content && <p className="text-sm text-gray-600 mt-1.5 line-clamp-2 whitespace-pre-line">{r.content}</p>}
                {r.external_url && <a href={r.external_url} target="_blank" rel="noreferrer" className="text-xs text-[#8B2214] font-medium hover:underline break-all">🔗 {r.external_url}</a>}
                {r.publish_error && r.status !== 'published' && (
                  <p className="text-xs text-red-600 mt-1 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Falha ao publicar: {r.publish_error}</p>
                )}
                {/* Publicar agora — Instagram ou TikTok, ainda não publicada */}
                {PUBLISHABLE[r.platform] && r.status !== 'published' && (
                  <button onClick={() => askPublish(r)} disabled={publishingId === r.id}
                    className="mt-2 inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {publishingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Publicar no {PUBLISHABLE[r.platform].label}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => setEditing(r)} title="Editar" className="p-1.5 rounded text-gray-500 hover:text-[#8B2214] hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(r)} title="Excluir" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        );
      })}

      {editing && (
        <CampaignCreator companyId={companyId} campaign={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}

      {confirmPub && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmPub(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center mx-auto mb-3">{confirmPub.platform === 'tiktok' ? <Music2 className="w-6 h-6" /> : <Instagram className="w-6 h-6" />}</div>
              <h3 className="font-bold text-gray-900">Publicar agora no {PUBLISHABLE[confirmPub.platform]?.label}?</h3>
              <p className="text-sm text-gray-500 mt-1">"{confirmPub.title}" ({confirmPub.media_type === 'video' ? 'vídeo' : 'imagem'}) vai ao ar na conta da Saporino. Não dá pra desfazer pelo site.</p>
            </div>
            <div className="flex justify-center gap-2 px-5 pb-5">
              <button onClick={() => setConfirmPub(null)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => doPublish(confirmPub)} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg">
                <Send className="w-4 h-4" /> Publicar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
