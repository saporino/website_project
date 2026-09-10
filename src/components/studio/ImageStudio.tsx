// COFICO Studio — criar imagem.
//
// A pessoa escreve o que quer em português comum e recebe a imagem aqui
// dentro. Não existe campo de "prompt": o prompt técnico é montado no
// servidor, a partir do briefing + identidade da marca + formato.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Sparkles, Download, Check, X, RefreshCw, ImagePlus, Loader2 } from 'lucide-react';

type Formato = 'feed' | 'story';

const FORMATOS: { id: Formato; rotulo: string; medida: string; classe: string }[] = [
  { id: 'feed', rotulo: 'Instagram Feed', medida: '4:5 · 1088×1360', classe: 'aspect-[4/5]' },
  { id: 'story', rotulo: 'Story / WhatsApp', medida: '9:16 · 1152×2048', classe: 'aspect-[9/16]' },
];

const EXEMPLOS = [
  'Faça uma oferta deste café',
  'Crie um bom dia com xícara na mesa',
  'Post institucional sobre nossa torra',
  'Quero divulgar meu café gourmet',
];

interface Geracao {
  id: string;
  url: string | null;
  format: Formato;
  brief: string;
  outcome: string | null;
  created_at: string;
}

export default function ImageStudio({ companyId }: { companyId: string | null }) {
  const [formato, setFormato] = useState<Formato>('feed');
  const [brief, setBrief] = useState('');
  const [referencia, setReferencia] = useState<string | null>(null);
  const [enviandoRef, setEnviandoRef] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [atual, setAtual] = useState<{ id: string; url: string; aviso: string | null } | null>(null);
  const [historico, setHistorico] = useState<Geracao[]>([]);

  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('studio-image', {
      body: { company_id: companyId, ...body },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [companyId]);

  const carregarHistorico = useCallback(async () => {
    if (!companyId) return;
    try {
      const d = await chamar({ action: 'listar' });
      setHistorico(d.geracoes ?? []);
    } catch { /* histórico vazio não impede criar */ }
  }, [companyId, chamar]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  // "Gerar outra" manda o id da primeira como pai: é assim que se conta
  // quantas tentativas um mesmo pedido precisou até alguém aprovar.
  async function gerar(parentId?: string) {
    if (!companyId) { toast.error('Escolha a marca primeiro.'); return; }
    if (brief.trim().length < 5) { toast.error('Escreva o que você quer na imagem.'); return; }
    setGerando(true);
    try {
      const d = await chamar({
        brief: brief.trim(), format: formato,
        reference_path: referencia, parent_id: parentId ?? null,
      });
      setAtual({ id: d.generation_id, url: d.url, aviso: d.aviso_ativo ?? null });
      carregarHistorico();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar.');
    } finally {
      setGerando(false);
    }
  }

  async function decidir(outcome: 'aprovada' | 'rejeitada') {
    if (!atual) return;
    try {
      await chamar({ action: 'outcome', generation_id: atual.id, outcome });
      toast.success(outcome === 'aprovada' ? 'Aprovada.' : 'Rejeitada.');
      if (outcome === 'rejeitada') setAtual(null);
      carregarHistorico();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falhou.');
    }
  }

  async function baixar(id: string, url: string) {
    try {
      // Marca o download no servidor; o arquivo vem da URL assinada.
      await chamar({ action: 'url', generation_id: id, download: true });
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cofico-studio-${id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  }

  async function subirReferencia(file: File) {
    if (!companyId) return;
    setEnviandoRef(true);
    // Caminho começa pelo company_id: o servidor confere esse prefixo antes de
    // aceitar o ativo, para ninguém apontar para a embalagem de outra marca.
    const caminho = `${companyId}/ref-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('studio-videos')
      .upload(caminho, file, { contentType: file.type || undefined });
    setEnviandoRef(false);
    if (error) { toast.error('Erro no upload: ' + error.message); return; }
    setReferencia(caminho);
    toast.success('Ativo anexado.');
  }

  const f = FORMATOS.find(x => x.id === formato)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ---------- Pedido ---------- */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
        <div>
          <h3 className="font-bold text-gray-900">Criar imagem</h3>
          <p className="text-sm text-gray-500">Escreva o que você precisa. O resto é com o Studio.</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Formato</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMATOS.map(o => (
              <button key={o.id} type="button" onClick={() => setFormato(o.id)}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  formato === o.id ? 'border-[#8B2214] bg-[#8B2214]/5' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="block text-sm font-semibold text-gray-900">{o.rotulo}</span>
                <span className="block text-[11px] text-gray-500">{o.medida}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">O que você quer</label>
          <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4}
            placeholder="Ex.: uma oferta do nosso café tradicional, com clima de manhã"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#8B2214]" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXEMPLOS.map(x => (
              <button key={x} type="button" onClick={() => setBrief(x)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:border-gray-400">
                {x}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Ativo da marca <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
          </label>
          {referencia ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="truncate text-xs text-gray-600">{referencia.split('/').pop()}</span>
              <button type="button" onClick={() => setReferencia(null)} className="text-xs font-semibold text-[#8B2214]">remover</button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 hover:border-gray-400">
              {enviandoRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {enviandoRef ? 'Enviando…' : 'Anexar embalagem, logo ou produto'}
              <input type="file" accept="image/*" className="hidden" disabled={enviandoRef}
                onChange={e => { const file = e.target.files?.[0]; if (file) subirReferencia(file); }} />
            </label>
          )}
          {/* Honestidade: instrução ao modelo não é garantia de preservação.
              Prometer pixel-perfect aqui seria mentir para quem vai publicar. */}
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            O ativo entra como referência. A IA recria a imagem, então confira a embalagem
            antes de publicar — detalhes do rótulo podem sair diferentes.
          </p>
        </div>

        <button type="button" onClick={() => gerar()} disabled={gerando || !companyId}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B2214] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#6d1a10] disabled:opacity-50">
          {gerando ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Sparkles className="h-4 w-4" /> Gerar imagem</>}
        </button>
      </div>

      {/* ---------- Resultado ---------- */}
      <div className="space-y-6">
        {atual ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className={`mx-auto max-w-sm overflow-hidden rounded-lg bg-gray-100 ${f.classe}`}>
              <img src={atual.url} alt="Imagem gerada" className="h-full w-full object-cover" />
            </div>
            {atual.aviso && (
              <p className="mx-auto mt-3 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                {atual.aviso}
              </p>
            )}
            <div className="mx-auto mt-4 flex max-w-sm flex-wrap gap-2">
              <button type="button" onClick={() => decidir('aprovada')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">
                <Check className="h-4 w-4" /> Aprovar
              </button>
              <button type="button" onClick={() => baixar(atual.id, atual.url)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Download className="h-4 w-4" /> Baixar
              </button>
              <button type="button" onClick={() => gerar(atual.id)} disabled={gerando}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" /> Gerar outra
              </button>
              <button type="button" onClick={() => decidir('rejeitada')}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <div>
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">A imagem aparece aqui.</p>
              <p className="mt-1 text-xs text-gray-400">Escolha o formato, escreva o que precisa e clique em gerar.</p>
            </div>
          </div>
        )}

        {historico.length > 0 && (
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Geradas antes</h4>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {historico.map(g => (
                <button key={g.id} type="button"
                  onClick={() => g.url && setAtual({ id: g.id, url: g.url, aviso: null })}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-100 aspect-square">
                  {g.url && <img src={g.url} alt={g.brief} className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                  {g.outcome === 'aprovada' && (
                    <span className="absolute right-1 top-1 rounded-full bg-green-700 p-0.5 text-white"><Check className="h-3 w-3" /></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
