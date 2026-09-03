// PROTÓTIPO — Hero Experience Saporino (rota /experiencia). Teste visual controlado.
// NÃO é a home. Não toca checkout/auth/RepCo/estoque/DB. Só opacity/transform (sem lib nova).
// Scroll sticky ~580vh, 4 etapas: HERO 1 (origem ampla) → HERO 2 (entre fileiras) → HERO 3 (frutos)
// → HERO 4 = VÍDEO (fruto → xícara → experiência). O vídeo NÃO é scrubbado pelo scroll: o scroll
// só controla o crossfade; o vídeo toca no tempo real dele assim que a 4ª etapa começa a surgir.
import { useEffect, useRef } from 'react';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function nav(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Copy aprovada, redistribuída em 4 cenas: a cena 3 vira transição ("Da origem à xícara.") e a
// mensagem final + CTA fecham sobre o vídeo (último frame calmo). Slogan aprovado no fechamento.
const SCENES = [
  { eyebrow: 'CERRADO MINEIRO · MINAS GERAIS', head: ['O verdadeiro', 'sabor de Minas.'], reg: true, text: 'Cafés ligados ao Cerrado Mineiro, principalmente à região de Patrocínio, feitos para transformar o café do dia em um momento especial.', cta: false },
  { eyebrow: '', head: ['Do Cerrado', 'para perto.'], text: 'A origem faz parte de cada café Saporino.', cta: false },
  { eyebrow: '', head: ['Da origem', 'à xícara.'], text: 'Uma marca feita para quem valoriza café, origem e sabor.', cta: false },
  { eyebrow: '', head: ['O verdadeiro', 'sabor de Minas.'], reg: true, text: '', cta: true },
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
const X3V = [0.66, 0.80] as const;   // HERO 3 → VÍDEO
const PLAY_AT = 0.12;                // opacity do vídeo em que ele começa a tocar (já rodando quando dominar)
const PAUSE_BELOW = 0.10;            // ao voltar, pausa mantendo currentTime

export default function HeroExperiencePage() {
  const section = useRef<HTMLDivElement>(null);
  const layer = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const img = [useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null)];
  const video = useRef<HTMLVideoElement>(null);
  const scene = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const started = useRef(false);

  useEffect(() => {
    document.title = 'Experiência — Café Saporino';
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
      return;
    }

    const v = video.current;
    const safePlay = () => { v?.play().catch(() => { /* autoplay bloqueado: poster permanece */ }); };

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

      // Vídeo: toca no início do crossfade (uma vez); ao voltar pausa mantendo o tempo; retoma ao reentrar;
      // reinicia só quando o hero volta ao topo (p=0). Sem loop → congela no último frame.
      if (v) {
        if (p <= 0.001 && started.current) { v.pause(); v.currentTime = 0; started.current = false; }
        else if (!started.current && vop > PLAY_AT) { started.current = true; safePlay(); }
        else if (started.current) {
          if (vop < PAUSE_BELOW && !v.paused) v.pause();
          else if (vop >= PAUSE_BELOW && v.paused && !v.ended) safePlay();
        }
      }

      // Cenas de texto (uma por vez). A 4ª entra quando o vídeo assenta (sobre frames calmos/congelado).
      setScene(0, 1 - smooth(0.12, 0.20, p));
      setScene(1, smooth(0.24, 0.32, p) * (1 - smooth(0.44, 0.52, p)));
      setScene(2, smooth(0.50, 0.58, p) * (1 - smooth(0.68, 0.76, p)));
      setScene(3, smooth(0.86, 0.94, p));
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  return (
    <div className="bg-black text-white">
      <section ref={section} className="relative" style={{ height: '580vh' }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Camadas de imagem (HERO 1–3) */}
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
              muted playsInline preload="auto" disablePictureInPicture
              aria-hidden="true"
              className="w-full h-full object-cover [object-position:62%_50%] md:[object-position:50%_50%]"
            />
          </div>

          {/* Overlay: forte à esquerda → leve à direita, + base para legibilidade mobile */}
          <div className="absolute inset-0" aria-hidden="true"
            style={{ background: 'linear-gradient(90deg, rgba(10,5,3,.72) 0%, rgba(10,5,3,.34) 50%, rgba(10,5,3,.10) 100%)' }} />
          <div className="absolute inset-0 md:hidden" aria-hidden="true"
            style={{ background: 'linear-gradient(180deg, rgba(10,5,3,.10) 0%, rgba(10,5,3,.35) 55%, rgba(10,5,3,.72) 100%)' }} />

          {/* Texto (cenas empilhadas) */}
          <div className="absolute inset-0 flex items-center">
            <div className="relative w-full px-[6vw] md:px-[7vw]">
              {SCENES.map((s, i) => (
                <div key={i} ref={scene[i]} className="absolute left-[6vw] md:left-[7vw] right-[6vw] max-w-[750px]" style={{ opacity: i === 0 ? 1 : 0, transform: 'translate3d(0,0,0)' }}>
                  {s.eyebrow && <p className="text-[11px] md:text-xs font-semibold tracking-[0.22em] text-white/80">{s.eyebrow}</p>}
                  <h1 className="mt-4 font-black leading-[0.98] tracking-tight text-[clamp(46px,6vw,105px)]" style={{ textShadow: '0 2px 30px rgba(0,0,0,.35)' }}>
                    {s.head[0]}<br />
                    {s.reg && s.head[1].endsWith('.') ? s.head[1].slice(0, -1) : s.head[1]}
                    {s.reg && <sup className="relative align-baseline -top-[2.2em] ml-0 text-[0.20em] font-semibold text-white/70" aria-label="marca registrada">®</sup>}
                    {s.reg && s.head[1].endsWith('.') ? '.' : null}
                  </h1>
                  {s.text && <p className="mt-5 text-white/85 text-[clamp(16px,1.4vw,24px)] leading-relaxed max-w-[560px]">{s.text}</p>}
                  {s.cta && (
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button onClick={() => nav('/')} className="inline-flex items-center bg-white text-neutral-900 text-sm font-bold tracking-wide px-7 py-4 hover:bg-white/90 transition-colors">
                        CONHEÇA A SAPORINO
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
