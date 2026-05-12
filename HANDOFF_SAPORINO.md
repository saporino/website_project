# HANDOFF SAPORINO — Documentação Completa do Projeto
**Gerado em:** 12 de maio de 2026  
**Repositório:** https://github.com/saporino/website_project  
**Produção:** https://cafesaporino.com.br  
**Último commit:** `31b616b`

---

## 📋 Visão Geral

**Café Saporino** é um e-commerce + plataforma de representantes comerciais (RepCo) construído em React/Vite com Supabase como backend. O sistema tem dois portais distintos:

1. **Site público** — loja, assinatura, rastreamento, políticas
2. **Portal RepCo** (`/repco`) — PWA para representantes comerciais
3. **Painel Admin** (`/admin`) — gestão completa do negócio

---

## 🏗️ Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18.3 + TypeScript + Vite 5 |
| Estilo | Tailwind CSS (sem framework de UI) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Pagamentos | Mercado Pago SDK React |
| Mapas | Leaflet + React-Leaflet (OpenStreetMap) |
| Notificações | Sonner (toast) |
| Hosting | Vercel (SPA fallback via `routes` no vercel.json) |
| Ícones | Lucide React |
| CSV | PapaParser |
| Tracking | lib/tracking.ts (Correios + transportadoras) |

---

## 🎨 Design System Saporino

### Cores

| Token | Valor | Uso |
|-------|-------|-----|
| Primário | `#8B2214` | Botões principais, ícones de cards, destaques |
| Primário escuro | `#6d1a10` | Hover de botões |
| Primário legacy | `#a4240e` | Usado em alguns componentes antigos (migrar gradualmente) |
| Fundo página | `#f8f7f5` | `min-h-screen` de todas as páginas admin/repco |
| Fundo card ícone | `#f5f0ef` | Background dos ícones nos stat cards |
| Cards | `#ffffff` | Fundo branco com `border border-gray-200` |
| Borda sutil | `#ddd0cc` | Bordas contextuais no tom Saporino |

### Padrão de Card de Estatística

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

### Regras de Estilo

- **Sem** gradientes coloridos em cards de dashboard
- **Sem** cores pastel (blue-50, purple-50, green-50, yellow-50) em cards de stats
- **Mantidos** badges de STATUS de pedido com cores semânticas (verde=pago, amarelo=pendente, etc.)
- **Mantidos** alertas contextuais de erro (`bg-red-50`) e sucesso
- Botões amber → `bg-[#8B2214] hover:bg-[#6d1a10]`

---

## 🗄️ Banco de Dados — Tabelas Principais

### Core E-commerce
| Tabela | Descrição |
|--------|-----------|
| `products` | Catálogo de cafés |
| `orders` | Pedidos do site (PF/PJ) |
| `order_items` | Itens dos pedidos |
| `user_profiles` | Perfis (account_type: PF/PJ) |
| `shipments` | Dados de envio/rastreamento |
| `subscriptions` | Assinaturas recorrentes |
| `shipping_carriers` | Transportadoras cadastradas |
| `label_formats` | Formatos de etiqueta de envio |

### RepCo Module
| Tabela | Descrição |
|--------|-----------|
| `representatives` | Representantes cadastrados |
| `representative_clients` | Clientes B2B dos reps (PF/PJ) |
| `representative_orders` | Pedidos feitos pelos reps |
| `representative_order_items` | Itens dos pedidos dos reps |
| `representative_commissions` | Comissões calculadas |
| `price_lists` | Tabelas de preço por segmento |
| `price_list_items` | Itens das tabelas de preço |

### Logística & Rotas (Bloco 7/8)
| Tabela | Descrição |
|--------|-----------|
| `routes` | Rotas de entrega |
| `route_stops` | Paradas de cada rota |
| `route_assignments` | Atribuição rota→representante |
| `delivery_proofs` | Proof of Delivery (foto + assinatura) |
| `client_route_links` | Link cliente→parada de rota |

### Inventário (Bloco 9)
| Tabela | Descrição |
|--------|-----------|
| `product_batches` | Lotes de produção |
| `batch_photos` | Fotos dos lotes |

### Sistema
| Tabela | Descrição |
|--------|-----------|
| `presence_sessions` | Presença online dos usuários |
| `notifications` | Notificações admin |

### Triggers Principais
- `calculate_batch_costs()` — calcula custo unitário de lotes automaticamente
- `generate_order_number()` — numeração por canal: `PF-YYYY-XXXXXX`, `PJ-...`, `RC-...`, `ML-...`, `SH-...`, `AZ-...`, `TK-...`

---

## 📦 Blocos Implementados

### Bloco 1–5 — Core E-commerce ✅
- Loja com catálogo de produtos
- Carrinho e checkout via Mercado Pago
- Autenticação (email/senha + recuperação)
- Perfil de usuário (PF/PJ, endereços)
- Gestão de pedidos admin (CRUD completo)
- Gestão de produtos (com imagens, estoque, variantes)
- Gestão de clientes
- Transportadoras (cálculo de frete, etiquetas)
- Páginas de política (privacidade, frete, reembolso, ToS, assinatura)
- Assinatura recorrente

### Bloco 6 — RepCo Base ✅
- Portal do Representante em `/repco`
- Cadastro de representantes com aprovação admin
- Tabela de preços global por segmento
- Numeração de pedidos por canal (`PF/PJ/RC/ML/SH/AZ/TK`)
- Clientes B2B com histórico de vendas
- Lançamento de pedidos com seletor de produtos + comissão manual
- Comissões por tipo de entrega (+2.5%) e PIX (+0.5%)
- Rastrear Pedido público em `/rastrear`
- Portal RepCo acessível via dropdown do site

### Bloco 7 — Clientes B2B Avançado ✅
- Ficha completa de cliente PF/PJ (razão social, CNPJ, segmento)
- Histórico de vendas por cliente
- Alertas de inatividade (configurable em dias)
- Snooze de alertas (+2 dias)
- Segmentos de marketplace (`ML/SH/AZ/TK`)
- `prop fixedSegment` para formulários contextuais

### Bloco 8 — Rotas e Logística ✅
- Gestão de rotas admin (RouteManager)
- Atribuição de rotas para representantes
- RepCoRoutes — mapa ao vivo (Leaflet/OSM) com pins de paradas
- Geofencing 500m → alerta de proximidade
- GPS ativo (hook `useGeolocation`)
- Navegação via Waze/Google Maps
- Proof of Delivery (foto + texto)
- Finalizar rota com aprendizado automático
- Filtros de rota por tipo/região/segmento/capacidade

### Bloco 9 — Inventário ✅ (SQL) / 🚧 (UI)
- Tabela `product_batches` com campos completos (fornecedor, altimetria, variedade, certificações)
- Campos de matéria-prima (peso verde, custo/kg, custo total calculado)
- Trigger `calculate_batch_costs()` — custo unitário automático
- `batch_photos` para fotos de lotes
- Aba "Inventário" no admin como placeholder
- **UI de gestão de lotes ainda não implementada** (BatchManagement.tsx pendente)

### Sistema de Presença ✅
- `usePresence.ts` — presença online dos usuários
- Mapa ao vivo (`RepCoLiveMap`) com localização de reps em campo

### Push Notifications ✅
- `usePushNotifications.ts` — integração com Web Push API
- `AdminNotificationBell` — sino de notificações no painel admin

---

## 🔐 Autenticação e Permissões

```
Usuário → user_profiles.account_type (PF | PJ)
Admin   → user_profiles.is_admin = true
RepCo   → representatives.status (pending | active | blocked)
```

**Race condition resolvida:** `AdminDashboard` e `RepCoDashboard` aguardam `auth.loading = false` antes de verificar permissões — evita "Acesso Negado" no F5.

---

## 🚀 Deploy & Infraestrutura

### vercel.json
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

**Ponto crítico:** usar `routes` (não `rewrites`) — garante SPA fallback correto no Vercel.

### PWA
- `vite-plugin-pwa` **desativado temporariamente** (`injectRegister: null` + plugin removido)
- Script de unregister no `index.html` — limpa SWs antigos dos usuários
- Para reativar: adicionar plugin de volta com `navigateFallback: '/index.html'` e `skipWaiting: true`

### Imagens
- Todas em `/public/` — servidas na raiz do deploy
- **Arquivos com espaço renomeados:** `saporino-logo.png`, `cafe-logo-saporino2.png`, `coffee-field2.webp`
- Fallback de produto: `/saporino-logo.png`

### Keep-alive Supabase
- Ping a cada 4 dias para evitar pausa do plano free (implementado em `App.tsx`)

---

## 📁 Estrutura de Arquivos

```
src/
├── App.tsx                          # Router principal (custom history API)
├── main.tsx                         # Entry point
├── types.ts                         # Tipos globais
├── contexts/
│   ├── AuthContext.tsx               # Auth + perfil + loading state
│   └── CartContext.tsx               # Carrinho de compras
├── hooks/
│   ├── useGeolocation.ts             # GPS + permissão
│   ├── usePresence.ts                # Presença online
│   └── usePushNotifications.ts       # Web Push
├── lib/
│   ├── supabase.ts                   # Client Supabase
│   ├── mercadopago.ts                # SDK Mercado Pago
│   ├── shipping.ts                   # Cálculo de frete + CEP lookup
│   └── tracking.ts                  # Tracking de envios
├── constants/
│   └── segments.ts                   # Segmentos de mercado (ML/SH/AZ/TK/etc)
├── pages/
│   ├── AdminDashboard.tsx            # Painel admin (8 abas)
│   ├── RepCoDashboard.tsx            # Portal RepCo (7 abas)
│   ├── TrackingPage.tsx              # Rastrear pedido público
│   ├── OrderDetailPage.tsx           # Detalhe de pedido
│   ├── UserProfile.tsx               # Perfil do usuário
│   ├── SubscriptionPage.tsx          # Página de assinatura
│   ├── ResetPassword.tsx             # Recuperação de senha
│   ├── PolicyPages.tsx               # Páginas de política
│   └── PaymentPages.tsx              # Retorno Mercado Pago
├── components/
│   ├── AuthModal.tsx                 # Modal login/cadastro
│   ├── SubscriptionCheckout.tsx      # Checkout de assinatura
│   ├── admin/
│   │   ├── Dashboard.tsx             # Cards stats + top produtos + transportadoras
│   │   ├── OrdersManagement.tsx      # Gestão de pedidos
│   │   ├── ProductsManagement.tsx    # Gestão de produtos
│   │   ├── CustomersManagement.tsx   # Gestão de clientes
│   │   ├── ShippingManagement.tsx    # Transportadoras + etiquetas
│   │   ├── StoreSettings.tsx         # Configurações da loja
│   │   ├── LabelFormatsManagement.tsx# Formatos de etiqueta
│   │   ├── RepCoManagement.tsx       # Gestão de representantes
│   │   ├── RepCoOrdersManager.tsx    # Pedidos RepCo (admin view)
│   │   ├── RepCoCommissionsManager.tsx # Comissões (admin view)
│   │   ├── RepCoLiveMap.tsx          # Mapa ao vivo
│   │   ├── RouteManager.tsx          # Gestão de rotas
│   │   ├── PriceListManager.tsx      # Tabela de preços
│   │   └── AdminNotificationBell.tsx # Sino de notificações
│   └── repco/
│       ├── RepCoHome.tsx             # Dashboard rep (stats, alertas, rotas)
│       ├── RepCoClients.tsx          # Clientes B2B
│       ├── RepCoNewOrder.tsx         # Lançar pedido (optimistic UI)
│       ├── RepCoOrders.tsx           # Histórico de pedidos
│       ├── RepCoCommissions.tsx      # Extrato de comissões
│       ├── RepCoRoutes.tsx           # Mapa de rotas + POD
│       ├── RepCoPerformance.tsx      # Performance/metas
│       └── RepCoProfile.tsx          # Perfil do representante
```

---

## ⚡ Decisões Técnicas Importantes

### Roteamento
- **Custom router** em `App.tsx` usando `window.location.pathname` + `popstate`
- **Sem** React Router Dom no App principal (apesar de estar instalado)
- Navegação via `window.history.pushState()` + evento customizado `navigate`

### Optimistic Updates
- `RepCoNewOrder.tsx` — mostra sucesso imediatamente, faz insert em background
- Em caso de falha: reverte para tela de revisão com mensagem de erro

### Admin Deep-link
- `localStorage.setItem('admin-initial-tab', 'repco')` → abre admin na aba correta

### Filtros de Canal (RepCoManagement)
```
Todos      → todos os representantes
RepCo      → todos (reps são todos RepCo)
Site       → lista vazia (aguarda integração)
Marketplaces → lista vazia (aguarda integração ML/Amazon/Shopee/TikTok)
```

---

## 🔧 Comandos do Dia a Dia

```bash
npm run dev          # Dev server local
npm run build        # Build de produção
npm run save         # Build + git add + commit + push (script save.ps1)
```

### save.ps1
Script PowerShell que automatiza: `npm run build` → `git add -A` → `git commit` → `git push origin main`

---

## 📋 Pendências & Próximos Passos

### 🔴 Alta Prioridade
1. **BatchManagement.tsx** — UI completa de gestão de lotes (Bloco 9)
   - Lista de lotes com status/filtros
   - Formulário de criação/edição com todos os campos SQL
   - Cálculo de custo unitário visual
   - Upload de fotos de lotes

2. **Reativar PWA** — após estabilização do site
   - Adicionar `VitePWA` de volta com `navigateFallback: '/index.html'`
   - `skipWaiting: true` + `clientsClaim: true`
   - Testar em dispositivo Android/iOS

### 🟡 Média Prioridade
3. **Integração de Canais**
   - Filtro "Site" → buscar usuários em `user_profiles` sem registro em `representatives`
   - Filtro "Marketplaces" → pedidos com prefixo `ML/SH/AZ/TK`

4. **Relatórios PDF**
   - PDF de rota finalizada (paradas, PODs, km percorrido)
   - Relatório de comissão mensal por representante

5. **Monitoramento de Custos**
   - Dashboard de margem real por lote
   - Alerta quando margem < threshold configurável

### 🟢 Baixa Prioridade
6. **Segmentos em `user_profiles`** — campo `segment` para clientes do site
7. **Integração ML/Amazon/Shopee/TikTok** — importar pedidos via API
8. **App nativo** — transformar PWA em APK via PWA Builder ou Capacitor
9. **Relatório de metas** — gráfico de evolução mensal da meta do rep
10. **Webhook Mercado Pago** — revisar `supabase/functions/mercadopago-webhook`

---

## 🐛 Bugs Conhecidos / Gotchas

| Issue | Status | Solução |
|-------|--------|---------|
| F5 em `/admin` mostrava "Acesso Negado" | ✅ Resolvido | `auth.loading` guard no AdminDashboard |
| PWA SW causava página em branco no refresh | ✅ Resolvido | VitePWA desativado + unregister script |
| Imagens com espaço no nome quebravam no Vercel | ✅ Resolvido | Renomeados para sem espaço |
| `Content-Type: application/javascript` aplicado a imagens | ✅ Resolvido | Header removido do vercel.json |
| Tabs admin com scroll horizontal | ✅ Resolvido | `flex-1 text-xs` sem ícones |
| `Package` icon não importado em AdminDashboard | ✅ Resolvido | Adicionado ao import |
| `bg-gray-50` em páginas RepCo (cor errada) | ✅ Resolvido | Substituído por `bg-[#f8f7f5]` |

---

## 🔑 Variáveis de Ambiente

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_MERCADO_PAGO_PUBLIC_KEY=...
```

Configuradas no painel Vercel em Environment Variables.

---

## 📊 Estado do Banco (Supabase)

- **Projeto:** `saporino` (Supabase free tier)
- **Keep-alive:** ping automático a cada 4 dias para não pausar
- **RLS:** ativado em todas as tabelas de usuário
- **Storage:** imagens de produtos armazenadas no Supabase Storage

---

*Documento gerado pelo Antigravity em 12/05/2026 — manter atualizado a cada bloco concluído.*
