# ESTADO ATUAL — Café Saporino / website_project

> Levantamento factual do estado do projeto (só leitura; nenhuma implementação nesta rodada).
> Gerado em 2026-07-16. Idioma: PT-BR. Método: varredura do código (`src`, `pages`, `contexts`, `hooks`, `lib`, `supabase/functions`, `supabase/migrations`) + introspecção ao vivo do banco Supabase (tabelas, colunas, RLS, policies, buckets).
>
> **Observação:** o arquivo pedido `CLAUDE_INSTRUCTIONS.md` **não existe** no repositório. O que existe é `CLAUDE.md` (instruções do projeto), além de `README.md`, `CHECKLIST.md`, `SUPABASE_SETUP.md` e `SUPABASE_STORAGE.md`. Este documento seguiu o `CLAUDE.md`.

---

## 1. ARQUITETURA

**Stack real em uso**
- **Frontend:** React 18.3 + TypeScript + Vite 5.4 + Tailwind 3.4.
- **Backend (BaaS):** Supabase — Auth, Postgres, Realtime, Storage e Edge Functions (Deno).
- **Deploy:** Vercel (auto-deploy no `push` para `main`).
- **Bibliotecas efetivamente usadas:** `@supabase/supabase-js`, `@mercadopago/sdk-react`, `leaflet` + `react-leaflet` (mapas OSM), `lucide-react` (ícones), `sonner` (toasts), `papaparse` (CSV), `xlsx` (import dinâmico), `jsbarcode` (EAN13).
- **Instalado mas NÃO usado:** `react-router-dom@7.9.4` — nenhum import no código (roteamento é manual, ver §4). `vite-plugin-pwa@1.3.0` está instalado mas **desativado** (comentado no `vite.config.ts`).

**Estrutura de pastas (`src/`)**
- `App.tsx` — roteador manual + a home (`AppContent`) + Footer.
- `main.tsx` — bootstrap React.
- `types.ts` — interfaces (`Product`, `CartItem`, `UserProfile`, `Order`, `Subscription`, `UserAddress`).
- `components/` — ~65 componentes: raiz (~9: AuthModal, CompanySwitcher, ProductDetail, StoreLocator, SubscriptionCheckout, PromoPopup, CookieConsent, NotFound, CurrencyInput), `admin/` (~36), `repco/` (~19), `chat/` (1: Messenger).
- `pages/` — ~14 páginas (AdminDashboard, RepCoDashboard, RepCoIntelligence, RepCoCoverageMap, SubscriptionPage, UserProfile, HistoryPage, OrderDetailPage, TrackingPage, ResetPassword, PaymentPages, PolicyPages, BrandPage).
- `contexts/` — 3: `AuthContext`, `CartContext`, `CompanyContext`.
- `hooks/` — 3: `useGeolocation`, `usePresence`, `usePushNotifications`.
- `lib/` — ~14 arquivos de dados/serviço: `supabase.ts` (client singleton), `chat.ts`, `shipping.ts`, `mercadopago.ts`, `cnpjLookup.ts`, `leadMatch.ts`, `foodRelevance.ts`, `importApifyLeads.ts`, `promoteProspects.ts`, `geocodeClient.ts`, `trackVisit.ts`, `tracking.ts`, `training.ts`, `bannerButton.ts`.
- `utils/` — `currency.ts`, `routeOptimizer.ts`, `calendarLinks.ts`, `invoiceShare.ts`.
- `constants/` — `segments.ts`, `prospectKeywords.ts`.

**Padrão de componentes:** 100% funcionais + hooks; **nenhum componente de classe**. Mistura de `export default` e named exports. Organização por domínio (`admin/`, `repco/`, `chat/`).

**UI / tema / design tokens:** `tailwind.config.js` está com `theme.extend: {}` **vazio** — **não há design tokens**. A cor da marca (`#8B2214`, `#a4240e` legado, `#f8f7f5` fundo) é aplicada como **classe inline arbitrária** (`text-[#8B2214]`, `bg-[#f8f7f5]`) espalhada pelos componentes. **Não há biblioteca de componentes** (sem shadcn/radix/headlessui) — tudo hand-rolled. Ícones via `lucide-react`. Tokens/reg’ras de design vivem só no `CLAUDE.md`, não no código.

**Gerenciamento de estado:** só React Context + `useState`/`useEffect`. **Não há** Redux/Zustand nem React Query/SWR — **estado de servidor é manual** (`useState` + `useEffect` + `supabase.from(...)` em cada componente). Contexts:
- `AuthContext` — `user`, `session`, `profile`, `loading`; `signIn/signUp/signOut/updateProfile/resetPassword`.
- `CartContext` — carrinho B2C persistido em `localStorage` (`saporino-cart`).
- `CompanyContext` — multi-empresa: `companies`, `activeCompanyId`, `activeCompany`, `storeCompanyId`; persist em `localStorage` (`active-company-id`).
- **Realtime** usado em `lib/chat.ts` (mensagens) e `lib/training.ts` (espelho de treinamento).

**Organização das chamadas ao Supabase:** um único client singleton (`src/lib/supabase.ts`, chave anônima). **Dois padrões convivem:** (1) `supabase.from(...)` **direto dentro dos componentes** (maioria das telas admin/repco); (2) **camada de serviço** em `src/lib/*.ts` (ex.: `chat.ts` com RPCs + Realtime, `shipping.ts`, `cnpjLookup.ts`). Não há uma camada de serviço unificada — é misto. DDL/DML de produção roda por RPCs `exec_migration`/`exec_select` (documentado no `CLAUDE.md`).

---

## 2. AUTENTICAÇÃO E PERMISSÕES

**Login:** Supabase Auth nativo. `AuthContext` obtém sessão via `supabase.auth.getSession()` e escuta `onAuthStateChange`; carrega o perfil de `user_profiles`. `AuthModal` tem 3 modos: login, cadastro e "esqueci a senha". **Recuperação de senha** não usa o e-mail padrão do Supabase — chama a Edge Function `send-password-reset` (Resend) que gera o link e redireciona para `/reset-password`.

**Onde mora o papel do usuário:** **não há RBAC formal nem enum de papéis.** O papel é derivado de dois lugares:
- **Admin:** coluna booleana `user_profiles.is_admin`.
- **Representante:** existência de linha em `representatives` com `status` ∈ {`pending`, `active`, `blocked`}.
- **Cliente:** usuário autenticado sem registro em `representatives`.
- O papel **`director`** citado no blueprint (§15 do CLAUDE.md) **não existe** no código nem no banco — só `is_admin`.
- Funções de segurança no banco: `public.is_admin()` e `public.my_rep_id()` (usadas nas policies de RLS).

**Como as telas decidem o que mostrar:** **if/else espalhado** sobre `profile?.is_admin` e sobre `rep.status`, não um sistema de permissões. Exemplos:
- `AdminDashboard.tsx` — aguarda `loading=false` e checa `!user || !profile?.is_admin` → mostra "Acesso Negado".
- `RepCoIntelligence.tsx` / `RepCoCoverageMap.tsx` — checam `profile?.is_admin` inline (cadeado "Painel do Diretor Comercial — acesso restrito").
- `AuthModal` — admin é barrado no login "cliente" e redirecionado.
- A verdadeira barreira de dados é a **RLS no banco** (ver §3), não o React.

**Gate do representante (RepCo):** cadastro **só por código de convite**. Fluxo em `RepCoDashboard`: sem rep → tela "só por convite" + formulário de código → RPC `repco_validate_invite` e `repco_register_with_code`; `status='pending'` → "Cadastro em análise"; `blocked` → "Acesso bloqueado"; `active` → portal liberado (aí sim ativa GPS/presença). Códigos ficam em `repco_invite_codes` (24h, uso único).

---

## 3. BANCO DE DADOS

> Introspecção ao vivo (Supabase). **50 tabelas**, **13 views**, **1 materialized view**, **99 policies de RLS**, **8 buckets de storage**. Notação de colunas: `nome:tipo` (`!` = NOT NULL). Só as policies têm o texto colado; para não estourar, expressões longas foram truncadas.

**RLS:** ligada em **49 das 50 tabelas**. A única com RLS **desligada** é `company_order_counters` (tabela interna de contador de numeração de pedido por empresa — sem dado sensível; só o trigger `generate_repco_order_number` escreve nela). Correção nesta seção em relação ao histórico: onde antes se dizia "45/45", a base cresceu para **50 tabelas** (novas: chat, help, prospects_b2b, company_order_counters, representative_company_settings etc.).

**Destaques pedidos:**
- **`user_profiles`** — perfil do cliente/admin; papel via `is_admin`. FK para `auth.users`.
- **`representative_clients`** — clientes do rep (CNPJ/CPF, segmento, forma/prazo de pagamento, score, `company_id`, e agora `desconto_financeiro_pct`/`desconto_logistico_pct`/`bonificacao_padrao`).
- **`products`** — catálogo; tem `company_id` (multi-empresa) e `hidden_from_store`/`is_active`.
- **`distributed_brands`** — marcas distribuídas exibidas no rodapé (liga/desliga no admin).
- **`orders`/`order_items`** — pedidos B2C (loja); **`representative_orders`/`representative_order_items`** — pedidos B2B (RepCo), com `company_id` e numeração `CS-/CF-`.
- **`representative_commissions` / `representative_commission_payouts`** — motor de comissão (por empresa, via triggers no banco).
- **`companies` + `company_id`** — fundação multi-empresa (Saporino/Fazendinha); presente nas tabelas core.
- **PDVs de SP:** os pontos de venda ficam na **view `points_of_sale`** (e a UI é `PointsOfSaleManager`/`StoreLocator`); a prospecção pública em massa está em **`prospects_b2b`** (~728 mil linhas, base CNPJ) e em `prospect_leads` (leads trabalháveis).

O detalhamento tabela a tabela (colunas, FKs, índices, policies) segue abaixo.


### Índice de tabelas (RLS + policies)

| Tabela | RLS | Linhas~ | Nº policies |
|---|---|---|---|
| `batch_photos` | 🔒 ON | ? | 1 |
| `chat_conversations` | 🔒 ON | ? | 1 |
| `chat_messages` | 🔒 ON | ? | 2 |
| `chat_participants` | 🔒 ON | ? | 1 |
| `coffee_market_index` | 🔒 ON | ? | 1 |
| `companies` | 🔒 ON | ? | 2 |
| `company_order_counters` | ⚠️ OFF | ? | 0 |
| `distributed_brands` | 🔒 ON | ? | 2 |
| `ecommerce_price_snapshots` | 🔒 ON | 4215 | 2 |
| `ecommerce_sources` | 🔒 ON | 16 | 2 |
| `green_coffee_lots` | 🔒 ON | ? | 1 |
| `ibge_municipios` | 🔒 ON | 5571 | 1 |
| `invoices` | 🔒 ON | ? | 3 |
| `lead_rf_candidates` | 🔒 ON | ? | 1 |
| `lot_documents` | 🔒 ON | ? | 3 |
| `lot_transfers` | 🔒 ON | ? | 5 |
| `order_items` | 🔒 ON | ? | 2 |
| `orders` | 🔒 ON | ? | 4 |
| `popup_settings` | 🔒 ON | ? | 2 |
| `price_lists` | 🔒 ON | 3 | 2 |
| `products` | 🔒 ON | 9 | 2 |
| `promo_banners` | 🔒 ON | 7 | 2 |
| `prospect_leads` | 🔒 ON | 67 | 3 |
| `prospect_lists` | 🔒 ON | 0 | 2 |
| `prospect_runs` | 🔒 ON | ? | 1 |
| `prospects_b2b` | 🔒 ON | 728218 | 1 |
| `rep_daily_plans` | 🔒 ON | ? | 2 |
| `repco_help_articles` | 🔒 ON | ? | 2 |
| `repco_invite_codes` | 🔒 ON | ? | 0 |
| `representative_clients` | 🔒 ON | 2 | 4 |
| `representative_commission_payouts` | 🔒 ON | 1 | 2 |
| `representative_commissions` | 🔒 ON | 2 | 2 |
| `representative_company_settings` | 🔒 ON | ? | 0 |
| `representative_documents` | 🔒 ON | ? | 3 |
| `representative_order_installments` | 🔒 ON | 2 | 1 |
| `representative_order_items` | 🔒 ON | 2 | 3 |
| `representative_order_notes` | 🔒 ON | ? | 2 |
| `representative_orders` | 🔒 ON | 4 | 2 |
| `representative_routes` | 🔒 ON | ? | 2 |
| `representatives` | 🔒 ON | 2 | 5 |
| `roasting_companies` | 🔒 ON | ? | 1 |
| `roasting_company_contacts` | 🔒 ON | ? | 1 |
| `route_stops` | 🔒 ON | ? | 2 |
| `shipments` | 🔒 ON | ? | 4 |
| `shipping_carriers` | 🔒 ON | ? | 2 |
| `site_settings` | 🔒 ON | ? | 2 |
| `site_visits` | 🔒 ON | 169 | 2 |
| `subscription_settings` | 🔒 ON | ? | 2 |
| `subscriptions` | 🔒 ON | ? | 3 |
| `user_profiles` | 🔒 ON | ? | 1 |

**Total: 50 tabelas.** RLS OFF em: `company_order_counters`.

**Views (13):** `client_sales_history`, `points_of_sale`, `vw_ecommerce_latest`, `vw_repco_clientes_ativos_por_area`, `vw_repco_clientes_bloqueados`, `vw_repco_clientes_geo`, `vw_repco_cobertura`, `vw_repco_leads_geo`, `vw_repco_preco_praticado`, `vw_repco_vendas_por_area`, `vw_repco_vendas_por_canal`, `vw_repco_vendas_por_linha`, `vw_repco_vendas_por_rep`.

**Materialized view:** `mv_repco_prospects_muni`.

### Storage buckets

| Bucket | Acesso |
|---|---|
| `batch-photos` | público |
| `carrier-logos` | público |
| `chat-media` | público |
| `invoices` | privado |
| `lot-documents` | privado |
| `product-images` | público |
| `representative-docs` | privado |
| `visit-photos` | público |

---

### Detalhe por tabela (colunas · FKs · índices · policies)

#### `batch_photos` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `batch_id`:uuid · `photo_url`:text! · `photo_type`:text · `caption`:text · `taken_at`:timestamp with time zone · `uploaded_by`:uuid · `company_id`:uuid

**FKs:** (batch_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE · (uploaded_by) REFERENCES auth.users(id) · (company_id) REFERENCES companies(id)

**Policies:**
- `Admin manages batch photos` [ALL] {authenticated} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`

#### `chat_conversations` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `type`:text! · `name`:text · `avatar_url`:text · `created_by`:uuid · `created_at`:timestamp with time zone · `last_message_at`:timestamp with time zone · `last_message_preview`:text · `company_id`:uuid

**FKs:** (company_id) REFERENCES companies(id) ON DELETE CASCADE

**Policies:**
- `chat_conv_sel` [SELECT] {authenticated} — USING: `is_chat_member(id)`

#### `chat_messages` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `conversation_id`:uuid · `sender_id`:uuid! · `body`:text · `attachment_url`:text · `attachment_type`:text · `attachment_name`:text · `attachment_size`:integer · `created_at`:timestamp with time zone

**FKs:** (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE

**Policies:**
- `chat_msg_ins` [INSERT] {authenticated} — CHECK: `(is_chat_member(conversation_id) AND (sender_id = auth.uid()))`
- `chat_msg_sel` [SELECT] {authenticated} — USING: `is_chat_member(conversation_id)`

#### `chat_participants` — 🔒 RLS ON

**Colunas:** `conversation_id`:uuid! · `user_id`:uuid! · `role`:text · `last_read_at`:timestamp with time zone · `joined_at`:timestamp with time zone

**FKs:** (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE

**Policies:**
- `chat_part_sel` [SELECT] {authenticated} — USING: `is_chat_member(conversation_id)`

#### `coffee_market_index` — 🔒 RLS ON

**Colunas:** `id`:bigint! · `ref_date`:date! · `arabica`:numeric · `conilon`:numeric · `source`:text · `note`:text · `created_at`:timestamp with time zone! · `arabica_var`:numeric · `conilon_var`:numeric

**Policies:**
- `Admin all coffee_index` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `companies` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `cnpj`:text · `created_at`:timestamp with time zone! · `fantasia`:text · `logo_url`:text · `endereco`:text · `cidade`:text · `uf`:text · `cep`:text · `is_active`:boolean! · `sort_order`:integer · `commission_model`:text! · `allow_cash`:boolean! · `is_b2c`:boolean! · `order_prefix`:text

**Policies:**
- `admin all companies` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `public read companies` [SELECT] {public} — USING: `true`

#### `company_order_counters` — ⚠️ RLS OFF

**Colunas:** `company_id`:uuid! · `last_number`:integer!

**FKs:** (company_id) REFERENCES companies(id) ON DELETE CASCADE

#### `distributed_brands` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `url`:text · `sort_order`:integer · `is_active`:boolean! · `created_at`:timestamp with time zone

**Policies:**
- `dist_brands_read` [SELECT] {public} — USING: `true`
- `dist_brands_write` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `ecommerce_price_snapshots` — 🔒 RLS ON

**Colunas:** `id`:bigint! · `company_id`:uuid! · `captured_at`:timestamp with time zone! · `marketplace`:text! · `search_term`:text · `listing_sku`:text! · `title`:text! · `thumb_url`:text · `url`:text · `domain_id`:text · `price`:numeric! · `price_before`:numeric · `discount_pct`:integer · `currency`:text · `search_position`:integer · `is_sponsored`:boolean · `weight_g`:numeric · `unit_type`:text · `is_arabica`:boolean · `price_per_kg`:numeric · `is_suspect`:boolean · `raw`:jsonb! · `created_at`:timestamp with time zone!

**Policies:**
- `Admin all eps` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`
- `Reps read visible snapshots` [SELECT] {authenticated} — USING: `(marketplace IN ( SELECT ecommerce_sources.marketplace FROM ecommerce_sources WHERE ecommerce_sources.visible_to_reps))`

#### `ecommerce_sources` — 🔒 RLS ON

**Colunas:** `marketplace`:text! · `label`:text! · `actor_id`:text · `default_input`:jsonb · `enabled`:boolean! · `updated_at`:timestamp with time zone! · `kind`:text! · `visible_to_reps`:boolean! · `sort_order`:integer!

**Policies:**
- `Admin all sources` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`
- `Reps read visible sources` [SELECT] {authenticated} — USING: `visible_to_reps`

#### `green_coffee_lots` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `batch_number`:text! · `product_id`:uuid · `product_name`:text · `status`:text! · `supplier_name`:text · `supplier_city`:text · `supplier_state`:text · `variety`:text · `altitude_meters`:integer · `supplier_certifications`:ARRAY · `green_weight_kg`:numeric! · `green_cost_per_kg`:numeric! · `green_total_cost`:numeric · `roast_date`:date · `roasted_by`:text · `roasted_weight_kg`:numeric · `roast_loss_pct`:numeric · `roast_cost`:numeric · `roast_profile`:text · `roast_temperature`:numeric · `roast_duration_minutes`:integer · `pkg_cost_250g`:numeric · `pkg_cost_500g`:numeric · `pkg_cost_1kg`:numeric · `pkg_cost_fardo5kg`:numeric · `label_cost_per_unit`:numeric · `plastic_wrap_cost_per_unit`:numeric · `fuel_cost`:numeric · `toll_cost`:numeric · `hotel_cost`:numeric · `food_cost`:numeric · `other_costs`:jsonb · `samples_given_units`:integer · `samples_unit_size_g`:integer · `bonus_given_units`:integer · `bonus_unit_size_g`:integer · `total_variable_cost`:numeric · `total_bonus_cost`:numeric · `cost_per_100g`:numeric · `cost_per_250g`:numeric · `cost_per_500g`:numeric · `cost_per_1kg`:numeric · `cost_per_fardo5kg`:numeric · `units_produced_250g`:integer · `units_produced_500g`:integer · `units_produced_1kg`:integer · `units_produced_fardo5kg`:integer · `production_date`:date · `expiry_date`:date · `nf_purchase_url`:text · `supplier_certificate_url`:text · `quality_report_url`:text · `sensory_notes`:text · `sca_score`:numeric · `photo_urls`:ARRAY · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `created_by`:uuid · `roasting_company_id`:uuid · `farm_name`:text · `farm_city`:text · `farm_state`:text · `altitude_m`:integer · `quantity_packages`:integer · `nf_url`:text · `notes`:text · `ap_percentage`:numeric · `price_per_point`:numeric · `total_paid_brl`:numeric · `logistics_cost_brl`:numeric · `logistics_breakdown`:jsonb · `green_input_to_roast_kg`:numeric · `service_price_per_kg`:numeric · `roasted_output_kg`:numeric · `packaged_kg`:numeric · `packaging_cost_per_kg`:numeric · `packaging_date`:date · `cost_per_kg_verde_puro`:numeric · `cost_per_kg_verde_efetivo`:numeric · `shrinkage_pct`:numeric · `service_total_cost_brl`:numeric · `sobra_torrado_kg`:numeric · `green_remaining_kg`:numeric · `company_id`:uuid

**FKs:** (product_id) REFERENCES products(id) · (company_id) REFERENCES companies(id) · (roasting_company_id) REFERENCES roasting_companies(id) · (created_by) REFERENCES auth.users(id)

**Policies:**
- `Admin manages batches` [ALL] {authenticated} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`

#### `ibge_municipios` — 🔒 RLS ON

**Colunas:** `codigo_ibge`:text! · `uf`:text! · `nome`:text! · `nome_norm`:text! · `lat`:double precision · `lng`:double precision

**Policies:**
- `Admin read ibge_municipios` [SELECT] {authenticated} — USING: `is_admin()`

#### `invoices` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid · `invoice_number`:text! · `invoice_series`:text! · `invoice_key`:text! · `invoice_total`:numeric! · `invoice_xml_url`:text · `invoice_pdf_url`:text · `status`:text · `created_at`:timestamp with time zone

**FKs:** (order_id) REFERENCES orders(id) ON DELETE CASCADE

**Policies:**
- `Service role can manage invoices` [ALL] {public} — USING: `((auth.jwt() ->> 'role'::text) = 'service_role'::text)`
- `Users can view own order invoices` [SELECT] {public} — USING: `(order_id IN ( SELECT orders.id FROM orders WHERE (orders.user_id = auth.uid())))`
- `admin all invoices` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`

#### `lead_rf_candidates` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `lead_id`:uuid! · `rf_cnpj`:text! · `rf_razao`:text · `rf_fantasia`:text · `rf_bairro`:text · `rf_municipio`:text · `rf_uf`:text · `score`:numeric · `reason`:text · `status`:text! · `created_at`:timestamp with time zone! · `resolved_at`:timestamp with time zone

**FKs:** (lead_id) REFERENCES prospect_leads(id) ON DELETE CASCADE

**Policies:**
- `Admin all on lead_rf_candidates` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `lot_documents` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `lot_id`:uuid! · `kind`:text! · `storage_path`:text! · `file_name`:text · `uploaded_at`:timestamp with time zone · `company_id`:uuid

**FKs:** (lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE · (company_id) REFERENCES companies(id)

**Policies:**
- `lot_docs_delete` [DELETE] {authenticated} — USING: `true`
- `lot_docs_insert` [INSERT] {authenticated} — CHECK: `true`
- `lot_docs_select` [SELECT] {authenticated} — USING: `true`

#### `lot_transfers` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `from_lot_id`:uuid! · `to_lot_id`:uuid! · `kind`:text! · `kg_amount`:numeric! · `unit_cost_brl`:numeric! · `value_amount_brl`:numeric · `transferred_at`:timestamp with time zone! · `notes`:text · `company_id`:uuid

**FKs:** (company_id) REFERENCES companies(id) · (to_lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE · (from_lot_id) REFERENCES green_coffee_lots(id) ON DELETE CASCADE

**Policies:**
- `authenticated_delete` [DELETE] {authenticated} — USING: `true`
- `authenticated_insert` [INSERT] {authenticated} — CHECK: `true`
- `authenticated_read` [SELECT] {authenticated} — USING: `true`
- `authenticated_update` [UPDATE] {authenticated} — USING: `true` — CHECK: `true`
- `service_role_all` [ALL] {service_role} — USING: `true` — CHECK: `true`

#### `order_items` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid! · `product_id`:uuid · `product_name`:text! · `product_description`:text · `grind_type`:text · `quantity`:integer! · `unit_price`:numeric! · `subtotal`:numeric! · `created_at`:timestamp with time zone

**FKs:** (order_id) REFERENCES orders(id) ON DELETE CASCADE

**Policies:**
- `Anyone can insert order items` [INSERT] {public} — CHECK: `true`
- `Users can view items from their own orders` [SELECT] {public} — USING: `(EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()))))`

#### `orders` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `user_id`:uuid · `order_number`:text! · `total_amount`:numeric! · `status`:text! · `payment_method`:text · `mercadopago_preference_id`:text · `mercadopago_payment_id`:text · `mercadopago_collection_id`:text · `mercadopago_collection_status`:text · `external_reference`:text · `customer_name`:text! · `customer_email`:text! · `customer_phone`:text · `shipping_address`:text · `shipping_postal_code`:text · `shipping_city`:text · `shipping_state`:text · `shipping_number`:text · `shipping_neighborhood`:text · `shipping_complement`:text · `order_type`:text · `subscription_frequency`:text · `subscription_shipping_date`:integer · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `paid_at`:timestamp with time zone · `order_status`:text · `package_weight`:numeric · `package_height`:numeric · `package_width`:numeric · `package_length`:numeric · `label_url`:text · `label_format`:text · `dispatch_date`:timestamp with time zone · `delivered_at`:timestamp with time zone · `is_gift`:boolean · `shipping_recipient`:text · `shipping_carrier_id`:uuid · `shipping_carrier_name`:text · `shipping_cost`:numeric · `tracking_events`:jsonb · `channel`:text

**FKs:** (user_id) REFERENCES auth.users(id) ON DELETE SET NULL

**Policies:**
- `Anyone can insert orders` [INSERT] {public} — CHECK: `true`
- `System can update all orders` [UPDATE] {public} — USING: `true`
- `Users and system can view orders` [SELECT] {public} — USING: `((auth.uid() = user_id) OR (user_id IS NULL) OR true)`
- `Users can update their own orders` [UPDATE] {public} — USING: `(auth.uid() = user_id)`

#### `popup_settings` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `enabled`:boolean! · `image_url`:text · `eyebrow`:text · `headline`:text · `subtext`:text · `disclaimer`:text · `button_text`:text · `button_link`:text · `show_days`:integer! · `updated_at`:timestamp with time zone! · `name`:text! · `sort_order`:integer! · `logo_url`:text · `logo_scale`:numeric!

**Policies:**
- `popup_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `popup_public_read` [SELECT] {public} — USING: `true`

#### `price_lists` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `product_id`:uuid! · `segment`:text! · `price`:numeric! · `volume_discount`:numeric · `volume_min_qty`:integer · `is_active`:boolean · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `company_id`:uuid

**FKs:** (company_id) REFERENCES companies(id) · (product_id) REFERENCES products(id) ON DELETE CASCADE

**Policies:**
- `Admins manage price_lists` [ALL] {public} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`
- `Reps read price_lists` [SELECT] {public} — USING: `true`

#### `products` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `description`:text · `price`:numeric! · `promotional_price`:numeric · `image_url`:text · `weight_grams`:integer · `roast_type`:text · `flavor_notes`:jsonb · `in_stock`:boolean · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `is_active`:boolean · `featured`:boolean · `category`:text · `display_order`:integer · `discount_percentage`:numeric · `stock`:integer · `full_details`:text · `subscription_enabled`:boolean · `subscription_months`:integer · `subscription_discount_pct`:integer · `additional_images`:ARRAY · `barcode`:text · `product_line`:text · `company_id`:uuid · `pj_only`:boolean! · `hidden_from_store`:boolean!

**FKs:** (company_id) REFERENCES companies(id)

**Policies:**
- `Admin full access` [ALL] {public} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`
- `Public can view products` [SELECT] {public} — USING: `true`

#### `promo_banners` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `image_url`:text! · `title`:text · `link_url`:text · `sort_order`:integer! · `active`:boolean! · `created_at`:timestamp with time zone! · `button_text`:text · `button_link`:text · `button_x`:real! · `button_y`:real! · `button_scale`:real! · `overlay_image_url`:text · `overlay_x`:real! · `overlay_y`:real! · `overlay_scale`:real!

**Policies:**
- `promo_banners_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `promo_banners_public_read` [SELECT] {public} — USING: `(active = true)`

#### `prospect_leads` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `prospect_list_id`:uuid! · `representative_id`:uuid · `representative_client_id`:uuid · `company_name`:text! · `trade_name`:text · `cnpj`:text · `cpf`:text · `segment`:text · `category`:text · `source`:text · `address`:text · `number`:text · `complement`:text · `district`:text · `city`:text · `state`:text · `zip_code`:text · `lat`:numeric · `lng`:numeric · `geocode_status`:text! · `geocode_source`:text · `geocoded_at`:timestamp with time zone · `contact_name`:text · `phone`:text · `whatsapp`:text · `email`:text · `website`:text · `raw_data`:jsonb! · `status`:text! · `audit_notes`:text · `rejection_reason`:text · `visited_at`:timestamp with time zone · `qualified_at`:timestamp with time zone · `converted_at`:timestamp with time zone · `duplicate_of_lead_id`:uuid · `duplicate_of_client_id`:uuid · `created_by`:uuid · `created_at`:timestamp with time zone! · `updated_at`:timestamp with time zone! · `company_id`:uuid · `rf_cnpj`:text · `rf_razao`:text · `rf_match_status`:text!

**FKs:** (representative_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL · (representative_id) REFERENCES representatives(id) ON DELETE SET NULL · (prospect_list_id) REFERENCES prospect_lists(id) ON DELETE CASCADE · (company_id) REFERENCES companies(id) · (created_by) REFERENCES auth.users(id) · (duplicate_of_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL · (duplicate_of_lead_id) REFERENCES prospect_leads(id) ON DELETE SET NULL

**Policies:**
- `Admin can do everything on prospect_leads` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`
- `RepCo can update assigned prospect_leads` [UPDATE] {authenticated} — USING: `((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id FROM prospect_lists WHERE (prospect_lists.assigned_representative_id = my_rep_id()))))` — CHECK: `((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id FROM prospect_lists WHERE (prospec`
- `RepCo can view assigned prospect_leads` [SELECT] {authenticated} — USING: `((representative_id = my_rep_id()) OR (prospect_list_id IN ( SELECT prospect_lists.id FROM prospect_lists WHERE (prospect_lists.assigned_representative_id = my_rep_id()))))`

#### `prospect_lists` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `description`:text · `segment`:text · `source_type`:text! · `source_name`:text · `status`:text! · `assigned_representative_id`:uuid · `total_count`:integer! · `pending_count`:integer! · `converted_count`:integer! · `rejected_count`:integer! · `duplicate_count`:integer! · `invalid_count`:integer! · `created_by`:uuid · `created_at`:timestamp with time zone! · `updated_at`:timestamp with time zone! · `completed_at`:timestamp with time zone · `company_id`:uuid

**FKs:** (created_by) REFERENCES auth.users(id) · (assigned_representative_id) REFERENCES representatives(id) ON DELETE SET NULL · (company_id) REFERENCES companies(id)

**Policies:**
- `Admin can do everything on prospect_lists` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`
- `RepCo can view assigned prospect_lists` [SELECT] {authenticated} — USING: `(assigned_representative_id = my_rep_id())`

#### `prospect_runs` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `requested_by`:uuid · `uf`:text · `municipio`:text · `bairro`:text · `category`:text · `keywords`:ARRAY! · `max_places`:integer! · `keyword_count`:integer! · `places_estimate`:integer! · `cost_estimate_usd`:numeric! · `apify_run_id`:text · `apify_dataset_id`:text · `status`:text! · `places_returned`:integer · `leads_created`:integer · `leads_duplicated`:integer · `error_message`:text · `prospect_list_id`:uuid · `representative_id`:uuid · `company_id`:uuid · `created_at`:timestamp with time zone! · `finished_at`:timestamp with time zone

**FKs:** (prospect_list_id) REFERENCES prospect_lists(id) ON DELETE SET NULL · (requested_by) REFERENCES auth.users(id) · (representative_id) REFERENCES representatives(id) ON DELETE SET NULL

**Policies:**
- `Admin all on prospect_runs` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `prospects_b2b` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `cnpj`:text! · `cnpj_basico`:text · `razao_social`:text · `nome_fantasia`:text · `cnae_principal`:text · `cnae_descricao`:text · `situacao_cadastral`:text · `data_inicio_atividade`:date · `tipo_logradouro`:text · `logradouro`:text · `numero`:text · `complemento`:text · `bairro`:text · `municipio_rf_code`:text · `municipio`:text · `uf`:text · `cep`:text · `telefone`:text · `email`:text · `lat`:double precision · `lng`:double precision · `geocode_status`:text! · `is_client`:boolean! · `fonte`:text! · `atualizado_em`:timestamp with time zone! · `company_id`:uuid · `created_at`:timestamp with time zone! · `covered_at`:timestamp with time zone · `covered_by_lead_id`:uuid

**Policies:**
- `Admin all on prospects_b2b` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `rep_daily_plans` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `lead_id`:uuid! · `plan_date`:date! · `created_at`:timestamp with time zone

**FKs:** (representative_id) REFERENCES representatives(id) ON DELETE CASCADE · (lead_id) REFERENCES prospect_leads(id) ON DELETE CASCADE

**Policies:**
- `rep_daily_plans_admin` [ALL] {authenticated} — USING: `is_admin()`
- `rep_daily_plans_own` [ALL] {public} — USING: `(representative_id = my_rep_id())` — CHECK: `(representative_id = my_rep_id())`

#### `repco_help_articles` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `question`:text! · `answer`:text! · `category`:text · `sort_order`:integer! · `is_active`:boolean! · `created_at`:timestamp with time zone!

**Policies:**
- `help_admin_write` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`
- `help_read` [SELECT] {authenticated} — USING: `true`

#### `repco_invite_codes` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `code`:text! · `note`:text · `created_by`:uuid · `created_at`:timestamp with time zone · `expires_at`:timestamp with time zone! · `used_by`:uuid · `used_at`:timestamp with time zone

**Policies:** RLS ativa porém SEM policy (nega tudo a não-admin/serviço)

#### `representative_clients` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `cnpj`:text · `razao_social`:text · `nome_fantasia`:text · `situacao_receita`:text · `endereco_completo`:text · `email_comprador`:text · `email_xml`:text · `nome_comprador`:text · `whatsapp_comprador`:text · `prazo_pagamento`:text · `forma_pagamento`:text · `limite_credito`:numeric · `status`:text! · `created_at`:timestamp with time zone! · `updated_at`:timestamp with time zone! · `segment`:text · `last_order_at`:timestamp with time zone · `inactivity_snoozed_until`:timestamp with time zone · `inactivity_alert_dismissed`:boolean · `inscricao_estadual`:text · `cpf`:text · `nome_completo`:text · `snooze_count`:integer · `snooze_admin_alert`:boolean · `is_active_client`:boolean · `deactivated_by`:uuid · `deactivated_at`:timestamp with time zone · `deactivation_reason`:text · `assigned_to_company`:boolean · `pix_key`:text · `bank_name`:text · `bank_agency`:text · `bank_account`:text · `bank_account_type`:text · `default_fiscal_order_type`:text · `cep`:text · `municipio`:text · `uf`:text · `bairro`:text · `lat`:double precision · `lng`:double precision · `credito_score`:integer · `score_serasa_pdf_url`:text · `score_serasa_pdf_filename`:text · `company_id`:uuid · `public_pos`:boolean! · `geocode_status`:text! · `geocoded_at`:timestamp with time zone · `desconto_financeiro_pct`:numeric! · `desconto_logistico_pct`:numeric! · `bonificacao_padrao`:text

**FKs:** (company_id) REFERENCES companies(id) · (representative_id) REFERENCES representatives(id) ON DELETE CASCADE · (deactivated_by) REFERENCES auth.users(id)

**Policies:**
- `Admin can do everything on rep_clients` [ALL] {public} — USING: `is_admin()`
- `RepCo can delete own clients without orders` [DELETE] {authenticated} — USING: `((representative_id = my_rep_id()) AND (NOT (EXISTS ( SELECT 1 FROM representative_orders ro WHERE (ro.representative_client_id = representative_clients.id)))))`
- `RepCo can insert own clients` [INSERT] {public} — CHECK: `(representative_id = my_rep_id())`
- `RepCo can view own clients` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_commission_payouts` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `commission_id`:uuid! · `installment_id`:uuid · `representative_id`:uuid! · `amount`:numeric! · `payment_method`:text · `cycle_start`:date · `cycle_end`:date · `scheduled_payment_date`:date · `status`:text! · `paid_at`:timestamp with time zone · `proof_url`:text · `proof_filename`:text · `created_at`:timestamp with time zone! · `company_id`:uuid

**FKs:** (commission_id) REFERENCES representative_commissions(id) ON DELETE CASCADE · (company_id) REFERENCES companies(id) · (representative_id) REFERENCES representatives(id) ON DELETE CASCADE · (installment_id) REFERENCES representative_order_installments(id) ON DELETE CASCADE

**Policies:**
- `rcp_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `rcp_rep_select` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_commissions` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `order_id`:uuid! · `order_amount`:numeric! · `base_rate`:numeric! · `pix_bonus`:numeric! · `delivery_bonus`:numeric! · `total_rate`:numeric! · `commission_amount`:numeric! · `status`:text! · `paid_at`:timestamp with time zone · `paid_by`:uuid · `created_at`:timestamp with time zone! · `payment_cycle_start`:date · `payment_cycle_end`:date · `scheduled_payment_date`:date · `payment_method`:text · `proof_url`:text · `notes`:text · `company_id`:uuid

**FKs:** (paid_by) REFERENCES auth.users(id) · (order_id) REFERENCES representative_orders(id) · (representative_id) REFERENCES representatives(id) · (company_id) REFERENCES companies(id)

**Policies:**
- `Admin can do everything on rep_commissions` [ALL] {public} — USING: `is_admin()`
- `RepCo can view own commissions` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_company_settings` — 🔒 RLS ON

**Colunas:** `representative_id`:uuid! · `company_id`:uuid! · `commission_rate`:numeric · `active`:boolean! · `created_at`:timestamp with time zone

**FKs:** (representative_id) REFERENCES representatives(id) ON DELETE CASCADE · (company_id) REFERENCES companies(id) ON DELETE CASCADE

**Policies:** RLS ativa porém SEM policy (nega tudo a não-admin/serviço)

#### `representative_documents` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `doc_type`:text! · `file_url`:text! · `file_name`:text · `file_size`:bigint · `uploaded_at`:timestamp with time zone!

**FKs:** (representative_id) REFERENCES representatives(id) ON DELETE CASCADE

**Policies:**
- `Admin can do everything on rep_documents` [ALL] {public} — USING: `is_admin()`
- `RepCo can upload own documents` [INSERT] {public} — CHECK: `(representative_id = my_rep_id())`
- `RepCo can view own documents` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_order_installments` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid! · `installment_number`:integer! · `amount`:numeric! · `due_date`:date · `boleto_url`:text · `boleto_filename`:text · `proof_url`:text · `proof_filename`:text · `status`:text! · `paid_at`:timestamp with time zone · `created_at`:timestamp with time zone! · `company_id`:uuid

**FKs:** (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE · (company_id) REFERENCES companies(id)

**Policies:**
- `roi_all` [ALL] {public} — USING: `(EXISTS ( SELECT 1 FROM representative_orders o WHERE (o.id = representative_order_installments.order_id)))` — CHECK: `(EXISTS ( SELECT 1 FROM representative_orders o WHERE (o.id = representative_order_installments.order_id)))`

#### `representative_order_items` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid! · `product_id`:uuid! · `representative_id`:uuid · `quantity`:integer! · `unit`:text! · `unit_price`:numeric · `stock_applied`:boolean! · `created_at`:timestamp with time zone! · `company_id`:uuid · `is_bonus`:boolean!

**FKs:** (representative_id) REFERENCES representatives(id) ON DELETE SET NULL · (company_id) REFERENCES companies(id) · (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE · (product_id) REFERENCES products(id)

**Policies:**
- `roi_items_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `roi_items_rep_insert` [INSERT] {public} — CHECK: `(representative_id = my_rep_id())`
- `roi_items_rep_select` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_order_notes` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid! · `author_user_id`:uuid · `author_name`:text · `note`:text! · `created_at`:timestamp with time zone!

**FKs:** (order_id) REFERENCES representative_orders(id) ON DELETE CASCADE

**Policies:**
- `ron_insert` [INSERT] {public} — CHECK: `(is_admin() OR (EXISTS ( SELECT 1 FROM representative_orders o WHERE ((o.id = representative_order_notes.order_id) AND (`
- `ron_select` [SELECT] {public} — USING: `(is_admin() OR (EXISTS ( SELECT 1 FROM representative_orders o WHERE ((o.id = representative_order_notes.order_id) AND (o.representative_id = my_rep_id())))))`

#### `representative_orders` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `representative_client_id`:uuid · `order_number`:text! · `description`:text · `total_amount`:numeric! · `payment_method`:text · `is_personal_delivery`:boolean! · `invoice_xml_url`:text · `invoice_pdf_url`:text · `invoice_key`:text · `invoice_number`:text · `status`:text! · `notes`:text · `created_at`:timestamp with time zone! · `completed_at`:timestamp with time zone · `created_by`:uuid · `client_order_number`:text · `has_client_order_number`:boolean · `payment_term`:integer · `discount_percentage`:numeric · `original_amount`:numeric · `commission_paid_proof_url`:text · `service_invoice_url`:text · `channel`:text · `pix_bonus_eligible`:boolean · `fiscal_order_type`:text · `invoice_pdf_filename`:text · `invoice_xml_filename`:text · `payment_proof_filename`:text · `payment_proof_url`:text · `company_id`:uuid · `delivery_status`:text · `delivery_accepted_at`:timestamp with time zone · `delivered_at`:timestamp with time zone · `delivery_proof_url`:text · `delivery_proof_filename`:text · `delivery_proof_lat`:double precision · `delivery_proof_lng`:double precision · `desconto_financeiro_pct`:numeric! · `desconto_logistico_pct`:numeric!

**FKs:** (representative_client_id) REFERENCES representative_clients(id) · (representative_id) REFERENCES representatives(id) · (company_id) REFERENCES companies(id) · (created_by) REFERENCES auth.users(id)

**Policies:**
- `Admin can do everything on rep_orders` [ALL] {public} — USING: `is_admin()`
- `RepCo can view own orders` [SELECT] {public} — USING: `(representative_id = my_rep_id())`

#### `representative_routes` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `representative_id`:uuid! · `name`:text! · `description`:text · `status`:text! · `created_by`:uuid · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `route_type`:text · `max_weight_kg`:numeric · `total_weight_kg`:numeric · `region`:text · `segment_filter`:text · `finalized_at`:timestamp with time zone · `finalized_by`:uuid · `report_pdf_url`:text · `learned_order`:jsonb

**FKs:** (representative_id) REFERENCES representatives(id) ON DELETE CASCADE · (finalized_by) REFERENCES auth.users(id) · (created_by) REFERENCES auth.users(id)

**Policies:**
- `Admin full access on routes` [ALL] {authenticated} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`
- `RepCo reads own routes` [SELECT] {authenticated} — USING: `(representative_id IN ( SELECT representatives.id FROM representatives WHERE (representatives.user_id = auth.uid())))`

#### `representatives` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `user_id`:uuid! · `full_name`:text! · `cpf`:text · `cnpj`:text · `email`:text · `phone`:text · `commission_rate`:numeric! · `has_personal_delivery`:boolean! · `experience_start_date`:date · `status`:text! · `approved_at`:timestamp with time zone · `blocked_reason`:text · `notes`:text · `created_at`:timestamp with time zone! · `updated_at`:timestamp with time zone! · `last_seen_at`:timestamp with time zone · `last_lat`:numeric · `last_lng`:numeric · `current_tab`:text · `is_online`:boolean · `company_id`:uuid

**FKs:** (company_id) REFERENCES companies(id) · (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**Policies:**
- `Admin can do everything on representatives` [ALL] {public} — USING: `is_admin()`
- `Anyone authenticated can insert own registration` [INSERT] {public} — CHECK: `(user_id = auth.uid())`
- `Rep updates own presence` [UPDATE] {authenticated} — USING: `(user_id = auth.uid())` — CHECK: `(user_id = auth.uid())`
- `RepCo can update own record` [UPDATE] {public} — USING: `(user_id = auth.uid())`
- `RepCo can view own record` [SELECT] {public} — USING: `(user_id = auth.uid())`

#### `roasting_companies` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `cnpj`:text · `address`:text · `city`:text · `state`:text · `cep`:text · `company_code`:integer! · `active`:boolean · `notes`:text · `created_at`:timestamp with time zone · `director_name`:text · `email`:text · `whatsapp`:text · `inscricao_estadual`:text · `company_id`:uuid

**FKs:** (company_id) REFERENCES companies(id)

**Policies:**
- `Admin roasting_companies` [ALL] {public} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`

#### `roasting_company_contacts` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `company_id`:uuid! · `name`:text! · `role`:text! · `email`:text · `phone`:text · `whatsapp`:text · `extension`:text · `active`:boolean · `created_at`:timestamp with time zone

**FKs:** (company_id) REFERENCES roasting_companies(id) ON DELETE CASCADE

**Policies:**
- `Admin contacts` [ALL] {public} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`

#### `route_stops` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `route_id`:uuid! · `stop_order`:integer! · `company_name`:text! · `address`:text · `city`:text · `phone`:text · `segment`:text · `lat`:numeric · `lng`:numeric · `visit_status`:text! · `visit_notes`:text · `visited_at`:timestamp with time zone · `created_at`:timestamp with time zone · `updated_at`:timestamp with time zone · `representative_client_id`:uuid · `scheduled_at`:timestamp with time zone · `proof_photo_url`:text · `proof_photo_lat`:numeric · `proof_photo_lng`:numeric · `proof_photo_at`:timestamp with time zone · `arrival_at`:timestamp with time zone · `departure_at`:timestamp with time zone · `geofence_triggered`:boolean · `distance_from_stop`:numeric · `stop_type`:text · `weight_kg`:numeric · `prospect_lead_id`:uuid

**FKs:** (route_id) REFERENCES representative_routes(id) ON DELETE CASCADE · (prospect_lead_id) REFERENCES prospect_leads(id) ON DELETE SET NULL · (representative_client_id) REFERENCES representative_clients(id) ON DELETE SET NULL

**Policies:**
- `Admin full access on route_stops` [ALL] {authenticated} — USING: `(EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_admin = true))))`
- `RepCo reads and updates own route stops` [ALL] {authenticated} — USING: `(route_id IN ( SELECT r.id FROM (representative_routes r JOIN representatives rep ON ((rep.id = r.representative_id))) WHERE (rep.user_id = auth.uid())))`

#### `shipments` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `order_id`:uuid · `carrier_name`:text · `carrier_service`:text · `carrier_api_shipment_id`:text · `tracking_code`:text · `label_url`:text · `label_format`:text · `status`:text · `dispatch_date`:timestamp with time zone · `last_tracking_check`:timestamp with time zone · `tracking_events`:jsonb · `created_at`:timestamp with time zone

**FKs:** (order_id) REFERENCES orders(id) ON DELETE CASCADE

**Policies:**
- `Service role can manage shipments` [ALL] {public} — USING: `((auth.jwt() ->> 'role'::text) = 'service_role'::text)`
- `Users can view own shipments` [SELECT] {public} — USING: `(order_id IN ( SELECT orders.id FROM orders WHERE (orders.user_id = auth.uid())))`
- `admin all shipments` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `public read shipments` [SELECT] {public} — USING: `true`

#### `shipping_carriers` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `name`:text! · `code`:text! · `price_per_kg`:numeric · `fixed_price`:numeric · `delivery_time_days`:integer · `is_active`:boolean · `logo_url`:text · `api_type`:text · `api_endpoint`:text · `api_key`:text · `api_username`:text · `api_password`:text · `integration_notes`:text · `created_at`:timestamp with time zone

**Policies:**
- `admin all carriers` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `public read carriers` [SELECT] {public} — USING: `true`

#### `site_settings` — 🔒 RLS ON

**Colunas:** `key`:text! · `value`:boolean! · `updated_at`:timestamp with time zone

**Policies:**
- `site_settings_read` [SELECT] {public} — USING: `true`
- `site_settings_write` [ALL] {authenticated} — USING: `is_admin()` — CHECK: `is_admin()`

#### `site_visits` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `city`:text · `region`:text · `country`:text · `lat`:double precision · `lng`:double precision · `path`:text · `created_at`:timestamp with time zone!

**Policies:**
- `site_visits_insert_any` [INSERT] {public} — CHECK: `true`
- `site_visits_select_admin` [SELECT] {public} — USING: `is_admin()`

#### `subscription_settings` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `accepting_new`:boolean! · `tiers`:jsonb! · `updated_at`:timestamp with time zone!

**Policies:**
- `subsettings_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `subsettings_public_read` [SELECT] {public} — USING: `true`

#### `subscriptions` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `user_id`:uuid · `order_id`:uuid · `account_type`:text · `selected_coffees`:jsonb · `grind_type`:text · `shipping_date`:integer · `commitment_months`:integer · `discount_pct`:integer · `status`:text! · `started_at`:timestamp with time zone! · `created_at`:timestamp with time zone!

**Policies:**
- `subs_admin_all` [ALL] {public} — USING: `is_admin()` — CHECK: `is_admin()`
- `subs_insert_own` [INSERT] {public} — CHECK: `(auth.uid() = user_id)`
- `subs_select_own_or_admin` [SELECT] {public} — USING: `((auth.uid() = user_id) OR is_admin())`

#### `user_profiles` — 🔒 RLS ON

**Colunas:** `id`:uuid! · `full_name`:text · `phone`:text · `is_admin`:boolean · `created_at`:timestamp with time zone

**FKs:** (id) REFERENCES auth.users(id) ON DELETE CASCADE

**Policies:**
- `Users fully manage profile` [ALL] {authenticated} — USING: `(auth.uid() = id)`


---

## 4. ROTAS E TELAS

**Roteador:** custom em `src/App.tsx` — lê `window.location.pathname` + escuta `popstate`. **Não usa react-router.** Navegação = `window.history.pushState()` + `dispatchEvent(new PopStateEvent('popstate'))`.

| Rota | Componente | Acesso |
|---|---|---|
| `/` | `AppContent` (home/loja) | Público |
| `/admin` | `AdminDashboard` | Admin (`is_admin`) |
| `/repco` | `RepCoDashboard` | Representante `active` (convite) |
| `/repco/inteligencia` | `RepCoIntelligence` | Admin (check inline) |
| `/repco/inteligencia/cobertura` | `RepCoCoverageMap` | Admin (check inline) |
| `/assinatura`, `/subscription` | `SubscriptionPage` | Público |
| `/meu-perfil`, `/profile` | `UserProfile` | Autenticado |
| `/reset-password` | `ResetPassword` | Público (link de e-mail) |
| `/rastrear` | `TrackingPage` | Público |
| `/meu-pedido/:orderId` | `OrderDetailPage` | Público (por ID) |
| `/payment/success` · `/failure` · `/pending` | `PaymentPages` | Público (callback MP) |
| `/marcas/:slug` | `BrandPage` | Público |
| `/nossa-historia`, `/sobre` | `HistoryPage` | Público |
| `/politica-*` (privacidade, frete, reembolso, cookies, assinatura), `/termos-servico`, `/trabalhe-conosco`, `/imprensa` | `PolicyPages` | Público |
| `*` (fallback) | `NotFound` | Público |

**Enforcement:** por guarda dentro da página (espera `loading`, checa `is_admin`/`rep.status`, mostra "Acesso Negado"/cadeado). Não há redirect central. A proteção real de dados é a RLS no banco.

**Abas do `AdminDashboard` (9):** Dashboard, Pedidos (`OrdersManagement`), Produtos (`ProductsManagement`), Clientes (`CustomersManagement`), Transportadoras (`ShippingManagement`), RepCo (`RepCoManagement`), Mensagens (`Messenger`), Inventário (`BatchManagement`), Configurações (`StoreSettings`).

**Abas do `RepCoDashboard` (13):** Início (`RepCoHome`), Perfil (`RepCoProfile`), Prospecção (`RepCoProspection`), Mapa (`RepCoFieldMap`), Clientes (`RepCoClients`), Novo Pedido (`RepCoNewOrder`), Pedidos (`RepCoOrders`), Entregas (`RepCoDeliveries`), Comissões (`RepCoCommissions`), Performance (`RepCoPerformance`), Mercado (`RepCoMarketPrices`), Mensagens (`Messenger`), Ajuda (`RepCoHelp`). No mobile: 4 primárias (Início, Clientes, Novo Pedido, Entregas) + menu "Mais".

---

## 5. STORAGE

8 buckets no Supabase Storage (públicos e privados). Padrão de caminho por bucket:

| Bucket | Acesso | Conteúdo | Padrão de caminho |
|---|---|---|---|
| `product-images` | público | imagens de produto, logo de empresa, banners, popups | `{timestamp}-{rand}.{ext}` · logo: `companies/{id}-{ts}.{ext}` |
| `invoices` | privado | NF (PDF/XML), boletos, comprovantes, canhotos, Serasa, comprovante de payout | `nf/{orderId}/...` · `{kind}/{orderId}/{instId}-{ts}` (boleto/proof) · `canhoto/{deliveryId}/...` · `serasa/{ts}-{nome}` · `commissions/...` |
| `lot-documents` | privado | docs de lote (compra_verde, nota_fiscal, pagamento_torra, pagamento_embalagem) | `{lotId}/{kind}/{ts}_{nome}` |
| `representative-docs` | privado | docs do rep (CNH, CPF, CNPJ, CORE, contrato) | `{userId}/{docType}/{nome}` |
| `visit-photos` | público | fotos de visita/POD com geo | `visits/{repId}/{stopId}/{ts}.jpg` |
| `batch-photos` | público | fotos de lote/batch | (via `batch_photos`) |
| `carrier-logos` | público | logos de transportadoras | `{timestamp}-{rand}.{ext}` |
| `chat-media` | público | anexos do chat (foto/áudio/documento, ≤15MB) | `{userId}/{uuid}-{nome}` (upload via Edge Function `chat-upload` com service role) |

Observação: `SUPABASE_STORAGE.md` (raiz) documenta só `product-images` e `carrier-logos` — está **desatualizado** (faltam os outros 6 buckets).

---

## 6. O QUE ESTÁ PRONTO × O QUE ESTÁ PELA METADE

**Funciona ponta a ponta (real):**
- **RepCo (B2B)** — sólido: cadastro por convite, clientes (com auto-preenchimento por CNPJ via BrasilAPI), pedido em 3 passos, condições comerciais (desconto financeiro/logístico + bonificação), boleto multi-parcela, NF/comprovantes, **motor de comissão no banco** (fórmula Saporino + % fixo Fazendinha), payouts/"pagar bloco", entregas com POD, rotas (Leaflet/geofencing), prospecção Apify, mapa ao vivo, chat interno por empresa, aba Ajuda.
- **Multi-empresa (Saporino/Fazendinha)** — isolamento por `company_id` no RepCo/estoque/catálogo/preço/cliente/comissão/numeração (CS-/CF-) e chat por empresa. Falta só o **enforcement RLS multi-tenant** (Camada 3).
- **Checkout B2C (1ª cobrança)** via Mercado Pago + webhook que atualiza status do pedido.
- **Recuperação de senha** por e-mail (Resend) — funciona.
- **Admin CRUD** — todas as telas admin gravam de verdade (produtos, pedidos, banners, assinatura, lotes) — **nenhuma tela-fantasma** encontrada.
- **Inteligência de preço** — scrapers VTEX (grátis) e Apify (ML/marketplaces) + índice CEPEA do café.

**Fachada / pela metade / mockado:**
- **Formulário de contato (rodapé):** FAKE — `setTimeout` + toast "enviado"; **não manda e-mail** (`App.tsx:~1541 // Simulate sending email`).
- **Newsletter:** **não existe** UI real (só citada em texto de política).
- **Busca de produtos na loja:** **não existe** (lista estática).
- **Assinatura B2C recorrente:** só a **1ª cobrança**; a tabela `subscriptions` guarda o registro, mas **não há preapproval do Mercado Pago nem cron** para cobrar de novo. UI de planos ainda diz "novidades em breve" (`SubscriptionPage.tsx:318`).
- **"Minha Conta" / endereços salvos:** `user_addresses` é gravada no checkout, mas **não há UI** para ver/editar/reusar endereços depois.
- **Cupom/código de desconto no checkout:** **não existe** (desconto de assinatura é hardcoded, não digitável).
- **E-mail transacional além de reset:** **faltam** confirmação de compra/envio, lembrete de assinatura, resposta de contato.
- **Rastreamento (`sync-tracking`):** usa **credenciais de teste hardcoded** da Linketrack e import legado do Deno — **não é produção**.
- **TODOs relevantes:** `BrandPage.tsx` (arte da Canaan, logo/cópia da Fazendinha "em breve"); `RepCoMarketPrices.tsx` ("preços de mercado em breve"); `SubscriptionPage.tsx` (perfil dos cafés "em breve").

---

## 7. PWA

**PWA está DESLIGADO. Não há cache offline nem fila de sincronização.**
- `vite.config.ts` — `vite-plugin-pwa` **comentado** ("DESLIGADO — sem service worker nem manifest"; SW causava tela branca/cache preso).
- `index.html` — script que **desregistra todos os service workers e limpa todos os caches** ao carregar (mata PWA antigo).
- **Manifest:** **não existe** `manifest.json`/`manifest.webmanifest`. "Adicionar à tela inicial" é só atalho do navegador.
- **Persistência local:** só `localStorage`/`sessionStorage` — **não há IndexedDB, Dexie nem idb**. Chaves usadas: `saporino-cart` (carrinho), `active-company-id` (empresa ativa), `admin-initial-tab`/`repco-initial-view` (deep-link de abas), `saporino-visit-logged` (session), `saporino-eprice`/`saporino-eweight` (ferramenta admin de preço), consentimento de cookie, "popup visto".
- **Não há** Workbox, background sync, fila de sync offline nem cache de dados.

---

## 8. INTEGRAÇÕES

| Integração | Estado | Observação |
|---|---|---|
| **Mercado Pago (checkout)** | ✅ ~80% | `create-payment` cria preferência avulsa; falta modo assinatura/preapproval. |
| **Mercado Pago (webhook)** | ✅ | `mercadopago-webhook` valida assinatura HMAC e atualiza status do pedido. (Falta só confirmar URL/secret no painel do MP e testar 1 compra real — não há pedido B2C ainda.) |
| **Resend (e-mail)** | ✅ ~40% | Só reset de senha (`send-password-reset`) e lembrete quinzenal de scraper (`scraper-reminder`). Faltam e-mails transacionais de compra/envio. |
| **Apify — prospecção** | ✅ ~90% | `apify-places` (Google Places) com controle de orçamento; grava em `prospect_runs`/`prospect_leads`. |
| **Apify — preço concorrente** | ✅ | `ecommerce-scrape` (ML/marketplaces) → `ecommerce_price_snapshots`. |
| **VTEX (preço supermercado)** | ✅ | `vtex-scrape` (API pública, sem token), preço regional por CEP→regionId. |
| **CEPEA/ESALQ (café cru)** | ✅ | `cepea-cafe` faz scraping do Notícias Agrícolas → `coffee_market_index`. |
| **Frete/rastreamento** | ⚠️ ~70% | Transportadoras em modo manual (fixo + por kg). `sync-tracking` (Linketrack) com **token de teste**, não produção. |
| **CNPJ (BrasilAPI)** | ✅ | `cnpjLookup.ts` — auto-preenche torrefadora e cliente PJ (IE não vem da base federal). |
| **ViaCEP** | ✅ | consulta de CEP no checkout/endereços. |
| **Geocoding (Nominatim/OSM)** | ✅ | grátis; sem Google Geocoding. |
| **Segredos usados nas Edge Functions:** `APIFY_TOKEN`, `RESEND_API_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (nunca expostos no client). |

---

## 9. RISCOS (o que quebraria ao acoplar um módulo novo e grande)

Fatos observados que aumentam o risco de um módulo grande novo:
1. **Sem RBAC de verdade** — só `is_admin` (bool) + `representatives.status`. Um módulo que precise de um papel novo (ex.: `director`, `financeiro`, `logística`) **não tem onde se apoiar**: exigiria criar o conceito de papéis do zero (hoje é if/else disperso).
2. **Isolamento multi-tenant incompleto** — `company_id` existe e as queries filtram por empresa **no client**, mas a **RLS multi-tenant por `company_id` não está imposta no banco** (Camada 3). Um módulo novo que grave dados multi-empresa pode **vazar dados entre empresas** se confiar só no filtro do client.
3. **Estado de servidor 100% manual** — sem React Query/cache/invalidação. Um módulo grande multiplica os `useState+useEffect+supabase.from` e o risco de dados desatualizados, refetch inconsistente e chamadas duplicadas. Não há padrão único de acesso a dados.
4. **Roteador manual** — sem react-router. Novas rotas, guardas, deep-link e code-splitting são feitos à mão em `App.tsx`; fácil quebrar F5/`vercel.json` (rotas estáticas antes do catchall). `react-router-dom` está no `package.json` mas não é usado (confunde quem chega).
5. **Sem design tokens** — cor da marca hardcoded em classes arbitrárias (`#8B2214`, `#a4240e` legado) espalhadas. Um módulo novo tende a divergir visualmente; trocar tema global exigiria varredura manual.
6. **`App.tsx` monolítico** — roteador + home + footer + várias telas de negócio no mesmo arquivo grande. Ponto único de conflito/merge e de regressão (a home e o footer já dependem de `useCompany`).
7. **Sem testes automatizados** — não há suíte de testes; a validação é `typecheck` + `build` + verificação manual na tela. `typecheck/build` não pegam bug de dado/runtime.
8. **PWA/offline inexistente** — qualquer módulo "de campo" que precise funcionar offline (rep sem sinal) começa do zero: não há service worker, IndexedDB nem fila de sync.
9. **Acoplamento direto ao Supabase nos componentes** — a maioria das telas chama `supabase.from(...)` direto; um módulo que precise trocar/abstrair o acesso a dados encontra lógica espalhada, não uma camada única.
10. **Integrações "quase lá"** — assinatura recorrente, rastreamento (token de teste) e e-mails transacionais estão incompletos; um módulo que dependa deles herda o gap.

---

*Fim do levantamento. Nenhuma melhoria foi implementada nesta rodada, conforme solicitado.*
