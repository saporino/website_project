# Diagnóstico Saporino — Parte 2: Banco de Dados e Fluxos

---

## 3. Banco de Dados (Supabase / PostgreSQL)

### Tabelas Identificadas

#### Públicas / Loja
| Tabela | Descrição |
|---|---|
| `products` | Produtos à venda: nome, preço, estoque, barcode, weight_grams, categoria |
| `orders` | Pedidos: cliente, endereço, total, status, carrier, MercadoPago preference |
| `order_items` | Itens de pedido: product_id, qty, unit_price |
| `invoices` | Notas fiscais vinculadas a pedidos |
| `shipments` | Envios: transportadora, tracking code, status |
| `subscriptions` | Assinaturas mensais: coffees selecionados, tipo moagem, data envio |
| `user_profiles` | Perfis de usuário: full_name, phone, is_admin, account_type |
| `store_settings` | Config da loja: contatos, endereço, limites de frete |

#### Representantes Comerciais (RepCo)
| Tabela | Descrição |
|---|---|
| `representatives` | Cadastro de RepCos: user_id, status, commission_rate |
| `rep_clients` | Clientes vinculados a um representante |
| `rep_orders` | Pedidos feitos por representantes |
| `rep_commissions` | Registro de comissões |
| `rep_presence` | Presença ao vivo (geolocalização + aba ativa) |
| `rep_routes` | Rotas planejadas para representantes |
| `notifications` | Notificações admin: tipo, lida/não-lida |

#### Inventário / Financeiro (BatchManagement)
| Tabela | Descrição |
|---|---|
| `green_coffee_lots` | Lotes de café verde: peso, custo, status, produto vinculado |
| `roasting_companies` | Torrefadoras: CNPJ, diretor, contato |
| `lot_transfers` | Transferências de saldo entre lotes (verde ou torrado) |
| `lot_documents` | Documentos anexados a lotes: NF, pagamento torra, embalagem |

#### Storage Buckets
| Bucket | Uso |
|---|---|
| `invoices` | PDFs e XMLs de notas fiscais de pedidos |
| `lot-documents` | Comprovantes de compra, PIX de torra, NFs de lotes |
| `products` | Imagens de produtos |

---

## 4. Fluxos Principais

### 4.1 Autenticação
- Supabase Auth (email/senha)
- `AuthContext` centraliza: `user`, `session`, `profile`, `loading`
- Login → `supabase.auth.signInWithPassword` → `loadProfile(userId)` → `user_profiles`
- Cadastro → `supabase.auth.signUp` → trigger DB cria `user_profiles`
- Reset senha → `supabase.auth.resetPasswordForEmail` → redireciona para `/reset-password`
- `is_admin = true` em `user_profiles` → acesso ao `/admin`
- `representatives.status = 'active'` → acesso ao `/repco`

### 4.2 Loja Pública / Carrinho
- Produtos carregados do Supabase em `AppContent.loadProducts()`
- `CartContext` usa `useState` local (sem persistência em banco — perde no reload)
- Checkout: cria `orders` + `order_items` + preferência Mercado Pago
- Pagamento: callbacks em `/payment/success|failure|pending`

### 4.3 Gestão de Pedidos (Admin)
- `OrdersManagement` → lê `orders` com joins em `order_items`, `invoices`, `shipments`, `user_profiles`
- 4 seções: Visão Geral, Embalagem, Nota Fiscal, Logística
- Status pipeline: `created → payment_pending → payment_approved → invoice_pending → ready_for_shipment → label_generated → shipped → delivered`
- Upload NF: bucket `invoices` (PDF + XML)
- Etiqueta: impressão browser via `window.open`

### 4.4 Inventário / Lotes (BatchManagement)
**Este é o módulo mais complexo do sistema.**

#### Fluxo de um Lote
```
Compra Verde
  └── green_coffee_lots (status: active)
       ├── lot_documents (compra_verde, nota_fiscal)
       ├── lot_transfers (entrada de verde de outros lotes)
       │
       ├── Torra
       │    ├── green_input_to_roast_kg
       │    ├── service_price_per_kg
       │    ├── roasted_output_kg
       │    ├── roast_date
       │    └── lot_documents (pagamento_torra)
       │
       ├── Embalagem
       │    ├── packaged_kg
       │    ├── packaging_cost_per_kg
       │    ├── quantity_packages → products.stock (via trigger)
       │    ├── packaging_date
       │    └── lot_documents (pagamento_embalagem)
       │
       └── Transferência (lot_transfers)
            ├── kind: 'green' | 'roasted'
            ├── kg_amount
            ├── value_amount_brl (calculado: kg × custo_médio)
            └── to_lot_id / from_lot_id
```

#### Cálculo de Custos (Cadeia de Custos)
- **Verde próprio:** `total_paid_brl / green_weight_kg` = custo/kg base
- **Verde efetivo** (`getEffectiveVerde`): ponderação entre próprio + recebido via transfers
- **Custo da torra:** `(verde_kg × custo_verde + serviço_torra) / saída_forno`
- **Torrado efetivo** (`getEffectiveTorrado`): ponderação entre próprio + recebido
- **Custo final/kg:** `custo_torrado_médio + packaging_cost_per_kg`
- **Sobra torrado:** `total_torrado − embalado` → crédito financeiro calculado

#### Controle de Estoque
- `products.stock` é atualizado por trigger SQL quando lote muda de status
- Fórmula: `stock = sum(quantity_packages) de lotes active do produto`

### 4.5 RepCo
- Cadastro do rep → `representatives` (status: pending)
- Admin aprova → status: active
- Rep cria clientes → `rep_clients`
- Rep cria pedidos → `rep_orders` (separado de `orders` público)
- Comissão → `rep_commissions` (registrada manualmente pelo admin)
- Geolocalização ao vivo → `rep_presence` (atualizada por `usePresence` hook)
- Mapa admin → `RepCoLiveMap` (Leaflet) lê `rep_presence`
- Rotas → `rep_routes` com algoritmo de otimização em `routeOptimizer.ts`

### 4.6 Upload de Documentos (lot_documents)
- `DocumentUploadButton` → Supabase Storage (bucket `lot-documents`, privado)
- Caminho: `{lot_id}/{kind}/{timestamp}_{filename}`
- Metadados gravados em `lot_documents` (lot_id, kind, storage_path, file_name)
- Acesso via `createSignedUrl` (1h de validade)
- Exclusão: `storage.remove` + `lot_documents.delete`
- 4 `kind` suportados: `compra_verde`, `nota_fiscal`, `pagamento_torra`, `pagamento_embalagem`

---

## 5. Integrações Externas

| Integração | Arquivo | Status |
|---|---|---|
| Mercado Pago | lib/mercadopago.ts | ✅ Ativo |
| Supabase Auth | contexts/AuthContext.tsx | ✅ Ativo |
| Supabase Storage | DocumentUploadButton, OrdersManagement | ✅ Ativo |
| Via CEP (lookup) | lib/shipping.ts | ✅ Ativo |
| Melhor Envio / cotação | lib/shipping.ts | ⚠️ Depende de config |
| Leaflet Maps | RepCoLiveMap, RepCoRoutes | ✅ Ativo |
| Push Notifications | hooks/usePushNotifications.ts | ⚠️ Parcial |

---

## 6. Estado Atual por Área

| Área | Status | Observação |
|---|---|---|
| Loja pública | ✅ Funcionando | Produtos, carrinho, checkout MP |
| Autenticação | ✅ Funcionando | Login, registro, reset senha |
| Admin — Dashboard | ✅ Funcionando | Métricas básicas |
| Admin — Pedidos | ✅ Funcionando | NF, etiqueta, status pipeline |
| Admin — Produtos | ✅ Funcionando | CRUD, barcode EAN-13 |
| Admin — Clientes | ✅ Funcionando | PF/PJ, histórico |
| Admin — Transportadoras | ✅ Funcionando | Cadastro, cotação |
| Admin — Inventário/Lotes | ✅ Funcionando | Fluxo completo |
| Admin — Torra | ✅ Funcionando | Sub-modal integrado |
| Admin — Embalagem | ✅ Funcionando | Sub-modal integrado |
| Admin — Transferências | ✅ Funcionando | Verde e torrado |
| Admin — Documentos | ✅ Funcionando | Upload/download/delete |
| Admin — Cadeia de custos | ✅ Funcionando | Cálculo dinâmico |
| Admin — RepCo (gestão) | ✅ Funcionando | CRUD, aprovação, mapa |
| RepCo — Portal | ✅ Funcionando | Clientes, pedidos, rotas |
| RepCo — Comissões | ⚠️ Parcial | Cálculo auto não implementado |
| RepCo — Performance | ⚠️ Parcial | Métricas básicas |
| Assinatura | ✅ Funcionando | Fluxo de contratação |
| Rastreamento | ✅ Funcionando | Por código do pedido |
| Push Notifications | ⚠️ Parcial | Infraestrutura pronta, UX incompleta |
| Barcode EAN-13 | ✅ Funcionando | Preview e geração SVG |
| Estoque automático | ✅ Funcionando | Via trigger SQL em lotes |
