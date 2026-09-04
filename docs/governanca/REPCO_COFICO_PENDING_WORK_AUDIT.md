# REPCO / COFICO — PENDING WORK AUDIT
**Data:** 03/09/2026 · **Tipo:** auditoria read-only (nada implementado, nenhuma migration, nenhum deploy) · **Fontes cruzadas:** git (branches/commits/working tree), banco de produção (contagens reais via `exec_select`), edge functions **deployadas** (CLI), **nomes** de secrets (CLI, sem valores), código (`src/`, `supabase/`), docs/checkpoints, Master Task List (MTL), TODOs.
**Regra:** onde doc ≠ realidade → **PROCESS/STATUS DEVIATION** (§G). Este arquivo **não foi commitado** (push = deploy Vercel; você pediu sem deploy).

---

## A. RESUMO EXECUTIVO
Itens auditados por fluxo (§H): **58**.

| Status | Qtde | Leitura |
|---|---|---|
| **DONE REAL** | 21 | verificado no código/banco/produção |
| **PARTIAL** | 12 | existe, mas não fechado/validado ao vivo |
| **PENDING** | 10 | conhecido, não iniciado ou faltando asset/decisão |
| **BLOCKED** | 4 | dependem de terceiro/credencial/billing |
| **NEEDS HUMAN** | 7 | decisão só sua |
| **DEFERRED** | 4 | adiados por design (gates da MTL) |

**Estado geral:** o código está **estável e íntegro** (`cofico-brasil` == `origin/main`, HEAD `5c8c18e`; typecheck/build verdes; HERO em produção). O que está aberto é quase todo **validação ao vivo bloqueada por billing/credenciais**, **assets/decisões suas** e **higiene de repositório/docs** — não bugs de código. **Nenhuma task 009+ foi iniciada** (nenhuma tabela de identidade/estoque/SKU existe). **Nenhuma frente nova (TikTok, LinkedIn, Ai.Bot, Logistics Hub, Growth) foi implementada** — só há documento/foundation.

---

## B. BLOQUEADORES REAIS AGORA (impedem avanço de algo já construído)
1. **Apify — faturas em aberto** (`Too many outstanding invoices`, 31/08, na conta conectada ao MCP). Bloqueia o **1º run real** do Discovery (WhatsApp) e possivelmente novos runs de Price Intel/Places. *Status hoje: desconhecido — você disse que pagaria; não houve run depois.*
2. **Mercado Pago PJ (COFICO)** — produção da app PJ **não ativada**; secrets `MERCADO_PAGO_COFICO_*` **não existem** (confirmado na lista de secrets). Trava a **TASK 034 (finalizar Fase 0)** e todo o e-commerce transacional.
3. **Sessão admin para validar o Discovery ao vivo** — as ações da edge `discovery-run` são `is_admin()`; só você (logado) consegue disparar o run de teste.

Tudo o mais **não bloqueia**: são pendências que podem andar em paralelo ou aguardar o Bloco Mestre.

---

## C. PENDÊNCIAS QUE DEVEM SER FECHADAS ANTES DO BLOCO MESTRE (prioridade)
| # | Fluxo | Item | Status | Evidência | Risco se ignorar | Ação | Depende de | Esforço |
|---|---|---|---|---|---|---|---|---|
| 1 | Repo | **Repositório aninhado** `website_project/` untracked na raiz (clone "Initial commit" + `BRIEFING_CLAUDE_CODE.md` do Studio, 26/07) | PENDING | `git status` → ` ? website_project`; `git -C website_project log` = 1 commit | confusão de cwd/commits no lugar errado; ruído em todo `git status` | mover para fora do repo ou apagar (é só um clone vazio + 1 briefing) | Vlademir (confirmar) → Claude executa | pequeno |
| 2 | Repo | **Branch `repco-cie`** (28/07): 19 docs de planejamento "Competitive Intelligence Engine" em `docs/repco-cie/`, **145 commits atrás** de `main`, nunca mesclada | UNKNOWN / NEEDS HUMAN | `git log repco-cie -1` = `9a2cce3 docs(repco-cie)…` | planejamento paralelo **sobreposto** ao INTEL-1/Discovery e ao futuro Market Intelligence → risco de dois "cérebros" | decidir: arquivar (tag) ou trazer os docs para `docs/governanca/` como fonte | Vlademir | pequeno |
| 3 | Banco/processo | **Migrations sem rastreio no CLI**: 67 arquivos em `supabase/migrations/`, mas `supabase_migrations.schema_migrations` **não existe** (aplicadas por RPC `exec_migration`) | PROCESS DEVIATION | `select count(*) … schema_migrations` = 0 | drift silencioso entre repo e banco; impossível `supabase db diff` confiável antes de um bloco de arquitetura grande | decidir o método oficial para o Bloco Mestre (CLI `db push` vs RPC) e, se CLI, **bootstrapar** o histórico (marcar as 67 como aplicadas) | Vlademir decide; Claude executa | médio |
| 4 | Docs | **`CLAUDE.md §6` desatualizado**: cita `routes`, `route_assignments`, `delivery_proofs`, `client_route_links` — **não existem** no banco; o real é `delivery_routes/delivery_stops/shipments/drivers/fleet_*/vw_cofico_delivery_queue` (+ `representative_routes` vazia) | PROCESS DEVIATION | consultas `42P01 relation does not exist` | o Bloco Mestre de logística nasceria sobre nomes falsos | corrigir §6 (RAIO_X já avisava) | Claude | pequeno |
| 5 | Fase 0 | **Divergência edge × front**: `create-payment v17`, `mercadopago-webhook v18`, `create-checkout-order v1` **deployadas** (27/08) enquanto o front/migrations vivem em `fase0-pagamento` (1 à frente / **44 atrás** de `main`); `sync-tracking` deployada é **v11 de mar/2026** (a versão Fase 0 com gate **não** está no ar) | PARTIAL (conhecido, documentado em `00_BASELINE_STATUS`) | `supabase functions list`; `git rev-list fase0-pagamento...origin/main` = 1/44 | branch envelhecendo → merge futuro doloroso; edges em prod sem o front correspondente | **rebase/merge de `main` em `fase0-pagamento`** (sem publicar checkout) para parar de divergir | Claude (após seu OK) | médio |
| 6 | Site COFICO | **Assets faltando**: `serrao-tradicional.png`, `serrao-extra-forte.png` (2 produtos caem no logo), `vendas.png`, `logistica.png`, `promotora.png` (3 cards de recrutamento com placeholder cinza), `saporino.png` (card de marca cai em `/saporino-logo.png`) | PENDING (asset) | `test -f` → FALTA nos 6 | site institucional publicado com **placeholders visíveis** | você envia as imagens (ou decide remover os cards) → Claude encaixa | Vlademir | pequeno |
| 7 | Site COFICO | **Café Serrão**: não existe em `products` (0 registros) — está no catálogo da vitrine só como texto | NEEDS HUMAN | consulta `products ilike '%serr%'` = 0 | anunciar produto que não existe | confirmar se é linha real (então cadastrar + foto) ou remover da vitrine | Vlademir | pequeno |
| 8 | Site COFICO | **FINAL ACCEPTANCE CHECK não existe** — só o RC (`SITE_SPRINT_001_008_RELEASE_CANDIDATE.md`); as mudanças foram para `main`/produção sem registro formal de aprovação | PROCESS DEVIATION | `grep -rli "FINAL ACCEPTANCE" docs/` = vazio | fim do sprint sem "carimbo" humano | você aprova (ou lista ajustes) → Claude registra o FINAL ACCEPTANCE em 1 doc curto | Vlademir | pequeno |
| 9 | HOME Saporino | Erro **pré-existente** `Error loading products: invalid input syntax for type uuid: "null"` (`App.tsx:258`) em dev | UNKNOWN | console dev; não é do HERO | se ocorre em produção, a loja pode não listar produtos em algum estado | confirmar em produção (aba anônima, console) → task própria | Vlademir (confirmar) → Claude | pequeno |
| 10 | Repo | **15 imagens brutas untracked** em `public/carreiras/` e `public/cofico/` (nomes com espaço/maiúscula, não referenciadas) | PENDING | `git status public/` | ruído permanente; risco de alguém referenciar nome com espaço (404 no Vercel) | apagar ou renomear em kebab-case e decidir uso | Vlademir | pequeno |

---

## D. PENDÊNCIAS QUE PODEM ENTRAR NO BLOCO MESTRE (não precisam fechar antes)
- **Discovery INTEL-1 — validação ao vivo** (1º run WhatsApp, dedupe/score com dados reais, custo real) — depende do billing Apify (§B1) e da sua sessão admin (§B3).
- **Discovery — evoluções previstas e não feitas:** botão **BUSINESS → `prospect_leads`**, **performance por keyword**, adapter **Base CNPJ (`prospects_b2b`)**, fallback **`scrapier`**, WhatsApp **Channels** ao vivo.
- **MTL 022/023 — consolidar logística**: `representative_routes` (0 linhas) × `delivery_routes`; `delivery_stops` × `shipments` × `sync-tracking` — baseline pequena (1 rota, 2 paradas, 1 motorista, 0 embarques, 0 veículos), ótimo momento para consolidar sem dor.
- **Price Intel — coleta parada desde 22/08** (5.451 snapshots, 15/06→22/08; 15 fontes habilitadas via Apify: Amazon, Mercado Livre, Shopee, TikTok Shop + supermercados SP; cron `scraper-reminder` ativo). Verificar se parou por billing Apify ou por decisão.
- **Studio**: `studio_transcriptions` = 0 (fluxo Whisper não usado); TikTok publish "em rascunho" (conexão **connected**, refresh automático ok em 03/09, escopo `video.publish`) — auditar publicação real.
- **Brand guardrails**: hoje são **soft** (perfil de marca + prompts em `process-studio-video`/`studio-caption`); não há camada de validação dura. Entra no Bloco Mestre de Content/Creative se for o caso.
- **HERO**: vídeo final **1080p com logo na xícara** (troca de 1 arquivo); título de `/experiencia` sobrescrito pelo mapa global de títulos (cosmético).
- **Subline da home page** *"Torra artesanal em pequenos lotes, direto do Cerrado Mineiro"* — contraria a regra de marca (Saporino não é torrefação). Ficou intacta por sua decisão de manter a home page como era.

---

## E. BLOQUEADOS POR TERCEIROS / CREDENCIAIS / BILLING
| Item | Bloqueio | Evidência |
|---|---|---|
| Discovery — run real (WhatsApp grupos/canais, fallback) | **Apify billing** (faturas em aberto) + sessão admin | erro `Too many outstanding invoices` (31/08); `discovery_campaigns`=0, `discovery_results`=0 |
| Fase 0 / e-commerce | **Mercado Pago PJ** não ativado; sem `MERCADO_PAGO_COFICO_*` | lista de secrets só tem `MERCADO_PAGO_ACCESS_TOKEN`/`_WEBHOOK_SECRET` (PF legado) |
| Webhook MP no painel | confirmar URL + secret **no painel do MP** | não verificável daqui |
| LinkedIn (qualquer coisa) | OAuth, ad account, Page, billing, Marketing API, permissões — **nada existe** | nenhum secret `LINKEDIN_*`; código só tem o link do rodapé |
| Price Intel — coleta | possivelmente o mesmo billing Apify | último snapshot 22/08 |
| E-mail transacional de compra/envio | Resend está no ar (`RESEND_API_KEY`), mas o e-mail de **confirmação de compra** depende do checkout (Fase 0) | `orders`=0 |

---

## F. DECISÕES HUMANAS PENDENTES (só você)
1. **Pagar/regularizar a Apify** e autorizar o **1º run real** do Discovery (amostra pequena: 5–10 keywords, BR).
2. **Ativar a app PJ do Mercado Pago (COFICO)** e criar os secrets `MERCADO_PAGO_COFICO_*` — libera a TASK 034.
3. **Branch `repco-cie`**: arquivar ou absorver os 19 docs.
4. **Repositório aninhado `website_project/`**: apagar/mover.
5. **Método oficial de migrations** para o Bloco Mestre (CLI com histórico vs RPC).
6. **Café Serrão**: linha real (cadastrar + fotos) ou sair da vitrine. + **Fotos** dos cards de recrutamento e `saporino.png`.
7. **Aprovação formal do Site Sprint** (FINAL ACCEPTANCE) e, se quiser, a **subline** "Torra artesanal…" da home page.
8. **Vídeo final 1080p** com logo na xícara (produção externa).

---

## G. PROCESS/STATUS DEVIATIONS (feito fora do processo previsto)
1. **Migrations aplicadas por RPC sem histórico no CLI** (67 arquivos; `schema_migrations` inexistente).
2. **Edges da Fase 0 deployadas em produção** (27/08) com front/migrations isolados em branch — documentado no `00_BASELINE_STATUS`, mas a branch já está **44 commits atrás**.
3. **Site Sprint publicado sem FINAL ACCEPTANCE** registrado (só RC).
4. **`CLAUDE.md §6`** descreve tabelas de rotas que não existem (drift doc × banco).
5. **Branch `repco-cie`** com 19 docs de planejamento nunca integrados à governança (`docs/governanca/`) — planejamento paralelo.
6. **Repositório aninhado** `website_project/` na raiz (artefato de sessão antiga).
7. **HERO**: removi o topo original da home page sem pedido (03/09) → **corrigido no mesmo dia** (§18 do checkpoint); registro para histórico.
8. **`BrandPage.tsx` TODO** cita "arte da **Canaan**" — **marca proibida** pelas regras do projeto; hoje é só comentário (`heroImage: null`), mas deve sair.
9. **`prospect_runs`**: 1 run legado preso em `status='running'` (nunca finalizado) — cosmético.
10. **Discovery MVP report** diz "pronto — falta só o run": **correto**, mas a DoD original ("resultado real aparece, dedupe funciona, score aparece") segue **não validada ao vivo** → tratar como PARTIAL, não DONE.

---

## H. BASELINE ATUAL POR FLUXO

### 1. Site COFICO (Sprint 001–008)
- **DONE REAL:** 001 baseline · 002 SEO por host (`robots-cofico.txt`, `sitemap-cofico.xml`, `vercel.json` host routes) · 003 LGPD/Termos/cookies próprios · 004 posicionamento (hero "Desenvolvimento comercial e distribuição de marcas de alimentos", 2 CTAs) · 005 home reorganizada · 006 vitrine (7/9 fotos reais) · 007 Casa Cofico "Em construção" · 008 captação → `b2b_leads` (insert real testado e removido). RC = `main` = produção (sem divergência).
- **PARTIAL:** 006 (2 Serrão sem foto/sem cadastro); recrutamento (3 imagens placeholder); card Saporino (`saporino.png` ausente → fallback logo).
- **PENDING:** FINAL ACCEPTANCE; assets acima; 15 imagens brutas untracked.
- **BLOCKED:** —
- **NEXT:** você envia assets/decide Serrão → registro do FINAL ACCEPTANCE.

### 2. Master Task List (009+)
- **DONE REAL:** 001–008 (Site Sprint). INTEL-1 executada como **trilha própria** (não numerada), sem reordenar a fila.
- **PARTIAL:** 034 (Fase 0) — edges no ar, resto isolado.
- **PENDING (não iniciadas):** 009–033, 035–041, 050. **Próxima real:** **009 Client Identity** (P0). Nenhuma tabela de identidade/conta/SKU/estoque/warehouse existe (confirmado).
- **BLOCKED:** 034 (MP PJ).
- **DEFERRED:** 042 E-CoHub, 043 Bling, 044 Casa Cofico transacional, 045 Marketplace, 046 Creator/Affiliate, 047 Ai.Bot, 048 Guardian, 049 Trade avançada.
- **Avanço indevido além do gate:** **nenhum** (só foundation genérica em `discovery_results` — colunas nulas, sem adapter).
- **NEXT:** decidir se o Bloco Mestre substitui/reordena a fila 009+ ou a executa.

### 3. Discovery INTEL-1
- **DONE REAL:** subaba **Descobrir** em `ProspectionAdmin`; tabelas `discovery_keywords` (**187** seeds), `discovery_campaigns`, `discovery_results` (+ colunas social/creator), `prospect_runs` estendida (source/provider/actor/custo); edge **`discovery-run` deployada (v2, 31/08)** com adapters `whatsapp_group` (lofomachines), `whatsapp_channel` (memo23), `google_places` (compass); UI completa (campanha, chips, grupos, região, fontes, run, resultados, score, aprovar/descartar, histórico, métricas, "Fontes & Agentes"); dedupe por canonical_url/external_id; custo real por run.
- **PARTIAL (não validado ao vivo):** **0 campanhas, 0 resultados; os 7 `prospect_runs` são todos do Places legado** → dedupe/score/aprovação/custo **nunca rodaram com dado real**.
- **PENDING (futuro declarado):** botão BUSINESS→`prospect_leads`; performance por keyword; adapter Base CNPJ; fallback `scrapier` (só no doc, **não** no adapter).
- **BLOCKED:** 1º run real (billing Apify + sessão admin).
- **Respostas diretas:** 1º run real Apify? **NÃO.** Billing ainda bloqueia? **Desconhecido — última evidência: bloqueado.** WhatsApp Groups ao vivo? **NÃO.** Channels ao vivo? **NÃO.** Fallback validado? **NÃO (nem existe no adapter).** Base CNPJ? **só preparada** (758.929 linhas, sem adapter). Botão business→lead? **futuro.** Performance por keyword? **futuro.**
- **NEXT:** regularizar Apify → run de 5–10 keywords → validar dedupe/score/custo → só então decidir Channels/fallback.

### 4. Apify / providers
- **Ativos e testados com resultado real:** `compass~crawler-google-places` (7 runs, **$1,50** rastreado), `apify~instagram-scraper` (Studio, 42 snapshots de perfil), actors de Price Intel (`viralanalyzer` Amazon, `riseandcode` Mercado Livre, `gio21` Shopee, `trakk` TikTok Shop) — 5.451 snapshots.
- **Só registry / auditados por metadata:** `lofomachines/whatsapp-group-search` (schema+preço auditados; run falhou por billing), `memo23/whatsapp-channel-search` (adapter, **não** auditado), `scrapier/whatsapp-group-links-scraper` (só doc).
- **Custo real conhecido:** Places ≈ $0,002/place; WhatsApp = $0,05/run + $0,015/resultado (cap 20/run no free); Studio e Price Intel **não rastreiam custo em DB**.
- **Billing/erro atual:** `Too many outstanding invoices` (31/08). Um `APIFY_TOKEN` único para 3 frentes.
- **NEXT:** regularizar conta; painel de custo por fonte (existe só em `prospect_runs`).

### 5. TikTok / Creators
- **DONE REAL:** nada de Creator Intelligence. (TikTok existe **no Studio**: `tiktok-oauth`, `publish-tiktok`, `refresh-tiktok-token` deployadas; conexão **connected**, refresh ok.)
- **PARTIAL:** foundation genérica em `discovery_results` (`follower_count/engagement_rate/niche/confidence`, vocabulário `RESULT_TYPES`) — colunas vazias, sem adapter.
- **PENDING:** —  · **DEFERRED:** MTL 046. Nenhuma tabela/adapter/task/permissão criada. Checkpoint TikTok Shop está só em Downloads (fora do repo). **Sem expansão indevida.**

### 6. LinkedIn ABM
- **Existe:** apenas link do rodapé (`App.tsx:1764`) e keywords "fora do mapa" reservadas. **Nenhum** OAuth/ad account/Page/billing/Marketing API/permissão/secret/task. Só arquitetura (documento externo). **Nada ativado.**

### 7. E-commerce / Price Intel / E-CoHub (baseline pré-pacote novo)
- **DONE REAL:** `EcommercePriceIntel.tsx` + `PriceListManager`; edges `ecommerce-scrape`, `vtex-scrape`, `cepea-cafe`, `scraper-reminder` (pg_cron + Resend); `ecommerce_sources` (15: 4 marketplaces via Apify + supermercados SP), `ecommerce_price_snapshots` (**5.451**, 15/06→22/08), `vw_ecommerce_latest`; scripts `load_ecommerce_dataset.py`, `etl_cnpj.py`, `geocode_*`, `enrich_leads.py`.
- **PARTIAL:** coleta **parada desde 22/08** (motivo não confirmado).
- **E-CoHub:** **só spec** (`docs/specs/E-COHUB_MASTER_SPEC_CLAUDE_V4.md`) — zero código. **DEFERRED** (042).
- **Duplicação/risco:** custo Apify de Price Intel/Studio não rastreado; `PriceListManager` (B2B) × Price Intel (concorrência) são coisas diferentes — ok.
- **Abandonado:** nada identificado como abandonado; `vtex-scrape` ativo (v14).

### 8. Studio / Brand Guardrails / Content
- **DONE REAL:** `StudioPage` + `AnalysisModal`, `BrandProfile`, `CampaignCreator`, `CampaignsPanel`, `SocialConnections`; **11 edges** deployadas (import IG, thumb, caption, process-video, publish IG/TikTok/scheduled, oauth/refresh IG+TikTok); tabelas: vídeos 5, análises 5, campanhas 5, perfis de marca 2, snapshots de perfil 42; conexões: **IG @cafesaporino** (conn., exp. 07/10), **IG @coficobrasil** (conn., exp. 19/10), **TikTok** (conn., refresh ok 03/09); modelos: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.
- **PARTIAL:** `studio_transcriptions` = 0; TikTok publish em rascunho; guardrails **soft** (perfil + prompt), sem validação dura de marca.
- **Só conceito:** reverse/reference intelligence como sistema; biblioteca de assets; validação de marca automatizada.
- **NEXT:** auditar publicação TikTok real; decidir guardrails duros no Bloco Mestre.

### 9. COFICO Entregas / Logística
- **DONE REAL:** módulo existe: `CoficoEntregas`, `CoficoDrivers`, `RouteManager`, `RepCoRoutes`, `RepCoDeliveries`, `OrderDeliveryEdit`, `TrackingPage`; edge `sync-tracking` (v11, mar/2026); tabelas `delivery_routes` (1), `delivery_stops` (2), `shipments` (0), `drivers` (1), `fleet_vehicles` (0), `fleet_documents`, `fleet_maintenance`, `driver_documents`, `delivery_dispatch_audit` (4), `vw_cofico_delivery_queue`; `representative_routes` (0).
- **PARTIAL:** dados em nível de teste; duplicação conhecida `representative_routes` × `delivery_routes` e `delivery_stops` × `shipments` × `sync-tracking` (MTL 022/023).
- **PENDING:** 022–031 (consolidação, app motorista, zonas, custos, rateio, reconciliação, Motor Logístico). Fontes para isso já inventariadas (Motor Logístico V1.1, Total Express benchmark — `docs/governanca/fontes/`).
- **Deviation:** `CLAUDE.md §6` cita tabelas inexistentes.

### 10. Ai.Bot / automações
- **Real hoje:** **nada** (0 referências em código). Só `docs/specs/SAPORINO_AI_BOT_MASTER_SPEC_COMPLETO_V4.md`. Automações existentes são **outras**: pg_cron `scraper-reminder`, refresh de tokens sociais, `publish-scheduled`. **DEFERRED** (047, reusa Studio). Nada parcial.

### 11. Mercado Pago / E-commerce foundation
- **Ativo (PF legado):** `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`; edges `create-payment` v17, `mercadopago-webhook` v18, `create-checkout-order` v1 (27/08, com rate-limit/logs: `edge_rate_limits` 5, `edge_logs` 4 testes).
- **Bloqueado:** app **PJ COFICO** (3313462574827587) sem produção; `MERCADO_PAGO_COFICO_*` **ausentes**; webhook não confirmado no painel MP.
- **Estado:** `orders` = 0, `subscriptions` = 0; checkout B2C **não flui** (RLS lockdown + front na branch pausada); assinatura desligada por flag. **Confirmado: e-commerce segue DEFERRED / BLOCKED UNTIL E-COMMERCE FOUNDATION READY.**
- **Deviation:** edges deployadas × front em branch 44 commits atrás.

### 12. HERO Saporino
- **Tecnicamente concluído:** **SIM.** **Em produção:** **SIM** (verificado hoje: `/` = abertura em toda entrada; scroll pára no fim; CTA → home page **com topo original**). **Regressão:** nenhuma encontrada (home page restaurada §18; `/experiencia` intacto).
- **Pendência real:** vídeo 1080p com logo na xícara (asset externo). **Decisão humana:** subline "Torra artesanal…" (fora do HERO, na home page); `/experiencia` como rota permanente ou remover depois.
- **Cosmético:** título de `/experiencia` sobrescrito pelo mapa de títulos global; popup de desconto/cookies aparecem na home page (comportamento original, não sobre o HERO).

---

## I. TOP 10 PENDÊNCIAS (ordem)
1. **Regularizar Apify** e fazer o **1º run real** do Discovery (valida dedupe/score/custo — hoje 0 resultados).
2. **Mercado Pago PJ**: ativar produção + criar `MERCADO_PAGO_COFICO_*` (destrava TASK 034 e o e-commerce).
3. **Decidir o método de migrations** e bootstrapar o histórico antes de qualquer bloco de arquitetura.
4. **Rebase de `fase0-pagamento` sobre `main`** (parar a divergência de 44 commits) — sem publicar checkout.
5. **Branch `repco-cie`**: arquivar ou absorver os 19 docs (evitar planejamento paralelo ao Bloco Mestre).
6. **Repo aninhado `website_project/`** + 15 imagens untracked: limpar.
7. **Assets do site COFICO** (Serrão ×2, recrutamento ×3, `saporino.png`) + decisão sobre o Café Serrão.
8. **FINAL ACCEPTANCE** do Site Sprint (registro formal).
9. **Corrigir `CLAUDE.md §6`** (tabelas de logística reais) e remover o TODO "Canaan" do `BrandPage.tsx`.
10. **Confirmar em produção** o erro `Error loading products` da home page e a **coleta parada** do Price Intel (22/08).

---

## J. O QUE NÃO DEVEMOS TOCAR AGORA (evitar expansão de escopo)
- **TASK 009+** (Client Identity, Commercial Accounts, SKU/Kit/Assortment, Warehouse, Ledger, Reservations, Anti-overselling) — só dentro do Bloco Mestre.
- **INTEL-2**, COFICO Intelligence, Growth, Creative Engine, **Logistics Hub**, **Sales Network**, Creator/Affiliate, LinkedIn ABM, Ai.Bot, SaaS externo, E-CoHub, Bling, Casa Cofico transacional, Marketplace.
- **Novos adapters Apify** (Channels/scrapier/CNPJ) antes do 1º run real do adapter principal.
- **Home page Saporino** (conteúdo é seu; só mudar com pedido explícito).
- **Motor Logístico / Governança Comercial** a partir dos docs-fonte (só inventariados).

---

## K. RECOMENDAÇÃO DE SEQUÊNCIA (antes de receber o Bloco Mestre)
1. **Higiene de repositório (1 sessão curta):** mover/apagar `website_project/` aninhado; decidir `repco-cie`; limpar/renomear as 15 imagens; corrigir `CLAUDE.md §6`; tirar o TODO "Canaan".
2. **Decisão de migrations** (CLI × RPC) + bootstrap do histórico — pré-requisito técnico do Bloco Mestre.
3. **Rebase de `fase0-pagamento`** sobre `main` (sem publicar) — corta a divergência antes que o bloco de arquitetura a agrave.
4. **Você:** Apify regularizada → **1º run real do Discovery** (amostra pequena) → eu fecho dedupe/score/custo com dado real e registro.
5. **Você:** assets COFICO + decisão Serrão → eu encaixo e registro o **FINAL ACCEPTANCE** do Site Sprint.
6. **Paralelo, sem bloquear:** MP PJ (secrets) quando ativar → TASK 034.

Só depois disso: receber o **Bloco Mestre RepCo/COFICO** com a fila 009+ (ou sua reordenação).

---

## L. ARCHITECTURE CHALLENGE
**Há dívida técnica que torna perigoso seguir sem tratar — mas é de PROCESSO, não de código:**
1. **Migrations sem histórico no CLI** (67 arquivos aplicados por RPC). Um Bloco Mestre que cria dezenas de tabelas (identidade, contas, SKU, ledger) **sem rastreio** é o cenário clássico de drift irreversível. → **Resolver antes** (decisão + bootstrap). É o único item que eu chamaria de **pré-requisito duro**.
2. **Dois planejamentos paralelos** (`repco-cie` × governança atual) → decidir um dono.
3. **Fase 0 divergindo 44 commits** com edges já em produção → rebase antes que o modelo de dados mude embaixo dela.

Fora isso: **SEM BLOCKER de código.** Repo íntegro, HEAD == `main`, typecheck/build verdes, HERO em produção, nenhuma frente nova implementada, nenhum gate da MTL ultrapassado.

**PARADO APÓS O RELATÓRIO.** Nada implementado, nenhuma migration, nenhum deploy, nenhuma task iniciada.
