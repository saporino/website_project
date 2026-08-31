// PROTÓTIPO — Hero Experience Saporino (rota /experiencia). Teste visual controlado.
// NÃO é a home. Não toca checkout/auth/RepCo/estoque/DB. Só opacity/transform (sem lib nova).
// Scroll sticky ~450vh: HERO 1 (origem ampla) → HERO 2 (entre fileiras) → HERO 3 (frutos).
import { useEffect, useRef } from 'react';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function nav(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const SCENES = [
  { eyebrow: 'CERRADO MINEIRO · MINAS GERAIS', head: ['O verdadeiro', 'sabor de Minas.'], text: 'Cafés ligados ao Cerrado Mineiro, principalmente à região de Patrocínio, feitos para transformar o café do dia em um momento especial.' },
  { eyebrow: 'ORIGEM QUE SE RECONHECE', head: ['Do Cerrado', 'para perto.'], text: 'A origem faz parte de cada café Saporino.' },
  { eyebrow: 'CAFÉ EM PRIMEIRO PLANO', head: ['Da origem', 'à xícara.'], text: 'Uma marca feita para quem valoriza café, origem e sabor.' },
];

export default function HeroExperiencePage() {
  const section = useRef<HTMLDivElement>(null);
  const layer = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const img = [useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null), useRef<HTMLImageElement>(null)];
  const scene = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    document.title = 'Experiência — Café Saporino';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setScene = (i: number, op: number) => {
      const el = scene[i].current; if (!el) return;
      el.style.opacity = String(op);
      el.style.transform = `translate3d(0, ${(1 - op) * 18}px, 0)`;
      el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
    };

    if (reduce) {
      // Versão estática legível: HERO 1 + copy da cena 3 (com CTA). Sem animação de scroll.
      if (layer[1].current) layer[1].current.style.opacity = '0';
      if (layer[2].current) layer[2].current.style.opacity = '0';
      setScene(0, 0); setScene(1, 0); setScene(2, 1);
      return;
    }

    let raf = 0;
    const update = () => {
      const el = section.current; if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = clamp01(-el.getBoundingClientRect().top / Math.max(1, total));

      // Crossfade por empilhamento: cada camada superior surge sobre a de baixo.
      if (layer[1].current) layer[1].current.style.opacity = String(smooth(0.20, 0.40, p));
      if (layer[2].current) layer[2].current.style.opacity = String(smooth(0.56, 0.76, p));

      // Movimento (scale) independente da opacidade.
      if (img[0].current) img[0].current.style.transform = `translate3d(0,0,0) scale(${(1.00 + 0.07 * smooth(0.00, 0.40, p)).toFixed(4)})`;
      if (img[1].current) img[1].current.style.transform = `translate3d(0,0,0) scale(${(1.08 - 0.08 * smooth(0.20, 0.76, p)).toFixed(4)})`;
      if (img[2].current) img[2].current.style.transform = `translate3d(0,0,0) scale(${(1.06 - 0.04 * smooth(0.56, 1.00, p)).toFixed(4)})`;

      // Cenas de texto (uma por vez).
      setScene(0, 1 - smooth(0.16, 0.26, p));
      setScene(1, smooth(0.30, 0.40, p) * (1 - smooth(0.60, 0.70, p)));
      setScene(2, smooth(0.72, 0.82, p));
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  const OBJ = [
    '[object-position:55%_50%] md:[object-position:50%_50%]',
    '[object-position:50%_50%] md:[object-position:50%_52%]',
    '[object-position:44%_50%] md:[object-position:48%_50%]',
  ];
  const SRC = ['/experiencia/hero-1-saporino.jpg', '/experiencia/hero-2-saporino.jpg', '/experiencia/hero-3-saporino.jpg'];

  return (
    <div className="bg-black text-white">
      {/* marca (topo) */}
      <div className="fixed top-0 left-0 z-30 px-[6vw] py-6">
        <button onClick={() => nav('/')} className="font-semibold tracking-wide text-white/90 hover:text-white transition-colors" aria-label="Café Saporino — início">
          Café <span className="font-black">Saporino</span>
        </button>
      </div>

      <section ref={section} className="relative" style={{ height: '450vh' }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Camadas de imagem */}
          {SRC.map((src, i) => (
            <div key={src} ref={layer[i]} className="absolute inset-0 will-change-[opacity]" style={{ opacity: i === 0 ? 1 : 0 }}>
              <img
                ref={img[i]} src={src} alt="" aria-hidden="true"
                loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                className={`w-full h-full object-cover will-change-transform ${OBJ[i]}`}
                style={{ transform: 'translate3d(0,0,0)' }}
              />
            </div>
          ))}

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
                  <p className="text-[11px] md:text-xs font-semibold tracking-[0.22em] text-white/80">{s.eyebrow}</p>
                  <h1 className="mt-4 font-black leading-[0.98] tracking-tight text-[clamp(46px,6vw,105px)]" style={{ textShadow: '0 2px 30px rgba(0,0,0,.35)' }}>
                    {s.head[0]}<br />{s.head[1]}
                  </h1>
                  <p className="mt-5 text-white/85 text-[clamp(16px,1.4vw,24px)] leading-relaxed max-w-[560px]">{s.text}</p>
                  {i === 2 && (
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button onClick={() => nav('/')} className="inline-flex items-center bg-white text-neutral-900 text-sm font-bold tracking-wide px-7 py-4 hover:bg-white/90 transition-colors">
                        CONHEÇA NOSSOS CAFÉS
                      </button>
                      <button onClick={() => nav('/nossa-historia')} className="inline-flex items-center border border-white/50 text-white text-sm font-semibold tracking-wide px-7 py-4 hover:border-white transition-colors">
                        CONHEÇA A SAPORINO
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* dica de scroll */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-[11px] tracking-[0.25em] animate-pulse" aria-hidden="true">ROLE PARA EXPLORAR</div>
        </div>
      </section>
    </div>
  );
}
