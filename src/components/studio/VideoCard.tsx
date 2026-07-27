import { Film, CheckCircle2, Loader2, Clock, AlertCircle, Sparkles, Megaphone, Trash2, RotateCcw } from 'lucide-react';

export interface StudioVideo {
  id: string; filename: string; storage_path: string; status: string;
  duration: number | null; brand_detected: string | null; created_at: string; error_text: string | null;
}

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

export default function VideoCard({ v, onAnalyze, onCampaign, onDelete, onReprocess }: {
  v: StudioVideo;
  onAnalyze: (v: StudioVideo) => void;
  onCampaign: (v: StudioVideo) => void;
  onDelete: (v: StudioVideo) => void;
  onReprocess: (v: StudioVideo) => void;
}) {
  const st = STATUS[v.status] || STATUS.pending;
  const Icon = st.icon;
  const done = v.status === 'completed';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0">
          <Film className="w-5 h-5" />
        </div>
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
          {v.status === 'error' && v.error_text && (
            <p className="text-xs text-red-600 mt-1">{v.error_text}</p>
          )}
          {v.status === 'processing' && (
            <div className="mt-2 h-1.5 w-full max-w-xs bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-[#8B2214] animate-pulse" />
            </div>
          )}
        </div>
        <button onClick={() => onDelete(v)} title="Excluir" className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-50 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
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
