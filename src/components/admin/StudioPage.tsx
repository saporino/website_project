import { useState, useEffect, useCallback } from 'react';
import { Clapperboard, Download, Loader2, Search, Check, Heart, PlayCircle, MessageCircle, ArrowDownWideNarrow, ChevronRight, ChevronDown, Trash2, X } from 'lucide-react';
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
  type IgPost = { uid: string; url: string | null; thumb: string | null; video: string | null; isVideo: boolean; views: number; likes: number; comments: number; ts?: string | null; caption: string; score: number };
  type IgSort = 'eng' | 'views' | 'likes' | 'comments' | 'recent';
  type IgSearch = { id: number; handle: string; type: 'all' | 'video' | 'image'; posts: IgPost[]; ts: number; collapsed: boolean; sort: IgSort; followers?: number | null; postsProfile?: number | null };
  type Growth = { week: number | null; month: number | null; year: number | null; since: string | null };
  const [igHandle, setIgHandle] = useState('');
  const [igType, setIgType] = useState<'all' | 'video' | 'image'>('all');
  const [igDepth, setIgDepth] = useState(60);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [igInfo, setIgInfo] = useState<{ profile: string; postsCount: number | null; followers: number | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [igSearches, setIgSearches] = useState<IgSearch[]>([]);
  const [igSel, setIgSel] = useState<Set<string>>(new Set());
  const [growth, setGrowth] = useState<Record<string, Growth>>({});
  const [growthTick, setGrowthTick] = useState(0);
  const [checkingGroup, setCheckingGroup] = useState<number | null>(null);

  const COST_PER_POST = 0.066; // ~US$ por post analisado (Claude + Whisper)
  const SCAN_CACHE_KEY = 'studio_ig_searches';
  const SCAN_TTL = 2 * 60 * 60 * 1000; // 2h (os links do IG expiram; depois disso, buscar de novo)

  // miniatura via proxy (o CDN do IG bloqueia hotlink direto)
  const thumbUrl = (t: string | null) => t ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-ig-thumb?url=${encodeURIComponent(t)}` : '';
  const persist = (arr: IgSearch[]) => { try { localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(arr)); } catch { /* quota */ } };

  // restaura buscas salvas ao abrir/atualizar → refresh NÃO gasta raspagem de novo
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY);
      if (!raw) return;
      const all = JSON.parse(raw) as IgSearch[];
      const arr = all.filter(s => Date.now() - (s.ts || 0) <= SCAN_TTL).map(s => ({ ...s, sort: s.sort || 'eng' }));
      setIgSearches(arr);
      if (arr.length !== all.length) persist(arr);
    } catch { /* ignora */ }
  }, []);

  async function checkInstagram() {
    if (!igHandle.trim()) { toast.error('Cole o @ (ou link) do perfil.'); return; }
    setChecking(true); setIgInfo(null);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { action: 'preview', handle: igHandle.trim(), company_id: activeCompanyId },
    });
    setChecking(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Não consegui verificar o perfil.');
      return;
    }
    setIgInfo({ profile: (data as any)?.profile || igHandle.trim(), postsCount: (data as any)?.postsCount ?? null, followers: (data as any)?.followers ?? null });
  }

  async function scanInstagram() {
    if (!igHandle.trim()) { toast.error('Cole o @ (ou link) do perfil do concorrente.'); return; }
    setScanning(true); setIgInfo(null);
    const t = toast.loading(`Buscando os posts de ${igHandle}… (pode levar 1-2 min)`);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { handle: igHandle.trim(), mediaFilter: igType, scanLimit: igDepth, company_id: activeCompanyId },
    });
    toast.dismiss(t);
    setScanning(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Não consegui buscar os posts.');
      return;
    }
    const ts = Date.now();
    const posts = (((data as any)?.posts as IgPost[]) || []).map((p, i) => ({ ...p, uid: `${ts}_${i}` }));
    const profile = (data as any)?.profile || ('@' + igHandle.trim().replace(/^@/, ''));
    const search: IgSearch = { id: ts, handle: profile, type: igType, posts, ts, collapsed: false, sort: 'eng', followers: (data as any)?.followers ?? null, postsProfile: (data as any)?.postsCount ?? null };
    setIgSearches(prev => {
      // nova busca entra aberta no topo; as anteriores colapsam pra não apertar
      const next = [search, ...prev.map(s => ({ ...s, collapsed: true }))];
      persist(next); return next;
    });
    setIgHandle('');
  }

  function toggleSel(uid: string) {
    setIgSel(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  }
  function toggleCollapse(id: number) {
    setIgSearches(prev => { const next = prev.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s); persist(next); return next; });
  }
  // atualiza seguidores/posts do perfil de um grupo já buscado, sem raspar posts de novo (barato)
  async function verifyGroup(s: IgSearch) {
    setCheckingGroup(s.id);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { action: 'preview', handle: s.handle, company_id: activeCompanyId },
    });
    setCheckingGroup(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.message || (data as any)?.error || 'Não consegui verificar.'); return; }
    const followers = (data as any)?.followers ?? null;
    const postsProfile = (data as any)?.postsCount ?? null;
    setIgSearches(prev => { const next = prev.map(x => x.id === s.id ? { ...x, followers, postsProfile } : x); persist(next); return next; });
    setGrowthTick(t => t + 1);
  }
  function setGroupSort(id: number, sort: IgSort) {
    setIgSearches(prev => { const next = prev.map(s => s.id === id ? { ...s, sort } : s); persist(next); return next; });
  }
  function deleteSearch(id: number) {
    setIgSearches(prev => {
      const gone = prev.find(s => s.id === id);
      const next = prev.filter(s => s.id !== id);
      persist(next);
      if (gone) setIgSel(sel => { const n = new Set(sel); gone.posts.forEach(p => n.delete(p.uid)); return n; });
      return next;
    });
  }
  function deletePost(id: number, uid: string) {
    setIgSearches(prev => { const next = prev.map(s => s.id === id ? { ...s, posts: s.posts.filter(p => p.uid !== uid) } : s).filter(s => s.posts.length); persist(next); return next; });
    setIgSel(prev => { const n = new Set(prev); n.delete(uid); return n; });
  }
  function selectAllGroup(s: IgSearch) {
    const allOn = s.posts.every(p => igSel.has(p.uid));
    setIgSel(prev => { const n = new Set(prev); s.posts.forEach(p => allOn ? n.delete(p.uid) : n.add(p.uid)); return n; });
  }

  async function importSelected() {
    if (!activeCompanyId) { toast.error('Selecione uma empresa.'); return; }
    if (!igSel.size) { toast.error('Marque ao menos um post.'); return; }
    // junta os posts escolhidos de todos os grupos, cada um levando seu @ (handle)
    const chosen = igSearches.flatMap(s => s.posts.filter(p => igSel.has(p.uid)).map(p => ({ ...p, handle: s.handle })));
    if (!chosen.length) { toast.error('Marque ao menos um post.'); return; }
    setImporting(true);
    const t = toast.loading(`Baixando e analisando ${chosen.length} post(s)…`);
    const { data, error } = await supabase.functions.invoke('studio-import-instagram', {
      body: { action: 'import', company_id: activeCompanyId, created_by: user?.id, posts: chosen },
    });
    toast.dismiss(t);
    setImporting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.message || (data as any)?.error || error?.message || 'Falha na importação.');
      return;
    }
    toast.success(`${(data as any)?.imported || 0} post(s) importado(s). Analisando…`);
    // tira os importados dos grupos e some com grupos que ficaram vazios
    setIgSearches(prev => {
      const next = prev.map(s => ({ ...s, posts: s.posts.filter(p => !igSel.has(p.uid)) })).filter(s => s.posts.length);
      persist(next); return next;
    });
    setIgSel(new Set());
    load();
  }

  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(n);

  // ordena os posts de um grupo na tela (não raspa de novo) — cada grupo tem seu próprio sort
  const sortPosts = (posts: IgPost[], sort: IgSort) => {
    const key = (p: IgPost) =>
      sort === 'views' ? p.views : sort === 'likes' ? p.likes : sort === 'comments' ? p.comments
      : sort === 'recent' ? (p.ts ? Date.parse(p.ts) : 0) : (p.views + p.likes + p.comments);
    return [...posts].sort((a, b) => key(b) - key(a));
  };
  const SORTS: [IgSort, string][] = [['eng', 'Engajamento'], ['views', 'Views'], ['likes', 'Curtidas'], ['comments', 'Comentários'], ['recent', 'Recentes']];
  const totalSel = igSel.size;

  // crescimento de seguidores do concorrente ao longo do tempo (a partir dos snapshots salvos)
  const handleKey = igSearches.map(s => s.handle).join('|');
  useEffect(() => {
    const handles = [...new Set(igSearches.map(s => s.handle))];
    if (!handles.length || !activeCompanyId) { setGrowth({}); return; }
    (async () => {
      const { data } = await supabase.from('studio_profile_snapshots')
        .select('handle,followers,captured_at')
        .eq('company_id', activeCompanyId).in('handle', handles)
        .order('captured_at', { ascending: true });
      const by: Record<string, { f: number; t: number }[]> = {};
      (data || []).forEach((r: any) => { if (r.followers == null) return; (by[r.handle] ||= []).push({ f: r.followers, t: Date.parse(r.captured_at) }); });
      const now = Date.now();
      const calc = (arr: { f: number; t: number }[], days: number): number | null => {
        if (arr.length < 2) return null;
        const cur = arr[arr.length - 1].f;
        const before = [...arr].reverse().find(x => x.t <= now - days * 86400000);
        if (!before || !before.f) return null;
        return ((cur - before.f) / before.f) * 100;
      };
      const g: Record<string, Growth> = {};
      handles.forEach(h => {
        const arr = by[h] || [];
        g[h] = { week: calc(arr, 7), month: calc(arr, 30), year: calc(arr, 365), since: arr.length ? new Date(arr[0].t).toLocaleDateString('pt-BR') : null };
      });
      setGrowth(g);
    })();
  }, [handleKey, activeCompanyId, growthTick]);

  // chip de variação (▲ verde sobe / ▼ vermelho cai). Cinza "–" enquanto não há histórico ainda.
  const growthChip = (label: string, val: number | null) => {
    if (val == null) return (
      <span className="inline-flex items-center gap-0.5 text-gray-300" title={`Sem histórico de ${label} ainda — aparece quando houver medição anterior`}>
        <span className="text-[9px]">▲▼</span>–<span className="font-normal">/{label}</span>
      </span>
    );
    const up = val >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-600'}`}>
        {up ? '▲' : '▼'}{Math.abs(val).toFixed(1)}%<span className="text-gray-400 font-normal">/{label}</span>
      </span>
    );
  };

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
              <input value={igHandle} onChange={e => { setIgHandle(e.target.value); setIgInfo(null); }} placeholder="@concorrente (ou link do perfil)"
                onKeyDown={e => { if (e.key === 'Enter') scanInstagram(); }}
                className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select value={igType} onChange={e => setIgType(e.target.value as any)} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
                <option value="all">Vídeos e fotos</option>
                <option value="video">Só vídeos</option>
                <option value="image">Só fotos</option>
              </select>
              <select value={igDepth} onChange={e => setIgDepth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-2 text-sm" title="Quantos posts recentes vasculhar (é um teto: traz no máximo isso)">
                <option value={60}>Até 60</option>
                <option value={120}>Até 120</option>
                <option value={240}>Até 240</option>
                <option value={400}>Tudo (máx. 400)</option>
              </select>
              <button onClick={checkInstagram} disabled={checking || scanning || importing}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50" title="Ver quantos posts o perfil tem antes de buscar">
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Verificar
              </button>
              <button onClick={scanInstagram} disabled={scanning || importing}
                className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Buscar posts
              </button>
            </div>

            {igInfo && (
              <div className="text-xs bg-[#f8f7f5] border border-[#ddd0cc] rounded-lg px-3 py-2 text-gray-600">
                <strong>{igInfo.profile}</strong>
                {igInfo.postsCount != null ? <> tem <strong>{igInfo.postsCount.toLocaleString('pt-BR')} posts</strong></> : ' é público'}
                {igInfo.followers != null && <> · <strong>{igInfo.followers.toLocaleString('pt-BR')}</strong> seguidores</>}.
                {igInfo.postsCount != null && igInfo.postsCount < igDepth && <> Como tem menos que {igDepth}, a busca traz os <strong>{igInfo.postsCount}</strong>.</>}
              </div>
            )}

            {/* Grupos de busca (colapsáveis) — Pilão, Melitta… cada um com seu próprio filtro, apagar-grupo e apagar-post */}
            {igSearches.map(s => {
              const selInGroup = s.posts.filter(p => igSel.has(p.uid)).length;
              const allOn = selInGroup === s.posts.length && s.posts.length > 0;
              const nVid = s.posts.filter(p => p.isVideo).length;
              const nImg = s.posts.length - nVid;
              return (
                <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#f8f7f5] border-b border-gray-200">
                    <button onClick={() => toggleCollapse(s.id)} className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm flex-shrink-0">
                      {s.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {s.handle}
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400">
                        <strong className="text-gray-600">{s.posts.length}</strong> carregados
                        {nVid > 0 && <> · {nVid} reels</>}{nImg > 0 && <> · {nImg} fotos</>}
                        {s.postsProfile != null && <> · {s.postsProfile.toLocaleString('pt-BR')} no perfil</>}
                        {selInGroup ? ` · ${selInGroup} sel.` : ''}
                      </div>
                      {(s.followers != null || growth[s.handle]?.week != null) && (
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap font-semibold">
                          {s.followers != null && <span>{s.followers.toLocaleString('pt-BR')} seguidores</span>}
                          {growthChip('sem', growth[s.handle]?.week ?? null)}
                          {growthChip('mês', growth[s.handle]?.month ?? null)}
                          {growthChip('ano', growth[s.handle]?.year ?? null)}
                          {growth[s.handle]?.week == null && growth[s.handle]?.since && <span className="text-gray-400 font-normal">medindo desde {growth[s.handle]?.since}</span>}
                        </div>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => verifyGroup(s)} disabled={checkingGroup === s.id}
                        title="Atualizar seguidores/posts deste perfil (barato, sem raspar posts)"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline disabled:opacity-50">
                        {checkingGroup === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Verificar
                      </button>
                      {!s.collapsed && (
                        <button onClick={() => selectAllGroup(s)} className="text-xs font-semibold text-[#8B2214] hover:underline">
                          {allOn ? 'Limpar' : 'Selecionar todos'}
                        </button>
                      )}
                      <button onClick={() => deleteSearch(s.id)} title="Apagar esta busca" className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {!s.collapsed && (
                    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-gray-100">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><ArrowDownWideNarrow className="w-3.5 h-3.5" /> Ordenar:</span>
                      {SORTS.map(([k, l]) => (
                        <button key={k} onClick={() => setGroupSort(s.id, k)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.sort === k ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                  {!s.collapsed && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto p-2.5">
                      {sortPosts(s.posts, s.sort).map(p => {
                        const on = igSel.has(p.uid);
                        return (
                          <div key={p.uid} className={`relative aspect-square rounded-lg overflow-hidden border-2 group ${on ? 'border-[#8B2214] ring-2 ring-[#8B2214]/30' : 'border-transparent hover:border-gray-300'}`}>
                            <button onClick={() => toggleSel(p.uid)} className="absolute inset-0 w-full h-full">
                              {p.thumb
                                ? <img src={thumbUrl(p.thumb)} alt="" loading="lazy" className="w-full h-full object-cover bg-gray-100"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                                : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300"><Clapperboard className="w-6 h-6" /></div>}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 flex items-center gap-1.5 text-[10px] font-semibold text-white">
                                {p.isVideo && <span className="flex items-center gap-0.5"><PlayCircle className="w-3 h-3" />{fmt(p.views)}</span>}
                                <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{fmt(p.likes)}</span>
                                <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{fmt(p.comments)}</span>
                              </div>
                              <div className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center ${on ? 'bg-[#8B2214] text-white' : 'bg-white/80 text-transparent'}`}>
                                <Check className="w-3.5 h-3.5" />
                              </div>
                              {p.isVideo && <span className="absolute bottom-6 right-1.5 bg-black/60 text-white text-[9px] px-1 rounded">REEL</span>}
                            </button>
                            {/* apagar post individual */}
                            <button onClick={() => deletePost(s.id, p.uid)} title="Apagar este post"
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 z-10">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Barra de importar — aparece quando há seleção (soma de todos os grupos) */}
            {totalSel > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                <span className="text-xs text-gray-500">
                  <strong>{totalSel}</strong> selecionado(s) · custo estimado <strong>~US$ {(totalSel * COST_PER_POST).toFixed(2)}</strong>
                </span>
                <button onClick={importSelected} disabled={importing}
                  className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Analisar selecionados
                </button>
              </div>
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
