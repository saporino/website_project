# RAIO_X — Retrato factual do projeto
> Modo somente leitura. Levantamento do que EXISTE hoje, com caminhos de arquivo e números reais. Sem recomendações, sem plano, sem opinião. Data do levantamento: 31/07/2026.
> Documentos lidos: `CLAUDE.md` (existe), `ESTADO_ATUAL.md` (existe — 62.536 bytes, `src`/raiz, data 15/07).

---

## 1. SKILL

**Localização:** o skill `corporate-website-architect` **não existe dentro do repositório do projeto**. Ele é um skill de plugin, carregado de:
`C:\Users\vlade\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\...\skills\corporate-website-architect\`
No projeto, a pasta `.claude/` contém apenas: `.claude/launch.json` e `.claude/settings.local.json`. **Não existe** `.claude/skills/` no projeto.

**Conteúdo do SKILL (texto completo, como carregado):**
```
You are a Senior Frontend Architect, Product Designer and UX Engineer specializing in premium B2B corporate websites.
Your primary responsibility is to improve and expand existing projects without breaking their architecture, consistency or maintainability.

Before implementing any feature, page or component:
1. Inspect the current project structure.
2. Understand the routing system.
3. Identify the design system and reusable components.
4. Review typography, spacing, colors and branding.
5. Analyze existing animations and interaction patterns.
6. Check SEO implementation and metadata strategy.
7. Reuse existing components whenever possible.
8. Never replace working code unnecessarily.
9. Explain major architectural decisions before implementation.
10. Build solutions that feel like they have always belonged to the project.

Design philosophy: Premium corporate appearance; Clean architecture; Minimalism; Strong visual hierarchy; Generous white space; Real photography over illustrations; Elegant typography; Purposeful animations; Excellent mobile experience; Accessibility first; Fast loading; SEO-friendly structure.

Engineering principles: Write clean, readable and maintainable code; Prefer composition over duplication; Avoid unnecessary dependencies; Respect the existing project architecture; Keep components reusable; Optimize performance; Write scalable TypeScript; Use semantic HTML; Follow accessibility best practices; Preserve consistency across the entire website.

When receiving a new request:
First: Inspect the current implementation; Identify reusable components; Explain your implementation strategy.
Then: Propose improvements if appropriate; Implement incrementally; Preserve the existing design language; Validate responsiveness, accessibility and performance.
Never invent company information. Always ask when business information is missing. Always prioritize long-term maintainability over quick solutions.
```

**Outros skills presentes no projeto:** não existe nenhum skill commitado no repositório (`.claude/skills/` não existe). Os demais skills disponíveis na sessão são de plugin/AppData, fora do projeto.

---

## 2. ROTEAMENTO

**Arquivo e mecanismo:** `src/App.tsx`. Router **custom**, sem biblioteca. Lê `window.location.pathname` para o estado `currentPath` (linha 99), escuta `popstate` (linha 103). O componente `AppContent` decide o que renderizar por uma **cadeia de `if`** comparando `currentPath` (linhas ~134–196). Navegação em outros pontos usa `window.history.pushState` + `PopStateEvent`.

**`react-router-dom`:** está **instalado** (`package.json`: `"react-router-dom": "^7.9.4"`), mas **não é usado** em nenhum arquivo de `src` (grep por `react-router` em `src` = 0 resultados).

**Lista completa das rotas (declaradas em `src/App.tsx`):**

| Rota | Linha | Componente | Tipo |
|---|---|---|---|
| `/` , `''` , `/index.html` | 196 | home (JSX inline no App.tsx) | Pública |
| `/assinatura` , `/subscription` | 138 | `SubscriptionPage` | Pública |
| `/meu-perfil` , `/profile` | 142 | `UserProfile` | Autenticada (usuário) |
| `/reset-password` (+ hash recovery) | 162 | `ResetPassword` | Pública (recuperação) |
| `/politica-privacidade` | 166 | `PrivacyPolicy` | Pública |
| `/politica-frete` | 167 | `ShippingPolicy` | Pública |
| `/politica-reembolso` | 168 | `RefundPolicy` | Pública |
| `/termos-servico` | 169 | `TermsOfService` | Pública |
| `/politica-assinatura` | 170 | `SubscriptionPolicy` | Pública |
| `/politica-cookies` | 171 | `CookiePolicy` | Pública |
| `/trabalhe-conosco` | 172 | `CareersPage` | Pública |
| `/imprensa` | 173 | `PressPage` | Pública |
| `/marcas/:slug` (startsWith `/marcas/`) | 174 | `BrandPage` | Pública |
| `/marca-propria` | 175 | `PrivateLabelPage` | Pública |
| `/cafe-cru` | 176 | `GreenCoffeePage` | Pública |
| `/para-seu-negocio` | 177 | `BusinessPage` | Pública |
| `/nossa-historia` , `/sobre` | 178 | `HistoryPage` | Pública |
| `/payment/success` | 181 | `PaymentSuccess` | Pública |
| `/payment/failure` | 182 | `PaymentFailure` | Pública |
| `/payment/pending` | 183 | `PaymentPending` | Pública |
| `/rastrear` | 186 | `TrackingPage` | Pública |
| `/meu-pedido/:id` (startsWith `/meu-pedido/`) | 190 | `OrderDetailPage` | Pública (com id) |
| `/admin` | 134 | `AdminDashboard` | Administrativa |
| `/repco` | 154 | `RepCoDashboard` | Autenticada (representante) |
| `/repco/inteligencia` | 150 | `RepCoIntelligence` | Administrativa/diretor |
| `/repco/inteligencia/cobertura` | 146 | `RepCoCoverageMap` | Administrativa/diretor |
| `/promotor` | 158 | `PromotorDashboard` | Autenticada (promotor) |
| qualquer outro path (catch-all) | 199 | `NotFound` | Pública (404) |

Observação factual: no `App.tsx` a rota é só um match de path; **a checagem de autenticação/papel acontece dentro dos componentes de dashboard** (`AdminDashboard`, `RepCoDashboard`, `PromotorDashboard` usam `useAuth`/`useCompany`), não no roteador.

---

## 3. App.tsx

- **Número de linhas:** 1.876.
- **O que concentra:** providers, roteamento, layout público (Header e Footer), estado de carrinho/UI, e um keep-alive.
  - **Providers** (linhas 86–94): `AuthProvider` > `CompanyProvider` > `CartProvider`. `src/main.tsx` só renderiza `<App/>` dentro de `<StrictMode>` — os providers ficam no App.tsx.
  - **Roteamento:** cadeia de `if` (seção 2).
  - **Header:** `const Header = (...)` na linha **296** (tag `<header>` na 318).
  - **Footer:** `const Footer = (...)` na linha **1507** (tag `<footer>` na 1559; cor `bg-[#8a1f0c]`).
  - **Keep-alive Supabase:** `setInterval(keepAlive, 4 dias)` (linhas 71–81).
- **O que JÁ está extraído em componentes/arquivos próprios:** as páginas (`src/pages/*`), dashboards, e os componentes de `src/components/*` (83 arquivos em `components`, 14 em `pages`).
- **O que NÃO está extraído:** `Header` e `Footer` estão **definidos como `const` locais dentro do `App.tsx`** (não exportados, não em arquivos próprios). A home (`/`) é JSX inline no App.tsx. Não existe componente `Layout` compartilhado.

---

## 4. LAYOUT PÚBLICO

- **Header/Footer compartilhados:** `Header` e `Footer` existem **apenas** como `const` locais em `src/App.tsx` (linhas 296 e 1507). **Não são exportados** e **não há** arquivo `Header.tsx`/`Footer.tsx`/`Layout.tsx` (busca por `*header*`/`*footer*`/`*layout*` em `src` = nenhum arquivo dedicado).
- **Páginas que possuem `<header>`/`<footer>` próprios no arquivo** (grep `<header|<footer` em `src/pages`):
  `src/pages/AdminDashboard.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/OrderDetailPage.tsx`, `src/pages/PromotorDashboard.tsx`, `src/pages/RepCoDashboard.tsx`, `src/pages/SubscriptionPage.tsx`, `src/pages/TrackingPage.tsx`, `src/pages/UserProfile.tsx`.
- **Consequência factual:** o Header/Footer do App.tsx são usados na home (`/`); páginas como `HistoryPage` têm **marcação de header/footer própria** no arquivo. As páginas `PrivateLabelPage`, `GreenCoffeePage`, `BusinessPage`, `PolicyPages`, `BrandPage` são componentes separados que não importam o `Header`/`Footer` do App.tsx (impossível, pois são `const` não exportados).

---

## 5. ESTILO

- **Tailwind config (`tailwind.config.js`):** `theme: { extend: {} }` — **vazio**. **Não existe** nenhuma cor nomeada/token, nem `darkMode`, nem `colors:` customizado. `plugins: []`.
- **Cor principal `#8B2214` hardcoded:** **448 ocorrências** em **67 arquivos** (`grep -ro "8B2214" src --include=*.tsx`). O Footer usa ainda `bg-[#8a1f0c]` (App.tsx linha 1559) e o `main.tsx`/erro usa `#a4240e`.
- **Dark mode / temas:** **não existe** (`darkMode` ausente no tailwind.config; nenhum theme switcher).

---

## 6. SEO

- **`index.html` (existe):** `<title>` "Café Saporino — O Verdadeiro Sabor de Minas"; `<meta name="description">`; Open Graph (`og:type/site_name/title/description/url/image/image:alt/locale`); Twitter Card (`summary_large_image`); `<link rel="canonical" href="https://www.cafesaporino.com.br/">`; e um bloco **JSON-LD** `@type: Organization` (nome, legalName, url, logo, email, endereço em Barueri, `sameAs` Instagram). Todos os valores são **estáticos** (apontam para a home).
- **Componente/hook de SEO por página:** **não existe.** Sem `react-helmet` (grep = 0). `document.title` em `src/pages/*` = **0 ocorrências**. O único ajuste de título é em `src/App.tsx` (linhas 125–129), definindo `document.title` por prefixo de path (`/repco`, `/promotor`, `/admin`) — não por página institucional, e sem mexer em description/canonical/OG.
- **`sitemap.xml` e `robots.txt`:** **existem** em `public/` (`public/sitemap.xml`, `public/robots.txt`). São **escritos à mão** (arquivos estáticos; não há gerador). O `sitemap.xml` lista: `/`, `/assinatura`, `/nossa-historia`, as 6 páginas de política, `/termos-servico`, `/marca-propria`, `/cafe-cru`, `/trabalhe-conosco`, `/imprensa`. (Não inclui `/para-seu-negocio` nem `/marcas/*`.)
- **Build:** **SPA puro.** `vite.config.ts` não tem prerender/SSG (só `@vitejs/plugin-react`, `manualChunks` para leaflet, PWA desligado). `vercel.json` usa `routes`: serve estáticos/`/assets`/`/icons` e faz **fallback de todo o resto para `/index.html`** (`{"src":"/(.*)","dest":"/index.html"}`). Não há renderização no servidor.

**`vite.config.ts` (resumo real):** plugins `[react()]`; `optimizeDeps.include:['leaflet']`, `exclude:['lucide-react']`; `build.rollupOptions.output.manualChunks: { 'leaflet-vendor': ['leaflet','react-leaflet'] }`; PWA/service worker **desligado** (comentado no arquivo).

**`vercel.json` (real):** array `routes` com 4 regras — (1) estáticos por extensão, (2) `/assets/*`, (3) `/icons/*`, (4) catch-all `→ /index.html`.

---

## 7. "FAZENDINHA" (referência para a futura COFICO)

- **Não é uma rota nem uma página.** "Fazendinha" é uma **empresa** (multi-tenant): linha na tabela `companies` — `Café Fazendinha Ltda`, CNPJ 37.856.623/0001-70, `order_prefix = 'CF'`, `commission_model = 'flat'`, `is_b2c = false`.
- **Onde vive no código:** seleção via `src/components/CompanySwitcher.tsx`, backed por `src/contexts/CompanyContext.tsx`. Menções a "Fazendinha" em: `src/components/admin/BatchManagement.tsx`, `src/components/admin/CompanyManagement.tsx`, `src/components/admin/RepCoManagement.tsx`, `src/components/repco/RepCoNewOrder.tsx`, `src/contexts/CompanyContext.tsx`, `src/pages/BrandPage.tsx`.
- **Tabelas que lê/escreve:** as **mesmas** tabelas do RepCo/admin, filtradas por `company_id` (não há tabela exclusiva "Fazendinha"): `companies`, `representatives`, `representative_clients`, `representative_orders`, `representative_order_items`, `representative_commissions`, `products`, `green_coffee_lots`, `price_lists`, etc. Distinção por `company_id` + `order_prefix` (`CF`) + `commission_model` (`flat`).
- **Representantes cadastrados na Fazendinha:** 0 (a estrutura existe; nenhum rep na empresa Fazendinha até o levantamento).
- **COFICO:** a palavra "COFICO" **não existe** no código (`grep` em todo o repo = 0). Não há entidade/rota/tabela COFICO.

---

## 8. INVENTÁRIO E PEDIDOS

**Tabelas (existem):** `products`, `representative_orders`, `representative_order_items`, `green_coffee_lots`, `lot_transfers`.

**`products` — colunas:** `id, name, description, price, promotional_price, image_url, weight_grams, roast_type, flavor_notes, in_stock, created_at, updated_at, is_active, featured, category, display_order, discount_percentage, stock, full_details, subscription_enabled, subscription_months, subscription_discount_pct, additional_images, barcode, product_line, company_id, pj_only, hidden_from_store`.
- Quantidade em estoque: **`stock`** (inteiro; em pacotes, conforme CLAUDE.md) e flag `in_stock`. Peso: `weight_grams`. Preço: `price` / `promotional_price`. Marca/linha: `product_line`. Multi-empresa: `company_id`.

**`representative_orders` — colunas relevantes:** `order_number`, `total_amount` (valor total), `original_amount`, `discount_percentage`, `payment_method`, `status`, `company_id`, `representative_id` (vendedor), `representative_client_id` (cliente), `channel`, e de entrega: `delivery_status, delivery_accepted_at, delivered_at, delivery_proof_url, delivery_proof_filename, delivery_proof_lat, delivery_proof_lng`.
- **Endereço de entrega:** não fica na ordem; fica no **cliente** (`representative_clients`: `endereco_completo, cep, bairro, lat, lng`). A ordem referencia `representative_client_id`.

**`representative_order_items` — colunas:** `id, order_id, product_id, representative_id, quantity, unit, unit_price, stock_applied, created_at, company_id, is_bonus`.
- Quantidade: `quantity` + `unit` (kg/pacote/fardo). Preço unitário: `unit_price`. Valor total: agregado em `representative_orders.total_amount`. Flag de bonificação: `is_bonus`. Controle de baixa: `stock_applied`.

**Como a baixa de estoque acontece (triggers/funcões reais):**
- **Ao gerar item de pedido:** trigger `trg_repco_apply_stock` (BEFORE INSERT em `representative_order_items`) → função `repco_apply_stock_on_item` (decrementa `products.stock`). Funções relacionadas: `decrement_stock_on_repco_order`.
- **Ao cancelar pedido:** trigger `trg_repco_return_stock` (AFTER UPDATE em `representative_orders`) → função `repco_return_stock_on_cancel` (devolve estoque). Também `repco_delete_order`.
- **Entrada de estoque (torra):** `green_coffee_lots` alimenta `products.stock` via trigger `trg_update_stock` (AFTER INSERT/UPDATE/DELETE) → funções `update_product_stock_from_lots` / `update_product_stock_from_batches`.
- Numeração de pedido: trigger `set_repco_order_number` (BEFORE INSERT). Comissão: `trigger_repco_commission` (BEFORE UPDATE).

**`green_coffee_lots` — colunas de kg/custo (existem):** `green_weight_kg, green_cost_per_kg, green_total_cost, roasted_weight_kg, roast_loss_pct, roast_cost, pkg_cost_250g/500g/1kg/fardo5kg, cost_per_100g/250g/500g/1kg/fardo5kg, units_produced_250g/500g/1kg/fardo5kg, total_variable_cost, total_bonus_cost, green_remaining_kg, sca_score, company_id`, entre outras (61 colunas).

---

## 9. BLOCO 8 — ROTA E LOGÍSTICA

**Tabelas que EXISTEM (nomes reais):**
- **Representantes:** `representative_routes` e `route_stops`.
  - `route_stops` — colunas: `id, route_id, stop_order, company_name, address, city, phone, segment, lat, lng, visit_status, visit_notes, visited_at, representative_client_id, scheduled_at, proof_photo_url, proof_photo_lat, proof_photo_lng, proof_photo_at, arrival_at, departure_at, geofence_triggered, distance_from_stop, stop_type, weight_kg, prospect_lead_id`.
- **Comprovante de entrega:** existe **em colunas** de `representative_orders` (`delivery_proof_url/filename/lat/lng`, `delivery_status`, `delivered_at`) e em `route_stops` (`proof_photo_*`). **Não existe** tabela `delivery_proofs`.
- **Promotores (conjunto completo):** `promoters`, `promoter_routes`, `promoter_visits`, `promoter_visit_locations`, `promoter_visit_photos`, `promoter_visit_audits`, `promoter_clients`, `promoter_client_mix`, `promoter_incidents`, `promoter_audit_log`, além de várias views `vw_promoter_*` (cobertura, expiry, incidents, products, reps, stock_ops, stores, time, visit_mix). Também `site_visits`.

**Tabelas citadas no CLAUDE.md §6 que NÃO existem com esse nome:** `routes`, `route_assignments`, `delivery_proofs`, `client_route_links` — **não existem** no banco (a busca por `routes`/`route_assignments`/`delivery_proofs`/`client_route_links` retornou apenas `route_stops` e `representative_routes`).

**Componentes de UI relacionados (existem):** `src/components/admin/RouteManager.tsx`, `src/components/repco/RepCoDeliveries.tsx`, `src/components/repco/RepCoFieldMap.tsx`, `src/components/promotor/PromotorRota.tsx`, `src/components/admin/PromoterLiveMapInner.tsx`.

**Carga (`weight_kg`):** existe em `route_stops.weight_kg`.

---

## 10. RISCOS (observação factual de acoplamento)

**Se alguém adicionar agora uma rota pública nova com layout e tokens próprios:**
- A rota precisa ser **adicionada manualmente** à cadeia de `if` em `src/App.tsx` (1.876 linhas) — se não for, cai no catch-all `<NotFound />` (linha 199) e renderiza a **página 404** (não a home). **Correção:** existe, sim, uma rota 404 (`NotFound`, importado na linha 48, retornado na linha 199 quando nenhum path bate). Apenas `/`, `''` e `/index.html` renderizam a home (linha 196).
- Não há `Header`/`Footer`/`Layout` importável (são `const` locais no App.tsx, não exportados) → a página nova **terá que duplicar** o cabeçalho/rodapé (como já ocorre em `HistoryPage`), criando divergência de navegação/rodapé.
- Sem tokens no Tailwind, qualquer cor "própria" entra como **hex hardcoded**, somando-se aos 448 `#8B2214` já existentes; uma mudança de marca não se propaga.
- A página **não** entra no `sitemap.xml` (escrito à mão) a menos que seja editado manualmente, e **não** terá `<title>`/description/canonical/OG próprios (sem SEO por página; SPA puro) → o Google recebe os metadados estáticos da home para essa rota.

**Se alguém adicionar uma tabela nova ligada a pedidos:**
- Precisa de coluna **`company_id`** e política RLS coerente com as demais (RLS ligada nas tabelas core; sem `company_id` a linha fica fora do escopo multi-empresa/`is_admin()`/`my_rep_id()`).
- Baixa de estoque é feita por **triggers em `representative_order_items`/`representative_orders`** (`trg_repco_apply_stock`, `trg_repco_return_stock`); uma tabela nova de itens **não dispara** essas funções automaticamente — a baixa/retorno de estoque não aconteceria sem replicar os triggers.
- Exclusão de pedido/cliente com arquivos em Storage: `ON DELETE CASCADE` no banco **não** remove objetos do Supabase Storage (comportamento documentado no CLAUDE.md); uma tabela nova com anexos herdaria o mesmo ponto.
- Numeração/commissão são acopladas a `representative_orders` via triggers (`set_repco_order_number`, `trigger_repco_commission`); itens/pedidos por outra tabela não recebem esses efeitos.

---

*Fim do retrato factual. Nenhum arquivo de código foi alterado, criado ou apagado na geração deste levantamento (exceto este `RAIO_X.md`, que é o entregável solicitado).*
