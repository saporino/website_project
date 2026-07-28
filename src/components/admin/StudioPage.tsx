import { useState, useEffect, useCallback } from 'react';
import { Clapperboard, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import VideoDropzone from '../studio/VideoDropzone';
import VideoCard, { type StudioVideo } from '../studio/VideoCard';
import AnalysisModal from '../studio/AnalysisModal';
import CampaignsPanel from '../studio/CampaignsPanel';
import SocialConnections from '../studio/SocialConnections';
import BrandProfile from '../studio/BrandProfile';

// Saporino Studio — engenharia reversa de vídeos com IA.
// PASSO 2: upload + salvar no Storage + listar com status (realtime).
// Análise (Claude/Whisper) e campanhas entram nos próximos passos.
type Filtro = 'todos' | 'processando' | 'concluidos';

export default function StudioPage() {
  const { activeCompanyId } = useCompany();
  const { user } = useAuth();
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [modalVideo, setModalVideo] = useState<StudioVideo | null>(null);
  const [modalTab, setModalTab] = useState<'resumo' | 'publicar'>('resumo');
  const [view, setView] = useState<'videos' | 'campanhas' | 'conexoes' | 'marca'>('videos');
  const [igHandle, setIgHandle] = useState('');
  const [igN, setIgN] = useState(5);
  const [importing, setImporting] = useState(false);

  async function importFromInstagram() {
    if (!igHandle.trim()) { toast.error('Cole o @ (ou link) do perfil do concorrente.'); return; }
    if (!activeCompanyId) { toast.error('Selecione uma empresa.'); return; }
    setImporting(true);
    const t = toast.loading(`Buscando os top posts de ${igHandle}… (pode levar 1-2 min)`);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { handle: igHandle.trim(), company_id: activeCompanyId, created_by: user?.id, limit: igN },
    });
    toast.dismiss(t);
    setImporting(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.message || (data as any)?.error || error?.message || 'Falha na importação.';
      toast.error(msg);
      return;
    }
    toast.success(`${(data as any)?.imported || 0} post(s) importado(s) de ${(data as any)?.profile}. Analisando…`);
    setIgHandle('');
    load();
  }

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from('studio_videos')
      .select('id,filename,storage_path,status,duration,brand_detected,created_at,error_text,source_url,media_type')
      .eq('company_id', activeCompanyId)
      .order('created_at', { ascending: false });
    setVideos((data as StudioVideo[]) || []);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: status muda (quando a Edge Function processar) → recarrega
  useEffect(() => {
    if (!activeCompanyId) return;
    const ch = supabase.channel('studio-videos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_videos' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCompanyId, load]);

  async function handleReprocess(v: StudioVideo) {
    await supabase.from('studio_videos').update({ status: 'processing', error_text: null }).eq('id', v.id);
    setVideos(prev => prev.map(x => x.id === v.id ? { ...x, status: 'processing', error_text: null } : x));
    supabase.functions.invoke('process-studio-video', { body: { video_id: v.id } }).catch(() => {});
    toast.info('Reprocessando o vídeo…');
  }

  async function handleDelete(v: StudioVideo) {
    if (!confirm(`Excluir "${v.filename}"? Isso remove o vídeo e a análise.`)) return;
    await supabase.storage.from('studio-videos').remove([v.storage_path]);
    const { error } = await supabase.from('studio_videos').delete().eq('id', v.id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    setVideos(prev => prev.filter(x => x.id !== v.id));
    toast.success('Vídeo excluído.');
  }

  const processando = videos.filter(v => v.status === 'pending' || v.status === 'processing');
  const concluidos = videos.filter(v => v.status === 'completed');
  const shown = filtro === 'processando' ? processando : filtro === 'concluidos' ? concluidos : videos;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
          <Clapperboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saporino Studio</h1>
          <p className="text-sm text-gray-500">Engenharia reversa de vídeos com IA</p>
        </div>
      </div>

      {/* Visão: Vídeos, Campanhas ou Conexões */}
      <div className="flex bg-white border border-gray-200 rounded-xl text-sm font-semibold overflow-hidden w-fit">
        {([['videos', 'Vídeos'], ['campanhas', 'Campanhas'], ['marca', 'Marca'], ['conexoes', 'Conexões']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`px-5 py-2 ${view === k ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>

      {view === 'marca' ? (
        <BrandProfile companyId={activeCompanyId} />
      ) : view === 'conexoes' ? (
        <SocialConnections companyId={activeCompanyId} />
      ) : view === 'campanhas' ? (
        <CampaignsPanel companyId={activeCompanyId} />
      ) : (
        <>
          {/* Importar automático os top posts de um concorrente (Apify) */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Importar do Instagram do concorrente</p>
            <p className="text-xs text-gray-500 mb-2">Cola o @ (ou link) do perfil → traz os posts que mais bombam e a análise Saporino roda em cada. (usa crédito Apify · uso pra inspiração)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={igHandle} onChange={e => setIgHandle(e.target.value)} placeholder="@concorrente (ou link do perfil)"
                className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select value={igN} onChange={e => setIgN(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
              </select>
              <button onClick={importFromInstagram} disabled={importing}
                className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Importar top posts
              </button>
            </div>
          </div>

          <VideoDropzone companyId={activeCompanyId} userId={user?.id} onUploaded={load} />

          <div className="flex bg-white border border-gray-200 rounded-xl text-sm font-semibold overflow-hidden w-fit">
            {([['todos', `Todos (${videos.length})`], ['processando', `Processando (${processando.length})`], ['concluidos', `Concluídos (${concluidos.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFiltro(k)} className={`px-4 py-2 ${filtro === k ? 'bg-[#8B2214] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{l}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>
          ) : shown.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <Clapperboard className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">{filtro === 'todos' ? 'Nenhum vídeo ainda. Arraste um vídeo acima para começar.' : 'Nada aqui.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shown.map(v => (
                <VideoCard key={v.id} v={v}
                  onAnalyze={(vid) => { setModalTab('resumo'); setModalVideo(vid); }}
                  onCampaign={(vid) => { setModalTab('publicar'); setModalVideo(vid); }}
                  onDelete={handleDelete}
                  onReprocess={handleReprocess} />
              ))}
            </div>
          )}
        </>
      )}

      {modalVideo && (
        <AnalysisModal video={modalVideo} companyId={activeCompanyId} initialTab={modalTab} onClose={() => setModalVideo(null)} />
      )}
    </div>
  );
}
