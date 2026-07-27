import { useRef, useState } from 'react';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { extractAudioWav } from '../../lib/extractAudio';

const ACCEPT = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const EXT_OK = /\.(mp4|mov|avi|mkv)$/i;
// Acima disto, extrai o áudio no navegador (o Whisper só aceita 25 MB por envio).
const BIG = 24 * 1024 * 1024;

// Upload de vídeo para o bucket studio-videos + registro em studio_videos (status pending).
// O processamento (transcrição/análise) é feito depois pela Edge Function (próximos passos).
export default function VideoDropzone({ companyId, userId, onUploaded }: {
  companyId: string | null; userId: string | undefined; onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressName, setProgressName] = useState('');
  const [error, setError] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    if (!companyId) { setError('Selecione uma empresa antes de enviar.'); return; }
    setError('');
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type) && !EXT_OK.test(file.name)) {
        setError(`"${file.name}" não é um vídeo suportado (use MP4, MOV, AVI ou MKV).`);
        continue;
      }
      setUploading(true);
      setProgressName(file.name);
      try {
        const ts = Date.now();
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${companyId}/${ts}_${safe}`;
        // Vídeo grande: extrai o áudio no navegador e sobe separado (o Whisper transcreve o áudio, não o vídeo).
        let audioPath: string | null = null;
        if (file.size > BIG) {
          setProgressName(`${file.name} — extraindo áudio…`);
          const audioBlob = await extractAudioWav(file);
          audioPath = `${companyId}/${ts}_${safe}.audio.wav`;
          const { error: aErr } = await supabase.storage.from('studio-videos').upload(audioPath, audioBlob, { contentType: 'audio/wav' });
          if (aErr) throw aErr;
          setProgressName(`${file.name} — enviando…`);
        }
        const { error: upErr } = await supabase.storage.from('studio-videos').upload(path, file, { contentType: file.type || 'video/mp4' });
        if (upErr) throw upErr;
        const { data: row, error: dbErr } = await supabase.from('studio_videos').insert({
          company_id: companyId, created_by: userId ?? null,
          filename: file.name, storage_path: path, audio_path: audioPath, status: 'pending',
        }).select('id').single();
        if (dbErr) throw dbErr;
        // dispara a análise (transcrição + Claude) em background; o status atualiza via realtime
        if (row?.id) supabase.functions.invoke('process-studio-video', { body: { video_id: row.id } }).catch(() => {});
      } catch (e: any) {
        setError(`Erro ao enviar "${file.name}": ${e.message || e}`);
      }
    }
    setUploading(false);
    setProgressName('');
    if (inputRef.current) inputRef.current.value = '';
    onUploaded();
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? 'border-[#8B2214] bg-[#f5f0ef]' : 'border-[#ddd0cc] bg-white hover:bg-[#f8f7f5]'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-9 h-9 mx-auto mb-3 text-[#8B2214] animate-spin" />
            <p className="text-sm font-semibold text-gray-800">Enviando {progressName}…</p>
            <p className="text-xs text-gray-500 mt-1">Não feche a página até terminar.</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-9 h-9 mx-auto mb-3 text-[#8B2214]" />
            <p className="text-sm font-semibold text-gray-800">Arraste um vídeo aqui ou clique para selecionar</p>
            <p className="text-xs text-gray-500 mt-1">Formatos: MP4, MOV, AVI, MKV</p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".mp4,.mov,.avi,.mkv,video/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
    </div>
  );
}
