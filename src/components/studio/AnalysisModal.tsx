import { useState, useEffect } from 'react';
import { X, Loader2, FileText, Target, Wand2, Sparkles, Megaphone, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PromptCard from './PromptCard';
import CampaignCreator from './CampaignCreator';
import type { StudioVideo } from './VideoCard';

type Tab = 'resumo' | 'estrategia' | 'reproduzir' | 'prompts' | 'publicar';

// Remove flags do Midjourney (--ar, --v, --stylize, etc.) pra o prompt de imagem colar limpo no ChatGPT.
function forChatGPT(s?: string | null) {
  const t = (s || '').replace(/\s*--[a-z]+(\s+[0-9a-z:.]+)?/gi, '').trim();
  return t;
}

// Bloco de rótulo + texto.
function Campo({ label, children }: { label: string; children: any }) {
  if (!children) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{children}</p>
    </div>
  );
}
function Chips({ label, items }: { label: string; items?: any[] }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => <span key={i} className="text-xs bg-[#f5f0ef] text-[#8B2214] rounded-full px-2.5 py-1 font-medium">{String(it)}</span>)}
      </div>
    </div>
  );
}
function Lista({ label, items, cls }: { label: string; items?: any[]; cls?: string }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className={`text-sm leading-relaxed flex gap-2 ${cls || 'text-gray-700'}`}><span>•</span><span>{String(it)}</span></li>)}
      </ul>
    </div>
  );
}

const TABS: [Tab, string, any][] = [
  ['resumo', 'Resumo', FileText], ['estrategia', 'Estratégia', Target],
  ['reproduzir', 'Como Reproduzir', Wand2], ['prompts', 'Prompts', Sparkles], ['publicar', 'Publicar', Megaphone],
];

export default function AnalysisModal({ video, companyId, initialTab = 'resumo', onClose }: {
  video: StudioVideo; companyId: string | null; initialTab?: Tab; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [a, setA] = useState<any>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCampaign, setShowCampaign] = useState(false);
  const [copiedLegenda, setCopiedLegenda] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: an }, { data: tr }] = await Promise.all([
        supabase.from('studio_analyses').select('*').eq('video_id', video.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('studio_transcriptions').select('full_text').eq('video_id', video.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setA(an || {});
      setTranscript((tr as any)?.full_text || '');
      setLoading(false);
    })();
  }, [video.id]);

  const av = a?.analise_visual || {};
  const prompts = a?.prompts || {};
  const legendas = a?.legendas || {};

  // junta um mix de hashtags (3-6) na legenda, sem repetir as que já estão no texto
  const hashtags: string[] = a?.hashtags || [];
  const mergeTags = (c?: string) => {
    const base = (c || '').trim();
    if (!base) return base;
    const have = base.toLowerCase();
    const add = hashtags.map(t => (String(t).startsWith('#') ? String(t) : '#' + t)).filter(t => !have.includes(t.toLowerCase())).slice(0, 6);
    return add.length ? `${base}\n\n${add.join(' ')}` : base;
  };
  // título interno limpo (tira o parêntese comprido da marca detectada)
  const cleanBrand = String(video.brand_detected || '').replace(/\(.*/s, '').trim();
  const campaignTitle = cleanBrand || 'Café Saporino';
  const campaignCaptions: Record<string, string> = {
    instagram: mergeTags(legendas.instagram),
    facebook: mergeTags(legendas.instagram),
    tiktok: mergeTags(legendas.tiktok),
    youtube: legendas.youtube || '',
  };

  async function copyLegenda(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopiedLegenda(key); setTimeout(() => setCopiedLegenda(''), 1500); } catch { /* noop */ }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 truncate flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#8B2214]" /> Análise — {video.filename}</h3>
            {video.brand_detected && <p className="text-xs text-gray-500 truncate">Marca detectada: {video.brand_detected}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-2 border-b border-gray-200 overflow-x-auto">
          {TABS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${tab === k ? 'border-[#8B2214] text-[#8B2214]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" /> {l}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>
          ) : !a?.resumo && tab !== 'prompts' && tab !== 'publicar' ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem análise disponível. Tente Reprocessar o vídeo.</p>
          ) : (
            <>
              {tab === 'resumo' && (
                <div className="space-y-4">
                  {a.adaptacao_marca && (
                    <div className="rounded-xl border border-[#ddd0cc] bg-[#f5f0ef] p-3">
                      <p className="text-[11px] font-bold text-[#8B2214] uppercase tracking-wide mb-1">🎯 Adaptação pra sua marca</p>
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{a.adaptacao_marca}</p>
                    </div>
                  )}
                  <Campo label="Resumo">{a.resumo}</Campo>
                  <Campo label="Objetivo">{a.objetivo}</Campo>
                  <Campo label="Público-alvo">{a.publico_alvo}</Campo>
                  <Campo label="Gancho (primeiros segundos)">{a.gancho}</Campo>
                  <div className="flex flex-wrap gap-4">
                    <Campo label="Nível de dificuldade">{a.nivel_dificuldade}</Campo>
                    <Campo label="Tempo estimado">{av.tempo_estimado}</Campo>
                  </div>
                </div>
              )}
              {tab === 'estrategia' && (
                <div className="space-y-4">
                  <Campo label="Estratégia">{a.estrategia}</Campo>
                  <Campo label="Estrutura narrativa">{av.estrutura_narrativa}</Campo>
                  <Campo label="Copywriting">{av.copywriting}</Campo>
                  <Chips label="Gatilhos psicológicos" items={a.gatilhos} />
                  <Lista label="Pontos fortes" items={a.pontos_fortes} cls="text-green-700" />
                  <Lista label="Pontos fracos" items={a.pontos_fracos} cls="text-red-600" />
                </div>
              )}
              {tab === 'reproduzir' && (
                <div className="space-y-4">
                  <Campo label="Como reproduzir">{a.como_reproduzir}</Campo>
                  <Campo label="Workflow (passo a passo)">{a.workflow}</Campo>
                  <Campo label="Como melhorar">{a.como_melhorar}</Campo>
                  <Campo label="Como vender / aplicar no negócio">{a.como_vender}</Campo>
                  {transcript && (
                    <details className="border border-gray-200 rounded-xl">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700 bg-[#f8f7f5]">Ver transcrição completa</summary>
                      <p className="p-3 text-xs text-gray-600 whitespace-pre-line leading-relaxed">{transcript}</p>
                    </details>
                  )}
                </div>
              )}
              {tab === 'prompts' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Prompts prontos pra recriar/adaptar este vídeo. Clique em Copiar e cole na ferramenta.</p>
                  <PromptCard label="Claude" value={prompts.claude} />
                  <PromptCard label="ChatGPT / GPT" value={prompts.gpt} />
                  <PromptCard label="Google Veo (vídeo)" value={prompts.veo} />
                  <PromptCard label="Runway (vídeo)" value={prompts.runway} />
                  <PromptCard label="Imagem (ChatGPT)" value={forChatGPT(prompts.midjourney)} />
                  <PromptCard label="Vídeo — roteiro de edição (DaVinci)" value={prompts.capcut} />
                  {!prompts.claude && !prompts.gpt && !prompts.veo && <p className="text-sm text-gray-400 text-center py-6">Nenhum prompt gerado. Tente Reprocessar.</p>}
                </div>
              )}
              {tab === 'publicar' && (
                <div className="space-y-4">
                  {[['instagram', 'Legenda Instagram'], ['tiktok', 'Legenda TikTok'], ['youtube', 'Título YouTube']].map(([k, l]) => legendas[k] ? (
                    <div key={k} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-[#f8f7f5] border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{l}</span>
                        <button onClick={() => copyLegenda(k, legendas[k])} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline">
                          {copiedLegenda === k ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                        </button>
                      </div>
                      <p className="p-3 text-sm text-gray-700 whitespace-pre-line">{legendas[k]}</p>
                    </div>
                  ) : null)}
                  <Chips label="Hashtags" items={a?.hashtags} />
                  <button onClick={() => setShowCampaign(true)}
                    className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    <Megaphone className="w-4 h-4" /> Criar campanha com isto
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCampaign && (
        <CampaignCreator
          videoId={video.id} companyId={companyId}
          sourceMediaPath={video.storage_path} sourceMediaType={video.media_type}
          sourceIsOwnArt={!video.source_url} sourceThumbUrl={video.thumbUrl}
          initialTitle={campaignTitle}
          initialContent={campaignCaptions.instagram || campaignCaptions.tiktok || ''}
          initialCaptions={campaignCaptions}
          promptUsed={prompts.claude || ''}
          onClose={() => setShowCampaign(false)}
        />
      )}
    </div>
  );
}
