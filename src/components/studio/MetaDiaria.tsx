import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Flame, CalendarDays, CalendarClock } from 'lucide-react';
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
const REDE: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', ecommerce: 'Loja',
};

const JANELAS = [
  { faixa: '7h – 9h', quando: 'começo do dia', nota: 'café da manhã, antes do trabalho' },
  { faixa: '11h – 13h', quando: 'almoço', nota: 'a pausa mais cheia do dia' },
  { faixa: '18h – 21h', quando: 'noite', nota: 'maior tempo de tela, melhor alcance' },
];

/** Uma postagem daquele dia — responde "a que horas sai?" e "qual arte foi?". */
interface Post {
  id: string; titulo: string; rede: string; hora: string;
  publicado: boolean; link: string | null;
  /** Miniatura da arte publicada. O bucket é privado, então é link assinado de 1h. */
  arte: string | null;
}

interface Dia {
  data: string; rotulo: string; diaDoMes: string; porExtenso: string;
  publicados: number; agendados: number; posts: Post[];
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
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

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
      .select('id, title, platform, status, published_at, scheduled_at, external_url, media_path')
      .eq('brand_id', brandId)
      .in('status', ['published', 'scheduled'])
      .or(`published_at.gte.${inicio.toISOString()},scheduled_at.gte.${inicio.toISOString()}`);

    // Miniatura da arte: o bucket é privado, então vem por link assinado. Num lote só,
    // para não disparar uma assinatura por postagem.
    const caminhos = [...new Set((data ?? []).map((c: any) => c.media_path).filter(Boolean))] as string[];
    const arteDe = new Map<string, string>();
    if (caminhos.length) {
      const { data: assinadas } = await supabase.storage.from('studio-videos').createSignedUrls(caminhos, 3600);
      for (const a of assinadas ?? []) if (a.path && a.signedUrl) arteDe.set(a.path, a.signedUrl);
    }

    const porDia = new Map<string, { publicados: number; agendados: number; posts: Post[] }>();
    const guardar = (chave: string, campo: 'publicados' | 'agendados', post: Post) => {
      const atual = porDia.get(chave) ?? { publicados: 0, agendados: 0, posts: [] };
      porDia.set(chave, { ...atual, [campo]: atual[campo] + 1, posts: [...atual.posts, post] });
    };
    for (const c of (data ?? []) as any[]) {
      const quando = c.status === 'published' ? c.published_at : c.scheduled_at;
      if (!quando) continue;
      guardar(diaEmSP(quando), c.status === 'published' ? 'publicados' : 'agendados', {
        id: c.id, titulo: c.title, rede: c.platform, publicado: c.status === 'published',
        hora: new Date(quando).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }),
        link: c.external_url ?? null,
        arte: c.media_path ? arteDe.get(c.media_path) ?? null : null,
      });
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
        porExtenso: d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' }),
        publicados: porDia.get(chave)?.publicados ?? 0,
        agendados: porDia.get(chave)?.agendados ?? 0,
        posts: [...(porDia.get(chave)?.posts ?? [])].sort((a, b) => a.hora.localeCompare(b.hora)),
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
    // Nome único por marca: com nome fixo, trocar de marca criava um canal novo enquanto o
    // antigo ainda fechava, e a inscrição falhava em silêncio — o placar parava de se
    // atualizar sozinho de vez em quando, sem erro nenhum na tela.
    const ch = supabase.channel(`studio-meta-rt-${brandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_campaigns' }, () => carregar())
      .subscribe();
    // Rede de segurança: o aviso do banco pode se perder (conexão oscilando, aba em segundo
    // plano). Sem isto, o placar ficava parado sem nenhum sinal de que estava desatualizado.
    // Com isto, o pior caso é um minuto de atraso em vez de "até alguém dar F5".
    const relogio = setInterval(carregar, 60_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
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
  // O dia está COBERTO quando o que saiu mais o que está marcado fecha a meta. Não é o
  // mesmo que cumprida — o post ainda pode falhar —, mas quem já fez o trabalho não pode
  // ver âmbar de cobrança como se estivesse devendo.
  const coberto = !cumpriu && feitos + agendadosHoje >= meta;
  const proximoDeHoje = (hoje?.posts ?? []).filter(p => !p.publicado)[0];

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
  const aberto = dias.find(d => d.data === diaAberto);

  return (
    <div className={`rounded-xl border p-4 ${
      cumpriu ? 'border-green-200 bg-green-50'
      : coberto ? 'border-green-200 bg-green-50/60'
      : 'border-amber-200 bg-amber-50'
    }`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          {cumpriu ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            : coberto ? <CalendarClock className="w-5 h-5 text-green-600 flex-shrink-0" />
            : <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />}
          <span className={`font-bold ${cumpriu || coberto ? 'text-green-800' : 'text-amber-900'}`}>
            {feitos} de {meta} {feitos === 1 ? 'postagem' : 'postagens'} hoje
          </span>
          <span className={`text-sm ${cumpriu || coberto ? 'text-green-700' : 'text-amber-800'}`}>
            {cumpriu ? '· meta cumprida'
              : coberto
                ? `· o dia já está coberto${proximoDeHoje ? ` — a próxima sai às ${proximoDeHoje.hora}` : ''}`
                : `· falta${faltam > 1 ? 'm' : ''} ${faltam}${agendadosHoje ? ` (${agendadosHoje} agendada${agendadosHoje > 1 ? 's' : ''} para hoje)` : ''}`}
          </span>
        </div>

        {/* Bolinhas: cheia = foi ao ar; contorno tracejado = agendada para hoje, ainda não
            saiu. Assim dá para ver que o dia está resolvido sem afirmar que já aconteceu. */}
        <div className="flex items-center gap-1">
          {Array.from({ length: meta }).map((_, i) => (
            <span key={i} aria-hidden="true"
              className={`w-3 h-3 rounded-full ${
                i < feitos ? 'bg-green-600'
                : i < feitos + agendadosHoje ? 'border-2 border-dashed border-green-500 bg-white'
                : 'bg-white border border-amber-300'
              }`} />
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
            <button key={d.data} type="button"
              onClick={() => setDiaAberto(a => (a === d.data ? null : d.data))}
              aria-expanded={diaAberto === d.data}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              title={d.posts.length
                ? `${d.posts.map(p => p.hora).join(', ')} — clique para ver`
                : d.futuro ? `Nada agendado para ${dataCurta}` : `Nenhuma postagem em ${dataCurta}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 ${
                d.futuro
                  ? marcados >= meta ? 'border-2 border-dashed border-green-500 text-green-700 bg-white'
                  : marcados > 0 ? 'border-2 border-dashed border-[#8B2214] text-[#8B2214] bg-white'
                  : 'border-2 border-dashed border-gray-300 text-gray-300 bg-white'
                : bateu ? 'bg-green-600 text-white'
                : parcial ? 'bg-amber-200 text-amber-900'
                : 'bg-white border border-gray-200 text-gray-400'
              } ${d.hoje ? 'ring-2 ring-offset-1 ring-[#8B2214]' : ''} ${diaAberto === d.data ? 'ring-2 ring-offset-1 ring-gray-700' : ''}`}>
                {d.futuro ? (marcados || '–') : d.publicados}
              </div>
              <span className={`text-[10px] leading-none ${d.hoje ? 'font-bold text-[#8B2214]' : 'text-gray-500'}`}>{d.rotulo}</span>
              <span className="text-[9px] leading-none text-gray-400">{d.diaDoMes}</span>
            </button>
          );
        })}
      </div>

      {/* A que horas vai sair: o número do quadradinho diz quantas, esta lista diz quando.
          Clicar é o caminho que funciona no celular — tooltip só existe com mouse. */}
      {aberto && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-bold text-gray-700 capitalize">{aberto.porExtenso}</p>
          {aberto.posts.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              {aberto.futuro
                ? 'Nada agendado. Crie a campanha e preencha data e hora para ocupar este dia.'
                : 'Nenhuma postagem saiu neste dia.'}
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {aberto.posts.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  {/* A arte ao lado do horário: é assim que ele reconhece o que escolheu
                      para aquele momento, sem abrir o Instagram. Clicar abre inteira. */}
                  {p.arte ? (
                    <button type="button" onClick={() => window.open(p.arte!, '_blank')}
                      title="Ver a arte inteira"
                      className="w-10 h-10 rounded border border-gray-200 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-[#8B2214]">
                      <img src={p.arte} alt={`Arte de ${p.hora}`} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <span className="w-10 h-10 rounded border border-dashed border-gray-200 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-mono font-semibold text-gray-900">{p.hora}</span>
                    <span className={p.publicado ? 'text-green-700' : 'text-[#8B2214]'}>
                      {p.publicado ? 'publicado' : 'agendado'}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600">{REDE[p.rede] ?? p.rede}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-700 truncate max-w-[200px]">{p.titulo}</span>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer"
                        className="font-semibold text-[#8B2214] underline">ver post</a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      {marcaNome && !cumpriu && !coberto && (
        <p className="mt-2 text-xs text-amber-800">
          {feitos === 0 && agendadosHoje === 0
            ? `Nenhuma postagem de ${marcaNome} hoje, e nada agendado.`
            : `${marcaNome} ainda não fechou o dia.`}
        </p>
      )}
    </div>
  );
}
