import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Flame, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FUSO } from '../../lib/horario';

/**
 * Placar de postagem da marca: quantas saíram hoje, quantas faltam, e como foi a semana.
 *
 * Conta só o que FOI AO AR (campanha publicada). Agendado aparece como previsto, mas não
 * pinta verde: se a publicação falhar — e já falhou, por token vencido — o placar estaria
 * mentindo justamente no dia em que ele precisava saber que faltou post.
 *
 * O dia é o dia de Brasília, não o do aparelho: postar 21h de SP não pode contar para o dia
 * seguinte porque o navegador está em outro fuso.
 */

/** Janelas em que o público brasileiro costuma estar no Instagram. É referência de mercado,
 *  não medição do público DELE — por isso a tela diz isso em voz alta. Quando houver
 *  engajamento por post, estes números devem sair dos dados da própria conta. */
const JANELAS = [
  { faixa: '7h – 9h', quando: 'começo do dia', nota: 'café da manhã, antes do trabalho' },
  { faixa: '11h – 13h', quando: 'almoço', nota: 'a pausa mais cheia do dia' },
  { faixa: '18h – 21h', quando: 'noite', nota: 'maior tempo de tela, melhor alcance' },
];

interface Dia {
  data: string; rotulo: string; diaDoMes: string;
  publicados: number; agendados: number;
  hoje: boolean; futuro: boolean;
}

/** Quantos dias a faixa mostra para trás e para frente de hoje. O futuro existe para ele
 *  programar a semana: sem ele, só dá para ver o buraco depois que já passou. */
const ATRAS = 6, ADIANTE = 7;

const diaEmSP = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });   // YYYY-MM-DD

export default function MetaDiaria({ brandId, marcaNome, meta }: {
  brandId: string | null; marcaNome?: string; meta: number;
}) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!brandId) return;
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - ATRAS);
    inicio.setHours(0, 0, 0, 0);

    // Busca pelo que importa: o que SAIU desde o início da faixa e o que está MARCADO daqui
    // para frente. Filtrar por `created_at` deixaria de fora um agendamento feito semanas
    // atrás para a semana que vem — justamente o que ele quer enxergar.
    const { data } = await supabase
      .from('studio_campaigns')
      .select('status, published_at, scheduled_at')
      .eq('brand_id', brandId)
      .in('status', ['published', 'scheduled'])
      .or(`published_at.gte.${inicio.toISOString()},scheduled_at.gte.${inicio.toISOString()}`);

    const porDia = new Map<string, { publicados: number; agendados: number }>();
    for (const c of (data ?? []) as { status: string; published_at: string | null; scheduled_at: string | null }[]) {
      if (c.status === 'published' && c.published_at) {
        const d = diaEmSP(c.published_at);
        porDia.set(d, { ...(porDia.get(d) ?? { publicados: 0, agendados: 0 }), publicados: (porDia.get(d)?.publicados ?? 0) + 1 });
      } else if (c.status === 'scheduled' && c.scheduled_at) {
        const d = diaEmSP(c.scheduled_at);
        porDia.set(d, { ...(porDia.get(d) ?? { publicados: 0, agendados: 0 }), agendados: (porDia.get(d)?.agendados ?? 0) + 1 });
      }
    }

    const hojeSP = diaEmSP(new Date().toISOString());
    const lista: Dia[] = [];
    for (let i = -ATRAS; i <= ADIANTE; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const chave = diaEmSP(d.toISOString());
      lista.push({
        data: chave,
        rotulo: d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short' }).replace('.', ''),
        diaDoMes: d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit' }),
        publicados: porDia.get(chave)?.publicados ?? 0,
        agendados: porDia.get(chave)?.agendados ?? 0,
        hoje: chave === hojeSP,
        futuro: chave > hojeSP,
      });
    }
    setDias(lista);
    setCarregando(false);
  }, [brandId]);

  useEffect(() => { carregar(); }, [carregar]);

  // O placar muda sozinho quando uma campanha é publicada, inclusive pelo agendador.
  useEffect(() => {
    if (!brandId) return;
    const ch = supabase.channel('studio-meta-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_campaigns' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [brandId, carregar]);

  // A faixa anda sozinha na virada do dia. Sem isto, uma aba deixada aberta durante a noite
  // continuaria marcando ontem como "hoje" — e o placar cobraria postagem de um dia que já
  // acabou. A virada é a de Brasília, não a do aparelho.
  useEffect(() => {
    const agora = new Date();
    const emSP = new Date(agora.toLocaleString('en-US', { timeZone: FUSO }));
    const amanha = new Date(emSP);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 30, 0);   // 30s depois da virada, para não cair no limite exato
    const t = setTimeout(carregar, amanha.getTime() - emSP.getTime());
    return () => clearTimeout(t);
  }, [carregar, dias]);

  if (!brandId || meta === 0 || carregando) return null;

  const hoje = dias.find(d => d.hoje);
  const feitos = hoje?.publicados ?? 0;
  const faltam = Math.max(0, meta - feitos);
  const cumpriu = feitos >= meta;
  const agendadosHoje = hoje?.agendados ?? 0;

  // Quantos dias seguidos, terminando ontem, bateram a meta. Hoje não entra: o dia ainda
  // está acontecendo e dizer "quebrou a sequência" às 9h da manhã seria injusto.
  const indiceHoje = dias.findIndex(d => d.hoje);
  let sequencia = 0;
  for (let i = indiceHoje - 1; i >= 0; i--) {
    if (dias[i].publicados >= meta) sequencia++;
    else break;
  }

  // O que já está marcado daqui para frente — o número que responde "a semana que vem está
  // de pé?" sem precisar abrir campanha por campanha.
  const futuros = dias.filter(d => d.futuro);
  const agendadosAdiante = futuros.reduce((s, d) => s + d.agendados, 0);
  const diasVazios = futuros.filter(d => d.agendados === 0).length;

  const agora = Number(new Date().toLocaleString('en-US', { timeZone: FUSO, hour: '2-digit', hour12: false }));
  const proxima = JANELAS.find(j => agora < Number(j.faixa.slice(0, 2)));

  return (
    <div className={`rounded-xl border p-4 ${cumpriu ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          {cumpriu
            ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            : <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />}
          <span className={`font-bold ${cumpriu ? 'text-green-800' : 'text-amber-900'}`}>
            {feitos} de {meta} {feitos === 1 ? 'postagem' : 'postagens'} hoje
          </span>
          <span className={`text-sm ${cumpriu ? 'text-green-700' : 'text-amber-800'}`}>
            {cumpriu
              ? '· meta cumprida'
              : `· falta${faltam > 1 ? 'm' : ''} ${faltam}${agendadosHoje ? ` (${agendadosHoje} agendada${agendadosHoje > 1 ? 's' : ''} para hoje)` : ''}`}
          </span>
        </div>

        {/* bolinhas da meta: enche uma por post que foi ao ar */}
        <div className="flex items-center gap-1">
          {Array.from({ length: meta }).map((_, i) => (
            <span key={i} aria-hidden="true"
              className={`w-3 h-3 rounded-full ${i < feitos ? 'bg-green-600' : 'bg-white border border-amber-300'}`} />
          ))}
        </div>

        {sequencia >= 2 && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B2214]">
            <Flame className="w-4 h-4" /> {sequencia} dias seguidos na meta
          </span>
        )}
      </div>

      {/* Duas semanas: o que já saiu e o que está marcado. O passado conta postagem feita;
          o futuro mostra o que está agendado, com contorno tracejado — para ele ver o dia
          vazio ANTES de ele passar, que é quando ainda dá para programar. */}
      <div className="mt-3 -mx-1 flex items-end gap-1.5 overflow-x-auto px-1 pb-1">
        {dias.map(d => {
          const bateu = d.publicados >= meta;
          const parcial = d.publicados > 0 && !bateu;
          const marcados = d.agendados;
          const dataCurta = d.data.split('-').reverse().slice(0, 2).join('/');
          return (
            <div key={d.data} className="flex flex-col items-center gap-1 flex-shrink-0"
              title={d.futuro
                ? `${marcados} agendada(s) para ${dataCurta} — meta ${meta}`
                : `${d.publicados} de ${meta} em ${dataCurta}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                d.futuro
                  ? marcados >= meta ? 'border-2 border-dashed border-green-500 text-green-700 bg-white'
                  : marcados > 0 ? 'border-2 border-dashed border-[#8B2214] text-[#8B2214] bg-white'
                  : 'border-2 border-dashed border-gray-300 text-gray-300 bg-white'
                : bateu ? 'bg-green-600 text-white'
                : parcial ? 'bg-amber-200 text-amber-900'
                : 'bg-white border border-gray-200 text-gray-400'
              } ${d.hoje ? 'ring-2 ring-offset-1 ring-[#8B2214]' : ''}`}>
                {d.futuro ? (marcados || '–') : d.publicados}
              </div>
              <span className={`text-[10px] leading-none ${d.hoje ? 'font-bold text-[#8B2214]' : 'text-gray-500'}`}>{d.rotulo}</span>
              <span className="text-[9px] leading-none text-gray-400">{d.diaDoMes}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
          <CalendarDays className="w-3.5 h-3.5" />
          {proxima ? `Próxima boa janela: ${proxima.faixa}` : 'Janelas de hoje já passaram'}
        </span>
        <span>
          {JANELAS.map(j => j.faixa).join(' · ')}
          <span className="text-gray-400"> — referência de mercado, não do seu público ainda</span>
        </span>
      </div>

      {/* Resumo do que vem: responde "a semana que vem está de pé?" sem abrir campanha
          por campanha. O tracejado mostra o dia; esta linha mostra o tamanho do buraco. */}
      <p className="mt-1.5 text-xs text-gray-600">
        <span className="font-semibold">Próximos {ADIANTE} dias:</span>{' '}
        {agendadosAdiante === 0
          ? 'nada agendado ainda — dá para programar agora.'
          : `${agendadosAdiante} ${agendadosAdiante === 1 ? 'postagem agendada' : 'postagens agendadas'}` +
            (diasVazios ? ` · ${diasVazios} ${diasVazios === 1 ? 'dia sem nada' : 'dias sem nada'}` : ' · todos os dias com postagem')}
      </p>

      {marcaNome && !cumpriu && (
        <p className="mt-2 text-xs text-amber-800">
          {feitos === 0
            ? `Nenhuma postagem de ${marcaNome} hoje.`
            : `${marcaNome} já postou hoje, mas ainda não fechou o dia.`}
        </p>
      )}
    </div>
  );
}
