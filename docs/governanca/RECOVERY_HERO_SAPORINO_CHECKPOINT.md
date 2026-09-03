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
- **PENDING:** promover HERO à HOME (explicitamente **não feito**); logo Saporino **na xícara** do vídeo (produção externa); versão "olha pra câmera e sorri"; render 1080p (vídeos do gerador saem em 720p).
- **BLOCKED (não é desta task):** run Apify ao vivo do INTEL-1 (faturas Apify + sessão admin).
- **UNKNOWN / NEEDS HUMAN:** (a) console da **HOME** em dev: `Error loading products: invalid input syntax for type uuid: "null"` (origem `App.tsx:248`) — **pré-existente, não é do hero** (hero não toca products); confirmar se ocorre em produção. (b) **Migrations aplicadas via RPC `exec_migration`** — a tabela `supabase_migrations.schema_migrations` **não existe** → o CLI não tem histórico (**process deviation**; funciona, mas não rastreia drift).

## 5. HERO — causa raiz
Não era bug. O "não deu certo" foi a soma de: **(1)** procurar na HOME (o hero vive em `/experiencia` por decisão sua); **(2)** verificação anterior numa pane oculta (`vh=0`) — falso negativo de ferramenta; **(3)** incômodos cosméticos (wordmark "Café Saporino" no topo e "ROLE PARA EXPLORAR"); **(4)** faltava o **fechamento** (fruto → xícara). Os 4 foram tratados; o crossfade/scroll já funcionavam.

## 6. HERO — arquivos encontrados
`src/pages/HeroExperiencePage.tsx` · `src/App.tsx` (só a rota) · `public/experiencia/hero-{1,2,3}-saporino.jpg`. Sem código antigo conflitante, sem TODO/FIXME, sem implementação abandonada.

## 7. HERO — arquivos alterados
- **`src/pages/HeroExperiencePage.tsx`** — reescrito (ver §8).
- **NOVOS:** `public/experiencia/hero-4-saporino.mp4` (H.264 yuv420p `+faststart`, 1280×720, 24fps, **7,2s**, sem áudio, **0,9 MB** — `v2_pacing`) · `public/experiencia/hero-4-poster.jpg` (último frame).
- **NÃO tocados:** `App.tsx` (sem diff), HOME, checkout, auth, RepCo, banco, migrations.

## 8. O que foi corrigido / adicionado
- **HERO 4 = vídeo `v2_pacing`** (abre **direto na mulher** → gole → sorriso; 7,2s, 0,9 MB). **Correção após teste visual:** o `seedance` (que abre nos frutos) foi testado primeiro, mas seu **dissolve interno** (cereja → mulher) se sobrepunha ao crossfade de scroll e gerava **dupla exposição embaçada**. Com o `v2`, o scroll faz **um único dissolve limpo** cereja → xícara. Troca feita só no asset (mesmo nome de arquivo, sem mudança de código).
- Seção **450vh → 580vh**; timeline: 1→2 `0.16–0.30` · 2→3 `0.42–0.56` · 3→vídeo `0.66–0.80` · vídeo dominante `0.80–1.00`.
- Vídeo **não é scrubbado**: `play()` uma vez quando a opacity passa de 0,12 (já rodando ao dominar); **volta = pausa mantendo `currentTime`**; reentra = retoma; **topo (p=0) = reset**; sem loop = **congela no último frame** (= poster).
- **Removidos** o wordmark "Café Saporino" (topo-esq.) e o "ROLE PARA EXPLORAR".
- **Copy aprovada, redistribuída** (nenhuma frase nova): cena 3 vira transição só com "Da origem / à xícara."; cena 4 (sobre o vídeo) = slogan aprovado **"O verdadeiro / sabor de Minas."** + "Uma marca feita para quem valoriza café, origem e sabor." + CTAs. Entra em `0.86–0.94` (vídeo assentando). **Eyebrows:** removidos das cenas 2, 3 e 4 a pedido; só a cena 1 mantém o carimbo de lugar "CERRADO MINEIRO · MINAS GERAIS".
- **Reduced-motion:** estático — HERO 1 + cena 4 (CTA); vídeo não toca (poster de fallback).

## 9. Testes
- **typecheck:** exit **0** · **build:** ✓ (8,2s)
- **browser desktop (1440×900):** p=0 HERO1+cena1 · 0.30 `[1,.5,0]` · 0.50 HERO2+cena2 · 0.66 `[1,1,.5]` · 0.73 `[1,1,1,.5]` vídeo **tocando** (t=0,71) · 0.95 `[1,1,1,1]` cena 4 + **2 CTAs** · volta 0.50 → **pausado, t=1,75 mantido** · topo → **t=0**
- **browser mobile (375×812):** seção 4710 (=580vh) · **overflow-x 0** · h1 46px dentro · fim: cena 4 + **2 CTAs dentro do viewport** · vídeo tocando
- **console:** **0 erros do hero**. (Erros `Error loading products` = HOME `App.tsx:248`, pré-existentes — §4.)
- **assets (network):** hero-1/2/3 **200** · poster **200** · mp4 **206** (range)
- **reduced-motion:** validado **por código** (early return → estático); a pane não emula `prefers-reduced-motion`.

## 10. Screenshots / evidências
Capturadas na sessão: desktop **início / meio (0.50) / transição 1→2 (0.30) / 2→3 (0.66) / 3→vídeo (0.73) / final (0.95)**; mobile **início / final**. Frames do vídeo (início/meio/fim) inspecionados via ffmpeg (instalado nesta sessão: `Gyan.FFmpeg 9.0.1`).

## 11. HOME
**HOME NÃO FOI ALTERADA.** `App.tsx` sem diff; `/` carrega sem imagem nem copy do hero. Nenhuma mudança anterior na HOME encontrada.

## 12. Pendências humanas (só o que depende de você)
1. **Aprovar** o vídeo escolhido (`v2_pacing`) e a **copy da cena 4** (slogan reaproveitado) — ou pedir ajuste.
2. **Logo na xícara** + versão **olhando pra câmera** (produção no gerador de vídeo; 1080p se possível). Trocar o arquivo = 1 linha.
3. **Decidir** a promoção para a HOME (não feita).
4. Confirmar se o erro `Error loading products` da HOME acontece em **produção** (para abrir uma task própria — não tratada aqui).

## 13. Próximo passo recomendado
**Abrir `cafesaporino.com.br/experiencia` (Ctrl+Shift+R após o deploy), rolar até o fim e aprovar/ajustar o fechamento (vídeo + copy da cena 4).** Só depois decidir a HOME.

## 14. ARCHITECTURE CHALLENGE
**Nada bloqueante no caminho do HERO.** Dois alertas de processo (não do hero): **(a)** migrations aplicadas por RPC sem histórico do CLI — recomendo passar a registrar pelo `supabase migration` para rastrear drift; **(b)** vídeos saem em **720p** num hero de 1440px+ (leve suavidade) — aceitável no protótipo; pedir **1080p** no render final.

**PARADO AQUI.** Nenhuma task nova iniciada.
