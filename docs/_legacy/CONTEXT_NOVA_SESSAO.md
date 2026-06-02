# CONTEXT — NOVA SESSÃO CAFÉ SAPORINO
**Data:** 12 de maio de 2026 · 16:19 BRT  
**Repositório:** https://github.com/saporino/website_project  
**Produção:** https://cafesaporino.com.br  
**Commit atual:** `c404f42`

> Este arquivo é o contexto completo para passar a uma nova sessão de IA.
> Contém: handoff completo, tamanho dos arquivos, histórico de commits, configs e estrutura.

---

## 1. HANDOFF COMPLETO DO PROJETO

### Visão Geral
**Café Saporino** — e-commerce + plataforma de representantes comerciais (RepCo).  
**Stack:** React 18.3 + TypeScript + Vite 5 + Tailwind CSS + Supabase + Vercel

**Portais:**
1. **Site público** (`/`) — loja, assinatura, rastreamento, políticas
2. **Portal RepCo** (`/repco`) — app mobile-first para representantes comerciais
3. **Painel Admin** (`/admin`) — gestão completa do negócio

---

### Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18.3 + TypeScript + Vite 5 |
| Estilo | Tailwind CSS puro (sem framework de UI) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Pagamentos | Mercado Pago SDK React `^1.0.6` |
| Mapas | Leaflet 1.9.4 + React-Leaflet 4.2.1 (OpenStreetMap) |
| Notificações UI | Sonner `^2.0.7` (toasts) |
| Hosting | Vercel — SPA fallback via `routes` no vercel.json |
| Ícones | Lucide React `^0.344.0` |
| CSV | PapaParser `^5.5.3` |
| Tracking | `src/lib/tracking.ts` (Correios + transportadoras) |
| Push Notif. | Web Push API nativa (`usePushNotifications.ts`) |
| Geoloc. | `useGeolocation.ts` (permissão + coords) |

---

### Design System Saporino

**Tokens de cor:**

| Token | Valor | Uso |
|-------|-------|-----|
| Primário | `#8B2214` | Botões, ícones de cards, destaques |
| Primário escuro (hover) | `#6d1a10` | Hover de botões |
| Primário legacy | `#a4240e` | Componentes antigos — migrar gradualmente |
| Fundo página | `#f8f7f5` | `min-h-screen` em todas as páginas admin/repco |
| Fundo ícone card | `#f5f0ef` | Background dos ícones nos stat cards |
| Cards | `#ffffff` | Fundo branco com `border border-gray-200` |
| Borda sutil Saporino | `#ddd0cc` | Bordas contextuais |

**Padrão de stat card:**
```tsx
<div className="bg-white border border-gray-200 rounded-xl p-4">
  <div className="flex items-center justify-between mb-3">
    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
    <div className="w-9 h-9 rounded-lg bg-[#f5f0ef] flex items-center justify-center text-[#8B2214]">
      <Icon className="w-4 h-4" />
    </div>
  </div>
  <div className="text-2xl font-semibold text-gray-900">{value}</div>
  <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
</div>
```

**Card com destaque (Total/Principal):**
```tsx
className="bg-white border border-gray-200 border-l-4 border-l-[#8B2214] rounded-xl p-4"
```

**Regras:**
- ❌ Sem gradientes coloridos nos cards de dashboard
- ❌ Sem bg-blue-50/purple-50/green-50/yellow-50 em stat cards
- ✅ Badges de STATUS de pedido mantêm cores semânticas (verde=pago, amarelo=pendente)
- ✅ Alertas de erro/sucesso mantêm bg-red-50/green-50
- Botões amber → `bg-[#8B2214] hover:bg-[#6d1a10]`

---

### Banco de Dados — Tabelas

**Core E-commerce:**
- `products` — catálogo (nome, preço, estoque, image_url, variantes)
- `orders` — pedidos (PF/PJ, status, payment_status, order_number)
- `order_items` — itens dos pedidos
- `user_profiles` — perfis (account_type: PF/PJ, is_admin, endereços)
- `shipments` — rastreamento + transportadora
- `subscriptions` — assinaturas recorrentes
- `shipping_carriers` — transportadoras
- `label_formats` — formatos de etiqueta de envio

**RepCo Module:**
- `representatives` — reps (status: pending/active/blocked, user_id)
- `representative_clients` — clientes B2B (PF/PJ, CNPJ, segmento, snooze)
- `representative_orders` — pedidos dos reps
- `representative_order_items` — itens
- `representative_commissions` — comissões calculadas
- `price_lists` — tabelas de preço por segmento
- `price_list_items` — itens

**Logística & Rotas (Bloco 8):**
- `routes` — rotas de entrega
- `route_stops` — paradas (com scheduled_at, geolocalização)
- `route_assignments` — atribuição rota→representante
- `delivery_proofs` — Proof of Delivery (foto + texto)
- `client_route_links` — link cliente↔parada de rota

**Inventário (Bloco 9 — SQL pronto, UI pendente):**
- `product_batches` — lotes de produção (fornecedor, altimetria, variedade, certificações, peso verde, custo/kg)
- `batch_photos` — fotos dos lotes

**Sistema:**
- `presence_sessions` — presença online dos usuários
- `notifications` — notificações admin

**Triggers principais:**
- `calculate_batch_costs()` — custo unitário de lotes automático
- `generate_order_number()` — numeração por canal: `PF-YYYY-XXXXXX`, `PJ-...`, `RC-...`, `ML-...`, `SH-...`, `AZ-...`, `TK-...`

---

### Blocos Implementados

| Bloco | Conteúdo | Status |
|-------|----------|--------|
| 1–5 | Core e-commerce: loja, checkout MP, auth, perfil, pedidos, produtos, clientes, transportadoras, assinatura, políticas | ✅ |
| 6 | RepCo base: portal /repco, cadastro reps, tabela preços, numeração canais, lançar pedido, comissões PIX/entrega, rastrear pedido | ✅ |
| 7 | Clientes B2B avançado: ficha PF/PJ, histórico, alertas inatividade, snooze, segmentos ML/SH/AZ/TK | ✅ |
| 8 | Rotas e logística: RouteManager admin, mapa ao vivo Leaflet, geofencing 500m, GPS, Waze/Maps, POD, finalizar rota | ✅ |
| 9 | Inventário: SQL product_batches+batch_photos+trigger custo | ✅ SQL / 🚧 UI |

---

### Autenticação e Permissões

```
Usuário  → user_profiles.account_type (PF | PJ)
Admin    → user_profiles.is_admin = true
RepCo    → representatives.status (pending | active | blocked)
```

**Race condition resolvida (crítico):**
`AdminDashboard` e `RepCoDashboard` verificam `auth.loading` antes de checar permissões.
Sem isso, F5 mostrava "Acesso Negado" porque `user = null` enquanto Supabase restaurava a sessão.

```tsx
const { user, profile, signOut, loading } = useAuth();
if (loading) return <Spinner />; // ← aguarda sessão restaurar
if (!user || !profile?.is_admin) return <AcessoNegado />;
```

---

### Deploy & Infraestrutura

**vercel.json (CRÍTICO — não alterar sem entender):**
```json
{
  "routes": [
    { "src": "/(.*\\.(png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|eot|js|css|map))", "dest": "/$1" },
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/icons/(.*)", "dest": "/icons/$1" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```
- Usar `routes` (não `rewrites`) — único modo que funciona no Vercel para SPA
- Arquivos estáticos (imagens/js/css) passam direto ANTES do catchall SPA
- Sem isso, `/admin` no F5 retorna page em branco

**vite.config.ts:**
```ts
export default defineConfig({
  plugins: [react()],  // VitePWA desativado!
  optimizeDeps: { include: ['leaflet'], exclude: ['lucide-react'] },
  resolve: { dedupe: ['leaflet'] },
  base: '/',
  build: {
    outDir: 'dist', assetsDir: 'assets', sourcemap: false,
    rollupOptions: { output: { manualChunks: { 'leaflet-vendor': ['leaflet','react-leaflet'] } } }
  }
});
```

**PWA:** `vite-plugin-pwa` **desativado** — causava página em branco no F5.  
Script de unregister no `index.html` limpa SWs antigos.  
Para reativar: `navigateFallback: '/index.html'` + `skipWaiting: true`.

**Imagens:**
- Todas em `/public/` (servidas na raiz)
- Arquivos com espaço causam 404 — todos renomeados para kebab-case
- Fallback de produto: `/saporino-logo.png`

**Roteamento (CRÍTICO):**
- **Custom router** em `App.tsx` com `window.location.pathname` + `popstate`
- **NÃO usa React Router Dom** no App principal (está instalado mas não usado)
- Navegação: `window.history.pushState()` + evento `navigate` customizado

---

### Pendências — Próximos Passos

**🔴 Alta Prioridade:**
1. **BatchManagement.tsx** — UI de gestão de lotes (Bloco 9)
   - Lista de lotes com filtros/status
   - Formulário criação/edição com todos os campos SQL
   - Cálculo de custo unitário visual + upload de fotos

2. **Reativar PWA** — após estabilização
   - `VitePWA` com `navigateFallback: '/index.html'`, `skipWaiting: true`, `clientsClaim: true`

**🟡 Média Prioridade:**
3. Filtro "Site" em RepCoManagement → `user_profiles` sem entry em `representatives`
4. Filtro "Marketplaces" → pedidos com prefixo ML/SH/AZ/TK
5. PDF de rota finalizada e relatório de comissão mensal
6. Dashboard de margem por lote

**🟢 Baixa Prioridade:**
7. Campo `segment` em `user_profiles` para clientes do site
8. Integração APIs ML/Amazon/Shopee/TikTok
9. App nativo via Capacitor/PWA Builder

---

### Bugs Conhecidos / Resolvidos

| Issue | Status | Solução |
|-------|--------|---------|
| F5 em `/admin` → "Acesso Negado" | ✅ | `auth.loading` guard no AdminDashboard |
| PWA SW → página em branco no refresh | ✅ | VitePWA desativado + unregister script |
| Imagens com espaço no nome → 404 | ✅ | Renomeados para kebab-case |
| `Content-Type: application/javascript` em imagens | ✅ | Header removido do vercel.json |
| Tabs admin com scroll horizontal | ✅ | `flex-1 text-xs` sem ícones |
| `Package` não importado em AdminDashboard | ✅ | Adicionado ao import |

---

### Variáveis de Ambiente (Vercel)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_MERCADO_PAGO_PUBLIC_KEY=...
```

---

## 2. TAMANHO DOS ARQUIVOS (linhas)

```
1534  src/components/admin/CustomersManagement.tsx
1387  src/App.tsx
 793  src/components/SubscriptionCheckout.tsx
 704  src/pages/SubscriptionPage.tsx
 698  src/components/admin/RepCoManagement.tsx
 670  src/components/admin/OrdersManagement.tsx
 613  src/components/admin/ProductsManagement.tsx
 455  src/components/admin/ShippingManagement.tsx
 424  src/pages/PaymentPages.tsx
 398  src/components/AuthModal.tsx
 395  src/components/admin/Dashboard.tsx
 350  src/components/admin/LabelFormatsManagement.tsx
 334  src/pages/TrackingPage.tsx
 327  src/components/admin/StoreSettings.tsx
 317  src/components/repco/RepCoClients.tsx
 314  src/components/repco/RepCoRoutes.tsx
 288  src/components/repco/RepCoNewOrder.tsx
 283  src/pages/PolicyPages.tsx
 272  src/pages/RepCoDashboard.tsx
 265  src/pages/OrderDetailPage.tsx
 228  src/pages/UserProfile.tsx
 220  src/components/admin/RouteManager.tsx
 220  src/components/admin/RepCoLiveMap.tsx
 201  src/components/repco/RepCoHome.tsx
 195  src/components/admin/RepCoOrdersManager.tsx
 192  src/components/admin/AdminNotificationBell.tsx
 176  src/utils/routeOptimizer.ts
 166  src/components/admin/RepCoCommissionsManager.tsx
 166  src/lib/tracking.ts
 142  src/pages/ResetPassword.tsx
 135  src/contexts/AuthContext.tsx
 134  src/pages/AdminDashboard.tsx
 132  src/components/admin/PriceListManager.tsx
 117  src/components/repco/RepCoPerformance.tsx
 109  src/lib/shipping.ts
```

---

## 3. ÚLTIMOS 15 COMMITS

```
c404f42 docs: HANDOFF_SAPORINO.md - documentacao completa do projeto
31b616b feat: design system Saporino global - bg bege f8f7f5, amber->vermelho botoes, amber->f5f0ef cards RepCo
fec1067 feat: design system Saporino - cards brancos #f5f0ef/#8B2214, fundo bege #f8f7f5 admin e repco
69a25c6 fix: AdminDashboard aguarda auth.loading antes de verificar permissoes - resolve Acesso Negado no F5
8e767e6 fix: vercel routes - js/css passthrough antes do catchall SPA
46f209c fix: vercel.json - adiciona passthrough para .jpg .png .webp antes do catchall SPA
919ba0d fix: rename imagens sem espacos (saporino-logo.png, cafe-logo-saporino2.png) + corrige refs no App.tsx
9333231 fix: remove VitePWA completamente + SW unregister script - resolve refresh em branco definitivamente
bc127b0 fix: vercel routes (SPA fallback definitivo) + SW injectRegister null para diagnostico
cf3136c fix: no-cache headers no vercel.json para index.html + meta tags no-cache no HTML
8c494e5 fix: SW navigateFallback + skipWaiting - corrige pagina em branco no F5 em /admin /repco /rastrear
97c1ed7 fix: canal filter logic - site/marketplaces empty with messages, todos/repco show reps
5d24305 fix: admin tabs compact (text-only, flex-1, no scroll) - todas 8 abas em uma linha
5b9568d fix: restore channel filter buttons (Todos/Site/RepCo/Marketplaces) + combined filter logic
a57e6b4 fix: RepCo header layout (2 rows aligned h-9), admin tabs overflow-x-auto, remove channel filter
```

---

## 4. TABELAS DO SUPABASE

> ⚠️ Lista baseada nas migrations — verificar estado real no painel Supabase em caso de dúvida.

```
addresses
batch_photos
delivery_proofs
label_formats
notifications
order_items
orders
presence_sessions
price_list_items
price_lists
product_batches
products
representative_clients
representative_commissions
representative_order_items
representative_orders
representatives
route_assignments
route_stops
routes
shipments
shipping_carriers
subscriptions
user_profiles
client_route_links        (migration: routes_client_link.sql)
```

---

## 5. CONFIGS ATUAIS

### vercel.json
```json
{
  "routes": [
    {
      "src": "/(.*\\.(png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|eot|js|css|map))",
      "dest": "/$1"
    },
    { "src": "/assets/(.*)", "dest": "/assets/$1" },
    { "src": "/icons/(.*)", "dest": "/icons/$1" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### vite.config.ts
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VitePWA desativado temporariamente para estabilidade
// import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // VitePWA removido temporariamente — reativar após estabilizar o site
  ],
  optimizeDeps: {
    include: ['leaflet'],
    exclude: ['lucide-react'],
  },
  resolve: {
    dedupe: ['leaflet'],
  },
  server: { watch: { usePolling: false } },
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
```

### index.html (partes críticas)
```html
<!-- no-cache para evitar SW stale -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">

<!-- Desregistra Service Workers antigos -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    });
    caches.keys().then(function(cacheNames) {
      cacheNames.forEach(function(cacheName) {
        caches.delete(cacheName);
      });
    });
  }
</script>
```

---

## 6. ESTRUTURA DE DIRETÓRIOS

### src/pages/
```
AdminDashboard.tsx     134 linhas  — 8 abas: dashboard|orders|products|customers|shipping|repco|inventory|settings
RepCoDashboard.tsx     272 linhas  — 7 abas: inicio|clients|novo_pedido|orders|commissions|routes|performance|profile
TrackingPage.tsx       334 linhas  — Rastrear pedido público /rastrear
OrderDetailPage.tsx    265 linhas  — Detalhe de pedido cliente
UserProfile.tsx        228 linhas  — Perfil do usuário logado
SubscriptionPage.tsx   704 linhas  — Assinatura recorrente
ResetPassword.tsx      142 linhas  — Redefinir senha
PolicyPages.tsx        283 linhas  — Políticas (privacidade, frete, reembolso, ToS)
PaymentPages.tsx       424 linhas  — Retorno Mercado Pago (sucesso/falha/pendente)
```

### src/components/admin/
```
Dashboard.tsx               395 lin  — Cards stats (design system) + top produtos + transportadoras
OrdersManagement.tsx        670 lin  — Gestão completa de pedidos (filtros, status, etiquetas)
ProductsManagement.tsx      613 lin  — CRUD produtos (imagens, estoque, variantes, preços)
CustomersManagement.tsx    1534 lin  — Gestão clientes (PF/PJ, histórico, endereços)
ShippingManagement.tsx      455 lin  — Transportadoras + cálculo frete + etiquetas
StoreSettings.tsx           327 lin  — Configurações gerais da loja
LabelFormatsManagement.tsx  350 lin  — Formatos de etiqueta (ZPL, PDF, etc.)
RepCoManagement.tsx         698 lin  — Gestão representantes (filtros canal+status, aprovação)
RepCoOrdersManager.tsx      195 lin  — Pedidos RepCo vistos pelo admin
RepCoCommissionsManager.tsx 166 lin  — Comissões (admin view, pagar/cancelar)
RepCoLiveMap.tsx            220 lin  — Mapa ao vivo com presença dos reps (Leaflet)
RouteManager.tsx            220 lin  — CRUD rotas + paradas + atribuições
PriceListManager.tsx        132 lin  — Tabela de preços global por segmento
AdminNotificationBell.tsx   192 lin  — Sino notificações + badge contagem
```

### src/components/repco/
```
RepCoHome.tsx       201 lin  — Dashboard rep: stats 2x2, meta do mês, próximas visitas, alertas inatividade
RepCoClients.tsx    317 lin  — Lista/busca clientes B2B + ficha completa (PF/PJ, CNPJ, histórico)
RepCoNewOrder.tsx   288 lin  — Lançar pedido: seletor produtos, comissão manual, optimistic UI
RepCoOrders.tsx      ~90 lin — Histórico pedidos do rep
RepCoCommissions.tsx ~80 lin — Extrato de comissões do rep
RepCoRoutes.tsx     314 lin  — Mapa de rotas (Leaflet), GPS, POD, finalizar rota, geofencing
RepCoPerformance.tsx 117 lin — Gráficos de performance e metas
RepCoProfile.tsx     ~80 lin — Perfil e documentos do representante
```

### src/migrations (ordem cronológica)
```
20251011... add_user_profiles_and_addresses
20251014... enhance_ecommerce_for_brazil
20251115... create_subscriptions_table
20251116... add_user_profile_fields
20251116... add_unique_constraints_and_fix_rls
20251118... add_roast_and_flavor_notes_to_products
20251118... add_customer_enhancements
20251118... add_address_fields_to_profiles
20251118... create_shipping_label_formats
20251209... create_orders_tables
bloco6_missing_columns.sql
bloco7_triggers.sql
bloco8_routes_logistics.sql
bloco9_inventory_batches.sql
fix_rc_order_format.sql
order_number_by_channel.sql
presence_system.sql
price_lists_table.sql
pwa_calendar_inactivity.sql
repco_module.sql
routes_client_link.sql
routes_module.sql
routes_status_fix.sql
```

---

## 7. DECISÕES TÉCNICAS CRÍTICAS

### Router Customizado
```tsx
// App.tsx — NÃO usa React Router Dom!
const [path, setPath] = useState(window.location.pathname);
useEffect(() => {
  const handler = () => setPath(window.location.pathname);
  window.addEventListener('popstate', handler);
  window.addEventListener('navigate', handler);
  return () => { ... };
}, []);
// Navegação via: window.history.pushState({}, '', '/rota'); window.dispatchEvent(new Event('navigate'));
```

### Filtros de Canal RepCoManagement
```tsx
// RepCoManagement.tsx — filtro duplo: canal + status
canalFilter === 'todos'       → todos os reps (lista normal)
canalFilter === 'repco'       → todos os reps (lista normal)
canalFilter === 'site'        → lista vazia + mensagem (aguarda integração)
canalFilter === 'marketplaces'→ lista vazia + mensagem (aguarda integração)
// Combinado com statusFilter: todos|pendentes|ativos|bloqueados
```

### Admin Deep-link para Aba RepCo
```tsx
// De RepCoDashboard → voltar para Admin na aba RepCo:
localStorage.setItem('admin-initial-tab', 'repco');
navigate('/admin');
// AdminDashboard lê e aplica no useEffect
```

### Optimistic Update em RepCoNewOrder
```tsx
// Mostra "sucesso" imediatamente, faz insert em background
// Se falha: reverte para tela de revisão com erro
```

---

## 8. COMANDOS ESSENCIAIS

```powershell
npm run dev      # Dev local
npm run build    # Build produção
npm run save     # Build + git add -A + git commit + git push origin main
```

> `npm run save` usa o script `save.ps1` — confirmar mensagem de commit quando solicitado.

---

*Gerado automaticamente pelo Antigravity em 12/05/2026.*
