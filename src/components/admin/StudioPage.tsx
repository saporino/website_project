import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clapperboard, Download, Loader2, Search, Check, Heart, PlayCircle, MessageCircle, ArrowDownWideNarrow } from 'lucide-react';
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
  type IgPost = { url: string | null; thumb: string | null; video: string | null; isVideo: boolean; views: number; likes: number; comments: number; ts?: string | null; caption: string; score: number };
  type IgSort = 'eng' | 'views' | 'likes' | 'comments' | 'recent';
  const [igHandle, setIgHandle] = useState('');
  const [igType, setIgType] = useState<'all' | 'video' | 'image'>('all');
  const [igDepth, setIgDepth] = useState(60);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [igPosts, setIgPosts] = useState<IgPost[] | null>(null);
  const [igSel, setIgSel] = useState<Set<number>>(new Set());
  const [igSort, setIgSort] = useState<IgSort>('eng');

  const COST_PER_POST = 0.066; // ~US$ por post analisado (Claude + Whisper)
  const SCAN_CACHE_KEY = 'studio_ig_scan';
  const SCAN_TTL = 2 * 60 * 60 * 1000; // 2h (os links do IG expiram; depois disso, buscar de novo)

  // miniatura via proxy (o CDN do IG bloqueia hotlink direto)
  const thumbUrl = (t: string | null) => t ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-ig-thumb?url=${encodeURIComponent(t)}` : '';

  // restaura a última busca ao abrir/atualizar a página → refresh NÃO gasta raspagem de novo
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (Date.now() - (c.ts || 0) > SCAN_TTL) { localStorage.removeItem(SCAN_CACHE_KEY); return; }
      setIgHandle(c.handle || ''); setIgType(c.type || 'all'); setIgPosts(c.posts || null);
    } catch { /* ignora */ }
  }, []);

  async function scanInstagram() {
    if (!igHandle.trim()) { toast.error('Cole o @ (ou link) do perfil do concorrente.'); return; }
    setScanning(true); setIgPosts(null); setIgSel(new Set());
    const t = toast.loading(`Buscando os posts de ${igHandle}… (pode levar 1-2 min)`);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { handle: igHandle.trim(), mediaFilter: igType, scanLimit: igDepth },
    });
    toast.dismiss(t);
    setScanning(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Não consegui buscar os posts.');
      return;
    }
    const posts = ((data as any)?.posts as IgPost[]) || [];
    setIgPosts(posts);
    try { localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify({ handle: igHandle.trim(), type: igType, posts, ts: Date.now() })); } catch { /* quota */ }
  }

  function toggleSel(i: number) {
    setIgSel(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  async function importSelected() {
    if (!activeCompanyId) { toast.error('Selecione uma empresa.'); return; }
    if (!igPosts || !igSel.size) { toast.error('Marque ao menos um post.'); return; }
    const chosen = [...igSel].map(i => igPosts[i]).filter(Boolean);
    setImporting(true);
    const t = toast.loading(`Baixando e analisando ${chosen.length} post(s)…`);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { action: 'import', handle: igHandle.trim(), company_id: activeCompanyId, created_by: user?.id, posts: chosen },
    });
    toast.dismiss(t);
    setImporting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Falha na importação.');
      return;
    }
    toast.success(`${(data as any)?.imported || 0} post(s) importado(s). Analisando…`);
    setIgHandle(''); setIgPosts(null); setIgSel(new Set());
    try { localStorage.removeItem(SCAN_CACHE_KEY); } catch { /* ignora */ }
    load();
  }

  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(n);

  // ordena o grid na tela (não raspa de novo). Guarda o índice original pra seleção não bagunçar.
  const igSorted = useMemo(() => {
    if (!igPosts) return [];
    const key = (p: IgPost) =>
      igSort === 'views' ? p.views : igSort === 'likes' ? p.likes : igSort === 'comments' ? p.comments
      : igSort === 'recent' ? (p.ts ? Date.parse(p.ts) : 0) : (p.views + p.likes + p.comments);
    return igPosts.map((p, i) => ({ p, i })).sort((a, b) => key(b.p) - key(a.p));
  }, [igPosts, igSort]);
  const SORTS: [IgSort, string][] = [['eng', 'Engajamento'], ['views', 'Views'], ['likes', 'Curtidas'], ['comments', 'Comentários'], ['recent', 'Recentes']];

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
          {/* Importar do Instagram do concorrente: buscar → escolher miniaturas → analisar só os escolhidos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
            <div>
              <p className="text-sm font-semibold text-gray-800">Importar do Instagram do concorrente</p>
              <p className="text-xs text-gray-500">Cola o @ (ou link) → busca os posts que mais bombam → você escolhe quais e só aí a análise Saporino roda. (buscar é barato; cada análise ~US$ {COST_PER_POST.toFixed(2)} · uso pra inspiração)</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input value={igHandle} onChange={e => { setIgHandle(e.target.value); setIgPosts(null); }} placeholder="@concorrente (ou link do perfil)"
                onKeyDown={e => { if (e.key === 'Enter') scanInstagram(); }}
                className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select value={igType} onChange={e => setIgType(e.target.value as any)} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
                <option value="all">Vídeos e fotos</option>
                <option value="video">Só vídeos</option>
                <option value="image">Só fotos</option>
              </select>
              <select value={igDepth} onChange={e => setIgDepth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" title="Quantos posts recentes vasculhar">
                <option value={60}>Últimos 60</option>
                <option value={120}>Últimos 120</option>
                <option value={240}>Últimos 240</option>
                <option value={400}>Tudo (máx. 400)</option>
              </select>
              <button onClick={scanInstagram} disabled={scanning || importing}
                className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar posts
              </button>
            </div>

            {/* Galeria de miniaturas pra escolher */}
            {igPosts && (
              igPosts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Nenhum post encontrado com esse filtro.</p>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap gap-2">
                    <span>{igPosts.length} posts encontrados. Marque os que quer analisar.</span>
                    <button onClick={() => setIgSel(igSel.size === igPosts.length ? new Set() : new Set(igPosts.map((_, i) => i)))}
                      className="font-semibold text-[#8B2214] hover:underline">
                      {igSel.size === igPosts.length ? 'Limpar' : 'Selecionar todos'}
                    </button>
                  </div>
                  {/* Ordenar por */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><ArrowDownWideNarrow className="w-3.5 h-3.5" /> Ordenar:</span>
                    {SORTS.map(([k, l]) => (
                      <button key={k} onClick={() => setIgSort(k)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${igSort === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto p-0.5">
                    {igSorted.map(({ p, i }) => {
                      const on = igSel.has(i);
                      return (
                        <button key={i} onClick={() => toggleSel(i)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 group ${on ? 'border-[#8B2214] ring-2 ring-[#8B2214]/30' : 'border-transparent hover:border-gray-300'}`}>
                          {p.thumb
                            ? <img src={thumbUrl(p.thumb)} alt="" loading="lazy" className="w-full h-full object-cover bg-gray-100"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300"><Clapperboard className="w-6 h-6" /></div>}
                          {/* engajamento */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 flex items-center gap-1.5 text-[10px] font-semibold text-white">
                            {p.isVideo && <span className="flex items-center gap-0.5"><PlayCircle className="w-3 h-3" />{fmt(p.views)}</span>}
                            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{fmt(p.likes)}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{fmt(p.comments)}</span>
                          </div>
                          {/* check */}
                          <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center ${on ? 'bg-[#8B2214] text-white' : 'bg-white/80 text-transparent'}`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          {p.isVideo && <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1 rounded">REEL</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                    <span className="text-xs text-gray-500">
                      {igSel.size ? <><strong>{igSel.size}</strong> selecionado(s) · custo estimado <strong>~US$ {(igSel.size * COST_PER_POST).toFixed(2)}</strong></> : 'Nenhum selecionado ainda.'}
                    </span>
                    <button onClick={importSelected} disabled={importing || !igSel.size}
                      className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40">
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Analisar selecionados
                    </button>
                  </div>
                </div>
              )
            )}
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
