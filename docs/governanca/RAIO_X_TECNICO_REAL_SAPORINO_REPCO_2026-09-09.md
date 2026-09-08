# RAIO-X TÉCNICO REAL — SAPORINO / COFICO / REPCO

**Data:** 09/09/2026
**Natureza:** auditoria exclusivamente de leitura — nenhum arquivo alterado, nenhuma migration criada, nenhum deploy. `git status` limpo no início e no fim.
**Método:** consultas diretas ao Postgres de produção (`pg_class`, `pg_policies`, `pg_proc`, `cron.job`, contagens reais), leitura do repositório e das 117 migrations. Onde há um número, ele veio de uma consulta — não da documentação.
**Escala:** 113 tabelas · 117 migrations · 32 edge functions · ~42.000 linhas TS/TSX
**Versão HTML:** https://claude.ai/code/artifact/ce7b80c2-3811-492b-8536-10a04eab036b

---

## Legenda de status

| Marca | Significado |
|---|---|
| ✅ FUNCIONAL | Existe, roda, tem uso real |
| 🟡 PARCIAL | Existe e funciona pela metade |
| 🔵 FOUNDATION | Infra existe, experiência não está completa |
| ⚪ PLANEJADO | Só documentação, plano ou stub |
| ❌ NÃO EXISTE | Nada no código |
| ☠️ ABANDONADO | Código antigo, sem uso |

Este documento separa quatro coisas que costumam ser confundidas: **o que foi pensado**, **o que foi documentado**, **o que tem código** e **o que funciona de verdade**. Onde não consegui confirmar, digo que não confirmei.

---

## A frase que resume

Existe aqui um **sistema operacional B2B genuinamente funcional** (RepCo) e uma **loja B2C recém-terminada e tecnicamente correta**, montados sobre uma fundação de dados séria — RLS em 113 de 113 tabelas, preço e estoque decididos no servidor. Em volta deles existe uma **camada de ambição documentada que ainda não tem código**: E-CoHub e AI.Bot somam 6.188 linhas de especificação e **zero** linhas de implementação. E, no meio, existe um **Discovery caro de construir que nunca produziu um único resultado**.

---

## 1. MAPA REAL DO REPOSITÓRIO

O sistema hoje realmente é composto por **uma única aplicação React SPA e um único banco Supabase**. Não há monorepo, não há microsserviços, não há backend próprio, não há workers dedicados. A separação entre "produtos" (Saporino, COFICO, RepCo, Studio, Promotor) é feita por **rota e por pasta de componentes**, dentro do mesmo bundle.

| Camada | O que é de fato | Evidência |
|---|---|---|
| Frontend | SPA React 18 + Vite + Tailwind, roteador manual (sem react-router apesar de estar no `package.json`) | `src/App.tsx` (2.359 linhas) |
| Backend | Não existe servidor próprio. 32 Edge Functions Deno + lógica em PL/pgSQL | `supabase/functions/` · 5.308 linhas |
| Banco | Postgres Supabase único. 113 tabelas, 41 views, ~95 funções | `pg_class` / `pg_proc` |
| Jobs | 7 jobs pg_cron ativos. Não há fila, não há worker | `cron.job` |
| Agents | Não há agentes. Há 2 chamadas de LLM dentro de edge functions | `process-studio-video`, `studio-caption` |
| Deploy | Vercel por push em `main`; `vercel.json` usa `routes` (não `rewrites`) | `vercel.json` |

### Distribuição de esforço (linhas de código)

| Área | Linhas |
|---|---:|
| `src/components/admin` (55 arquivos) | 19.588 |
| `src/components/repco` | 6.507 |
| `src/pages` | 6.455 |
| `supabase/functions` | 5.308 |
| `src/App.tsx` (arquivo único) | 2.359 |
| `src/lib` | 2.227 |
| `src/components/studio` | 1.247 |
| `src/components/promotor` | 909 |

**Leitura estratégica:** metade do código do projeto está no painel administrativo. Isso é coerente com uma empresa que construiu primeiro o seu sistema interno — mas também significa que **o esforço de engenharia foi majoritariamente para telas que só a própria empresa usa**, não para superfícies que geram receita.

Os nomes planejados **não** correspondem ao código, com uma exceção. "RepCo" existe como pasta e rota. "Studio" existe como pasta e rota. "Casa COFICO" existe como rota (`/coficobrasil`) e como `channel = 'casa-cofico'`. Mas **"E-CoHub", "AI.Bot" e "RepCo Intel" não existem como diretório, módulo, serviço ou classe em lugar nenhum do código.**

---

## 2. REPCO — AUDITORIA REAL

O RepCo é a parte mais madura do sistema. É o único módulo com fluxo completo de ponta a ponta e regra de negócio no banco.

| Módulo | Status | Evidência e por quê |
|---|---|---|
| Clientes (CRM) | ✅ FUNCIONAL | `representative_clients` (7 linhas), `RepCoClients.tsx`. Cadastro, condição de pagamento, segmento, geo |
| Pedidos | ✅ FUNCIONAL | `representative_orders` (3), fluxo Cliente→Produtos→Revisão em `RepCoNewOrder.tsx`; trigger `generate_repco_order_number` |
| Comissões | ✅ FUNCIONAL | Cálculo **no banco**: `calculate_repco_commission`, `repco_commission_cycle`, `create_pix_commission_payout`, `create_boleto_commission_payout` |
| Parcelas / boleto | ✅ FUNCIONAL | `representative_order_installments` (2); comprovante dispara payout proporcional |
| Score do cliente | 🔵 FOUNDATION | `repco_score_on_installment_paid`; migration `20260602015137`. Sem histórico real (3 pedidos) |
| Trava por inadimplência | 🔵 FOUNDATION | `vw_repco_clientes_bloqueados`; nunca acionada em produção |
| Preços B2B | ✅ FUNCIONAL | `price_lists` (3), UNIQUE(product_id, segment), `PriceListManager.tsx` |
| Rotas / entrega | 🟡 PARCIAL | `delivery_routes` (1), `delivery_stops` (2), `cofico_dispatch_route`, Leaflet com geofencing |
| Estoque | ✅ FUNCIONAL | FIFO por lote: `consume_stock_fifo`, `green_coffee_lots`, `stock_movements` (5) |
| Prospecção | 🟡 PARCIAL | `prospects_b2b` **758.929** linhas, `prospect_leads` 228, `prospect_lists` 3 |
| **Oportunidades / pipeline** | ❌ NÃO EXISTE | Não há tabela de *opportunity*, *deal* ou *stage*. O CRM registra clientes e pedidos, não um funil |
| **Follow-up / cadência** | ❌ NÃO EXISTE | Há `handle_client_snooze` e `rep_daily_plans`, mas nenhuma cadência, tarefa ou lembrete |
| **Propostas** | ❌ NÃO EXISTE | Nenhuma tabela ou tela. O pedido é o primeiro artefato |
| Commercial accounts | 🔵 FOUNDATION | `commercial_accounts` com 20 colunas e **0 linhas**. Veio do Coffee Network, não do RepCo |
| Histórico do cliente | 🟡 PARCIAL | View `client_sales_history` cobre só pedidos RepCo — compras B2C do mesmo CNPJ não entram |
| Chat interno | ✅ FUNCIONAL | 6 RPCs, Realtime, upload por edge function. É chat **interno**, não atendimento |
| Ajuda / manual | ✅ FUNCIONAL | `repco_help_articles` — 50 artigos |

> **O ponto crítico do RepCo:** o módulo é sólido **como registro** e inexistente **como motor comercial**. Ele sabe guardar um pedido que já aconteceu, calcular a comissão e pagá-la. Ele não sabe dizer a um representante o que fazer amanhã de manhã. Não há funil, não há tarefa, não há próxima ação — e é exatamente isso que separa um sistema de registro de um sistema que aumenta vendas.

---

## 3. DISCOVERY INTELLIGENCE

A estrutura existe, está bem desenhada, e **nunca rodou**.

| Objeto | Existe | Linhas reais | Observação |
|---|---|---:|---|
| `discovery_keywords` | ✅ | 187 | Seed aplicado |
| `discovery_campaigns` | ✅ | 0 | Nenhuma campanha criada |
| `discovery_results` | ✅ | **0** | **Nenhum resultado, nunca** |
| `prospect_runs` | ✅ | 7 | Runs do fluxo *antigo* (Apify Places) |
| `prospect_leads` | ✅ | 228 | Fluxo antigo, paralelo ao Discovery |
| `prospects_b2b` | ✅ | 758.929 | ETL da base CNPJ |

### A contagem de 187 keywords: CONFIRMADA

Não aceitei o número do enunciado. Consultei o banco:

```sql
select s, count(*) from discovery_keywords k, unnest(k.sources) s group by s
```

| Fonte | Keywords | Afirmado no briefing |
|---|---:|---|
| `google_places` | 119 | 119 ✓ |
| `whatsapp_group` | 46 | 46 ✓ |
| `web` | 22 | 22 ✓ |
| **Total** | **187** | **187 ✓** |

### Componentes

- **Adapters + registry** — ✅ FUNCIONAL. `ADAPTERS` em `supabase/functions/discovery-run/index.ts:19`. Três sources mapeadas para actors Apify.
- **Dedupe** — ✅ FUNCIONAL. Dois índices únicos parciais: `uq_discovery_canonical` (company_id + canonical_url) e `uq_discovery_extid` (company_id + provider + external_id). Nunca por nome. Bem-feito. Há também dedupe no lote em `discoveryClient.ts:163`.
- **Provenance** — ✅ FUNCIONAL. `provider`, `actor_id`, `actor_version`, `raw_payload` (jsonb), `run_id`, `campaign_id`.
- **Cost tracking** — 🟡 PARCIAL. `prospect_runs.cost_actual_usd` preenchido de `usageTotalUsd` (`discovery-run/index.ts:151`). Custo por *run* sim; por lead ou por venda, não.
- **Review / approval** — 🟡 PARCIAL. Botões aprovar/descartar em `DiscoveryPanel.tsx:300`, que só mudam `status`.
- **Google Places** — 🔵 FOUNDATION. Adapter existe; a função `apify-places` (fluxo antigo) é a que rodou 7 vezes.
- **WhatsApp Groups** — 🔵 FOUNDATION. Adapter existe, 46 keywords prontas, nunca executado.
- **WhatsApp Channels** — 🔵 FOUNDATION. Adapter declarado; nenhuma keyword aponta para essa fonte.

### ⚠️ ACHADO MAIS IMPORTANTE

**A passagem Discovery Result → Prospect/Lead NÃO EXISTE.**

A coluna `discovery_results.converted_prospect_lead_id` está declarada na migration `20260831120000_discovery_intelligence.sql:66` — e uma varredura no repositório inteiro mostra que **nenhuma linha de código jamais escreve nela**. O único lugar que menciona a coluna é a própria migration que a criou.

A aprovação de um resultado muda um texto de `'new'` para `'approved'` e **para ali**. Não é manual nem automática — **não existe**. O Discovery, hoje, é um funil que termina numa parede.

---

## 4. SCORE

**Onde está:** `src/lib/discoveryClient.ts:117`, função `scoreResult`. Roda **no navegador**, no momento da importação; grava em `discovery_results.score` e `score_factors`.

**É determinístico e não usa LLM.** Sete fatores somados, teto em 100:

| Fator | Peso | O que realmente mede |
|---|---:|---|
| `keyword_match` | 20 | A primeira palavra da keyword aparece no título/descrição |
| `niche` | 20 | Bate com lista fixa de 13 radicais (*caf, represent, padaria, atacad…*) |
| `region` | 15 | País do resultado = país pedido |
| `has_description` | 15 | Tem descrição |
| `public_size` | 10 | Tem contagem de membros > 0 |
| `has_url` | 10 | Tem URL |
| `completeness` | 10 | Tem título + URL + (descrição ou tamanho) |

### A distinção que importa

Dos 100 pontos, **35 medem apenas se o registro está completo** (`has_description`, `has_url`, `completeness`) e mais 15 medem se o país bate — praticamente constante numa busca nacional. Só **40 pontos** tentam medir aderência ao nicho, e por casamento de substring.

**Resposta direta: o score mede qualidade/completude do discovery result, não probabilidade de oportunidade comercial.** Um grupo de WhatsApp lotado, bem descrito e com "café" no nome pontua alto mesmo sendo de consumidores domésticos. Um mercadinho com cadastro pobre pontua baixo mesmo sendo o cliente ideal.

**Não há testes.** E, decisivamente: **o score não influencia nenhuma decisão real da aplicação**. Vira só um rótulo Alta/Média/Baixa em `priorityLabel` (`discoveryClient.ts:130`), lido por um humano numa tabela. Nada é roteado, priorizado, filtrado ou automatizado por ele.

---

## 5. REPCO INTEL

**Resposta precisa: RepCo Intel não existe como motor. Existe como uma página de relatórios sobre cinco views SQL.**

`src/pages/RepCoIntelligence.tsx` faz exatamente cinco leituras — `vw_repco_vendas_por_area`, `_por_linha`, `_por_canal`, `_por_rep` e `vw_repco_preco_praticado`. São agregações `GROUP BY`. É **Business Intelligence descritivo**, competente e honesto — mas não é um motor de inteligência.

| Componente procurado | Status | Evidência |
|---|---|---|
| Recommendation engine | ❌ NÃO EXISTE | Nenhuma tabela, nenhum serviço |
| Decision service | ❌ NÃO EXISTE | — |
| Analytics | ✅ FUNCIONAL | 5 views + `vw_ruptura_*` (5 views) |
| AI orchestration | ❌ NÃO EXISTE | 2 chamadas diretas de LLM no Studio |
| Prompts / models | 🟡 PARCIAL | Prompt **hardcoded** em `process-studio-video/index.ts:12` — não há tabela de prompts |
| Feedback loop | ❌ NÃO EXISTE | Nada realimenta modelo, regra ou peso |
| Event tracking | 🟡 PARCIAL | `site_visits` (600), `edge_logs` (111), `promoter_audit_log`, `network_audit_log`, `delivery_dispatch_audit` — silos separados |
| Experiments / A-B | ❌ NÃO EXISTE | — |
| Regras de decisão | 🟡 PARCIAL | Regras determinísticas no banco (comissão, frete, FIFO, ruptura) — regras de negócio, não inteligência |

**A cadeia DADO → INTELIGÊNCIA → RECOMENDAÇÃO → AÇÃO hoje:** DADO existe e é bem estruturado. INTELIGÊNCIA para em agregação descritiva. RECOMENDAÇÃO não existe em nenhum ponto. AÇÃO é 100% humana. **A cadeia quebra no terceiro elo, e nunca foi construída além dele.**

Não vou chamar as views de "IA". Elas são SQL bem escrito e valem mais que muita IA — mas nomeá-las errado é o começo de um autoengano caro.

---

## 6. LOOP DE APRENDIZADO

| Loop | Mensurável? | Onde quebra |
|---|---|---|
| keyword → discovery → aprovação → lead → contato → oportunidade → venda | ❌ Não | Quebra em **dois** pontos: `converted_prospect_lead_id` nunca é escrito; e não existe "contato" nem "oportunidade" como entidade. O elo mais longo da estratégia é o mais roto |
| prospect_lead → cliente | 🟡 Parcial | `promoteProspects.ts` deduplica por CNPJ ao *criar* a lista, mas o cliente promovido não guarda ponteiro para o lead de origem |
| campanha → criativo → visita → conversão → venda | ❌ Não | `studio_campaigns` (5) não tem FK para pedido, visita ou receita |
| creator → conteúdo → clique → pedido → margem | ❌ Não | **Não existe tabela de creator nem de affiliate** |
| produto → avaliação → recompra | ❌ Não | Não há tabela de reviews |
| visita do promotor → ruptura → reposição → venda | 🟡 Parcial | **O loop mais bem construído do sistema.** `promoter_visits` → `promoter_incidents` → `vw_ruptura_by_*` → `open_ruptura_chat`. Falta só o elo final |
| pedido → entrega → POD → custo real | 🟡 Parcial | `delivery_stops` liga pedido e parada. Custo real de rota não é capturado |
| frete cotado → cobrado → pago | 🟡 Parcial | `shipping_quotes` (704) + `orders.shipping_cost`. O que a transportadora *fatura* não entra — a margem real de frete é invisível |

### IDs que faltam para fechar os loops

- `prospect_leads.discovery_result_id`
- `representative_clients.prospect_lead_id`
- Uma entidade *interaction / activity* (contato, ligação, visita comercial)
- Uma entidade *opportunity* com estágio e valor
- `orders.campaign_id` / `utm_*`
- `orders.creator_id` + tabela `creators`
- `promoter_incidents.resolved_by_order_id`

---

## 7. SAPORINO STUDIO

| Capacidade | Status | Evidência |
|---|---|---|
| Import de concorrente | ✅ FUNCIONAL | `studio-import-instagram`, `VideoDropzone.tsx` — 5 vídeos |
| Transcrição | ✅ FUNCIONAL | Whisper (`OPENAI_API_KEY`), limite 25 MB |
| Análise criativa | ✅ FUNCIONAL | Claude (`ANTHROPIC_API_KEY`); `studio_analyses` — 5 |
| Geração de prompt | ✅ FUNCIONAL | `PromptCard.tsx`; tokens literais de asset oficial obrigatórios |
| Criação de campanha | ✅ FUNCIONAL | `studio_campaigns` — 5 |
| Legenda assistida + verificação | ✅ FUNCIONAL | `studio-caption`, `CampaignCreator.tsx:68` |
| Publicação Instagram | ✅ FUNCIONAL | `publish-instagram` + cron a cada 30 min |
| Publicação TikTok | 🟡 PARCIAL | Publica em rascunho |
| Agendamento | ✅ FUNCIONAL | Cron `studio-publish-scheduled` a cada 5 min |
| Similaridade / originalidade | 🟡 PARCIAL | **Só via prompt.** Sem embedding, distância vetorial ou métrica |
| Análise de comentários | ❌ NÃO EXISTE | Ideia registrada, sem código |

### "Extrair princípio, nunca execução" — que tipo de regra é?

**É regra de prompt, com estrutura de saída que a torna auditável — mas não é regra técnica nem validação.**

O prompt em `process-studio-video/index.ts:12` codifica a filosofia em cinco passos obrigatórios, e o modelo é forçado a devolver campos que provam o raciocínio: `creative_principle` (o princípio em uma frase), `do_not_copy` (execução proibida), `originality_changes` (mínimo de **4** dimensões alteradas), `claims_used` (só com origem `approved_guardrail`) e `suggestions_not_facts`.

Isso é mais forte que uma diretriz humana: a estrutura obriga a explicitar. Mas **nada no código verifica se o modelo obedeceu**. Se devolver `originality_changes` com dois itens, o sistema aceita. A única barreira dura é a exigência do *token literal* de asset oficial — e mesmo essa é instrução, não validação de string.

| Classificação | |
|---|---|
| REGRA DE PROMPT | ✅ Sim, e bem escrita |
| REGRA DE VALIDAÇÃO | ❌ Não |
| REGRA TÉCNICA | ❌ Não |

Transformar os campos obrigatórios em validação real é barato (checar `length >= 4` e presença de token) e elevaria a filosofia de intenção para garantia.

---

## 8. BRAND GUARDRAILS

**Fonte central: existe uma, e é boa.** `studio_brand_profiles.guardrails`, JSONB, por empresa (2 perfis). Lida por `process-studio-video` e `studio-caption`, editada em `BrandProfile.tsx`.

Três fragilidades reais:

1. **Editada como texto JSON livre.** `BrandProfile.tsx:20` é um `<textarea>` com `JSON.parse`. Sem schema, sem validação, sem versão, sem histórico. Um erro de digitação silencioso muda a política de marca de toda a IA.
2. **Parte das regras não está nos guardrails — está no prompt.** A regra regional (Minas / mineiro / Cerrado Mineiro exigem aprovação) está **hardcoded** no `SYSTEM_PROMPT`, não no JSON da marca. Dois lugares, e só um é editável pela empresa.
3. **Não há aprovação nem quem-aprovou.** `suggestions_not_facts` marca o que precisa de aprovação, mas não existe fila, estado ou registro.

**Duplicação:** as regras de marca aparecem em (a) `studio_brand_profiles.guardrails`, (b) system prompt de `process-studio-video`, (c) prompt de `studio-caption`, (d) tokens de design em `CLAUDE.md §10`. Quatro lugares, nenhuma sincronização.

---

## 9. AI.BOT

**❌ NÃO EXISTE — nem como protótipo.**

Varredura por `ai.bot`, `aibot` e `autonomy_policy` em `src/`, `supabase/` e `docs/` retornou **um único arquivo**: `docs/specs/SAPORINO_AI_BOT_MASTER_SPEC_COMPLETO_V4.md`, com **3.822 linhas**. Zero linhas de implementação.

| Item | Status |
|---|---|
| Canais de atendimento | ❌ NÃO EXISTE |
| Memória de conversa com cliente | ❌ NÃO EXISTE |
| Tools / ações executáveis | ❌ NÃO EXISTE |
| `AUTONOMY_POLICY` | ❌ NÃO EXISTE — nenhuma ocorrência no código |
| Aprovação humana | ❌ NÃO EXISTE |

**Cuidado com uma confusão fácil:** existe um sistema de chat funcional (`chat_conversations`, `chat_messages`, 6 RPCs, Realtime). É **chat interno entre admin e representantes** — a primeira linha de `src/lib/chat.ts` diz isso literalmente. Não é atendimento a cliente e não tem IA.

O AI.Bot não realiza trabalho comercial, não recomenda nada, não executa nada. Não é foundation nem protótipo — **é especificação**.

---

## 10. E-COHUB

**❌ NÃO EXISTE como aplicação ou módulo. 2.366 linhas de especificação, zero de código.**

| Marketplace | Status | O que existe de fato |
|---|---|---|
| TikTok Shop | ❌ NÃO EXISTE | Há OAuth e publicação de *conteúdo* (Studio). Nada de Shop, catálogo ou pedido |
| Mercado Livre | ❌ NÃO EXISTE | Só *segmento de preço* B2B (`ML`) em `src/constants/segments.ts` e scraping de concorrente |
| Shopee | ❌ NÃO EXISTE | Idem — segmento `SH` |
| Amazon | ❌ NÃO EXISTE | Idem — segmento `AZ` |
| Site próprio | ✅ FUNCIONAL | Checkout completo: Mercado Pago, frete real, cupom, estoque |

Dos itens listados (listings, catalog, channel mapping, orders, pricing, promotions, stock sync, shipping, cancellation, refunds, marketplace fees, reconciliation), existem **quatro**, e só para o site próprio: *pricing* (`price_lists` + `promotional_price`), *orders* (`orders`), *shipping* (tabela COFICO + SuperFrete) e *refunds* (`mp-refund`, `payment_refunds`) — mais *reconciliation* parcial de pagamento em `mp-reconcile`.

**Não existe listing, channel mapping, stock sync nem marketplace fee.**

A tabela `marketplace_stores` existe com **0 linhas** — criada para oferecer "compre em outro lugar" quando o CEP não é atendido, nunca preenchida. Hoje, cliente fora da área recebe tela vazia.

---

## 11. PRODUTO / VARIANT / SKU / KIT / LISTING

O sistema **não** diferencia essas cinco camadas. Existe **uma tabela só**: `products`, com 33 colunas e 14 linhas.

| Conceito | Como está modelado | Risco |
|---|---|---|
| PRODUCT | Linha em `products` | — |
| VARIANT | ❌ Não existe — peso é coluna (`weight_grams`), não variante | Médio |
| SKU | Coluna `sku` livre, sem unicidade. **9 dos 14 produtos têm SKU nulo** | Alto |
| KIT | Linha na *mesma* tabela, com `kit_of_product_id` + `kit_quantity` | Baixo — bem resolvido |
| LISTING | ❌ Não existe — `sales_channels` é um array na própria linha do produto | Alto |

### Riscos concretos

- **SKU = listing: sim, e é o risco principal.** Sem tabela de listing, cada marketplace precisará de preço, título, foto e estoque próprios — e não há onde guardá-los. Hoje isso caberia como mais colunas em `products`, que é o caminho errado.
- **Produto = estoque: parcialmente, e bem tratado.** `products.stock` é *derivado* por trigger de `green_coffee_lots`. Nunca escrito diretamente. Correto.
- **Kit com estoque próprio: NÃO — e é um acerto real.** `consume_stock_fifo` traduz o kit para o café-base *dentro da própria função*, com comentário explicando: "para que ninguém esqueça de multiplicar num canal novo". Disponibilidade calculada na view `products_com_disponibilidade`.
- **Duplicação de produto encontrada.** "Café Canaan Extra Forte" aparece **duas vezes** em `products`, ambas inativas, ambas sem SKU.
- **Sem identificador canônico por canal.** Não há mapeamento "nosso SKU ↔ ID no ML ↔ ID na Shopee". No dia da primeira integração, vira o gargalo.

---

## 12. INVENTORY CORE

**Hoje a fonte da verdade de estoque é a tabela `green_coffee_lots` no Postgres do Supabase, consumida exclusivamente pela função `consume_stock_fifo`.** Existe uma fonte única, e ela é respeitada.

Este é **o pedaço de arquitetura mais bem resolvido do sistema inteiro**. A regra "todo canal desce pela mesma função, e o kit é traduzido lá dentro" é a defesa certa contra o problema clássico de multicanal.

| Conceito | Status | Evidência |
|---|---|---|
| stock | ✅ FUNCIONAL | `products.stock` derivado por `update_product_stock_from_lots` |
| movement | ✅ FUNCIONAL | `stock_movements` — 5 movimentos |
| allocation (FIFO) | ✅ FUNCIONAL | `consume_stock_fifo`, por `production_date` |
| devolução | ✅ FUNCIONAL | `return_stock_on_order_cancelled`, `repco_return_stock_on_cancel` |
| adjustment / reconciliation | 🟡 PARCIAL | Migration `20260908142000`; sem tela de ajuste manual |
| alertas | ✅ FUNCIONAL | `vw_estoque_alertas` |
| **reserved stock** | ❌ NÃO EXISTE | **Não há reserva de carrinho.** Duas pessoas podem comprar o último fardo |
| **warehouse** | ❌ NÃO EXISTE | Um único depósito implícito |

**Consequência:** a ausência de *reserved stock* é irrelevante com 4 pedidos e vira crítica no primeiro pico ou na primeira integração de marketplace — porque o marketplace vende sem perguntar.

---

## 13. SITE SAPORINO

SPA com 27 rotas declaradas em `src/App.tsx:150-224`, mais o 404.

### O que está pronto de verdade

- **Checkout completo e correto** — preço no servidor (`_shared/pricing.ts`, com testes), frete real com cotação congelada, CPF, cupom, guest checkout, verificação de estoque no servidor.
- **Frete** — tabela COFICO com **33.150** faixas de CEP e 441 tarifas, mais SuperFrete ao vivo. 704 cotações congeladas.
- **E-mails transacionais** — `order_emails` com idempotência por reserva-antes-de-enviar; hook de auth com marca por domínio.
- **SEO básico** — `sitemap.xml` e `robots.txt` para os dois domínios; JSON-LD no prerender (`scripts/prerender-seo.mjs:73`).
- **Rastreio** — `sync-tracking` a cada 6 h; `/rastrear` e `/meu-pedido/:token` com token público hasheado.

### Buracos concretos

- **Analytics é cego a receita.** GA4 instalado em `index.html:27`, mas varredura por `gtag(` em todo o `src/` retorna **zero ocorrências**. Sem `view_item`, `add_to_cart`, `begin_checkout` nem `purchase`. O site conta visitas e não sabe atribuir uma única venda.
- **Sem Meta Pixel** — impossível remarketing ou otimização por conversão.
- **Sem busca de produto** — com 5 SKUs ativos ainda não dói.
- **Sem avaliações** — nenhuma prova social na página de produto.
- **"Minha conta" incompleta** — `user_addresses` com **0 linhas** e sem tela.
- **Captura de lead fraca** — `marketing_contacts` 4 linhas; `b2b_leads` 1. O popup existe, o funil não.
- **Peso das imagens** — PNGs de ~1,8 MB em `/public`; sem WebP.
- **Zero integração com o RepCo** — lead B2B do site não vira cliente, tarefa ou notificação.

### Avaliação estratégica (0–10)

| Critério | Nota | Justificativa |
|---|---:|---|
| Site bonito | **8** | HERO de abertura, identidade consistente, tokens documentados. Perde por peso de imagem e bugs de navegação |
| Apresentação institucional | **8** | História, marcas, marca própria, café cru, trabalhe conosco, políticas completas |
| Máquina de gerar demanda | **2** | Sem blog, SEO de conteúdo, captura funcional, remarketing ou pixel. O site espera visita; não a produz |
| Máquina de vender | **6** | O caminho da compra é sólido. Perde por não ter busca, prova social, recuperação de carrinho, "minha conta" |
| Máquina de capturar inteligência | **2** | `site_visits` guarda 600 visitas por IP próprio; GA4 não emite eventos; nada liga visita a pedido |

---

## 14. COFICO / CASA COFICO

| Frente | Status | Evidência |
|---|---|---|
| COFICO institucional | ✅ FUNCIONAL | Domínio próprio, `src/pages/coficobrasil/` (9 componentes), OG e sitemap próprios |
| Casa COFICO (canal) | 🟡 PARCIAL | `orders.channel = 'casa-cofico'`, `vw_cofico_vitrine`, `distributed_brands` |
| COFICO logística | 🟡 PARCIAL | `drivers`, `fleet_vehicles`, `delivery_routes`, `cofico_dispatch_route`, 4 telas admin. **1 rota, 2 paradas** |
| COFICO transportadora | ✅ FUNCIONAL | Tabela de frete própria — 33.150 faixas, 441 tarifas, 4 cobranças |
| COFICO B2B | 🔵 FOUNDATION | `companies` (3), `seller_company_id` no pedido, credencial MP por empresa |
| Marcas distribuídas | 🟡 PARCIAL | `distributed_brands`, `BrandPage.tsx` com 2 `TODO` de arte pendente |

### Mistura de identidade

A separação *marca × vendedor × faturador* está **bem resolvida no banco**: `products.company_id` é o dono da marca, `sales_channels` é quem vende, `orders.seller_company_id` é quem fatura e recebe — com credencial MP por empresa (`create-payment/index.ts:134`). Isso é maduro.

A mistura está **no código**: as duas marcas moram no mesmo bundle React e a decisão de qual home mostrar é um `if` sobre `window.location.hostname` (`App.tsx:216`). **Toda mudança na Saporino faz deploy na COFICO**, e vice-versa. Dívida aceitável hoje, ruim no dia em que a COFICO tiver operação própria.

---

## 15. BANCO DE DADOS

**113 tabelas, todas com RLS ligada.**

| Domínio | Tabelas principais | Linhas |
|---|---|---:|
| Identidade | `user_profiles` / `user_roles` / `roles` | 5 / 4 / — |
| Clientes B2B | `representative_clients` | 7 |
| Contas comerciais | `commercial_accounts` / `network_entities` | 0 / 0 |
| Leads | `prospect_leads` / `prospects_b2b` / `b2b_leads` / `marketing_contacts` | 228 / 758.929 / 1 / 4 |
| Discovery | `discovery_keywords` / `_campaigns` / `_results` | 187 / 0 / 0 |
| Produtos | `products` (kits inclusos) | 14 |
| Estoque | `green_coffee_lots` / `stock_movements` / `lot_transfers` | 2 / 5 / — |
| Preço | `price_lists` | 3 |
| Pedidos B2C | `orders` / `order_items` | 4 / 4 |
| Pedidos B2B | `representative_orders` / `_items` / `_installments` | 3 / 2 / 2 |
| Comissão | `representative_commissions` / `_payouts` | 2 / 1 |
| Logística | `shipping_coverage` / `shipping_rates` / `shipping_quotes` / `delivery_routes` | 33.150 / 441 / 704 / 1 |
| Campanhas / criativos | `studio_campaigns` / `studio_videos` / `studio_analyses` | 5 / 5 / 5 |
| Concorrentes | `ecommerce_price_snapshots` / `ecommerce_sources` | 5.451 / 16 |
| Promotor | 11 tabelas `promoter_*` | 1 visita |
| Coffee Network | 7 `coffee_*` + 5 `network_*` | 0 |
| Marketplaces | `marketplace_stores` | 0 |
| Creators / afiliados | — | **não existe** |

### A) Tabelas que duplicam conceitos

- **Pedido em duas tabelas** — `orders` e `representative_orders`, com numeração, RLS e triggers próprios. Duplicação estrutural mais cara do sistema.
- **Lead em quatro tabelas** — `prospect_leads`, `prospects_b2b`, `b2b_leads`, `marketing_contacts`. Nenhuma se conhece.
- **Cliente em quatro lugares** — `representative_clients`, `commercial_accounts`/`network_entities`, `user_profiles`, e os dados desnormalizados dentro de `orders`.
- **Rota em duas famílias** — `routes`/`route_stops`/`representative_routes` (RepCo) e `delivery_routes`/`delivery_stops` (COFICO), mais `promoter_routes`.

### B) Tabelas órfãs / sem uso (0 linhas)

`commercial_accounts`, `network_entities`, `network_entity_roles`, `network_properties`, `network_roles`, `coffee_offers`, `coffee_matches`, `coffee_purchase_requests`, `coffee_offer_photos`, `coffee_pilot_cases`, `coffee_bebida_scale`, `marketplace_stores`, `user_addresses`, `shipments`, `subscriptions`.

### C) Planejadas e não usadas

Todo o subsistema **Coffee Network** (12 tabelas, 4 migrations, 4 funções de match, 3 views com *contact shield*) e todo o subsistema **Promotor** (11 tabelas, 1 visita registrada).

### D) Relacionamento importante faltando

- `orders` não tem `customer_id` — não há entidade cliente para B2C
- `discovery_results` → `prospect_leads`: coluna existe, ninguém escreve
- `prospect_leads` → `representative_clients`: sem ponteiro
- `orders` ↔ `representative_clients`: sem ligação, mesmo para o mesmo CNPJ
- `studio_campaigns` → receita: sem ligação

### E) Inconsistência de IDs

O cliente é identificado por `user_id` (auth) no B2C, por `id` próprio no RepCo, por `entity_id` no Coffee Network, e por **CPF em texto** no checkout de convidado. Quatro identificadores para a mesma pessoa física.

---

## 16. FONTE DA VERDADE

| Domínio | Fonte da verdade hoje | Quem copia | Risco | Recomendação |
|---|---|---|---|---|
| **Cliente** | ☠️ Nenhuma — 4 fontes paralelas | orders (texto), representative_clients, network_entities, user_profiles | **Crítico** | Criar `customers` canônico; ligar por CPF/CNPJ; manter os 4 como perfis |
| **Lead** | ☠️ Nenhuma — 4 tabelas | prospect_leads, prospects_b2b, b2b_leads, marketing_contacts | Alto | Unificar em `leads` com `source` |
| **Produto** | `products` | — | Baixo | Preservar. Separar *listing* antes do 1º marketplace |
| **SKU** | `products.sku` (9 de 14 nulos) | — | Alto | Tornar obrigatório e único antes de qualquer integração |
| **Preço** | Servidor: `_shared/pricing.ts` + `price_lists` | Vitrine lê a view (derivada) | Baixo | Preservar — é um acerto, e tem teste |
| **Estoque** | `green_coffee_lots` via `consume_stock_fifo` | `products.stock` (derivado) | Baixo | Preservar. Adicionar reserva antes de escalar |
| **Pedido** | 🟡 Duas — `orders` e `representative_orders` | Views leem só a de RepCo | Alto | View unificada de vendas antes de decidir por dado |
| **Campanha** | `studio_campaigns` | — | Médio | Ligar a receita, senão morre como enfeite |
| **Criativo** | `studio_videos` + `studio_analyses` | — | Baixo | Preservar |
| **Concorrente** | `ecommerce_price_snapshots` (5.451) | — | Baixo | Ativo subutilizado |
| **Logística** | `shipping_rate_tables` + `cotar_frete` | Congelado em `shipping_quotes` (correto) | Baixo | Preservar. Rebasear zonas em Várzea |
| **Comissão** | Banco: `calculate_repco_commission` | — | Baixo | Preservar — cálculo no banco é a decisão certa |
| **Creator** | ❌ Não existe | — | — | Só criar quando houver creator real |
| **Affiliate** | ❌ Não existe | — | — | Idem |

---

## 17. INTEGRAÇÕES EXTERNAS

Levantadas pelos nomes de variável de ambiente usados nas edge functions. Nenhum valor exposto.

| Integração | Status | Evidência |
|---|---|---|
| Supabase | ✅ Funcionando | Base de tudo |
| Mercado Pago | ✅ Funcionando | Credencial **por empresa** em `companies`; `create-payment`, `mercadopago-webhook`, `mp-refund`, `mp-reconcile` |
| Resend | ✅ Funcionando | `RESEND_API_KEY`; hook de auth com `SEND_EMAIL_HOOK_SECRET` (Standard Webhooks) |
| SuperFrete | ✅ Funcionando | `SUPERFRETE_TOKEN`; 704 cotações congeladas |
| Telegram | ✅ Funcionando | `TELEGRAM_BOT_TOKEN`; `telegram_recipients` |
| OpenAI | ✅ Funcionando | Whisper em `process-studio-video` |
| Anthropic | ✅ Funcionando | Análise criativa e legenda |
| Instagram / Meta | ✅ Funcionando | OAuth + publicação + refresh a cada 30 min |
| TikTok | 🟡 Parcial | OAuth e refresh OK; publicação só em rascunho |
| Apify | 🟡 Parcial | `APIFY_TOKEN`; 7 runs no fluxo antigo, 0 no Discovery |
| Google Places | 🟡 Parcial | Via Apify, não pela API direta |
| ViaCEP + BrasilAPI | ✅ Funcionando | Busca de endereço com dois provedores |
| CEPEA | ✅ Funcionando | Cron diário; `coffee_market_index` (36) |
| Correios / Loggi / Jadlog / J&T | ✅ Funcionando | Via SuperFrete |
| WhatsApp (Meta API) | ❌ Inexistente | Nenhuma credencial, nenhum código |
| Bling / ERP | ❌ Inexistente | — |
| Mercado Livre / Shopee / Amazon / TikTok Shop | ❌ Inexistente | — |
| Stripe | ❌ Inexistente | — |
| Total Express / BBM / Rodonaves | ❌ Inexistente | `shipping_carriers` tem 4 linhas com campos de API vazios |

---

## 18. CUSTOS DE INFRAESTRUTURA / IA

| Capacidade | Status | Onde |
|---|---|---|
| Custo por run (Apify) | ✅ Existe | `prospect_runs.cost_actual_usd`, de `usageTotalUsd` |
| Custo por source | 🟡 Derivável | Soma por `source_type` — não há tela |
| **Custo de LLM / tokens** | ❌ Não existe | Nenhuma chamada registra *usage*. Whisper e Claude rodam sem contabilidade |
| Custo de enriquecimento | ❌ Não existe | — |
| Custo de infra | ❌ Não existe | Só nos painéis dos fornecedores |
| Receita por origem | ❌ Não existe | Sem atribuição (§13) |

**Quão longe estamos de "custo de inteligência → resultado comercial": muito longe, e a distância não é técnica — é de ligação.** Existe metade esquerda da conta (custo por run) e não existe a metade direita (receita atribuída). Ainda que ambas existissem, **não há caminho de dados entre um discovery e uma venda** — porque o elo Discovery→Lead não existe (§3) e o elo Venda→Origem também não (§13). Hoje é impossível responder "quanto custou o cliente que comprou". A IA do Studio roda com custo **completamente invisível**.

---

## 19. OBSERVABILIDADE

| Capacidade | Status | Evidência |
|---|---|---|
| Logs de edge function | 🟡 Parcial | `edge_logs` — 111 linhas; nem toda função escreve |
| Rate limiting | ✅ Funcional | `check_rate_limit`, `edge_rate_limits` (85) |
| Audit trail — promotor | ✅ Funcional | `promoter_audit_log` |
| Audit trail — despacho | ✅ Funcional | `delivery_dispatch_audit` + imutabilidade por trigger |
| Audit trail — rede | ✅ Funcional | `network_audit_log` |
| **Audit trail — pedido** | ❌ Não existe | Sem histórico de alteração |
| Audit trail — preço e estoque | 🟡 Parcial | `stock_movements` registra movimento; preço não tem histórico |
| Retries | ❌ Não existe | Nenhuma fila, backoff ou DLQ |
| Monitoring / alerta | ❌ Não existe | Só o Telegram de pedido novo |
| Limpeza de storage | ✅ Funcional | `storage_orphans`, `storage_cleanup_log` |

**Se amanhã uma automação tomar uma decisão errada, você descobre parcialmente — depende de qual automação:**

- **Despacho de rota, visita de promotor, oferta na rede:** sim — quem, o quê, quando.
- **Cotação de frete:** sim, e bem — `shipping_quotes` congela o preço mostrado com validade, e o servidor reconfere.
- **Preço cobrado num pedido:** parcialmente — sabe-se quanto, não com base em qual regra.
- **Análise ou legenda gerada por IA: NÃO.** Não se registra modelo, versão do prompt, tokens nem custo. Se o Claude gerar uma legenda que viola a marca, **não há como saber com qual prompt e com quais guardrails aquilo foi gerado** — porque o prompt é hardcoded e muda a cada deploy, sem versão.

---

## 20. SEGURANÇA / GOVERNANÇA

**O fundamento está bom:** RLS ligada em **113 de 113** tabelas. Duas tabelas têm RLS sem policy (`edge_rate_limits`, `representative_company_settings`) — nega tudo para quem não é `service_role`: falha fechada, lado certo de errar (mas vale conferir se a segunda não quebrou uma tela).

### 🔴 ACHADO CRÍTICO — respondendo exatamente à pergunta

**Sim. Um representante autenticado pode ler o custo interno — e pode alterá-lo.**

A tabela `lot_transfers` guarda a cadeia de custo do café (`unit_cost_brl`, `value_amount_brl`, `kg_amount`). Suas policies:

| Policy | Comando | Expressão |
|---|---|---|
| `authenticated_read` | SELECT | `USING (true)` |
| `authenticated_insert` | INSERT | `WITH CHECK (true)` |
| `authenticated_update` | UPDATE | `USING (true)` |
| `authenticated_delete` | DELETE | `USING (true)` |

Sem `is_admin()`, sem `company_id`, sem restrição nenhuma. Qualquer usuário logado — representante, promotor, motorista ou cliente B2C com conta — pode **ler, alterar e apagar** a contabilidade de custo do café. Compare com `green_coffee_lots`, corretamente protegida por `is_admin()`: a tabela irmã ficou aberta.

**Impacto:** vazamento de margem para a força de vendas e, pior, escrita destrutiva sobre a base de custo que alimenta `calculate_batch_costs`. Não corrigido nesta rodada porque é auditoria de leitura. É o item mais urgente do documento.

### O que está bem feito

`is_admin()` e `my_rep_id()` como `SECURITY DEFINER`; RBAC com `has_role`; pedido público por **hash** de token (`order_public_token_hash`, nunca o token em claro); *contact shield* nas views do Coffee Network; `can_access_invoice_file` para storage. A postura geral é séria — `lot_transfers` é a exceção, não a regra.

**Separação multi-tenant:** `company_id` existe nas tabelas core, mas a RLS **não isola por empresa** — decisão consciente e registrada (hoje todas as empresas têm o mesmo dono). Vira bloqueador absoluto no dia da primeira venda do RepCo como SaaS.

---

## 21. TESTES

**Três arquivos de teste. 37 casos. Em ~42 mil linhas de código.**

| Área crítica | Tem teste? | Evidência |
|---|---|---|
| Pricing | ✅ Sim | `_shared/pricing.test.ts` — 9 casos |
| Webhook de pagamento | ✅ Sim | `_shared/mpWebhook.test.ts` — 10 casos |
| Match de lead | ✅ Sim | `src/lib/leadMatch.test.ts` — 18 casos |
| **Estoque / FIFO** | ❌ Não | Uma regressão nesta função já quase quebrou toda baixa de estoque |
| **Comissão** | ❌ Não | 4 regras compostas e teto de 8%, sem um único teste |
| **Frete** | ❌ Não | `cotar_frete`: faixas, adicional, seguro, GRIS, pedágio, TAS — nenhum teste |
| Discovery / score / dedupe | ❌ Não | — |
| Permissões (RLS) | ❌ Não | Nenhum teste com JWT real — foi assim que `lot_transfers` passou despercebida |
| Marketplace sync | — | Não há o que testar |

**As três zonas críticas sem teste são comissão, frete e estoque** — exatamente as três que movimentam dinheiro e são calculadas no banco, onde `typecheck` e `build` não enxergam nada.

---

## 22. CÓDIGO DUPLICADO / CÉREBROS DUPLICADOS

| Domínio | Duplicação | Gravidade |
|---|---|---|
| **Pedido** | `orders` (B2C) e `representative_orders` (B2B). Numeração, RLS, triggers e telas separadas. **E a inteligência só enxerga uma:** `vw_repco_vendas_por_canal` lê exclusivamente `representative_orders` — toda venda do site é invisível para o RepCo Intel | Alta |
| **Cliente** | 4 representações sem chave comum. O mesmo padeiro pode ser `representative_client`, `prospect_lead` e comprador convidado, e o sistema vê três pessoas | Alta |
| **Lead** | 4 tabelas + 2 caminhos de importação (`importApifyLeads.ts`, `promoteProspects.ts`), com dedupe por CNPJ implementado *em cada um* | Média |
| **Marca** | Guardrails no JSONB, regras no prompt do vídeo, regras no prompt da legenda, tokens no CLAUDE.md | Média |
| **Rota** | Três famílias: RepCo, COFICO e Promotor | Média |

### ✅ O que NÃO está duplicado — e merece registro

**Preço e estoque têm cérebro único.** Preço é decidido no servidor por `_shared/pricing.ts` (com teste) e o cliente só exibe. Estoque desce por `consume_stock_fifo` em *todos* os canais, com a tradução de kit dentro da própria função. São os dois domínios onde duplicação costuma matar um e-commerce, e aqui estão certos.

---

## 23. O QUE ESTÁ SUPERCONSTRUÍDO

| Construído | Tamanho | Uso real | Veredito |
|---|---|---|---|
| **Coffee Network** | 12 tabelas, 4 migrations, 4 funções de match, 3 views com contact shield | 0 entidades, 0 ofertas, 0 matches | Sofisticado e sem um único usuário |
| **Módulo Promotor** | 11 tabelas, 8 views, ~909 linhas de UI, GPS e auditoria | 1 promotor, 1 visita | Infra de campo antes de haver campo |
| **Discovery Intelligence** | 3 tabelas, registry de adapters, dedupe por 2 índices, score, painel | 0 campanhas, 0 resultados | Construído inteiro e nunca ligado |
| **COFICO Entregas** | Motoristas, frota, manutenção, documentos, rotas, despacho transacional | 1 rota, 2 paradas | Operação logística antes de haver volume |
| **Base CNPJ** | 758.929 prospects | 228 leads promovidos (0,03%) | Matéria-prima sem linha de produção |
| **Specs E-CoHub + AI.Bot** | 6.188 linhas de documento | 0 linhas de código | Planejamento adiantado à execução |
| **Assinatura B2C** | Tabelas, tela, checkout do 1º ciclo | 0 assinaturas | Recorrência automática nem existe ainda |

**A pergunta "agora versus depois":** nada disso foi desperdício de *pensamento* — o desenho está correto em quase todos. Foi desperdício de *sequência*. Construiu-se a máquina de operar uma escala que ainda não chegou, antes da máquina de produzir a primeira venda repetível. Com 4 pedidos B2C e 3 B2B em produção, o sistema tem capacidade para talvez mil vezes o volume atual.

---

## 24. OS 10 BLOQUEADORES ENTRE O SISTEMA E A VENDA

1. **Ninguém sabe que a loja existe.** Sem pixel, sem evento de conversão, sem campanha ligada a resultado. Sem `purchase` no GA4 e sem Meta Pixel, não dá para comprar tráfego com responsabilidade — e é assim que uma loja nova vende.
2. **Discovery não vira lead.** 187 keywords e 758.929 CNPJs não produzem uma lista de "ligar hoje". O funil termina numa parede.
3. **Não há follow-up.** Sem tarefa, cadência ou lembrete, a venda B2B depende da memória de duas pessoas.
4. **Sem funil.** Não há oportunidade nem estágio: impossível responder "quantos negócios estão abertos e quanto valem".
5. **Catálogo raso.** 14 produtos, 5 ativos, 9 sem SKU, 1 duplicado.
6. **Nenhum marketplace.** Onde o brasileiro procura café — ML, Shopee, Amazon — a Saporino não está. Canal de menor esforço e maior volume, em zero.
7. **Carrinho abandonado não é recuperado.** A base foi construída (`coupons`, `coupon_redemptions`, limpeza automática), o e-mail não foi ligado.
8. **Sem prova social.** Nenhuma avaliação, depoimento ou selo. Café é compra de confiança.
9. **Lead B2B do site não chega a ninguém.** `b2b_leads` tem 1 linha e não notifica representante nem cria tarefa.
10. **Frete caro em SP interior.** A tabela COFICO coloca Ribeirão e Rio Preto acima dos Correios. Onde a COFICO não ganha e o marketplace não existe, a venda não acontece.

---

## 25. OS 10 BURACOS ONDE A INFORMAÇÃO MORRE

1. **Discovery → Lead.** A coluna existe e ninguém escreve. Nunca se saberá qual keyword gerou cliente.
2. **Lead → Cliente.** Sem ponteiro de origem: o cliente nasce órfão de história.
3. **Visita → Venda.** Nada liga a visita ao pedido.
4. **Campanha → Receita.** `studio_campaigns` publica e o rastro acaba no Instagram.
5. **Tráfego → Pedido.** Sem UTM, sem `purchase`, sem atribuição.
6. **Custo de IA → Resultado.** Tokens não são registrados.
7. **Cotação → Custo real de frete.** Sabe-se o que se cobrou, nunca o que se pagou. Margem de frete invisível.
8. **Ruptura → Reposição.** O loop mais bem construído para um passo antes do fim.
9. **Prompt → Saída.** Sem versão de prompt, análises de épocas diferentes são incomparáveis.
10. **Cliente entre canais.** O mesmo CNPJ comprando no site e pelo representante são duas histórias que nunca se encontram.

**O padrão é único e vale nomear: o sistema é excelente capturando eventos e péssimo ligando eventos.** Há audit log em quatro domínios e nenhuma chave estrangeira entre causa e efeito comercial. Isso é captura, não aprendizado.

---

## 26. O QUE FALTA PARA ESCALAR

- **Estoque:** falta reserva. No primeiro pico ou marketplace, vende-se o que não existe.
- **Catálogo:** falta *listing* por canal e SKU obrigatório/único.
- **Logística:** tabela com origem na capital, operação sai de Várzea Paulista. Não cobre PR, SC, RS, MG, GO nem DF.
- **Automação:** não há fila nem retry. Toda edge function é dispara-e-torce.
- **Pricing:** não há preço por canal — e marketplace cobra 12–20% de comissão. Escalar em marketplace sem isso é escalar prejuízo.
- **Financeiro:** sem custo por pedido, sem margem por canal, sem conciliação de repasse.
- **Dados:** sem cliente canônico, todo relatório de LTV, recompra ou coorte é impossível.
- **Sistemas:** `App.tsx` com 2.359 linhas e 55 componentes admin no mesmo bundle — build único para duas marcas.
- **Vendedores:** 2 representantes. O RepCo aguenta cem; a operação comercial ainda não.
- **Observabilidade:** sem alerta, uma edge function quebrada é descoberta pelo cliente.

---

## 27. AUDITORIA DO FOCO

**Sim. Está se construindo coisas demais simultaneamente — e a evidência não é opinião, é a contagem de linhas.**

Existem **sete frentes abertas ao mesmo tempo**: loja B2C, RepCo, Studio, Promotor, COFICO Entregas, Coffee Network e Discovery. Quatro delas têm **zero ou quase zero uso em produção**. Enquanto isso, a coisa que mais aproximaria a empresa de receita — **fazer a loja ser encontrada e medir o que acontece nela** — está em zero.

| Horizonte | O que pertence a ele |
|---|---|
| **AGORA** | Corrigir `lot_transfers` · eventos de e-commerce no GA4 + pixel · Discovery→Lead · lista diária do representante · recuperação de carrinho · primeiro marketplace (1 canal) · testes de comissão e frete |
| **DEPOIS** | Cliente canônico · listing por canal · preço por canal · reserva de estoque · funil e follow-up · avaliações · rebasear zonas de frete em Várzea |
| **MUITO DEPOIS** | AI.Bot · E-CoHub completo · Coffee Network · RLS multi-tenant · RepCo como SaaS · creator/affiliate · scoring preditivo |

---

## 28. GAPS ENTRE VISÃO E REALIDADE

| Capacidade planejada | Status real | Evidência | Gap | Impacto | Depende de |
|---|---|---|---|---|---|
| RepCo (system of record) | ✅ Funcional | 7 clientes, 3 pedidos, comissão no banco | Sem funil e sem follow-up | Receita | Decisão de processo |
| Discovery | 🔵 Foundation | 187 kw / 0 resultados | Nunca rodou; não vira lead | Receita | Saldo Apify + conversão |
| RepCo Intel | 🟡 Parcial | 5 views de agregação | Sem recomendação e cego ao B2C | Dados | View unificada de vendas |
| Studio | ✅ Funcional | 5 análises, IG publica sozinho | Sem métrica de resultado | Margem | Atribuição |
| Brand Guardrails | 🟡 Parcial | JSONB + prompt | Sem validação, schema ou versão | Risco | Baixa — barato de fechar |
| AI.Bot | ❌ Não existe | 3.822 linhas de spec | Total | Experiência | Cliente canônico |
| E-CoHub | ❌ Não existe | 2.366 linhas de spec | Total | Receita | Listing + SKU + estoque |
| Inventory Core | ✅ Funcional | FIFO único por lote | Sem reserva, sem depósito | Escala | Volume |
| Logistics Core | ✅ Funcional | 33.150 faixas, 4 cobranças | Origem errada; sem Sul | Margem | Cotações reais |
| CRM | 🟡 Parcial | Cadastro sim, funil não | Sem oportunidade nem atividade | Receita | Modelagem |
| Site | ✅ Funcional | 27 rotas, checkout completo | Sem tráfego e sem medição | Receita | Marketing |
| Marketplaces | ❌ Não existe | Só segmento de preço | Total | Receita | Listing + SKU |
| Creator Intelligence | ❌ Não existe | Nenhuma tabela | Total | Receita | Atribuição |
| Affiliate | ❌ Não existe | Nenhuma tabela | Total | Receita | Cupom por origem |
| Commission Core | ✅ Funcional | 4 funções no banco | Sem teste | Risco | Baixa |
| Learning Loop | ❌ Não existe | Nenhum loop fechado | Total | Dados | IDs de ligação |

---

## 29. TOP 20 DÍVIDAS E GAPS

| # | Gap | Severidade | Impacto |
|---:|---|---|---|
| 1 | `lot_transfers` aberta a qualquer autenticado, com escrita e exclusão | **CRÍTICO** | Risco · Margem |
| 2 | Sem evento de e-commerce no GA4 e sem pixel — receita não atribuível | **CRÍTICO** | Receita · Dados |
| 3 | Discovery → Lead não existe | **CRÍTICO** | Receita · Dados |
| 4 | Sem cliente canônico — 4 identidades para a mesma pessoa | **CRÍTICO** | Dados · Escala |
| 5 | Comissão, frete e estoque sem teste | **CRÍTICO** | Risco |
| 6 | Pedido em duas tabelas; inteligência cega ao B2C | ALTO | Dados |
| 7 | Sem funil, oportunidade ou follow-up | ALTO | Receita |
| 8 | Nenhum marketplace | ALTO | Receita · Escala |
| 9 | Sem listing por canal nem SKU obrigatório | ALTO | Escala |
| 10 | Sem reserva de estoque | ALTO | Escala · Experiência |
| 11 | Custo de LLM não registrado | ALTO | Margem · Dados |
| 12 | Carrinho abandonado não recuperado | ALTO | Receita |
| 13 | Prompt hardcoded e sem versão | ALTO | Risco · Dados |
| 14 | Guardrails como JSON livre, sem schema | MÉDIO | Risco |
| 15 | Sem retry, fila ou alerta | MÉDIO | Risco · Escala |
| 16 | Sem preço por canal (comissão de marketplace) | MÉDIO | Margem |
| 17 | Tabela de frete com origem na capital, não em Várzea | MÉDIO | Margem |
| 18 | Duas marcas num bundle; `App.tsx` com 2.359 linhas | MÉDIO | Velocidade |
| 19 | 15 tabelas vazias e produto duplicado | BAIXO | Velocidade |
| 20 | Imagens sem WebP (~1,8 MB por PNG) | BAIXO | Experiência |

---

## 30. TOP 10 ATIVOS JÁ CONSTRUÍDOS

1. **Tabela de frete própria com cobertura nacional parcial.** 33.150 faixas de CEP, 441 tarifas, e as quatro cobranças modeladas corretamente (faixa, seguro, GRIS com piso, pedágio por fração). É *propriedade intelectual logística*: permite à COFICO cotar como transportadora, não como revendedora de frete. *Para monetizar:* rebasear em Várzea Paulista com cotações reais.
2. **Estoque único FIFO com tradução de kit.** Todo canal desce pela mesma função. Defesa contra o erro que mais mata e-commerce multicanal. *Falta:* reserva.
3. **Preço decidido no servidor, com teste.** O cliente nunca dita o preço. Base indispensável para marketplace. *Falta:* dimensão de canal.
4. **Motor de comissão no banco.** 4 funções, ciclos, boleto proporcional, teto de 8%. Escala para cem representantes sem mudança. *Falta:* teste.
5. **Studio com filosofia anti-cópia embutida no prompt.** "Extrair princípio, nunca execução" com estrutura de saída auditável e proibição de gerar assets oficiais sinteticamente. *É o ativo mais defensável do portfólio.* *Falta:* validar a saída e medir resultado.
6. **Publicação social automática.** Instagram publica sozinho com refresh de token; agendamento por cron. *Falta:* ligar a receita.
7. **5.451 snapshots de preço de concorrente.** Série temporal real de 16 fontes. Já sustentou a decisão de preço da linha Tropeiro. *Ativo caro de reproduzir e claramente subutilizado.*
8. **RLS em 113 de 113 tabelas + pedido público por hash.** Postura de segurança acima da média para o estágio.
9. **Base CNPJ de 758.929 empresas com geo.** Matéria-prima de prospecção que a maioria dos concorrentes não tem. *Falta:* a linha de produção que transforma isso em ligação.
10. **Loop de ruptura do Promotor.** Visita → incidente → views por cliente/produto/região → chat. Único loop quase fechado. *Falta:* ligar à reposição.

---

## 31. PRIORIDADE 80/20 — CINCO RECOMENDAÇÕES

### 1. Fechar o vazamento de custo

- **Por quê:** qualquer usuário logado lê e apaga a base de custo. Único item que não admite espera.
- **Depende de:** nada.
- **Resultado:** margem deixa de ser visível para a força de vendas.
- **Métrica:** zero policy com `USING (true)` em tabela de custo.
- **Risco:** baixo — checar antes se alguma tela depende da escrita aberta.

### 2. Instrumentar a venda antes de comprar tráfego

- **Por quê:** a loja está pronta e cega. Sem `purchase`, `begin_checkout`, `add_to_cart` e UTM no pedido, todo real gasto em anúncio é aposta sem leitura. Desbloqueia marketing pago, a alavanca mais rápida.
- **Depende de:** nada — o GA4 já está lá.
- **Resultado:** saber de onde veio cada venda.
- **Métrica:** 100% dos pedidos com origem gravada.
- **Risco:** baixo. Cuidado com LGPD no pixel.

### 3. Fechar Discovery → Lead → Lista do dia

- **Por quê:** converte o maior investimento parado (187 keywords + 758.929 CNPJs) em ação comercial. Sem isso, prospecção é hobby.
- **Depende de:** saldo Apify; escrever `converted_prospect_lead_id`; tela de "hoje você fala com estes".
- **Resultado:** o representante abre o RepCo e sabe o que fazer.
- **Métrica:** leads contatados por semana; % de discovery que vira cliente.
- **Risco:** médio — o score atual não prioriza bem; começar por filtro humano, não por score.

### 4. Um marketplace, um só, ligado de verdade

- **Por quê:** é onde o consumidor de café já está procurando. Um canal completo ensina mais que quatro pela metade, e força as fundações certas (listing, SKU único, preço por canal, sync de estoque) sob pressão real.
- **Depende de:** SKU obrigatório; tabela de listing; preço por canal com a comissão embutida.
- **Resultado:** primeira receita de canal externo.
- **Métrica:** pedidos/mês e margem líquida após comissão.
- **Risco:** alto se feito sem reserva de estoque — marketplace vende sem perguntar.

### 5. Testar o que move dinheiro

- **Por quê:** comissão, frete e estoque são calculados no banco, onde `typecheck` e `build` não enxergam. Duas regressões graves nessas áreas já aconteceram e foram pegas por acaso.
- **Depende de:** nada — o vitest já está configurado.
- **Resultado:** mexer em frete e comissão deixa de ser ato de fé.
- **Métrica:** as três áreas com teste antes de qualquer novo módulo.
- **Risco:** nenhum.

---

## 32. O QUE NÃO DEVEMOS FAZER AGORA

1. **AI.Bot.** Um agente comercial sem cliente canônico, sem funil e sem histórico responderia sobre o vazio. A spec continua válida; a hora, não.
2. **E-CoHub completo (4 marketplaces).** Faça um. Quatro integrações simultâneas sem listing nem reserva é multiplicar um problema não resolvido.
3. **RLS multi-tenant.** Trabalho grande, arriscado e sem valor enquanto todas as empresas têm o mesmo dono. Já corretamente adiado — mantenha adiado.
4. **Coffee Network.** 12 tabelas e zero usuários. Congele até haver demanda.
5. **Score preditivo com LLM.** Não há nem um exemplo de "discovery que virou venda" para treinar ou validar. Score preditivo sem histórico é adivinhação cara.
6. **Reescrever `App.tsx` ou separar os bundles.** Dói, mas não impede vender. Faça quando a COFICO tiver time próprio.
7. **Creator / afiliado.** Depende de atribuição, que ainda não existe. Construir agora é criar mais um loop quebrado.
8. **Reativar PWA e Google Play.** Zero impacto em receita hoje.
9. **ERP/Bling.** Com 7 pedidos no total, adicionar uma fonte da verdade fiscal cria o problema que a §16 pede para evitar.
10. **Rastreabilidade "Conheça seu café".** Projeto bonito, alto valor de marca — mas de marca, não de receita. Vale muito mais depois de haver tráfego para vê-lo.

---

## 33. VEREDITO

| Critério | Nota |
|---|---:|
| Arquitetura | **7**/10 |
| Qualidade da fundação | **8**/10 |
| Foco | **3**/10 |
| Prontidão comercial | **4**/10 |
| Prontidão de e-commerce | **6**/10 |
| Prontidão de marketplace | **1**/10 |
| Prontidão de dados | **5**/10 |
| Prontidão de IA | **3**/10 |
| Capacidade de aprendizado | **2**/10 |
| Capacidade de escala | **6**/10 |

*Arquitetura 7* — decisões centrais corretas (preço e estoque no servidor, RLS por padrão, cálculo no banco), mas com duas fontes de verdade em cliente, lead e pedido. *Fundação 8* — o banco é sério. *Foco 3* — sete frentes, quatro sem uso. *Aprendizado 2* — nenhum loop fecha.

### 1. Qual é o ativo tecnológico mais valioso que já construímos?

A **tabela de frete própria da COFICO** — 33.150 faixas de CEP com as quatro cobranças modeladas como uma transportadora modela. Ela permite à COFICO *ser* transportadora, não intermediar frete. É o único item do sistema que um concorrente levaria meses e dinheiro para reproduzir. O Studio com a filosofia anti-cópia é o segundo, e é o mais defensável estrategicamente.

### 2. Qual é o maior buraco da arquitetura hoje?

**Não existe entidade "cliente".** Há quatro representações que não se conhecem. Isso impede CRM real, LTV, recompra, atribuição, AI.Bot e qualquer aprendizado sobre quem compra. Todos os outros buracos são consequência ou são menores que este.

### 3. Qual é o maior risco técnico?

**Comissão, frete e estoque calculados no banco, sem um único teste.** São as três coisas que movem dinheiro, e ficam justamente na camada onde as ferramentas de verificação não olham. Duas regressões graves aí já aconteceram — ambas pegas por sorte, não por processo.

### 4. Qual é o maior risco estratégico?

**Construir a empresa de software antes da empresa de café.** Há 42 mil linhas de código, 113 tabelas e 7 pedidos. O risco não é o software ser ruim — ele é bom. É o software estar pronto para uma operação que ainda não existe, consumindo o tempo que criaria essa operação.

### 5. Qual é o maior desperdício potencial de energia?

As **6.188 linhas de especificação de E-CoHub e AI.Bot** sem uma linha de código, e os **dois subsistemas completos com zero usuários** (Coffee Network, 12 tabelas; Promotor, 11 tabelas). Não é desperdício de pensamento — o desenho é bom. É desperdício de *sequência*.

### 6. O que mais aproxima a empresa de receita hoje?

**Instrumentar a loja e comprar tráfego.** O checkout está pronto, correto e testado. Falta alguém entrar. Instrumentação é trabalho de dias e desbloqueia a única alavanca que produz venda em semanas em vez de trimestres. Em segundo lugar, empatado: **um marketplace**.

### 7. O que mais aproxima a empresa de vantagem competitiva sustentável?

Duas coisas, nesta ordem. **O Studio com a regra anti-cópia**, se a saída passar a ser validada e o resultado medido — porque cria um acervo proprietário de princípios criativos testados que ninguém pode copiar. E **a tabela de frete própria**, se rebaseada em dados reais da operação — porque frete é o custo que define quem consegue vender café online no Brasil.

### 8. Estamos construindo uma empresa melhor ou apenas software sofisticado?

Honestamente: **as duas coisas, com o software na frente.** Há software genuinamente bom aqui — o FIFO de estoque, o preço no servidor, a comissão no banco e a tabela de frete são decisões que empresas muito maiores erram. Mas a proporção fala: 42 mil linhas para 7 pedidos. A empresa melhor *está* sendo construída — falta a operação alcançar o sistema. Duas coisas endireitariam isso: **parar de abrir frentes novas** e **fechar os loops de aprendizado**, porque é o loop fechado que transforma software em empresa que aprende.

### 9. Se você fosse CTO da Saporino, o que faria nos próximos 30 dias?

- **Semana 1:** fechar `lot_transfers`; testes de comissão, frete e FIFO; auditar as outras policies com `USING (true)`.
- **Semana 2:** eventos de e-commerce no GA4, pixel, UTM gravada no pedido; ligar o e-mail de recuperação de carrinho.
- **Semana 3:** fechar Discovery→Lead e entregar a lista diária do representante.
- **Semana 4:** SKU obrigatório e único, tabela de listing, preço por canal — as fundações do primeiro marketplace.

E uma regra durante os 30 dias: **nenhum módulo novo.**

### 10. Se você fosse CEO, o que aceleraria, desaceleraria e congelaria?

- **Acelerar:** tráfego e medição da loja; primeiro marketplace; catálogo (mais SKU vendável); o Studio, que é a única máquina de conteúdo que já roda sozinha.
- **Desacelerar:** COFICO Entregas e Promotor — mantenha vivos, pare de construir até haver volume; Discovery — ligue-o, não o expanda.
- **Congelar:** AI.Bot, E-CoHub completo, Coffee Network, RLS multi-tenant, creator/affiliate, PWA. Todos voltam quando houver receita que os justifique — e todos serão mais fáceis de construir depois, sobre dados reais.

---

*Rodada exclusivamente de leitura. Nenhum arquivo alterado, nenhuma migration criada, nenhum deploy. Números obtidos por consulta direta ao Postgres de produção em 09/09/2026. Onde não consegui confirmar, o documento diz "não confirmado" — e onde algo não existe, diz "não existe".*
