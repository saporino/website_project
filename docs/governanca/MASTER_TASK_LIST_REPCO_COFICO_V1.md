# MASTER TASK LIST — RepCo + COFICO + Saporino + Fazendinha
## E-commerce · Logística · Inteligência
**Versão:** V1.0 — pós Raio-X · **Status:** Planejamento oficial

> **Este documento substitui todos os comandos/blocos/task lists anteriores deste trabalho.** Em caso de conflito com instrução anterior de planejamento, o conflito é apresentado antes de executar (ver Relatório de Validação).
> Regra: **REUTILIZAR → ESTENDER → CONSOLIDAR → só depois CRIAR.** Documento ≠ implementação.

---

## PARTE A — REGRAS ARQUITETURAIS

### A1. RepCo é o motor central
RepCo é a plataforma operacional/comercial/logística/dados/inteligência usada por COFICO, Saporino, Fazendinha, futuras marcas/representadas. **Um motor, multi-empresa** (tenant por `company_id`). Cada empresa mantém regras/preço/crédito/prazo/pedido/faturamento/comissão/cobrança/documentação **próprios**, no mesmo motor.

### A2. Sistemas e responsabilidades
- **RepCo** = System of Record central: clientes/identidades, relacionamentos, catálogo mestre, SKU, inventory core, estoque físico, reservas, pedidos B2B, **registro de pedidos B2C**, CRM, representantes, comissão, inteligência, logística central (COFICO Entregas), histórico, trade, dados, auditoria, eventos.
- **COFICO Entregas** = módulo logístico **dentro** do RepCo.
- **E-CoHub** = orquestrador especializado de e-commerce (**não substitui** o RepCo; escreve de volta no RepCo).
- **Bling** = ERP/fiscal/operacional do e-commerce COFICO/Casa Cofico (**não** é cérebro; **não** é fonte soberana de estoque).
- **Sites/Marketplaces** = canais de entrada/venda.
- **Saporino Ai.Bot** = camada **futura** de inteligência/recomendação/aprendizado governado.

### A3. B2B ≠ B2C
Fluxos distintos. **Não misturar automaticamente:** preço, política comercial, comissão, crédito, prazo, frete, faturamento, documentação. **Compartilhar:** produto/SKU, estoque físico central, identidade de cliente (quando aplicável), histórico consolidado, dados, inteligência, tracking, eventos, auditoria.

### A4. Cliente (regra definitiva)
Mesmo CNPJ pode ser cliente de Fazendinha, Saporino, COFICO, futuras representadas — **sem fundir contas**.
- **CUSTOMER_IDENTITY** = identidade do CNPJ/CPF (dados cadastrais).
- **COMMERCIAL_ACCOUNT** = relacionamento comercial com uma empresa/representada (representante, pedidos, preço, prazo, limite, crédito, comissão, cobrança, financeiro, política, documentos, empresa faturadora — **isolados**).

### A5. Aproveitar cadastro por CNPJ
Ao cadastrar CNPJ em outra operação, RepCo pesquisa; se já existe, oferece **"Aproveitar cadastro existente / Importar dados cadastrais"** (o cadastro original permanece — não é "migrar"). **Compartilhável:** CNPJ, razão/fantasia, IE, endereço/CEP/cidade/UF, telefone, e-mail, comprador, WhatsApp. **NUNCA copiar auto:** crédito, limite, score, prazo, desconto, tabela, comissão, representante, dívida, histórico, observações, condições especiais.

### A6. Faturamento/documentação
Venda Fazendinha → NF Fazendinha; Saporino → NF Saporino; COFICO → NF COFICO. Não misturar. Tratamento fiscal exato = **STOP-GATE CONTADOR**.

### A7. Entrega pode consolidar (comercial não)
Pedidos comerciais separados; **entrega física pode consolidar** (1 rota/veículo/parada). Modelo: `LOGISTICS_DELIVERY` → `DELIVERY_ALLOCATION` por empresa (ex.: Fazendinha 100kg + Saporino 40kg). Consolidar fisicamente ≠ consolidar comercial/fiscal.

### A8. Cobrança logística das representadas
RepCo sabe quanto da operação é de cada empresa (qtd/valor/base/documento/empresa separados). Equivalência econômica por contrato; tipo fiscal de nota de serviço = **STOP-GATE CONTADOR**.

### A9. RepCo = inteligência logística central
Toda logística centralizada em RepCo (COFICO Entregas). Execução via frota própria/parceiro/agregado/transportadora. Transportadora = **executor**; RepCo = decisão/registro/tracking/histórico/custo/SLA/POD/reconciliação/aprendizado.

### A10. Logística e-commerce
Marketplace/site → Bling/E-CoHub → transportadora → **tudo volta ao RepCo** (pedido, canal, SKU, qtd, cliente, preço, custo, comissão, transportadora, tracking, entrega, margem, origem, creator/affiliate).

### A11. Inventário central (fonte única)
**UM** estoque físico central por SKU/local. Canais (B2B, site, marketplaces) consomem o **mesmo Inventory Core**. **Não** criar estoques independentes por marca/canal/Bling/E-CoHub.

### A12. Bling não é fonte soberana de estoque
RepCo = source of truth operacional. Nunca sobrescrever cegamente saldo central com valor externo. Implementar reconciliação.

### A13–A18. Catálogo
- **PRODUCT** (conceitual) ≠ **VARIANT** (variação) ≠ **SKU** (unidade comercial/física). Ex.: Saporino Clássico / 500g moído / `SAP-CLA-TM-500`. **Não recriar SKUs existentes** (auditar Saporino/Fazendinha; Fazendinha já tem SKUs — preservar).
- **VARIANT ≠ KIT.** KIT = composição de SKUs (`kit_components`). Kit pode ter SKU/commercial code próprio p/ listing, **sem estoque físico fictício**. Disponibilidade do kit **deriva** dos componentes (menor componente limita).
- **CHANNEL LISTING:** SKU ≠ anúncio. Mesmo SKU em vários canais, cada um com listing_id/preço/título/comissão/taxas próprios, apontando ao SKU central.
- **CATÁLOGO MESTRE:** PRODUCT/SKU MASTER (o que é) × ASSORTMENT (onde vende) × PRICE LIST (por quanto naquele contexto). **Assortment explícito** — COFICO não herda preço Saporino/Fazendinha; produto novo não publica auto em outras empresas.

### A19–A23. Site COFICO (posicionamento)
`coficobrasil.com.br` em construção. **Agora:** tornar institucionalmente correto (NÃO virar e-commerce já). Posicionamento = **plataforma de desenvolvimento comercial e distribuição de marcas** (foco café): armazenagem + inteligência comercial + vendas + marketing de apoio + distribuição + e-commerce + tecnologia RepCo. Produtos = **vitrine** (sem checkout/carrinho/pagamento/venda). **Gate p/ ativar e-commerce real:** Product/Variant/SKU · Kit Engine · Inventory Ledger · Reservations · Available · Warehouse/CD · Assortment · multichannel sync · anti-overselling · reconciliação · pagamento PJ · logística e-commerce · testes E2E.

### A24–A25. CD Várzea + Inventory Ledger
CD real (warehouse/location/stock movement/picking/packing/dispatch), origem CD COFICO Várzea Paulista. **Ledger auditável** (RECEIPT/RESERVE/RELEASE/SALE/SHIP/CANCEL/RETURN/ADJUSTMENT/TRANSFER/LOSS/DAMAGE/COUNT). `AVAILABLE = ON_HAND − RESERVED`.

### A26. Dados de teste
Clientes atuais no RepCo = **teste**. Classificar TEST, mapear dependências, decidir reset com aprovação. **Não apagar automaticamente.**

### A27–A35. Logística B2B / App motorista / Custos
- **Consolidar rotas** (não criar 3º sistema): `representative_routes/route_stops` × `delivery_routes/delivery_stops` → canônico sob COFICO Entregas.
- **App motorista:** rota, veículo/placa, zona, paradas, cliente, endereço, volumes, peso, obs, janela, POD, ocorrências.
- **Zonas A–G** por entrega, autoassign por CEP/endereço (motorista não edita). Histórico/experiência por zona.
- **Custo rota:** ESTIMATED × ACTUAL × VARIANCE. Motorista **registra evidência** (abastecimento, estacionamento, ocorrência, reentrega) — **não faz rateio**. Combustível (valor/litros/odômetro/foto). Pedágio: upload de extrato/print → reconhecimento por placa/rota/período; confirmação humana se baixa confiança.
- **Rateio inteligente:** RepCo calcula (base peso inicial; guardar peso/km/desvio/parada/pedágio/tempo/cubagem/reentrega). **Custo marginal** = custo de adicionar parada a uma rota.

### A36–A38. Economia logística (ADMIN ONLY)
- **R$1,50/kg** = cobertura logística econômica interna (representante/cliente **não veem**).
- **2% sobre vendas** = receita interna de estrutura/overhead (**separado** do R$1,50/kg).
- **Reserva logística** = ledger econômico interno (sobras/despesas extraordinárias; déficit não consome auto). Tratamento contábil = **P0 contador/CFO**.

### A39–A40. Frete e-commerce
Tabela **Total Express** = benchmark/referência (não checkout, não carrier ativo). Estudar CEP/região/faixa/peso/cubagem/pedágio/seguro/GRIS/adicionais/prazo. Modelo COFICO parte de Várzea Paulista. Transportadoras futuras (Total Express/Jadlog/Rodonaves) → **elegibilidade/homologação antes de preço**.

### A41–A43. E-commerce / Creator
Venda B2C = COFICO fatura; paga custo comercial à marca; resultado da COFICO menos custos (produto/marketplace/pagamento/frete/embalagem/creator/impostos). Fiscal = contador. **Creator/Affiliate:** comissão e-commerce **separada** da B2B (Commission Core compartilha infra; regras distintas: REPRESENTATIVE/AFFILIATE/CREATOR). Pedido online identifica channel/campaign/affiliate_id/creator_id/referral/rule/amount/status.

### A44–A55. Trade Intelligence / Pós-venda / Sell-out
Follow-up (D+N configurável), Promotora (check-in→execução→contagem→exposição→estoque→preço→ruptura→check-out→relatório), **alerta de ruptura** ao representante, giro/recompra, produto parado (IA recomenda / humano decide), concorrência em loja (fotos frente/verso/etiqueta), rotina de inteligência (periodicidade configurável), inteligência por zona, **PDV real** (upload). **Classificação de evidência:** `PDV_REAL` × `OBSERVADO_EM_LOJA` × `ESTIMADO` — nunca misturar.

### A56–A61. Camadas futuras
- **Event Store** central (fatos: order.*, inventory.*, delivery.*, trade.visit.*, shelf.out_of_stock, pdv.uploaded, competitor.price.observed, creator.sale.attributed) — **um só**.
- **Market Memory** (conhecimento curado/interpretado) — **não é** Event Store.
- **Ai.Bot** (só após fundação; consome RepCo/Studio/Event Store/Market Memory; não duplica Studio).
- **Studio** já existe — reutilizar (análise/Whisper/Claude/guardrails/IG/campanhas).
- **E-CoHub** (só após SKU/Inventory/Client identity/reservation/Fase0/pagamentos/catálogo).
- **Bling** (fase API → parar e executar via Claude MCP/browser; nunca colar secrets/OTP/certificado; STOP para ação manual).

### A62–A65. Fase 0 / Governança / Decisão / Confidencialidade
- **Fase 0** (edge functions novas em prod; front local; MP PJ pendente; sync-tracking pendente) precisa ser concluída antes do e-commerce real.
- **Governança Comercial** (policy engine sobre empresas/representadas/produtos/SKU/preços/mix/crédito/prazo/comissão/aprovação; não duplicar CRM).
- **Motor de Decisão:** PEDIDO→CLIENTE→EMPRESA→TABELA→SKU→PREÇO→MIX→CRÉDITO→PRAZO→APROVAÇÃO→LOGÍSTICA→DECISÃO → 🟢 pode / 🟡 aprovação / 🔴 negado.
- **Confidencialidade:** representante não vê R$1,50/kg, 2%, custo interno, Reserva, margem logística, cálculo/custo marginal, benchmark Total Express, dados de outra representada.

---

## PARTE B — FILA OFICIAL DE TASKS (001–050)
> Executar **uma por vez** (implementar→testar→validar→evidenciar→DONE→próxima). Reordenar só por dependência técnica comprovada (gerar DEPENDENCY CONFLICT). Status: TODO/READY/IN PROGRESS/BLOCKED/WAITING HUMAN/WAITING EXTERNAL/VALIDATING/DONE/DEFERRED/CANCELLED.

| # | TASK | Objetivo (DONE) | Reuso / Nota |
|---|---|---|---|
| 001 | Baseline / versionamento | Salvar Plano V2.2, specs, Raio-X, esta MTL em docs; registrar branch/uncommitted; backup/rollback | **Crítico:** tratar working tree uncommitted (Fase 0) + divergência edge deployado/fonte não commitada |
| 002 | SEO crítico COFICO | sitemap/robots/canonical/OG/Twitter/JSON-LD; sem URL Saporino indevida | REUSA `scripts/prerender-seo.mjs` (OG/canonical COFICO já feitos) |
| 003 | LGPD/Termos COFICO | /politica-de-privacidade, /termos-de-uso; cookies/analytics | REUSA PolicyPages |
| 004 | Posicionamento COFICO | hero/headline/CTAs/narrativa (desenvolvimento comercial+distribuição+tecnologia) | ESTENDE CoficoBrasilPage |
| 005 | Home COFICO | reorganizar seções, sem regressão | ESTENDE |
| 006 | Marcas/Produtos vitrine | Saporino/Fazendinha/futuras; padrão uniforme; menu Produtos | JÁ FEITO parcialmente (CoficoProdutosPage) |
| 007 | Casa Cofico institucional | seção explicando canal digital (sem loja) | NOVO (conteúdo) |
| 008 | Captação de marcas | "Quero distribuir minha marca"; auditar RepCo antes | REUSA b2b_leads/prospecção; NÃO novo CRM |
| 009 | **Client Identity** | identidade única CNPJ/CPF sem destruir contas | **P0** — estende `representative_clients`; muitos dependem |
| 010 | Commercial Accounts | contas por empresa (crédito/pedido/comissão isolados) | **P0** — usa company_id existente |
| 011 | Importar cadastro existente | fluxo CNPJ encontrado → aproveitar dados cadastrais | depende 009/010 |
| 012 | Test data cleanup plan | classificar clientes atuais como teste (não apagar) | plano |
| 013 | Product/Variant/SKU | auditar SKUs; estrutura canônica | **P0** — estende `products`; preserva SKUs Fazendinha |
| 014 | Kit Engine | kits/kit_components/derived availability | depende 013 |
| 015 | Assortment | onde SKU pode ser vendido | depende 013 |
| 016 | Price architecture | preço por empresa/canal/contexto/listing | REUSA `price_lists`; estende |
| 017 | Warehouse/CD | modelar Várzea Paulista | **P0** — NOVO |
| 018 | Inventory Ledger | movimentos auditáveis | **P0** — substitui alteração silenciosa de products.stock |
| 019 | Reservations/Available | ON_HAND/RESERVED/AVAILABLE | **P0** — depende 018 |
| 020 | Anti-overselling | concorrência B2B+site+marketplaces | **P0** — depende 019 |
| 021 | Site COFICO ↔ RepCo | lead→RepCo; catálogo→RepCo | depende 009 |
| 022 | Consolidar rotas | representative_routes × delivery_routes → canônico | **CONSOLIDAR** existente |
| 023 | Consolidar tracking/POD | delivery_stops × shipments × sync-tracking | **CONSOLIDAR** |
| 024 | App motorista | rota/POD/zona/custos/evidências/ocorrência | ESTENDE COFICO Entregas (drivers/fleet) |
| 025 | Zonas A–G | por entrega, autoassign CEP | NOVO |
| 026 | Experiência motorista/zona | histórico operacional | NOVO |
| 027 | Custos reais de rota | combustível/pedágio/estacionamento | NOVO |
| 028 | Pedágio/comprovante | upload + reconhecimento placa/rota + confirmação | NOVO |
| 029 | Rateio multiempresa | allocation por empresa sem misturar contas | NOVO |
| 030 | Fechamento/reconciliação | estimado×real×variância | NOVO |
| 031 | Motor Logístico | calcula/cota/decide/consolida | depende 017–030 |
| 032 | Governança Comercial | policy engine (empresas/SKU/preço/crédito/comissão) | depende 009/010/013/016 |
| 033 | Motor de Decisão | 🟢🟡🔴 fluxo comercial | depende 032 |
| 034 | Finalizar Fase 0 | MP PJ + secrets + front + webhook + sync-tracking + E2E | **WAITING HUMAN/EXTERNAL** (MP PJ) — pode correr em paralelo |
| 035 | Event Store | shared, eventos canônicos | NOVO (um só) |
| 036 | Trade/Follow-up | D+N configurável | NOVO |
| 037 | Promotora | check-in/out; estoque/exposição/ruptura | **REUSA módulo Promotor existente** (promoters/promoter_visits/mix/incidents/vw_promoter_*) |
| 038 | Ruptura/recompra | alertas e previsão | REUSA `vw_ruptura_*` |
| 039 | Concorrência/preço | fotos frente/verso/etiqueta | REUSA `ecommerce_price_snapshots` (parcial) |
| 040 | PDV real | upload/processamento; PDV_REAL separado | NOVO |
| 041 | Market Memory | memória curada | NOVO (um só) |
| 042 | E-CoHub foundation | só após gates | DEFERRED |
| 043 | Bling | via MCP/browser na hora | DEFERRED (STOP-GATE) |
| 044 | Casa Cofico e-commerce | liberar transacional | DEFERRED (após gate A23) |
| 045 | Marketplace 1 | pedido/estoque/fiscal/logística reconciliados | DEFERRED |
| 046 | Creator/Affiliate core | comissão e atribuição | DEFERRED |
| 047 | Ai.Bot foundation | após dados/eventos | DEFERRED (reusa Studio) |
| 048 | Guardian | detectar/analisar/recomendar | DEFERRED |
| 049 | Trade Intelligence avançada | zona/cliente/produto/concorrência | DEFERRED |
| 050 | Go-live readiness | dados/teste/segurança/estoque/pagamento/fiscal/logística/monitor/rollback | GO/NO-GO |

---

## PARTE C — REGRAS DE EXECUÇÃO
- **Definition of DONE** (conforme aplicável): código + banco + migration + RLS + API + UI + testes + build + typecheck + runtime + E2E + validação + evidência + rollback + documentação. MD/UI/código sozinhos **não** = DONE.
- **Sequencial:** não avançar sem DONE. Dependência técnica → **DEPENDENCY CONFLICT** (task atual / necessária / motivo / impacto / opções A reordenar, B dividir, C decisão humana).
- **Novas ideias:** CRITICAL NOW (pode interromper, com registro) / IMPORTANT-BACKLOG / FUTURE-PARKING. Não esconder TODO/FIXME/mock/workaround — tudo entra na MTL.
- **Fechamento de task:** TASK/STATUS/OBJETIVO/ALTERADO/ARQUIVOS/BANCO-MIGRATIONS/TESTES/BUILD-TYPECHECK/EVIDÊNCIA/RISCOS/PENDÊNCIAS/DEPENDÊNCIAS/ROLLBACK/PRÓXIMA.
- **Segurança:** nunca expor/colar secrets/tokens/OTP/certificados; browser/MCP em senha/OTP/KYC/doc/biometria → **parar e pedir ação manual**.
- **Fiscal:** nunca inventar CFOP/CST/CSOSN/ICMS/ISS/PIS/COFINS/CEST/IBS/CBS/natureza → **STOP-GATE CONTADOR**.
- **Copy pública:** refletir capacidade real (não prometer "indústria acompanha em tempo real" sem portal).
- **Plano-Mestre:** comparar com V2.2 (mapa ITEM→TASK: MANTER/ALTERAR/SUPERADO/NOVO); não substituir silenciosamente.
