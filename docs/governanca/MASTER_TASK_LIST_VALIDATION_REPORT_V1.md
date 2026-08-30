# RELATÓRIO DE VALIDAÇÃO — Master Task List RepCo + COFICO V1
> Auditoria de consistência **read-only** da MTL V1 contra: **Raio-X** (29/08), **PLANO_MESTRE_UNIFICADO_V2.2**, **código** e **schema real**. Nada implementado.

## 1. Compatibilidade com o Raio-X → **ALTA**
Os P0 da MTL batem 1:1 com os P0 que o Raio-X encontrou ao vivo no banco:
- **Client Identity/Accounts (TASK 009/010)** = Raio-X "cliente sem mestre; `representative_clients` sem CNPJ-master → duplicação entre empresas". ✅
- **SKU + Inventory Ledger + Reservas + Anti-overselling (013–020)** = Raio-X "estoque = `products.stock`, sem ledger/reserva/SKU → overselling ao abrir B2C". ✅
- **Consolidar rotas/tracking (022/023)** = Raio-X "duplicação: `representative_routes` × `delivery_routes`; `delivery_stops` × `shipments` × `sync-tracking`". ✅
- **Finalizar Fase 0 (034)** = Raio-X "edge functions em prod, front local, MP PJ pendente, sync-tracking token demo em prod". ✅
- **Site COFICO ↔ RepCo (021)** = Raio-X "site é vitrine estática, isolado do RepCo". ✅
**Conclusão:** a MTL é a tradução operacional correta do Raio-X.

## 2. Compatibilidade com o Plano-Mestre V2.2 → **ALTA, com 2 evoluções a reconciliar**
A MTL mantém: 1 dono/1 fonte por domínio; Commission Core; Event Store × Market Memory; Casa Cofico=loja/COFICO fatura B2C; Bling não-soberano de estoque; hierarquia PRODUCT/VARIANT/SKU/KIT; stop-gates fiscais; RepCo B2B como base.
**Evoluções que o V2.2 precisa absorver (ver §12 e mapa abaixo):**
- **(E1) Autoridade central:** V2.2 punha catálogo/SKU/estoque/pedidos-B2C como donos do **E-CoHub** ("hub canônico de orquestração"). A MTL centraliza **catálogo mestre + SKU + Inventory Core + Client Identity + registro de pedidos B2C no RepCo**, e rebaixa o E-CoHub a **orquestrador de e-commerce que escreve de volta no RepCo**. Não é contradição — é **quem é dono do dado-núcleo**: passa a ser RepCo. **O mapa de propriedade do V2.2 muda.**
- **(E2) Modelo de cliente:** V2.2 tratava cliente B2B em `representative_clients` e B2C em `customers` (novo). A MTL introduz **CUSTOMER_IDENTITY (por CNPJ) + COMMERCIAL_ACCOUNT (por empresa)** — mais refinado. Substitui a modelagem de cliente do V2.2.

## 3. Tarefas que reutilizam código existente (evidência)
| TASK | Reutiliza (evidência real) |
|---|---|
| 002 SEO | `scripts/prerender-seo.mjs` (OG/canonical COFICO já feitos) |
| 003 LGPD/Termos | `PolicyPages` |
| 004–006 site/vitrine | `CoficoBrasilPage` + `CoficoProdutosPage` (já no ar) |
| 008 captação marcas | `b2b_leads` (1) + prospecção RepCo (`prospects_b2b` 750k) — **não** novo CRM |
| 009/010 cliente | `representative_clients` (7, já tem `company_id`, `assigned_to_company`) + `companies` (3) |
| 013/016 catálogo/preço | `products` (9) + `price_lists` (3) |
| 022/023 logística | `representative_routes`/`route_stops` + `delivery_routes`/`delivery_stops`/`delivery_dispatch_audit` + `shipments` + `sync-tracking` |
| 024 app motorista | `drivers`/`fleet_vehicles`/`fleet_maintenance`/`fleet_documents` + POD/geocerca RepCo |
| 034 Fase 0 | edge functions já deployadas + migrations já aplicadas + 34 testes locais |
| **037 Promotora** | **Módulo Promotor JÁ EXISTE** — `promoters`, `promoter_visits`, `promoter_client_mix`(9), `promoter_incidents`, `promoter_routes`, `promoter_visit_photos/locations/audits`, `vw_promoter_*` |
| 038 ruptura | views `vw_ruptura_*` já existem |
| 039 concorrência | `ecommerce_price_snapshots` (5.451) |
| 047/048 Ai.Bot/Guardian | Studio (2 agentes Claude+Whisper, guardrails) |

## 4. Tarefas genuinamente novas (criar)
017 Warehouse/CD · 018 Inventory Ledger · 019 Reservations · 020 Anti-overselling · 014 Kit Engine · 015 Assortment · 025 Zonas A–G · 026–030 custos/pedágio/rateio/reconciliação de rota · 031 Motor Logístico · 032 Governança · 033 Motor de Decisão · 035 Event Store · 040 PDV real · 041 Market Memory · 042 E-CoHub · 044 Casa Cofico transacional · 045 Marketplace · 046 Creator core.

## 5. Duplicações evitadas (a MTL respeita)
Cliente (identity+accounts, não cópia por marca) · Estoque (1 ledger, não por canal) · Rotas (consolidar, não 3º sistema) · Tracking (consolidar) · Catálogo (products master, **matar o hardcode do site COFICO**) · Event Store/Market Memory (um cada) · CRM (RepCo) · Comissão (Commission Core) · Studio (reutilizar) · **Promotor (reutilizar módulo existente — TASK 037 é EXTENDER, não criar).**

## 6. Dependências (grafo essencial)
- 009 Client Identity → 010, 011, 021, 032, 033.
- 013 SKU → 014, 015, 016, 018.
- 017 Warehouse → 018 Ledger → 019 Reservas → 020 Anti-overselling → **gate A23** (e-commerce).
- 032 Governança → 033 Decisão (ambos dependem de 009/010/013/016).
- 017–030 → 031 Motor Logístico.
- 034 Fase 0 → depende de **ação humana/externa** (ativar MP PJ + secrets COFICO) — **pode correr em paralelo**.
- 042/044/045/046 (e-commerce/creator) e 047/048 (Ai.Bot) → só depois dos gates de dados.

## 7. P0 (consolidado, = Raio-X)
1. **Client Identity + Commercial Accounts** (009/010) — sem isto, duplicação de cliente.
2. **Inventory Core** (SKU 013 + Warehouse 017 + Ledger 018 + Reservas 019 + Anti-overselling 020) — sem isto, overselling.
3. **Finalizar Fase 0** (034) — checkout tecnicamente consistente.
4. **Site COFICO ↔ RepCo** (021) — parar conversão manual.
5. **Baseline/versionamento** (001) — hoje há muita mudança **uncommitted** e divergência edge-deployado/fonte-não-commitada (risco de perda/inconsistência).

## 8. Riscos
- 🔴 **Divergência git/deploy:** edge functions (`create-payment`/`webhook`/`create-checkout-order`) estão **em produção** mas a **fonte está uncommitted**; front de pagamento **não deployado**; `main` só tem os 3 commits da COFICO. Qualquer commit de arquivo compartilhado (ex.: `App.tsx`) arrastaria o go-live do checkout PF (pausado). **TASK 001 tem que resolver isso primeiro.**
- 🟠 **Client Identity sobre dado de teste:** os 7 `representative_clients` são teste — refatorar o modelo de cliente e depois resetar teste precisa de ordem cuidadosa (012 antes de produção).
- 🟠 **Inventory ledger x `products.stock` vivo:** o RepCo decrementa `products.stock` hoje; migrar para ledger sem quebrar o RepCo (mesma lição da Fase 1 do V2.2).
- 🟠 **Fiscal** (rateio logístico, nota de serviço COFICO→representada, NF por empresa): STOP-GATE contador em 006/008/029/041/044.
- 🟡 **Copy do site** já cita "acompanhamento em tempo real pela plataforma" — validar contra capacidade real (regra §76).

## 9. Sequência recomendada
Mantém a fila da MTL, com um ajuste: **rodar TASK 034 (Fase 0) em paralelo** desde o início (está bloqueada em você/MP, não bloqueia as outras). Ordem-macro sã: **001 baseline → 002–007 site institucional (barato, independente) → 009/010/011 cliente (P0) → 013–020 inventory core (P0) → 021 site↔RepCo → 022/023 consolidar logística → 024–031 motor logístico → 032/033 governança/decisão → 035/041 event/memory → 036–040 trade → 042+ e-commerce/creator → 047/048 Ai.Bot → 050 go-live.**

## 10. Alterações recomendadas na ordem
- **001 antes de tudo** e deve incluir: (a) decidir o destino das mudanças **uncommitted** da Fase 0 (commitar em branch separada? manter local?); (b) salvar specs+Plano+Raio-X+MTL em `docs/`.
- **034 (Fase 0) em paralelo** (não sequencial na posição 34).
- **037 vira "estender módulo Promotor existente"** (não "criar"). Idem 038 (usar `vw_ruptura_*`).
- **006 (vitrine)** já está ~80% pronto (CoficoProdutosPage) — reduzir para "padronizar/ajustar".

## 11. Conflitos com instruções anteriores (§0)
- **(C1) Autoridade E-CoHub → RepCo** (E1 acima): o V2.2 declarava E-CoHub "hub canônico de orquestração" dono de catálogo/SKU/estoque/pedidos-B2C. A MTL torna **RepCo** o SoR do núcleo e o E-CoHub um orquestrador. **Conflito de propriedade de dado** — precisa atualizar o mapa de propriedade do V2.2 antes de implementar 013–020/042. **Apresentado, não resolvido automaticamente.**
- **(C2) Modelo de cliente** (E2): `customers` (V2.2) vs `CUSTOMER_IDENTITY`+`COMMERCIAL_ACCOUNT` (MTL). Adotar o da MTL; aposentar o `customers` simples do V2.2.
- **(C3) Fase 0 pausada vs "finalizar Fase 0" (034):** não é conflito, mas 034 permanece **bloqueada** até a ativação da produção MP PJ + secrets `MERCADO_PAGO_COFICO_*` (ação sua).
- Sem outros conflitos: a MTL é coerente com as decisões PF→PJ, blue/green, RLS travada, checkout anônimo, e com o Raio-X.

## 12. Decisões humanas necessárias (antes da TASK 001)
1. **Reconciliar o Plano V2.2** com a MTL (autoridade RepCo vs E-CoHub; modelo de cliente). Confirmar que RepCo é o SoR do núcleo e o E-CoHub orquestra.
2. **Mudanças uncommitted da Fase 0:** o que fazer (branch dedicada `fase0-pagamento`? deixar local? incluir no baseline?). Impacta a segurança de qualquer commit futuro.
3. **Ativação MP PJ** (produção + secrets COFICO) para desbloquear a TASK 034 — quando.
4. **Reset de dados de teste** (7 clientes) — só com sua aprovação (TASK 012).
5. Confirmar que **TASK 037/038** devem estender o módulo **Promotor** existente (e não criar novo).

---

## MAPA ITEM DO PLANO V2.2 → TASK (§77)
| Item V2.2 | Task MTL | Situação |
|---|---|---|
| Fase 0 estabilização | 034 | **MANTER** (em paralelo) |
| Catálogo LOJA→MARCA→PRODUTO→VARIANTE→SKU→KIT | 013/014/015/016 | **MANTER** (dono muda p/ RepCo) |
| Estoque fonte única (ledger/reserva) | 017/018/019/020 | **MANTER** |
| Casa Cofico = store | 007/044 | **MANTER** |
| E-CoHub = hub canônico de orquestração | 042 | **ALTERAR** (RepCo=SoR; E-CoHub=orquestrador) |
| Cliente B2B RepCo / B2C `customers` | 009/010/011 | **SUPERADO** por CUSTOMER_IDENTITY+COMMERCIAL_ACCOUNT |
| Commission Core (rep×parceiro) | 046 | **MANTER** |
| Event Store × Market Memory | 035/041 | **MANTER** |
| Bling (STOP-GATE fiscal) | 043 | **MANTER** |
| Frete/CarrierAdapter | 031/039–040 | **MANTER** (+ economia logística ADMIN A36–38) |
| Multi-tenant preparado | transversal | **MANTER** |
| — (novo) | 007 Casa Cofico institucional; 021 site↔RepCo; 022/023 consolidar logística; 024–030 app motorista/custos/rateio; 025 zonas A–G; 036–040 trade/promotora/PDV; A7 consolidação de entrega multiempresa; A36–38 R$1,50/kg+2%+Reserva | **NOVO** |

---

MASTER TASK LIST REPCO + COFICO V1 VALIDADA E PRONTA PARA EXECUÇÃO SEQUENCIAL — NADA IMPLEMENTADO

TRAZER MASTER_TASK_LIST_REPCO_COFICO_V1.md + MASTER_TASK_LIST_VALIDATION_REPORT_V1.md DE VOLTA AO CHAT DE INTELIGÊNCIA ANTES DE AUTORIZAR A EXECUÇÃO DA TASK 001.
