// Calendário inteligente — a IA organiza, o Vlademir aprova.
//
// Nada daqui vai ao ar sozinho. Aprovar uma sugestão CRIA uma campanha em
// `studio_campaigns`, igual às que ele cria à mão — e é o robô de sempre
// (`publish-scheduled`) que publica. Esta tela não publica nada.
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CalendarClock, Sparkles, Check, X, Loader2, RefreshCw, AlertTriangle,
  Clock, ImageOff,
} from 'lucide-react';
import {
  classificar, montarSugestoes, assinatura, LIMITE_REVISAO,
  type Arte, type Janela, type Agendamento,
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
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * O banco guarda timestamptz e devolve em UTC. 08:00 de São Paulo volta como
 * 11:00Z — e mostrar `slice(11,16)` escreveria "11:00" num cartão cujo motivo
 * diz "às 08:00". Foi o que apareceu na verificação. Daqui para baixo, tudo
 * que é hora e dia passa pelo fuso de São Paulo.
 */
const FUSO = 'America/Sao_Paulo';

/** A hora como o Vlademir combinou: 08:00, não 11:00. */
function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
}

/** O dia a que a publicação pertence em São Paulo, para agrupar o calendário. */
function diaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });  // YYYY-MM-DD
}

/** Data local (São Paulo), nunca `new Date('YYYY-MM-DD')` — isso lê como UTC. */
function dataLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}
function rotuloDia(iso: string): string {
  const d = dataLocal(iso);
  return `${DIAS_PT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Os próximos N dias, a partir de hoje, em YYYY-MM-DD local. */
function proximosDias(n: number): string[] {
  const hoje = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

export default function AgendadorPanel({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [artes, setArtes] = useState<ArteDisponivel[]>([]);
  const [janelas, setJanelas] = useState<Janela[]>([]);
  const [salvas, setSalvas] = useState<SugestaoSalva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(7);

  async function carregar() {
    setCarregando(true); setErro('');
    const [{ data: a }, { data: j }, { data: s }] = await Promise.all([
      supabase.from('vw_studio_artes_disponiveis').select('*').eq('brand_id', brandId),
      supabase.from('studio_janelas').select('*').eq('brand_id', brandId).eq('ativa', true),
      supabase.from('studio_sugestoes').select('*').eq('brand_id', brandId)
        .in('status', ['sugerida', 'aprovada', 'revisar']).order('sugerido_para'),
    ]);
    setArtes((a as ArteDisponivel[]) ?? []);
    setJanelas(((j as any[]) ?? []).map(x => ({
      brand_id: x.brand_id, dia_semana: x.dia_semana, hora: x.hora,
      periodo: x.periodo, plataforma: x.plataforma, ativa: x.ativa,
    })));
    setSalvas((s as SugestaoSalva[]) ?? []);
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, [brandId]);

  /** Quantos dias uma arte publicada espera antes de poder voltar. */
  const DIAS_PARA_REUSAR = 90;

  /** Todas as artes da marca, já classificadas. */
  const classificadas = useMemo<Arte[]>(() => artes
    .filter(a => !a.na_fila)
    .map(a => ({
      id: a.video_id, brand_id: a.brand_id, titulo: a.titulo,
      // Se a análise ainda não tem o bloco de agendamento, classifica na hora
      // a partir do texto que a IA já extraiu. É o que torna as artes antigas
      // utilizáveis sem gastar uma chamada de IA nova.
      agendamento: a.agendamento ?? classificar({
        textoDaArte: a.texto_da_arte, resumo: a.resumo,
      }),
      publicada_em: a.publicada_em,
    })), [artes]);

  /**
   * "Disponível" é o que REALMENTE pode entrar no calendário — não o total da
   * biblioteca.
   *
   * O motor já descartava as publicadas por dentro, então as sugestões sempre
   * estiveram certas. O CONTADOR é que somava tudo: dizia "40 disponíveis"
   * numa marca com 22 já publicadas. Quem lê conclui que tem três semanas de
   * estoque quando tem uma — e isso muda decisão de produção de arte.
   */
  const jaPublicadas = classificadas.filter(a =>
    a.publicada_em && (Date.now() - new Date(a.publicada_em).getTime()) / 86400000 < DIAS_PARA_REUSAR);
  const precisamRevisao = classificadas.filter(a =>
    !jaPublicadas.includes(a) && a.agendamento.confianca < LIMITE_REVISAO);
  const paraAgendar = classificadas.filter(a =>
    !jaPublicadas.includes(a) && a.agendamento.confianca >= LIMITE_REVISAO);

  async function gerar() {
    setGerando(true); setErro('');
    const jaAgendado = salvas.map(s => ({
      brand_id: s.brand_id, video_id: s.video_id, quando: s.sugerido_para,
      tema: 'desconhecido',
    }));
    const { sugestoes } = montarSugestoes(
      paraAgendar, janelas, jaAgendado, proximosDias(dias),
      { diasParaReusar: DIAS_PARA_REUSAR },
    );
    if (sugestoes.length === 0) {
      setGerando(false);
      setErro('Nenhuma arte adequada para as janelas desta marca. Nada foi agendado — e isso é melhor do que preencher por preencher.');
      return;
    }
    const { error } = await supabase.from('studio_sugestoes').insert(
      sugestoes.map(s => ({
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
    // 1. cria a campanha — do mesmo jeito que o Vlademir cria à mão
    const { data: campanha, error: eC } = await supabase.from('studio_campaigns').insert({
      video_id: s.video_id, brand_id: s.brand_id, platform: s.plataforma,
      title: arte?.titulo ?? 'Publicação agendada',
      content: s.legenda ?? '', status: 'scheduled', scheduled_at: s.sugerido_para,
      // SEM media_path o robo  IGNORA a campanha: ele filtra
      // por .not("media_path", "is", null). Descoberto conferindo o banco apos
      // a primeira aprovacao de teste -- a campanha nascia e nunca publicava,
      // calada. A tela nao mostraria isso nunca.
      media_path: arte?.storage_path ?? null,
      media_type: arte?.media_type ?? 'image',
    }).select('id').single();
    if (eC) { setAgindo(null); setErro('Não criou a campanha: ' + eC.message); return; }

    // 2. carimba a aprovação com a assinatura do que foi aprovado
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
    const motivo = prompt('Por que esta sugestão não serve? (opcional, ajuda a melhorar)');
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

  const porDia = useMemo(() => {
    const m = new Map<string, SugestaoSalva[]>();
    for (const s of salvas) {
      const dia = diaLocal(s.sugerido_para);
      if (!m.has(dia)) m.set(dia, []);
      m.get(dia)!.push(s);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [salvas]);

  const pendentes = salvas.filter(s => s.status === 'sugerida').length;

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

        {erro && (
          <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">Programar os próximos</label>
          <select value={dias} onChange={e => setDias(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            {[3, 7, 14].map(d => <option key={d} value={d}>{d} dias</option>)}
          </select>
          <button onClick={gerar} disabled={gerando || janelas.length === 0}
            className="inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar sugestões
          </button>
          {pendentes > 0 && (
            <button onClick={aprovarTudo}
              className="inline-flex items-center gap-2 border border-[#8B2214] text-[#8B2214] hover:bg-[#f5f0ef] text-sm font-semibold px-4 py-2 rounded-lg">
              <Check className="w-4 h-4" /> Aprovar as {pendentes}
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span><strong className="text-gray-700">{paraAgendar.length}</strong> arte(s) disponíveis</span>
          {jaPublicadas.length > 0 && (
            <span title={`Voltam a ficar disponíveis ${DIAS_PARA_REUSAR} dias depois de publicadas`}>
              <strong className="text-gray-700">{jaPublicadas.length}</strong> já publicada(s)
            </span>
          )}
          <span><strong className="text-gray-700">{janelas.length}</strong> janela(s) de horário</span>
          {precisamRevisao.length > 0 && (
            <span className="text-amber-700">
              <strong>{precisamRevisao.length}</strong> precisam de revisão (a IA não teve certeza)
            </span>
          )}
        </div>
      </div>

      {/* calendário */}
      {porDia.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Nenhuma sugestão ainda. Clique em <strong>Gerar sugestões</strong>.
          </p>
        </div>
      ) : porDia.map(([dia, lista]) => (
        <div key={dia} className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-bold text-gray-900 mb-3 capitalize">{rotuloDia(dia)}</p>
          <div className="space-y-2">
            {lista.sort((a, b) => a.sugerido_para.localeCompare(b.sugerido_para)).map(s => {
              const arte = artes.find(a => a.video_id === s.video_id);
              const hora = horaLocal(s.sugerido_para);
              const aprovada = s.status === 'aprovada';
              return (
                <div key={s.id} className={`border rounded-lg p-3 ${aprovada ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex items-center gap-1 text-sm font-bold text-gray-900 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> {hora}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{arte?.titulo ?? '(arte removida)'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.motivo}</p>
                      {arte?.texto_da_arte && (
                        <p className="text-[11px] text-gray-400 mt-1 truncate">
                          Texto da arte: {arte.texto_da_arte}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 ${
                      aprovada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {aprovada ? 'aprovada' : PERIODO_ROTULO[s.periodo] ?? s.periodo}
                    </span>
                  </div>
                  {!aprovada && (
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
                  )}
                  {aprovada && (
                    <p className="mt-2 text-[11px] text-green-700 border-t border-green-100 pt-2">
                      Agendada. O robô publica no horário — a mesma rotina das publicações de sempre.
                    </p>
                  )}
                </div>
              );
            })}
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
