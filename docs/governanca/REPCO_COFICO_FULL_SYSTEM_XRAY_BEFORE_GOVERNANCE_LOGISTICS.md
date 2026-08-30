# RAIO-X COMPLETO — Ecossistema RepCo + COFICO
### Antes de Governança Comercial + Motor Logístico

> Auditoria **READ-ONLY** cruzando **banco × código × docs × git**. **Nada implementado, alterado, deployado ou pushado.**
> Data: 29/08/2026 · Banco: 82 tabelas + 3 views/matview reais · Método: introspecção ao vivo (`pg_stat_user_tables`, `information_schema`) + grep no repo + git.
> Regra: **documento ≠ implementação**. Cada item marcado por status real.

---

# 1. Resumo executivo

- **RepCo B2B é o coração e está maduro** (pedido, comissão, boleto/parcelas, payout, prospecção 750k, score, POD/rotas). É a base para Governança e Motor Logístico.
- **COFICO Entregas existe de verdade** (motoristas, frota, rotas, paradas, despacho, POD) — admin OK, dados mínimos, app de campo parcial. É base para o Motor Logístico.
- **Studio existe e funciona** (import concorrente, análise Whisper+Claude, guardrails, publica IG). Reutilizável pelo Ai.Bot.
- **Site coficobrasil.com.br está no ar** — mas é **vitrine/marketing estática** (catálogo hardcoded, sem preço, sem login, sem carrinho, sem captura de lead). **Não** está ligado ao RepCo.
- 🔴 **NÃO EXISTEM (só especificação):** Saporino Ai.Bot, E-CoHub, Casa Cofico (loja transacional), Bling, Event Store, Market Memory, Agents/Automation, inventory ledger, client_master.
- 🔴 **Fonte de verdade de CLIENTES: fragmentada, sem mestre.** B2B = `representative_clients` (chaveado por representante+empresa, **sem CNPJ-master → duplicação**). B2C = `user_profiles` + `orders.customer_*`. Não há `client_master`.
- 🔴 **Fonte de verdade de ESTOQUE: `products.stock`** (o RepCo decrementa). Sem ledger, sem reserva, sem SKU/variante → **risco de overselling quando o B2C abrir**. É P0.
- **Fase 0** (checkout/RLS): parcialmente em produção (banco + edge functions), **front NÃO deployado** (local), **pausada** pela migração Mercado Pago PF→PJ.
- **Plano-Mestre vigente = PLANO_MESTRE_UNIFICADO_V2.2** (autorado nesta sessão; incorpora E-CoHub V4 + Ai.Bot V4; **não está salvo no projeto**).

---

# 2. Estado geral (visão de status)

| Bloco | Status real |
|---|---|
| RepCo B2B | **IMPLEMENTADO / MADURO** |
| COFICO Entregas | **PARCIAL** (admin ok, campo parcial) |
| RepCo Studio | **IMPLEMENTADO** (conteúdo/IA social) |
| Saporino Ai.Bot | **SOMENTE ESPECIFICAÇÃO** |
| E-CoHub | **SOMENTE ESPECIFICAÇÃO** |
| Casa Cofico (loja) | **NÃO EXISTE** (site = vitrine estática) |
| Bling | **NÃO EXISTE** (conta PJ prep; produção não ativada) |
| Mercado Pago | **PARCIAL / PAUSADO** (migração PF→PJ) |
| Event Store | **NÃO EXISTE** |
| Market Memory | **NÃO EXISTE** |
| Agents / Automation | **NÃO EXISTE** (só 2 agentes single-shot do Studio) |
| Segurança / RLS | **IMPLEMENTADO** (RLS orders travada; Fase 0) |
| Fase 0 | **PARCIAL** (banco+edge em prod; front local; pausado) |
| Site coficobrasil.com.br | **IMPLEMENTADO** (vitrine) / **isolado do RepCo** |
| Estoque único | **NÃO EXISTE** (products.stock; risco P0) |
| Clientes (mestre) | **NÃO EXISTE** (fragmentado; risco P0) |

---

# 3. Últimos trabalhos Claude/Cowork (ordem cronológica recente)

1. **Auditoria Mestre do ecossistema** (24/08) — 7 agentes read-only; achou 6 tabelas fantasma, B2C nunca vendeu, sem estoque único, webhook MP frouxo, 0 testes. → deu origem ao Plano.
2. **Plano-Mestre Unificado V1→V2→V2.1→V2.2** — fundiu E-CoHub V4 + Ai.Bot V4 + Auditoria em UM plano (1 dono/1 fonte por domínio; camada fiscal PF/PJ; Commission Core; Event Store × Market Memory; hierarquia COMPANY{STORE,BRAND→PRODUCT→VARIANT→SKU→KIT}). **Read-only, entregue como .md; não salvo no projeto.**
3. **Fase 0 — Estabilização/P0** (executada, parcial):
   - **Banco (produção):** criadas `admin_settings`, `user_addresses`, `edge_rate_limits`+RPC `check_rate_limit`, `edge_logs`; coluna `orders.order_public_token_hash` + RPC `get_order_public`; **lockdown de RLS** em `orders`/`order_items` (removidas policies `OR true`/`UPDATE público`).
   - **Edge functions (deploy via CLI):** `create-checkout-order` (novo), `create-payment` (reescrito, preço server-side + idempotência), `mercadopago-webhook` (assinatura obrigatória + idempotência).
   - **Front (LOCAL, não deployado):** checkout anônimo via create-checkout-order, PaymentPages read-only, SubscriptionCheckout desabilitada, remoção de gate de login, remoção de código morto (`segment_payment_terms`).
   - **Testes:** 34 (vitest: leadMatch/pricing/mpWebhook) — **local**.
   - **Pausado** na migração Mercado Pago PF→PJ.
4. **Migração Mercado Pago PF → PJ (prep)** — app PJ COFICO confirmada (3313462574827587), **produção não ativada** (só sandbox); secrets PF intactos; `MERCADO_PAGO_COFICO_*` **não criados**. Go-live pausado.
5. **Site COFICO — seção Produtos (vitrine)** — **PUBLICADO em prod** (commits só-COFICO na main): página separada "Produtos" (hash #loja), cards estilo loja Saporino, **preço travado** ("clientes cadastrados"), CTA → WhatsApp. Estático, sem DB/checkout.

**Dois últimos grandes blocos:** (a) **Fase 0** (checkout/RLS + edge functions) e (b) **site COFICO vitrine**. Nenhum implica E-CoHub/Ai.Bot/estoque-único.

---

# 4. Plano-Mestre vigente

- **Arquivo:** `PLANO_MESTRE_UNIFICADO_V2.2` (scratchpad da sessão + `.md` entregue). **Não versionado no projeto.**
- **Data:** 27/08/2026. **Versão:** V2.2 (corrigiu hierarquia STORE≠BRAND).
- **Fases:** 0 Estabilização · 1 Catálogo+Estoque único · 2 Núcleo E-CoHub+frete · 3 Inteligência (Event Store/Market Memory) · 4 Bling(STOP-GATE fiscal) · 5 1º canal real · 6 Casa Cofico multicanal+Creators · 7 Ai.Bot pleno · 8 CX/forecasting.
- **Concluído:** parte da Fase 0. **Em andamento:** Fase 0 (pausada). **Pendente:** Fases 1–8. **Bloqueado:** go-live pagamento (PF→PJ). **Obsoleto:** —.
- **Decisões posteriores que mudaram o plano:** (i) Mercado Pago **não converte PF→PJ**; abre PJ COFICO nova (blue/green, secrets separados); (ii) checkout **anônimo + preço server-side** (feito); (iii) RLS de orders endurecida (feito).

---

# 5. RepCo B2B — **MADURO**

| Área | Evidência (tabela / n_live) | Status |
|---|---|---|
| Empresas (multi-empresa) | `companies` (3: Saporino Ltda, Fazendinha Ltda, V. Medeiros de Santi Ltda=COFICO) | EXISTE |
| Representadas/Marcas | `distributed_brands` (3) | EXISTE |
| Produtos | `products` (9) + `price_lists` (3, preço B2B por segmento) | EXISTE |
| Clientes | `representative_clients` (7) — tem `company_id`+`representative_id`, `credito_score`, geo, dados bancários | EXISTE (sem mestre — ver §14) |
| Representantes | `representatives` (2, `company_id`+`user_id`) | EXISTE |
| Prospecção | `prospects_b2b` (750.234), `prospect_leads` (228), `prospect_lists` (3), `prospect_runs` (7), `lead_rf_candidates` (0), `mv_repco_prospects_muni` (645) | EXISTE |
| Pedidos | `representative_orders` (3), `representative_order_items` (4), `representative_order_notes` (1) | EXISTE |
| Boleto/parcelas | `representative_order_installments` (4) | EXISTE |
| Comissão/payout | `representative_commissions` (0), `representative_commission_payouts` (0) — vazias até 1º pedido `completed` | EXISTE (motor no banco) |
| Preço | `price_lists` (3) | EXISTE |
| Crédito/score | coluna `credito_score` + `score_serasa_pdf_url` | PARCIAL |
| Rotas/POD/geocerca | `representative_routes` (0)/`route_stops` (0) — estrutura existe, sem dados | PARCIAL |
| Convites/Ajuda | `repco_invite_codes` (3), `repco_help_articles` (50) | EXISTE |
| Auditoria | parcial (sem audit log geral) | PARCIAL |

**Maduro:** pedido, comissão, boleto, preço, prospecção, multi-empresa. **Parcial:** rotas B2B (0 dados), score UI, audit log.

---

# 6. COFICO Entregas — **PARCIAL** (admin ok, campo parcial)

| Item | Evidência | Status |
|---|---|---|
| Motoristas | `drivers` (1), `driver_documents` (1) | EXISTE |
| Frota/Veículos | `fleet_vehicles` (0), `fleet_maintenance` (0), `fleet_documents` (0) | EXISTE (vazio) |
| Rotas | `delivery_routes` (1) | EXISTE |
| Paradas | `delivery_stops` (2) | EXISTE |
| Fila/Despacho | `delivery_dispatch_audit` (5), view `vw_cofico_delivery_queue`, fn `cofico_dispatch_route` | EXISTE |
| Atribuição motorista / data saída | via delivery_routes/stops | PARCIAL |
| Geolocalização/Tracking/POD/Canhoto/GPS | estrutura em delivery_stops + POD do RepCo | PARCIAL |
| Ocorrências / Reentrega | — | NÃO EXISTE |
| Custos / Combustível / Pedágio / Capacidade / Peso / Frete | — | NÃO EXISTE |

**Origem:** `docs/sql/cofico_entregas_*.sql` + `cofico_frota.sql` (aplicados via exec_migration, **fora de supabase/migrations**). Admin (`CoficoEntregas`) existe. **Base sólida para o Motor Logístico**, faltando custo/ocorrência/reentrega.

---

# 7. RepCo Studio — **IMPLEMENTADO**

| Item | Evidência | Status |
|---|---|---|
| Import concorrente (Apify) | `studio-import-instagram` | EXISTE |
| Análise (Whisper + Claude) | `process-studio-video`, `studio_analyses` (5) | EXISTE |
| Brand Guardrails / Guardian | `studio_brand_profiles` (2) | EXISTE (modo warning) |
| Geração de legenda | `studio-caption` | EXISTE |
| Publicação Instagram | `publish-instagram` (100% auto) | EXISTE |
| Publicação TikTok | `publish-tiktok` (rascunho) | PARCIAL |
| Campanhas | `studio_campaigns` (5) | EXISTE |
| Snapshots de seguidores | `studio_profile_snapshots` (42) | EXISTE |
| Conexões sociais | `studio_social_connections` (3) | EXISTE |
| Transcrições | `studio_transcriptions` (0) | EXISTE |
| **Métricas do post publicado** | — | **NÃO EXISTE (ciclo não fecha)** |

**Reutilizável pelo Ai.Bot:** os 2 agentes (Claude Sonnet + Whisper) + Brand Guardrails. **Não duplicar inteligência** — o Ai.Bot deve consumir o Studio, não recriá-lo.

---

# 8. Saporino Ai.Bot — **SOMENTE ESPECIFICAÇÃO**

Verificado (banco + grep): **NÃO EXISTE** nada do Ai.Bot.

| Item | Status |
|---|---|
| aba/UI, dashboard, chat | NÃO EXISTE |
| agentes, capabilities, aprovações, atividades | NÃO EXISTE (só 2 funções single-shot do Studio, que **não** são o Ai.Bot) |
| oportunidades, alertas, memória, desempenho, custos | NÃO EXISTE |
| conhecimento / claims | NÃO EXISTE |
| inteligência comercial/e-commerce/mercado | PARCIAL só como **dados brutos** (BI `vw_repco_*`, `ecommerce_price_snapshots`) — sem camada Ai.Bot |
| representantes/produtos/regiões/config | NÃO EXISTE (como Ai.Bot) |

**Integrações reais** com RepCo/CRM/pedidos/clientes/produtos/Studio/E-CoHub/Market Memory/Event Store: **nenhuma** (Market Memory, Event Store e E-CoHub não existem).
**Fase do roadmap alcançada:** **0**.

---

# 9. E-CoHub — **SOMENTE ESPECIFICAÇÃO**

Verificado: **0 tabelas `eco_*`**, **0** CommerceProvider/adapters/BlingProvider no código.

| Item | Status |
|---|---|
| shell/dashboard/orders/shipping/inventory/products/channels/pricing/finance/reviews/competitors/creators/automation/exceptions/CD ops/settings | NÃO EXISTE |
| CommerceProvider / MarketplaceAdapters / BlingProvider | NÃO EXISTE |
| inventory ledger | NÃO EXISTE |
| freight/shipping | `shipments` (0) genérico existe; sem E-CoHub | MOCK/vazio |
| event model / exception model / automation model | NÃO EXISTE |
| permissions / feature flags | NÃO EXISTE (como E-CoHub) |
| integrações reais / testes | NÃO EXISTE |

**Classificação:** ESPECIFICADO (no Plano V2.2). **REAL: nada.**

---

# 10. Site coficobrasil.com.br — **IMPLEMENTADO (vitrine) / ISOLADO**

| Área | Evidência | Status |
|---|---|---|
| Arquitetura/frontend | React standalone: `CoficoBrasilPage`, `CoficoProdutosPage`, Header/Footer/Carousel/Map | IMPLEMENTADO |
| Backend | só RPC público `cofico_public_stats` (inteiros agregados, sem PII) via `coficoClient.ts` | PARCIAL (só leitura de stats) |
| Banco | não usa tabelas de negócio; catálogo **hardcoded** | NÃO EXISTE |
| Autenticação | nenhuma | NÃO EXISTE |
| Área administrativa | nenhuma (admin é o painel Saporino) | NÃO EXISTE |
| Catálogo/Produtos | seção "Produtos" estática (Saporino+Fazendinha), **sem preço** | IMPLEMENTADO (estático) |
| Estoque/Pedidos/Clientes/CRM/E-commerce/Pagamentos/Logística | — | NÃO EXISTE no site |
| Formulários/Leads | **não captura lead**; CTAs → WhatsApp/e-mail | NÃO EXISTE |
| Integrações/APIs/Webhooks | só `cofico_public_stats` | PARCIAL |

**Conclusão:** o site é **marketing/vitrine**, **desligado do RepCo**. Toda conversão hoje é manual (WhatsApp).

---

# 11. Casa Cofico — **NÃO EXISTE** (como loja)

Não há entidade `stores`, nem loja transacional, nem checkout COFICO. "Casa Cofico" existe só como **conceito no Plano V2.2** (loja da COFICO que venderia Saporino/Fazendinha, faturando por COFICO via Bling). O que existe fisicamente: o **site vitrine** (§10) + COFICO como **empresa** (`companies`: V. Medeiros de Santi Ltda) e **operador logístico** (§6).

---

# 12. Bling — **NÃO EXISTE**

0 integração/provider/OAuth/produtos/estoque/pedidos/NF-e/etiquetas/financeiro/webhooks. Conta PJ COFICO: **produção não ativada**. **PLANEJADO**, não implementado. (Mantém-se só no domínio e-commerce/Casa Cofico — não é dependência do B2B RepCo.)

---

# 13. Mercado Pago — **PARCIAL / PAUSADO** (sem exibir segredos)

| Item | Status |
|---|---|
| PF legacy | Secrets `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_WEBHOOK_SECRET` **existem e intactos** (conta pessoal, já vendeu) |
| PJ COFICO | App `3313462574827587` (COFICO - CASA COFICO E-COMMERCE) criada; **produção NÃO ativada** (só sandbox) |
| Coexistência / blue/green | **PLANO** (não implementado) |
| Secrets esperados | `MERCADO_PAGO_COFICO_ACCESS_TOKEN`, `MERCADO_PAGO_COFICO_WEBHOOK_SECRET` — **não criados** |
| Código | `create-payment`+`mercadopago-webhook` reescritos e **deployados** (via CLI); front **não deployado** |
| Webhook | novo (assinatura obrigatória, idempotência) deployado; aceitação de notificação assinada real **não testada** |
| Deploy/Bloqueios | **PAUSADO** aguardando ativação da produção PJ + secrets PJ |

---

# 14. Clientes — **fragmentado, SEM MESTRE (P0)**

- **B2B:** `representative_clients` (7). Chave = `representative_id` + `company_id` (+ `assigned_to_company`). Tem CNPJ/CPF, contatos, endereço, geo, banco, `credito_score`, `segment`, `forma/prazo_pagamento`. **Mas NÃO há unicidade por CNPJ** → o mesmo CNPJ cadastrado por 2 representantes/empresas vira **2 linhas** (duplicação).
- **B2C:** `user_profiles` (3, auth) + dados embutidos em `orders.customer_name/email/phone`. Sem vínculo a `representative_clients`.
- **Leads/Prospect:** `b2b_leads` (1), `prospect_leads` (228), `prospects_b2b` (750k), `lead_rf_candidates` (0).
- **NÃO existe** `client_master` / `represented_company_id` / `brand relationship` / origem unificada.
**Conclusão:** a estrutura atual **não suporta** "um cliente, uma identidade mestre, vários relacionamentos (Saporino/COFICO/Fazendinha)". Hoje seria duplicação. → **P0 de dados.**

---

# 15. Clientes já existentes da Saporino

- Onde: `representative_clients` (com `company_id` = Café Saporino Ltda). Campos: CNPJ/CPF, `nome_fantasia`/`razao_social`, contatos (`nome_comprador`, `whatsapp_comprador`, `email_comprador`), `endereco_completo`+geo, `representative_id` (responsável), `segment`, histórico via `representative_orders`.
- **Reutilização sem duplicar:** exigiria um `client_master` por CNPJ + tabela de **relacionamentos** (client_id × company_id × representante × status CRM). **Não existe ainda** — auditado, não implementado.

---

# 16. Novos clientes prospectados pela COFICO

- Hoje entrariam como novas linhas em `representative_clients` (com `company_id` da empresa relevante). Sem `client_master`, se o mesmo CNPJ já existir na Saporino → **duplicação**.
- Modelo desejado (CLIENTE MESTRE + ORIGEM=COFICO + RELACIONAMENTO=Fazendinha + responsável + status CRM): **não suportado hoje**.

---

# 17. Operação Fazendinha no RepCo

- **Existe como empresa:** `companies` → "Café Fazendinha Ltda" (`f5a47ea4…`). Multi-empresa por `company_id` em `representative_clients`, `representatives`, `products`, `price_lists`, `representative_orders`, etc.
- **Numeração/comissão por empresa:** existe (company_order_counters=2; comissão por modelo de empresa).
- **Aba própria / seletor de empresa:** o RepCo tem seletor de empresa (multi-empresa) — os dados filtram por `company_id`. Não é uma "aba" separada de código, e sim **tenant lógico por company_id**.
- **Encaixe sem duplicar cliente:** hoje um cliente Fazendinha = linha com `company_id`=Fazendinha. Para um mesmo cliente atender Saporino **e** Fazendinha sem duplicar, faltaria o `client_master` (§14). **Não criar agora.**

---

# 18. Produtos / SKUs

- `products` (9) — nível produto, com `company_id`, `price`, `is_active`, `stock`, `in_stock`, `category`, `weight_grams`. **Não há SKU/variante/kit** (sem `skus`/`product_variants`/`product_kits`).
- Preço B2B: `price_lists` (3, por segmento).
- **Fonte única de produto:** `products`. **Falta** camada SKU/variante (Fase 1 do Plano).

---

# 19. Estoque — **`products.stock` é a única fonte (P0)**

| Fonte candidata | Evidência | Papel real |
|---|---|---|
| `products.stock` | products (9) | **É o que o RepCo decrementa** (trigger no insert do item) e devolve no cancelamento → **fonte de verdade atual** |
| `green_coffee_lots` | (1) + `lot_transfers` (0), `lot_documents` (1) | Cadeia de custo verde→torra (custeio), **não** saldo operacional de venda |
| `shipments` | (0) | genérico, vazio |
| inventory ledger / reservas | **não existe** | — |
| Bling / E-CoHub / site | não existem | — |

**RESPOSTA OBJETIVA:** hoje a **fonte de verdade de estoque é `products.stock`**. **Não há ledger, reserva, SKU, múltiplos depósitos nem anti-overselling.** → **RISCO / P0** (quando o B2C/marketplace abrir, B2B e B2C consumirão o mesmo `products.stock` sem reserva).

---

# 20. CD Várzea Paulista

- **Não há** `warehouses`/`locations`/`bins`/`stock_movements` estruturados. O CD aparece como **texto** (site COFICO, docs) e como origem lógica de expedição, **sem entidade no banco**.
- Movimento de estoque = trigger sobre `products.stock` (sem ledger). **NÃO EXISTE** modelagem de CD/localização/picking/packing/dispatch como dado.

---

# 21. Logística B2B — RepCo / COFICO Entregas

- **RepCo:** `representative_routes`/`route_stops` (0 dados) + POD/geocerca (código existe). **COFICO Entregas:** `delivery_routes`/`delivery_stops`/`delivery_dispatch_audit` + `drivers`/`fleet_*` (§6). **Base real**, faltando custo/ocorrência/reentrega.
- Motor de decisão de frete (custo/km, parada, própria×transportadora): **NÃO EXISTE**.

---

# 22. Logística E-commerce — E-CoHub / Bling / marketplaces

- **NÃO EXISTE.** `shipments` (0) vazio; `sync-tracking` (rastreio) existe mas com token demo (correção local, **não deployada**); sem CarrierAdapter, sem cotação, sem etiqueta e-commerce.

---

# 23. Event Store — **NÃO EXISTE**

Sem tabela `events`, sem service/writer/reader, sem schema, sem UI. Só especificação (Plano V2.2). Rastro de eventos hoje = ad-hoc por feature (`studio_videos.status`, `prospect_runs.status`, `delivery_dispatch_audit`).

---

# 24. Market Memory — **NÃO EXISTE**

Sem tabela `market_memory`, sem Memory Engine, sem writer/reader. Só especificação.

---

# 25. Agents / Automation — **quase inexistente**

| Agente | Real? |
|---|---|
| `process-studio-video` (eng. reversa: Whisper+Claude) | **REAL** (single-shot, gate admin, aprovação humana) |
| `studio-caption` (redator de legenda: Claude) | **REAL** (single-shot) |
| Agente Executivo / especialistas / policy engine / fila | **NÃO EXISTE** (só especificação) |

Sem tabela `agents`/`agent_runs`/`policies`. Cron jobs existem (publish-scheduled, refresh tokens, cepea, mark-inactive-reps) mas são **jobs**, não agentes de IA.

---

# 26. Fase 0 — estado real

| Item | Estado |
|---|---|
| `admin_settings` | **PRODUÇÃO** (1 linha, token NULL) |
| `user_addresses` | **PRODUÇÃO** (0) |
| `edge_rate_limits` + `check_rate_limit` | **PRODUÇÃO** (5) — RPC testada (true,true,false) |
| `edge_logs` | **PRODUÇÃO** (4) |
| RLS `orders`/`order_items` | **PRODUÇÃO** — travada (só `*_select_own` authenticated; anon negado; provado em runtime) |
| `orders.order_public_token_hash` + `get_order_public` | **PRODUÇÃO** |
| `create-checkout-order` | **DEPLOYADO** (edge) — fonte **uncommitted** no git |
| `create-payment` | **DEPLOYADO** (edge, preço server-side + idempotência) — fonte uncommitted |
| `mercadopago-webhook` | **DEPLOYADO** (assinatura obrigatória + idempotência) — fonte uncommitted |
| `sync-tracking` (gate + token→env) | **LOCAL / NÃO DEPLOYADO** (prod ainda com token demo) |
| Front (checkout anônimo, PaymentPages read-only, assinatura off) | **LOCAL / NÃO DEPLOYADO** (Vercel main não tem) |
| Idempotência / rate limiting / observabilidade | **implementado** (rate-limit em prod; obs `edge_logs`) |
| Testes (34) / build / typecheck | **LOCAL** verdes (vitest não está na main) |

**Nuance crítica:** edge functions estão **em produção** com código novo, mas o **front que as usa NÃO está deployado** → na prática o checkout B2C do site **não flui** (front antigo bloqueado pela RLS). **Nenhuma venda B2C possível hoje.** Fase 0 = **PAUSADA**.

---

# 27. Segurança / RLS

- RLS ligada em ~todas as tabelas. `orders`/`order_items` **endurecidas** (Fase 0): anon não lê/altera/insere; authenticated só o próprio; service role opera; consulta pública anônima só via `get_order_public(token)`.
- Provado em runtime (anon key): SELECT/INSERT/UPDATE negados; token cruzado → null.
- **Pendências:** isolamento multi-tenant por `company_id` (adiado); rate-limit em funções Apify/IA (admin-gated); `sync-tracking` deploy do gate.

---

# 28. Testes

- **34 testes** (vitest): `leadMatch` (18), `pricing` (10, preço server-side), `mpWebhook` (6, idempotência). **Local**, verdes. **Não** há testes de integração de banco (comissão/estoque/numeração) nem E2E automatizado. Antes da Fase 0 = **0 testes**.

---

# 29. Integrações reais existentes

| Integração | Estado |
|---|---|
| Supabase (DB/Auth/Storage/RLS) | REAL (núcleo) |
| Mercado Pago (create-payment/webhook) | REAL (PF; PJ pendente) |
| Anthropic Claude + OpenAI Whisper (Studio) | REAL |
| Apify (import IG + preço) | REAL |
| Instagram Graph (publica) | REAL |
| Resend (e-mail recuperação) | REAL |
| Linketrack (rastreio) | PARCIAL (token demo; fix não deployado) |
| GA (gtag) | REAL |
| Bling / marketplaces de venda / NF-e | NÃO EXISTE |
| Site COFICO ↔ RepCo | NÃO EXISTE |

---

# 30. Single Source of Truth (dado → fonte)

| DADO | FONTE ATUAL | TABELA/SERVIÇO | ESCREVE | LÊ | DUPLICADO? | RISCO |
|---|---|---|---|---|---|---|
| Empresa | RepCo/Admin | `companies` (3) | Admin | todos | Não | Baixo |
| Representada/Marca | Admin | `distributed_brands` (3) | Admin | RepCo | Não | Baixo |
| Produto | Admin | `products` (9) | Admin | todos | Não | Médio (sem SKU) |
| SKU | — | **não existe** | — | — | — | **P0** |
| Preço B2B | RepCo | `price_lists` (3) | Admin | RepCo | Não | Baixo |
| Preço B2C | — | `products.price` | Admin | loja | Não | Baixo |
| **Cliente B2B** | RepCo | `representative_clients` (7) | RepCo | RepCo/Ai.Bot | **SIM (sem CNPJ-master)** | **P0** |
| **Cliente B2C** | Loja | `user_profiles`+`orders.customer_*` | loja | — | **SIM (separado do B2B)** | **P0** |
| Endereço | misto | `endereco_completo` / `user_addresses`(0) | vários | vários | **SIM** | Médio |
| Lead/Prospect | RepCo | `b2b_leads`(1)/`prospect_leads`(228)/`prospects_b2b`(750k) | RepCo | RepCo | Parcial | Médio |
| Representante | RepCo | `representatives` (2) | Admin | RepCo | Não | Baixo |
| Pedido B2B | RepCo | `representative_orders` (3) | RepCo | RepCo | Não | Baixo |
| Pedido B2C | Loja | `orders` (0) | Loja/edge | edge | Não | Médio |
| Crédito/score | RepCo | `credito_score` | Admin | RepCo | Não | Baixo |
| **Estoque** | RepCo | **`products.stock`** | trigger RepCo | RepCo/loja | **conflito futuro B2B×B2C** | **P0** |
| Rota | misto | `representative_routes`(0)/`delivery_routes`(1) | 2 sistemas | 2 | **SIM (2 sistemas)** | Médio |
| Veículo/Motorista | COFICO | `fleet_vehicles`(0)/`drivers`(1) | COFICO | COFICO | Não | Baixo |
| Tracking/POD | misto | delivery_stops / `sync-tracking` / `shipments`(0) | vários | vários | **SIM** | Médio |
| Documento | RepCo | `invoices`(0)/`representative_orders.invoice_*` | Admin | RepCo | Não | Baixo |
| Política/Policy | — | **não existe** | — | — | — | Especificado |
| Evento | — | **não existe** (ad-hoc) | — | — | — | Especificado |
| Memória | — | **não existe** | — | — | — | Especificado |

---

# 31. Duplicações encontradas

- 🔴 **Clientes:** B2B (`representative_clients`) × B2C (`user_profiles`/`orders`) × leads (`b2b_leads`/`prospect_leads`) — **sem mestre**; mesmo CNPJ pode duplicar entre empresas.
- 🔴 **Estoque:** `products.stock` (vivo) × `green_coffee_lots` (custeio) — funções diferentes, mas sem fonte única de saldo vendável.
- 🟠 **Rotas/Logística:** `representative_routes`/`route_stops` (RepCo) × `delivery_routes`/`delivery_stops` (COFICO) — **dois sistemas de rota**.
- 🟠 **Tracking/shipment:** `delivery_stops` × `shipments` × `sync-tracking` — três lugares.
- 🟢 **Catálogo:** produto real em `products`; catálogo do site COFICO é **hardcoded** (2ª cópia estática — aceitável como vitrine, mas é duplicação de dado de produto).
- **Event Store / Market Memory / E-CoHub / Bling / Ai.Bot:** não existem → sem duplicação (ainda).

---

# 32. Lacunas priorizadas

**P0**
- Cliente **sem mestre** (client_master por CNPJ + relacionamentos por empresa/marca).
- Estoque **sem fonte única** (ledger + reserva + SKU) → overselling ao abrir B2C.
- Fase 0 **não finalizada** (front não deployado; MP PJ não ativado; sync-tracking token demo em prod).
- Site COFICO **isolado** do RepCo (lead/cliente/pedido não fluem).

**P1**
- Camada de dados de inteligência (Event Store + Market Memory) inexistente.
- SKU/variante/kit; catálogo compartilhado (fim do hardcode do site).
- Rotas/tracking duplicados → consolidar domínio logístico.
- Métricas de conteúdo do Studio (ciclo de aprendizado aberto).

**P2**
- E-CoHub, Bling, NF-e, marketplaces, Casa Cofico transacional, Ai.Bot pleno (fases futuras do Plano).

---

# 33. P0 (consolidado)

1. **client_master** (identidade única + relacionamentos multi-empresa/marca).
2. **estoque-fonte-única** (ledger + reserva + SKU) antes de qualquer canal.
3. **fechar Fase 0** (ativar PJ, secrets COFICO, deploy front, E2E, deploy sync-tracking).
4. **ligar site COFICO ↔ RepCo** (lead→CRM; cliente→master; pedido→RepCo).

---

# 34. Dependências

- **Governança Comercial** depende de: client_master + preço/pedido do RepCo (existe) + estoque único.
- **Motor de Decisão** depende de: dados estruturados (BI `vw_repco_*` existe) + Event Store/Market Memory (não existem) + geo estruturado (parcial).
- **COFICO Entregas → Motor Logístico** depende de: `delivery_*`/`drivers`/`fleet_*` (existem) + custo/ocorrência/reentrega (não existem) + estoque/CD estruturado (não existe).
- Tudo depende de **não duplicar cliente** (P0).

---

# 35. Pronto para **Governança Comercial**? → **PARTIAL**
- **Reutilizável:** RepCo (pedido, comissão/Commission-core-de-fato, preço `price_lists`, crédito/score, prospecção), multi-empresa (`companies`+`company_id`), BI `vw_repco_*`.
- **Bloqueadores/P0:** client_master (duplicação), estoque único.
- **Não criar:** novo CRM, novo motor de comissão, novo cadastro de cliente por marca.

# 36. Pronto para **Motor de Decisão**? → **PARTIAL/BLOCKED**
- **Reutilizável:** BI `vw_repco_*`, `ecommerce_price_snapshots` (5.451), prospecção (750k).
- **Bloqueadores:** Event Store + Market Memory (inexistentes); geo estruturado parcial; sem métricas de conteúdo.
- **Não criar:** segundo Event Store/segunda memória; usar o compartilhado do Plano.

# 37. Pronto para **Motor Logístico**? → **PARTIAL**
- **Reutilizável:** COFICO Entregas (`delivery_*`, `drivers`, `fleet_*`, dispatch), POD/geocerca do RepCo, `shipping_carriers` (4).
- **Bloqueadores/P0:** estoque/CD estruturado inexistente; custo/ocorrência/reentrega ausentes; rotas duplicadas (RepCo × COFICO).
- **Não criar:** terceiro sistema de rota/tracking; consolidar os dois existentes.

---

# 38. O que NÃO deve ser construído de novo
Novo CRM/cliente (usar RepCo + criar **master**, não outra tabela) · novo motor de comissão (RepCo) · novo Event Store/Market Memory (usar o compartilhado do Plano) · nova inteligência de conteúdo (usar Studio) · novo catálogo (usar `products` + fim do hardcode) · terceiro sistema de rota/tracking (consolidar) · segundo estoque (ledger único).

---

# 39. Recomendação de próximo passo (sem executar)
Antes de Governança + Motor Logístico, **priorizar os 2 P0 de dados**: (a) **client_master** (identidade única + relacionamentos multi-empresa) e (b) **estoque-fonte-única** (ledger + reserva + SKU). São pré-requisitos de tudo (governança, e-commerce, logística) e evitam retrabalho/duplicação. Em paralelo, **fechar a Fase 0** (ativar MP PJ + secrets COFICO + deploy front + E2E). **Não** iniciar E-CoHub/Ai.Bot antes desses dados.

---

# 40. Evidências (amostra)
- Banco: `pg_stat_user_tables` (82 tabelas + contagens citadas); `information_schema.columns` (representative_clients tem `company_id`, sem CNPJ-unique; `companies`=3; sem `customers`/`skus`/`inventory*`/`events`/`market_memory`/`agents`/`eco_*`).
- Código: grep no repo por `e-cohub|ai.bot|market memory|event store|PLANO_MESTRE` → **0**; `coficoClient.ts` só `cofico_public_stats`; catálogo COFICO hardcoded.
- Git: `main` = `b6f298d` (3 commits só-COFICO); front de pagamento **uncommitted** (App.tsx, PaymentPages, create-payment/webhook, create-checkout-order) → **não** no Vercel.
- Docs projeto: `RepCo_Inteligencia_de_Dados_Blueprint.md`, `MAPA_FUNCIONAL.md`, `COFICO_Entregas_Plano.md`, `docs/sql/*`, `REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.md` (Fase 0). **Sem** E-CoHub/Ai.Bot/Plano-Mestre no projeto.

---

# RESUMO FINAL

**A. Realmente IMPLEMENTADO:** RepCo B2B (pedido/comissão/boleto/preço/prospecção/multi-empresa) · Studio (IA social + publica IG) · COFICO Entregas (admin/drivers/frota/rotas/POD, dados mínimos) · Segurança RLS de orders (Fase 0) · Fase 0 banco+edge functions (em prod) · Site COFICO vitrine.
**B. PARCIAL:** COFICO Entregas (campo/custos) · rotas B2B (0 dados) · crédito/score UI · Mercado Pago (PF ok, PJ pendente) · Fase 0 (front não deployado) · tracking.
**C. MOCK/vazio:** `shipments`, `fleet_*`, `subscriptions`, `orders` (estruturas prontas, 0 uso).
**D. Só ESPECIFICAÇÃO:** Saporino Ai.Bot · E-CoHub · Casa Cofico (loja) · Bling · Event Store · Market Memory · Agents/Automation · client_master · SKU/inventory ledger.
**E. PAUSADO/BLOQUEADO:** go-live do checkout (Mercado Pago PF→PJ) · Fase 0 (aguardando PJ) · deploy do front de pagamento.
**F. SUBSTITUÍDO:** `product_batches` (morta) → `green_coffee_lots`; decisão MP **não converter PF**, abrir **PJ nova**.
**G. Plano-Mestre vigente:** `PLANO_MESTRE_UNIFICADO_V2.2` (não salvo no projeto).
**H. Fonte de verdade de CLIENTES:** **fragmentada / não existe mestre** — B2B `representative_clients` (sem CNPJ-master), B2C `user_profiles`/`orders`. **P0.**
**I. Fonte de verdade de ESTOQUE:** **`products.stock`** (sem ledger/reserva/SKU). **P0.**
**J. Site COFICO ↔ RepCo hoje:** **desligados** — site é vitrine estática + stats público; conversão manual por WhatsApp.
**K. Saporino/COFICO/Fazendinha compartilham clientes hoje:** só via `company_id` em `representative_clients` (tenant lógico) — **sem identidade mestre**; mesmo cliente entre marcas = **duplicação**.
**L. Pronto para Governança:** **PARTIAL** (RepCo serve; bloqueio = client_master + estoque único).
**M. Pronto para Motor Logístico:** **PARTIAL** (COFICO Entregas serve; bloqueio = estoque/CD + custos + rotas duplicadas).
**N. NÃO reconstruir:** CRM/cliente, comissão, Event Store/Memory, inteligência de conteúdo, catálogo, rota/tracking, estoque — reutilizar/consolidar o que existe.
**O. Próxima ação recomendada (sem executar):** modelar **client_master** e **estoque-fonte-única** (os 2 P0 de dados) + fechar a Fase 0, antes de Governança/Motor Logístico e antes de E-CoHub/Ai.Bot.

---

RAIO-X REPCO + COFICO CONCLUÍDO — NADA IMPLEMENTADO

TRAZER REPCO_COFICO_FULL_SYSTEM_XRAY_BEFORE_GOVERNANCE_LOGISTICS.md DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE ENVIAR GOVERNANÇA COMERCIAL + MOTOR LOGÍSTICO OU ALTERAR O PLANO-MESTRE.
