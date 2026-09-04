# REPCO / COFICO — PRE-COFFEE-NETWORK TECHNICAL CHECKPOINT

**Data:** 04/09/2026
**Modo:** READ-ONLY. Nada foi implementado, migrado, deployado ou publicado durante a produção deste documento.
**Escopo:** fotografia técnica do que existe HOJE, com evidência, antes de iniciar o novo core "COFICO Coffee Network".
**Projeto Supabase:** `rsvoazrkxtdrcjnatzcm` · **Repo:** `saporino/website_project` · **Deploy:** Vercel (push em `main`)

> **Regra usada na escrita deste documento:** nada é marcado como PRONTO sem prova executável (query no banco, arquivo no repo, função deployada). Onde só existe **documento**, está escrito **DOCUMENTADO, NÃO IMPLEMENTADO** — documentação não é implementação. Onde não consegui provar, está escrito **NÃO VERIFICADO**.

---

## 🔴 ACHADO CRÍTICO DE SEGURANÇA (fora da ordem, porque bloqueia tudo)

**`public.exec_migration(q text)` e `public.exec_select(q text)` executam SQL arbitrário e estão liberados para o papel `anon`.**

Evidência (consulta ao catálogo do Postgres em produção):

| Função | `prosecdef` (SECURITY DEFINER) | Dono | Dono tem `BYPASSRLS` | `anon` tem EXECUTE | Corpo |
|---|---|---|---|---|---|
| `exec_migration(q text)` | `true` | `postgres` | `true` | `true` | `BEGIN EXECUTE q; END;` |
| `exec_select(q text)` | `true` | `postgres` | `true` | `true` | `EXECUTE 'SELECT ... FROM (' \|\| q \|\| ') t'` |

Verificado por `has_function_privilege('anon','public.exec_migration(text)','EXECUTE')` → `true`.

**Por que isso importa:** a chave `anon` é pública por definição — ela vai no bundle JavaScript servido ao navegador (`src/lib/supabase.ts`). Qualquer pessoa que abra o site pode extraí-la e chamar `rpc('exec_migration', { q: '<qualquer SQL>' })`. Como a função é `SECURITY DEFINER` com dono `postgres` (que tem `BYPASSRLS`), o SQL roda **com privilégio total, ignorando as 85 tabelas com RLS ligada**. Ler, alterar ou apagar qualquer dado do ecossistema — Saporino, Fazendinha e COFICO — está ao alcance de um chamador anônimo.

**Isso anula, na prática, o trabalho de RLS descrito na §9.** Não adianta discutir isolamento multi-tenant enquanto essa porta estiver aberta.

**Fato que torna a correção barata:** nenhum código do produto usa esses RPCs. `grep -rn "exec_select\|exec_migration" src supabase/functions` retorna **zero ocorrências**. Eles são usados apenas pelos meus scripts de manutenção, que autenticam com a `SUPABASE_SERVICE_ROLE_KEY` — e o `service_role` continua funcionando depois de revogar `anon`/`authenticated`/`PUBLIC`.

**Correção proposta (NÃO EXECUTADA — decisão sua):**

```sql
REVOKE EXECUTE ON FUNCTION public.exec_migration(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exec_select(text)    FROM PUBLIC, anon, authenticated;
```

Não rodei porque este ciclo é read-only. **Recomendo tratar como o item nº 1 antes de qualquer linha do Coffee Network.**

---

## §1 — Estado do repositório

**Branch atual:** `cofico-brasil`, sincronizada com `origin/main` (0 à frente, 0 atrás). Último commit: `5c8c18e` — docs do HERO.

**Qualidade do build (rodados agora):**

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` (tsconfig.app.json) | 0 erros |
| `npm run build` | sucesso, prerender SEO por domínio OK |

**Trabalho não commitado (working tree suja):**

- `M src/components/HeroExperience.tsx` — alteração de replay do vídeo do HERO ("opção B": só reinicia se o vídeo terminou **e** o usuário saiu da cena e voltou). Compila e builda, mas **NÃO foi verificada ao vivo** (a pane do Browser estava oculta, o que congela `requestAnimationFrame` e invalida o teste). Está pendente da sua decisão: testar ou publicar.
- `?? docs/governanca/REPCO_COFICO_PENDING_WORK_AUDIT.md` — auditoria de pendências de ontem, deliberadamente não commitada.
- `?? public/carreiras/*` e `?? public/cofico/*` — 15 imagens/PDFs de marca (COFICO, Fazendinha, Horizon, São Felipe) soltos, nunca commitados. **Vários têm espaço no nome** (ex.: `COFICO Quadrado-JPG.jpg`), o que vira 404 na Vercel conforme a regra do próprio CLAUDE.md §11.
- `? website_project` — repositório git aninhado dentro do repositório. Sujeira estrutural, não resolvida.

**Branches paralelas (trabalho estacionado):**

| Branch | Posição vs `origin/main` | Conteúdo | Risco |
|---|---|---|---|
| `fase0-pagamento` | 1 à frente, **44 atrás** | Checkout server-side, lockdown de RLS de `orders`, rate limit de edge, testes | Divergência alta; merge vai doer mais a cada semana |
| `repco-cie` | 1 à frente, **145 atrás** | 18 documentos de planejamento (só docs, sem código) | Praticamente órfã |

---

## §2 — Migrações: o problema mais estrutural do projeto

**Não existe controle de migração.** Consulta ao `information_schema`: as únicas tabelas com nome de migração são `auth.schema_migrations`, `storage.migrations` e `realtime.schema_migrations` — todas internas do Supabase. **Não existe `supabase_migrations.schema_migrations`**, que é a tabela que o CLI usa para saber o que já rodou.

Consequência direta: `supabase db push` e `supabase migration up` **não sabem o estado do banco**. Todo o schema foi aplicado à mão, via `exec_migration`.

**Inventário do diretório:** 67 arquivos em `supabase/migrations/`.

| Categoria | Quantidade |
|---|---|
| Com prefixo de timestamp (formato do CLI) | 48 |
| **Sem timestamp** (nome livre, não ordenável) | **19** |

Os 19 sem timestamp: `bloco6_missing_columns`, `bloco7_triggers`, `bloco8_routes_logistics`, `bloco9_inventory_batches`, `candidaturas_representante`, `fix_rc_order_format`, `order_number_by_channel`, `presence_system`, `price_lists_table`, `pwa_calendar_inactivity`, `rbac_papeis_rls`, `realtime_publication`, `rep_curriculo_doc_type`, `repco_module`, `routes_client_link`, `routes_module`, `routes_status_fix`, `studio_module`, `studio_publish`.

**Divergência comprovada entre repo e banco.** O CLAUDE.md §6 lista como tabelas principais objetos que **não existem no banco**. Verifiquei um a um:

| Tabela citada na documentação | Existe no banco? |
|---|---|
| `notifications` | **NÃO** |
| `presence_sessions` | **NÃO** |
| `profiles` | **NÃO** (existe `user_profiles`) |
| `routes` | **NÃO** (existe `delivery_routes` / `promoter_routes` / `representative_routes`) |
| `route_assignments` | **NÃO** |
| `delivery_proofs` | **NÃO** (a prova está em colunas de `delivery_stops`) |
| `client_route_links` | **NÃO** |
| `producers`, `farms` | **NÃO** (dados de fazenda estão em colunas de `green_coffee_lots`) |
| `user_addresses` | SIM |
| `admin_settings` | SIM |

Ou seja: **as migrações do repo não descrevem o banco de produção**, e a documentação descreve um schema que em parte nunca existiu ou foi renomeado sem atualizar o texto.

**Isto é o pré-requisito duro nº 2.** Sem baseline de migração, qualquer schema novo do Coffee Network nasce com o mesmo defeito: impossível de recriar, impossível de versionar, impossível de dar rollback.

---

## §3 — Componentes e tabelas reutilizáveis pelo Coffee Network

O banco tem **86 tabelas** e **28 views** em `public`. O que já está construído e é aproveitável:

**Identidade e organização**
- `companies` (3 linhas reais): Café Saporino Ltda (`CS`, B2C, Studio ligado), Café Fazendinha Ltda (`CF`), V. Medeiros de Santi Ltda (`CO`, **`is_operator = true`** — é a COFICO como operador logístico). A modelagem multi-empresa **já existe e já está populada**.
- `user_profiles`, `user_roles`, `roles` — RBAC. `auth.users` tem apenas **4 usuários** (ambiente ainda de teste).
- `representatives` (2), `representative_clients` (7, com `lat`/`lng`, `geocode_status`, `credito_score`, `public_pos`).

**Catálogo e preço**
- `products` (9) com `company_id`, `product_line`, `pj_only`, `hidden_from_store`, campos de assinatura.
- `price_lists` (3) — preço por segmento B2B, com `company_id`.

**Pedido e financeiro**
- `representative_orders` (3) — pedido B2B completo: NF, entrega, frete, carrier, descontos financeiro/logístico.
- `representative_order_installments` (4), `representative_commissions` (0), `representative_commission_payouts` (0).
- `orders` (**0**) — o pedido B2C existe no schema, com `order_public_token_hash` e campos Mercado Pago, mas **nunca houve uma venda B2C**.

**Rastreabilidade de lote (fundação da narrativa do café)**
- `green_coffee_lots` (1 linha) — a tabela mais rica do sistema: fazenda, cidade/UF, variedade, altitude, SCA, cadeia de custo verde→torra→embalagem→custo por embalagem, notas sensoriais.
- `lot_documents` (1), `batch_photos` (0), `lot_transfers` (0), `roasting_companies` (1).

**Componentes de UI reaproveitáveis:** `BatchManagement.tsx` (cadeia de custo), `RepCoFieldMap.tsx` e `RepCoRoutes.tsx` (Leaflet/OSM, geofence, GPS), `RepCoPayoutBlocks.tsx`, `DiscoveryPanel.tsx`, `ProspectionAdmin.tsx`, `Messenger.tsx`, o `HeroExperience.tsx` (motor de scroll cinematográfico, agnóstico de conteúdo).

---

## §4 — Camada de inteligência

**O que está construído e com dado real:**

| Módulo | Tabelas | Volume | Estado |
|---|---|---|---|
| Prospecção CNPJ | `prospects_b2b` | **758.929 linhas** | Base carregada; dormente no fluxo atual |
| Prospecção operacional | `prospect_leads` (228), `prospect_lists`, `prospect_runs` (7) | real | Em uso |
| Preço de e-commerce | `ecommerce_price_snapshots` (5.451), `ecommerce_sources` (15) | real | Coletando |
| Índice CEPEA | `coffee_market_index` (48) | real | Coletando |
| Studio (vídeo/IA) | `studio_videos` (5) + 6 tabelas | real | Operacional |
| Visitas ao site | `site_visits` (563) | real | Coletando |

**Discovery Intelligence (INTEL-1) — construído, nunca executado:**

| Item | Prova | Estado |
|---|---|---|
| `discovery_keywords` | 187 linhas | **Populado** |
| `discovery_results` | **0 linhas** | Vazio |
| `discovery_campaigns` | **0 linhas** | Vazio |
| Edge `discovery-run` | ACTIVE v2, deployada 31/08 | Deployada |
| Secret `APIFY_TOKEN` | presente no projeto | Configurado |

**Conclusão honesta:** o Discovery está **pronto e nunca rodou**. Bloqueio é externo (faturas Apify em aberto) e a primeira execução é sua, não minha.

**28 views de agregação** já existem (`vw_repco_vendas_por_area`, `vw_repco_cobertura`, `vw_ruptura_*`, `vw_promoter_*`, `vw_cofico_delivery_queue`). São a Camada 1 do blueprint. Porém rodam sobre **3 pedidos B2B e 0 pedidos B2C** — a inteligência existe estruturalmente, mas ainda não tem massa de dado para significar algo.

---

## §5 — Pagamentos

**Situação em `main` (o que está no ar):**
- Edges deployadas: `create-payment` (v17), `mercadopago-webhook` (v18), ambas de 27/08.
- O webhook **valida assinatura HMAC-SHA256** do header `x-signature`. Porém o código tem o caminho `'No x-signature header found — skipping ve[rification]'` — ou seja, **uma requisição sem o header pula a validação**. Isso é uma falha de desenho de segurança, não um bug de digitação.
- Secrets presentes: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`. **Não existe** nenhum secret `MERCADO_PAGO_COFICO_*`.

**Descompasso grave entre o que está deployado e o que está no código:**

`create-checkout-order` está **ACTIVE (v1) em produção**, mas **o diretório `supabase/functions/create-checkout-order/` não existe em `main`** — ele só existe na branch `fase0-pagamento`. Uma função está servindo tráfego a partir de código que não está na branch de produção. Ninguém consegue auditar ou reproduzir o que está rodando lendo `main`.

**O que está estacionado em `fase0-pagamento`** (1 commit à frente, 44 atrás):
- `_shared/mpWebhook.ts` + teste, `_shared/pricing.ts` + teste, `_shared/rateLimit.ts`
- `create-payment/index.ts` reescrito (199 linhas alteradas), `mercadopago-webhook/index.ts` reescrito (140)
- 4 migrações Fase 0: recriação de `admin_settings` e `user_addresses`, `edge_rate_limits`+`edge_logs`, `order_public_token` e leitor, **lockdown de RLS de `orders`**

A mensagem do commit diz explicitamente: *"pausado até migração Mercado Pago PJ"*.

**Estado factual:** **0 pedidos B2C, 0 invoices**. O fluxo de pagamento nunca processou uma transação real. **Bloqueio é humano** (ativação da conta PJ no Mercado Pago), não técnico.

---

## §6 — Logística

**Modelo de dados presente e coerente:**
- `delivery_routes` (1), `delivery_stops` (2, com `pickup_photo_url`, `delivery_photo_url`, `canhoto_photo_url`, lat/lng de entrega, janela agendada, motivo de falha), `delivery_dispatch_audit`.
- `drivers` (1), `driver_documents`, `fleet_vehicles` (**0**), `fleet_documents`, `fleet_maintenance`.
- `shipping_carriers` (4), `shipments` (**0**).
- View `vw_cofico_delivery_queue` — a fila da COFICO como operadora já está modelada.
- Módulo promotor: `promoters` (1), `promoter_visits` (1), `promoter_incidents` (1), + 8 views `vw_promoter_*`.

**Integração externa:** edge `sync-tracking` ACTIVE v11, mas parada desde **19/03/2026** (nenhuma atualização em ~6 meses) e com `shipments` vazio — nunca exercitada de verdade.

**Leitura honesta:** a logística tem **schema maduro e dado quase nulo**. Foi construída e testada uma vez, não está em operação.

---

## §7 — Storage

**10 buckets.** Ponto de atenção sério na coluna "público":

| Bucket | Público | Limite de tamanho | MIME restrito |
|---|---|---|---|
| `batch-photos` | **SIM** | — | — |
| `carrier-logos` | **SIM** | — | — |
| `chat-media` | **SIM** | — | — |
| `product-images` | **SIM** | — | — |
| `visit-photos` | **SIM** | — | — |
| `delivery-pods` | não | — | — |
| `invoices` | não | — | — |
| `lot-documents` | não | — | — |
| `representative-docs` | não | 10 MB | PDF/JPEG/PNG/WebP |
| `studio-videos` | não | — | — |

**Problemas identificados:**

1. **`chat-media` e `visit-photos` são públicos.** Conversa interna e fotos de visita em ponto de venda ficam acessíveis por URL a quem tiver o link. A edge `chat-upload` documenta no próprio cabeçalho que usa service role para *"contornar o RLS do storage"* e devolve URL pública — para "qualquer usuário autenticado".
2. **Só 1 bucket em 10 tem limite de tamanho e MIME.** Os outros 9 aceitam arquivo de qualquer tipo e tamanho.
3. **Políticas genéricas demais.** Existem policies chamadas `"Public Access"`, `"Authenticated Insert"`, `"Authenticated Update"`, `"Authenticated Delete"` sem escopo de bucket visível no nome, e 5 policies com role `{public}` em operações de escrita (`INSERT`/`UPDATE`/`DELETE` de `carrier-logos`, upload de docs RepCo).
4. **Sem rotina de limpeza.** O próprio CLAUDE.md registra que deletar pedido/cliente não remove arquivos do Storage (`ON DELETE CASCADE` não alcança storage). Isso continua verdadeiro.

---

## §8 — Comunicação e Ai.Bot

**O que existe de verdade:**
- Chat interno: `chat_conversations`, `chat_messages`, `chat_participants`, UI `Messenger.tsx`, edge `chat-upload` (v9). Funciona.
- IA: secrets `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` presentes; usados por `process-studio-video` (Whisper) e `studio-caption` (chama `api.anthropic.com/v1/messages` diretamente). **É IA de marketing/Studio, não um assistente de negócio.**
- E-mail: `RESEND_API_KEY` presente; usado por `send-password-reset` e `scraper-reminder`. **Apenas isso** — não existe e-mail de confirmação de compra nem de envio.

**O que NÃO existe (verificado por busca no código-fonte):**
- **Nenhuma integração de WhatsApp, Telegram, Twilio, SMS ou Web Push.** A busca por esses termos em `src/` retorna 128 ocorrências, mas são todas campos de dado (`whatsapp_comprador`, `whatsapp` de contato) e links `wa.me` — **nenhum cliente de API de mensageria**.
- **Nenhuma tabela `notifications`.** O sininho do admin descrito no CLAUDE.md §12 não tem persistência no banco.
- **Nenhum "Ai.Bot".** As specs `SAPORINO_AI_BOT_MASTER_SPEC_COMPLETO_V4.md` e `E-COHUB_MASTER_SPEC_CLAUDE_V4.md` existem **apenas na branch `fase0-pagamento`**, não em `main`. São **DOCUMENTOS, NÃO IMPLEMENTAÇÃO**. Nenhuma linha de código correspondente foi encontrada.

---

## §9 — Governança e RLS

**RLS ligada em 85 de 86 tabelas** (`pg_tables.rowsecurity`). A única sem RLS é **`company_order_counters`** — a tabela de contadores de numeração de pedido por empresa. Baixo risco de vazamento de dado sensível, mas é escrita por trigger e ficar exposta a escrita direta permitiria corromper a sequência de numeração fiscal.

**Isolamento multi-tenant: praticamente inexistente.** Apenas **9 policies** em todo o schema mencionam `company_id` em `USING` ou `WITH CHECK`. Com 86 tabelas e `company_id` presente em boa parte das tabelas core, isso significa que a coluna existe mas **não está sendo usada para separar as empresas**. A Camada 3 do blueprint continua não construída — o que é coerente com a decisão registrada de adiá-la ("hoje tudo é do mesmo dono").

**Mas há um agravante novo:** conforme o achado crítico no topo, **toda essa camada de RLS é contornável por qualquer chamador anônimo** via `exec_migration`. Enquanto isso não for revogado, o número "85/86 com RLS" é uma métrica sem valor prático.

**Funções de governança que existem:** `is_admin()`, `my_rep_id()`, `check_rate_limit()`, `calculate_repco_commission()`, `repco_commission_cycle()`, `repco_score_on_installment_paid()`, `repco_orders_delivery_guard()`, ciclo completo de convites (`repco_generate_invite`/`validate`/`revoke`/`register_with_code`). A lógica de negócio **está no banco**, como deve ser.

**Edge functions:** 25 deployadas, todas ACTIVE. Distribuição por data da última atualização mostra onde o projeto esteve ativo: Studio/social (13 funções, jul–ago), pagamento (3, ago), prospecção/preço (5, jun–jul), logística (1, **mar**).

---

## §10 — Desafio arquitetural para o Coffee Network

Coloco aqui as tensões reais que vão decidir o desenho do novo core. Não são opiniões soltas — cada uma sai de um fato das seções acima.

**1. O ecossistema tem três empresas e nenhuma separação de dados.**
`companies` tem 3 linhas, uma delas marcada `is_operator`. Mas só 9 policies olham `company_id`. Se o Coffee Network vai ser uma rede (várias marcas, um operador), **o isolamento deixa de ser "Camada 3 adiada" e vira requisito de fundação**. A pergunta de desenho é: o Coffee Network é multi-tenant de verdade, ou continua sendo um sistema de dono único com três rótulos?

**2. O schema cresceu por acréscimo, não por modelo.**
86 tabelas, 28 views, e três conceitos de "rota" convivendo (`delivery_routes`, `promoter_routes`, `representative_routes`) com sobreposição evidente. Documentação citando 8 tabelas que não existem é sintoma, não causa. Um core novo empilhado sobre isso herda a entropia.

**3. Existe muita estrutura e pouquíssimo dado.**
3 pedidos B2B, 0 B2C, 0 shipments, 0 fleet, 0 comissões, 0 discovery results, 4 usuários. O sistema foi **construído mas não operado**. O risco arquitetural aqui é projetar o Coffee Network para escala que nunca foi testada, em vez de projetar para a primeira operação real.

**4. Código de produção que não está na branch de produção.**
`create-checkout-order` roda em produção sem existir em `main`. Duas branches (44 e 145 commits atrás) guardam trabalho real. Isso não é um detalhe de processo: significa que **`main` não é a fonte da verdade**, e um core novo precisa que ela seja.

**5. Sem baseline de migração, não há como versionar o core novo.**
Este é o que mais aperta. Ver §11.

---

## §11 — Pré-requisitos antes de escrever a primeira linha do Coffee Network

Em ordem de dependência. Nada aqui é feature — é fundação.

| # | Pré-requisito | Por quê | Depende de |
|---|---|---|---|
| **1** | **Revogar `EXECUTE` de `exec_migration`/`exec_select` para `anon`/`authenticated`/`PUBLIC`** | Qualquer visitante do site pode executar SQL com bypass de RLS. Nenhum código do produto usa esses RPCs, então o custo é zero | Sua autorização |
| **2** | **Criar baseline de migração** (`supabase migration repair` / dump do schema atual como migração inicial) | Sem isso o schema do Coffee Network não é versionável nem reproduzível. 19 arquivos sem timestamp precisam ser normalizados ou absorvidos no baseline | Decisão de método |
| **3** | **Reconciliar `main`**: trazer `fase0-pagamento` (ou aposentá-la) e resolver `create-checkout-order` fora do repo | `main` precisa ser a fonte da verdade antes de virar base de um core novo | Decisão sobre Mercado Pago PJ |
| **4** | **Corrigir documentação vs. banco** (CLAUDE.md §6 lista 8 tabelas inexistentes) | Todo trabalho futuro parte desse texto; hoje ele desinforma | Item 2 |
| **5** | **Decidir o modelo de tenancy do Coffee Network** | Determina se `company_id` vira chave de isolamento real ou continua decorativo | Sua decisão de negócio |
| **6** | **Fechar a validação HMAC do webhook** (hoje pula se falta o header) e revisar buckets públicos (`chat-media`, `visit-photos`) | Superfície de ataque aberta antes de haver transação real | Itens 1 e 3 |
| **7** | **Limpar o working tree**: repo aninhado `website_project/`, 15 assets soltos com espaço no nome, decidir o HERO não commitado | Higiene mínima antes de abrir uma frente nova | Sua decisão |

**Bloqueios que dependem só de você (não são técnicos):** pagar faturas Apify e rodar o primeiro Discovery; ativar Mercado Pago PJ; decidir o destino da branch `repco-cie`; entregar o vídeo 1080p do HERO com logo na xícara.

---

## §12 — Primeira fatia vertical sugerida

Uma fatia vertical é uma funcionalidade fina que atravessa **todas** as camadas — banco, RLS, edge, UI — para provar que a fundação aguenta, antes de construir em largura.

**Proposta: "Lote rastreável na rede" — do lote de café verde até uma página pública de origem.**

Por que essa e não outra:

- **Usa a tabela mais rica que já existe** (`green_coffee_lots`: fazenda, altitude, variedade, SCA, cadeia de custo) e as suas satélites (`lot_documents`, `batch_photos`, `roasting_companies`). Nenhum modelo novo precisa ser inventado do zero.
- **Atravessa as três empresas naturalmente**: o lote nasce numa torrefação parceira, pertence a uma `company`, e é distribuído pelo operador (COFICO). É o teste honesto do item 5 dos pré-requisitos — se o isolamento por `company_id` funcionar aqui, funciona no resto.
- **Exercita o Storage no ponto mais delicado**: documentos de lote são privados (`lot-documents`), fotos de lote são públicas (`batch-photos`). Uma fatia só já força a decidir a política de acesso do jeito certo.
- **Tem valor de negócio imediato e independente de bloqueio externo.** Não depende de Mercado Pago PJ, não depende de fatura Apify, não depende de volume de pedidos. É o único caminho que **não está travado em terceiro**.
- **Já é um projeto aprovado** — a "Rastreabilidade do café / Conheça seu café" está registrada no CLAUDE.md §8 como próximo projeto, com escopo definido.

**O que essa fatia provaria, camada por camada:**

| Camada | O que a fatia valida |
|---|---|
| Migração | Que o baseline do item 2 funciona: uma migração nova aplica limpo e é reproduzível |
| Schema | Modelagem de produtor/fazenda como entidade (hoje são colunas soltas em `green_coffee_lots`) |
| RLS | Isolamento por `company_id` num caso real, com leitura pública controlada |
| Storage | Bucket privado + bucket público na mesma feature, com política correta |
| Edge/API | Leitura pública sem expor `anon` a nada além do previsto — o oposto do achado crítico |
| UI | Página pública nova, reaproveitando o motor visual do `HeroExperience` |

**Não recomendo** começar pelo pagamento (travado em terceiro), pela logística (schema pronto, dado zero, sem operação real para exercitar) nem pelo Ai.Bot (existe só como documento em branch paralela).

---

## Resumo de uma linha por seção

| § | Assunto | Veredito |
|---|---|---|
| 🔴 | Segurança | **`exec_migration` aberto a `anon` com bypass de RLS — bloqueia tudo** |
| 1 | Repo | `main` limpa e buildando; working tree com HERO não verificado, repo aninhado, 15 assets soltos |
| 2 | Migrações | **Sem baseline. 19 de 67 arquivos sem timestamp. 8 tabelas documentadas não existem** |
| 3 | Reutilizável | Base sólida: 86 tabelas, multi-empresa já populada, lotes e comissão maduros |
| 4 | Inteligência | Dado real em preço/CEPEA/CNPJ; **Discovery pronto e nunca executado** |
| 5 | Pagamento | 0 transações; código de produção fora de `main`; HMAC pulável; travado em MP PJ |
| 6 | Logística | Schema maduro, dado quase nulo, `sync-tracking` parada desde março |
| 7 | Storage | 5 de 10 buckets públicos, incluindo chat e fotos de visita; 1 com limite |
| 8 | Comunicação | Chat interno OK; **sem WhatsApp/Telegram/Push; Ai.Bot é documento, não código** |
| 9 | Governança | RLS em 85/86, mas só 9 policies com `company_id` — e tudo contornável pelo achado crítico |
| 10 | Desafio | `main` não é fonte da verdade; schema por acréscimo; muita estrutura, pouco dado |
| 11 | Pré-requisitos | 7 itens; os 2 primeiros (revogar RPC, baseline de migração) travam o resto |
| 12 | Fatia vertical | Lote rastreável — único caminho não travado em terceiro |

---

*Documento produzido em modo read-only. Nenhuma migração criada, nenhuma tabela alterada, nenhum deploy, nenhuma publicação. Este arquivo não foi commitado.*
