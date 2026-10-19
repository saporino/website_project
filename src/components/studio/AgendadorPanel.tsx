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
  Clock, ImageOff, Images, Wand2, Shuffle,
} from 'lucide-react';
import {
  classificar, montarSugestoes, assinatura, LIMITE_REVISAO,
  type Arte, type Janela, type Agendamento, type Vazio,
} from './agendador';

interface ArteDisponivel {
  video_id: string; brand_id: string; marca: string; titulo: string;
  thumbnail_path: string | null; storage_path: string | null; media_type: string | null;
  agendamento: Agendamento | null;
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
function proximosDias(n: number): string[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
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

export default function AgendadorPanel({ brandId, brandName, onCriarImagem }: {
  brandId: string; brandName: string; onCriarImagem?: () => void;
}) {
  const [artes, setArtes] = useState<ArteDisponivel[]>([]);
  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [salvas, setSalvas] = useState<SugestaoSalva[]>([]);
  const [vazios, setVazios] = useState<Vazio[]>([]);
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
        .in('status', ['sugerida', 'aprovada', 'revisar']).order('sugerido_para'),
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

  /**
   * Quantas artes servem cada período — a conta que diz até onde o acervo vai.
   * Arte sem período definido serve a qualquer janela, então entra nos três.
   */
  const acervoPorPeriodo = useMemo(() => {
    const c: Record<string, number> = { manha: 0, tarde: 0, noite: 0 };
    for (const a of paraAgendar) {
      if (a.agendamento.periodo) c[a.agendamento.periodo]++;
      else { c.manha++; c.tarde++; c.noite++; }
    }
    return c;
  }, [paraAgendar]);

  async function gerar(outraSelecao = false) {
    setGerando(true); setErro('');

    // "Gerar outra seleção" apaga as sugestões ainda não aprovadas e refaz.
    // O que já foi aprovado NUNCA é tocado — virou campanha, e mexer nisso
    // seria desfazer uma decisão dele.
    if (outraSelecao) {
      await supabase.from('studio_sugestoes').delete()
        .eq('brand_id', brandId).eq('status', 'sugerida');
    }

    const aprovadas = salvas.filter(s => s.status === 'aprovada');
    const jaAgendado = aprovadas.map(s => ({
      brand_id: s.brand_id, video_id: s.video_id, quando: s.sugerido_para, tema: 'aprovada',
    }));

    // Embaralhar antes muda a seleção quando há mais artes que janelas — é o
    // que faz "gerar outra" trazer peças diferentes, e não as mesmas.
    const fila = outraSelecao ? [...paraAgendar].sort(() => Math.random() - 0.5) : paraAgendar;

    const r = montarSugestoes(fila, janelas, jaAgendado, proximosDias(dias),
      { diasParaReusar: DIAS_PARA_REUSAR });
    setVazios(r.vazios);

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
      })),
    );
    setGerando(false);
    if (error) { setErro(error.message); return; }
    carregar();
  }

  async function aprovar(s: SugestaoSalva) {
    setAgindo(s.id); setErro('');
    const arte = artes.find(a => a.video_id === s.video_id);
    const { data: campanha, error: eC } = await supabase.from('studio_campaigns').insert({
      video_id: s.video_id, brand_id: s.brand_id, platform: s.plataforma,
      title: arte?.titulo ?? 'Publicação agendada',
      content: s.legenda ?? '', status: 'scheduled', scheduled_at: s.sugerido_para,
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
        video_id: s.video_id, legenda: s.legenda ?? '', brand_id: s.brand_id,
        plataforma: s.plataforma, quando: s.sugerido_para,
      }),
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

  /** Calendário: sugestões e horários vazios, juntos, na ordem do dia. */
  const porDia = useMemo(() => {
    const m = new Map<string, { sugestoes: SugestaoSalva[]; vazios: Vazio[] }>();
    const garante = (d: string) => {
      if (!m.has(d)) m.set(d, { sugestoes: [], vazios: [] });
      return m.get(d)!;
    };
    for (const s of salvas) garante(diaLocal(s.sugerido_para)).sugestoes.push(s);
    for (const v of vazios) garante(diaLocal(v.quando)).vazios.push(v);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [salvas, vazios]);

  const pendentes = salvas.filter(s => s.status === 'sugerida').length;

  /** O que faltou, por período — vira o pedido de criação. */
  const faltamPorPeriodo = useMemo(() => {
    const c = new Map<string, number>();
    for (const v of vazios) c.set(v.periodo, (c.get(v.periodo) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [vazios]);

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
          <span>
            Serve: <strong className="text-gray-700">{acervoPorPeriodo.manha}</strong> manhã ·{' '}
            <strong className="text-gray-700">{acervoPorPeriodo.tarde}</strong> tarde ·{' '}
            <strong className="text-gray-700">{acervoPorPeriodo.noite}</strong> noite
          </span>
          {precisamRevisao.length > 0 && (
            <span className="text-amber-700"><strong>{precisamRevisao.length}</strong> precisam de revisão</span>
          )}
        </div>
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

      {/* o que falta para completar o período pedido */}
      {faltamPorPeriodo.length > 0 && (
        <div className="bg-white border border-[#ddd0cc] rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
            <Wand2 className="w-5 h-5 text-[#8B2214]" /> Faltou arte para {vazios.length} horário(s)
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
          {onCriarImagem && (
            <button onClick={onCriarImagem}
              className="inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg">
              <Wand2 className="w-4 h-4" /> Criar imagem agora
            </button>
          )}
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
              const aprovada = s.status === 'aprovada';
              return (
                <div key={s.id} className={`border rounded-lg p-3 ${aprovada ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
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
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">Texto da arte: {arte.texto_da_arte}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${
                      aprovada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {aprovada ? 'aprovada' : PERIODO_ROTULO[s.periodo] ?? s.periodo}
                    </span>
                  </div>
                  {!aprovada ? (
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
                {onCriarImagem && (
                  <button onClick={onCriarImagem}
                    className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2214] hover:underline flex-shrink-0">
                    <Wand2 className="w-3.5 h-3.5" /> Criar uma
                  </button>
                )}
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
