// COFICO Studio — criar imagem.
//
// A pessoa escreve o que quer em português comum e recebe a imagem aqui
// dentro. Não existe campo de "prompt": o prompt técnico é montado no
// servidor, a partir do briefing + identidade da marca + formato.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Sparkles, Download, Check, X, RefreshCw, ImagePlus, Loader2, AlertCircle } from 'lucide-react';

type Formato = 'feed' | 'story';

const FORMATOS: { id: Formato; rotulo: string; medida: string; classe: string }[] = [
  { id: 'feed', rotulo: 'Instagram Feed', medida: '4:5 · 1088×1360', classe: 'aspect-[4/5]' },
  { id: 'story', rotulo: 'Story / WhatsApp', medida: '9:16 · 1152×2048', classe: 'aspect-[9/16]' },
];

// Atalhos: o cliente ESCOLHE o tipo em vez de descrever. É o que permite ao
// servidor selecionar só as regras daquele caso — e é o que faz a diferença
// entre "digite seu prompt" e "o que você quer criar?".
const TIPOS: { id: string; rotulo: string; sugestao: string }[] = [
  { id: 'bom_dia',       rotulo: 'Bom dia',            sugestao: 'Um bom dia com o nosso café' },
  { id: 'boa_tarde',     rotulo: 'Boa tarde',          sugestao: 'Uma boa tarde para acompanhar o café' },
  { id: 'produto',       rotulo: 'Divulgar produto',   sugestao: 'Quero divulgar este café' },
  { id: 'oferta',        rotulo: 'Oferta',             sugestao: 'Quero anunciar uma condição especial' },
  { id: 'institucional', rotulo: 'Institucional',      sugestao: 'Um post sobre quem somos' },
  { id: 'educativo',     rotulo: 'Educativo',          sugestao: 'Ensinar algo sobre café' },
  { id: 'representante', rotulo: 'Para representante', sugestao: 'Material de apoio para o representante' },
  { id: 'livre',         rotulo: 'A partir de uma ideia', sugestao: '' },
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
  const [tipo, setTipo] = useState('livre');
  const [referencia, setReferencia] = useState<string | null>(null);
  // Miniatura local, criada no instante da escolha. Não espera o upload nem a
  // rede: o bucket é privado e pedir URL assinada só para mostrar o que já
  // está na mão do navegador seria lento e inútil.
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refNome, setRefNome] = useState<string | null>(null);
  const [enviandoRef, setEnviandoRef] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Erro fica NA TELA até a próxima tentativa. Como toast ele sumia em
  // segundos, e foi por isso que duas falhas seguidas pareceram "nada acontece".
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<{ id: string; url: string; aviso: string | null } | null>(null);
  const [historico, setHistorico] = useState<Geracao[]>([]);

  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('studio-image', {
      body: { company_id: companyId, ...body },
    });
    // `invoke` devolve erro genérico em status 4xx/5xx e joga o corpo real em
    // `error.context`. Sem ler dali, a causa (que o servidor mandou) se perde e
    // sobra "Edge Function returned a non-2xx status code".
    if (error) {
      let msg = error.message;
      try {
        const corpo = await (error as { context?: Response }).context?.json();
        if (corpo?.error) msg = corpo.detalhe ? `${corpo.error} ${corpo.detalhe}` : corpo.error;
      } catch { /* mantém a mensagem original */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.detalhe ? `${data.error} ${data.detalhe}` : data.error);
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
    // Enquanto o ativo está subindo, `referencia` ainda é nulo — gerar agora
    // produziria uma imagem SEM a embalagem, e quem pediu acharia que ela foi
    // usada. Vale esperar alguns segundos.
    if (enviandoRef) { toast.error('Aguarde o envio do ativo terminar.'); return; }
    setGerando(true);
    setErro(null);
    try {
      const d = await chamar({
        brief: brief.trim(), format: formato, content_type: tipo,
        reference_path: referencia, parent_id: parentId ?? null,
      });
      setAtual({ id: d.generation_id, url: d.url, aviso: d.aviso_ativo ?? null });
      carregarHistorico();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar.');
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

  const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];
  const TAMANHO_MAX = 25 * 1024 * 1024;

  function limparReferencia() {
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefPreview(null);
    setRefNome(null);
    setReferencia(null);
  }

  async function subirReferencia(file: File) {
    // Falha silenciosa era metade do problema: sem marca escolhida, a função
    // simplesmente voltava e a tela não dizia nada.
    if (!companyId) { toast.error('Escolha a marca antes de anexar o ativo.'); return; }
    if (!TIPOS_ACEITOS.includes(file.type)) {
      toast.error('Use uma imagem PNG, JPG ou WEBP.');
      return;
    }
    if (file.size > TAMANHO_MAX) {
      toast.error('Imagem muito grande. O limite é 25 MB.');
      return;
    }

    // A miniatura aparece ANTES do upload. Quem escolheu vê na hora que o
    // arquivo certo foi reconhecido, mesmo que a rede demore.
    if (refPreview) URL.revokeObjectURL(refPreview);
    setRefPreview(URL.createObjectURL(file));
    setRefNome(file.name);
    setEnviandoRef(true);

    // Caminho começa pelo company_id: o servidor confere esse prefixo antes de
    // aceitar o ativo, para ninguém apontar para a embalagem de outra marca.
    const caminho = `${companyId}/ref-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('studio-videos')
      .upload(caminho, file, { contentType: file.type || undefined });
    setEnviandoRef(false);

    if (error) {
      // Desfaz a miniatura: mostrar a imagem com o upload quebrado faria a
      // pessoa acreditar que o ativo seria usado — que é o defeito de origem.
      limparReferencia();
      toast.error('Não foi possível anexar: ' + error.message);
      return;
    }
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">O que você quer criar?</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TIPOS.map(t => (
              <button key={t.id} type="button"
                onClick={() => { setTipo(t.id); if (t.sugestao) setBrief(t.sugestao); }}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  tipo === t.id ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3}
            placeholder="Conte para o Studio o que você precisa. Não precisa escrever prompt."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#8B2214]" />
          <p className="mt-1.5 text-[11px] text-gray-400">
            Escreva do seu jeito. O Studio cuida da direção criativa.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Ativo da marca <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
          </label>
          {refPreview ? (
            <div className={`rounded-lg border p-3 ${referencia ? 'border-green-300 bg-green-50/60' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex gap-3">
                <img src={refPreview} alt={refNome ?? 'Ativo anexado'}
                  className="h-20 w-20 flex-shrink-0 rounded-md border border-gray-200 bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  {enviandoRef ? (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-green-800">
                      <Check className="h-4 w-4" /> Imagem de referência anexada
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-xs text-gray-500" title={refNome ?? ''}>{refNome}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {enviandoRef ? 'Aguarde o envio terminar.' : 'É esta imagem que será usada na geração.'}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <label className="cursor-pointer text-xs font-semibold text-[#8B2214] hover:underline">
                      Trocar
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={enviandoRef}
                        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subirReferencia(f); }} />
                    </label>
                    <button type="button" onClick={limparReferencia} disabled={enviandoRef}
                      className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-50">
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 hover:border-gray-400">
              <ImagePlus className="h-4 w-4" />
              Anexar embalagem, logo ou produto
              {/* `e.target.value = ''` antes de usar o arquivo: sem isso,
                  escolher o MESMO arquivo de novo não dispara o onChange, e a
                  tela fica muda depois de um erro. */}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subirReferencia(f); }} />
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
          {gerando ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando imagem…</> : <><Sparkles className="h-4 w-4" /> Gerar imagem</>}
        </button>

        {gerando && (
          <p className="text-center text-xs text-gray-500">Pode levar até um minuto. Não feche esta tela.</p>
        )}

        {erro && !gerando && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
            <p className="flex items-start gap-1.5 text-sm font-semibold text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> A geração falhou
            </p>
            <p className="mt-1 break-words text-xs leading-relaxed text-red-700">{erro}</p>
            <button type="button" onClick={() => setErro(null)}
              className="mt-2 text-xs font-semibold text-red-800 hover:underline">Entendi</button>
          </div>
        )}
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
