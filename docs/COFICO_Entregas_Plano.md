# COFICO Entregas — Plano do módulo (antes de codar)

> Operador logístico do grupo. Pedidos da **Saporino** e da **Fazendinha** caem na **COFICO** para
> entrega. Dentro da COFICO ficam **separados por empresa** (para contabilizar e emitir **nota de
> serviço** por empresa — nunca misturar). Motorista da COFICO é despachado por **rota**, escaneia o
> **canhoto** e registra **POD** (foto + GPS). Cada empresa recebe o comprovante do que foi entregue pra ela.

## 1. Papéis (quem é quem)
- **COFICO** = *prestador* do serviço de entrega. Nova linha em `companies` (V. Medeiros de Santi Ltda,
  CNPJ 66.006.929/0001-36) — aparece no seletor de empresa do RepCo.
- **Saporino / Fazendinha** = *tomadores*. O pedido continua sendo **deles** (`orders.company_id` = a marca).
  A COFICO só **executa a entrega** e **cobra** por isso.
- **Motorista COFICO** = novo papel operacional (login próprio no app), só vê a fila/rota de entrega —
  nunca preço de produto, margem, nem dados de outra empresa além do necessário pra entregar.

## 2. Conceito-chave: a COFICO não “vira dona” do pedido
O pedido nasce na Saporino/Fazendinha e mantém `company_id` da marca. A COFICO enxerga uma **fila de
entregas** (todos os pedidos prontos, de todas as marcas), mas **tudo é filtrado/agrupado por
`company_id`**. Assim a separação por empresa é natural e a nota de serviço sai limpa por marca.

## 3. Fluxo ponta a ponta
1. Rep gera o pedido (Saporino/Fazendinha). Admin aprova (fluxo atual).
2. Pedido aprovado + pronto → entra na **fila COFICO Entregas** (aba nova no admin).
3. Admin (ou despachante COFICO) **monta a rota** do dia arrastando pedidos → cria uma rota de entrega
   com paradas (1 parada = 1 pedido). Rota pode ter pedidos de marcas diferentes, mas cada parada
   carrega o `company_id` do seu pedido.
4. Motorista COFICO abre o app → vê a rota → navega (Waze/Maps) → na entrega:
   - **foto do canhoto assinado** + **foto da entrega** + **GPS** (reaproveita o POD que já existe).
   - confirma → grava `delivered_at`, `delivery_proof_url`, `delivery_proof_lat/lng`, `delivery_status='entregue'`.
5. Cada empresa (Saporino/Fazendinha) vê **só as entregas dela**, com foto e comprovante.
6. No fim do ciclo, COFICO fecha a **nota de serviço por empresa** (agrega as entregas do período).

## 4. Modelo de dados (proposto — aditivo, nada destrutivo)
- **`companies`**: inserir a COFICO (1 linha). *Decisão já aprovada pelo Vlademir.*
- **Papel motorista**: reusar o mecanismo de papéis atual (ex.: `role='cofico_driver'` / tabela de
  vínculo motorista↔COFICO). Detalhe fecha no Bloco 1.
- **Rota de entrega**: reaproveitar `representative_routes` + `route_stops` **ou** criar
  `delivery_routes` + `delivery_stops` próprias (decisão B abaixo). Cada parada referencia um
  `representative_orders.id` (hoje `route_stops` referencia cliente/lead, não pedido — precisa do vínculo ao pedido).
- **POD**: já existe nos campos do pedido (`delivery_*`) e no padrão de `route_stops.proof_photo_*`.
  Acrescentar **canhoto** como um segundo arquivo (foto do canhoto assinado) — bucket privado.
- **Nota de serviço**: nova tabela `cofico_service_invoices` (por empresa + período): itens = entregas
  do período daquela `company_id`, valor calculado pelo **modelo de cobrança** (decisão A), status
  aberta→emitida→paga, anexo do PDF. (`orders.service_invoice_url` pode virar o link por-pedido, ou
  a nota vive só agregada — decisão C.)

## 5. Admin — nova aba “COFICO Entregas”
Entra no admin da Saporino (a COFICO não tem painel próprio). Sub-abas / filtro **por empresa**:
- **Fila** — pedidos prontos aguardando rota (filtro por empresa, cidade, data).
- **Rotas do dia** — montar/despachar rota; ver status ao vivo (reusa o mapa Leaflet do RepCo).
- **Entregues** — POD + canhoto por entrega, agrupado por empresa.
- **Notas de serviço** — fechamento por empresa/período + PDF.

## 6. App do motorista COFICO
Reaproveita o padrão `RepCoRoutes` (mapa OSM, geofencing 500m, GPS, nav Waze/Maps, POD foto+texto).
Diferenças: a “parada” é uma **entrega de pedido** (não visita), captura **canhoto** além da foto, e ao
confirmar marca o **pedido** como entregue.

## 7. Separação por empresa (regra crítica)
- Toda consulta da fila/rota/entregues/nota é **filtrada por `company_id`**.
- Nota de serviço **nunca** soma entregas de marcas diferentes.
- Relatório e exportação sempre por empresa.

## 8. Blocos de implementação (ordem sugerida — cada um valida + commit)
1. **Bloco 1 — Fundação:** inserir COFICO em `companies`; papel `motorista`; vínculo parada↔pedido;
   bucket privado do canhoto. (Migração aditiva + RLS.)
2. **Bloco 2 — Fila + montagem de rota (admin):** aba COFICO Entregas, fila por empresa, montar rota.
3. **Bloco 3 — App do motorista:** rota do dia, navegação, POD + canhoto, marca pedido entregue.
4. **Bloco 4 — Visão da empresa:** cada marca vê suas entregas com comprovante; “Nossos Números” da
   `/coficobrasil` passa a crescer com dado real.
5. **Bloco 5 — Nota de serviço:** fechamento por empresa/período + PDF + status.
6. **Bloco 6 — Relatórios/export por empresa** e ajustes.

## 9. Decisões que preciso de você ANTES de codar
- **A) Como a COFICO cobra a nota de serviço?** (o mais importante) — por **entrega** (R$ fixo/entrega),
  por **peso** (R$/kg — já temos `weight_kg`), por **rota**, ou **tabela por região/cidade**? Pode ser
  combinação (ex.: base por entrega + adicional por km/peso).
- **B) Rota:** reaproveito `representative_routes`/`route_stops` (mais rápido, mistura com visitas do rep)
  **ou** crio `delivery_routes`/`delivery_stops` só de entrega (mais limpo, recomendado)?
- **C) Nota de serviço:** só **agregada** por empresa/período (recomendado) ou também link por pedido?
- **D) Canhoto:** basta **foto do canhoto assinado** (recomendado) ou quer leitura de código/nº depois (OCR futuro)?
- **E) Entrada na fila:** o pedido cai na fila **automático** quando aprovado/pronto, ou o admin **empurra** manual?

## 11. Regras confirmadas pelo Vlademir (01/08/2026)

### Cobrança — DIFERENTE por empresa (não é taxa única!)
- **Saporino:** paga o **frete** para a COFICO. *(regra/valor do frete ainda a definir — decisão aberta)*
- **Fazendinha:** **R$ 1,50 × kg** que sai **+ 2%** sobre o **valor da nota fiscal** do pedido.
- **Uma nota por empresa**, por período. Mês fecha no dia **X** *(a definir)* → nota enviada a cada empresa
  → **todos pagos até o dia 5**.

### Roteirização (passo 2 — o coração)
- Agrupa por **região/cidade e zona** (ex.: SP Zona Norte junta tudo da ZN; ZN e ZS em blocos separados).
- **Tipo do ponto importa:** **CD com horário agendado** = especial; mercadinho/loja pequena/hortifruti =
  agrupável livre. **Quem decide na hora é a logística no painel admin.**
- Sistema ordena **do mais perto ao mais longe do CD (Várzea Paulista)**, com nº de paradas e **km**.
  - **Interino (grátis):** distância em linha reta (haversine) usando lat/lng já geocodificados.
  - **Depois:** **Google Maps Distance Matrix** para km/tempo reais por estrada — *precisa de chave + billing (custo)*.
- **Agenda 1 dia antes**, cadência rolante: **quinta→segunda** (por causa do fim de semana), seg→ter, ter→qua...

### Notificações (nesta ordem)
1. **Motorista** — app, recebe o roteiro do dia.
2. **Vendedor** — avisado quando o motorista **vai chegar no cliente dele**.
3. Na entrega: **vendedor + empresa** recebem o comprovante, **gravado junto com a venda** que gerou o pedido.

### POD obrigatório
Foto da **coleta** + foto da **entrega** + **canhoto assinado** (foto). Motorista **entrega o original físico**.
**Não fecha a entrega — nem segue pra próxima — sem foto E canhoto.**

### Papéis / identidade
Não há `profiles`. Cada papel é uma tabela (`representatives`, `promoters`). **Motorista = tabela `drivers`**
no mesmo molde (user_id, company_id=COFICO, status, presença, veículo/CNH). **COFICO também coordena as
promotoras** (merchandising/degustação) — encaixa depois.

### ⚠️ Alerta: COFICO no seletor precisa de flag `is_operator`
Se eu inserir a COFICO em `companies` como empresa normal (`is_active=true`), ela vira **selecionável no
fluxo de pedido do rep** — e aí alguém pode "vender café pela COFICO" por engano. A COFICO **não vende**.
**Solução:** adicionar `companies.is_operator boolean` → a COFICO entra no seletor do **cockpit/contratante**,
mas é **excluída do picker de venda** do rep. Aditivo; o filtro no picker de venda é um ajuste pequeno.

## 12. Decisões ainda abertas (não bloqueiam o Bloco 1)
- **Frete da Saporino:** qual a regra/valor? (Fazendinha já fechou: R$1,50/kg + 2% NF.)
- **Google Maps:** habilitar chave + billing p/ km reais? (interino: haversine grátis já funciona.)
- **Dia de fechamento do mês** (X) da nota — pagamento até dia 5.

## 10. Multi-tenant / RLS
Isolamento por empresa aqui é por `company_id` (Camada 3 do blueprint). Nesta fase, garanto o filtro por
empresa na aplicação e RLS por papel; o enforce multi-tenant total fica pro go-live (já mapeado no backlog).
