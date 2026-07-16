# MÓDULO PROMOTOR — Plano de Implementação

> Documento de trabalho. Salvar na raiz do repo `website_project`.
> Fonte: `CLAUDE.md` (contrato do projeto) + `ESTADO_ATUAL.md` (levantamento factual do código e do banco).
> Decisões arquiteturais tomadas em chat; execução pelo Claude Code.

---

## COMO USAR ESTE DOCUMENTO

**Leia esta seção antes de qualquer coisa.**

Este documento tem 7 blocos. **Execute UM bloco por vez, na ordem.** Não pule. Não junte dois blocos numa rodada. Não comece o Bloco N+1 antes de o Bloco N passar na validação.

Motivo, sem rodeios: este repositório **não tem testes automatizados**, o `App.tsx` é monolítico, e o RepCo é a parte do sistema que funciona e está em uso. Se sete blocos forem executados de uma vez e algo quebrar, ninguém saberá qual foi. Um bloco, validação, próximo bloco.

Cada bloco tem:
- **PRÉ-CHECK** — confirmar que o bloco anterior existe. Se não existir, **pare e reporte**.
- **OBJETIVO**
- **BANCO** — DDL via RPC `exec_migration`
- **FRONTEND**
- **VALIDAÇÃO** — rodar antes de encerrar o bloco
- **NÃO FAÇA NESTE BLOCO** — limites explícitos

**Regras que valem para TODOS os blocos:**

1. **Aditivo.** Nenhuma das 99 policies existentes pode ser alterada ou removida. As funções `is_admin()` e `my_rep_id()` continuam exatamente como estão.
2. **Nada que funciona hoje pode mudar de comportamento.** Loja, checkout, admin e RepCo ficam intocados.
3. **Não ligar service worker, não ligar PWA, não mexer no `index.html`.** O SW já quebrou este app antes (tela branca, cache preso) e hoje o `index.html` desregistra SW de propósito. Isso não muda em nenhum bloco deste documento.
4. **Padrão visual existente.** Cor de marca `#8B2214`, componentes hand-rolled, `lucide-react` para ícones, `sonner` para toast. **Não instalar biblioteca de UI nova.** Não instalar react-router (o roteador é manual em `App.tsx`).
5. **Não refatorar o que não faz parte do bloco.** Nada de trocar `useState/useEffect` por React Query, nada de quebrar o `App.tsx`, nada de criar design tokens. Isso é dívida conhecida e está fora do escopo deste módulo.
6. **Ao terminar cada bloco:** rodar `typecheck` e `build`, executar a validação do bloco, e reportar o resultado. Não commitar sem pedir.

---

## CONTEXTO DO NEGÓCIO (leia antes de decidir qualquer coisa)

A Café Saporino vende café B2B. O **representante comercial** vende para o cliente (supermercado, atacarejo, padaria, food service) e gera o pedido. O **promotor** vai fisicamente até a loja desse cliente, confere a gôndola e repõe o produto na prateleira.

**Loja = cliente.** O supermercado que o promotor visita é o mesmo registro `representative_clients` que o representante atende. **Não criar tabela de PDV nova.** A view `points_of_sale` e a tabela `prospects_b2b` (base pública da Receita, 728 mil linhas) não têm relação com isso.

**Nem todo cliente tem gôndola.** Cafeteria e food service não têm prateleira para auditar. Por isso o representante marca no cadastro se aquele cliente tem gôndola — e é isso que define se o promotor vai lá ou não.

### O HORIZONTE DE DADOS DO PROMOTOR — regra inegociável

> **O promotor enxerga: produto, prateleira, estoque da loja, preço da gôndola, foto, ocorrência. Só isso.**

O promotor **NÃO** pode ver, em nenhuma tela e em nenhuma resposta de API:
- preço de custo, margem, lucro
- preço de tabela / `price_lists` / condição comercial
- quem é o comprador, nome do comprador, e-mail do comprador, WhatsApp do comprador
- histórico de pedidos, última venda, valores, nota fiscal
- limite de crédito, score, dados bancários, PIX
- comissão de ninguém

Ele vê o preço que **está na gôndola** (que ele mesmo anota) e o produto na prateleira. Fim.

**Isto não é regra de tela. É regra de banco.** Se o promotor abrir o navegador e tentar puxar na mão, não pode vir nada. A implementação disso está no Bloco 2 (views) e vale para todos os blocos seguintes.

### O que já existe e deve ser reaproveitado

O `ESTADO_ATUAL.md` mostra que boa parte da fundação já está pronta. **Reaproveite, não recrie:**

| Já existe | Onde | Usar para |
|---|---|---|
| Chat interno completo | `chat_conversations`, `chat_messages`, `chat_participants`, `is_chat_member()`, bucket `chat-media`, Edge Function `chat-upload`, `lib/chat.ts` (Realtime), componente `Messenger` | Bloco 5 — conversa no SKU |
| Bucket de fotos de visita | `visit-photos` (público), padrão `visits/{repId}/{stopId}/{ts}.jpg` | Bloco 3 — fotos da visita do promotor |
| Presença ao vivo | `representatives.last_seen_at/last_lat/last_lng/is_online`, hook `usePresence` | Bloco 2 — presença do promotor (mesmo padrão) |
| Padrão de visita com geocerca | `route_stops` (`arrival_at`, `departure_at`, `geofence_triggered`, `distance_from_stop`, `proof_photo_url/lat/lng/at`) | Bloco 3 — **copiar o formato, não a tabela** |
| Cadastro por convite | `repco_invite_codes`, RPCs `repco_validate_invite` / `repco_register_with_code` | Bloco 2 — conta do promotor |
| Geolocalização | hook `useGeolocation` | Bloco 3 |
| Cliente com geo | `representative_clients.lat/lng/geocode_status` | Bloco 3 |

**Não reaproveitar a tabela `route_stops`.** Ela tem FK em `representative_routes` → `representatives`, e o promotor não é representante. Mexer nela arrisca o RepCo, que funciona. Copie o formato numa tabela nova.

---

## BLOCO 0 — RBAC (fundação de papéis)

### PRÉ-CHECK
Nenhum. Este é o primeiro bloco. Leia o `ESTADO_ATUAL.md` antes de começar.

### OBJETIVO
Criar um sistema de papéis. Hoje **não existe RBAC**: o papel é derivado de `user_profiles.is_admin` (booleano) + existência em `representatives`, com `if/else` espalhado pelas telas. Não há onde colocar "promotor" nem "supervisor".

### BANCO

1. Tabela `roles`:
   - `code` text PRIMARY KEY
   - `label` text NOT NULL
   - `description` text
   - `created_at` timestamptz DEFAULT now()

   Seed: `('admin','Administrador')`, `('representante','Representante Comercial')`, `('promotor','Promotor')`, `('supervisor','Supervisor')`

2. Tabela `user_roles`:
   - `id` uuid PK DEFAULT gen_random_uuid()
   - `user_id` uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
   - `role_code` text NOT NULL REFERENCES roles(code)
   - `company_id` uuid REFERENCES companies(id) ON DELETE CASCADE — **nulo = vale para todas as empresas**
   - `is_active` boolean NOT NULL DEFAULT true
   - `granted_at` timestamptz NOT NULL DEFAULT now()
   - `granted_by` uuid REFERENCES auth.users(id)
   - UNIQUE (user_id, role_code, company_id)
   - Índices em `(user_id)` e `(user_id, role_code)`

   **Um usuário PODE ter mais de um papel** (ex.: representante + promotor).

3. Função `public.has_role(p_role text)` — SECURITY DEFINER, STABLE, `search_path` fixo.
   Retorna true se existe linha ativa em `user_roles` para `auth.uid()` com aquele `role_code`.

4. Função `public.has_role(p_role text, p_company uuid)` — igual, mas exige `company_id = p_company OR company_id IS NULL`.

5. **Backfill** (derivar do que existe, não inventar):
   - Todo `user_profiles` com `is_admin = true` → `user_roles('admin', company_id NULL)`
   - Todo `representatives` (qualquer status) → `user_roles('representante', company_id = o company_id do rep)`
   - Usar `ON CONFLICT DO NOTHING`.

6. RLS em `roles` e `user_roles`:
   - `roles`: SELECT liberado para `authenticated`; escrita só `is_admin()`
   - `user_roles`: SELECT do próprio usuário (`user_id = auth.uid()`) OU `is_admin()`; escrita só `is_admin()`

7. **NÃO redefinir `is_admin()`. NÃO alterar nenhuma policy existente.** O RBAC novo convive em paralelo. As tabelas do módulo Promotor é que vão usar `has_role()`.

### FRONTEND

8. Em `AuthContext`: carregar os papéis do usuário logado junto com o profile e expor `roles: string[]` e `hasRole(code: string): boolean`. Recarregar no `onAuthStateChange`.
   **Não trocar nenhum `if/else` de `is_admin` existente por `hasRole` neste bloco.** Só disponibilizar.

9. No `AdminDashboard`, aba RepCo: sub-seção **"Papéis"** listando usuários com seus papéis, permitindo conceder e revogar. Padrão visual das telas admin existentes.

### VALIDAÇÃO
- `typecheck` + `build`
- SELECT confirmando o backfill: nº de `admin` em `user_roles` == nº de `user_profiles.is_admin=true`; nº de `representante` em `user_roles` == nº de linhas em `representatives`
- Contar as policies antes e depois — tem que continuar 99
- Login como admin e como representante: nada mudou nas telas

### NÃO FAÇA NESTE BLOCO
Nenhuma tabela de promotor. Nenhuma tela de promotor. Nenhuma alteração em `route_stops`. Nenhum service worker.

---

## BLOCO 1 — Flag de gôndola + validação obrigatória no cadastro de cliente

### PRÉ-CHECK
`SELECT` em `user_roles` e `roles` retorna. Função `has_role('admin')` existe. Se não, pare.

### OBJETIVO
O representante passa a declarar, no cadastro do cliente, se aquele cliente tem gôndola. É isso que define se o promotor atende aquela loja. **Campo obrigatório: sem resposta, não salva.**

### BANCO

1. Em `representative_clients`, adicionar:
   - `tem_gondola` boolean — **nulo por enquanto** (backfill não inventa resposta; os clientes existentes serão preenchidos na próxima edição)
   - `geofence_radius_m` integer NOT NULL DEFAULT 100 — raio da geocerca da loja, configurável por cliente (usado no Bloco 3)

2. Não criar constraint NOT NULL em `tem_gondola` no banco (quebraria os registros existentes). A obrigatoriedade é imposta no formulário.

### FRONTEND

3. No formulário de cadastro/edição de cliente do RepCo (`RepCoClients`):
   - Campo **"Este cliente tem gôndola? (o promotor vai atender esta loja)"** — Sim / Não. Sem opção neutra, sem valor padrão.
   - **Bloquear o salvamento** enquanto não for respondido.

4. **Passe de campos obrigatórios:** revisar o formulário de cliente e impor validação de TODOS os campos obrigatórios antes de salvar, não só o de gôndola. Ao tentar salvar com campos faltando:
   - impedir o salvamento
   - marcar visualmente cada campo faltante
   - mostrar uma mensagem clara listando o que falta (toast `sonner` + destaque no campo)
   - rolar até o primeiro campo faltante

   Se o formulário for em etapas, também bloquear o avanço para a próxima etapa.

5. Na listagem de clientes do RepCo e do Admin: indicador visual de quem tem gôndola, e filtro por isso.

6. No Admin (aba RepCo → Clientes): permitir corrigir o `tem_gondola` e o `geofence_radius_m` de qualquer cliente.

### VALIDAÇÃO
- `typecheck` + `build`
- Tentar salvar um cliente novo sem responder a gôndola → tem que ser impedido com mensagem clara
- Tentar salvar sem outro campo obrigatório → mesma coisa
- Salvar com tudo preenchido → grava
- Editar um cliente existente (que tem `tem_gondola` nulo) → exige a resposta antes de salvar
- Contar policies: continua 99

### NÃO FAÇA NESTE BLOCO
Nada de promotor ainda. Não mexer no fluxo de pedido.

---

## BLOCO 2 — Promotor: entidade, conta e horizonte de dados

### PRÉ-CHECK
`representative_clients.tem_gondola` e `geofence_radius_m` existem. Se não, pare.

### OBJETIVO
Criar o promotor como entidade, o cadastro por convite, o vínculo com as lojas que ele atende, e — o ponto crítico — **as views que limitam o que ele enxerga**.

### BANCO

1. Tabela `promoters` (espelha o padrão de `representatives`):
   - `id` uuid PK DEFAULT gen_random_uuid()
   - `user_id` uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
   - `full_name` text NOT NULL
   - `cpf` text
   - `phone` text
   - `email` text
   - `company_id` uuid REFERENCES companies(id)
   - `supervisor_user_id` uuid REFERENCES auth.users(id)
   - `status` text NOT NULL DEFAULT 'pending' — `pending` / `active` / `blocked`
   - `blocked_reason` text
   - `approved_at` timestamptz
   - `notes` text
   - presença (mesmo padrão de `representatives`): `last_seen_at` timestamptz, `last_lat` numeric, `last_lng` numeric, `is_online` boolean, `current_tab` text
   - `created_at`, `updated_at` timestamptz NOT NULL DEFAULT now()

2. Função `public.my_promoter_id()` — SECURITY DEFINER, STABLE, espelhando `my_rep_id()`. Retorna o `promoters.id` do `auth.uid()`.

3. Tabela `promoter_clients` — quais lojas este promotor está autorizado a atender:
   - `id` uuid PK DEFAULT gen_random_uuid()
   - `promoter_id` uuid NOT NULL REFERENCES promoters(id) ON DELETE CASCADE
   - `representative_client_id` uuid NOT NULL REFERENCES representative_clients(id) ON DELETE CASCADE
   - `company_id` uuid REFERENCES companies(id)
   - `is_active` boolean NOT NULL DEFAULT true
   - `created_at` timestamptz NOT NULL DEFAULT now()
   - UNIQUE (promoter_id, representative_client_id)
   - Índice em `(promoter_id)`

4. Convite: adicionar `role_code` text NOT NULL DEFAULT `'representante'` em `repco_invite_codes` (aditivo — os códigos existentes continuam valendo como representante). Criar as RPCs `promoter_validate_invite` e `promoter_register_with_code` espelhando as do RepCo, criando a linha em `promoters` com `status='pending'` e concedendo `user_roles('promotor')`.

### O HORIZONTE DE DADOS — implementação

**O promotor NÃO recebe policy nenhuma em `representative_clients`, `products`, `price_lists`, `representative_orders`, `representative_order_items`, `representative_commissions`, `green_coffee_lots`, `invoices` ou qualquer tabela comercial. Zero. Ele nunca lê essas tabelas.**

Ele lê **views**, e só:

5. View `vw_promoter_stores` — as lojas que ele atende, **só com colunas operacionais**:
   ```
   id, razao_social, nome_fantasia, cnpj, endereco_completo, bairro, municipio, uf, cep,
   lat, lng, geofence_radius_m, tem_gondola, company_id,
   representative_id  -- só o ID; o nome do rep vem da view abaixo
   ```
   Filtrada internamente por: existe `promoter_clients` ativo ligando `my_promoter_id()` àquele cliente **E** `tem_gondola = true`.

   **Nunca expor:** `email_comprador`, `nome_comprador`, `whatsapp_comprador`, `limite_credito`, `credito_score`, `prazo_pagamento`, `forma_pagamento`, `desconto_*`, `bonificacao_padrao`, `pix_key`, `bank_*`, `score_serasa_pdf_url`, `last_order_at`, `inscricao_estadual`, `default_fiscal_order_type`.

6. View `vw_promoter_reps` — o promotor precisa saber **quem é o representante daquela loja** (ele mesmo pediu isso), mas só o mínimo:
   ```
   id, full_name, is_online
   ```
   Filtrada aos representantes das lojas que ele atende. **Sem** telefone, e-mail, CPF, CNPJ, comissão.

7. View `vw_promoter_products` — o mix que ele pode auditar, **sem preço nenhum**:
   ```
   id, name, product_line, weight_grams, barcode, image_url, company_id
   ```
   **Nunca expor:** `price`, `promotional_price`, `discount_percentage`, custo, nada de `price_lists`, nada de `green_coffee_lots`.
   > O promotor anota o preço que está NA GÔNDOLA. Ele não precisa saber o seu preço, e não pode.

8. Views com `security_barrier = true`, `GRANT SELECT` para `authenticated`. As views filtram por `my_promoter_id()` internamente, então um promotor nunca vê a loja de outro.

9. RLS nas tabelas novas:
   - `promoters`: promotor lê/atualiza só o próprio registro (`user_id = auth.uid()` — e só as colunas de presença); `is_admin()` faz tudo; `has_role('supervisor')` lê os promotores da sua empresa
   - `promoter_clients`: promotor lê só as próprias linhas (`promoter_id = my_promoter_id()`); escrita só `is_admin()`

### FRONTEND

10. Rota `/promotor` no roteador manual do `App.tsx`, seguindo exatamente o padrão de `/repco`. Componente `PromotorDashboard`.
    Guarda: sem `has_role('promotor')` → "Acesso negado". `status='pending'` → "Cadastro em análise". `blocked` → "Acesso bloqueado". `active` → libera.
    **Verificar o `vercel.json`** — a rota nova precisa cair no catchall como as outras, senão quebra no F5.

11. Cadastro por convite, idêntico ao do RepCo: tela "acesso só por convite" + campo de código.

12. Shell do `PromotorDashboard` com as abas (vazias por enquanto, só a estrutura): **Minha rota**, **Visitas de hoje**, **Pendências**, **Histórico**, **Mensagens** (reusar o `Messenger` existente), **Ajuda**.
    Mobile: 3 primárias (Minha rota, Visitas de hoje, Mensagens) + menu "Mais". Botões grandes, poucos campos por tela, legível sob sol.

13. Presença do promotor: reusar o padrão do `usePresence` (foreground apenas — é o que o navegador permite).

14. No Admin (aba RepCo): sub-seção **"Promotores"** — aprovar/bloquear promotor, gerar código de convite de promotor, e vincular lojas ao promotor (só clientes com `tem_gondola = true` aparecem na lista).

### VALIDAÇÃO
- `typecheck` + `build`
- Criar um promotor de teste, aprovar, vincular a 1 loja
- **Teste do horizonte de dados (obrigatório):** logado como o promotor, tentar `select * from representative_clients` → tem que voltar **vazio ou negado**. Mesma coisa para `products`, `price_lists`, `representative_orders`, `representative_commissions`. Se qualquer uma dessas retornar linha, **o bloco falhou**.
- `select * from vw_promoter_stores` como promotor → só a loja vinculada, e **sem nenhuma coluna comercial**
- Logado como promotor, `/repco` e `/admin` → acesso negado
- Contar policies existentes: as 99 originais continuam intactas

### NÃO FAÇA NESTE BLOCO
Nenhuma rota, visita, foto ou auditoria. Só entidade, conta, vínculo e views.

---

## BLOCO 3 — Rota e visita do promotor

### PRÉ-CHECK
`promoters`, `promoter_clients`, `my_promoter_id()` e `vw_promoter_stores` existem. Se não, pare.

### OBJETIVO
O supervisor/admin monta a rota do dia; o promotor executa a visita num fluxo em etapas com check-in por geocerca, foto antes, foto depois e check-out.

### BANCO

1. `promoter_routes`:
   - `id` uuid PK, `promoter_id` uuid NOT NULL REFERENCES promoters(id) ON DELETE CASCADE
   - `company_id` uuid REFERENCES companies(id)
   - `route_date` date NOT NULL
   - `status` text NOT NULL DEFAULT 'draft' — `draft` / `published` / `finished`
   - `created_by` uuid REFERENCES auth.users(id), `published_at` timestamptz
   - `created_at`, `updated_at`
   - UNIQUE (promoter_id, route_date)

2. `promoter_visits` (formato copiado de `route_stops`, tabela própria):
   - `id` uuid PK
   - `route_id` uuid REFERENCES promoter_routes(id) ON DELETE CASCADE — **nulo permitido** (visita adicional, fora de rota)
   - `promoter_id` uuid NOT NULL REFERENCES promoters(id)
   - `representative_client_id` uuid NOT NULL REFERENCES representative_clients(id)
   - `company_id` uuid REFERENCES companies(id)
   - `stop_order` integer, `priority` text, `scheduled_at` timestamptz, `estimated_minutes` integer
   - `status` text NOT NULL DEFAULT 'nao_iniciada' — `nao_iniciada` / `em_deslocamento` / `em_atendimento` / `concluida` / `concluida_com_pendencia` / `nao_realizada`
   - **Check-in:** `arrival_at` timestamptz, `checkin_lat` numeric, `checkin_lng` numeric, `checkin_accuracy_m` numeric, `checkin_distance_m` numeric, `checkin_geofence_ok` boolean, `checkin_justification` text
   - **Check-out:** `departure_at` timestamptz, `checkout_lat` numeric, `checkout_lng` numeric, `checkout_accuracy_m` numeric, `checkout_distance_m` numeric, `checkout_geofence_ok` boolean, `checkout_justification` text
   - `duration_minutes` integer (calculado no check-out)
   - `is_scheduled` boolean NOT NULL DEFAULT true — visita programada ou adicional
   - `not_visited_reason` text — `loja_fechada` / `acesso_negado` / `endereco_incorreto` / `problema_saude` / `problema_transporte` / `rota_alterada` / `loja_sem_operacao` / `outro`
   - `not_visited_notes` text
   - `notes` text
   - `cancelled_at` timestamptz, `cancelled_by` uuid, `cancellation_reason` text — **cancelamento lógico; visita concluída NUNCA é deletada de verdade**
   - `created_at`, `updated_at`
   - Índices: `(promoter_id, status)`, `(route_id)`, `(representative_client_id)`

3. `promoter_visit_photos`:
   - `id` uuid PK, `visit_id` uuid NOT NULL REFERENCES promoter_visits(id) ON DELETE CASCADE
   - `kind` text NOT NULL — `gondola_antes` / `gondola_depois` / `etiqueta` / `ponto_extra` / `deposito` / `avaria` / `validade` / `concorrencia` / `sku_ruptura`
   - `product_id` uuid REFERENCES products(id) — nulo quando a foto é geral
   - `photo_url` text NOT NULL, `lat` numeric, `lng` numeric, `taken_at` timestamptz NOT NULL, `caption` text
   - `company_id` uuid, `created_at`

   Bucket: reusar `visit-photos`. Caminho: `promoter/{promoterId}/{visitId}/{kind}-{ts}.jpg`

4. `promoter_visit_locations` — **a tabela que deixa o futuro pronto:**
   - `id` bigserial PK, `visit_id` uuid NOT NULL REFERENCES promoter_visits(id) ON DELETE CASCADE
   - `lat` numeric NOT NULL, `lng` numeric NOT NULL, `accuracy_m` numeric
   - `captured_at` timestamptz NOT NULL
   - `source` text NOT NULL — `checkin` / `track` / `checkout`
   - Índice em `(visit_id, captured_at)`

   > **Por que esta tabela existe agora.** Hoje o app roda no navegador, e navegador **não** faz GPS em segundo plano (tela apagada, telefone no bolso). Então hoje esta tabela recebe só os pontos de primeiro plano: check-in, check-out e o rastro enquanto o promotor está com o app aberto durante a visita. No dia em que o app for embrulhado em casca nativa (Capacitor), **só o coletor muda** — a tabela, o schema, as telas e os relatórios já estão prontos e nada é reescrito. É isto que significa "deixar pronto": a estrutura de dados aguenta a linha contínua; a coleta melhora depois, sem obra.
   >
   > **Não tentar contornar isso com truque** (Wake Lock, ping, keep-alive). Não funciona de forma confiável e queima bateria.

5. **Não alterar `route_stops`, `representative_routes` nem `representatives`.**

6. RLS:
   - `promoter_routes` / `promoter_visits` / `promoter_visit_photos` / `promoter_visit_locations`: promotor lê e escreve só as próprias (`promoter_id = my_promoter_id()`, ou via `visit_id` para as filhas). `is_admin()` faz tudo. `has_role('supervisor')` lê tudo da sua empresa.
   - **DELETE negado para o promotor** nas visitas. Cancelamento é lógico.

7. `promoter_audit_log`:
   - `id` bigserial PK, `actor_user_id` uuid, `entity` text, `entity_id` uuid, `action` text, `payload` jsonb, `created_at` timestamptz DEFAULT now()
   - Registrar: check-in, check-out, alteração manual, mudança de status, cancelamento, não-visita.

### FRONTEND

8. **Admin/Supervisor — montar rota** (`AdminDashboard` → RepCo → Promotores → Rotas):
   - escolher promotor + data
   - adicionar lojas (**só clientes com `tem_gondola = true`**, e só os vinculados àquele promotor)
   - ordenar manualmente, definir prioridade, horário sugerido, tempo estimado
   - publicar a rota (`status='published'`)
   - **Sem otimização automática de rota.** A arquitetura fica preparada; o algoritmo não entra agora.

9. **Promotor — Minha rota / Visitas de hoje:**
   - Cabeçalho: nome, data, visitas programadas, concluídas, pendentes, próxima loja, botão "Abrir rota", botão "Iniciar próxima visita"
   - Cards por loja: rede/nome, endereço, distância, prioridade, horário sugerido, status, botão de navegação (**Google Maps / Waze**, padrão já usado no RepCo), botão iniciar visita
   - **Filtro padrão da tela = só o que falta.** Não mostrar a lista toda por padrão; oferecer o toggle "ver concluídas".

10. **Fluxo da visita — passo a passo, nunca um formulário gigante.** Indicador de progresso, salvamento automático a cada etapa, botões grandes, poucos campos por tela.

    - **Etapa 1 — Check-in:** captura GPS (`useGeolocation`), calcula distância até a loja, compara com `geofence_radius_m` daquele cliente. Fora da geocerca: **alerta + justificativa obrigatória + registra a exceção**. Não impedir o check-in, e **não esconder do supervisor**. Grava `arrival_at` e `status='em_atendimento'`.
    - **Etapa 2 — Foto inicial:** obrigatória, foto geral da gôndola. **Câmera dentro do app** (`capture="environment"`), **não aceitar imagem da galeria**. Comprimir antes do upload (alvo ~1600px no maior lado, JPEG ~0.7). Fotos adicionais opcionais pelos `kind` da tabela.
      > **Atenção — bug conhecido deste repo:** o input de arquivo deve ser criado com `document.createElement('input')` fora do ciclo de render do React. Fazer diferente reintroduz um bug de re-render já resolvido antes neste projeto.
    - **Etapa 3 — placeholder.** A auditoria por SKU é o Bloco 4. Aqui só deixar a etapa existir no fluxo.
    - **Etapa 4 — Foto final:** obrigatória, gôndola depois.
    - **Etapa 5 — Check-out:** validar foto antes e foto depois; capturar GPS; fora da geocerca permite finalizar **mas exige justificativa e sinaliza ao supervisor**; grava `departure_at`, calcula `duration_minutes`, `status='concluida'`.

11. **Visita não realizada:** motivo da lista, localização, data/hora, justificativa obrigatória.

12. **Rascunho local + reenvio (o "offline pequeno"):**
    - Guardar a visita em andamento em `localStorage` (padrão que o app já usa: `saporino-cart`, `active-company-id`).
    - Se um envio falhar, **não perder o que foi digitado**: manter e tentar de novo, com indicador visual de "não enviado".
    - Botão de reenviar manual.
    - Isto **NÃO é offline-first**. Não instalar Dexie/IndexedDB, não ligar service worker, não criar fila de sincronização. Cobre o caso real: sinal cai por dois minutos no corredor do mercado.

13. **Tempo real "na loja agora":** ao entrar em `status='em_atendimento'`, o estado é publicado por Supabase Realtime (mesmo padrão de `lib/chat.ts`). O representante daquela loja e o supervisor veem "Promotor X está na Loja Y agora, entrou às HH:MM". No check-out a janela fecha.
    > Isso **não depende de GPS contínuo**. O check-in com geocerca já provou a presença; o Realtime só transmite a mudança de estado. É a janela em que o representante liga e o promotor passa o telefone para o encarregado.

### VALIDAÇÃO
- `typecheck` + `build`
- Montar uma rota com 2 lojas, publicar, logar como promotor, ver a rota
- Check-in dentro do raio → passa sem justificativa
- Check-in fora do raio (falsear a coordenada) → exige justificativa e grava `checkin_geofence_ok=false`
- Foto: confirmar que a galeria não é aceita e que o arquivo chega comprimido no bucket
- Check-out sem a foto final → bloqueado
- Visita concluída: confirmar `duration_minutes` e os pontos em `promoter_visit_locations`
- Tentar deletar visita concluída como promotor → negado
- Com a visita em atendimento, confirmar que o representante recebe o estado por Realtime
- Contar policies: as 99 originais intactas

### NÃO FAÇA NESTE BLOCO
Auditoria por SKU, ruptura, abastecimento, concorrente, Loja Perfeita, dashboard. Nada de otimização de rota. Nada de service worker.

---

## BLOCO 4 — Auditoria por SKU, ruptura e abastecimento

### PRÉ-CHECK
`promoter_visits` existe e uma visita de teste completa o fluxo do Bloco 3. Se não, pare.

### OBJETIVO
A etapa 3 da visita: o promotor confere SKU a SKU, o sistema classifica a ruptura sozinho, e ele registra o abastecimento.

### BANCO

1. `promoter_client_mix` — quais produtos são auditados em qual loja:
   - `id` uuid PK, `representative_client_id` uuid NOT NULL REFERENCES representative_clients(id) ON DELETE CASCADE
   - `product_id` uuid NOT NULL REFERENCES products(id)
   - `company_id` uuid, `min_frentes` integer, `is_active` boolean NOT NULL DEFAULT true
   - UNIQUE (representative_client_id, product_id)

2. `promoter_visit_audits`:
   - `id` uuid PK, `visit_id` uuid NOT NULL REFERENCES promoter_visits(id) ON DELETE CASCADE
   - `product_id` uuid NOT NULL REFERENCES products(id)
   - **Antes:** `qty_gondola_antes` integer, `qty_deposito` integer, `frentes_antes` integer, `etiqueta_presente` boolean, `posicao_correta` boolean
   - **Preço da gôndola** (o preço da LOJA, não o seu): `preco_gondola` numeric, `preco_promocional` numeric
   - **Validade:** `lote` text, `validade_mais_proxima` date, `qty_avariada` integer, `qty_vencida` integer, `qty_proxima_vencimento` integer
   - **Depois:** `qty_retirada_deposito` integer, `qty_abastecida` integer, `saldo_deposito` integer, `frentes_depois` integer, `peps_aplicado` boolean, `reorganizado` boolean, `etiqueta_corrigida` boolean
   - `ruptura_status_antes` text, `ruptura_status_depois` text
   - `observacoes` text, `company_id`, `created_at`, `updated_at`
   - UNIQUE (visit_id, product_id)

3. **Classificação de ruptura — calculada no banco, não no frontend** (função ou coluna gerada):
   - `disponivel` — `qty_gondola > 0`
   - `ruptura_gondola` — `qty_gondola = 0` E `qty_deposito > 0`
   - `ruptura_total` — `qty_gondola = 0` E `qty_deposito = 0`
   - `nao_localizado` — o promotor não conseguiu confirmar a existência do produto
   - `fora_mix` — produto não autorizado para aquela loja

   Guardar o status **antes** e **depois** do atendimento.

4. **Estoque final da gôndola** = `qty_gondola_antes + qty_abastecida`. **Nunca permitir quantidade negativa** (CHECK constraint no banco, não só validação de tela).

5. View `vw_promoter_visit_mix` — o mix da loja para aquela visita, juntando `promoter_client_mix` com `vw_promoter_products`. **Sem preço nenhum.**

6. RLS igual às tabelas do Bloco 3. `promoter_client_mix`: leitura pelo promotor via view; escrita só `is_admin()`.

### FRONTEND

7. **Etapa 3 da visita — auditoria:**
   - Listar **apenas os produtos autorizados para aquela loja**
   - Um SKU por tela (não uma tabela gigante). Foto do produto, nome, peso, EAN.
   - Campos na ordem em que o promotor trabalha de verdade: quanto tem na gôndola → quanto tem no depósito → frentes → etiqueta → preço da gôndola → validade/lote → avaria
   - O status da ruptura aparece **automaticamente** conforme ele digita, com cor. Ele não escolhe o status.
   - Marcar SKU como "não localizado" em um toque.

8. **Etapa de abastecimento** (só para os SKUs com `ruptura_gondola` ou frentes abaixo do mínimo):
   - quanto tirou do depósito, quanto colocou na gôndola, frentes depois, PEPS aplicado, reorganizado, etiqueta corrigida
   - o estoque final calcula sozinho na tela; nunca aceitar negativo

9. **Ruptura total:** ao marcar `ruptura_total`, o app **exige duas fotos** — foto do SKU e foto da gôndola vazia — antes de deixar avançar. (O alerta ao representante é o Bloco 5; aqui só as fotos e o registro.)

10. Admin: gerenciar o mix por loja (`promoter_client_mix`), inclusive em lote.

### VALIDAÇÃO
- `typecheck` + `build`
- Auditar 3 SKUs: um disponível, um com ruptura de gôndola, um com ruptura total → conferir que o status foi classificado **pelo banco** e está certo
- Ruptura total sem as duas fotos → bloqueado
- Abastecer: conferir `qty_gondola_antes + qty_abastecida` e que negativo é rejeitado **pelo banco**
- **Reteste do horizonte de dados:** logado como promotor, tentar ler `price_lists` e `products` diretamente → negado/vazio. `vw_promoter_visit_mix` não traz coluna de preço.
- Contar policies: as 99 originais intactas

### NÃO FAÇA NESTE BLOCO
Alerta ao representante, chat, concorrente, Loja Perfeita, dashboard.

---

## BLOCO 5 — Ruptura total → alerta ao representante + conversa no SKU

### PRÉ-CHECK
`promoter_visit_audits` existe e classifica `ruptura_total` corretamente. Se não, pare.

### OBJETIVO
**Este é o bloco que diferencia o produto.** Nem a Involves nem a Softbuilder ligam promotor e vendedor em tempo real: a Involves não faz força de vendas, e a Softbuilder vende os dois como produtos separados. Aqui o promotor marca a falta às 9h e o representante recebe a venda às 9h01, no mesmo histórico do mesmo cliente.

**Regra que sustenta tudo:** só a **ruptura total** gera alerta. Ruptura de gôndola com produto no depósito o promotor resolve sozinho — é o trabalho dele, não é notícia. Se alertar toda ruptura, o representante silencia o app em uma semana e a função morre.

### BANCO

1. `promoter_incidents` (ocorrências):
   - `id` uuid PK, `visit_id` uuid REFERENCES promoter_visits(id)
   - `representative_client_id` uuid NOT NULL, `product_id` uuid REFERENCES products(id)
   - `promoter_id` uuid NOT NULL REFERENCES promoters(id)
   - `assigned_representative_id` uuid REFERENCES representatives(id) — **preenchido automaticamente com o representante daquela loja**
   - `company_id` uuid
   - `category` text NOT NULL — `ruptura_total` / `ruptura_gondola` / `sem_etiqueta` / `preco_incorreto` / `avaria` / `vencimento` / `risco_vencimento` / `pedido_nao_entregue` / `fora_do_cadastro` / `falta_espaco` / `concorrente_no_espaco` / `nao_autorizado` / `material_ausente` / `manutencao` / `outro`
   - `priority` text NOT NULL DEFAULT 'normal'
   - `description` text
   - `status` text NOT NULL DEFAULT 'aberta' — `aberta` / `em_analise` / `aguardando_loja` / `aguardando_comercial` / `resolvida` / `cancelada`
   - `resolution` text, `opened_at`, `closed_at`, `due_at`
   - `converted_to_order_id` uuid REFERENCES representative_orders(id) — o desfecho que interessa
   - Índices: `(assigned_representative_id, status)`, `(representative_client_id)`

2. **Trigger:** ao inserir/atualizar `promoter_visit_audits` com `ruptura_status_antes = 'ruptura_total'`, criar automaticamente um `promoter_incidents` com `category='ruptura_total'`, `priority='alta'`, e `assigned_representative_id` = o `representative_id` daquele cliente. Idempotente — não criar duplicado para o mesmo `(visit_id, product_id)`.

3. **Amarrar a conversa ao contexto** — adicionar em `chat_conversations` (aditivo, nulos):
   - `context_type` text — ex.: `'ruptura'`
   - `context_id` uuid — o `promoter_incidents.id`
   - `product_id` uuid REFERENCES products(id)
   - Índice em `(context_type, context_id)`

   Isso é o que faz a conversa nascer colada no SKU em falta em vez de ser chat solto. **Reusa tudo que já existe:** `chat_messages`, `chat_participants`, `is_chat_member()`, bucket `chat-media`, Edge Function `chat-upload`, Realtime de `lib/chat.ts`, componente `Messenger`. Não construir chat novo.

4. RPC `open_ruptura_chat(p_incident_id uuid)` — cria (ou retorna, se já existir) a conversa com `context_type='ruptura'`, `context_id = incident`, `product_id`, título = nome do SKU + nome da loja, participantes = o representante + o promotor. Ao criar, postar como primeira mensagem as fotos da ruptura (`sku_ruptura` e `gondola_antes`) e uma linha com loja, SKU e horário.

5. **View do alerta, só para o representante** — `vw_ruptura_alerts` (o promotor **não** tem acesso a esta view):
   - dados da ocorrência + loja + SKU + fotos
   - **última data de pedido** daquele produto naquele cliente (de `representative_orders` + `representative_order_items`)
   - **volume médio** que aquela loja compra daquele produto
   - se a visita ainda está `em_atendimento` (a janela "o promotor está na loja agora")
   - RLS: `assigned_representative_id = my_rep_id()` OU `is_admin()` OU `has_role('supervisor')`

6. RLS de `promoter_incidents`:
   - promotor: INSERT e SELECT das próprias (`promoter_id = my_promoter_id()`); **não vê** `converted_to_order_id` (via view separada, ou omitir a coluna da view dele)
   - representante: SELECT/UPDATE onde `assigned_representative_id = my_rep_id()`
   - admin e supervisor: tudo

### FRONTEND

7. **RepCo — alerta de ruptura em tempo real:**
   - Realtime em `promoter_incidents` filtrado pelo representante logado (mesmo padrão de `lib/chat.ts`)
   - Badge no menu do RepCo + toast (`sonner`) quando chega
   - Nova aba/seção **"Rupturas"** no `RepCoDashboard`

8. **Card do alerta** — o conteúdo vale mais que a notificação. Tem que trazer:
   - loja, SKU, horário
   - **foto do SKU e foto da gôndola vazia**
   - **data do último pedido** daquele produto naquela loja
   - **volume médio** que a loja compra
   - **selo "o promotor está na loja agora"** enquanto a visita estiver `em_atendimento`
   - **botão "Abrir conversa"** → chama `open_ruptura_chat` e abre o `Messenger` já naquela conversa
   - **botão "Gerar pedido"** → abre o `RepCoNewOrder` já com o cliente e o SKU preenchidos; ao concluir, gravar `converted_to_order_id` na ocorrência e marcar `status='resolvida'`

9. **Promotor:** aba "Ocorrências" — abrir ocorrência manual (as categorias da lista), ver as próprias, e responder na conversa. **Sem** ver pedido, valor ou desfecho comercial.

10. **Timeline da loja** (Admin e RepCo, na ficha do cliente): visitas do representante + visitas do promotor + pedidos + rupturas + ocorrências + fotos, em ordem cronológica. É isto que o WhatsApp não faz e que justifica o chat interno: daqui a seis meses, abrir o cliente e ver "em março teve ruptura total do SKU X, o representante respondeu, virou pedido".

### VALIDAÇÃO
- `typecheck` + `build`
- Marcar `ruptura_gondola` (com depósito) → **NÃO** pode gerar ocorrência nem alerta
- Marcar `ruptura_total` → ocorrência criada sozinha, atribuída ao representante certo, alerta chega em tempo real
- Card traz as duas fotos, último pedido e volume médio corretos
- Com a visita `em_atendimento`, o selo "está na loja agora" aparece; após o check-out, some
- "Abrir conversa" → conversa criada com `context_type='ruptura'` e as fotos como primeira mensagem; os dois conversam em tempo real
- "Gerar pedido" → pedido pré-preenchido; ao concluir, `converted_to_order_id` gravado e ocorrência resolvida
- **Reteste do horizonte de dados:** o promotor, dentro da conversa, não consegue ler `vw_ruptura_alerts`, `representative_orders` nem `converted_to_order_id`
- Contar policies: as 99 originais intactas

### NÃO FAÇA NESTE BLOCO
Loja Perfeita, concorrente, dashboard, notificação push.

---

## BLOCO 6 — Dashboard do supervisor

### PRÉ-CHECK
Blocos 3, 4 e 5 validados, com pelo menos 2 visitas concluídas de teste no banco. Se não, pare.

### OBJETIVO
Dar ao supervisor e ao admin a visão da operação. **Ler de views, não recalcular no frontend.**

### BANCO

1. Views agregadas (padrão dos `vw_repco_*` que já existem):
   - `vw_promoter_coverage` — visitas programadas, realizadas, não realizadas, taxa de cobertura, por promotor/período
   - `vw_promoter_time` — tempo médio em loja, visitas fora da geocerca
   - `vw_ruptura_by_product` / `vw_ruptura_by_client` / `vw_ruptura_by_region`
   - `vw_promoter_stock_ops` — quantidade abastecida, frentes antes x depois
   - `vw_promoter_expiry` — produtos próximos do vencimento, avarias
   - `vw_promoter_incidents_summary` — abertas, resolvidas, **convertidas em pedido** (o KPI que importa)

2. RLS: `is_admin()` ou `has_role('supervisor')`. **Nada disso é acessível ao promotor.**

### FRONTEND

3. Seção **"Promotores"** no `AdminDashboard`, com filtros: período, empresa, marca, rede, loja, UF, cidade, promotor, representante, produto, status.
4. Mapa (Leaflet, já em uso) com as lojas visitadas no dia e o estado ao vivo dos promotores.
5. Comparativo foto antes x foto depois, lado a lado, na ficha da visita.

### VALIDAÇÃO
`typecheck` + `build`. Conferir os números do dashboard contra um `SELECT` direto no banco. Logado como promotor, a seção não aparece e as views retornam negado.

### NÃO FAÇA NESTE BLOCO
Loja Perfeita, concorrente, exportação, alerta por e-mail.

---

## BLOCO 7 — Camada 3: RLS multi-tenant no banco

### PRÉ-CHECK
Blocos 0 a 6 validados e em uso.

### OBJETIVO
Hoje o `company_id` existe nas tabelas, mas **o filtro por empresa é feito no client (JavaScript)**. Isso funciona enquanto os usuários são de casa. Deixa de funcionar no momento em que existir usuário de fora — promotor terceirizado, ou outra empresa usando a plataforma.

**Este bloco é pré-requisito obrigatório para: (a) promotor externo/terceirizado; (b) vender o RepCo para outra empresa.** Enquanto for só promotor interno da Saporino, pode esperar — mas não pode ser esquecido.

### ESCOPO
Impor `company_id` nas policies de RLS das tabelas core (`representative_clients`, `representative_orders`, `representative_order_items`, `products`, `price_lists`, `representative_commissions`, e todas as `promoter_*`), sem quebrar o que funciona. Fazer tabela por tabela, com validação a cada uma. **Este bloco merece um documento próprio quando chegar a vez.**

---

## DECISÕES PARQUEADAS (não implementar; registro para não se perder)

| Item | Decisão | Quando |
|---|---|---|
| **GPS em background / linha contínua do deslocamento** | Impossível em navegador. Exige casca nativa (**Capacitor**), que embrulha o app React existente sem reescrever nada. A tabela `promoter_visit_locations` (Bloco 3) já está pronta para receber; só o coletor muda. | Quando houver equipe de promotores e um supervisor cobrando a linha. Não antes. |
| **Publicação na Google Play** | Só depois do app rodando redondo. Distribuição segue pelo navegador até lá. **PWABuilder/TWA não resolve GPS em background** — embrulha o Chrome, e o conteúdo continua sendo web. Se o objetivo for GPS em background, o caminho é Capacitor, não PWABuilder. | Depois |
| **Offline de dia inteiro** | Rota, clientes, produtos e fotos no celular + fila de sincronização + resolução de conflito. Projeto próprio, com bugs próprios. O service worker já quebrou este app antes (tela branca) e hoje o `index.html` mata SW de propósito. O Bloco 3 entrega o "offline pequeno" (rascunho local + reenvio), que cobre o caso real de sinal caindo por dois minutos. | Depois, isolado |
| **Loja Perfeita** (pontuação configurável por pilar) | Bom ativo comercial, copiado da Involves. Depende de auditoria + mix + frentes mínimas, que os Blocos 4 e 6 entregam. | Fase 2 |
| **Pesquisa de concorrente** (preço, frentes, ponto extra, lançamento, degustação) | Configurável por rede/loja/campanha. Alimenta a inteligência de preço que já existe. | Fase 2 |
| **Nível de atendimento por PDV** (frequência esperada de visita → taxa de aderência) | Conceito mais forte da Involves. Vira KPI de gestão. | Fase 2 |
| **Formulários/checklist configuráveis** | Tipos de pergunta que cobrem o mercado: objetiva, sim/não, lista, conforme / não conforme / não se aplica. | Fase 2 |
| **Produto foco por período** | Campanha de SKU com data de início e fim — o gancho entre representante e promotor. Barato, alto valor comercial. | Fase 2 |
| **Roteirização automática** | A arquitetura (`promoter_routes` + `promoter_visits` + `stop_order`) já comporta. O algoritmo não entra agora. | Fase 3 |
| **Reconhecimento de imagem de gôndola** | **Não perseguir.** A Involves processa milhões de fotos por mês para treinar isso. Não é um sprint, é uma empresa. | Não fazer |
| **Chat livre entre promotor e representante** | Não. A conversa nasce amarrada ao SKU/ocorrência (Bloco 5) — auditável e dentro da timeline da loja. Chat solto perde o contexto, que é justamente o diferencial contra o WhatsApp. | Não fazer |
