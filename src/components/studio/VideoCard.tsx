import { useMemo, useState } from 'react';
import { Film, CheckCircle2, Loader2, Clock, AlertCircle, Sparkles, Megaphone, Trash2, RotateCcw, Download, CalendarClock, Send, FileClock } from 'lucide-react';
import { quandoEmSP, faltamPara } from '../../lib/horario';

/** Campanha desta peça que já está agendada ou já saiu. */
export interface StudioPublicacao {
  video_id: string | null;
  platform: string;
  status: string;               // scheduled | published
  scheduled_at: string | null;
  published_at: string | null;
  external_url: string | null;
  publish_error: string | null;
}

export interface StudioVideo {
  id: string; filename: string; storage_path: string; status: string;
  duration: number | null; brand_detected: string | null; created_at: string; error_text: string | null;
  source_url?: string | null; media_type?: string | null; thumbUrl?: string | null;
  publicacoes?: StudioPublicacao[];
}

const REDE: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', ecommerce: 'Loja',
};

// Data e hora saem SEMPRE em horário de Brasília, não no fuso do aparelho de quem abre.
const quando = quandoEmSP;
const faltam = faltamPara;

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: 'Na fila', cls: 'bg-gray-100 text-gray-600', icon: Clock },
  processing: { label: 'Processando', cls: 'bg-amber-100 text-amber-800', icon: Loader2 },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  error: { label: 'Erro', cls: 'bg-red-100 text-red-700', icon: AlertCircle },
};

function tempoAtras(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function VideoCard({ v, onAnalyze, onCampaign, onDelete, onReprocess, onDownload }: {
  v: StudioVideo;
  onAnalyze: (v: StudioVideo) => void;
  onCampaign: (v: StudioVideo) => void;
  onDelete: (v: StudioVideo) => void;
  onReprocess: (v: StudioVideo) => void;
  onDownload: (v: StudioVideo) => void;
}) {
  const st = STATUS[v.status] || STATUS.pending;
  const Icon = st.icon;
  const [aberto, setHistorico] = useState<Record<string, boolean>>({});

  // Uma linha por rede: a que vale AGORA em cima, o resto no histórico.
  // "Vale agora" = a última publicada; se nunca publicou, o agendamento que está de pé;
  // se nem isso, a última tentativa que falhou. Repostar a mesma arte (porque não gostou
  // da primeira) é normal — e aí o que interessa é a data da última, não a lista toda.
  const porRede = useMemo(() => {
    const grupos = new Map<string, StudioPublicacao[]>();
    for (const p of v.publicacoes ?? []) {
      grupos.set(p.platform, [...(grupos.get(p.platform) || []), p]);
    }
    const quandoDe = (p: StudioPublicacao) =>
      new Date(p.published_at || p.scheduled_at || 0).getTime();
    const agora = Date.now();
    return [...grupos.entries()].map(([rede, lista]) => {
      const ordenada = [...lista].sort((a, b) => quandoDe(b) - quandoDe(a));
      const publicadas = ordenada.filter(p => p.status === 'published');
      const falhas = ordenada.filter(p => p.status === 'error' || p.publish_error);
      const agendadas = ordenada.filter(p => p.status === 'scheduled');
      // Agendamento que AINDA VAI acontecer vem primeiro: é o que está por vir. Republicar
      // uma peça para amanhã deixava o card mostrando a publicação de ontem como se fosse
      // a novidade, e o agendamento novo sumia no histórico.
      const proxima = [...agendadas]
        .filter(p => p.scheduled_at && new Date(p.scheduled_at).getTime() > agora)
        .sort((a, b) => quandoDe(a) - quandoDe(b))[0];
      const atual = proxima || publicadas[0] || agendadas[0] || falhas[0] || ordenada[0];
      const rascunhos = ordenada.filter(p => p.status === 'draft');
      return { rede, atual, rascunhos: atual.status === 'draft' ? rascunhos : [], anteriores: ordenada.filter(p => p !== atual && p.status !== 'draft') };
    });
  }, [v.publicacoes]);
  const done = v.status === 'completed';
  const isVideoMedia = v.media_type === 'video' || /\.(mp4|mov|m4v|webm)$/i.test(v.filename || '');
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {v.thumbUrl ? (
          <button type="button" onClick={() => window.open(v.thumbUrl!, '_blank')} title="Ver em tamanho grande"
            className="w-16 h-16 rounded-lg bg-[#f5f0ef] overflow-hidden flex-shrink-0 border border-gray-200 hover:ring-2 hover:ring-[#8B2214]">
            {isVideoMedia
              ? <video src={`${v.thumbUrl}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
              : <img src={v.thumbUrl} alt={v.filename} className="w-full h-full object-cover" />}
          </button>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0">
            <Film className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{v.filename}</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
              <Icon className={`w-3 h-3 ${v.status === 'processing' ? 'animate-spin' : ''}`} /> {st.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {v.brand_detected ? `Marca: ${v.brand_detected} · ` : ''}
            {v.duration ? `${Math.round(v.duration)}s · ` : ''}
            {tempoAtras(v.created_at)}
          </p>
          {v.source_url && (
            <a href={v.source_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              className="text-xs text-[#8B2214] font-medium hover:underline break-all inline-block mt-0.5">🔗 ver post original</a>
          )}
          {v.status === 'error' && v.error_text && (
            <p className="text-xs text-red-600 mt-1">{v.error_text}</p>
          )}
          {v.status === 'processing' && (
            <div className="mt-2 h-1.5 w-full max-w-xs bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-[#8B2214] animate-pulse" />
            </div>
          )}
          {/* Agenda da peça: sem isto é preciso abrir a aba Campanhas para lembrar
              quando a postagem foi programada. UMA linha por rede, com o que vale AGORA —
              repostar a mesma arte é comum, e a lista inteira vira parede. O resto fica
              atrás de "ver histórico". */}
          {porRede.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {porRede.map(({ rede, atual, anteriores, rascunhos }) => {
                const nome = REDE[rede] || rede;
                const historico = anteriores.length > 0 && (
                  <button type="button" onClick={() => setHistorico(h => ({ ...h, [rede]: !h[rede] }))}
                    className="text-gray-500 hover:text-gray-800 underline decoration-dotted">
                    {aberto[rede] ? 'ocultar histórico' : `+${anteriores.length} ${anteriores.length > 1 ? 'anteriores' : 'anterior'}`}
                  </button>
                );
                const falhou = atual.status === 'error' || !!atual.publish_error;
                return (
                  <div key={rede} className="flex flex-col gap-0.5">
                    {atual.status === 'published' && atual.published_at ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                        <Send className="w-3 h-3 flex-shrink-0" />
                        Publicado no {nome} em {quando(atual.published_at)}
                        {atual.external_url && (
                          <a href={atual.external_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="font-semibold underline">ver post</a>
                        )}
                        {historico}
                      </span>
                    ) : falhou ? (
                      <span className="inline-flex items-start gap-1.5 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>Não publicou no {nome}{atual.scheduled_at ? ` (era para ${quando(atual.scheduled_at)})` : ''}{atual.publish_error ? `: ${atual.publish_error}` : ''} {historico}</span>
                      </span>
                    ) : atual.scheduled_at ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#8B2214]">
                        <CalendarClock className="w-3 h-3 flex-shrink-0" />
                        Agendado no {nome} para {quando(atual.scheduled_at)} <span className="text-gray-500">({faltam(atual.scheduled_at)})</span>
                        {historico}
                      </span>
                    ) : atual.status === 'draft' ? (
                      // Campanha criada e esquecida no rascunho: o card tem de dizer que
                      // ela NÃO foi ao ar, senão silêncio passa por "está tudo certo".
                      <span className="inline-flex items-start gap-1.5 text-xs text-amber-700">
                        <FileClock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>
                          {rascunhos.length > 1 ? `${rascunhos.length} campanhas` : 'Campanha'} de {nome} em rascunho — <strong>ainda não foi ao ar</strong>.
                          {' '}Abra <strong>Campanhas</strong> e clique em “Publicar agora”, ou coloque data para agendar.
                        </span>
                      </span>
                    ) : null}

                    {aberto[rede] && anteriores.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 pl-4">
                        {p.status === 'published' && p.published_at
                          ? <>· publicado em {quando(p.published_at)}
                              {p.external_url && <a href={p.external_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="underline">ver</a>}</>
                          : <>· falhou{p.scheduled_at ? ` em ${quando(p.scheduled_at)}` : ''}{p.publish_error ? `: ${p.publish_error}` : ''}</>}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onDownload(v)} title="Baixar para o computador" className="p-1.5 rounded text-gray-400 hover:text-[#8B2214] hover:bg-gray-50">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(v)} title="Excluir" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {(done || v.status === 'error') && (
        <div className="flex flex-wrap gap-2 mt-3">
          {done && (
            <>
              <button onClick={() => onAnalyze(v)}
                className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-3 py-2 rounded-lg">
                <Sparkles className="w-4 h-4" /> Ver Análise
              </button>
              <button onClick={() => onCampaign(v)}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-3 py-2 rounded-lg">
                <Megaphone className="w-4 h-4" /> Criar Campanha
              </button>
            </>
          )}
          <button onClick={() => onReprocess(v)}
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-3 py-2 rounded-lg">
            <RotateCcw className="w-4 h-4" /> Reprocessar
          </button>
        </div>
      )}
    </div>
  );
}
