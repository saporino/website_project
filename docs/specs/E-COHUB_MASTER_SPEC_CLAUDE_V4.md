# E-COHUB MASTER SPEC CLAUDE — V4
## Especificação Mestre para Claude / Cowork

**Projeto:** E-CoHub  
**Significado:** E-Commerce Hub  
**Implementação inicial:** Saporino E-CoHub  
**Produto futuro:** RepCo E-CoHub  
**Objetivo:** criar uma operação de e-commerce altamente automatizada, orientada por exceções, conectada futuramente ao Bling, RepCo e marketplaces brasileiros.

---

# 1. VISÃO

O E-CoHub será o centro operacional, analítico e de automação de toda a operação digital da Saporino.

A arquitetura deve ser criada desde o início para funcionar como um módulo reutilizável e multi-tenant do RepCo no futuro.

O objetivo final é:

> **Fazer a operação de e-commerce funcionar praticamente sozinha, 24 horas por dia, com intervenção humana apenas quando houver exceções, riscos, decisões financeiras relevantes ou problemas operacionais.**

---

# 2. PRINCÍPIO CENTRAL

## Human by Exception

O proprietário não deve precisar executar tarefas repetitivas.

O sistema deverá:

- processar operações normais;
- monitorar integrações;
- detectar problemas;
- gerar alertas;
- recomendar ações;
- executar ações previamente autorizadas;
- registrar tudo em logs;
- escalar somente exceções.

---

# 3. ARQUITETURA GERAL

```text
Amazon Brasil
Mercado Livre Brasil
Shopee Brasil
TikTok Shop Brasil
Site Saporino
       │
       ▼
     BLING
Pedidos / Estoque / NF-e / Logística
       │
       ▼
     E-CoHub
Operação / Inteligência / Automação
       │
       ▼
     RepCo
Market Memory / Consumer Intelligence / Commerce Intelligence
       │
       ▼
Claude / AI Agents
```

---

# 4. REGRA OPERACIONAL DE ESTOQUE E EXPEDIÇÃO

Toda mercadoria da Saporino deverá sair fisicamente do:

# CD SAPORINO — VÁRZEA

O modelo padrão é estoque físico centralizado.

Não utilizar fulfillment externo de Amazon, Mercado Livre, Shopee ou TikTok Shop sem autorização explícita do proprietário.

A lógica deve considerar:

```text
CD SAPORINO — VÁRZEA
        │
        ▼
   ESTOQUE CENTRAL
        │
        ▼
      BLING
        │
 ┌──────┼──────┬───────┬────────┐
 ▼      ▼      ▼       ▼        ▼
Amazon  ML   Shopee  TikTok    Site
```

Todos os canais deverão sincronizar com a mesma referência de estoque operacional.

---

# 5. PAPEL DO BLING

O Bling será o executor operacional principal.

Responsabilidades esperadas:

- importação automática de pedidos;
- sincronização de estoque;
- cadastro e atualização de produtos;
- emissão de NF-e;
- comunicação com SEFAZ;
- geração de etiquetas quando suportado;
- dados de expedição;
- pedidos;
- contas;
- integrações com marketplaces;
- API e webhooks.

O E-CoHub não deve recriar funcionalidades fiscais e operacionais que o Bling já resolve com segurança.

---

# 6. PAPEL DO E-CoHub

O E-CoHub será responsável por:

- consolidar operação;
- monitorar;
- mostrar KPIs;
- gerenciar exceções;
- orquestrar automações;
- armazenar eventos;
- calcular margem;
- acompanhar performance por canal;
- administrar agentes;
- registrar Market Memory;
- servir de ponte entre Bling, marketplaces, RepCo e Claude.

---

# 7. PAPEL DO REPCO

O RepCo será a camada de inteligência.

Deverá futuramente analisar:

- qual canal vende mais;
- qual canal gera melhor margem;
- qual creator gera melhores clientes;
- quais clientes recompram;
- quais SKUs aceleram;
- quais preços funcionam;
- quais reviews indicam problema;
- quais tendências de mercado surgem;
- quais ações devem ser testadas;
- quais experimentos deram resultado.

---

# 8. PAPEL DO CLAUDE / AI AGENTS

Claude será usado para:

- análise;
- classificação;
- explicação;
- recomendação;
- detecção de anomalias;
- leitura de reviews;
- criação de hipóteses;
- análise de concorrência;
- relatórios executivos;
- geração de tarefas;
- apoio a decisões;
- automação segura dentro de limites.

Claude NÃO deverá substituir ERP, regras fiscais, banco de dados, estoque, autenticação, emissão fiscal, lógica de pagamentos ou segurança.

---

# 9. PRINCÍPIOS TÉCNICOS

O E-CoHub deve ser:

- modular;
- desacoplado;
- API-first;
- event-driven;
- multi-tenant ready;
- auditável;
- observável;
- seguro;
- idempotente;
- tolerante a falhas;
- preparado para automação;
- preparado para rollback;
- preparado para crescimento.

---

# 10. POSICIONAMENTO NA ARQUITETURA

Avaliar três opções:

## Opção A
E-CoHub dentro do RepCo.

## Opção B
E-CoHub dentro do painel Saporino.

## Opção C
E-CoHub como aplicação independente conectada ao RepCo e Saporino via API.

Preferência inicial:

> **Arquitetura modular e desacoplada, acessível pela Saporino agora e reutilizável no RepCo depois.**

Claude deverá auditar a stack atual antes de decidir.

---

# 11. PRIMEIRA REGRA DE IMPLEMENTAÇÃO

NÃO integrar canais reais agora.

NÃO usar credenciais reais.

NÃO alterar produção.

NÃO ativar emissão fiscal.

NÃO executar scraping.

NÃO comprar serviços.

NÃO instalar serviços pagos.

Criar primeiro estrutura, banco, componentes, navegação, dashboards, mocks, adapters, eventos, agentes, permissões e documentação.

---

# 12. SIDEBAR DO E-CoHub

```text
E-CoHub
├── Dashboard
├── Orders
├── Shipping
├── Inventory
├── Products
├── Channels
├── Pricing
├── Finance
├── Reviews
├── Competitors
├── Creators
├── Automation
├── Exceptions
├── CD Operations
└── Settings
```

---

# 13. DASHBOARD PRINCIPAL

Mostrar:

- vendas hoje;
- vendas ontem;
- vendas no mês;
- GMV;
- receita líquida;
- pedidos;
- unidades;
- ticket médio;
- margem;
- clientes novos;
- clientes recorrentes;
- cancelamentos;
- devoluções;
- pedidos aguardando expedição;
- estoque crítico;
- alertas;
- automações executadas;
- ações aguardando aprovação.

---

# 14. VENDAS POR CANAL

Cards para TikTok Shop Brasil, Amazon Brasil, Mercado Livre Brasil, Shopee Brasil e Loja Saporino.

Cada canal deverá futuramente mostrar GMV, pedidos, unidades, ticket, conversão, comissão, frete, imposto, mídia, margem, cancelamentos e devoluções.

Nesta fase usar dados simulados claramente marcados como `MOCK DATA`.

---

# 15. ORDER CENTER

Campos:

- order_id;
- marketplace;
- external_order_id;
- customer_id;
- SKU;
- produto;
- quantidade;
- valor;
- status;
- pagamento;
- NF-e;
- etiqueta;
- tracking;
- transportadora;
- created_at;
- updated_at;
- erro;
- tenant_id.

Status:

```text
NEW
PAID
PROCESSING
INVOICED
READY_TO_SHIP
SHIPPED
DELIVERED
CANCELLED
RETURNED
ERROR
```

---

# 16. EXCEPTION CENTER

Tela principal de problemas.

Exemplo:

```text
143 pedidos processados normalmente.

4 exceções:
- 2 NF-e rejeitadas
- 1 divergência de estoque
- 1 etiqueta não gerada
```

Categorias:

- fiscal;
- estoque;
- preço;
- pagamento;
- logística;
- integração;
- marketplace;
- cliente;
- fraude;
- margem;
- segurança.

---

# 17. CD OPERATIONS

Local de operação:

# CD SAPORINO — VÁRZEA

Tela deve mostrar:

- pedidos aguardando separação;
- picking;
- packing;
- pedidos faturados;
- etiquetas prontas;
- pedidos embalados;
- aguardando coleta;
- coletados;
- divergências;
- inventário;
- produção a receber;
- produtos com baixa cobertura.

---

# 18. SHIPPING CENTER

Criar `Shipping Queue` com pedido, SKU, produto, quantidade, NF-e, etiqueta, transportadora, tracking e status.

Ações futuras:

- imprimir etiqueta;
- imprimir etiquetas em lote;
- imprimir DANFE;
- gerar picking list;
- marcar separado;
- marcar embalado;
- marcar pronto para coleta;
- marcar coletado.

---

# 19. INVENTORY CENTER

Campos:

- SKU;
- produto;
- estoque físico;
- reservado;
- disponível;
- estoque mínimo;
- média de vendas por dia;
- cobertura em dias;
- lead time;
- previsão de ruptura;
- sugestão de reposição;
- tenant_id.

Status:

```text
HEALTHY
ATTENTION
LOW
CRITICAL
OUT_OF_STOCK
OVERSTOCK
```

---

# 20. INVENTORY AGENT

Entrada:

- estoque;
- vendas históricas;
- sazonalidade;
- promoções;
- campanhas;
- creators;
- lead time;
- produção.

Saída exemplo:

```text
Produto: Saporino 500g
Estoque: 1.240
Venda média: 87/dia
Cobertura: 14,2 dias
Previsão de ruptura: X dias
Sugestão: produzir 2.500 unidades
```

Nesta fase, recomendar apenas. Não criar ordem de produção automaticamente.

---

# 21. PRODUCT CENTER

Campos:

- product_id;
- SKU;
- EAN;
- nome;
- marca;
- peso;
- custo;
- preço;
- estoque;
- canais;
- listing IDs;
- imagens;
- descrição;
- keywords;
- status;
- tenant_id.

---

# 22. LISTING CENTER

Por canal:

- título;
- descrição;
- preço;
- estoque;
- URL;
- ranking;
- conversão;
- avaliações;
- nota;
- imagens;
- keywords.

Preparar um Listing Agent para recomendar novo título, descrição, bullet points, SEO, palavras-chave, imagens, variações e bundles.

---

# 23. PRICING CENTER

Cálculo por SKU:

```text
Preço de venda
- comissão marketplace
- imposto
- frete
- mídia
- CMV
- embalagem
- custo operacional
----------------------
Margem de contribuição
```

Guardar price_floor, target_price, price_ceiling, minimum_margin e target_margin.

---

# 24. PRICING AGENT

Inicialmente apenas recomendação.

Nunca alterar preço automaticamente sem regra e autorização.

---

# 25. FINANCE CENTER

Mostrar:

- GMV;
- receita bruta;
- receita líquida;
- comissões;
- taxas;
- frete;
- impostos;
- mídia;
- CMV;
- embalagem;
- custo operacional;
- margem;
- lucro estimado.

Separar por canal, produto, período, campanha e creator.

---

# 26. COMPETITOR INTELLIGENCE

Armazenar snapshots com marca, produto, canal, preço, promoção, seller, frete, reviews, nota, ranking, estoque aparente, data, URL, screenshot e fonte.

Coleta futura por APIs, Apify, importação ou provedores autorizados.

---

# 27. VOICE OF CUSTOMER

Fontes futuras:

- Amazon;
- Mercado Livre;
- Shopee;
- TikTok;
- site;
- SAC.

Categorias:

- aroma;
- sabor;
- intensidade;
- amargor;
- moagem;
- frescor;
- preço;
- embalagem;
- entrega;
- qualidade;
- recompra;
- expectativa;
- frustração.

Integrar futuramente com RepCo Arqueologia Emocional.

---

# 28. CREATOR COMMERCE

Preparar módulo para TikTok Shop e outros programas de creators.

Campos:

- creator_id;
- handle;
- plataforma;
- país;
- estado;
- seguidores;
- mediana de views;
- engagement;
- nicho;
- TikTok Shop;
- produtos;
- brand fit;
- brand safety;
- growth;
- Creator Score;
- last_scan;
- tenant_id.

---

# 29. CREATOR GENOME

Exemplo:

```text
Creator:
@exemplo

País:
Brasil

Estado:
Minas Gerais

Seguidores:
38.420

Mediana de views:
19.300

Conteúdo:
Família 28%
Cozinha 35%
Café da manhã 17%

TikTok Shop:
Ativo

Produtos:
23

Brand Fit:
93/100

Status:
Prospect
```

O Genome deverá ser atualizado ao longo do tempo.

---

# 30. FUTURO CREATOR DISCOVERY

A descoberta de creators poderá usar TikTok Shop, APIs oficiais, Apify, dados públicos permitidos e importação.

Objetivo: creators brasileiros, afiliados, alimentação, café, família, cozinha, lifestyle, fitness, rotina, interior e micro creators.

---

# 31. AUTOMATION CENTER

Agentes:

- Order Monitor Agent
- Invoice Exception Agent
- Inventory Agent
- Shipping Agent
- Pricing Agent
- Listing Agent
- Competitor Agent
- Review Intelligence Agent
- Creator Agent
- Customer Service Agent
- Finance Agent
- Reconciliation Agent
- Fraud Agent
- Executive Agent

Cada agente deve mostrar status, autonomia, última execução, próxima execução, ações, erros, custo e logs.

---

# 32. NÍVEIS DE AUTONOMIA

```text
LEVEL_0_MONITOR
LEVEL_1_RECOMMEND
LEVEL_2_APPROVAL_REQUIRED
LEVEL_3_BOUNDED_AUTO
LEVEL_4_AUTONOMOUS
```

Exemplos:

| Ação | Nível |
|---|---|
| Importar pedido | L4 |
| Atualizar estoque | L4 |
| Gerar relatório | L4 |
| Detectar erro | L4 |
| Responder FAQ | L3 |
| Alterar listing | L2 |
| Alterar preço pequeno dentro de faixa | L3 futuro |
| Alterar preço grande | L2 |
| Grande orçamento | L2 |
| Ação fiscal atípica | Humano |
| Questão legal | Humano |

---

# 33. AI AGENT ARCHITECTURE

```text
EVENT
  ↓
QUEUE
  ↓
AGENT
  ↓
POLICY ENGINE
  ↓
ACTION
  ↓
AUDIT LOG
```

Nunca permitir ação irreversível sem regra, permissão, log, limite, rollback e aprovação quando necessária.

---

# 34. EVENT MODEL

```text
ORDER_CREATED
ORDER_UPDATED
ORDER_PAID
ORDER_CANCELLED
STOCK_UPDATED
STOCK_LOW
STOCK_CRITICAL
INVOICE_CREATED
INVOICE_AUTHORIZED
INVOICE_REJECTED
LABEL_CREATED
SHIPMENT_CREATED
SHIPMENT_UPDATED
PRICE_CHANGED
MARGIN_BELOW_LIMIT
REVIEW_CREATED
CREATOR_FOUND
CREATOR_POSTED
SALE_ATTRIBUTED
RETURN_CREATED
INTEGRATION_ERROR
```

---

# 35. WEBHOOKS

Fluxo:

```text
Bling
  ↓ webhook
E-CoHub
  ↓
Event Store
  ↓
Automation Engine
  ↓
Agent / Rule
  ↓
Action / Exception
```

Implementar validação de assinatura, deduplicação, idempotência, retry, dead-letter queue e audit log.

---

# 36. MARKET MEMORY

Guardar evento, ação, resultado, hipótese, canal, produto, data, custo, impacto e aprendizado.

---

# 37. CUSTOMER RETURN

Preparar futura integração com RepCo Customer Return Engine para identificar recompra, detectar atraso, calcular churn, sugerir next best action e medir recompra incremental.

---

# 38. EXECUTIVE DAILY BRIEF

Estrutura:

```text
Bom dia.

Ontem:

GMV: R$ X
Pedidos: X
Receita líquida: R$ X
Margem: X%

Top canal:
TikTok Shop

Top produto:
Saporino 500g

Operações normais:
181

Exceções:
3

Ações automáticas:
17

Aguardando aprovação:
2

Oportunidade:
Criar multipack no Mercado Livre.
```

---

# 39. BLING — INTEGRAÇÃO FUTURA

Criar uma abstração `CommerceProvider` com funções conceituais:

```text
getOrders()
getProducts()
getInventory()
getShipments()
getInvoices()
getCustomers()
syncInventory()
getFinancialEntries()
```

Implementações futuras:

```text
BlingProvider
MockCommerceProvider
```

Não acoplar todo o E-CoHub diretamente ao Bling.

---

# 40. MARKETPLACE ADAPTERS

Criar interfaces:

```text
TikTokShopAdapter
AmazonAdapter
MercadoLivreAdapter
ShopeeAdapter
SaporinoStoreAdapter
```

Na primeira fase:

```text
MockMarketplaceAdapter
```

---

# 41. MULTI-TENANCY

Toda entidade deve considerar `tenant_id`.

Objetivo futuro: várias empresas utilizando RepCo E-CoHub.

---

# 42. FEATURE FLAGS

```text
ECOHUB_ENABLED
BLING_ENABLED
TIKTOK_ENABLED
AMAZON_ENABLED
MERCADOLIVRE_ENABLED
SHOPEE_ENABLED
CREATOR_COMMERCE_ENABLED
AI_AGENTS_ENABLED
AUTO_PRICING_ENABLED
AUTO_PUBLISH_ENABLED
```

Todos desligados por padrão.

---

# 43. BANCO DE DADOS

Entidades sugeridas:

```text
eco_orders
eco_order_items
eco_products
eco_inventory
eco_inventory_movements
eco_marketplaces
eco_listings
eco_prices
eco_shipments
eco_invoices
eco_reviews
eco_customers
eco_returns
eco_competitors
eco_creators
eco_creator_snapshots
eco_campaigns
eco_automations
eco_agent_runs
eco_events
eco_exceptions
eco_approvals
eco_finance
eco_market_memory
eco_channels
eco_cd_operations
eco_webhook_events
eco_integration_logs
```

Adaptar à convenção existente.

---

# 44. SEGURANÇA

Implementar:

- RBAC;
- tenant isolation;
- secure secrets;
- audit logs;
- rate limiting;
- encryption;
- webhook validation;
- retries;
- idempotency;
- rollback;
- approval workflows;
- least privilege.

---

# 45. CERTIFICADO DIGITAL A1

Quando chegar à etapa de emissão automática de NF-e:

## PARE.

Avise:

> “Chegamos à etapa em que preciso do Certificado Digital A1 da empresa para continuar a configuração da emissão automática de NF-e no Bling.”

Solicitar ao proprietário:

- Certificado Digital A1 válido;
- arquivo `.pfx` ou `.p12`;
- senha do certificado;
- confirmação de que corresponde ao CNPJ usado no Bling.

O proprietário solicitará isso ao contador.

Claude não deverá inventar certificado, procurar certificado em pastas sem autorização, salvar certificado no Git, salvar senha em Markdown, salvar senha em logs, exibir senha ou persistir senha fora do local seguro.

---

# 46. DADOS FISCAIS

Quando forem necessários regime tributário, inscrição estadual, CNAE, NCM, CFOP, CST, CSOSN, ICMS, PIS, COFINS, CEST, natureza de operação, origem, alíquotas ou regras interestaduais:

## PARE.

Dizer:

> “Chegamos a uma configuração fiscal que precisa ser validada pelo contador.”

Gerar lista objetiva do que deve ser solicitado ao contador.

Não inventar, estimar, copiar configuração de outra empresa ou usar exemplos como configuração real.

---

# 47. ATIVAÇÃO DA EMISSÃO AUTOMÁTICA

A emissão automática de NF-e só poderá ser ativada depois de:

1. certificado A1 correto;
2. dados fiscais validados;
3. cadastro fiscal de produto validado;
4. regra fiscal validada;
5. teste de NF-e;
6. autorização do proprietário.

---

# 48. FLUXO FUTURO DE PEDIDO

```text
Cliente compra
        ↓
Marketplace
        ↓
Bling importa pedido
        ↓
Estoque central atualizado
        ↓
NF-e gerada
        ↓
SEFAZ
        ↓
NF-e autorizada
        ↓
Etiqueta / logística
        ↓
E-CoHub recebe status
        ↓
Fila de expedição
        ↓
CD SAPORINO — VÁRZEA
        ↓
Separar
Embalar
Imprimir
Colar etiqueta
        ↓
Coleta / Transportadora
```

---

# 49. REGRA DO CD

Nunca configurar por padrão FBA, fulfillment Mercado Livre, fulfillment Shopee, fulfillment TikTok ou estoque terceirizado.

Toda mercadoria sai do CD Saporino em Várzea.

Qualquer mudança exige autorização explícita.

---

# 50. MONITORAMENTO 24/7

O sistema final deverá rodar em cloud.

Não depender de laptop ligado, Chrome aberto, Cowork aberto ou sessão local ativa.

Usar workers, queues, cron, scheduler, webhooks, serverless e banco persistente.

---

# 51. COWORK

Cowork deverá ser usado para construir, revisar, testar, documentar, refatorar, investigar, criar integrações, criar agentes e melhorar o sistema.

Cowork não deve ser o runtime permanente da operação.

---

# 52. ROADMAP

## PHASE 0 — Audit
- stack;
- banco;
- auth;
- RepCo;
- painel;
- site;
- infra;
- deploy.

## PHASE 1 — Foundation
- shell;
- navigation;
- dashboard;
- DB schema;
- mocks;
- events;
- exceptions;
- automation model;
- feature flags;
- RBAC.

## PHASE 2 — Commerce Core
- products;
- inventory;
- orders;
- shipping;
- finance;
- CD Operations.

## PHASE 3 — Intelligence
- reviews;
- pricing;
- competitor intelligence;
- Market Memory.

## PHASE 4 — Bling Integration
- OAuth;
- API;
- webhooks;
- orders;
- inventory;
- invoices;
- shipments.

## PHASE 5 — Marketplace Integrations
Um por vez.

## PHASE 6 — AI Agents
- monitor;
- recommend;
- approve;
- bounded automation.

## PHASE 7 — Creator Commerce
- discovery;
- Creator Genome;
- scoring;
- campaigns;
- GMV.

## PHASE 8 — Customer Return
- recompra;
- churn;
- next best action.

## PHASE 9 — RepCo SaaS
- onboarding;
- multi-tenant;
- planos;
- billing;
- quotas;
- reusable modules.

---

# 53. PRIMEIRA IMPLEMENTAÇÃO

Depois da auditoria, se não houver bloqueador técnico, construir somente:

- E-CoHub shell;
- navigation;
- dashboard;
- mock data;
- schema base;
- types;
- CommerceProvider;
- MockCommerceProvider;
- marketplace adapters;
- event model;
- exception model;
- automation model;
- permissions;
- feature flags.

Não integrar nada real.

---

# 54. DOCUMENTAÇÃO OBRIGATÓRIA

Criar:

```text
docs/e-cohub/
```

Arquivos:

- `README.md`
- `VISION.md`
- `CURRENT_STATE_AUDIT.md`
- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `EVENT_MODEL.md`
- `AGENT_ARCHITECTURE.md`
- `AUTOMATION_MODEL.md`
- `MARKETPLACE_ADAPTERS.md`
- `BLING_INTEGRATION_PLAN.md`
- `ERP_INTEGRATION_PLAN.md`
- `SECURITY.md`
- `FISCAL_SETUP_RULES.md`
- `CD_OPERATIONS.md`
- `MULTITENANCY.md`
- `BUILD_VS_BUY.md`
- `ROADMAP.md`
- `TEST_PLAN.md`
- `COST_MODEL.md`
- `DECISIONS_REQUIRED.md`

---

# 55. GIT

Antes de alterar:

1. verificar status;
2. backup;
3. criar branch `feature/e-cohub-foundation`;
4. não fazer push para produção;
5. commits pequenos;
6. rollback fácil.

---

# 56. TESTES

Testar:

- tenant isolation;
- order lifecycle;
- inventory;
- duplicate events;
- idempotency;
- permissions;
- approval flow;
- exception creation;
- automation execution;
- adapters;
- webhook security;
- rollback.

---

# 57. RESULTADO ESPERADO DA PHASE 1

O painel deverá possuir E-CoHub com dados de demonstração claramente identificados como `MOCK DATA`.

Navegação funcional por Dashboard, Orders, Shipping, Inventory, Products, Channels, Pricing, Finance, Reviews, Competitors, Creators, Automation, Exceptions, CD Operations e Settings.

Nenhuma ação deverá atingir marketplace real.

---

# 58. VISÃO FINAL

```text
                    E-CoHub

        Amazon
          │
    Mercado Livre
          │
       Shopee
          │
    TikTok Shop
          │
    Site Saporino
          │
          ▼
        Bling
          │
          ▼
        E-CoHub
          │
 ┌────────┼─────────┐
 ▼        ▼         ▼
Agents   RepCo   Market Memory
 │
 ▼
Human by Exception
```

Fisicamente:

```text
PEDIDO
  ↓
AUTOMAÇÃO
  ↓
CD SAPORINO — VÁRZEA
  ↓
SEPARAÇÃO
  ↓
EMBALAGEM
  ↓
ETIQUETA
  ↓
COLETA
```

O objetivo final é que o proprietário acompanhe vendas, margem, estoque, alertas e decisões, e não sincronização manual, pedido por pedido, atualização manual de estoque, emissão manual de nota ou conferência repetitiva de canais.

---

# 59. PRIMEIRA RESPOSTA DO CLAUDE

Antes de implementar, responder:

1. O que entendeu que é o E-CoHub.
2. Como ele se conecta à Saporino.
3. Como ele se conecta ao RepCo.
4. Como o Bling entra na arquitetura.
5. Como o CD de Várzea entra no fluxo.
6. Qual arquitetura recomenda.
7. O que já existe e será reaproveitado.
8. O que precisa ser criado.
9. Riscos.
10. Roadmap.
11. Primeira etapa.
12. Confirmação de que nenhuma integração real será feita nesta fase.
13. Confirmação de que qualquer etapa fiscal será interrompida até receber dados do contador.
14. Confirmação de que nenhum fulfillment externo será ativado.

Depois da auditoria, se não houver bloqueadores, iniciar apenas:

# PHASE 1 — FOUNDATION

---

# 60. REGRA FINAL

Use este documento como especificação principal do E-CoHub.

Não espere que o proprietário redescreva o projeto.

Quando houver conflito entre código existente e este documento:

1. não destruir o que funciona;
2. documentar o conflito;
3. sugerir migração;
4. pedir aprovação antes de mudança de alto impacto.

O E-CoHub deverá nascer como infraestrutura própria, modular e reutilizável, tendo a Saporino como primeiro cliente e o RepCo como futuro ecossistema SaaS.
---

# 61. ATUALIZAÇÃO ESTRATÉGICA — CASA COFICO, VOZ DO CLIENTE E INTELIGÊNCIA REVERSA

Esta seção complementa e amplia a especificação original do E-CoHub.

## 61.1 CASA COFICO COMO IDENTIDADE COMERCIAL DOS MARKETPLACES

A operação de venda online deverá ser preparada para utilizar a identidade comercial **CASA COFICO** nos seguintes canais, quando aprovados e cadastrados:

- TikTok Shop Brasil
- Mercado Livre Brasil
- Shopee Brasil
- Amazon Brasil

A Casa Cofico será a loja digital que poderá comercializar produtos de Saporino, Café Fazendinha e outras marcas autorizadas pela COFICO.

O E-CoHub deverá separar claramente LOJA, MARCA, PRODUTO, SKU, margem, estoque, avaliações, campanhas, creators e reputação.

# 62. ESTOQUE ÚNICO E SINCRONIZADO

Regra operacional reforçada:

> Todo estoque físico da operação online sai do CD da COFICO/Saporino em Várzea Paulista.

Todos os canais devem compartilhar a mesma verdade operacional de estoque.

```text
CD VÁRZEA PAULISTA
        ↓
     BLING
        ↓
    E-CoHub
        ↓
TikTok / Mercado Livre / Shopee / Amazon / Site
```

O E-CoHub deverá impedir overselling por meio de reserva de estoque, sincronização, idempotência, estoque disponível, estoque comprometido, estoque de segurança, alertas de ruptura e previsão de reposição.

# 63. PREVISÃO DE REPOSIÇÃO MULTICANAL

Criar mecanismo usando vendas por SKU e canal, velocidade de venda, sazonalidade, promoções, creators, campanhas, lead time de produção, lead time de entrada no CD, estoque físico e reservado.

O sistema deverá considerar a demanda somada de todos os canais.

# 64. CUSTOMER EXPERIENCE CONTROL TOWER

Criar módulo **Torre de Controle da Experiência do Cliente** para detectar problemas antes da reclamação pública.

Monitorar atraso, pedido sem postagem, tracking ausente, objeto parado, pedido incompleto, embalagem danificada, NF-e, devolução, reembolso, cancelamento, mensagem sem resposta, review negativo e possível problema de lote.

# 65. PROTEÇÃO CONTRA ATRASO

Medir obrigatoriamente:

- pagamento → faturamento
- pagamento → postagem
- postagem → primeira atualização de tracking
- postagem → entrega
- percentual dentro do prazo
- percentual atrasado
- pedidos sem rastreio
- pedidos parados

Se o prazo estiver em risco:

```text
RISCO_DE_ATRASO
→ abrir exceção
→ avisar cliente proativamente
→ fornecer nova previsão real
```

# 66. TRACKING PROATIVO

Quando o pedido for postado, atualizar área do cliente e enviar tracking por canais autorizados.

Se tracking ficar sem atualização por período configurável:

```text
OBJETO_PARADO
→ incidente logístico
→ Agente E-Commerce
→ investigação
→ comunicação proativa
```

# 67. PÓS-COMPRA AUTOMÁTICO

Após entrega confirmada, enviar mensagem pós-compra e permitir respostas simples como “Tudo certo” e “Preciso de ajuda”.

Se houver problema, abrir atendimento já puxando pedido, SKU, lote e tracking.

# 68. FEEDBACK E REVIEWS MULTICANAL

Coletar, quando tecnicamente permitido, avaliações de TikTok Shop, Mercado Livre, Shopee, Amazon, site próprio, SAC e pós-compra.

Guardar canal, produto, SKU, pedido quando disponível, nota, texto, data, sentimento, tema, lote quando possível, status de resposta e resposta enviada.

# 69. RESPOSTAS A AVALIAÇÕES

Criar três níveis:

- feedback positivo simples: resposta automática aprovada no futuro
- dúvida/crítica leve: resposta personalizada
- reclamação séria: investigar e resolver antes de responder

# 70. REGRAS PARA RESPOSTAS SOCIAIS

Toda resposta deve ser em Português do Brasil, natural, contextual, não repetitiva, sem inventar, sem culpar o cliente e com solução concreta quando aplicável.

# 71. CUSTOMER FRUSTRATION SCORE

Criar score de risco usando atraso, falta de tracking, mensagens anteriores, SLA vencido, pedido de reembolso, review negativo, pedido incompleto e reincidência.

# 72. DETECÇÃO DE PADRÕES DE PRODUTO

Agrupar reclamações por SKU, lote, data de torra, moagem, embalagem, transportadora, canal e região.

Permitir thresholds para atenção, investigação, bloqueio preventivo e escalonamento humano.

# 73. CONTROLE DE LOTE

Preparar estrutura para lote, produção, torra, validade, fornecedor, origem, quantidade, controle sensorial, teste de vedação, amostra de retenção, pedidos e reclamações associados.

# 74. PREÇO, PROMOÇÃO E CANAL

Permitir estratégia de preço por canal analisando comissão, frete, creator, margem, ranking, conversão e recompra.

Nunca usar preço âncora enganoso ou desconto fictício.

# 75. BUNDLES E VARIAÇÕES

Preparar 1 pacote, 2 pacotes, 3 pacotes, kits e bundles. Medir conversão, ticket, margem, custo logístico e recompra.

# 76. SOCIAL PROOF

Monitorar vendidos, avaliações, nota, reviews com foto/vídeo, UGC, creators e recompra. Nunca inventar prova social.

# 77. CASA COFICO — LOJA VS MARCA

Separar claramente:

```text
LOJA: Casa Cofico
MARCA DO PRODUTO: Saporino / Fazendinha / outra
PRODUTO: SKU específico
```

# 78. EXPERIÊNCIA DE ENTREGA

Criar KPI de entrega no prazo, embalagem íntegra, pedido completo, rastreio disponível, comunicação proativa, reclamação por transportadora, reembolso e reenvio.

# 79. CHECKLIST DE IMPLEMENTAÇÃO DO E-COHUB

Claude deverá produzir checklist executável dividido em Fundação, Bling, Estoque, Pedidos, Expedição, Tracking, Feedback, Reviews, Atendimento, Reembolso, Lotes, Pricing, Bundles, Marketplaces, Casa Cofico, Segurança, Testes, Observabilidade e Go-live.

Cada item: responsável, dependência, status, risco, teste e evidência de conclusão.

Claude não deve pular etapas.

# 80. ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

1. Auditoria
2. Modelo de dados
3. Estoque único
4. Pedidos
5. Expedição
6. Tracking
7. Exceções
8. Feedback
9. Atendimento
10. Lotes
11. Pricing
12. Bundles
13. Bling
14. Primeiro canal
15. Testes reais controlados
16. Demais canais
17. Automação progressiva

# 81. REGRA DE PENSAR ANTES DE EXECUTAR

Antes de qualquer mudança relevante, Claude deverá entender o estado atual, identificar dependências, verificar se já existe algo equivalente, avaliar impacto em estoque/pedidos/fiscal/usuários, criar plano, testar em ambiente seguro e só então implementar.


---

# 82. CREATOR & SELLER COMMERCE OPERATIONS — FORMIGUINHAS DE VENDAS

Objetivo: transformar creators, afiliados e vendedores digitais em uma rede distribuída de vendas da Casa Cofico, operando continuamente, com controle humano, rastreabilidade, comissão, performance e estoque central sincronizado.

## 82.1 Princípio

A Casa Cofico deve construir uma rede de "formiguinhas de vendas": muitos parceiros digitais vendendo produtos Saporino, Fazendinha e demais marcas autorizadas, em vez de depender apenas de poucos influenciadores grandes.

O sistema deve priorizar:

- volume de parceiros ativos;
- qualidade do perfil;
- afinidade com café/alimentos;
- capacidade real de conversão;
- margem após comissão;
- recompra;
- reputação;
- compatibilidade com a marca.

## 82.2 Tipos de parceiro

Separar as entidades:

1. Creator — cria conteúdo.
2. Affiliate Creator — cria conteúdo e vende por comissão.
3. Live Seller — vende em live commerce.
4. Marketplace Seller — loja/vendedor que revende produtos.
5. Publisher/Affiliate — divulga links em site, blog, comunidade ou rede social.
6. Embaixador — parceiro aprovado com relacionamento recorrente.

## 82.3 Radar Multiplataforma

Criar radar para descobrir parceiros em:

- TikTok;
- TikTok Shop;
- Instagram;
- YouTube;
- Mercado Livre;
- Shopee;
- Amazon;
- sites/blogs;
- outras fontes autorizadas.

O radar não deve pesquisar somente um concorrente. Deve procurar:

- quem vende café;
- quem promove café;
- quem faz review de café;
- quem vende marcas concorrentes;
- quem vende alimentos/achadinhos;
- quem faz live commerce;
- quem já atua como afiliado;
- quem tem audiência compatível com Saporino ou Fazendinha.

## 82.4 Perfil do parceiro no admin

Cada parceiro deve ter ficha com:

- nome;
- @handle;
- plataforma;
- URL clicável do perfil;
- links dos conteúdos relevantes;
- tipo de parceiro;
- nicho;
- marcas de café promovidas;
- produtos observados;
- sellers relacionados;
- alcance observado;
- engajamento observado;
- sinais de intenção de compra nos comentários;
- frequência de publicação;
- histórico de promoções;
- brand safety;
- região quando pública e comercialmente relevante;
- score;
- justificativa do score;
- data da descoberta;
- última verificação;
- status.

## 82.5 Status operacionais

- Descoberto
- Em análise
- Salvo para depois
- Aprovado
- Rejeitado
- Convite preparado
- Convite enviado
- Em negociação
- Amostra solicitada
- Amostra enviada
- Conteúdo publicado
- Parceiro ativo
- Pausado
- Encerrado

## 82.6 Regra de contato humano primeiro

Por padrão:

```text
DESCOBRIR
↓
ENRIQUECER
↓
ANALISAR
↓
MOSTRAR PERFIL NO ADMIN
↓
USUÁRIO APROVA
↓
SÓ ENTÃO PREPARAR OU ENVIAR CONTATO
```

Nenhum contato automático deve ocorrer antes da aprovação do perfil, salvo se no futuro o usuário habilitar explicitamente uma política de autonomia específica.

## 82.7 Links e atribuição

O E-CoHub deverá suportar dois modelos:

### Modelo A — afiliado da própria plataforma

Quando TikTok Shop, Shopee, Amazon ou outro canal fornecer mecanismo oficial de afiliado, o E-CoHub deverá registrar:

- programa;
- ID do afiliado/creator;
- produto;
- taxa de comissão;
- campanha;
- link oficial quando disponível;
- período de atribuição quando conhecido;
- vendas atribuídas;
- devoluções/cancelamentos;
- comissão estimada;
- comissão confirmada;
- status de pagamento.

A plataforma continua sendo a fonte de verdade da atribuição e do pagamento quando esse for o modelo oficial.

### Modelo B — programa próprio Casa Cofico

Para site próprio ou canais em que a Casa Cofico optar por programa próprio, permitir:

- affiliate_id;
- creator_id;
- seller_id;
- link exclusivo;
- código promocional opcional;
- UTM;
- cookie/atribuição conforme política aprovada;
- pedido atribuído;
- comissão calculada;
- comissão aprovada;
- comissão paga;
- estorno de comissão por cancelamento/devolução.

Nunca duplicar pagamento quando a mesma venda já tiver comissão liquidada pela plataforma.

## 82.8 Central de Comissões

Criar tela:

# Comissões & Afiliados

Visões:

- comissão por parceiro;
- comissão por plataforma;
- comissão por produto;
- vendas atribuídas;
- pedidos válidos;
- pedidos cancelados;
- devoluções;
- comissão pendente;
- comissão aprovada;
- comissão paga;
- margem depois da comissão;
- ROI do parceiro;
- recompra dos clientes originados.

## 82.9 Regras de comissão

A comissão deve ser configurável por:

- plataforma;
- parceiro;
- campanha;
- produto;
- SKU;
- período;
- tipo de conteúdo;
- tier de performance.

Exemplo de tiers:

- Base
- Bronze
- Prata
- Ouro
- Elite

O sistema pode sugerir aumento de comissão apenas quando houver evidência de que o parceiro gera margem incremental positiva.

## 82.10 Affiliate links por café

Preparar links e campanhas por SKU, por exemplo:

```text
Casa Cofico → Saporino 500g → Creator A
Casa Cofico → Fazendinha Tradicional → Creator B
Casa Cofico → Kit 3x Saporino → Creator C
```

Cada vínculo deve ser rastreável e ter validade/campanha.

## 82.11 Seller Intelligence

Além de creators, criar radar de sellers para descobrir lojas que vendem café concorrente em marketplaces.

Guardar:

- seller;
- marketplace;
- URL da loja;
- produtos de café vendidos;
- marcas vendidas;
- faixa de preço;
- reputação;
- volume observável;
- avaliações;
- bundles;
- prazo/frete;
- oportunidade para Casa Cofico.

## 82.12 Admin user-friendly

Criar UX simples, com:

- cards claros;
- filtros por plataforma/status/score/nicho;
- botões "Abrir perfil", "Ver conteúdos", "Aprovar", "Descartar", "Preparar convite";
- tooltips;
- exemplos;
- estados vazios explicativos;
- linguagem em Português do Brasil;
- confirmação antes de ações críticas.

## 82.13 Central de Ajuda contextual

Criar ícone **? Ajuda** em todas as telas relevantes.

A ajuda deverá explicar:

- o que é creator;
- o que é afiliado;
- o que é seller;
- como funciona comissão;
- o que é link de afiliado;
- o que significa cada status;
- como aprovar parceiro;
- como enviar convite;
- como interpretar métricas;
- como verificar pagamentos;
- como pausar campanha;
- como corrigir um erro.

A ajuda deve ser contextual, pesquisável e oferecer passo a passo.

## 82.14 Modo aprendizado guiado

Para usuários iniciantes, oferecer "Modo Guiado":

```text
Passo 1 — Encontrar parceiros
Passo 2 — Revisar perfil
Passo 3 — Aprovar
Passo 4 — Escolher produto
Passo 5 — Definir comissão
Passo 6 — Preparar convite
Passo 7 — Enviar amostra quando aplicável
Passo 8 — Acompanhar conteúdo
Passo 9 — Acompanhar vendas
Passo 10 — Conferir comissão
```

## 82.15 Fonte de verdade e compliance

Não presumir que todas as plataformas usam o mesmo sistema de comissão.

Cada integração deverá consultar a documentação oficial vigente no momento da implementação.

Regras fiscais de comissão, nota fiscal ou tributação devem ser configuradas somente com orientação fiscal/contábil validada.


---

# V4 — INSTRUÇÕES DE IMPLEMENTAÇÃO PARA CLAUDE CODE

Esta V4 deve ser usada junto com a Auditoria Mestre mais recente do site.

## Regras obrigatórias antes de implementar

1. Ler toda esta especificação e a auditoria.
2. Reutilizar antes de criar.
3. Não duplicar módulos, tabelas, services, helpers, prompts ou fluxos.
4. Corrigir primeiro os P0 identificados na auditoria.
5. Não conectar marketplace real antes de existir:
   - estoque-fonte-única;
   - SKU/variante;
   - reserva de estoque;
   - idempotência;
   - testes críticos;
   - observabilidade mínima.
6. Não inventar regras fiscais.
7. Não ativar automações irreversíveis sem aprovação humana.
8. Toda integração externa deve usar adapter/provider substituível.
9. Toda tela nova deve ser simples, guiada e conter `? Ajuda`.
10. Ao final de cada fase, gerar um relatório de implementação e PARAR para revisão.

Criar/manter o arquivo:
`docs/ECOHUB_V4_IMPLEMENTATION_REPORT.md`

Esse relatório deve terminar com:

**RESULTADO PARA REVISÃO — TRAZER ESTE RELATÓRIO DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE CONTINUAR.**

---

# V4.1 — FUNDAÇÃO COMERCIAL

A auditoria mostrou que o B2C nunca realizou venda real e que o estoque não tem uma única fonte de verdade.

Antes do multicanal, implementar nesta ordem:

## P0 — estabilização
- resolver referências a tabelas inexistentes identificadas na auditoria;
- validar checkout B2C ponta a ponta;
- exigir assinatura válida no webhook de pagamento;
- proteger funções de rastreio e APIs pagas;
- trocar credenciais demo;
- adicionar rate limiting;
- adicionar testes críticos;
- adicionar observabilidade mínima.

## P0 — catálogo estruturado

Modelar ou estender:

EMPRESA → LOJA → MARCA → PRODUTO → VARIANTE → SKU → KIT/BUNDLE

Regra:
- LOJA = Casa Cofico
- MARCA = Saporino / Café Fazendinha / outra
- SKU = unidade operacional de venda e estoque

---

# V4.2 — ESTOQUE COMO FONTE ÚNICA

Criar uma única verdade operacional de estoque.

Necessário:
- saldo físico;
- saldo reservado;
- saldo disponível;
- estoque de segurança;
- ledger de movimentos;
- motivo do movimento;
- pedido relacionado;
- canal;
- SKU;
- lote quando aplicável;
- idempotency key;
- auditoria;
- reconciliação.

Fórmula:
DISPONÍVEL = FÍSICO - RESERVADO - SEGURANÇA

Nunca permitir venda sobre saldo não disponível.

Todo estoque online parte do CD de Várzea Paulista.

---

# V4.3 — CASA COFICO

Criar entidade de loja separada da marca.

Casa Cofico será a loja online da COFICO para:
- Saporino;
- Café Fazendinha;
- futuras marcas autorizadas.

Cada pedido deve preservar:
- store_id;
- channel_id;
- brand_id;
- product_id;
- sku_id;
- origem;
- preço;
- desconto;
- frete cobrado;
- custo de frete;
- comissão;
- margem.

---

# V4.4 — BLING

Bling deve ser tratado como ERP operacional para e-commerce, quando integrado.

Responsabilidades esperadas:
- pedidos;
- produtos;
- estoque;
- NF-e;
- expedição/etiquetas quando suportado;
- financeiro operacional.

O E-CoHub permanece responsável por:
- orquestração;
- visão multicanal;
- exceções;
- reconciliação;
- margem;
- forecasting;
- experiência do cliente;
- inteligência operacional.

Implementar provider desacoplado, por exemplo `BlingProvider`.

---

# V4.5 — FRETE & LOGÍSTICA INTELIGENTE

Criar módulo próprio dentro do E-CoHub.

## Entrega própria
Considerar:
- veículo;
- motorista;
- combustível;
- seguro;
- manutenção;
- pedágio;
- custo do CD;
- custo por km;
- custo por parada;
- custo por rota;
- custo por kg;
- custo por pedido.

## Transportadoras
Criar adapters por transportadora com suporte a:
- cotação;
- prazo;
- coleta;
- etiqueta;
- tracking;
- custo;
- SLA;
- ocorrência;
- reentrega;
- devolução.

Contrato conceitual:
CarrierAdapter:
- quote()
- createShipment()
- getLabel()
- track()
- cancelShipment()
- getProofOfDelivery()

Não prender a arquitetura a uma transportadora.

---

# V4.6 — FRETE B2C E B2B

B2C:
Site / TikTok Shop / Mercado Livre / Shopee / Amazon
→ pedido
→ frete
→ expedição
→ tracking
→ entrega

B2B:
RepCo
→ pedido varejo/atacado
→ comparar entrega própria x transportadora
→ escolher alternativa
→ acompanhar custo e SLA

RepCo continua sendo o motor comercial B2B.
E-CoHub fornece a camada logística quando necessário.

---

# V4.7 — MOTOR DE DECISÃO DE FRETE

Calcular, usando dados reais:
- valor do pedido;
- peso;
- volume;
- origem/destino;
- distância;
- prazo;
- custo real;
- frete cobrado;
- subsídio;
- margem pós-frete;
- quantidade de paradas;
- custo de rota.

O sistema deve responder:
- Vale a pena entregar este pedido?
- Qual pedido mínimo para essa região?
- Rota própria ou transportadora?
- Frete grátis destrói margem?
- Qual transportadora tem melhor custo/prazo?
- Quanto custa cada parada?
- Quanto custa cada kg entregue?

Separar sempre:
FRETE_COBRADO_CLIENTE
FRETE_REAL
SUBSÍDIO_COFICO
CUSTO_ENTREGA_PRÓPRIA
MARGEM_PÓS_FRETE

---

# V4.8 — MARKETPLACE ADAPTER LAYER

Criar contratos comuns para:
- TikTok Shop;
- Mercado Livre;
- Shopee;
- Amazon;
- site próprio.

Contrato conceitual:
MarketplaceAdapter:
- getOrders()
- getOrder()
- getProducts()
- getInventory()
- syncInventory()
- getShipments()
- getReturns()
- getReviews()
- getSettlements()

Começar com mocks/testes antes de produção.

---

# V4.9 — CREATOR & SELLER COMMERCE

Criar área operacional:

Creator & Seller Commerce
- Radar
- Descobertos
- Em análise
- Aprovados
- Convites
- Amostras
- Parceiros ativos
- Links/Cupons
- Comissões
- Performance
- Histórico

Fluxo:
DESCOBRIR → PERFILAR → ANALISAR → APROVAÇÃO HUMANA → CONTATO

Nunca contatar automaticamente antes de aprovação.

---

# V4.10 — PERFIL DE CREATOR/SELLER

Mostrar:
- nome;
- plataforma;
- @perfil;
- link externo;
- tipo;
- nicho;
- produtos vendidos;
- marcas promovidas;
- conteúdos;
- sinais de venda;
- score;
- motivo do score;
- riscos;
- status;
- histórico;
- última verificação.

O usuário deve sempre poder abrir o perfil original antes de aprovar.

---

# V4.11 — AFILIADOS E COMISSÕES

Suportar dois modelos:

A) programa da própria plataforma;
B) programa próprio Casa Cofico, quando aplicável.

Para programa próprio:
- affiliate_id;
- link;
- cupom;
- attribution window;
- pedido;
- comissão;
- status;
- conciliação;
- pagamento.

Regra:
Nunca pagar duas comissões sobre a mesma venda sem regra explícita.

---

# V4.12 — PARTNER P&L

Para cada parceiro medir, quando houver dados:
- receita;
- pedidos;
- unidades;
- comissão;
- amostras;
- frete subsidiado;
- descontos;
- devoluções;
- margem;
- recompra;
- ROI.

---

# V4.13 — CUSTOMER EXPERIENCE CONTROL TOWER

Monitorar:
- atraso;
- tracking;
- pedido incompleto;
- embalagem;
- devolução;
- reembolso;
- review;
- atendimento;
- status de transportadora.

Criar filas de exceção.

---

# V4.14 — REVIEWS E PÓS-COMPRA

Quando a API permitir:
- coletar review;
- classificar;
- vincular a pedido/SKU;
- sugerir resposta;
- automatizar apenas casos seguros;
- escalar reclamação;
- registrar resposta.

Fluxo:
ENTREGUE → FEEDBACK → AJUDA → REVIEW → RECOMPRA

---

# V4.15 — PREVISÃO DE REPOSIÇÃO

Somar demanda de todos os canais.

Usar:
- saldo disponível;
- reservas;
- venda diária;
- tendência;
- campanhas;
- creators;
- pedidos B2B;
- lead time;
- estoque em produção;
- segurança.

Entregar:
- cobertura em dias;
- data provável de ruptura;
- quantidade sugerida;
- risco;
- confiança;
- justificativa.

---

# V4.16 — AJUDA E MODO GUIADO

Toda tela importante deve ter:
- `? Ajuda`
- explicação simples;
- glossário;
- exemplos;
- “o que fazer agora?”;
- “próximo passo”.

Preparar integração futura com:
`Perguntar ao Ai.Bot`

Criar framework de passos para fluxos como:
- conectar marketplace;
- aprovar creator;
- configurar estoque;
- configurar transportadora.

---

# V4.17 — OBSERVABILIDADE, AUDITORIA E TESTES

Antes de escala:
- audit log geral;
- logs estruturados;
- status de jobs;
- retry/backoff;
- falha terminal;
- idempotência;
- custos de API;
- alertas;
- health checks.

Testes mínimos:
- reserva;
- baixa;
- cancelamento;
- devolução;
- idempotência;
- webhook;
- sincronização;
- cálculo de frete;
- margem pós-frete;
- comissão;
- atribuição;
- permissões/RLS.

---

# V4.18 — ROADMAP

Fase 0 — estabilização
Fase 1 — catálogo + estoque
Fase 2 — núcleo E-CoHub + frete
Fase 3 — Bling
Fase 4 — primeiro canal real
Fase 5 — Casa Cofico multicanal
Fase 6 — Creator/Seller Commerce
Fase 7 — Customer Experience
Fase 8 — forecasting e otimização

---

# V4.19 — CHECKLIST OBRIGATÓRIO PARA CLAUDE CODE

Transformar esta V4 em checklist com:
- ID;
- fase;
- tarefa;
- dependência;
- tipo;
- arquivo/tabela afetado;
- status;
- risco;
- teste;
- critério de aceite;
- evidência;
- data.

Não marcar tarefa concluída sem evidência.

---

# V4.20 — RELATÓRIO PARA TRAZER DE VOLTA

Atualizar:
`docs/ECOHUB_V4_IMPLEMENTATION_REPORT.md`

Incluir:
- o que foi implementado;
- o que foi reutilizado;
- o que foi alterado;
- o que não foi implementado;
- bloqueios;
- migrations;
- arquivos;
- testes;
- bugs;
- riscos;
- decisões;
- próxima fase;
- perguntas para Vlademir.

Terminar com:

**TRAZER ESTE RELATÓRIO DE VOLTA AO CHAT DE INTELIGÊNCIA REPCO ANTES DE CONTINUAR PARA A PRÓXIMA GRANDE FASE.**
