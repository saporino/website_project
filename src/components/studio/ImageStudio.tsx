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
  { id: 'comunicado',    rotulo: 'Comunicado',         sugestao: 'Um aviso para os nossos clientes' },
  { id: 'ponto_de_venda',rotulo: 'Padaria / PDV',      sugestao: 'Nosso café no balcão da padaria' },
  { id: 'lifestyle',     rotulo: 'Lifestyle',          sugestao: 'Um momento com café' },
  { id: 'livre',         rotulo: 'A partir de uma ideia', sugestao: '' },
];

/** Um ativo anexado. `path` só existe depois que o upload termina. */
interface Ativo {
  id: string;
  preview: string;   // objectURL local, aparece antes da rede responder
  nome: string;
  path: string | null;
  enviando: boolean;
  // Oficial se preserva; inspiração se lê e se abandona. São instruções
  // opostas, então o papel precisa viajar junto com o arquivo.
  papel: 'oficial' | 'inspiracao';
}

const MAX_ATIVOS = 4;

const ESTILOS = [
  { id: 'post_pronto', rotulo: 'Post pronto' },
  { id: 'fotografico', rotulo: 'Fotográfico' },
  { id: 'comercial',   rotulo: 'Comercial' },
  { id: 'premium',     rotulo: 'Premium' },
  { id: 'moderno',     rotulo: 'Moderno' },
];

const MODOS_TEXTO = [
  { id: 'automatico', rotulo: 'O Studio decide' },
  { id: 'com_frase',  rotulo: 'Com frase' },
  { id: 'sem_texto',  rotulo: 'Sem texto' },
];

// Pedidos prontos: o cliente clica em vez de escrever. Cada um preenche
// tipo, estilo e intenção de uma vez — é o atalho de quem não tem tempo.
const EXEMPLOS = [
  { texto: 'Crie um bom dia com minha embalagem',        tipo: 'bom_dia',        estilo: 'moderno' },
  { texto: 'Faça uma oferta com cara de post moderno',   tipo: 'oferta',         estilo: 'post_pronto' },
  { texto: 'Crie um post institucional com frase',       tipo: 'institucional',  estilo: 'premium' },
  { texto: 'Faça um story promocional para WhatsApp',    tipo: 'oferta',         estilo: 'comercial' },
  { texto: 'Crie um post para padaria com meu café',     tipo: 'ponto_de_venda', estilo: 'comercial' },
  { texto: 'Faça uma arte para representante comercial', tipo: 'representante',  estilo: 'post_pronto' },
  { texto: 'Crie um anúncio premium com meu produto',    tipo: 'produto',        estilo: 'premium' },
];

/** Uma marca cadastrada da empresa, ou o modo livre. */
interface Marca { id: string; name: string; organization_id: string | null }

// Custo medido em produção: US$ 0,043 de direção criativa + US$ 0,061 de
// imagem. Serve para o cliente saber quanto vai gastar ANTES de clicar, e não
// para cobrar — a cobrança sai do usage real, sempre.
const CUSTO_MEDIO_USD = 0.104;

const QUANTIDADES = [1, 3, 5, 7, 10];

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
  const [tipo, setTipo] = useState('bom_dia');
  const [estilo, setEstilo] = useState('post_pronto');
  const [modoTexto, setModoTexto] = useState('automatico');
  const [handle, setHandle] = useState('');
  // Sem marcar o exemplo escolhido, o clique preenchia campos LA EMBAIXO,
  // fora da vista, e parecia que nada acontecia.
  const [exemploAtivo, setExemploAtivo] = useState<string | null>(null);
  // Vários ativos: a embalagem sozinha diz o que é o produto; junto com uma
  // referência de cenário ou de luz, diz o que a peça deve VIRAR. A API aceita
  // múltiplas referências, então limitar a uma era limitação nossa.
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [enviandoRef, setEnviandoRef] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Erro fica NA TELA até a próxima tentativa. Como toast ele sumia em
  // segundos, e foi por isso que duas falhas seguidas pareceram "nada acontece".
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<{ id: string; url: string; aviso: string | null } | null>(null);
  const [historico, setHistorico] = useState<Geracao[]>([]);
  // A marca da peça deixou de vir do seletor de EMPRESA do topo. Era dali que
  // a Saporino entrava numa peça da Café Capital.
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [brandId, setBrandId] = useState<string>('');   // '' = marca livre
  const [nomeLivre, setNomeLivre] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [lote, setLote] = useState<{ feitas: number; total: number } | null>(null);

  const modoMarca = brandId ? 'perfil' : 'livre';
  const marcaAtual = brandId ? (marcas.find(m => m.id === brandId)?.name ?? '') : nomeLivre.trim();

  // As marcas da empresa. A lista pode vir vazia, e nesse caso marca livre é o
  // único caminho — que é exatamente como um cliente novo começa.
  useEffect(() => {
    if (!companyId) { setMarcas([]); return; }
    supabase.from('studio_brand_profiles')
      .select('id, name, organization_id').eq('company_id', companyId).order('is_primary', { ascending: false })
      .then(({ data }) => setMarcas((data as Marca[]) ?? []));
  }, [companyId]);

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
    // O campo livre deixou de ser a etapa principal: com tipo e estilo
    // escolhidos, o Diretor tem o suficiente. Quem quiser detalhar, detalha.
    const pedido = brief.trim() || (TIPOS.find(t => t.id === tipo)?.sugestao ?? '');
    if (pedido.length < 5) { toast.error('Escolha um tipo de conteúdo ou escreva o que você precisa.'); return; }
    // Enquanto o ativo está subindo, `referencia` ainda é nulo — gerar agora
    // produziria uma imagem SEM a embalagem, e quem pediu acharia que ela foi
    // usada. Vale esperar alguns segundos.
    if (enviandoRef || ativos.some(a => a.enviando)) { toast.error('Aguarde o envio dos ativos terminar.'); return; }
    // Fail closed na tela também: sem marca resolvida, não gera. Antes o
    // servidor caía na primeira marca da empresa e ninguém ficava sabendo.
    if (modoMarca === 'livre' && marcaAtual.length < 2) {
      setErro('Escreva o nome da marca desta peça, ou escolha uma marca cadastrada.');
      return;
    }
    if (modoMarca === 'livre' && !ativos.some(a => a.path)) {
      setErro('Em marca livre, anexe a embalagem: ela é o documento da marca.');
      return;
    }

    // Uma peça por chamada, mesmo em leva: sete imagens numa só requisição
    // estouram o tempo da função. O navegador orquestra e mostra o progresso.
    const total = parentId ? 1 : quantidade;
    if (total > 1) {
      const estimado = (total * CUSTO_MEDIO_USD).toFixed(2);
      const ok = window.confirm(
        `Gerar ${total} peças de "${TIPOS.find(t => t.id === tipo)?.rotulo}" para ${marcaAtual}?\n\n` +
        `Custo aproximado: US$ ${estimado}. Nenhuma frase se repete.`,
      );
      if (!ok) return;
    }

    const batchId = total > 1 ? crypto.randomUUID() : null;
    setGerando(true);
    setErro(null);
    setLote(total > 1 ? { feitas: 0, total } : null);

    const corpo = {
      brief: pedido, format: formato, content_type: tipo,
      reference_paths: ativos.filter(a => a.path).map(a => a.path),
      reference_roles: ativos.filter(a => a.path).map(a => a.papel),
      style: estilo, text_mode: modoTexto, handle: handle.trim() || null,
      brand_mode: modoMarca, brand_id: brandId || null, brand_name: marcaAtual,
    };

    try {
      for (let i = 1; i <= total; i++) {
        let d;
        try {
          d = await chamar({ ...corpo, parent_id: parentId ?? null, batch_id: batchId, batch_index: batchId ? i : null });
        } catch (e) {
          // Frase repetida e marca intrusa são bloqueios ANTES do gasto: uma
          // segunda tentativa costuma resolver, e não custa imagem nenhuma.
          const msg = e instanceof Error ? e.message : '';
          if (!/já foi entregue|citou a marca/i.test(msg)) throw e;
          d = await chamar({ ...corpo, parent_id: parentId ?? null, batch_id: batchId, batch_index: batchId ? i : null });
        }
        setAtual({ id: d.generation_id, url: d.url, aviso: d.aviso_ativo ?? null });
        setLote(prev => (prev ? { ...prev, feitas: i } : null));
        await carregarHistorico();
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar.');
    } finally {
      setGerando(false);
      setLote(null);
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

  function removerAtivo(id: string) {
    setAtivos(prev => {
      const alvo = prev.find(a => a.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return prev.filter(a => a.id !== id);
    });
  }

  /** Aceita arquivo escolhido, arrastado ou COLADO. Todos passam por aqui. */
  async function anexar(arquivos: File[]) {
    if (!companyId) { toast.error('Escolha a marca antes de anexar o ativo.'); return; }

    const vagas = MAX_ATIVOS - ativos.length;
    if (vagas <= 0) { toast.error(`Máximo de ${MAX_ATIVOS} imagens.`); return; }

    const validos = arquivos.filter(f => {
      if (!TIPOS_ACEITOS.includes(f.type)) { toast.error(`"${f.name}" não é PNG, JPG ou WEBP.`); return false; }
      if (f.size > TAMANHO_MAX) { toast.error(`"${f.name}" passa de 25 MB.`); return false; }
      return true;
    }).slice(0, vagas);
    if (!validos.length) return;

    // As miniaturas entram ANTES do upload. Quem colou vê na hora que a
    // imagem foi reconhecida, mesmo que a rede demore.
    const novos: Ativo[] = validos.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preview: URL.createObjectURL(f),
      nome: f.name || 'imagem colada.png',
      path: null,
      enviando: true,
      papel: 'oficial',
    }));
    setAtivos(prev => [...prev, ...novos]);
    setEnviandoRef(true);

    await Promise.all(validos.map(async (file, i) => {
      // Caminho começa pelo company_id: o servidor confere esse prefixo antes
      // de aceitar o ativo, para ninguém apontar para a embalagem de outra marca.
      const limpo = (file.name || 'colada.png').replace(/[^\w.-]/g, '_');
      const caminho = `${companyId}/ref-${Date.now()}-${i}-${limpo}`;
      const { error } = await supabase.storage.from('studio-videos')
        .upload(caminho, file, { contentType: file.type || undefined });

      // O ativo passa a ter dono. Sem isto, a embalagem de uma marca servia de
      // "ativo oficial" na peça de outra e não havia o que conferir.
      if (!error) {
        await supabase.from('studio_reference_assets').insert({
          path: caminho, company_id: companyId,
          organization_id: marcas[0]?.organization_id ?? null,
          brand_id: brandId || null, brand_mode: modoMarca, brand_name: marcaAtual || null,
          filename: file.name || null, mime: file.type || null, size_bytes: file.size,
        });
      }

      setAtivos(prev => prev.map(a => {
        if (a.id !== novos[i].id) return a;
        if (error) { URL.revokeObjectURL(a.preview); return a; }
        return { ...a, path: caminho, enviando: false };
      // Ativo que falhou sai da lista: mostrar a miniatura com o envio quebrado
      // faria a pessoa acreditar que ele seria usado.
      }).filter(a => !(a.id === novos[i].id && error)));

      if (error) toast.error(`Não foi possível anexar "${file.name}": ${error.message}`);
    }));

    setEnviandoRef(false);
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

        {/* A marca da peça. Fica em primeiro porque é a decisão que contamina
            todas as outras: foi a marca errada que trocou a embalagem. */}
        <div className="rounded-lg border border-[#ddd0cc] bg-[#f5f0ef] p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Marca desta peça</label>
          <div className="flex flex-wrap gap-1.5">
            {marcas.map(m => (
              <button key={m.id} type="button" onClick={() => setBrandId(m.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  brandId === m.id ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-[#8B2214]'
                }`}>
                {m.name}
              </button>
            ))}
            <button type="button" onClick={() => setBrandId('')}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                !brandId ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-[#8B2214]'
              }`}>
              Marca livre
            </button>
          </div>
          {!brandId && (
            <div className="mt-2">
              <input value={nomeLivre} onChange={e => setNomeLivre(e.target.value)}
                placeholder="Nome da marca, ex.: Café Capital"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] leading-snug text-gray-500">
                Sem identidade cadastrada: a embalagem que você anexar é o documento da marca.
                Nenhuma outra marca pode aparecer na peça.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Comece por um exemplo</label>
          <div className="flex flex-wrap gap-1.5">
            {EXEMPLOS.map(x => (
              <button key={x.texto} type="button"
                onClick={() => { setBrief(x.texto); setTipo(x.tipo); setEstilo(x.estilo); setExemploAtivo(x.texto); }}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-tight transition-colors ${
                  exemploAtivo === x.texto
                    ? 'border-[#8B2214] bg-[#8B2214] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-[#8B2214] hover:text-[#8B2214]'
                }`}>
                {x.texto}
              </button>
            ))}
          </div>

          {/* O efeito do clique acontece nos blocos de baixo, fora da vista de
              quem acabou de clicar. Esta linha traz o resultado para perto do
              botao — senao o exemplo parece nao ter funcionado. */}
          {exemploAtivo && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-green-800">
              <Check className="h-3.5 w-3.5" />
              Aplicado:
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-semibold">
                {TIPOS.find(t => t.id === tipo)?.rotulo}
              </span>
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-semibold">
                {ESTILOS.find(e => e.id === estilo)?.rotulo}
              </span>
              <span className="text-gray-500">— ajuste abaixo se quiser</span>
            </p>
          )}
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
                onClick={() => { setTipo(t.id); if (t.sugestao) setBrief(t.sugestao); setExemploAtivo(null); }}
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
            Opcional. Com o tipo escolhido, o Studio já sabe o que fazer.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Estilo da peça</label>
          <div className="flex flex-wrap gap-1.5">
            {ESTILOS.map(e => (
              <button key={e.id} type="button" onClick={() => { setEstilo(e.id); setExemploAtivo(null); }}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${estilo === e.id ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {e.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Texto na arte</label>
          <div className="flex flex-wrap gap-1.5">
            {MODOS_TEXTO.map(m => (
              <button key={m.id} type="button" onClick={() => setModoTexto(m.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${modoTexto === m.id ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Assinatura <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
          </label>
          <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
            placeholder="@suamarca"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#8B2214]" />
          <p className="mt-1 text-[11px] text-gray-400">Aparece discreto num canto da peça, sem tradução.</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Ativo da marca <span className="font-normal normal-case tracking-normal text-gray-400">(opcional)</span>
          </label>
          <div
            onPaste={e => {
              // Colar da área de transferência: é assim que quem trabalha com
              // imagem realmente move arquivo — print, recorte, foto do
              // fornecedor. Exigir "procurar no disco" era atrito nosso.
              const imgs = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
              if (imgs.length) { e.preventDefault(); anexar(imgs); }
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const imgs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
              if (imgs.length) anexar(imgs);
            }}
            tabIndex={0}
            className="rounded-lg outline-none focus:ring-2 focus:ring-[#8B2214]/40"
          >
            {ativos.length > 0 && (
              <div className="mb-2 grid grid-cols-4 gap-2">
                {ativos.map(a => (
                  <div key={a.id} className={`relative overflow-hidden rounded-md border bg-white ${a.enviando ? 'border-gray-200' : 'border-green-300'}`}>
                    <img src={a.preview} alt={a.nome} className="aspect-square w-full object-contain" />
                    {a.enviando && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                      </div>
                    )}
                    {!a.enviando && (
                      <span className="absolute left-1 top-1 rounded-full bg-green-700 p-0.5 text-white"><Check className="h-2.5 w-2.5" /></span>
                    )}
                    <button type="button" onClick={() => removerAtivo(a.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80" aria-label={`Remover ${a.nome}`}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                    {/* Oficial se preserva; inspiração se interpreta e se
                        abandona. Sem esta escolha, as duas iam pelo mesmo
                        caminho — e o modelo copiaria a referência. */}
                    <button type="button"
                      onClick={() => setAtivos(prev => prev.map(x => x.id === a.id
                        ? { ...x, papel: x.papel === 'oficial' ? 'inspiracao' : 'oficial' } : x))}
                      className={`absolute inset-x-0 bottom-0 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        a.papel === 'oficial' ? 'bg-[#8B2214] text-white' : 'bg-blue-700 text-white'
                      }`}>
                      {a.papel === 'oficial' ? 'oficial' : 'inspiração'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {ativos.length < MAX_ATIVOS && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 hover:border-gray-400">
                <ImagePlus className="h-4 w-4" />
                <span>{ativos.length ? 'Anexar mais uma' : 'Anexar embalagem, logo ou produto'}</span>
                <span className="text-[11px] text-gray-400">
                  arraste, escolha ou <strong>cole com Ctrl+V</strong> · até {MAX_ATIVOS} imagens
                </span>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
                  onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) anexar(fs); }} />
              </label>
            )}
          </div>

          {/* Honestidade: instrução ao modelo não é garantia de preservação.
              Prometer pixel-perfect aqui seria mentir para quem vai publicar. */}
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            O ativo entra como referência. A IA recria a imagem, então confira a embalagem
            antes de publicar — detalhes do rótulo podem sair diferentes.
          </p>
        </div>

        {/* Quantas peças de uma vez. Sete bom-dias resolvem a semana, e
            nenhuma frase se repete — nem entre elas, nem com clientes. */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Quantas peças</label>
          <div className="flex flex-wrap gap-1.5">
            {QUANTIDADES.map(q => (
              <button key={q} type="button" onClick={() => setQuantidade(q)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  quantidade === q ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-200 text-gray-600 hover:border-[#8B2214]'
                }`}>
                {q === 1 ? '1 peça' : `${q} peças`}
              </button>
            ))}
          </div>
          {quantidade > 1 && (
            <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
              Aproximadamente US$ {(quantidade * CUSTO_MEDIO_USD).toFixed(2)}. Você confirma antes de gerar.
              Cada peça sai com frase e montagem diferentes.
            </p>
          )}
        </div>

        <button type="button" onClick={() => gerar()} disabled={gerando || !companyId}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B2214] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#6d1a10] disabled:opacity-50">
          {gerando
            ? <><Loader2 className="h-4 w-4 animate-spin" /> {lote ? `Gerando ${lote.feitas + 1} de ${lote.total}…` : 'Gerando imagem…'}</>
            : <><Sparkles className="h-4 w-4" /> {quantidade > 1 ? `Gerar ${quantidade} peças` : 'Gerar imagem'}</>}
        </button>

        {gerando && (
          <p className="text-center text-xs text-gray-500">
            {lote
              ? `${lote.feitas} de ${lote.total} prontas. Cada peça leva cerca de um minuto — não feche esta tela.`
              : 'Pode levar até um minuto. Não feche esta tela.'}
          </p>
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
