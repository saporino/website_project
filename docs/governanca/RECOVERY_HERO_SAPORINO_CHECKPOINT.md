# RECOVERY + HERO SAPORINO CHECKPOINT
**Data:** 03/09/2026 · **Regra:** estado REAL (código/DB/git), não memória nem relatório antigo. **Nenhuma** frente nova iniciada (INTEL-2, COFICO Intelligence, Growth, Creative, Logistics, Studio, Ai.Bot: NÃO tocadas).

## 1. Estado encontrado
- **branch:** `cofico-brasil` (empurra p/ `main`)
- **commit (início):** `2ceb724` — `fix(saporino): hero prototipo — 3 imagens em loading=eager` · **HEAD == origin/main** (tudo pushado)
- **working tree (início):** limpo para código. Só ruído pré-existente: `supabase/.temp/cli-latest` (M) e imagens brutas **untracked** em `public/carreiras/` e `public/cofico/` (nomes com espaço/maiúscula — não referenciadas; ficam fora).

## 2. DONE REAL (reconciliado doc × código)
| Item | Evidência real |
|---|---|
| **Site Sprint 001–008** | commits `da6715d…2cb8cd3`; arquivos existem: `robots-cofico.txt`, `sitemap-cofico.xml`, `CoficoPolicyPages`, `CoficoCookieConsent`, `CoficoMarcaLeadForm`, fotos `cofico/*.png`; `vercel.json` com rotas por host (7 refs) |
| **RepCo INTEL-1 (Discovery)** | `DiscoveryPanel.tsx`, `discoveryClient.ts`, edge `discovery-run/`; `ProspectionAdmin` com aba `descobrir`; 3 migrations no repo; **DB real:** `discovery_keywords` **187** · `discovery_campaigns` 0 · `discovery_results` 0 · `prospect_runs` com as 5 colunas discovery |
| **HERO Saporino (protótipo /experiencia)** | `src/pages/HeroExperiencePage.tsx` + rota em `App.tsx` (L46 lazy, L183 if) + `public/experiencia/hero-1..3-saporino.jpg` (2048×1152) — commits `8fd0aae`/`2ceb724`. **Verificado funcionando nesta sessão.** |

**PROCESS/STATUS DEVIATION:** nenhuma divergência "reportado DONE × código" no Site Sprint/INTEL-1. A única: na sessão anterior a *verificação* do HERO deu falso negativo (pane oculta → `innerHeight=0`, rAF pausado) — **o código já estava correto**.

## 3. PARTIAL (no início desta sessão)
- **HERO 4 (final com a xícara):** não existia no código. → **Concluído nesta sessão** (ver §7/§8), com pendências humanas (§12).

## 4. PENDING / BLOCKED / UNKNOWN
- **PENDING (superado — promoção FEITA depois, ver §15):** ~~promover HERO à HOME~~; logo Saporino **na xícara** do vídeo (produção externa); versão "olha pra câmera e sorri"; render 1080p (vídeos do gerador saem em 720p).
- **BLOCKED (não é desta task):** run Apify ao vivo do INTEL-1 (faturas Apify + sessão admin).
- **UNKNOWN / NEEDS HUMAN:** (a) console da **HOME** em dev: `Error loading products: invalid input syntax for type uuid: "null"` (origem `App.tsx:248`) — **pré-existente, não é do hero** (hero não toca products); confirmar se ocorre em produção. (b) **Migrations aplicadas via RPC `exec_migration`** — a tabela `supabase_migrations.schema_migrations` **não existe** → o CLI não tem histórico (**process deviation**; funciona, mas não rastreia drift).

## 5. HERO — causa raiz
Não era bug. O "não deu certo" foi a soma de: **(1)** procurar na HOME (o hero vive em `/experiencia` por decisão sua); **(2)** verificação anterior numa pane oculta (`vh=0`) — falso negativo de ferramenta; **(3)** incômodos cosméticos (wordmark "Café Saporino" no topo e "ROLE PARA EXPLORAR"); **(4)** faltava o **fechamento** (fruto → xícara). Os 4 foram tratados; o crossfade/scroll já funcionavam.

## 6. HERO — arquivos encontrados
`src/pages/HeroExperiencePage.tsx` · `src/App.tsx` (só a rota) · `public/experiencia/hero-{1,2,3}-saporino.jpg`. Sem código antigo conflitante, sem TODO/FIXME, sem implementação abandonada.

## 7. HERO — arquivos alterados
- **`src/pages/HeroExperiencePage.tsx`** — reescrito (ver §8).
- **NOVOS:** `public/experiencia/hero-4-saporino.mp4` (H.264 yuv420p `+faststart`, 1280×720, 24fps, **7,2s**, sem áudio, **0,9 MB** — `v2_pacing`) · `public/experiencia/hero-4-poster.jpg` (último frame).
- **NÃO tocados (até o fechamento; depois `App.tsx` e a HOME mudaram — ver §15):** checkout, auth, RepCo, banco, migrations.

## 8. O que foi corrigido / adicionado
- **HERO 4 = vídeo `v2_pacing`** (abre **direto na mulher** → gole → sorriso; 7,2s, 0,9 MB). **Correção após teste visual:** o `seedance` (que abre nos frutos) foi testado primeiro, mas seu **dissolve interno** (cereja → mulher) se sobrepunha ao crossfade de scroll e gerava **dupla exposição embaçada**. Com o `v2`, o scroll faz **um único dissolve limpo** cereja → xícara. Troca feita só no asset (mesmo nome de arquivo, sem mudança de código).
- Seção **450vh → 580vh**; timeline: 1→2 `0.16–0.30` · 2→3 `0.42–0.56` · 3→vídeo `0.66–0.80` · vídeo dominante `0.80–1.00`.
- Vídeo **não é scrubbado**: `play()` uma vez quando a opacity passa de 0,12 (já rodando ao dominar); **volta = pausa mantendo `currentTime`**; reentra = retoma; **topo (p=0) = reset**; sem loop = **congela no último frame** (= poster).
- **Removidos** o wordmark "Café Saporino" (topo-esq.) e o "ROLE PARA EXPLORAR".
- **Copy aprovada, redistribuída** (nenhuma frase nova): cena 3 = "Da origem / à xícara." + "Uma marca feita para quem valoriza café, origem e sabor." (frase aprovada dela); cena 4 (sobre o vídeo) = só o slogan aprovado **"O verdadeiro / sabor de Minas®."** + 1 botão branco "CONHEÇA A SAPORINO" (→ home) — **superado: na promoção a cena 4 virou "Seu momento / Saporino." (ver §15)**. Entra em `0.86–0.94` (vídeo assentando). **Eyebrows:** removidos das cenas 2, 3 e 4 a pedido; só a cena 1 mantém o carimbo de lugar "CERRADO MINEIRO · MINAS GERAIS". **®** discreto (sobrescrito, ~0,20× do título, 70% de opacidade, folga zero) grudado no canto superior do último "s" — "Minas®." (antes do ponto) — nas cenas 1 e 4 — slogan registrado junto com a marca.
- **Reduced-motion:** estático — HERO 1 + cena 4 (CTA); vídeo não toca (poster de fallback).

## 9. Testes
- **typecheck:** exit **0** · **build:** ✓ (8,2s)
- **browser desktop (1440×900):** p=0 HERO1+cena1 · 0.30 `[1,.5,0]` · 0.50 HERO2+cena2 · 0.66 `[1,1,.5]` · 0.73 `[1,1,1,.5]` vídeo **tocando** (t=0,71) · 0.95 `[1,1,1,1]` cena 4 + **1 CTA** (atualizado: era 2) · volta 0.50 → **pausado, t=1,75 mantido** · topo → **t=0**
- **browser mobile (375×812):** seção 4710 (=580vh) · **overflow-x 0** · h1 46px dentro · fim: cena 4 + **1 CTA dentro do viewport** (atualizado: era 2) · vídeo tocando
- **console:** **0 erros do hero**. (Erros `Error loading products` = HOME `App.tsx:248`, pré-existentes — §4.)
- **assets (network):** hero-1/2/3 **200** · poster **200** · mp4 **206** (range)
- **reduced-motion:** validado **por código** (early return → estático); a pane não emula `prefers-reduced-motion`.

## 10. Screenshots / evidências
Capturadas na sessão: desktop **início / meio (0.50) / transição 1→2 (0.30) / 2→3 (0.66) / 3→vídeo (0.73) / final (0.95)**; mobile **início / final**. Frames do vídeo (início/meio/fim) inspecionados via ffmpeg (instalado nesta sessão: `Gyan.FFmpeg 9.0.1`).

## 11. HOME
**Até 03/09 (fechamento deste checkpoint): HOME NÃO FOI ALTERADA.** Depois, com aprovação explícita ("vamos aplicar o HERO"), a HOME **foi alterada** — ver **§15 (Promoção para a HOME)** abaixo.

## 12. Pendências humanas (só o que depende de você)
1. **Aprovar** o vídeo escolhido (`v2_pacing`) e a **copy da cena 4** (slogan reaproveitado) — ou pedir ajuste.
2. **Logo na xícara** + versão **olhando pra câmera** (produção no gerador de vídeo; 1080p se possível). Trocar o arquivo = 1 linha.
3. ~~Decidir a promoção para a HOME~~ **FEITA** (ver §15) — agora: aprovar o visual final em produção (`cafesaporino.com.br` + Ctrl+Shift+R).
4. Confirmar se o erro `Error loading products` da HOME acontece em **produção** (para abrir uma task própria — não tratada aqui).

## 13. Próximo passo recomendado
**Abrir `cafesaporino.com.br` (a HOME, Ctrl+Shift+R após o deploy), rolar o hero até a loja e aprovar o resultado em produção.** Depois: vídeo final em 1080p com logo na xícara (troca de 1 arquivo) e decidir o timing do popup de desconto sobre o hero.

## 14. ARCHITECTURE CHALLENGE
**Nada bloqueante no caminho do HERO.** Dois alertas de processo (não do hero): **(a)** migrations aplicadas por RPC sem histórico do CLI — recomendo passar a registrar pelo `supabase migration` para rastrear drift; **(b)** vídeos saem em **720p** num hero de 1440px+ (leve suavidade) — aceitável no protótipo; pedir **1080p** no render final.

---

## 15. PROMOÇÃO PARA A HOME (aprovada: "vamos aplicar o HERO")
**O que mudou**
- **NOVO `src/components/HeroExperience.tsx`** — o hero (3 fotos + vídeo) virou componente **compartilhado**: HOME e `/experiencia` usam o mesmo (props: `onCta`, `fadeToWhite`). `HeroExperiencePage.tsx` virou wrapper fino.
- **`App.tsx`:** a linha do `<Hero/>` antigo passou a `<HeroExperience onCta={() => scrollToSection('products')} fadeToWhite />`; **`Hero` antigo (logo central + "Torra artesanal…", off-brand) e `heroImage` removidos**. Import direto (é o LCP). **Rollback = `git revert` do commit da promoção.**
- Header (`fixed`, z-50, gradiente escuro→transparente) **não precisou mudar** — já era desenhado para ficar sobre foto escura; o logo do header assume a marca (por isso o wordmark do protótipo foi removido).
- **H1 único** (cena 1: "O verdadeiro sabor de Minas®."); as outras cenas usam `<p>` com o mesmo visual. `document.title` **saiu** do componente (não sobrescreve o título da home).
- **Vídeo:** `preload="metadata"` e vira `auto` em p>0,40 (protege o LCP); `play()` com **retry em `canplay`**; **fade para branco** em p 0,90–1,00 só na home (o site "abre" sobre o carrossel).
- **Vibrância (pedido do Vlademir: céu/verde apagados):** a causa era o overlay cobrindo a tela toda (34% de preto no centro). Agora o overlay fica **só na faixa do texto** (`.55 → .22 @38% → 0 @62%`), sombra do texto mais firme (curta + difusa), **`saturate(1.06) contrast(1.02)` só nas fotos** (vídeo natural).
- **Cena 4 = "Seu momento / Saporino."** (aprovada; o slogan já abre o hero, repetir no fim era redundante) + **1 botão** branco "CONHEÇA A SAPORINO" (home: rola até a loja `#products`; `/experiencia`: vai para a home).

**Testes (todos verdes)**
- `typecheck` **0** · `build` **0**.
- **Desktop 1440×900:** hero 580vh (5220px), hero antigo ausente, header `fixed` z-50 por cima, **1 `<h1>`**, 3 fotos carregadas, `preload` metadata→auto, título da home preservado; crossfades p0,30 `[1,1,0,0]` · 0,50 `[1,1,.61,0]` · 0,73 `[1,1,1,.5]` vídeo tocando (t 2,48→3,38); fade-branco 1 em p=1; **CTA rolou até `#products` (top 0)**; carrossel + 9 produtos renderizam depois.
- **Mobile 375×812:** overflow-x **0**, 580vh=4710, h1 46px cabe (direita 353), header não sobrepõe o texto; **scroll progressivo:** prime em 0,40, vídeo começa em 0,75, t 3,3 no fim, CTA inteiro no viewport (544–596).
- **`/experiencia`:** intacto (sem fade, sem header).
- **Console:** só o erro **pré-existente** `Error loading products: invalid input syntax for type uuid: "null"` (§4) — zero erros do hero.

**Ressalvas conhecidas (não bloqueiam)**
1. Título da aba em `/experiencia` é sobrescrito pelo **mapa global de títulos** do `App.tsx` (L128–131) — cosmético na rota de teste.
2. Vídeo em **720p** — pedir **1080p** na versão final (com logo na xícara / olhar pra câmera).
3. **Popup de desconto e cookie banner** da home aparecem **sobre o hero** no primeiro acesso (pré-existentes). Vale decidir se o popup deve esperar o usuário sair do hero.
4. Erro `Error loading products` na home — confirmar em produção (task própria).

---

## 16. Ajustes pós-promoção (pedidos do Vlademir, 03/09 — commit `9a061ae`)
- **Header escondido na abertura.** "Nada a ver colocar as abas de navegação no HERO." O hero emite `onHeroActive(active)` só na troca (ref, sem re-render por frame); o `Header` recebe `hidden` → `opacity 0`, `translateY(-4px)`, `pointer-events none`, `aria-hidden`, transição 500 ms. Aparece quando p ≥ 1 (o site "abre") ou ao clicar em **CONHEÇA A SAPORINO** (rola até a loja); some de novo ao voltar ao hero. Reduced-motion: header sempre visível. Na página de produto (`selectedProduct`) o hero não monta e o header fica normal.
- **Fotos substituídas** pelas 3 novas de **céu azul / verde vivo** (`Hero 1/2/3.png` → JPG 2048×1152, mesmos nomes, 660/700/460 KB). O `saturate/contrast` foi **removido** — "filtro não substitui foto boa".
- **Vídeo substituído** (`Hero 4.mp4`): cozinha clara, **termina olhando para a câmera e sorrindo com a xícara**; H.264 faststart, `-an -dn` (sem áudio e sem trilha de dados), 720p, 10,9 s, 1,3 MB; poster = último frame.
- **Fusão HERO 3 → vídeo mais suave:** janela `0,64–0,82` (era 0,66–0,80), vídeo começa a tocar a partir de opacity **0,06** (era 0,12) e entra com **scale 1,04 → 1,00** (continuidade com a HERO 3); texto da cena 3 sai em `0,66–0,74`.
- **Testes (todos verdes):** typecheck 0 · build 0 · **desktop 1440:** header opacity 0 / pointer-events none / aria-hidden no topo e em todo o hero; fotos 2048×1152 (200); fusões p0,64 `[1,1,1,0]` → 0,73 `[1,1,1,.5]` (vídeo t 0,75, scale 1,034) → 0,82 `[1,1,1,1]` (t 1,55); header **1** ao passar do hero e após o CTA (produtos no topo), **0** ao voltar; console limpo · **mobile 375:** overflow 0, 580vh=4710, header 0 durante todo o hero e 1 depois, vídeo toca de 0,75 (t 2,95 no fim), CTA no viewport · `/experiencia` ok.
- **Ressalvas:** vídeo ainda **720p** (pedir 1080p na versão com logo na xícara); popup de desconto/cookies da home segue aparecendo sobre o hero no 1º acesso (decisão de timing pendente); título de `/experiencia` sobrescrito pelo mapa global de títulos (cosmético).

---

## 17. HERO como ABERTURA (gate) — decisão do Vlademir, 03/09
"Não quero que dê para fazer scroll para a página: pára no fim do HERO e só o clique em CONHEÇA A SAPORINO entra na home."
- **Implementação:** `AppRouter` ganhou o estado `heroGate` (inicial = `!sessionStorage['saporino-hero-seen']`). Em `/`: se `heroGate` → renderiza **`HeroGate`** (novo, `src/components/HeroGate.tsx`: só o `HeroExperience`, sem fade, sem header, **nada abaixo** → o documento termina no fim do HERO e o scroll pára ali). O CTA chama `enterHome()` → grava a flag, `scrollTo(0,0)`, `heroGate=false` → renderiza `AppContent` (a home de sempre, com header e loja). **A URL continua `/`** — nenhum link do site quebrou.
- **Abertura na 1ª entrada da sessão:** depois do clique, `/` vai direto para a home (rever a abertura a cada clique no logo irritaria). Para mostrar **sempre**, é só o `AppRouter` ignorar o `sessionStorage` (1 linha).
- **Substitui o §16 "header escondido":** o mecanismo `onHeroActive`/`hidden` foi **removido do AppContent** (o header volta a ser sempre visível na home). A prop `onHeroActive` do componente ficou disponível mas não é usada.
- **Efeito colateral bom:** popup de desconto e cookie banner vivem na home → **não aparecem mais sobre o HERO**.
- **Trade-off assumido (avisado):** para o Google, `/` passa a ser a abertura (H1 do slogan + botão); a vitrine fica atrás do clique.
- **Testes (verdes):** typecheck 0 · build 0 · **desktop 1440:** `/` só HERO (sem header/produtos; `docH == heroH`, 5220), scroll máximo = fim do HERO (4320) com cena 4 + vídeo tocando, clique → home (header 1, 9 produtos, `scrollY 0`, flag `1`), `/` de novo → home direto, `/experiencia` ok, console limpo · **mobile 375×812:** só HERO (sem header/produtos, `docH == heroH`, overflow-x 0, h1 46px), vídeo toca a partir de p 0,8 (t 0,75 → 2,26), scroll máximo = fim do HERO, CTA inteiro no viewport (544–596), clique → home (header, produtos, `scrollY 0`, overflow 0).

**PARADO AQUI.** Nenhuma task nova iniciada.
