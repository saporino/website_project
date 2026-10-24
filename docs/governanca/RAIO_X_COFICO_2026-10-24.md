# RAIO-X DA COFICO BRASIL — 24/10/2026

Investigação somente leitura. Nenhum código, banco, checkout, pagamento ou
produção foi alterado.

**Como ler a classificação:**

| | |
|---|---|
| **A** | funciona comprovadamente em produção (há dado ou resposta HTTP que prova) |
| **B** | existe no código e está deployado, mas **não foi comprovado em uso** |
| **C** | parcialmente implementado |
| **D** | apenas planejado |
| **E** | não existe |

A diferença entre A e B é a que mais importa neste relatório: **código deployado
não é funcionalidade comprovada.** Onde não houve como provar, está escrito.

---

## 1. AS QUATRO COISAS QUE SE CONFUNDEM

| nome | o que é | onde vive |
|---|---|---|
| **Café Saporino** | empresa dona das marcas; loja B2C | `cafesaporino.com.br` · `companies.is_b2c = true` |
| **COFICO Brasil** | distribuidora/operadora logística; empresa faturadora do online | `coficobrasil.com.br` · `companies.is_operator = true` |
| **CASA COFICO** | nome comercial das lojas da COFICO **nos marketplaces** | não é site, não é empresa — é canal (`sales_channels = 'marketplaces'`) |
| **RepCo** | portal do representante + console de gestão | `/repco` e `/admin` — **módulo, não empresa** |

Marcas de café (`products.brand`, criado 23/10): **Café Saporino**, **Tropeiro
Paulista**, Café Canaan (oculto). **Café Serrão** pendente de cadastro.

**Empresas em produção (3):**

```
CAFE SAPORINO    b2c=true   operadora=false  conta_pgto=saporino
CAFÉ FAZENDINHA  b2c=false  operadora=false  conta_pgto=(nenhuma)
COFICO Brasil    b2c=false  operadora=true   conta_pgto=cofico
```

Fazendinha **sem conta de pagamento** — fail closed por desenho: não fatura.

---

## 2. SITE PÚBLICO DA COFICO — **A**

`src/pages/coficobrasil/` · 28 arquivos · **HTTP 200 confirmado em produção**

```
https://www.coficobrasil.com.br/            200
https://www.coficobrasil.com.br/cadastro    200
https://www.coficobrasil.com.br/privacidade 200  (31 KB — corpo estático p/ a Meta)
```

**Navegação: 6 páginas por hash, dentro de uma rota só** (`CoficoBrasilPage`
troca a view por `window.location.hash`):

| menu | hash | componente | estado |
|---|---|---|---|
| Cafés | `#loja` | `CoficoProdutosPage` | **A** — lê `vw_cofico_vitrine`, 7 produtos |
| Embalagens e impressão | `#embalagens` | `CoficoEmbalagensPage` | **A** — 2 ofertas, preço no banco |
| Filtros e coadores | `#filtros` | `CoficoFiltrosPage` | **B** — ficha no código |
| Máquinas e moinhos | `#maquinas` | `CoficoMaquinasPage` | **B** |
| Serviços | `#servicos` | `CoficoServicosPage` | **B** |
| Marcas / Atuação / Tecnologia / Contato | âncoras | seções da home | **A** |

**Seções da home:** `#marcas`, `#o-que-fazemos`, `#canal-digital`,
`#tecnologia`, `#atuacao`, `#trabalhe`, `#distribua`, `#contato`.

### O site **NÃO tem carrinho nem checkout** — **E**

Está declarado no próprio código:

> `CoficoBrasilPage.tsx:280` — "Estamos preparando a loja digital da COFICO […]
> Ainda não está no ar — sem carrinho nem pagamento por aqui por enquanto."

O botão dos produtos é **"Entrar para comprar"** → WhatsApp. Preço só sob
cadastro. É vitrine B2B, não e-commerce.

### Formulários que capturam de verdade — **A**

| fluxo | arquivo | tabela | linhas |
|---|---|---|---|
| Cadastro PJ | `CadastroPJ.tsx` | `b2b_empresas` | 20.266 |
| Pedido de embalagem | `CoficoEmbalagensPage` | `embalagem_pedidos` | **0** |
| Lead de marca | `CoficoMarcaLeadForm` | `b2b_leads` | 1 |

**`embalagem_pedidos` = 0.** O fluxo existe ponta a ponta (oferta, variação,
desconto por volume, avaliações) e **nunca foi usado**. Classificação: **B**.

### Subdomínio do RepCo — **E**

`repco.coficobrasil.com.br` → **DNS inexistente** (`Non-existent domain`).
O código trata esse host (`noDominioRepCo` em `config.ts`), mas ele nunca foi
criado. Acesso ao RepCo é só por `cafesaporino.com.br/repco`.

---

## 3. CATÁLOGO E PRODUTOS — **A**

`products` = 15 linhas · `vw_cofico_vitrine` = 7

- agrupamento por **marca** (não por empresa) — corrigido em 23/10
- ordem segue `display_order` do painel — corrigido em 23/10
- `product_channel_prices` = **0 linhas**: preço por canal existe e está **vazio**

**Consequência operacional:** pela regra da função `preco_do_canal`, COFICO e
marketplaces estão **sem preço definido** → o checkout recusaria a venda com
`SEM_PRECO_NO_CANAL`. Não há impacto hoje porque não há checkout nesses canais.
Classificação do preço por canal: **C** (estrutura **A**, dados **E**).

---

## 4. PAGAMENTOS — **A**, com ressalva grande

### Mercado Pago

| function | versão | estado |
|---|---|---|
| `create-payment` | 31 | **A** |
| `create-checkout-order` | 33 | **A** — atualizada 23/10 |
| `mercadopago-webhook` | 39 | **A** |
| `mp-reconcile` / `mp-refund` | 7 / 6 | **B** |

Credenciais por empresa, **4 secrets** (nenhum valor lido):
`MERCADO_PAGO_{SAPORINO,COFICO}_PROD_{ACCESS_TOKEN,WEBHOOK_SECRET}`.

### Os 4 pedidos B2C que existem

```
PF000008  rejected  R$   1,00  06/09   seller = CAFE SAPORINO
PF000012  approved  R$   1,00  06/09   seller = CAFE SAPORINO   ← a compra real
PF000013  pending   R$  10,00  07/09   seller = CAFE SAPORINO
PF000014  pending   R$ 137,26  08/09   seller = CAFE SAPORINO
```

**Uma única venda aprovada em toda a história do sistema**, de R$ 1,00, em
06/09. **Zero pedidos da COFICO.** O roteamento por empresa faturadora está
implementado e **nunca foi exercitado com a COFICO**.

### RepCo

```
CS-00001  new  R$    38,00  21/07
CS-00002  new  R$   722,00  01/08
CS-00003  new  R$ 3.610,00  18/08
```

Três pedidos, **todos em `new`** — nenhum chegou a `completed`. Por isso a aba
Performance fica vazia. `representative_commissions` = **0**.

---

## 5. FRETE E LOGÍSTICA — **C**

| | estado | evidência |
|---|---|---|
| Tabela própria COFICO (`cotar_frete`) | **A** | zona, peso, seguro, GRIS, pedágio, TAS |
| SuperFrete (agregador) | **B** | `superfrete-quote` v8 deployada · `SUPERFRETE_TOKEN` existe · `superfrete_settings` = 2 |
| `shipping_carriers` | **A** | 4 transportadoras |
| Rastreio (`sync-tracking`) | **B** | v21, de 19/03 — a mais antiga do sistema |
| **Frete internacional** | **E** | não existe |
| **Credencial dos Correios** | **E** | único secret de frete é o SuperFrete |

**Para a loja americana:** não há USD, câmbio, checkout em inglês, cálculo de
tributos nem integração com os Correios. As APIs de Preço/Prazo internacionais
exigem **contrato próprio** com os Correios, inexistente hoje.
→ módulo independente, **sem tocar no checkout doméstico**.

---

## 6. REPCO — 16 abas

`src/pages/RepCoDashboard.tsx:352`

Início · Perfil · **Prospecção** · Mapa · Clientes · Novo Pedido · Pedidos ·
Entregas · Comissões · Performance · Mercado · Rupturas · Mensagens ·
**WhatsApp** · Ajuda

**Console admin — 17 abas** (`src/pages/AdminDashboard.tsx:37`):
Dashboard · Pedidos · Produtos · Clientes · Leads B2B · Candidaturas ·
Transportadoras · COFICO Entregas · Plataformas · RepCo · Studio · Promotores ·
Comissões · Mensagens · Inventário · Configurações · Ajuda

**RBAC por papel** (`ROLE_TABS`): `supervisor` → promotores/mensagens ·
`gerente_comercial` → repco/mensagens · `contabilidade` → comissões/mensagens.
`user_roles` = 4 linhas, **1 admin**.

| módulo | estado | evidência |
|---|---|---|
| Clientes (`representative_clients`) | **A** | 7 |
| Representantes | **A** | 2 |
| Pedido em 3 passos | **A** | 3 pedidos |
| Comissões | **C** | 0 linhas — depende de pedido `completed` |
| Prospecção | **C** | 1.057 leads, 6 listas — **aba única**, sem as 5 sub-abas |
| Promotores | **C** | 1 promotor, 10 tabelas |
| Entregas/rotas | **B** | `delivery_routes`, `delivery_stops` existem |
| Inventário | **A** | 2 lotes, cadeia de custo |

---

## 7. PROSPECÇÃO — o maior ativo subutilizado

| tabela | linhas | situação |
|---|---|---|
| `prospects_b2b` | **758.929** | **invisível na interface** |
| `b2b_empresas` | 20.266 | **A** — aba Leads B2B |
| `prospect_leads` | 1.057 | **A** — vem do Apify |
| `prospect_lists` | 6 | **A** |

**Nenhuma tela lê `prospects_b2b`.** `RepCoProspection` e `ProspectionManager`
leem `prospect_leads`/`prospect_lists`. A base de 758 mil só é tocada por
`RfMatchQueue` (update de cobertura) e `leadMatch.ts`.

Catálogo de CNAEs: **118 oficiais** · 29 com empresa na base · **89 sem nenhuma**
(`docs/prospeccao/cnae-cadeia-do-cafe.json`).

---

## 8. WHATSAPP — **D**, apesar de 22 commits

| | |
|---|---|
| tabelas em produção | **ZERO** (`wa_%` não existe) |
| functions deployadas | **nenhuma** — `whatsapp-enviar` e `whatsapp-webhook` ficaram de fora |
| secrets da Meta | **nenhum** |
| aba no RepCo | existe e **quebra**: "Could not find the table 'public.vw_wa_caixa'" (mensagem traduzida em 23/10) |

Tudo vive em **staging**. Número alvo: COFICO **(11) 93810-0909**. Saporino
**(11) 91771-9798** fica no celular — está impresso na embalagem.

---

## 9. STUDIO / REDES SOCIAIS — **A**, o módulo mais vivo

| | |
|---|---|
| `studio_videos` | 79 |
| `studio_campaigns` | 68 — **54 publicadas**, 14 agendadas |
| `studio_social_connections` | 4 |
| `studio_brand_profiles` | 7 |
| tabelas | 14 |
| functions | 10 (publish-instagram, publish-tiktok, oauth, refresh-token, caption, image…) |

**54 publicações confirmadas** — é a única área com volume real de uso.
Instagram publica automático; TikTok fica em rascunho.

---

## 10. COFFEE LiVRE — o achado maior deste raio-X

**44 tabelas em produção** — o maior módulo do sistema, maior que o RepCo.
Inclui `lv_carts`, `lv_cart_items`, `lv_checkouts`, `lv_cobrancas`,
`lv_mp_credenciais`, `lv_inventory_lots`, `lv_b2b_empresas`, `lv_categories`,
`lv_attributes`…

**É um e-commerce B2B completo, construído e parado:**

```
lv_carts           0      lv_convites        0
lv_cart_items      0      lv_mp_credenciais  0
lv_checkouts       0      lv_inventory_lots  17
lv_cobrancas       0      lv_b2b_empresas     3
```

E **5 functions de pagamento não foram deployadas**: `lv-mp-conexao`,
`lv-mp-pagamento`, `lv-mp-reconciliar`, `lv-mp-reembolso`, `lv-mp-webhook`.

Classificação: **C** — estrutura A, operação E.

**Para a loja internacional e para assinaturas, é aqui que já existe carrinho,
checkout, cobrança e multi-vendedor.** Construir outro seria o terceiro gerador
de códigos de acesso.

---

## 11. MARKETPLACES — **C**

| | |
|---|---|
| `ecommerce_price_snapshots` | **6.648** preços coletados |
| `marketplace_coletas` | 1 — `mercadolivre · api · ok · 440 itens · 20/10` |
| `CasaCoficoPanel.tsx` | **A** — lê as duas tabelas |

A API do ML funciona para **ler preço de concorrente**. Não há integração para
**operar** (anúncio, pedido, estoque) — e isso é decisão registrada: os
marketplaces operam separados, a API serve a desempenho.

---

## 12. ASSINATURAS E RECORRÊNCIA — **C**

| | |
|---|---|
| `subscriptions` | **0** |
| `subscription_settings` | 1 |
| `products.subscription_enabled` | existe |
| cobrança recorrente | **E** — o checkout cobra só o 1º ciclo |

Falta o **preapproval do Mercado Pago**. Sem ele não há assinatura mensal — nem
para café, nem para os serviços novos.

---

## 13. SERVIÇOS COMERCIAIS NOVOS — onde encaixar

| frente | o que já existe | classificação |
|---|---|---|
| A. Assessoria comercial | `b2b_empresas` (20.266), `prospect_leads` | **C** — CRM existe |
| B. Representação de marcas | RepCo inteiro, comissões, `distributed_brands` | **A** |
| C. Gestão de Instagram | **Studio**, 54 publicações, OAuth, multi-marca | **A** |
| D. Criação de artes/legendas | `studio-image`, `studio-caption`, agendador | **A** |
| E. Agendamento de publicações | `publish-scheduled`, `studio_janelas` | **A** |
| F. Assinatura mensal p/ empresas | `subscriptions` vazio, **sem recorrência** | **E** |
| G. Loja internacional (EUA) | Coffee LiVRE tem carrinho/checkout; **sem frete internacional, USD, câmbio** | **D** |

**O Studio já é o produto dos itens C, D e E.** Falta embalá-lo como serviço
vendável (contrato, plano, cobrança) — não construí-lo.

---

## 14. DUPLICIDADES E RISCOS

| risco | evidência | gravidade |
|---|---|---|
| **Tropeiro Paulista cadastrado 2×** | Saporino (3 pedidos, 1 lote, 4 kits) + COFICO (zero vínculos) — dois estoques para o mesmo café | alta |
| **Café Canaan duplicado** | 2 registros idênticos, 23/06, sem vínculo | baixa |
| **Dois e-commerces** | loja Saporino (`orders`) e Coffee LiVRE (`lv_*`) — modelos diferentes para o mesmo problema | **alta** |
| **Três lugares de prospecção** | `prospects_b2b` (758k, invisível) · `b2b_empresas` (20k) · `prospect_leads` (1k) | **alta** |
| **WhatsApp fora da main** | 22 commits, 5 tabelas só em staging | média |
| **`repco.coficobrasil.com.br` não existe** | DNS inexistente; código trata o host | baixa |
| **RLS multi-tenant adiada** | RLS ligada em 45/45; isolamento por `company_id` não | alta no go-live |
| **1 só admin** | `user_roles` = 4, um admin | média |

---

## 15. O QUE DÁ PARA REAPROVEITAR

1. **Studio** → produto de gestão de redes, pronto. Falta plano e cobrança.
2. **Coffee LiVRE** → carrinho, checkout, cobrança, multi-vendedor, convites.
   Base da loja internacional e das assinaturas.
3. **`prospects_b2b`** → 758 mil empresas com telefone (96%) e e-mail (93%).
   Falta razão social (0,08%) e uma tela.
4. **RepCo** → CRM, comissão, rota, POD. Serve assessoria comercial sem mudança.
5. **Roteamento de pagamento por empresa** → provado na Saporino, pronto p/ COFICO.
6. **Preço por canal** → estrutura nova, vazia, pronta para marketplace e COFICO.

---

## 16. RECOMENDAÇÃO — ordem, sem implementar

**Nível 0 — fechar o que está aberto**
1. Decidir entre loja Saporino e Coffee LiVRE como **o** e-commerce. Dois é caro.
2. Resolver o Tropeiro duplicado (estoque por empresa × cadastro único).
3. WhatsApp para produção ou para a gaveta — 22 commits parados apodrecem.

**Nível 1 — transformar ativo parado em receita**
4. Tela de pesquisa sobre `prospects_b2b` — 758 mil empresas invisíveis.
5. Preapproval do Mercado Pago — destrava assinatura de café **e** de serviço.
6. Studio como serviço vendável.

**Nível 2 — expansão**
7. Preço por canal preenchido → COFICO e marketplaces passam a poder vender.
8. Loja internacional como módulo separado, sobre o Coffee LiVRE.

---

## 17. O QUE NÃO CONSEGUI VERIFICAR

- **Painel do Mercado Pago**: não sei se a URL do webhook e o secret estão
  configurados lá. Só vi que o código e os secrets existem.
- **Contas de Instagram/TikTok conectadas**: `studio_social_connections` = 4,
  mas não abri para ver quais e se os tokens estão válidos.
- **Fonte oficial da Receita Federal**: `dadosabertos.rfb.gov.br` recusou
  conexão deste ambiente (`ECONNREFUSED 200.152.38.155:443`). O espelho Casa dos
  Dados responde, parado em **10/05/2026**.
- **Comportamento mobile**: li o código (classes responsivas presentes), não
  medi em dispositivo.
- **Backup e restauração**: não testados nesta rodada.
