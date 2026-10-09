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

interface Dia { data: string; rotulo: string; publicados: number; agendados: number; hoje: boolean }

const diaEmSP = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });   // YYYY-MM-DD

export default function MetaDiaria({ brandId, marcaNome, meta }: {
  brandId: string | null; marcaNome?: string; meta: number;
}) {
  const [dias, setDias] = useState<Dia[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!brandId) return;
    // Sete dias que terminam hoje — a semana que ele enxerga de relance.
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 6);
    inicio.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('studio_campaigns')
      .select('status, published_at, scheduled_at')
      .eq('brand_id', brandId)
      .gte('created_at', new Date(inicio.getTime() - 7 * 864e5).toISOString());

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
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const chave = diaEmSP(d.toISOString());
      lista.push({
        data: chave,
        rotulo: d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short' }).replace('.', ''),
        publicados: porDia.get(chave)?.publicados ?? 0,
        agendados: porDia.get(chave)?.agendados ?? 0,
        hoje: chave === hojeSP,
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

  if (!brandId || meta === 0 || carregando) return null;

  const hoje = dias.find(d => d.hoje);
  const feitos = hoje?.publicados ?? 0;
  const faltam = Math.max(0, meta - feitos);
  const cumpriu = feitos >= meta;
  const agendadosHoje = hoje?.agendados ?? 0;

  // Quantos dias seguidos, terminando ontem, bateram a meta. Hoje não entra: o dia ainda
  // está acontecendo e dizer "quebrou a sequência" às 9h da manhã seria injusto.
  let sequencia = 0;
  for (let i = dias.length - 2; i >= 0; i--) {
    if (dias[i].publicados >= meta) sequencia++;
    else break;
  }

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

      {/* a semana, para ver o buraco de relance */}
      <div className="mt-3 flex items-end gap-1.5">
        {dias.map(d => {
          const bateu = d.publicados >= meta;
          const parcial = d.publicados > 0 && !bateu;
          return (
            <div key={d.data} className="flex flex-col items-center gap-1" title={`${d.publicados} de ${meta} em ${d.data.split('-').reverse().slice(0, 2).join('/')}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                bateu ? 'bg-green-600 text-white'
                : parcial ? 'bg-amber-200 text-amber-900'
                : 'bg-white border border-gray-200 text-gray-400'
              } ${d.hoje ? 'ring-2 ring-offset-1 ring-[#8B2214]' : ''}`}>
                {d.publicados}
              </div>
              <span className={`text-[10px] ${d.hoje ? 'font-bold text-[#8B2214]' : 'text-gray-500'}`}>{d.rotulo}</span>
            </div>
          );
        })}

        <div className="ml-3 pl-3 border-l border-amber-200 text-xs text-gray-600">
          <div className="flex items-center gap-1 font-semibold text-gray-700">
            <CalendarDays className="w-3.5 h-3.5" />
            {proxima ? `Próxima boa janela: ${proxima.faixa}` : 'Janelas de hoje já passaram'}
          </div>
          <div className="mt-0.5">
            {JANELAS.map(j => j.faixa).join(' · ')}
            <span className="text-gray-400"> — referência de mercado, não do seu público ainda</span>
          </div>
        </div>
      </div>

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
