# Diagnóstico Saporino — Parte 1: Visão Geral

**Data:** 2026-05-19  
**Projeto:** Café Saporino — website_project  
**Repositório:** github.com/saporino/website_project

---

## 1. Visão Geral do Projeto

### Framework e Linguagem
- **Framework:** Vite + React 18 (SPA, sem SSR)
- **Linguagem:** TypeScript 5.5
- **Estilização:** Tailwind CSS 3.4 (utility-first, sem design system próprio)
- **Roteamento:** Roteamento manual com `window.history.pushState` + `popstate` — **sem react-router-dom** apesar de estar no package.json

### Bibliotecas Principais
| Biblioteca | Versão | Uso |
|---|---|---|
| @supabase/supabase-js | ^2.57.4 | Banco, Auth, Storage |
| react | ^18.3.1 | UI |
| lucide-react | ^0.344.0 | Ícones |
| @mercadopago/sdk-react | ^1.0.6 | Pagamentos |
| react-leaflet + leaflet | ^4.2.1 / ^1.9.4 | Mapa RepCo |
| jsbarcode | ^3.12.3 | Código de barras EAN-13 |
| papaparse | ^5.5.3 | CSV import |
| sonner | ^2.0.7 | Toast notifications |
| vite-plugin-pwa | ^1.3.0 | PWA manifest |

### Estrutura de Pastas
```
website_project/
├── public/                  # Assets estáticos (logo, imagens)
├── src/
│   ├── App.tsx              # Roteador principal + loja pública (1523 linhas)
│   ├── main.tsx             # Entry point
│   ├── types.ts             # Interfaces globais
│   ├── index.css            # CSS global mínimo (~30 linhas)
│   ├── components/
│   │   ├── admin/           # 16 componentes admin
│   │   ├── repco/           # 8 componentes RepCo
│   │   ├── AuthModal.tsx
│   │   ├── CurrencyInput.tsx
│   │   ├── ProductDetail.tsx
│   │   └── SubscriptionCheckout.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Auth Supabase + perfil
│   │   └── CartContext.tsx  # Carrinho local
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── usePresence.ts
│   │   └── usePushNotifications.ts
│   ├── lib/
│   │   ├── supabase.ts      # Cliente Supabase (env vars)
│   │   ├── mercadopago.ts   # SDK MP
│   │   ├── shipping.ts      # Cotação frete
│   │   └── tracking.ts      # URLs rastreamento
│   ├── pages/
│   │   ├── AdminDashboard.tsx
│   │   ├── RepCoDashboard.tsx
│   │   ├── OrderDetailPage.tsx
│   │   ├── PaymentPages.tsx
│   │   ├── PolicyPages.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── SubscriptionPage.tsx
│   │   ├── TrackingPage.tsx
│   │   └── UserProfile.tsx
│   ├── constants/
│   │   └── segments.ts
│   └── utils/
│       ├── calendarLinks.ts
│       ├── currency.ts      # parseBR / formatBR
│       └── routeOptimizer.ts
├── docs/diagnostico/        # Este relatório
└── package.json
```

### Organização Geral
- **Frontend:** SPA React, roteamento por `pathname` manual
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **Auth:** Supabase Auth (email/senha) — perfis em `user_profiles`
- **Banco:** Supabase PostgreSQL — queries diretas do cliente via `supabase-js`
- **Storage:** Supabase Storage — buckets `invoices`, `lot-documents`, `products`
- **Pagamentos:** Mercado Pago (preferências criadas client-side via edge function ou lib)
- **Deploy:** Vercel (inferido pelo git push automático)

### Variáveis de Ambiente Necessárias
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (usado apenas em scripts PowerShell de migração, nunca no bundle)
- `VITE_MERCADOPAGO_PUBLIC_KEY` (inferido)

---

## 2. Rotas e Telas

| Rota | Arquivo | O que faz | Status |
|---|---|---|---|
| `/` | App.tsx → AppContent | Loja pública: header, hero, produtos, sobre, contato, footer | ✅ Funcionando |
| `/admin` | pages/AdminDashboard.tsx | Painel admin com 8 abas | ✅ Funcionando |
| `/repco` | pages/RepCoDashboard.tsx | Portal representante comercial | ✅ Funcionando |
| `/assinatura` | pages/SubscriptionPage.tsx | Assinatura mensal de café | ✅ Funcionando |
| `/meu-perfil` | pages/UserProfile.tsx | Perfil do usuário logado | ✅ Funcionando |
| `/reset-password` | pages/ResetPassword.tsx | Redefinir senha | ✅ Funcionando |
| `/rastrear` | pages/TrackingPage.tsx | Rastrear pedido por código | ✅ Funcionando |
| `/meu-pedido/:id` | pages/OrderDetailPage.tsx | Detalhe de um pedido | ✅ Funcionando |
| `/payment/success` | pages/PaymentPages.tsx | Callback MP aprovado | ✅ Funcionando |
| `/payment/failure` | pages/PaymentPages.tsx | Callback MP falho | ✅ Funcionando |
| `/payment/pending` | pages/PaymentPages.tsx | Callback MP pendente | ✅ Funcionando |
| `/politica-privacidade` | pages/PolicyPages.tsx | Política de privacidade | ✅ Funcionando |
| `/politica-frete` | pages/PolicyPages.tsx | Política de frete | ✅ Funcionando |
| `/politica-reembolso` | pages/PolicyPages.tsx | Política de reembolso | ✅ Funcionando |
| `/termos-servico` | pages/PolicyPages.tsx | Termos de serviço | ✅ Funcionando |
| `/politica-assinatura` | pages/PolicyPages.tsx | Política de assinatura | ✅ Funcionando |
| `/para-seu-negocio` | pages/PolicyPages.tsx | Página B2B | ✅ Funcionando |

### Abas do Admin (/admin)
| Aba | Componente | Função | Status |
|---|---|---|---|
| Dashboard | Dashboard.tsx | Métricas, gráficos, visão geral | ✅ Funcionando |
| Pedidos | OrdersManagement.tsx | CRUD pedidos, NF, etiqueta, logística | ✅ Funcionando |
| Produtos | ProductsManagement.tsx | CRUD produtos, barcode EAN-13 | ✅ Funcionando |
| Clientes | CustomersManagement.tsx | CRUD clientes PF/PJ | ✅ Funcionando |
| Transportadoras | ShippingManagement.tsx | Cadastro e cotação de fretes | ✅ Funcionando |
| RepCo | RepCoManagement.tsx | Gestão de representantes, comissões, mapa ao vivo | ✅ Funcionando |
| Inventário | BatchManagement.tsx | Lotes, torra, embalagem, transferências, documentos | ✅ Funcionando |
| Configurações | StoreSettings.tsx | Dados da loja, notificações | ✅ Funcionando |

### Abas do RepCo (/repco)
| Aba | Componente | Função | Status |
|---|---|---|---|
| Início | RepCoHome.tsx | Resumo, agenda, ações rápidas | ✅ Funcionando |
| Perfil | RepCoProfile.tsx | Dados do representante | ✅ Funcionando |
| Clientes | RepCoClients.tsx | CRUD clientes do rep | ✅ Funcionando |
| Novo Pedido | RepCoNewOrder.tsx | Criar pedido para cliente | ✅ Funcionando |
| Pedidos | RepCoOrders.tsx | Histórico de pedidos do rep | ✅ Funcionando |
| Rotas | RepCoRoutes.tsx | Roteirização com mapa Leaflet | ✅ Funcionando |
| Comissões | RepCoCommissions.tsx | Histórico de comissões | ⚠️ Parcial |
| Performance | RepCoPerformance.tsx | Métricas de desempenho | ⚠️ Parcial |
