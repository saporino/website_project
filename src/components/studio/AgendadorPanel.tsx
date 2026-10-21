// Calendário inteligente — a IA organiza, o Vlademir aprova.
//
// Nada daqui vai ao ar sozinho. Aprovar uma sugestão CRIA uma campanha em
// `studio_campaigns`, igual às que ele cria à mão — e é o robô de sempre
// (`publish-scheduled`) que publica. Esta tela não publica nada.
//
// Quatro coisas que ele pediu e que mudam o uso:
//   · ver a ARTE, não o nome do arquivo (nome de arquivo não diz qual peça é);
//   · poder pedir OUTRA seleção quando não gostar da escolha;
//   · horário sem arte adequada não fica em silêncio — vira um pedido claro
//     ("faltam 4 artes de tarde") com o caminho para criar;
//   · a conta tem de fechar: 18 artes ÷ 3 por dia = 6 dias. Pedir 14 dias e
//     receber 6 sem explicação é o que ele quer evitar.
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CalendarClock, Sparkles, Check, X, Loader2, RefreshCw, AlertTriangle,
  Clock, ImageOff, Images, Wand2, Shuffle, Upload,
} from 'lucide-react';
import {
  classificar, montarSugestoes, assinatura, LIMITE_REVISAO, diasParaProgramar, vencidas,
  type Arte, type Janela, type Agendamento, type Vazio,
} from './agendador';
import { montarHashtags, trocarHashtags } from '../../lib/hashtagsCafe';

interface ArteDisponivel {
  video_id: string; brand_id: string; marca: string; titulo: string;
  thumbnail_path: string | null; storage_path: string | null; media_type: string | null;
  agendamento: Agendamento | null;
  /** O texto pronto por rede, vindo da análise. A agenda publicava em branco
   *  porque nunca leu isto — e a legenda já existia desde sempre. */
  legendas?: Record<string, string> | null;
  hashtags?: string[] | null;
  texto_da_arte: string | null; resumo: string | null;
  publicada_em: string | null; na_fila: boolean;
}

interface SugestaoSalva {
  id: string; brand_id: string; video_id: string; plataforma: string;
  sugerido_para: string; periodo: string; motivo: string; confianca: number;
  legenda: string | null; status: string; assinatura: string | null;
  campaign_id: string | null;
}

const PERIODO_ROTULO: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
const PERIODO_DICA: Record<string, string> = {
  manha: 'bom dia, café da manhã, começar o dia',
  tarde: 'café da tarde, lanche, pausa do trabalho',
  noite: 'fim de dia, boa noite, relaxar',
};
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const FUSO = 'America/Sao_Paulo';
/** Quantos dias uma arte publicada espera antes de poder voltar. */
const DIAS_PARA_REUSAR = 90;

/** A hora como foi combinada: 08:00, não 11:00 (o banco devolve UTC). */
const horaLocal = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
/** O dia a que a publicação pertence em São Paulo, para agrupar o calendário. */
const diaLocal = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });

function rotuloDia(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS_PT[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * A miniatura, igual à da biblioteca onde ele carrega as artes: clicável para
 * abrir em tamanho grande, com o mesmo anel ao passar o mouse. Ver a peça
 * pequena ajuda a reconhecer; poder abrir é o que permite conferir antes de
 * aprovar.
 */
function Miniatura({ arte, url }: { arte?: ArteDisponivel | null; url: string | null }) {
  const ehVideo = arte?.media_type === 'video' || /\.(mp4|mov|m4v|webm)$/i.test(arte?.titulo ?? '');
  if (!url) {
    return (
      <div className="w-16 h-16 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-6 h-6" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => window.open(url, '_blank')} title="Ver em tamanho grande"
      className="w-16 h-16 rounded-lg bg-[#f5f0ef] overflow-hidden flex-shrink-0 border border-gray-200 hover:ring-2 hover:ring-[#8B2214]">
      {ehVideo
        ? <video src={url + '#t=0.1'} muted playsInline preload="metadata" className="w-full h-full object-cover" />
        : <img src={url} alt={arte?.titulo ?? ''} className="w-full h-full object-cover" />}
    </button>
  );
}

export default function AgendadorPanel({ brandId, brandName, companyId, onCriarImagem, onCarregarArte }: {
  brandId: string; brandName: string;
  /** Necessário para o gerador de legenda, que lê a identidade da marca. */
  companyId?: string | null;
  /** Leva para "Criar imagem" — quando a arte ainda não existe. */
  onCriarImagem?: () => void;
  /** Leva para "Fotos e vídeos" — quando ele já tem a arte pronta no computador. */
  onCarregarArte?: () => void;
}) {
  const [artes, setArtes] = useState<ArteDisponivel[]>([]);
  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [salvas, setSalvas] = useState<SugestaoSalva[]>([]);
  /** Quantas artes voltaram para a fila por terem vencido. Aparece como aviso:
   *  ele precisa saber que a agenda se reorganizou, e por quê. */
  /** Qual legenda está aberta para edição, e o texto em digitação.
   *  Texto ruim agendado publica igual — ele precisa poder mudar sem perder
   *  o horário já decidido. */
  /** Qual texto acabou de ser copiado — o aviso dura dois segundos. Sem ele,
   *  clicar em "copiar" não dá sinal nenhum e a pessoa clica de novo. */
  const [copiada, setCopiada] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [gerandoTexto, setGerandoTexto] = useState(false);

  const [devolvidas, setDevolvidas] = useState(0);
  const [miniaturas, setMiniaturas] = useState<Map<string, string>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(7);
  const [verAcervo, setVerAcervo] = useState(false);

  async function carregar() {
    setCarregando(true); setErro('');
    const [{ data: a }, { data: j }, { data: s }] = await Promise.all([
      supabase.from('vw_studio_artes_disponiveis').select('*').eq('brand_id', brandId),
      supabase.from('studio_janelas').select('*').eq('brand_id', brandId).eq('ativa', true),
      supabase.from('studio_sugestoes').select('*').eq('brand_id', brandId)
        // 'publicada' entra de propósito: ela saiu da FILA DE APROVAÇÃO, mas
        // continua no calendário, no horário dela. É o que ele pediu — "ver o
        // que já está e mudar o estilo de foto". Calendário sem o que já saiu
        // é calendário cego: não dá para decidir o estilo do que vem olhando
        // só para buracos.
        .in('status', ['sugerida', 'aprovada', 'revisar', 'publicada']).order('sugerido_para'),
    ]);
    const lista = (a as ArteDisponivel[]) ?? [];
    setArtes(lista);
    setJanelas(((j as any[]) ?? []).map(x => ({
      brand_id: x.brand_id, dia_semana: x.dia_semana, hora: x.hora,
      periodo: x.periodo, plataforma: x.plataforma, ativa: x.ativa,
    })));
    setSalvas((s as SugestaoSalva[]) ?? []);

    // Miniaturas: o bucket studio-videos é privado, então a imagem só aparece
    // com URL assinada. Sem isto o cartão mostra o NOME do arquivo — e nome de
    // arquivo não diz qual arte é.
    const caminhos = lista.map(x => x.thumbnail_path || x.storage_path).filter(Boolean) as string[];
    if (caminhos.length) {
      const { data: assinadas } = await supabase.storage
        .from('studio-videos').createSignedUrls(caminhos, 3600);
      setMiniaturas(new Map((assinadas ?? []).map((x: any) => [x.path, x.signedUrl])));
    }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, [brandId]);

  const miniDe = (a?: ArteDisponivel | null) =>
    a ? miniaturas.get(a.thumbnail_path || a.storage_path || '') ?? null : null;

  /** Todas as artes da marca, já classificadas. */
  const classificadas = useMemo<Arte[]>(() => artes
    .map(a => ({
      id: a.video_id, brand_id: a.brand_id, titulo: a.titulo,
      agendamento: a.agendamento ?? classificar({ textoDaArte: a.texto_da_arte, resumo: a.resumo }),
      publicada_em: a.publicada_em,
    })), [artes]);

  /**
   * "Disponível" é o que REALMENTE pode entrar no calendário — não o total da
   * biblioteca. O motor já descartava as publicadas por dentro; o contador é
   * que somava tudo e fazia parecer que havia três semanas de estoque.
   */
  const naFila = classificadas.filter(a => artes.find(x => x.video_id === a.id)?.na_fila);
  const recemPublicadas = classificadas.filter(a => !naFila.includes(a) &&
    a.publicada_em && (Date.now() - new Date(a.publicada_em).getTime()) / 86400000 < DIAS_PARA_REUSAR);
  const precisamRevisao = classificadas.filter(a =>
    !naFila.includes(a) && !recemPublicadas.includes(a) && a.agendamento.confianca < LIMITE_REVISAO);
  const paraAgendar = classificadas.filter(a =>
    !naFila.includes(a) && !recemPublicadas.includes(a) && a.agendamento.confianca >= LIMITE_REVISAO);
  /** O acervo inteiro da marca, com o estado de cada peça. É o que ele abre em "ver quais". */
  const acervo = [...paraAgendar, ...naFila, ...recemPublicadas, ...precisamRevisao];
  const estadoDa = (a: Arte) =>
    naFila.includes(a) ? { txt: 'na agenda', cls: 'bg-amber-100 text-amber-700' }
    : recemPublicadas.includes(a) ? { txt: 'já publicada', cls: 'bg-gray-100 text-gray-500' }
    : precisamRevisao.includes(a) ? { txt: 'revisar', cls: 'bg-amber-100 text-amber-700' }
    : { txt: 'disponível', cls: 'bg-green-100 text-green-700' };


  async function gerar(outraSelecao = false) {
    setGerando(true); setErro('');

    // "Gerar outra seleção" apaga as sugestões ainda não aprovadas e refaz.
    // O que já foi aprovado NUNCA é tocado — virou campanha, e mexer nisso
    // seria desfazer uma decisão dele.
    if (outraSelecao) {
      await supabase.from('studio_sugestoes').delete()
        .eq('brand_id', brandId).eq('status', 'sugerida');
    }

    // TUDO o que já está no calendário conta como ocupado — proposto e
    // aprovado. Antes só as aprovadas entravam aqui, e por isso um segundo
    // clique em "Gerar sugestões" empilhava duas artes no mesmo horário.
    // Em "gerar outra seleção" as propostas acabaram de ser apagadas acima,
    // então sobram só as aprovadas — que é o certo: elas não se mexem.
    // Aqui NÃO entra 'publicada': ela já cumpriu e não ocupa mais a janela.
    // O horário dela fica livre para a semana seguinte — senão uma semana
    // publicada impediria agendar a próxima no mesmo horário.
    const { data: atuais } = await supabase.from('studio_sugestoes')
      .select('id, brand_id, video_id, sugerido_para, periodo, status')
      .eq('brand_id', brandId).in('status', ['sugerida', 'aprovada']);

    // ---- O QUE VENCEU VOLTA PARA A FILA ----
    //
    // "se está lá para ser publicada hoje, e não foi, encaixa na próxima, mas
    // não no que já está agendado para amanhã — joga pra frente."
    //
    // A data NÃO é empurrada: empurrar um dia jogaria "boa terça" na quarta e
    // um "bom dia" às 19h. O que volta é a ARTE, que disputa os horários
    // livres de novo respeitando o que a peça exige. Nada que já está marcado
    // perde o lugar — janela ocupada continua ocupada, e a vencida vai para a
    // PRÓXIMA livre.
    //
    // Aprovada nunca vence: já virou campanha com data firmada.
    const expiradas = vencidas(
      ((atuais as any[]) ?? []).map(x => ({ ...x, quando: x.sugerido_para })),
    );
    if (expiradas.length) {
      await supabase.from('studio_sugestoes').delete().in('id', expiradas.map(x => x.id));
      setDevolvidas(expiradas.length);
    } else {
      setDevolvidas(0);
    }
    const expiradasIds = new Set(expiradas.map(x => x.id));
    // O TEMA VEM DA ARTE, não da linha do banco.
    //
    // `studio_sugestoes` não guarda o assunto da peça, e preencher com o
    // período (que foi o que fiz primeiro) faria a trava de repetição bloquear
    // por horário — inventar dado é pior do que não ter. A arte, porém, está
    // aqui no acervo e já foi classificada: é dela que o tema sai.
    //
    // Sem isto, dois cliques separados em "Gerar sugestões" podiam pôr dois
    // "bom dia" no mesmo dia — exatamente o que a regra existe para impedir.
    const temaDaArte = new Map(acervo.map(a => [a.id, a.agendamento.tema]));
    const jaAgendado = ((atuais as any[]) ?? [])
      .filter(x => !expiradasIds.has(x.id))   // o que venceu não ocupa mais nada
      .map(x => ({
        brand_id: x.brand_id, video_id: x.video_id, quando: x.sugerido_para,
        tema: temaDaArte.get(x.video_id) ?? null,
      }));

    // Embaralhar antes muda a seleção quando há mais artes que janelas — é o
    // que faz "gerar outra" trazer peças diferentes, e não as mesmas.
    const fila = outraSelecao ? [...paraAgendar].sort(() => Math.random() - 0.5) : paraAgendar;

    // `diasParaProgramar` pula hoje depois da última janela: sugerir para as
    // 08:00 às 21h nasceria vencido, que é o defeito ao contrário.
    const r = montarSugestoes(fila, janelas, jaAgendado, diasParaProgramar(dias, janelas),
      { diasParaReusar: DIAS_PARA_REUSAR });

    if (r.sugestoes.length === 0) {
      setGerando(false);
      await carregar();
      return;   // a explicação aparece no bloco "faltou arte", abaixo
    }
    const { error } = await supabase.from('studio_sugestoes').insert(
      r.sugestoes.map(s => ({
        brand_id: s.brand_id, video_id: s.video_id, plataforma: s.plataforma,
        sugerido_para: s.quando, periodo: s.periodo, motivo: s.motivo,
        confianca: s.confianca, status: 'sugerida',
        // A sugestão nasce COM o texto. Sem isto ela nascia com legenda nula,
        // a aprovação gravava `content: ''` e a peça ia ao ar em branco.
        legenda: legendaDaArte(artes.find(a => a.video_id === s.video_id), s.plataforma),
      })),
    );
    setGerando(false);
    if (error) { setErro(error.message); return; }
    carregar();
  }

  /**
   * Troca o texto de uma publicação JÁ AGENDADA, sem tirá-la da agenda.
   *
   * ⚠️ O ROBÔ PUBLICA `studio_campaigns.content`, não a legenda da sugestão.
   * Gravar só na sugestão mudaria o que aparece na tela e NÃO mudaria o que
   * vai ao ar — a mesma falha calada do `media_path`, que fez campanha ficar
   * "agendada" para sempre sem publicar. Por isso os dois são atualizados,
   * e a campanha primeiro: se ela falhar, nada é dito como feito.
   *
   * A ASSINATURA é refeita. Ela existe para registrar o que foi aprovado; se
   * o texto muda e a assinatura fica, o registro passa a mentir.
   *
   * `scheduled_at` não é tocado: o horário foi decidido e continua valendo.
   */
  /**
   * O texto que vai junto com a arte, montado do que a análise já produziu.
   *
   * A legenda da rede já traz hashtags dentro; as do campo `hashtags` são
   * acrescentadas só quando NÃO estão lá, para não repetir a mesma tag duas
   * vezes no post. É o mesmo critério da tela de análise.
   */
  /** A tag da marca, a partir do nome: "Café Tropeiro Paulista" vira
   *  #cafetropeiropaulista. É a única fixa — é a nossa casa. */
  const marcaTag = useMemo(() => {
    const limpo = brandName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return limpo ? '#' + limpo : null;
  }, [brandName]);

  /** As tags já usadas no que está agendado. Entram como "evite", para a
   *  rotação não cair de novo onde acabou de passar. */
  const tagsRecentes = useMemo(
    () => salvas.flatMap(x => (x.legenda ?? '').match(/#[^\s#]+/g) ?? []),
    [salvas]);

  function legendaDaArte(arte: ArteDisponivel | undefined, rede: string): string {
    if (!arte) return '';
    const base = (arte.legendas?.[rede] ?? arte.legendas?.instagram ?? '').trim();
    if (!base) return '';
    // ⚠️ AS TAGS DA ANÁLISE SÃO REPETITIVAS, e isso foi medido: nas 22 peças
    // agendadas, #CaféForte e #RitualDoCafé apareciam em 19. Bloco idêntico em
    // posts seguidos o Instagram trata como spam. O corpo do texto é dela e
    // continua sendo; só o bloco de tags é refeito, com rotação por peça.
    return trocarHashtags(base, montarHashtags(arte.video_id, {
      daMarca: marcaTag, recentes: tagsRecentes,
    }));
  }

  async function salvarLegenda(s: SugestaoSalva) {
    const texto = rascunho.trim();
    setAgindo(s.id); setErro('');

    if (s.campaign_id) {
      const { error } = await supabase.from('studio_campaigns')
        .update({ content: texto }).eq('id', s.campaign_id);
      if (error) { setAgindo(null); setErro('Não salvou na campanha: ' + error.message); return; }
    }

    const { error: eS } = await supabase.from('studio_sugestoes').update({
      legenda: texto,
      assinatura: assinatura({
        video_id: s.video_id, legenda: texto, brand_id: s.brand_id,
        plataforma: s.plataforma, quando: s.sugerido_para,
      }),
    }).eq('id', s.id);

    setAgindo(null);
    if (eS) { setErro(eS.message); return; }
    setEditando(null);
    carregar();
  }

  /** Pede outro texto à IA para a mesma arte. Não grava sozinho: o texto volta
   *  para a caixa e ele decide se fica. Gerar e salvar na mesma tecla tiraria
   *  dele a chance de ler antes. */
  async function gerarOutroTexto(s: SugestaoSalva) {
    const arte = artes.find(a => a.video_id === s.video_id);
    setGerandoTexto(true); setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('studio-caption', {
        body: {
          company_id: companyId ?? null,
          brand_id: s.brand_id,
          media_path: arte?.storage_path ?? null,
          network: s.plataforma ?? 'instagram',
          current: rascunho || s.legenda || '',
          action: rascunho || s.legenda ? 'refine' : 'generate',
          notes: arte?.texto_da_arte ?? null,
        },
      });
      if (error) throw new Error(error.message);
      const novo = (data as any)?.caption ?? (data as any)?.legenda ?? (data as any)?.text;
      if (!novo) throw new Error('A IA não devolveu texto.');
      setRascunho(String(novo));
    } catch (e) {
      setErro('Não gerou outro texto: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGerandoTexto(false);
    }
  }

  async function aprovar(s: SugestaoSalva) {
    setAgindo(s.id); setErro('');
    const arte = artes.find(a => a.video_id === s.video_id);

    // ⚠️ ÚLTIMA PORTA ANTES DO AR.
    // Em 21/10 uma peça foi publicada no Instagram SEM TEXTO NENHUM porque
    // `s.legenda` era nula e ninguém conferia. O banco agora recusa, mas o
    // erro tem de aparecer aqui, com o que fazer — e não como falha crua de
    // constraint depois que ele já clicou em aprovar.
    const texto = (s.legenda ?? '').trim() || legendaDaArte(arte, s.plataforma);
    if (!texto) {
      setAgindo(null);
      setErro('Esta peça não tem texto. Clique em "escrever o texto" no cartão antes de aprovar — publicar em branco não dá.');
      return;
    }
    const { data: campanha, error: eC } = await supabase.from('studio_campaigns').insert({
      video_id: s.video_id, brand_id: s.brand_id, platform: s.plataforma,
      title: arte?.titulo ?? 'Publicação agendada',
      content: texto, status: 'scheduled', scheduled_at: s.sugerido_para,
      // SEM media_path o robô `publish-scheduled` IGNORA a campanha: ele filtra
      // por media_path não nulo. A campanha nascia e nunca publicava, calada.
      media_path: arte?.storage_path ?? null,
      media_type: arte?.media_type ?? 'image',
    }).select('id').single();
    if (eC) { setAgindo(null); setErro('Não criou a campanha: ' + eC.message); return; }

    const { data: u } = await supabase.auth.getUser();
    const { error: eS } = await supabase.from('studio_sugestoes').update({
      status: 'aprovada', campaign_id: campanha.id,
      aprovado_por: u.user?.id ?? null, aprovado_em: new Date().toISOString(),
      assinatura: assinatura({
        video_id: s.video_id, legenda: texto, brand_id: s.brand_id,
        plataforma: s.plataforma, quando: s.sugerido_para,
      }),
      legenda: texto,
    }).eq('id', s.id);
    setAgindo(null);
    if (eS) { setErro(eS.message); return; }
    carregar();
  }

  async function rejeitar(s: SugestaoSalva) {
    const motivo = prompt('Por que esta sugestão não serve? (opcional)');
    if (motivo === null) return;
    setAgindo(s.id);
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('studio_sugestoes').update({
      status: 'rejeitada', rejeitado_por: u.user?.id ?? null,
      rejeitado_em: new Date().toISOString(), motivo_rejeicao: motivo || null,
    }).eq('id', s.id);
    setAgindo(null);
    carregar();
  }

  async function aprovarTudo() {
    const pendentes = salvas.filter(s => s.status === 'sugerida');
    if (!confirm(`Aprovar ${pendentes.length} publicação(ões) de ${brandName}?`)) return;
    for (const s of pendentes) await aprovar(s);
  }

  /**
   * O CALENDÁRIO INTEIRO — todos os dias do período, todas as janelas.
   *
   * ⚠️ ANTES, O BURACO SUMIA AO ATUALIZAR A PÁGINA.
   *
   * Os horários vazios vinham só do resultado da última geração, guardados em
   * memória. Recarregar a tela apagava a lista, e o dia 27 mostrava 08:00 e
   * 15:00 sem dizer que as 19:00 estavam abertas — o espaço não aparecia
   * vazio, ele simplesmente não existia. O bloco "faltou arte para N
   * horários" sumia junto, justamente quando ele precisava dele para saber o
   * que criar.
   *
   * Agora é calculado na hora de mostrar, a partir dos dias pedidos e das
   * janelas da marca. Abrir a página amanhã mostra o mesmo que hoje.
   */
  const porDia = useMemo(() => {
    const m = new Map<string, { sugestoes: SugestaoSalva[]; vazios: Vazio[] }>();
    const garante = (d: string) => {
      if (!m.has(d)) m.set(d, { sugestoes: [], vazios: [] });
      return m.get(d)!;
    };
    for (const s of salvas) garante(diaLocal(s.sugerido_para)).sugestoes.push(s);

    // Os dias do período pedido, pulando hoje depois da última janela — a
    // mesma conta que a geração usa, para a tela não prometer o que o
    // agendador não faria.
    const ativas = janelas.filter(j => j.ativa);
    for (const dia of diasParaProgramar(dias, ativas)) {
      const doDia = garante(dia);
      const indiceDia = new Date(dia + 'T12:00:00').getDay();
      for (const j of ativas) {
        if (j.dia_semana !== null && j.dia_semana !== indiceDia) continue;
        const quando = `${dia}T${j.hora}:00-03:00`;
        const ocupado = doDia.sugestoes.some(
          s => Math.abs(new Date(s.sugerido_para).getTime() - new Date(quando).getTime()) < 60_000);
        if (ocupado) continue;
        doDia.vazios.push({
          brand_id: j.brand_id, quando, hora: j.hora, periodo: j.periodo,
          motivo: 'Nenhuma arte adequada para este dia e horário.',
        });
      }
      doDia.vazios.sort((a, b) => a.hora.localeCompare(b.hora));
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [salvas, janelas, dias]);

  /** Todos os vazios do período, para os contadores. Substitui a lista que
   *  vinha da geração e evaporava. */
  const vaziosVivos = useMemo(
    () => porDia.flatMap(([, d]) => d.vazios), [porDia]);

  const pendentes = salvas.filter(s => s.status === 'sugerida').length;

  /** O que faltou, por período — vira o pedido de criação. */
  /**
   * O BALANÇO POR PERÍODO: o que falta, o que tem, e o que sobra.
   *
   * Pedido dele: "se faltam 8 e eu gerei 9, ela fica no próximo bloco de 14
   * dias" — e "conforme vai agendando ele vai atualizando, se eu carregar 1
   * noite ele vira 7".
   *
   * As duas pontas importam. Só mostrar o que falta esconde que ele já tem
   * arte parada esperando vaga; só mostrar o que tem esconde o buraco. Ver os
   * dois lado a lado é o que permite decidir se cria mais uma ou se já pode
   * parar.
   *
   * A nona arte de noite não se perde nem é descartada: ela continua
   * disponível no acervo e entra no próximo período — a tela só deixa isso
   * explícito, em vez de ele descobrir que sobrou quando o painel não mudar.
   */
  const balancoPorPeriodo = useMemo(() => {
    const falta = new Map<string, number>();
    for (const v of vaziosVivos) falta.set(v.periodo, (falta.get(v.periodo) ?? 0) + 1);

    const tem = new Map<string, number>();
    for (const a of paraAgendar) {
      // Peça sem período declarado serve em qualquer janela: conta como
      // coringa, não como sobra de um período específico.
      const p = a.agendamento.periodo ?? 'qualquer';
      tem.set(p, (tem.get(p) ?? 0) + 1);
    }

    const periodos = new Set([...falta.keys(), ...tem.keys()]);
    periodos.delete('qualquer');

    const linhas = [...periodos].map(p => {
      const f = falta.get(p) ?? 0;
      const t = tem.get(p) ?? 0;
      return { periodo: p, falta: f, tem: t, sobra: Math.max(0, t - f) };
    }).sort((a, b) => b.falta - a.falta);

    return { linhas, coringas: tem.get('qualquer') ?? 0 };
  }, [vaziosVivos, paraAgendar]);

  /** Mantido para quem lê de fora: só o que falta, por período. */
  const faltamPorPeriodo = useMemo(
    () => balancoPorPeriodo.linhas.filter(l => l.falta > 0).map(l => [l.periodo, l.falta] as const),
    [balancoPorPeriodo]);

  const janelasPorDia = janelas.filter(j => j.dia_semana === null).length || janelas.length;
  /** Até quantos dias o acervo cobre, se tudo encaixasse. É o teto otimista. */
  const diasQueCobre = janelasPorDia > 0 ? Math.floor(paraAgendar.length / janelasPorDia) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
                <CalendarClock className="w-5 h-5" />
              </span>
              Agendador inteligente — {brandName}
            </h2>
            <p className="text-sm text-gray-500 mt-1 ml-11">
              A IA lê o que a arte diz e propõe dia e horário. <strong className="text-gray-700">Nada publica sem você aprovar.</strong>
            </p>
          </div>
          <button onClick={carregar} title="Atualizar" className="text-gray-400 hover:text-gray-700">
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {erro && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">Programar os próximos</label>
          <select value={dias} onChange={e => setDias(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            {[3, 7, 14].map(d => <option key={d} value={d}>{d} dias</option>)}
          </select>
          <button onClick={() => gerar(false)} disabled={gerando || janelas.length === 0}
            className="inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar sugestões
          </button>
          {pendentes > 0 && (
            <>
              <button onClick={() => gerar(true)} disabled={gerando}
                title="Descarta as sugestões ainda não aprovadas e monta outra seleção"
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:border-[#8B2214] hover:text-[#8B2214] text-sm font-semibold px-4 py-2 rounded-lg">
                <Shuffle className="w-4 h-4" /> Gerar outra seleção
              </button>
              <button onClick={aprovarTudo}
                className="inline-flex items-center gap-2 border border-[#8B2214] text-[#8B2214] hover:bg-[#f5f0ef] text-sm font-semibold px-4 py-2 rounded-lg">
                <Check className="w-4 h-4" /> Aprovar as {pendentes}
              </button>
            </>
          )}
        </div>

        {/* A conta, por extenso: com 18 artes e 3 janelas, o acervo dá 6 dias.
            Pedir 14 e receber 6 sem explicação é o que ele quis evitar. */}
        {paraAgendar.length > 0 && janelasPorDia > 0 && (
          <p className={`mt-3 text-sm rounded-lg px-3 py-2 ${
            diasQueCobre < dias ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-gray-50 text-gray-600'}`}>
            {paraAgendar.length} arte(s) ÷ {janelasPorDia} por dia ={' '}
            <strong>cerca de {diasQueCobre} dia(s)</strong> de programação.
            {diasQueCobre < dias && (
              <> Você pediu {dias} — os dias que sobrarem ficam vazios, e eu digo abaixo o que falta criar.</>
            )}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
          <button onClick={() => setVerAcervo(v => !v)}
            className="inline-flex items-center gap-1.5 hover:text-[#8B2214]">
            <Images className="w-3.5 h-3.5" />
            <strong className="text-gray-700">{paraAgendar.length}</strong> disponível(is) de {acervo.length}
            <span className="text-gray-400">({verAcervo ? 'ocultar' : 'ver todas'})</span>
          </button>
          {naFila.length > 0 && (
            <span className="text-amber-700"><strong>{naFila.length}</strong> na agenda</span>
          )}
          {recemPublicadas.length > 0 && (
            <span title={`Voltam a ficar disponíveis ${DIAS_PARA_REUSAR} dias depois de publicadas`}>
              <strong className="text-gray-700">{recemPublicadas.length}</strong> já publicada(s)
            </span>
          )}
          {precisamRevisao.length > 0 && (
            <span className="text-amber-700"><strong>{precisamRevisao.length}</strong> precisam de revisão</span>
          )}
        </div>

        {/* ---- O BALANÇO, no lugar onde ele olha primeiro ----
            Antes dizia só "Serve: 0 manhã · 0 tarde · 0 noite", que conta o
            que TEM e esconde o que FALTA. Ver os dois lado a lado é o que
            permite decidir se cria mais uma ou se já pode parar — e o que
            mostra os {dias} dias fechando conforme ele carrega arte. */}
        {balancoPorPeriodo.linhas.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              Para fechar os {dias} dias:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {balancoPorPeriodo.linhas.map(l => {
                const fechado = l.falta === 0;
                return (
                  <div key={l.periodo} className={`rounded-lg border px-3 py-2 ${
                    fechado ? 'border-green-200 bg-green-50/50' : 'border-[#ddd0cc] bg-[#f5f0ef]'}`}>
                    <p className="text-xs font-semibold text-gray-700 capitalize">
                      {PERIODO_ROTULO[l.periodo] ?? l.periodo}
                    </p>
                    <p className={`text-sm font-bold ${fechado ? 'text-green-700' : 'text-[#8B2214]'}`}>
                      {fechado
                        ? 'completo'
                        : <>faltam {l.falta}</>}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {l.tem} pronta(s)
                      {/* A arte que sobra NÃO se perde: fica no acervo e entra
                          no período seguinte. Dizer isso evita a impressão de
                          que o trabalho dele foi descartado. */}
                      {l.sobra > 0 && (
                        <> · <strong className="text-gray-700">{l.sobra}</strong> para o próximo período</>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
            {balancoPorPeriodo.coringas > 0 && (
              <p className="text-[11px] text-gray-500 mt-2">
                <strong className="text-gray-700">{balancoPorPeriodo.coringas}</strong> arte(s) sem
                horário definido — servem em qualquer janela.
              </p>
            )}
          </div>
        )}
      </div>

      {/* acervo disponível, com a arte à vista */}
      {verAcervo && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-1">Acervo de {brandName} ({acervo.length})</h3>
          <p className="text-xs text-gray-500 mb-3">
            Todas as artes da marca, com o estado de cada uma. As já publicadas voltam a ficar
            disponíveis depois de {DIAS_PARA_REUSAR} dias.
          </p>
          {acervo.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma arte nesta marca ainda.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {acervo.map(a => {
                const info = artes.find(x => x.video_id === a.id);
                const st = estadoDa(a);
                return (
                  <div key={a.id} className="flex items-start gap-3 border border-gray-200 rounded-lg p-3">
                    <Miniatura arte={info} url={miniDe(info)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate" title={a.titulo}>{a.titulo}</p>
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${st.cls}`}>{st.txt}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.agendamento.dia_da_semana ? `só ${a.agendamento.dia_da_semana}` : 'qualquer dia'}
                        {a.agendamento.periodo ? ` · ${PERIODO_ROTULO[a.agendamento.periodo]}` : ' · qualquer horário'}
                      </p>
                      {info?.texto_da_arte && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{info.texto_da_arte}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ⚠️ A AGENDA SE REORGANIZOU — e ele precisa saber por quê.
          Arte que estava marcada para um horário já passado volta para a fila
          e disputa os próximos horários LIVRES. Nada que já estava agendado
          perde o lugar, e aprovada nunca é tocada. Reorganizar em silêncio
          seria pior que não reorganizar: ele abriria a agenda sem entender o
          que mudou. */}
      {devolvidas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">
              {devolvidas} arte(s) voltaram para a fila
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              O horário delas passou sem aprovação. Elas foram <strong>jogadas para frente</strong>,
              para os próximos horários livres — nada que já estava agendado saiu do lugar,
              e peça aprovada não foi tocada.
            </p>
          </div>
        </div>
      )}

      {/* o que falta para completar o período pedido */}
      {faltamPorPeriodo.length > 0 && (
        <div className="bg-white border border-[#ddd0cc] rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
            <Wand2 className="w-5 h-5 text-[#8B2214]" /> Faltou arte para {vaziosVivos.length} horário(s)
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Deixei vazios de propósito — publicar a peça errada é pior que não publicar.
            Para fechar os {dias} dias, crie arte de:
          </p>
          <ul className="space-y-1.5 mb-3">
            {faltamPorPeriodo.map(([p, n]) => (
              <li key={p} className="text-sm text-gray-800">
                <strong>{n}×</strong> arte de <strong className="text-[#8B2214]">{PERIODO_ROTULO[p] ?? p}</strong>
                <span className="text-gray-500"> — {PERIODO_DICA[p] ?? ''}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {onCarregarArte && (
              <button onClick={onCarregarArte}
                className="inline-flex items-center gap-2 border border-[#8B2214] text-[#8B2214] hover:bg-[#f5f0ef] text-sm font-semibold px-4 py-2 rounded-lg">
                <Upload className="w-4 h-4" /> Carregar arte pronta
              </button>
            )}
            {onCriarImagem && (
              <button onClick={onCriarImagem}
                className="inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg">
                <Wand2 className="w-4 h-4" /> Criar com IA
              </button>
            )}
          </div>
        </div>
      )}

      {/* calendário */}
      {porDia.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Nenhuma sugestão ainda. Clique em <strong>Gerar sugestões</strong>.
          </p>
        </div>
      ) : porDia.map(([dia, { sugestoes, vazios: vaziosDoDia }]) => (
        <div key={dia} className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-bold text-gray-900 mb-3 capitalize">{rotuloDia(dia)}</p>
          <div className="space-y-2">
            {sugestoes.sort((a, b) => a.sugerido_para.localeCompare(b.sugerido_para)).map(s => {
              const arte = artes.find(a => a.video_id === s.video_id);
              const mini = miniDe(arte);
              // Três estados na mesma lista, e a diferença entre eles tem de
              // ser visível de relance: publicada é HISTÓRICO (não pede nada),
              // aprovada está ESPERANDO a hora, sugerida PEDE decisão.
              const publicada = s.status === 'publicada';
              const aprovada = s.status === 'aprovada';
              return (
                <div key={s.id} className={`border rounded-lg p-3 ${
                  publicada ? 'border-gray-200 bg-gray-50 opacity-75'
                  : aprovada ? 'border-green-200 bg-green-50/40'
                  : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex items-center gap-1 text-sm font-bold text-gray-900 flex-shrink-0 pt-0.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> {horaLocal(s.sugerido_para)}
                    </span>
                    {/* a arte, não o nome do arquivo */}
                    <Miniatura arte={arte} url={mini} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate" title={arte?.titulo}>{arte?.titulo ?? '(arte removida)'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.motivo}</p>
                      {arte?.texto_da_arte && (
                        <p className="text-[11px] text-gray-400 mt-1">Texto da arte: {arte.texto_da_arte}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${
                      publicada ? 'bg-gray-200 text-gray-600'
                      : aprovada ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'}`}>
                      {publicada ? 'publicada' : aprovada ? 'aprovada' : PERIODO_ROTULO[s.periodo] ?? s.periodo}
                    </span>
                  </div>
                  {/* ---- O TEXTO QUE VAI AO AR ----
                      Ele pediu: "se eu for lá e ler o que a IA gerou e não
                      gostar, devo ter a opção de mudar ou gerar um novo texto,
                      não sai da linha do agendamento". O horário fica onde
                      está; só o texto muda. Publicada não edita — já saiu. */}
                  {/* PUBLICADA: o texto fica à vista para ler e copiar.
                      Eu havia escondido o bloco inteiro pensando "não há o que
                      decidir sobre o passado" — e esqueci que ele pode querer
                      reaproveitar o que deu certo. Não há botão de editar
                      porque isso já saiu; mudar aqui não mudaria nada no ar. */}
                  {publicada && (
                    <div className="mt-2.5 border-t border-gray-100 pt-2.5">
                      {s.legenda?.trim() ? (
                        <>
                          <p className="text-xs text-gray-600 whitespace-pre-wrap">{s.legenda}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(s.legenda ?? '');
                              setCopiada(s.id);
                              setTimeout(() => setCopiada(null), 2000);
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline">
                            {copiada === s.id ? <><Check className="w-3 h-3" /> copiado</> : 'copiar o texto'}
                          </button>
                        </>
                      ) : (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                          <p className="text-xs font-semibold text-amber-900">
                            Esta peça foi publicada <strong>sem texto</strong> — o defeito corrigido em 21/10.
                          </p>
                          {/* O texto que DEVERIA ter ido. O post está no ar sem
                              legenda; copiar daqui e colar no Instagram
                              conserta o que já saiu, que é o que ele pode
                              fazer hoje — o sistema não edita post publicado. */}
                          {legendaDaArte(arte, s.plataforma) && (
                            <>
                              <p className="text-[11px] text-amber-800 mt-1.5 mb-1">
                                O texto que deveria ter ido — copie e cole no post:
                              </p>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border border-amber-100">
                                {legendaDaArte(arte, s.plataforma)}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(legendaDaArte(arte, s.plataforma));
                                  setCopiada(s.id);
                                  setTimeout(() => setCopiada(null), 2000);
                                }}
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline">
                                {copiada === s.id ? <><Check className="w-3 h-3" /> copiado</> : 'copiar o texto'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!publicada && (
                    editando === s.id ? (
                      <div className="mt-2.5 border-t border-gray-100 pt-2.5 space-y-2">
                        <textarea
                          value={rascunho}
                          onChange={e => setRascunho(e.target.value)}
                          rows={5}
                          placeholder="O texto que vai junto com a arte…"
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B2214]/30"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => salvarLegenda(s)} disabled={agindo === s.id}
                            className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {agindo === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Salvar texto
                          </button>
                          <button onClick={() => gerarOutroTexto(s)} disabled={gerandoTexto}
                            className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:border-[#8B2214] hover:text-[#8B2214] text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {gerandoTexto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Gerar outro texto
                          </button>
                          <button onClick={() => setEditando(null)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2">
                            cancelar
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          O horário não muda. Salvar atualiza o que o robô vai publicar.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2.5 border-t border-gray-100 pt-2.5">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-3">
                          {s.legenda?.trim() || <span className="text-gray-400 italic">sem texto ainda</span>}
                        </p>
                        <button onClick={() => { setEditando(s.id); setRascunho(s.legenda ?? ''); }}
                          className="mt-1.5 text-xs font-semibold text-[#8B2214] hover:underline">
                          {s.legenda?.trim() ? 'mudar o texto' : 'escrever o texto'}
                        </button>
                      </div>
                    )
                  )}

                  {publicada ? null : !aprovada ? (
                    <div className="mt-2.5 flex flex-wrap gap-2 border-t border-gray-100 pt-2.5">
                      <button onClick={() => aprovar(s)} disabled={agindo === s.id}
                        className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                        {agindo === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Aprovar
                      </button>
                      <button onClick={() => rejeitar(s)} disabled={agindo === s.id}
                        className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg">
                        <X className="w-3.5 h-3.5" /> Rejeitar
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-green-700 border-t border-green-100 pt-2">
                      Agendada. O robô publica no horário — a mesma rotina das publicações de sempre.
                    </p>
                  )}
                </div>
              );
            })}

            {/* horário sem arte adequada: um pedido, não um silêncio */}
            {vaziosDoDia.sort((a, b) => a.hora.localeCompare(b.hora)).map((v, i) => (
              <div key={`v${i}`} className="border border-dashed border-gray-300 rounded-lg p-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 text-sm font-bold text-gray-400 flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" /> {v.hora}
                </span>
                <p className="text-sm text-gray-500">
                  Sem arte de <strong>{PERIODO_ROTULO[v.periodo] ?? v.periodo}</strong> disponível para este dia.
                </p>
                <span className="ml-auto flex items-center gap-3 flex-shrink-0">
                  {onCarregarArte && (
                    <button onClick={onCarregarArte} title="Já tenho a arte pronta no computador"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#8B2214] hover:underline">
                      <Upload className="w-3.5 h-3.5" /> Carregar uma
                    </button>
                  )}
                  {onCriarImagem && (
                    <button onClick={onCriarImagem} title="Gerar a arte com IA"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2214] hover:underline">
                      <Wand2 className="w-3.5 h-3.5" /> Criar uma
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* o que a IA não soube classificar */}
      {precisamRevisao.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Precisam de revisão ({precisamRevisao.length})
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            A IA não teve confiança suficiente para dizer quando estas devem sair. Ficam de fora
            do automático — agendar errado é pior do que não agendar.
          </p>
          <div className="space-y-1.5">
            {precisamRevisao.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                <ImageOff className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="truncate">{a.titulo}</span>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{a.agendamento.justificativa}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {janelas.length === 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Esta marca não tem janelas de horário configuradas. Sem elas o agendador não tem onde encaixar nada.
        </p>
      )}
    </div>
  );
}
