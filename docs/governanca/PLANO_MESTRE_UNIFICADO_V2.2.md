# PLANO-MESTRE UNIFICADO V2.2 — Ecossistema COFICO
## RepCo · Studio · Saporino Ai.Bot · E-CoHub · Bling · Casa Cofico · Marketplaces

> **V2.2** — igual à V2.1 **exceto uma correção de modelagem**: a hierarquia **STORE não fica abaixo de BRAND**. `STORE` e `BRAND` são entidades irmãs ligadas à `COMPANY`. A loja vende **SKUs de marcas** via `STORE → CHANNEL → LISTING → SKU`. Preservado: **CHANNEL ≠ STORE ≠ BRAND ≠ COMPANY**. Todas as demais decisões da V2.1 permanecem intactas.
> **V2.1 (base)** — refinamentos aprovados: **empresa faturadora ≠ marca**, **`brands` separada de `companies`**, **Bling é ERP só da COFICO** (não assumir Bling da Saporino/Fazendinha no B2B), **ownership fiscal por movimento + documento** (não campo editável), **movimento de titularidade neutro** (sem `intercompany_transfers`), **E-CoHub = verdade operacional × ERP/NF-e = verdade fiscal/legal** (divergência → exceção), **conta Bling COFICO (Titânio) pode ser criada sem ativar fiscal**.
> **NADA implementado neste documento. Sem código, sem migration, sem alterar banco, sem commit.** Após salvar esta correção, está autorizada **somente a Fase 0**.
> **Regra-mãe:** REUTILIZAR > ESTENDER > INTEGRAR > CRIAR · **1 DOMÍNIO = 1 DONO = 1 FONTE DE VERDADE** · PT-BR · Human-by-exception · fiscal só com o contador.

---

## 1. Princípio geral

> **1 DOMÍNIO = 1 DONO = 1 FONTE DE VERDADE (operacional).**
> Outros sistemas podem **ler** ou **escrever na mesma estrutura autorizada** — nunca criar cópia paralela.

E uma segunda regra de verdade, nova nesta V2.1:

> **Verdade operacional ≠ verdade fiscal.** O E-CoHub é a fonte de verdade **operacional** do estoque disponível para venda. Os **documentos fiscais / ERP / NF-e** são a fonte de verdade **legal/fiscal** da titularidade. As duas se **reconciliam**; divergência **gera exceção**, nunca correção silenciosa.

---

## 2. Arquitetura conceitual única

```text
        CANAIS DE VENDA                         CANAIS DE CONTEÚDO
 Site · TikTok Shop · ML · Shopee · Amazon      Instagram · TikTok · concorrentes
                 │                                        │
                 │ (adapters)                             │ (Apify / Graph)
                 ▼                                        ▼
        ┌──────────────────────────────┐          ┌──────────────┐
        │           E-CoHub            │          │    STUDIO    │
        │  HUB CANÔNICO DE ORQUESTRAÇÃO │◀────────▶│ conteúdo,    │
        │  catálogo·SKU·ESTOQUE ÚNICO· │          │ Brand Profile│
        │  pedidos·frete·CX·creators   │          │ performance  │
        └───┬───────────────┬──────────┘          └──────┬───────┘
            │               │  ↕ (reconciliação/idempotência)     │
            │       ┌───────────────┐                             │
            │       │  BLING COFICO │ ERP operacional/fiscal DA COFICO
            │       └───────────────┘  (só Casa Cofico / e-commerce)│
            ▼                                                      │
        ┌─────────┐                    ┌───────────────────────────┴───┐
        │  RepCo  │ motor B2B          │      CAMADA COMPARTILHADA      │
        └────┬────┘                    │  EVENT STORE (fatos) ·         │
             │  (fatura pela EMPRESA   │  approvals · policy · exceptions│
             │   FATURADORA da marca)  │  reviews · partners · catálogo  │
             │                         └───────────┬────────────────────┘
             │                                     ▼
             │                            ┌─────────────────┐
             └───────────────────────────▶│  Saporino Ai.Bot │  interpreta os fatos →
                                          │  Memory Engine   │  MARKET MEMORY (só ele escreve)
                                          └────────┬─────────┘
                                                   ▼
                                     Human-by-exception (approvals + policy)
```

**Papéis:**
- **RepCo** = motor comercial **B2B** (a **empresa faturadora** vinculada à marca é quem emite NF-e — ver §5).
- **Studio** = conteúdo, inteligência social, Brand Profile/Guardian, publicação e performance.
- **E-CoHub** = **HUB CANÔNICO DE ORQUESTRAÇÃO** + **verdade operacional** do estoque/pedido/frete.
- **Saporino Ai.Bot** = inteligência: raciocínio, interpretação, recomendação, coordenação, ações **sob policy engine**.
- **Bling** = ERP operacional/fiscal **exclusivamente da COFICO**, para a operação online (Casa Cofico). **Provider integrado, não barramento obrigatório.** Não se assume Bling para o B2B da Saporino/Fazendinha.
- **Casa Cofico** = **loja online da COFICO** (não é marca de café).
- **Marketplaces** = TikTok Shop, ML, Shopee, Amazon, site e futuros.

Sentido flexível permitido: `marketplace → E-CoHub → Bling` **ou** `marketplace → Bling → E-CoHub`, sempre com reconciliação, idempotência, ownership claro, fonte única e anti-duplicidade.

---

## 3. Fronteira de responsabilidade

| Sistema | É dono de | Nunca faz |
|---|---|---|
| **E-CoHub** | catálogo/SKU, estoque único (verdade operacional), pedidos B2C/marketplace, frete/expedição/tracking/transportadoras, adapters, reviews (coleta), creators/sellers/afiliados (operação), Casa Cofico, Exception/CX Tower, orquestração Bling | inventar regra fiscal; ser a verdade fiscal/legal; escrever interpretação na Market Memory |
| **Ai.Bot** | raciocínio, Consumer Intelligence, Market Memory (Memory Engine), prospecção, coaching, Daily Brief, base de conhecimento/claims, policy engine, scores de creator | ser dono de dado operacional primário; agir nível 3–4 sem aprovação; inventar custo/fiscal |
| **RepCo** | clientes B2B, pedidos B2B, comissão de rep, boleto/parcelas/payout, rotas/POD, prospecção, BI, score de crédito | vender B2C; ter contador de estoque próprio; ser a empresa faturadora (quem fatura é a PJ da marca) |
| **Studio** | conteúdo/campanhas, publicação, Brand Profile/Guardian, comentários sociais, métricas de conteúdo, análise de concorrente | ser dono de pedido/estoque/comissão |
| **Bling (COFICO)** | execução fiscal/operacional **da COFICO** para Casa Cofico (NF-e, estoque fiscal COFICO, expedição) | ser fonte de verdade da inteligência/orquestração; ser assumido como ERP da Saporino/Fazendinha |

---

## 4. Hierarquia — EMPRESA, MARCA, LOJA (BRAND ≠ COMPANY)

**Decisão aprovada:** `brands` é **entidade separada** de `companies`. **Não** usar `company_id` como substituto de marca. **E `STORE` não fica abaixo de `BRAND`** — são entidades irmãs ligadas à `COMPANY`.

**Hierarquia canônica (V2.2):**
```text
COMPANY (pessoa jurídica)
 ├── STORE (loja)                     ← irmã de BRAND, não filha
 └── BRAND (marca)  → brands.owner_company_id → a PJ proprietária
        ↓
     PRODUCT
        ↓
     VARIANT
        ↓
      SKU
        ↓
    KIT / BUNDLE
```

**Como a loja alcança o SKU (catálogo/listing):**
```text
STORE → CHANNEL → LISTING → SKU
```

**Exemplos concretos:**
```text
COMPANY: Café Saporino Ltda.   → BRAND: Saporino          → PRODUCT → VARIANT → SKU
COMPANY: Café Fazendinha Ltda. → BRAND: Café Fazendinha   → PRODUCT → VARIANT → SKU

COMPANY: COFICO → STORE: Casa Cofico → vende BRANDS de empresas diferentes (Saporino, Fazendinha, …)
        Casa Cofico → TikTok Shop (channel) → Listing → SKU "Café Saporino 500g XYZ"
```

- **BRAND ≠ COMPANY:** a **marca** identifica comercialmente o produto; a **company** é a **pessoa jurídica** responsável/faturadora.
- **STORE ≠ BRAND:** a loja (Casa Cofico) é ponto de venda; a marca é a identidade do produto. A loja **vende SKUs de várias marcas**.
- **CHANNEL ≠ STORE:** o canal (TikTok Shop, ML, site…) é onde a loja expõe o listing; a loja é a entidade comercial.
- **PRODUCT ≠ SKU:** o SKU é a unidade operacional de venda/estoque.
- Permite **uma empresa → várias marcas** e **uma loja → várias marcas → vários canais**.
- Campo conceitual: `brands.owner_company_id` (nome final após análise do schema).

Oito conceitos que nunca se misturam: EMPRESA · MARCA · LOJA · CANAL · PRODUTO · VARIANTE · SKU · **EMPRESA FATURADORA**.
Campos nos pedidos: `selling_company_id` · `billing_company_id` · `brand_id` · `store_id` · `channel_id` · `order_type`.

---

## 5. Regra fiscal/comercial — **B2B** (empresa faturadora ≠ marca)

> **Uma marca não emite NF-e.** Quem emite é a **EMPRESA / PESSOA JURÍDICA** responsável pela operação. No B2B, a **empresa faturadora vinculada à marca/produto** é quem vende e fatura — a COFICO participa como operação/distribuição/logística/representação/inteligência, mas **não é obrigatoriamente a faturadora**.

```text
PEDIDO B2B FAZENDINHA                    PEDIDO B2B SAPORINO
 cliente B2B                              cliente B2B
   ↓                                        ↓
 RepCo (administra comercialmente)        RepCo (administra comercialmente)
   ↓                                        ↓
 Café Fazendinha Ltda. vende/fatura       Café Saporino Ltda. vende/fatura
   ↓                                        ↓
 NF-e Café Fazendinha Ltda. → cliente     NF-e Café Saporino Ltda. → cliente
```

- **Pedido B2B Fazendinha:** `brand_id = Café Fazendinha`; `selling_company_id = billing_company_id = Café Fazendinha Ltda.`
- **Pedido B2B Saporino:** `brand_id = Saporino`; `selling_company_id = billing_company_id = Café Saporino Ltda.`
- O **RepCo administra** a venda; a **empresa faturadora é registrada explicitamente**. **Não** se assume Bling para esse faturamento (ver §6.2).

---

## 6. Regra fiscal/comercial — **B2C / Casa Cofico** e o papel do Bling

No online, a **loja é Casa Cofico** e a **empresa faturadora perante o consumidor é a COFICO**.

```text
CONSUMIDOR → CASA COFICO → COFICO → BLING COFICO → NF-e COFICO → CONSUMIDOR
```
`store_id = Casa Cofico` · `billing_company_id = COFICO` · ERP/fiscal = **Bling da COFICO**.

### 6.1 Abastecimento fiscal da Casa Cofico (conceitual)
```text
EMPRESA FORNECEDORA (Café Saporino Ltda. / Café Fazendinha Ltda.)
   ↓ operação comercial/fiscal com a COFICO (documento fiscal válido)
COFICO passa a ter ownership fiscal/comercial da quantidade
   ↓
CASA COFICO vende ao consumidor → COFICO emite NF-e via Bling
```
> Estar fisicamente no CD **não** significa pertencer fiscalmente à COFICO. Físico ≠ fiscal. **O TIPO FISCAL da operação (venda/transferência/remessa/outra) só o contador define.**

### 6.2 Bling é da COFICO — não se assume Bling da marca no B2B
- **B2C Casa Cofico:** dono fiscal = **COFICO**; execução = **Bling COFICO**; NF-e = COFICO → consumidor. ✅ mantém.
- **B2B (Saporino/Fazendinha):** dono fiscal = **a empresa faturadora** (Café Saporino Ltda. / Café Fazendinha Ltda.); fonte fiscal real = **o ERP / sistema fiscal / documento fiscal usado por essa empresa**. **Não** assumir "Bling da Saporino" ou "Bling da Fazendinha". Se no futuro essas empresas também usarem Bling, poderá ser integrado — mas não é premissa.

### 6.3 Conta Bling COFICO — pode ser criada já (plano Titânio)
A conta Bling **da COFICO** pode ser criada desde já para preparar a operação da Casa Cofico. **Plano escolhido: Bling Titânio** (adequado a uma operação que começa e será multicanal; permite API/marketplaces; escala de pedidos sem começar em Diamante/Elite).

> **Criar a conta NÃO ativa nada disso:** NF-e automática, regras fiscais, certificado digital, sincronização live, marketplace em produção, baixa automática de estoque ou faturamento automático. Inicialmente é só o ambiente operacional que **futuramente** será integrado ao E-CoHub.

**Quando a implementação chegar à fase Bling/fiscal:** PARAR → solicitar dados do contador → Certificado A1 → validar dados fiscais → configurar homologação → testar → aprovar → **só então** ativar produção. Nunca salvar certificado/senha/secrets em Git, Markdown ou logs.

---

## 7. Estoque — verdade operacional, ownership fiscal por movimento, migração segura

### 7.1 Camadas de estoque
`FÍSICO` · `RESERVADO` · `DISPONÍVEL (= físico − reservado − segurança)` · `COMERCIAL` · `FISCAL` · empresa proprietária · empresa faturadora · marca · loja · canal.

### 7.2 Ownership fiscal NÃO é campo mutável — é sustentado por movimento + documento
> Evitar a implementação simplista `inventory.fiscal_owner = COFICO` mudando titularidade "por mágica". A **propriedade fiscal/comercial é DERIVADA de MOVIMENTOS documentados.**

```text
Café Saporino Ltda. tem 100 un. no CD (físico: CD Várzea; fiscal: Café Saporino Ltda.)
   ↓ vende 40 un. para COFICO  →  existe documento fiscal correspondente
   ↓ o ledger registra a mudança de titularidade dessas 40 un.
COFICO passa a possuir fiscalmente 40 un. → elegíveis para venda Casa Cofico
```

**Campos conceituais no ledger** (nomes finais após análise do schema): `inventory_movements` com `owner_company_id`, `from_owner_company_id`, `to_owner_company_id`, `source_document_type`, `source_document_id`, `source_invoice_key` (quando aplicável), `occurred_at`, `sku_id`, `qty`, `movement_type`.
**Manual override**, se existir, exige **aprovação + motivo + audit log**.

### 7.3 Movimento entre empresas — conceito NEUTRO (não criar `intercompany_transfers` agora)
> "Transferência" tem significado fiscal/tributário específico; a operação real pode ser **venda, transferência, remessa ou outra** — só o contador define. **Não criar essa tabela agora.**

Usar o conceito neutro **"MOVIMENTO DE TITULARIDADE ENTRE EMPRESAS"**, cuja finalidade lógica é registrar: empresa origem, empresa destino, SKU, quantidade, data, documento relacionado, **tipo de operação fiscal (a definir pelo contador)**, status, reconciliação. Implementação: **PARAR → consultar contador → definir se é venda/transferência/remessa/outra → definir documentos/CFOP/regras → só então modelar nome e estrutura fiscal definitiva.**

### 7.4 Fonte de verdade do estoque — operacional × fiscal
- **E-CoHub = verdade operacional** do disponível para venda.
- **Bling/ERP/NF-e/documentos = verdade fiscal/legal** da titularidade.
- As duas se **reconciliam**. Ex.: E-CoHub diz COFICO=100, documentos dizem 80 → **criar exceção**, nunca corrigir em silêncio.
- Prever (só no plano) uma **FISCAL INVENTORY RECONCILIATION** com estados: `OK` · `DIVERGÊNCIA` · `PENDENTE DOCUMENTO` · `PENDENTE RECONCILIAÇÃO` · `BLOQUEADO`. **Não implementar ainda.**

### 7.5 Migração segura de `products.stock` → ledger (não apagar já)
1. criar SKU; 2. inventory ledger; 3. reservas; 4. migrar/reconciliar saldos; 5. compatibilidade temporária; 6. adaptar RepCo; 7. adaptar loja; 8. testar pedido; 9. reserva; 10. baixa; 11. cancelamento; 12. devolução; 13. ajuste; 14. comparar saldo antigo × novo; 15. validar interface; 16. só então desativar uso operacional; 17. remover só quando não houver dependência. **Relatório de reconciliação.** Nenhuma unidade some, duplica ou é baixada duas vezes.

---

## 8. ★ MAPA DE PROPRIEDADE DOS DADOS (V2.1) ★
> Cada domínio: **um dono, uma fonte de verdade operacional**. "Escreve" pode ter vários, todos na **mesma estrutura do dono**. Legenda: 🟢 existe/reusa · 🟡 estende · 🔵 cria novo · ⚖️ verdade **fiscal/legal** final = documento fiscal/ERP/contador (STOP-GATE).

| DOMÍNIO | SISTEMA DONO | QUEM LÊ | QUEM ESCREVE | FONTE DE VERDADE |
|---|---|---|---|---|
| Clientes B2B | RepCo | Ai.Bot, E-CoHub | RepCo | 🟢 `representative_clients` |
| Clientes B2C | E-CoHub (loja) | Ai.Bot, RepCo | Loja/checkout, adapters | 🔵 `customers` |
| **Empresas** | Plataforma/Admin | Todos | Admin | 🟢 `companies` (Café Saporino Ltda., Café Fazendinha Ltda., COFICO) |
| **Marcas** | Catálogo/Admin | Todos | Admin | 🔵 `brands` (**≠ companies**; `owner_company_id`) |
| Lojas | E-CoHub | Todos | Admin/E-CoHub | 🔵 `stores` (Casa Cofico) |
| Produtos | Catálogo/Admin | Todos | Admin | 🟡 `products` (brand_id) |
| Variantes | E-CoHub | Todos | E-CoHub/Admin | 🔵 `product_variants` |
| SKU | E-CoHub | RepCo, marketplaces, Ai.Bot | E-CoHub/Admin | 🔵 `skus` |
| Kits/bundles | E-CoHub | Loja, marketplaces | E-CoHub | 🔵 `product_kits` |
| Estoque físico | E-CoHub | RepCo, loja, marketplaces, Ai.Bot | Via movimento | 🔵 `inventory.physical_qty` |
| Estoque reservado | E-CoHub | Loja, marketplaces, RepCo | Via reserva | 🔵 `inventory_reservations` |
| Estoque disponível | E-CoHub | Todos os canais | *(derivado)* | 🔵 `físico − reservado − segurança` |
| Estoque comercial | E-CoHub | Ai.Bot, canais | Via movimento | 🔵 `inventory` (contexto comercial) |
| **Estoque fiscal** | E-CoHub modela (op.) · documento ⚖️ | Ai.Bot, contador | **Movimento + documento** (não campo editável) | 🔵 ledger + `owner_company_id` ↔ documento fiscal ⚖️ |
| **Movimentos de estoque / titularidade** | E-CoHub | Todos | Canais + operação fiscal | 🔵 `inventory_movements` (`from/to_owner_company_id`, `source_document*`) |
| **Movimento entre empresas** | E-CoHub modela (op.) · contador ⚖️ | Contador, Ai.Bot | Operação fiscal | 🔵 conceito **neutro** (via `inventory_movements`; **sem** `intercompany_transfers`); tipo fiscal = contador ⚖️ |
| Pedidos B2B | RepCo | E-CoHub, Ai.Bot | RepCo | 🟢 `representative_orders` (+ selling/billing/brand) |
| Pedidos B2C | E-CoHub | Ai.Bot, Bling COFICO | Loja | 🟡 `orders` |
| Pedidos de marketplace | E-CoHub | Ai.Bot, Bling COFICO | Adapters de canal | 🟡 `orders` (channel_id) — espelha plataforma |
| **Faturamento B2B** | **Empresa faturadora** (Café Saporino/Fazendinha Ltda.) ⚖️ | RepCo, Ai.Bot | Operação/ERP da própria empresa | 🟡 `representative_orders.invoice_*` ↔ **ERP/documento fiscal da empresa** ⚖️ (**não Bling**) |
| **Faturamento B2C** | **COFICO** ⚖️ | E-CoHub, Ai.Bot | Bling COFICO | ⚖️ **Bling COFICO** (NF-e → consumidor) |
| **Bling** | E-CoHub (orquestra) | Ai.Bot | `BlingProvider` (bidirecional, reconciliação) | ⚖️ **Bling da COFICO** (só Casa Cofico/e-commerce) |
| Frete | E-CoHub | RepCo, Ai.Bot | E-CoHub (motor + CarrierAdapter) | 🔵 `shipments` + cálculo |
| Tracking | E-CoHub | Cliente, Ai.Bot, CX | Job `sync-tracking` | 🟡 `shipments.tracking` |
| Transportadoras | E-CoHub | Ai.Bot | E-CoHub | 🔵 `carriers` (CarrierAdapter) |
| Marketplaces | E-CoHub (adapters) | Ai.Bot | Adapters | 🔵 `marketplace_connections` / `channel_listings` — espelho |
| Creators | E-CoHub (operação) | Ai.Bot, Studio | E-CoHub + Studio(social) + Ai.Bot(score) | 🔵 `partners` (creator) |
| Sellers | E-CoHub | Ai.Bot | E-CoHub (radar) | 🔵 `partners` (seller) |
| Afiliados | E-CoHub | Ai.Bot | E-CoHub | 🔵 `partners` + `partner_links` |
| Comissões de representantes | RepCo (regras) + Commission Core (infra) | Admin, Ai.Bot | RepCo | 🟢 `representative_commissions` |
| Comissões de parceiros | E-CoHub (regras) + Commission Core (infra) | Admin, Ai.Bot | E-CoHub | 🔵 `partner_commissions` |
| Reviews | E-CoHub | Ai.Bot, Studio | E-CoHub (coleta multicanal) | 🔵 `reviews` |
| Comentários (social) | Studio | Ai.Bot | Studio (import) | 🟡 `studio_*` comentários |
| Conteúdo | Studio | Ai.Bot, E-CoHub | Studio | 🟢 `studio_campaigns` |
| Métricas de conteúdo | Studio (a coletar) | Ai.Bot | Job de coleta | 🟡 métricas em `studio_campaigns` *(gap)* |
| Brand Profile | Studio | Ai.Bot, E-CoHub | Studio/Admin | 🟡 `studio_brand_profiles` |
| Consumer Intelligence | Ai.Bot | Admin/Director | Ai.Bot (agentes) | *(derivado)* reviews+comentários+eventos |
| Eventos/fatos | Plataforma (Event Store) | Todos | RepCo, Studio, E-CoHub, CX, integrações | 🔵 `events` |
| Market Memory | Ai.Bot (**Memory Engine**) | Ai.Bot, RepCo, Studio, E-CoHub | **Só o Memory Engine** | 🔵 `market_memory` |
| Aprovações | Plataforma (infra única) | Admin, agentes | Qualquer sistema | 🔵 `approvals` |
| Ajuda | Plataforma | Todos os portais | Admin | 🟢 `repco_help_articles` + Modo Guia |
| Auditoria/logs | Plataforma | Admin/segurança | Todos (append) | 🔵 `audit_log` |
| Exceções | E-CoHub (Exception/CX Tower) | Ai.Bot, Admin | E-CoHub, integrações | 🔵 `exceptions` |
| Customer Experience | E-CoHub (dado) + Ai.Bot (interpreta) | Admin | E-CoHub | *(derivado)* exceptions+shipments+reviews |
| Base de conhecimento | Ai.Bot | Agentes, portais | Admin (upload + aprovação) | 🔵 `knowledge_documents` + `claims` |
| Policy engine | Plataforma / Ai.Bot | Todos os agentes | Admin | 🔵 `policies` |

**Notas do mapa (V2.1):**
- **BRAND ≠ COMPANY:** `brands` é entidade própria com `owner_company_id`; marca identifica o produto, company identifica a PJ.
- **E-CoHub = verdade operacional; ERP/NF-e/documento fiscal = verdade fiscal/legal (⚖️).** Onde houver divergência → **EXCEPTION / RECONCILIATION**, nunca alteração silenciosa.
- **Faturamento B2B não usa Bling por premissa** — usa o ERP/documento da empresa faturadora (Café Saporino/Fazendinha Ltda.). **Bling = só COFICO/Casa Cofico.**
- **Estoque fiscal / movimento entre empresas** são sustentados por **movimento + documento**; o **tipo fiscal só o contador define**; **sem** tabela `intercompany_transfers` agora.

---

## 9. Comissões — Commission Core + regras de domínio (APROVADO)
```text
COMMISSION CORE (infra)  ├ status·aprovação·conciliação·payout·reversão·auditoria·histórico·cálculo-base
                         ├ REPCO COMMISSION RULES   → representantes → representative_commissions
                         └ PARTNER COMMISSION RULES → creators/afiliados/sellers → partner_commissions
```
Infra compartilhada + regras separadas. Não forçar a mesma matemática. **Nunca 2 comissões na mesma venda sem regra explícita.**

## 10. Event Store × Market Memory (APROVADO)
Operacionais escrevem **FATOS** no Event Store (vários); **só o Memory Engine (Ai.Bot)** escreve **interpretação** na Market Memory.
```text
FATOS (E-CoHub/RepCo/Studio/CX/integrações) → EVENT STORE → normalização/evidência
→ MEMORY ENGINE/Ai.Bot → interpretação/aprendizado → MARKET MEMORY (só ele escreve; todos leem)
```
Evidência guardada: **N1** fato · **N2** interpretação · **N3** previsão · **N4** causal após teste. Correlação nunca vira causalidade.
Event Store — campos: `event_id, event_type, occurred_at, source_system, company/store, entity_type, entity_id, payload, correlation_id, causation_id, idempotency_key, schema_version`.

## 11. Creator / Affiliate / Seller Commerce (APROVADO)
Ai.Bot **encontra/analisa/classifica/recomenda**; E-CoHub **opera** parceria/link/cupom/amostra/comissão/performance.
`DESCOBERTO → PERFIL → ANÁLISE → (abrir perfil original) → APROVA/DESCARTA → CONTATO → AMOSTRA → CONTEÚDO → VENDA → COMISSÃO → PERFORMANCE → MEMÓRIA`. **Nunca contato automático antes da aprovação humana.**
**Radar dinâmico** (não estático). **Dois scores:** COFFEE CREATOR SCORE × SALES CREATOR SCORE. Perfil no admin com **link original clicável** antes de aprovar.

## 12. Frete e logística (APROVADO)
E-CoHub é dono operacional de frete/tracking/shipment/transportadoras/expedição/comparação/exceptions — serve **B2C e B2B**. **CarrierAdapter** (`quote/createShipment/getLabel/track/cancelShipment/getProofOfDelivery`). Custo próprio (carro/motorista/combustível/pedágio/km/paradas…) e **motor de decisão** ("vale entregar?", "própria × transportadora", "frete grátis destrói margem?"). **Ai.Bot interpreta; E-CoHub calcula com dado real; Ai.Bot nunca inventa custo.** Separar frete cobrado × real × subsídio × custo próprio × margem antes/depois.

## 13. Content Intelligence + Product Truth (Studio — ampliar)
Loop: PLANEJAR→CRIAR→APROVAR→PUBLICAR→**MEDIR**→INTERPRETAR→APRENDER→PRÓXIMA AÇÃO. **Content DNA** (marca/produto/público/canal/objetivo/formato/hook/CTA/creator/oferta). **Product Truth/Brand Guardian** valida marca/SKU/embalagem/peso/moagem/origem/claims/assets/canal antes de publicar (grão × moído → bloquear).

## 14. Consumer Intelligence + Customer Experience + Reviews
Consumer Intelligence **derivada** (SINAL→CLASSIFICAÇÃO→CLUSTER→EVIDÊNCIA→RISCO/OPORTUNIDADE→AÇÃO). CX futuro: Customer Protection, Frustration Score, Zero Reclamação, Exception Center. Respostas a review por nível (positivo→auto aprovada; crítica leve→contextual; reclamação séria→investigar→resolver→responder).

## 15. Approvals + Policy Engine (infra única)
Uma infra de aprovação (creator/mensagem/publicação/preço/desconto/comissão/reembolso/listing/campanha/ação Ai.Bot/test→live/estoque manual/integração). Policy Engine registra `action_type, actor, source, target, impacto, risco, required_approval, result, audit`.

## 16. Ajuda / user-friendly
Reutilizar `repco_help_articles` + FAQ + Modo Guia. "? Ajuda" em toda tela + futuro "Perguntar ao Ai.Bot". Explicar: onde estou? o que significa? o que faço agora? é perigoso? precisa aprovação? quem paga/recebe? o que acontece depois?

## 17. Multi-tenant-ready (APROVADO — preparar, não implementar)
Avaliar `company_id`/`store_id`/`owner_company_id` (e `tenant_id` só se fizer sentido), RLS futuro e índices nas tabelas novas. **Sem SaaS completo agora.**

## 18. Módulos que NÃO podem ser duplicados
CRM B2B (RepCo) · comissão (Commission Core) · estoque/contador (`inventory_movements`) · chat (`chat_*`) · Market Memory · Exceções/CX · Aprovações · Reviews · Brand Profile · normalização (`_shared/normalize.ts`) · prospecção/radar · Ajuda/FAQ.

## 19. Estruturas reutilizadas
`companies`/`company_id` · motor comissão RepCo → Commission Core · aprovação RepCo · `studio_brand_profiles`+2 agentes · `ecommerce_price_snapshots` · `vw_repco_*` · `prospects_b2b` · rotas/POD/geocerca → CarrierAdapter · `studio_profile_snapshots` → partner_snapshots · FAQ+Modo Guia · `products`+gatilho → SKU+ledger · `orders`/`subscriptions` vazias → B2C.

## 20. P0 — antes de qualquer construção (Fase 0, só planejar)
6 tabelas fantasma (`admin_settings` quebra checkout B2C, `user_addresses`, `label_formats`, `customer_stats`, `anniversary_gifts`, `segment_payment_terms`) · checkout B2C E2E · assinatura no webhook Mercado Pago · gate + troca de token no `sync-tracking` · rate limiting · testes críticos · observabilidade mínima · schema drift.

---

## 21. Fases (0–8)
> Sem prazo artificial. O avanço ocorre **quando o critério de aceite da fase estiver cumprido** — fase por fase + critério + relatório + revisão. Cada fase termina com **relatório + PARAR**. Dependências: 0→1→2→3→4(⚖️ A1+contador)→5→6→{7 depende de 3 e 6}→8.

**FASE 0 — Estabilização (P0).** Obj: existente confiável + B2C funcional. Pré: —. Reusa: funções/tabelas atuais. Cria: 6 tabelas que faltam (ou remove referências) + testes/logs mínimos. Riscos: mexer no pagamento (baixo se verificado na tela). Testes: compra B2C E2E; webhook rejeita sem assinatura; sync-tracking exige auth. Conclusão: checkout real ok; zero tabela fantasma; webhook/tracking protegidos. Stop-gate: —. Relatório: REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.

**FASE 1 — Fundação comercial.** Obj: hierarquia canônica `COMPANY {STORE, BRAND→PRODUCT→VARIANT→SKU→KIT}` + `STORE→CHANNEL→LISTING→SKU` (store NÃO abaixo de brand) + estoque fonte única + ownership fiscal modelado (por movimento). Pré: Fase 0. Reusa: `products`, `companies`, gatilho, `orders` vazia. Cria: `brands`, `stores`, `product_variants`, `skus`, `product_kits`, `channel_listings`, `inventory`, `inventory_movements` (com `from/to_owner_company_id`, `source_document*`), `inventory_reservations`, `warehouses`. Riscos: migração `products.stock` (médio/alto). Testes: reserva/baixa/cancelamento/devolução/ajuste no ledger; mudança de titularidade só com documento; RepCo intacto; reconciliação antigo×novo. Conclusão: disponível correto por SKU; impossível vender sobre indisponível; ownership fiscal derivado de movimento; relatório de reconciliação ok. Stop-gate: tipo fiscal do movimento entre empresas = contador. Relatório: ECOHUB_V4.

**FASE 2 — Núcleo E-CoHub + frete.** Obj: operação multicanal (mock) + frete/expedição CD Várzea. Pré: Fase 1. Reusa: rotas/POD/geocerca; logística COFICO. Cria: `sales_channels`, `shipments`, `carriers`, motor de frete, `exceptions`, CommerceProvider + Mock adapters + CarrierAdapter. Riscos: acoplar a um canal/transportadora. Testes: pedido mock NEW→DELIVERED; exceção abre; frete responde "vale entregar?". Conclusão: painel navegável com MOCK DATA; nada atinge canal real. Relatório: ECOHUB_V4.

**FASE 3 — Inteligência base + fechar loop do Studio.** Obj: Event Store + Market Memory + framework de agentes; coletar métricas do post. Pré: Fase 2. Reusa: `ecommerce_price_snapshots`, `vw_repco_*`, 2 agentes Studio, `studio_campaigns`. Cria: `events`, `market_memory`, `reviews`, `competitors`, `agents`, `policies`, `approvals`, `audit_log`, `knowledge_documents`, `claims` + job de métricas + estados de FISCAL INVENTORY RECONCILIATION (modelagem). Riscos: correlação→causalidade (N1–N4). Testes: post publicado tem métrica puxada; fato entra no Event Store; interpretação só via Memory Engine; ação passa pelo policy engine; divergência fiscal gera exceção. Conclusão: loop MÉTRICA→APRENDIZADO fecha uma volta; agentes nível 0–1. Relatório: SAPORINO_AI_BOT_V4.

**FASE 4 — Bling COFICO (ERP) — STOP-GATE fiscal.** Obj: ERP para pedidos/estoque/NF-e da COFICO (Casa Cofico). Pré: Fase 3 + **Certificado A1 + contador**. Reusa: conta Bling Titânio já criada (§6.3) + upload manual de NF como fallback. Cria: `BlingProvider` (OAuth, webhooks, idempotência, DLQ, reconciliação). Riscos: fiscal (alto). Testes: NF-e homologação; webhook idempotente; reconciliação operacional×fiscal; sem pedido/baixa duplicados. Conclusão: NF-e válida em teste **com aprovação do contador e do proprietário**. Stop-gate: todo o §6/§7 fiscal. Relatório: ECOHUB_V4.

**FASE 5 — Primeiro canal real.** Obj: um marketplace controlado. Pré: Fase 4. Reusa: adapters + ledger. Cria: um `MarketplaceAdapter` real. Riscos: overselling (mitigado por reserva). Testes: venda real baixa estoque uma única vez. Conclusão: 1 canal sincronizado + exceções monitoradas. Relatório: ECOHUB_V4.

**FASE 6 — Casa Cofico multicanal + Creators/Sellers.** Obj: demais canais + rede de parceiros. Pré: Fase 5. Reusa: Commission Core, aprovação, `partners`. Cria: `partner_snapshots`, `partner_links`, `partner_commissions`, radar multiplataforma, P&L por parceiro, 2 scores. Riscos: comissão dobrada; contato antes de aprovar. Testes: venda atribuída = 1 comissão; nenhum contato sem aprovação. Conclusão: vários canais + parceiros ativos com comissão rastreável. Relatório: ECOHUB_V4 + SAPORINO_AI_BOT_V4.

**FASE 7 — Ai.Bot pleno.** Obj: Agente Executivo + especialistas, autonomia progressiva. Pré: Fase 3 + Fase 6. Reusa: agentes Studio, `market_memory`, `policies`, `approvals`, `prospects_b2b`. Cria: orquestração (fila + especialistas), prospecção autônoma, coaching, Daily Brief, Cost Center. Riscos: loops/custo (limites). Testes: Daily Brief real; missão de prospecção E2E; nenhuma ação nível 3–4 sem aprovação. Conclusão: responde "o que merece minha atenção hoje?" com N1–N4 e respeita autonomia. Relatório: SAPORINO_AI_BOT_V4.

**FASE 8 — CX / forecasting / otimização.** Obj: proatividade e previsão. Pré: Fase 7. Reusa: `exceptions`, `shipments`, ledger, `market_memory`. Cria: previsão de reposição multicanal, Customer Frustration Score, proteção contra atraso, Experiment Engine (A/B). Riscos: decisão automática sobre cliente sem revisão. Testes: previsão de ruptura por SKU somando canais; alerta de atraso antes da reclamação. Conclusão: reposição e CX proativos. Relatório: REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.

---

## 22. Relatórios e checklists
- `docs/ECOHUB_V4_IMPLEMENTATION_REPORT.md` · `docs/SAPORINO_AI_BOT_V4_IMPLEMENTATION_REPORT.md` · `docs/REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.md` (fase, arquitetura, tabelas novas/alteradas, ownership, integrações, testes, riscos, decisões, decisões abertas, divergências plano×implementação, próximos passos).
- Todos terminam com **"TRAZER ESTE RELATÓRIO DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE CONTINUAR PARA A PRÓXIMA GRANDE FASE."**
- **Checklist executável:** ID · fase · tarefa · dependência · tipo · arquivo/tabela · status · risco · teste · critério de aceite · evidência · data. **Nada concluído sem evidência.**

---

## 23. Auditoria lógica final (V2.1)

| Verificação | Status |
|---|---|
| 1 domínio = 1 dono = 1 fonte de verdade operacional | ✅ |
| **BRAND ≠ COMPANY** (`brands` própria, `owner_company_id`) | ✅ |
| **STORE ≠ BRAND** (Casa Cofico é loja; Saporino/Fazendinha são marcas; STORE não fica abaixo de BRAND) | ✅ |
| **CHANNEL ≠ STORE** (canal expõe o listing; loja é a entidade comercial) | ✅ |
| Hierarquia canônica `COMPANY {STORE, BRAND→PRODUCT→VARIANT→SKU→KIT}` + `STORE→CHANNEL→LISTING→SKU` | ✅ |
| **Estoque físico ≠ estoque fiscal** (fiscal sustentado por movimento+documento) | ✅ |
| **Operação ≠ fiscal** (E-CoHub operacional; documento/ERP = fiscal/legal) | ✅ |
| **E-CoHub ≠ ERP fiscal** (Bling não é a verdade operacional) | ✅ |
| **Bling ≠ hub de inteligência** (é ERP da COFICO, provider) | ✅ |
| **Empresa faturadora ≠ marca** (quem emite NF-e é a PJ; Bling só COFICO) | ✅ |
| **Event Store ≠ Market Memory** (fatos × interpretação; só Memory Engine escreve memória) | ✅ |
| **Commission Core ≠ regra única para todos** (infra + regras separadas) | ✅ |
| Nenhum ownership duplicado / fonte de verdade paralela | ✅ |
| Nenhuma regra fiscal inventada (tipo fiscal = contador; stop-gates) | ✅ |
| Movimento entre empresas neutro (sem `intercompany_transfers` agora) | ✅ |
| Divergência operacional×fiscal → EXCEPTION/RECONCILIATION (nunca silêncio) | ✅ |
| Human-by-exception preservado | ✅ |

### Decisões confirmadas nesta V2.1
- `brands` **separada** de `companies` (`brands.owner_company_id`). BRAND ≠ COMPANY.
- No B2B, faturamento é da **empresa faturadora** (Café Saporino/Fazendinha Ltda.), via ERP/documento próprio — **não Bling**. Bling = só COFICO/Casa Cofico.
- Conta **Bling COFICO (Titânio)** pode ser criada já; criar ≠ ativar fiscal/NF-e/cert/sync/produção.
- Ownership fiscal **derivado de movimento + documento**; override manual = aprovação + motivo + audit log.
- **Sem** `intercompany_transfers` agora — conceito neutro "movimento de titularidade"; tipo fiscal = contador.
- E-CoHub = verdade operacional; documento/ERP = verdade fiscal; divergência → exceção.
- Event Store × Market Memory, Commission Core, Casa Cofico, abastecimento, E-CoHub×Bling, frete, creators (2 scores, radar dinâmico), multi-tenant-ready — **todos mantidos/aprovados**.
- **Sem prazo artificial** — avanço por critério de aceite cumprido.

### Decisões ainda abertas para o ChatGPT
1. Nomes finais das colunas/entidades (`brands`, `owner_company_id`, campos do ledger) após cruzar com o schema real na Fase 1.
2. Modelagem fiscal definitiva do "movimento de titularidade" — só depois da orientação do contador.

---

# PLANO UNIFICADO V2.2 APROVADO PARA FASE 0 — NÃO IMPLEMENTADO (este documento)

# CORREÇÃO DE HIERARQUIA APLICADA (STORE irmã de BRAND). FASE 0 AUTORIZADA E EM EXECUÇÃO EM SEPARADO; FASE 1 SÓ APÓS REVISÃO DO RELATÓRIO NO CHAT DE INTELIGÊNCIA REPCO.
