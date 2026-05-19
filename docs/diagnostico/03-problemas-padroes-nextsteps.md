# Diagnóstico Saporino — Parte 3: Problemas, Padrões e Build

---

## 7. Problemas Encontrados

### 7.1 Arquitetura / Roteamento
- **Roteador manual:** `AppRouter` usa `window.location.pathname` + `pushState` + `popstate`. `react-router-dom` está no `package.json` mas **não é usado**. Isso causa:
  - F5 em `/admin` ou `/repco` funciona, mas pode quebrar em deploys sem configuração de fallback (`vercel.json` deve ter rewrites para `index.html`)
  - Sem suporte a parâmetros de rota tipados
  - Difícil de manter à medida que rotas crescem

### 7.2 App.tsx monolítico
- `App.tsx` tem **1523 linhas** contendo: roteador, Header, Hero, Products, Cart, About, Contact, Footer — tudo num único arquivo.
- Dificulta manutenção e introduz **risco de conflito** ao editar.

### 7.3 Tipos incompletos em types.ts
- `types.ts` tem apenas 77 linhas e define só `Product`, `CartItem`, `UserProfile`, `UserAddress`, `Order`, `Subscription`.
- Não há tipos para: `GreenCoffeeLot`, `LotTransfer`, `LotDocument`, `Representative`, `RepClient`, `RepOrder`, `Commission`, etc.
- Todos os componentes admin/repco usam `any` liberalmente.

### 7.4 Encoding / Mojibake (corrigido parcialmente)
- Arquivos gerados/editados via PowerShell com encoding Windows-1252 introduziram mojibake em strings PT-BR (ã, é, ó, etc.)
- Corrigido em 6 arquivos (`OrdersManagement`, `ProductsManagement`, `RepCoManagement`, `RouteManager`, `RepCoClients`, `RepCoNewOrder`)
- Emojis corrompidos em `OrdersManagement` (tabs `📋📦🧾🚚`) — substituídos, mas o terminal Windows pode exibir `??` (o arquivo está correto)
- **Risco:** qualquer edição via PowerShell com `Set-Content` sem UTF-8 explícito pode reintroduzir mojibake

### 7.5 Chunk size excessivo
- Build gera `index-*.js` com **794 kB minificado / 185 kB gzip**
- Warning do Vite: `chunk > 500 kB`
- Causa: todos os componentes admin no bundle principal
- **Solução:** `rollupOptions.manualChunks` no `vite.config.ts` para separar admin, repco, leaflet

### 7.6 URL hardcoded de reset senha
- `AuthContext.tsx` linha 125:
  ```ts
  'https://bolt.new/~/sb1-25xmsho6/reset-password'
  ```
  Esse domínio hardcoded é herança do ambiente Bolt.new — **deve ser removido** e substituído por `window.location.origin + '/reset-password'` em produção.

### 7.7 Carrinho sem persistência
- `CartContext` usa apenas `useState` — o carrinho **zera** ao recarregar a página.
- Sem `localStorage` ou sincronização com banco.

### 7.8 Estoque: dupla fonte de verdade (risco resolvido)
- Historicamente `products.stock` era editado manualmente.
- Agora controlado por trigger SQL baseado em lotes ativos.
- **Risco remanescente:** produtos sem lote vinculado ficam com stock=0 mesmo que tenham sido cadastrados manualmente antes da migração.

### 7.9 DocumentUploadButton — posição do dropdown
- O popover de documentos usa `position: absolute; right: 0; top: full` sem `overflow: visible` garantido no pai.
- Em modais com `overflow-y-auto`, o dropdown pode ser cortado.

### 7.10 Comissões RepCo não calculadas automaticamente
- `rep_commissions` é preenchida manualmente pelo admin.
- Não há trigger ou cálculo automático a partir de `rep_orders`.

### 7.11 Pedidos RepCo desconectados dos Pedidos Admin
- `rep_orders` (pedidos via portal RepCo) e `orders` (pedidos da loja pública) são tabelas **separadas**.
- O admin vê apenas `orders` na aba "Pedidos" — os pedidos RepCo não aparecem lá.
- Não há tela unificada de pedidos.

### 7.12 Campos salvos mas não exibidos
- `order_items.product_name` é gravado na criação mas não exibido no `OrdersManagement` (usa `products.name` via join).
- `orders.shipping_recipient` gravado mas raramente exibido na UI.

### 7.13 ProductDetail sem autenticação correta
- `App.tsx` linha 510: `onOpenAuth={() => setIsAuthModalOpen(true)}` referencia `setIsAuthModalOpen` que está no escopo de `AppContent`, mas `Products` recebe como prop — há um passthrough de prop que pode ser frágil.

---

## 8. Padronização Visual

### 8.1 Cores (aplicadas consistentemente)
| Contexto | Cor | Hex |
|---|---|---|
| Admin primário | Vermelho escuro | `#a4240e` |
| Loja primário | Vermelho vinho | `#8B2214` |
| Hover admin | `#8a1f0c` | |
| Hover loja | `#6d1a10` | |
| Fundo admin | Cinza claro | `#f8f7f5` |

⚠️ **Inconsistência:** duas cores de brand diferentes (`#a4240e` vs `#8B2214`). Deveriam ser unificadas.

### 8.2 Inputs — Padrão v4 (aplicado nesta sessão)
Após padronização global, o padrão aprovado é:
```
h-[34px] px-3 text-sm border border-gray-300 rounded
```
Aplicado em: `BatchManagement`, `OrdersManagement`, `ProductsManagement`, `RepCoManagement`, `RouteManager`, `RepCoClients`, `RepCoNewOrder`.

**Exceções (não padronizados):**
- Inputs da loja pública (`App.tsx`, `AuthModal.tsx`, `SubscriptionPage.tsx`) — usam `px-4 py-3` ou `py-3` por serem maiores/mais espaçados
- `textarea` — mantidos sem altura fixa
- `RepCoDashboard` formulário de cadastro — usa `px-4 py-3 rounded-xl` (contexto de onboarding, propositalmente maior)

### 8.3 Botões
| Tipo | Classe base |
|---|---|
| Primário admin | `px-4 py-2 bg-[#a4240e] text-white rounded-lg` |
| Primário loja | `bg-[#8B2214] text-white rounded-full` |
| Secundário | `border border-gray-300 rounded-lg text-gray-600` |
| Destrutivo | `text-red-500 hover:text-red-700` |
| Ação de sub-modal | `px-4 py-2 border rounded` (mais simples) |

⚠️ Sem componente `Button` reutilizável — botões são sempre inline.

### 8.4 Clipe de Upload (DocumentUploadButton)
- Botão badge: `h-[22px] w-[32px] px-1.5 border rounded-sm` (vazio) / expande com contador (com docs)
- Inputs ao lado: `h-[34px] px-3 text-sm border border-gray-300 rounded`
- Container: `flex items-start gap-2`

### 8.5 Modais
- Chrome: `fixed inset-0 z-50 bg-black/40 flex items-center justify-center`
- Card: `bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`
- Cabeçalho: `p-4 border-b flex justify-between items-center`
- Footer: `p-4 border-t flex gap-3`

### 8.6 Cards / Listas
- Sem componente Card reutilizável
- Padrão mais comum: `bg-white rounded-xl shadow-sm border border-gray-200`

---

## 9. Build e Erros

### Resultado do Build (2026-05-19)
```
✓ 1824 modules transformed
dist/index.html                           1.33 kB │ gzip:   0.62 kB
dist/assets/leaflet-vendor-*.js         297.13 kB │ gzip:  90.83 kB
dist/assets/index-*.js                  794.65 kB │ gzip: 184.89 kB

⚠ WARNING: Some chunks are larger than 500 kB after minification.
✓ built in 5.74s
```

**Status:** ✅ Build passou sem erros TypeScript  
**Warning único:** chunk size > 500 kB (não bloqueia deploy, mas impacta performance)

### Erros TypeScript Conhecidos
- Nenhum erro de compilação no momento
- Uso extensivo de `any` em componentes admin/repco (não gera erro, mas reduz segurança de tipos)

---

## 10. Próximos Passos Sugeridos

### P0 — Crítico (impede funcionamento correto)
- [ ] **Corrigir URL hardcoded** de reset senha (`bolt.new/...`) → usar `window.location.origin`
- [ ] **Verificar `vercel.json`** — garantir rewrite `"/*"` → `"/index.html"` para SPA funcionar em F5
- [ ] **Confirmar trigger SQL** de estoque em produção — testar se `quantity_packages` em lote ativo realmente atualiza `products.stock`

### P1 — Importante (interliga o sistema)
- [ ] **Unificar pedidos:** exibir `rep_orders` na aba Pedidos do admin (ou criar aba dedicada)
- [ ] **Cálculo automático de comissões** a partir de `rep_orders` completados
- [ ] **Persistência do carrinho** com `localStorage` (evita perda ao recarregar)
- [ ] **Resolver dupla cor de brand** (`#a4240e` vs `#8B2214`) — escolher uma e aplicar globalmente
- [ ] **Code splitting** via `vite.config.ts` `manualChunks`: separar admin, repco, leaflet

### P2 — Melhorias de padrão visual e usabilidade
- [ ] **Padronizar inputs da loja pública** e AuthModal para consistência visual
- [ ] **Criar componente Button** reutilizável com variantes (primary, secondary, danger)
- [ ] **Criar componente Modal** wrapper para padronizar chrome dos modais
- [ ] **Resolver dropdown do DocumentUploadButton** em contextos de overflow
- [ ] **Adicionar loading state** nos sub-modais de torra e embalagem
- [ ] **Tipos TypeScript** para entidades admin/repco (eliminar `any`)
- [ ] **Refatorar App.tsx** em componentes separados (Header, Hero, Products, Cart em arquivos próprios)

### P3 — Refinamentos futuros
- [ ] **Relatório financeiro** — margem bruta/líquida por lote e período
- [ ] **Export PDF** da Cadeia de Custos por lote
- [ ] **Push notifications** funcionais para novos pedidos
- [ ] **Comissão automática** calculada no fechamento do pedido RepCo
- [ ] **Dashboard RepCo** com metas e projeções
- [ ] **Histórico de preços** — rastrear mudanças de preço em produtos ao longo do tempo
- [ ] **Migrar para react-router-dom** que já está no package.json

---

## 11. Arquivos Mais Importantes

| Arquivo | Tamanho | Importância |
|---|---|---|
| `src/App.tsx` | 75 kB / 1523 linhas | Roteador + toda a loja pública |
| `src/components/admin/BatchManagement.tsx` | 66 kB / ~807 linhas | Engine financeiro do inventário |
| `src/components/admin/CustomersManagement.tsx` | 72 kB | Maior componente do projeto |
| `src/components/admin/RepCoManagement.tsx` | 39 kB | Gestão de representantes |
| `src/components/admin/OrdersManagement.tsx` | 35 kB | Pipeline de pedidos |
| `src/components/admin/ProductsManagement.tsx` | 35 kB | CRUD produtos + barcode |
| `src/components/admin/DocumentUploadButton.tsx` | 5 kB | Upload de documentos por lote |
| `src/components/CurrencyInput.tsx` | 1.3 kB | Input monetário PT-BR |
| `src/contexts/AuthContext.tsx` | 4.3 kB | Auth centralizado |
| `src/lib/supabase.ts` | 0.3 kB | Cliente Supabase (env vars) |
| `src/utils/currency.ts` | 1.2 kB | `parseBR` / `formatBR` |
| `src/utils/routeOptimizer.ts` | 6.5 kB | Algoritmo de otimização de rotas |
| `src/pages/AdminDashboard.tsx` | 6 kB | Shell do admin (8 abas) |
| `src/pages/RepCoDashboard.tsx` | 14 kB | Shell do RepCo (8 abas) |
