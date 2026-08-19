import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Megaphone, Loader2, Upload, Film, Image as ImageIcon, CheckCircle2, Check, AlertTriangle, Sparkles } from 'lucide-react';

const PLATFORMS: [string, string][] = [
  ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['ecommerce', 'E-commerce'],
];
const STATUSES: [string, string][] = [['draft', 'Rascunho'], ['scheduled', 'Agendada'], ['published', 'Publicada']];

export interface Campaign {
  id: string; video_id: string | null; company_id: string | null;
  title: string; platform: string; content: string | null; prompt_used: string | null;
  status: string; scheduled_at: string | null; created_at: string;
  external_url?: string | null; published_at?: string | null;
  media_path?: string | null; media_type?: string | null; platform_post_id?: string | null;
}

// Cria (a partir da análise, podendo publicar em VÁRIAS redes de uma vez) OU edita 1 campanha.
export default function CampaignCreator({ videoId, companyId, campaign, initialTitle, initialContent, initialCaptions, promptUsed, sourceMediaPath, sourceMediaType, sourceIsOwnArt, sourceThumbUrl, onClose, onSaved }: {
  videoId?: string | null; companyId: string | null; campaign?: Campaign;
  initialTitle?: string; initialContent?: string; initialCaptions?: Record<string, string>; promptUsed?: string;
  sourceMediaPath?: string | null; sourceMediaType?: string | null; sourceIsOwnArt?: boolean; sourceThumbUrl?: string | null;
  onClose: () => void; onSaved?: () => void;
}) {
  const editing = !!campaign;
  // Ao editar: 1 plataforma (a da campanha). Ao criar: pode marcar várias.
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(editing ? [campaign!.platform] : ['instagram']));
  const [title, setTitle] = useState(campaign?.title || initialTitle || '');
  // legenda por plataforma (cada rede tem a sua). Semeada pela análise.
  const seed: Record<string, string> = { ...(initialCaptions || {}) };
  const [captions, setCaptions] = useState<Record<string, string>>(() => {
    if (editing) return { [campaign!.platform]: campaign!.content ?? '' };
    return seed;
  });
  const [status, setStatus] = useState(campaign?.status || 'draft');
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
  const [externalUrl, setExternalUrl] = useState(campaign?.external_url || '');
  const [saving, setSaving] = useState(false);
  // Numa campanha NOVA a partir de uma arte PRÓPRIA (upload seu, não vídeo de concorrente),
  // já reaproveita a mídia do item — não precisa subir de novo. Pode trocar se quiser.
  const [mediaPath, setMediaPath] = useState<string | null>(campaign?.media_path ?? (!editing && sourceIsOwnArt ? (sourceMediaPath ?? null) : null));
  const [mediaType, setMediaType] = useState<string | null>(campaign?.media_type ?? (!editing && sourceIsOwnArt ? (sourceMediaType ?? null) : null));
  const [uploading, setUploading] = useState(false);
  // Assistente de legenda com IA: a partir da ARTE anexada + a IDEIA do usuário + os guardrails da marca.
  const [aiNotes, setAiNotes] = useState('');
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  async function generateCaption(p: string) {
    setAiBusy(p);
    const { data, error } = await supabase.functions.invoke('studio-caption', {
      body: { company_id: companyId, media_path: mediaPath, notes: aiNotes, network: p, current: capOf(p) },
    });
    setAiBusy(null);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || 'Falha ao gerar a legenda.'); return; }
    const cap = (data as any)?.caption || '';
    if (!cap) { toast.error('A IA não devolveu legenda. Tente de novo.'); return; }
    setCap(p, cap);
    const n = (data as any)?.notes_ia;
    toast.success('Legenda gerada — revise e ajuste.' + (n ? ` (${n})` : ''));
  }

  function togglePlatform(k: string) {
    if (editing) return;
    setPlatforms(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    setCaptions(prev => prev[k] !== undefined ? prev : { ...prev, [k]: seed[k] ?? initialContent ?? seed['instagram'] ?? '' });
  }
  const capOf = (k: string) => captions[k] ?? seed[k] ?? initialContent ?? '';
  const setCap = (k: string, v: string) => setCaptions(prev => ({ ...prev, [k]: v }));

  async function uploadMedia(file: File) {
    if (!companyId) { toast.error('Selecione uma empresa.'); return; }
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name);
    const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isVid && !isImg) { toast.error('Envie uma imagem (JPG/PNG) ou vídeo (MP4).'); return; }
    setUploading(true);
    const ext = (file.name.split('.').pop() || (isVid ? 'mp4' : 'jpg')).toLowerCase();
    const path = `campaigns/${companyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('studio-videos').upload(path, file, { contentType: file.type || undefined, upsert: false });
    setUploading(false);
    if (error) { toast.error('Erro no upload: ' + error.message); return; }
    setMediaPath(path); setMediaType(isVid ? 'video' : 'image');
    toast.success('Arte anexada!');
  }

  async function save() {
    if (!title.trim()) { toast.error('Dê um título à campanha.'); return; }
    const list = [...platforms];
    if (!list.length) { toast.error('Escolha ao menos uma rede.'); return; }
    if (list.includes('tiktok') && mediaType === 'image') {
      toast.error('O TikTok só aceita vídeo (MP4 9:16). Anexe um vídeo ou desmarque o TikTok.'); return;
    }
    setSaving(true);
    const schedIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;

    if (editing) {
      const finalStatus = status;
      const { error } = await supabase.from('studio_campaigns').update({
        title: title.trim(), platform: list[0], content: capOf(list[0]), status: finalStatus,
        scheduled_at: schedIso, external_url: externalUrl.trim() || null,
        media_path: mediaPath, media_type: mediaType,
        published_at: finalStatus === 'published' ? (campaign!.published_at || new Date().toISOString()) : null,
      }).eq('id', campaign!.id);
      setSaving(false);
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      toast.success('Campanha atualizada!');
      onSaved?.(); onClose(); return;
    }

    // criar: 1 linha por rede escolhida (cada uma com sua legenda), mídia e agenda compartilhadas
    const finalStatus = schedIso ? 'scheduled' : 'draft';
    const rows = list.map(p => ({
      title: title.trim(), platform: p, content: capOf(p), status: finalStatus,
      scheduled_at: schedIso, media_path: mediaPath, media_type: mediaType,
      video_id: videoId ?? null, company_id: companyId, prompt_used: promptUsed || null,
    }));
    const { error } = await supabase.from('studio_campaigns').insert(rows);
    setSaving(false);
    if (error) { toast.error('Erro ao criar: ' + error.message); return; }
    toast.success(`${rows.length} campanha(s) criada(s)${schedIso ? ' e agendada(s)' : ''}!`);
    onSaved?.(); onClose();
  }

  const selected = [...platforms];

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
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
              {editing ? 'Plataforma' : 'Publicar em (marque uma ou várias)'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(([k, l]) => {
                const on = platforms.has(k);
                return (
                  <button key={k} onClick={() => togglePlatform(k)} disabled={editing}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border ${on ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'} ${editing ? 'opacity-70 cursor-default' : ''}`}>
                    {!editing && on && <Check className="w-3.5 h-3.5" />}{l}
                  </button>
                );
              })}
            </div>
            {platforms.has('tiktok') && mediaType === 'image' && (
              <p className="text-[11px] text-red-600 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> O TikTok só publica <strong>vídeo</strong> (MP4 9:16). Anexe um vídeo ou desmarque o TikTok.
              </p>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Título da campanha <span className="font-normal text-gray-400">(interno — só pra você organizar, não vai pras redes)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Café Saporino Clássico Tradicional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Assistente de IA: sua ideia + a arte + guardrails da marca → legenda pronta */}
          <div className="bg-[#f8f7f5] border border-[#ddd0cc] rounded-lg p-3">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 text-[#8B2214]" /> Sua ideia / rascunho <span className="font-normal text-gray-400">(opcional — a IA escreve a legenda a partir disto + a arte anexada + os guardrails da marca)</span>
            </label>
            <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)} rows={3}
              placeholder="Ex.: post de recrutamento de vendedores PJ, tom profissional B2B, destacar regiões de SP e o portfólio — ou cole aqui o rascunho que você já tem."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y bg-white" />
            <p className="text-[11px] text-gray-400 mt-1">Clique em <strong>Escrever com IA</strong> em cada rede abaixo. Ela respeita os guardrails da marca — não inventa preço, promoção nem claim.</p>
          </div>

          {/* Uma legenda por rede escolhida (cada rede tem a sua — é isso que aparece publicamente) */}
          {selected.map(p => (
            <div key={p}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-gray-500">
                  Legenda {PLATFORMS.find(x => x[0] === p)?.[1] || p} <span className="font-normal text-gray-400">(aparece na rede + ajuda no SEO/busca)</span>
                </label>
                <button type="button" onClick={() => generateCaption(p)} disabled={aiBusy === p}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8B2214] hover:bg-[#f5f0ef] rounded px-2 py-1 disabled:opacity-50">
                  {aiBusy === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Escrever com IA
                </button>
              </div>
              <textarea value={capOf(p)} onChange={e => setCap(p, e.target.value)} rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y" />
            </div>
          ))}

          {/* Arte final da Saporino que vai ser PUBLICADA (não é o vídeo do concorrente) */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Arte para publicar (imagem ou vídeo da Saporino)</label>
            {mediaPath ? (
              <div className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800">
                {sourceThumbUrl && mediaPath === sourceMediaPath ? (
                  mediaType === 'video'
                    ? <video src={`${sourceThumbUrl}#t=0.1`} muted playsInline preload="metadata" className="w-9 h-9 rounded object-cover border border-green-200 flex-shrink-0" />
                    : <img src={sourceThumbUrl} alt="arte" className="w-9 h-9 rounded object-cover border border-green-200 flex-shrink-0" />
                ) : (
                  mediaType === 'video' ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />
                )}
                <span className="flex items-center gap-1 font-medium"><CheckCircle2 className="w-4 h-4" /> Arte {mediaPath === sourceMediaPath ? 'deste item' : 'anexada'} ({mediaType === 'video' ? 'vídeo/Reels' : 'imagem'})</span>
                <label className="ml-auto text-xs font-semibold text-[#8B2214] hover:underline cursor-pointer">
                  Trocar
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }} />
                </label>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-4 text-sm text-gray-500 cursor-pointer hover:border-[#8B2214] hover:text-[#8B2214] ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><Upload className="w-4 h-4" /> Anexar imagem ou vídeo</>}
                <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }} />
              </label>
            )}
            <p className="text-[11px] text-gray-400 mt-1">A mesma arte vai pras redes marcadas. Vídeo = Reels/TikTok (MP4 9:16). Sem arte, não dá pra publicar direto.</p>
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
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Agendar para (opcional) — vale pra todas as redes marcadas</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {!editing && <p className="text-[11px] text-gray-400 mt-1">Sem data = rascunho. Com data = agendada (publica sozinho na hora). Hoje o publicar automático vale pra Instagram e TikTok.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} {editing ? 'Salvar' : `Criar ${selected.length > 1 ? selected.length + ' campanhas' : 'campanha'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
