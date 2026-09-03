# HERO SAPORINO — Brief de Replicação (3 fotos + 1 vídeo, scroll cinematográfico)
**Objetivo:** permitir que outra pessoa/chat/stack replique o hero exatamente como está em `cafesaporino.com.br/experiencia`. Tudo abaixo são os **valores reais em produção** (extraídos do código), não sugestões.
**Stack de origem:** React + Tailwind, mas o brief é agnóstico — só precisa de HTML/CSS/JS puros. **Sem biblioteca de animação** (nada de GSAP/Framer/Lenis).

---

## 1. Conceito
Uma única seção "presa" na tela enquanto o usuário rola. O scroll vira um **progresso de 0 → 1** que faz **4 etapas** se fundirem, com a sensação de *"entrar no cafezal"* (não "slideshow"):

| Etapa | Asset | Sensação |
|---|---|---|
| HERO 1 | foto — Cerrado amplo | abertura / origem |
| HERO 2 | foto — corredor entre fileiras | imersão / dolly |
| HERO 3 | foto — frutos em primeiro plano | detalhe / contemplação |
| HERO 4 | **vídeo** — mulher tomando o café | experiência / fechamento + CTA |

Narrativa: **AMPLO → MÉDIO → DETALHE → XÍCARA/EXPERIÊNCIA**.

---

## 2. Assets (nomes em kebab-case, sem espaço/maiúscula)
| Arquivo | Spec |
|---|---|
| `hero-1-saporino.jpg` | 2048×1152 (16:9), JPG, ~660 KB — **aérea ao nascer do sol, céu azul** (versão de 03/09, substituiu a anterior mais escura) |
| `hero-2-saporino.jpg` | 2048×1152, JPG, ~700 KB — **corredor entre fileiras, terra vermelha, céu azul** |
| `hero-3-saporino.jpg` | 2048×1152, JPG, ~460 KB — **frutos em primeiro plano, céu azul ao fundo** |
| `hero-4-saporino.mp4` | **H.264 (yuv420p) + faststart**, 1280×720 (ideal 1920×1080), 23,976 fps, **10,9 s**, **SEM áudio e sem trilha de dados** (`-an -dn`), ~1,3 MB, **sem loop**. Cena **clara** (cozinha), começa com ela olhando para baixo (fusão calma) e **termina segurando a xícara, olhando para a câmera e sorrindo** — esse último frame é o poster e a cama do CTA (ver §10) |
| `hero-4-poster.jpg` | **último frame** do vídeo (JPG) — é o fallback e o que fica congelado no fim |

Encode de referência (ffmpeg): `ffmpeg -i in.mp4 -an -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart hero-4-saporino.mp4` · poster: `ffmpeg -sseof -0.1 -i hero-4-saporino.mp4 -frames:v 1 -q:v 2 hero-4-poster.jpg`.

---

## 3. Estrutura (HTML/CSS)
```
<section style="position:relative; height:580vh">          ← trilho do scroll
  <div style="position:sticky; top:0; height:100vh; overflow:hidden">   ← palco fixo
    [camada 0] <img HERO1>   opacity 1 (sempre)   ← fundo
    [camada 1] <img HERO2>   opacity 0 → 1
    [camada 2] <img HERO3>   opacity 0 → 1
    [camada 3] <video HERO4> opacity 0 → 1
    [overlay horizontal]  (sempre — só na faixa esquerda do texto)
    [overlay vertical]    (só mobile)
    [4 cenas de texto, empilhadas em position:absolute, uma visível por vez]
    [fade para branco no rodapé] (só na HOME; opacity 0 → 1 em p 0,90–1,00)
  </div>
</section>
```
- **O hero é uma ABERTURA (gate), não o topo de uma página.** Em `/` renderiza-se **só o hero** — sem header, sem nada abaixo — então o documento termina no fim do hero e **o scroll pára ali**. **Só o clique em "CONHEÇA A SAPORINO" sai da abertura** e mostra a home (com header e loja), rolando para o topo. Implementação: um estado `heroGate` no roteador; o CTA grava `sessionStorage['saporino-hero-seen']` e desliga o gate — na mesma sessão, voltar a `/` vai direto para a home (rever a abertura a cada clique no logo irrita); para mostrar sempre, ignore a flag. A URL continua `/`. Por isso o hero **não** tem wordmark nem menu: o header só existe na home. (Aviso: para crawlers, `/` é a abertura — H1 do slogan + botão; a vitrine fica atrás do clique.)
- Cada camada: `position:absolute; inset:0`. Imagem/vídeo: `width/height:100%; object-fit:cover`.
- Fundo da página atrás do hero: preto. Texto branco.
- **Crossfade por empilhamento:** a camada de cima **só surge** (fade-in) por cima da de baixo. Nunca é preciso fazer fade-out — quando a de cima chega a opacity 1, cobre a de baixo. Isso evita "buracos" no meio da transição.

---

## 4. Progresso de scroll (o coração)
```js
const clamp01 = x => Math.min(1, Math.max(0, x));
// suavização (smoothstep) — dá aceleração/desaceleração natural
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t*t*(3 - 2*t); };

function update() {
  const total = section.offsetHeight - window.innerHeight;             // 580vh − 100vh = 480vh de "trilho"
  const p = clamp01(-section.getBoundingClientRect().top / Math.max(1, total)); // 0 → 1
  ...
}
window.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
window.addEventListener('resize', onScroll);
update(); // estado inicial
```
- **Escreva os estilos direto nos elementos** (`el.style.opacity`, `el.style.transform`) dentro do `requestAnimationFrame`. Não re-renderize framework a cada frame.
- Use **somente** `opacity`, `transform: translate3d(...) scale(...)`. Nada de top/left/width animados.

---

## 5. Timeline (p = 0 → 1)
**Crossfades (opacity da camada que ENTRA):**
| Transição | Janela (p) |
|---|---|
| HERO 1 → 2 | `smooth(0.16, 0.30, p)` |
| HERO 2 → 3 | `smooth(0.42, 0.56, p)` |
| HERO 3 → VÍDEO | `smooth(0.64, 0.82, p)` — janela **mais larga** que as outras (18% do progresso) para a mudança de cena (lavoura → cozinha) ser suave |
| Vídeo dominante | 0.82 → 1.00 |

**Movimento (scale) — independente da opacidade:**
| Camada | Scale | Janela |
|---|---|---|
| HERO 1 | `1.00 → 1.07` (push-in) | `smooth(0.00, 0.30, p)` |
| HERO 2 | `1.08 → 1.00` (dolly, "entrando") | `smooth(0.16, 0.56, p)` |
| HERO 3 | `1.06 → 1.02` (quase parado) | `smooth(0.42, 0.82, p)` |
| Vídeo | `1.04 → 1.00` (entra "aproximando" — continuidade de movimento com a HERO 3, não um corte) | `smooth(0.64, 1.00, p)` |

Ex.: `img1.style.transform = \`translate3d(0,0,0) scale(${1.00 + 0.07*smooth(0,0.30,p)})\``.

**Cenas de texto (opacity; uma por vez):**
| Cena | Fórmula |
|---|---|
| 1 | `1 − smooth(0.12, 0.20, p)` |
| 2 | `smooth(0.24, 0.32, p) × (1 − smooth(0.44, 0.52, p))` |
| 3 | `smooth(0.50, 0.58, p) × (1 − smooth(0.66, 0.74, p))` (sai junto com o início da fusão para o vídeo) |
| 4 | `smooth(0.86, 0.94, p)` (entra quando o vídeo já assentou) |
Cada cena: `opacity = op`; `transform = translate3d(0, (1−op)*18px, 0)` (sobe 18px ao aparecer); `pointer-events = op > 0.5 ? auto : none`.

---

## 6. Enquadramento (object-position) — mobile / desktop
| Camada | Mobile | Desktop (≥768px) |
|---|---|---|
| HERO 1 | `55% 50%` | `50% 50%` |
| HERO 2 | `50% 50%` | `50% 52%` |
| HERO 3 | `44% 50%` | `48% 50%` |
| Vídeo | `62% 50%` | `50% 50%` |
Regra: preservar o objeto principal (corredor central na 2, frutos na 3, a mulher/xícara no vídeo) quando o crop vertical do mobile corta as laterais.

---

## 7. Overlays (legibilidade sem matar a foto)
- **Horizontal (sempre) — só na faixa do texto:** `linear-gradient(90deg, rgba(10,5,3,.55) 0%, rgba(10,5,3,.22) 38%, rgba(10,5,3,0) 62%)`. Escurece **apenas** a esquerda (onde está o texto) e chega a **zero antes do meio** — céu e metade direita ficam limpos e vibrantes. ⚠️ A versão anterior (`.72 → .34 → .10` na tela toda) "apagava" céu e verde — foi a causa do hero parecer escuro.
- **Vertical (só mobile):** `linear-gradient(180deg, rgba(10,5,3,.10) 0%, rgba(10,5,3,.35) 55%, rgba(10,5,3,.72) 100%)` — reforça a base onde o texto cai no celular.

---

## 8. Tipografia e layout do texto
- Bloco de texto **à esquerda**, verticalmente **centralizado**; `left: 6vw` (mobile) / `7vw` (desktop); `max-width: 750px`.
- **Eyebrow** (só na cena 1): 11–12px, peso 600, `letter-spacing: 0.22em`, branco 80%.
- **Headline:** `font-size: clamp(46px, 6vw, 105px)`, peso 900, `line-height: 0.98`, `letter-spacing` levemente negativo, `text-shadow: 0 1px 2px rgba(0,0,0,.35), 0 2px 30px rgba(0,0,0,.45)` (curta + difusa — com o overlay mais leve, a sombra garante a leitura). Quebra em **2 linhas** fixas (`<br>`). **Só a cena 1 é `<h1>`** (H1 único da página); as cenas 2–4 usam `<p>` com o mesmo visual.
- **Texto:** `clamp(16px, 1.4vw, 24px)`, branco 85%, `line-height` relaxado, `max-width: 560px`, margem-topo 20px, `text-shadow: 0 1px 2px rgba(0,0,0,.40)`.
- **CTA:** 1 botão **branco**, texto escuro, caixa alta, peso 700, `padding 16px 28px`, cantos retos.
- **Aria:** imagens/vídeo `aria-hidden` (decorativos); o conteúdo é o texto HTML real (nunca queimado na imagem).

### ® (marca registrada no slogan)
O slogan **"O verdadeiro sabor de Minas."** é registrado → leva **®** nas cenas 1 e 4, **discreto**:
- `<sup>` com `font-size: 0.20em` (do título), `opacity 0.70`, peso 600, **`margin-left: 0`** (encostado no "s").
- Posição: `position: relative; vertical-align: baseline; top: −2.2em` (em unidades do próprio ®) → fica **no canto superior do "s" minúsculo**.
- Vai **antes do ponto**: "sabor de Minas**®**." (o ponto vem depois).
- ⚠️ **Não usar `vertical-align: top`** — alinha ao topo da *caixa da linha* e joga o símbolo longe da letra (erro que já cometemos).

---

## 9. Copy (aprovada — não inventar)
| Cena | Eyebrow | Headline (2 linhas) | Texto | CTA |
|---|---|---|---|---|
| 1 | CERRADO MINEIRO · MINAS GERAIS | O verdadeiro / sabor de Minas®. | Cafés ligados ao Cerrado Mineiro, principalmente à região de Patrocínio, feitos para transformar o café do dia em um momento especial. | — |
| 2 | — | Do Cerrado / para perto. | A origem faz parte de cada café Saporino. | — |
| 3 | — | Da origem / à xícara. | Uma marca feita para quem valoriza café, origem e sabor. | — |
| 4 (vídeo) | — | Seu momento / Saporino. *(sem ®; não repete o slogan que já abre o hero)* | — | **CONHEÇA A SAPORINO** (branco) — **sai da abertura e entra na home** (na rota de teste `/experiencia`, vai para `/`) |
Regras de marca: sem preço/SKU/torra/altitude/certificação; **não** dizer "nossa torrefação/fábrica" (Saporino é distribuidora da própria marca); slogan e origem (Cerrado Mineiro / Patrocínio-MG) como acima.

---

## 10. Vídeo (HERO 4) — comportamento exato
```html
<video src="hero-4-saporino.mp4" poster="hero-4-poster.jpg"
       muted playsinline preload="metadata" disablepictureinpicture aria-hidden="true">
```
- **`preload="metadata"`** no carregamento (protege o LCP da home — só a HERO 1 pesa no início); quando **p > 0,40** troque para `video.preload = 'auto'` (uma vez) — o vídeo baixa enquanto o usuário ainda está nas fotos.
- **NÃO scrubbar** o vídeo pelo scroll (mexer em `currentTime` treme e pesa). O scroll controla **só a opacidade** do crossfade; o vídeo toca **no tempo real dele**.
- **Retry:** se `play()` for rejeitado (dados ainda não carregados no instante, ou política de autoplay), **retentar uma vez no evento `canplay`**; se ainda falhar, fica o poster.
- **Começa a tocar** UMA vez, quando a opacity do vídeo passa de **0,06** (bem no início do crossfade) → quando ele fica visível já está em movimento (sem "corte seco"), e entra com **scale 1,04 → 1,00** (§5). Guardar uma flag `started`.
- **Voltar o scroll:** se a opacity cair abaixo de **0,10** → `pause()` **mantendo `currentTime`**; ao reentrar → `play()` de onde parou (se não terminou).
- **Topo (p ≈ 0):** `pause(); currentTime = 0; started = false` → nova descida replica do início.
- **Sem loop** → ao terminar **congela no último frame** (que é igual ao poster). A cena 4 (slogan + CTA) entra sobre esse frame calmo (p 0,86–0,94).
- `play()` sempre com `.catch(() => {})` — se o autoplay for bloqueado, o **poster** fica no lugar.
- **Escolha do clipe (lição):** use um vídeo que **já abre na mulher/xícara**. Um clipe que abre nos frutos e dissolve internamente para a mulher **soma dois dissolves** (o dele + o do scroll) e vira dupla exposição embaçada.

---

## 11. Acessibilidade / reduced-motion
`@media (prefers-reduced-motion: reduce)` (ou `matchMedia` no JS): **não animar** — mostrar HERO 1 estático + a cena 4 (slogan + CTA); vídeo não toca (poster). Sair do handler de scroll cedo.

---

## 12. Performance (regras que valeram)
- HERO 1 = LCP: `loading="eager"` (prioridade). **HERO 2 e 3 também `eager`** + `decoding="async"` — com `lazy` elas não estão prontas na hora do crossfade (bug real que tivemos).
- Handler de scroll com `requestAnimationFrame` (1 update por frame), `passive: true`.
- Só `opacity`/`transform` (compositor). `will-change: opacity` nas camadas, `will-change: transform` nas imagens.
- **Sem filtros de cor.** As fotos já nascem vibrantes (céu azul, verde vivo). `saturate`/`contrast` foram testados e **descartados**: filtro não substitui foto boa e cansa o olho.
- **Fade para branco (`fadeToWhite`):** o componente suporta uma camada no rodapé do palco (gradiente para branco, opacity `smooth(0.90, 1.00, p)`) para quando houver uma seção clara logo abaixo. **Na abertura (gate) fica desligada** — não há nada abaixo do hero.
- Sem canvas, sem libs.

---

## 13. Mobile
- Mesma lógica; movimento já é suave. Overlay vertical extra (§7). `object-position` por camada (§6).
- Headline mínima 46px (2 linhas cabem); CTA dentro do viewport no fim; **zero overflow horizontal** (testar `scrollWidth === innerWidth`).

---

## 14. Checklist de validação (o que testamos)
1. p=0: HERO 1 + cena 1 · 2. p≈0.23: crossfade 1→2 ~50% · 3. p≈0.49: 2→3 ~50% · 4. p≈0.73: 3→vídeo ~50% e vídeo **tocando** · 5. p≈0.95: cena 4 + CTA sobre frame calmo · 6. voltar p→0.5: vídeo **pausado com tempo mantido** · 7. p→0: vídeo **resetado** · 8. mobile 375×812: sem overflow, CTA visível · 9. console sem erros · 10. network: 3 fotos 200, poster 200, mp4 206 (range).

---

## 15. Esqueleto mínimo (JS puro, para colar em qualquer stack)
```js
const section = document.querySelector('#hero');
const layers = [...section.querySelectorAll('.layer')];      // 4: img1, img2, img3, video
const imgs   = [...section.querySelectorAll('.layer img')];   // 3
const video  = section.querySelector('video');
const scenes = [...section.querySelectorAll('.scene')];       // 4
let started = false, primed = false, raf = 0;
// GATE: o hero é a única coisa na página; o botão "CONHEÇA A SAPORINO" chama enterHome() → mostra a home.
const enterHome = () => { try { sessionStorage.setItem('saporino-hero-seen', '1'); } catch {} scrollTo(0,0); /* render da home aqui */ };
const safePlay = () => video.play().catch(() => { video.addEventListener('canplay', () => video.play().catch(()=>{}), { once: true }); });
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a,b,x) => { const t = clamp01((x-a)/(b-a)); return t*t*(3-2*t); };
const setScene = (i, op) => { const s = scenes[i]; s.style.opacity = op; s.style.transform = `translate3d(0,${(1-op)*18}px,0)`; s.style.pointerEvents = op > .5 ? 'auto' : 'none'; };

function update() {
  const total = section.offsetHeight - innerHeight;
  const p = clamp01(-section.getBoundingClientRect().top / Math.max(1, total));
  layers[1].style.opacity = smooth(.16,.30,p);
  layers[2].style.opacity = smooth(.42,.56,p);
  const vop = smooth(.64,.82,p); layers[3].style.opacity = vop;
  video.style.transform = `translate3d(0,0,0) scale(${1.04 - .04*smooth(.64,1,p)})`;
  imgs[0].style.transform = `translate3d(0,0,0) scale(${1.00 + .07*smooth(0,.30,p)})`;
  imgs[1].style.transform = `translate3d(0,0,0) scale(${1.08 - .08*smooth(.16,.56,p)})`;
  imgs[2].style.transform = `translate3d(0,0,0) scale(${1.06 - .04*smooth(.42,.80,p)})`;
  if (!primed && p > .40) { primed = true; video.preload = 'auto'; }
  if (p <= .001 && started) { video.pause(); video.currentTime = 0; started = false; }
  else if (!started && vop > .06) { started = true; safePlay(); }
  else if (started) { if (vop < .10 && !video.paused) video.pause(); else if (vop >= .10 && video.paused && !video.ended) safePlay(); }
  setScene(0, 1 - smooth(.12,.20,p));
  setScene(1, smooth(.24,.32,p) * (1 - smooth(.44,.52,p)));
  setScene(2, smooth(.50,.58,p) * (1 - smooth(.68,.76,p)));
  setScene(3, smooth(.86,.94,p));
}
const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { layers.slice(1).forEach(l => l.style.opacity = 0); [0,1,2].forEach(i => setScene(i,0)); setScene(3,1); }
else { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); update(); }
```

---

## 16. O que mandar junto para o outro chat
1. Este brief. 2. Os 3 JPGs + o MP4 + o poster (§2). 3. A copy (§9) e as regras de marca. 4. A ordem obrigatória: HERO 1 → 2 → 3 → vídeo.
