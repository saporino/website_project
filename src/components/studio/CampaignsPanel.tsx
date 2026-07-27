import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Pencil, Trash2, Clock, Film } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import CampaignCreator, { type Campaign } from './CampaignCreator';

interface Row extends Campaign { studio_videos?: { filename: string } | null; }

const PLAT_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', ecommerce: 'E-commerce' };
const ST: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Agendada', cls: 'bg-amber-100 text-amber-800' },
  published: { label: 'Publicada', cls: 'bg-green-100 text-green-700' },
};

export default function CampaignsPanel({ companyId }: { companyId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | null>(null);

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
    </div>
  );
}
