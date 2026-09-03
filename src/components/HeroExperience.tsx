// HERO Saporino — experiência de scroll (3 fotos + vídeo). Componente REUTILIZÁVEL:
// usado na HOME (App.tsx) e na rota de teste /experiencia (HeroExperiencePage).
// Scroll sticky 580vh, 4 etapas: HERO 1 (origem ampla) → HERO 2 (entre fileiras) → HERO 3 (frutos)
// → HERO 4 = VÍDEO (fruto → xícara → experiência). O vídeo NÃO é scrubbado: o scroll só controla o
// crossfade; o vídeo toca no tempo real dele assim que a 4ª etapa começa a surgir.
// Só opacity/transform (sem lib de animação). Brief completo: docs/governanca/HERO_SAPORINO_REPLICATION_BRIEF.md
import { useEffect, useRef } from 'react';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Copy aprovada (não inventar). Eyebrow só na cena 1; ® no slogan registrado (cenas 1 e 4).
const SCENES = [
  { eyebrow: 'CERRADO MINEIRO · MINAS GERAIS', head: ['O verdadeiro', 'sabor de Minas.'], reg: true, text: 'Cafés ligados ao Cerrado Mineiro, principalmente à região de Patrocínio, feitos para transformar o café do dia em um momento especial.', cta: false },
  { eyebrow: '', head: ['Do Cerrado', 'para perto.'], reg: false, text: 'A origem faz parte de cada café Saporino.', cta: false },
  { eyebrow: '', head: ['Da origem', 'à xícara.'], reg: false, text: 'Uma marca feita para quem valoriza café, origem e sabor.', cta: false },
  { eyebrow: '', head: ['Seu momento', 'Saporino.'], reg: false, text: '', cta: true },
];

const SRC = ['/experiencia/hero-1-saporino.jpg', '/experiencia/hero-2-saporino.jpg', '/experiencia/hero-3-saporino.jpg'];
const VIDEO = '/experiencia/hero-4-saporino.mp4';
const POSTER = '/experiencia/hero-4-poster.jpg';
const OBJ = [
  '[object-position:55%_50%] md:[object-position:50%_50%]',
  '[object-position:50%_50%] md:[object-position:50%_52%]',
  '[object-position:44%_50%] md:[object-position:48%_50%]',
];

// Timeline (p = 0→1 sobre 580vh)
const X12 = [0.16, 0.30] as const;   // HERO 1 → 2
const X23 = [0.42, 0.56] as const;   // HERO 2 → 3
const X3V = [0.64, 0.82] as const;   // HERO 3 → VÍDEO (janela mais larga = fusão mais suave)
const PLAY_AT = 0.06;                // opacity do vídeo em que ele começa a tocar (já em movimento ao aparecer)
const PAUSE_BELOW = 0.10;            // ao voltar, pausa mantendo currentTime
const PRIME_AT = 0.40;               // p em que o vídeo passa a baixar de verdade (protege o LCP da home)

interface Props {
  /** Ação do botão final "CONHEÇA A SAPORINO" (home: rolar até a loja; /experiencia: ir para a home). */
  onCta: () => void;
  /** Home: fade para branco no fim do hero, para o site "abrir" suave sobre a próxima seção clara. */
  fadeToWhite?: boolean;
  /** Avisa quando o hero está (ou deixa de estar) ocupando a tela — a HOME usa para esconder o header. Dispara só na troca. */
  onHeroActive?: (active: boolean) => void;
}

export default function HeroExperience({ onCta, fadeToWhite = false, onHeroActive }: Props) {
  const section = useRef<HTMLDivElement>(null);
  const layer = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const img = [useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null)];
  const video = useRef<HTMLVideoElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const scene = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const started = useRef(false);
  const primed = useRef(false);
  const lastActive = useRef<boolean | null>(null);
  const onActiveRef = useRef(onHeroActive); onActiveRef.current = onHeroActive; // ref: não re-assina o scroll a cada render

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setScene = (i: number, op: number) => {
      const el = scene[i].current; if (!el) return;
      el.style.opacity = String(op);
      el.style.transform = `translate3d(0, ${(1 - op) * 18}px, 0)`;
      el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
    };
    const setOp = (i: number, op: number) => { const el = layer[i].current; if (el) el.style.opacity = String(op); };

    if (reduce) {
      // Estático e legível: HERO 1 + mensagem final/CTA. Vídeo não toca (poster fica de fallback).
      setOp(1, 0); setOp(2, 0); setOp(3, 0);
      setScene(0, 0); setScene(1, 0); setScene(2, 0); setScene(3, 1);
      if (fade.current) fade.current.style.opacity = fadeToWhite ? '1' : '0';
      onActiveRef.current?.(false); // reduced-motion: header sempre visível (acessibilidade)
      return;
    }

    const v = video.current;
    // Se o play() for rejeitado (ex.: dados ainda não carregados no instante do prime, ou política
    // de autoplay), retenta UMA vez quando o vídeo puder tocar. Se ainda assim falhar, o poster fica.
    const safePlay = () => {
      v?.play().catch(() => {
        if (!v) return;
        const retry = () => { v.removeEventListener('canplay', retry); v.play().catch(() => { /* poster permanece */ }); };
        v.addEventListener('canplay', retry, { once: true });
      });
    };

    let raf = 0;
    const update = () => {
      const el = section.current; if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = clamp01(-el.getBoundingClientRect().top / Math.max(1, total));

      // Crossfade por empilhamento (cada camada superior surge sobre a de baixo).
      setOp(1, smooth(X12[0], X12[1], p));
      setOp(2, smooth(X23[0], X23[1], p));
      const vop = smooth(X3V[0], X3V[1], p);
      setOp(3, vop);

      // Movimento (scale) independente da opacidade.
      if (img[0].current) img[0].current.style.transform = `translate3d(0,0,0) scale(${(1.00 + 0.07 * smooth(0.00, X12[1], p)).toFixed(4)})`;
      if (img[1].current) img[1].current.style.transform = `translate3d(0,0,0) scale(${(1.08 - 0.08 * smooth(X12[0], X23[1], p)).toFixed(4)})`;
      if (img[2].current) img[2].current.style.transform = `translate3d(0,0,0) scale(${(1.06 - 0.04 * smooth(X23[0], X3V[1], p)).toFixed(4)})`;
      // Vídeo entra levemente "aproximando" (1.04 → 1.00): continuidade de movimento com a HERO 3, não um corte.
      if (v) v.style.transform = `translate3d(0,0,0) scale(${(1.04 - 0.04 * smooth(X3V[0], 1.00, p)).toFixed(4)})`;

      // Vídeo: só começa a baixar de verdade quando o usuário se aproxima (LCP da home = HERO 1);
      // toca no início do crossfade (uma vez); ao voltar pausa mantendo o tempo; retoma ao reentrar;
      // reinicia só quando o hero volta ao topo (p=0). Sem loop → congela no último frame.
      if (v) {
        if (!primed.current && p > PRIME_AT) { primed.current = true; v.preload = 'auto'; }
        if (p <= 0.001 && started.current) { v.pause(); v.currentTime = 0; started.current = false; }
        else if (!started.current && vop > PLAY_AT) { started.current = true; safePlay(); }
        else if (started.current) {
          if (vop < PAUSE_BELOW && !v.paused) v.pause();
          else if (vop >= PAUSE_BELOW && v.paused && !v.ended) safePlay();
        }
      }

      // Cenas de texto (uma por vez). A 4ª entra quando o vídeo assenta.
      setScene(0, 1 - smooth(0.12, 0.20, p));
      setScene(1, smooth(0.24, 0.32, p) * (1 - smooth(0.44, 0.52, p)));
      setScene(2, smooth(0.50, 0.58, p) * (1 - smooth(0.66, 0.74, p)));
      setScene(3, smooth(0.86, 0.94, p));

      // Fade para branco só no finalzinho (home), para "abrir" o site sobre a próxima seção.
      if (fade.current) fade.current.style.opacity = fadeToWhite ? String(smooth(0.90, 1.00, p)) : '0';

      // Hero "ativo" enquanto o palco sticky ocupa a tela (p < 1). Avisa só quando muda (sem re-render por frame).
      const active = p < 0.999;
      if (active !== lastActive.current) { lastActive.current = active; onActiveRef.current?.(active); }
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeToWhite]);

  const headClass = 'mt-4 font-black leading-[0.98] tracking-tight text-[clamp(46px,6vw,105px)]';
  // Overlay mais leve (só na faixa do texto) → sombra um pouco mais firme garante a leitura.
  const headStyle = { textShadow: '0 1px 2px rgba(0,0,0,.35), 0 2px 30px rgba(0,0,0,.45)' };
  const bodyStyle = { textShadow: '0 1px 2px rgba(0,0,0,.40)' };

  return (
    <section ref={section} className="relative bg-black text-white" style={{ height: '580vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Camadas de imagem (HERO 1–3). Todas eager: precisam estar prontas na hora do crossfade. */}
        {SRC.map((src, i) => (
          <div key={src} ref={layer[i]} className="absolute inset-0 will-change-[opacity]" style={{ opacity: i === 0 ? 1 : 0 }}>
            <img
              ref={img[i]} src={src} alt="" aria-hidden="true"
              loading="eager" decoding="async"
              className={`w-full h-full object-cover will-change-transform ${OBJ[i]}`}
              style={{ transform: 'translate3d(0,0,0)' }}
            />
          </div>
        ))}

        {/* HERO 4 — VÍDEO (fruto → xícara). Autoplay muted/playsInline, poster = último frame, sem loop. */}
        <div ref={layer[3]} className="absolute inset-0 will-change-[opacity]" style={{ opacity: 0 }}>
          <video
            ref={video} src={VIDEO} poster={POSTER}
            muted playsInline preload="metadata" disablePictureInPicture
            aria-hidden="true"
            className="w-full h-full object-cover [object-position:62%_50%] md:[object-position:50%_50%]"
          />
        </div>

        {/* Overlay: forte à esquerda → leve à direita, + base para legibilidade mobile */}
        <div className="absolute inset-0" aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, rgba(10,5,3,.55) 0%, rgba(10,5,3,.22) 38%, rgba(10,5,3,0) 62%)' }} />
        <div className="absolute inset-0 md:hidden" aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgba(10,5,3,.10) 0%, rgba(10,5,3,.35) 55%, rgba(10,5,3,.72) 100%)' }} />

        {/* Texto (cenas empilhadas). Só a cena 1 é <h1> (H1 único na home); as outras têm o mesmo visual. */}
        <div className="absolute inset-0 flex items-center">
          <div className="relative w-full px-[6vw] md:px-[7vw]">
            {SCENES.map((s, i) => {
              const Head: 'h1' | 'p' = i === 0 ? 'h1' : 'p';
              return (
                <div key={i} ref={scene[i]} className="absolute left-[6vw] md:left-[7vw] right-[6vw] max-w-[750px]" style={{ opacity: i === 0 ? 1 : 0, transform: 'translate3d(0,0,0)' }}>
                  {s.eyebrow && <p className="text-[11px] md:text-xs font-semibold tracking-[0.22em] text-white/80">{s.eyebrow}</p>}
                  <Head className={headClass} style={headStyle}>
                    {s.head[0]}<br />
                    {s.reg && s.head[1].endsWith('.') ? s.head[1].slice(0, -1) : s.head[1]}
                    {s.reg && <sup className="relative align-baseline -top-[2.2em] ml-0 text-[0.20em] font-semibold text-white/70" aria-label="marca registrada">®</sup>}
                    {s.reg && s.head[1].endsWith('.') ? '.' : null}
                  </Head>
                  {s.text && <p className="mt-5 text-white/85 text-[clamp(16px,1.4vw,24px)] leading-relaxed max-w-[560px]" style={bodyStyle}>{s.text}</p>}
                  {s.cta && (
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button onClick={onCta} className="inline-flex items-center bg-white text-neutral-900 text-sm font-bold tracking-wide px-7 py-4 hover:bg-white/90 transition-colors">
                        CONHEÇA A SAPORINO
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fade para branco (home): aparece só quando o vídeo assenta, para a próxima seção clara "abrir". */}
        <div ref={fade} aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-36 md:h-44 pointer-events-none bg-gradient-to-t from-white via-white/70 to-transparent"
          style={{ opacity: 0 }} />
      </div>
    </section>
  );
}
