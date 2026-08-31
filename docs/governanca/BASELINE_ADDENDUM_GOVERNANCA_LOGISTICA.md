# BASELINE ADDENDUM — Governança / Logística
**Data:** 30/08/2026 · **Relaciona-se a:** TASK 001 (Baseline/versionamento) · **Status da TASK 001:** DONE — este addendum **acrescenta** ao inventário sem desfazer nada.

## Objetivo
Inventariar e preservar os documentos de **governança comercial** e **logística** entregues após o fechamento da TASK 001, como **fontes de arquitetura/regras futuras**. Isto é **registro**, não autorização de implementação.

> ⚠️ **NÃO implementar** módulos derivados destes documentos agora. A prioridade atual continua sendo o **SITE SPRINT (TASK 002–008)**. C1/C2 permanecem **fechados** (não reabrir).

## Onde ficaram
Todos preservados em [`docs/governanca/fontes/`](fontes/). Cópias verbatim (binários intactos).

## Inventário oficial (5 materiais)

| # | Arquivo salvo | Nome original (recebido) | Tipo | Versão / Data-base | Papel | Destino futuro (TASK) |
|---|---|---|---|---|---|---|
| 1 | [`Diretrizes_Comerciais_COFICO_Cafe_Fazendinha_V3_0_FINAL.pdf`](fontes/Diretrizes_Comerciais_COFICO_Cafe_Fazendinha_V3_0_FINAL.pdf) | idem | PDF (375 KB) | **V3.0 FINAL** | Referência comercial **vigente** — o que o representante pode fazer/apresentar/prometer/negociar e quando pedir aprovação | Vira regra de sistema só via **TASK 032 (Governança Comercial)** / **033 (Motor de Decisão)** |
| 2 | [`Motor_Logistico_COFICO_RepCo_Especificacao_V1_1_PRE_CLAUDE.md`](fontes/Motor_Logistico_COFICO_RepCo_Especificacao_V1_1_PRE_CLAUDE.md) | idem | Markdown (30 KB) | **V1.1 — Ago/2026** · `PRE_CLAUDE` (rascunho pré-revisão) · ADMIN ONLY | Especificação do motor logístico (frete/frota/transportadoras/elegibilidade/rotas/consolidação/cubagem/custos/reserva). **Evolui o COFICO Entregas existente — NÃO é 2º sistema** | **TASKS 022–031** (logística / Motor Logístico) |
| 3 | [`REPCO_Motor_Governanca_Comercial_COFICO_V1_0.md`](fontes/REPCO_Motor_Governanca_Comercial_COFICO_V1_0.md) | idem | Markdown (14 KB) | **V1.0 — Ago/2026** · ADMIN ONLY | Arquitetura p/ transformar as Diretrizes em sistema **dinâmico, multiempresa, multicategoria** (Core COFICO → Representada → Marca/Categoria/SKU → Tabela → Políticas → Gerador de documentos) | **TASKS 032/033**; deve **estender o RepCo** (fonte de verdade) |
| 4 | [`TABELA_COMERCIAL_TEX_SP.xlsx`](fontes/TABELA_COMERCIAL_TEX_SP.xlsx) | `TABELA_COMERCIAL_TEX_SP(2).xlsx` | Excel (7,9 MB) | Total Express | **BENCHMARK / referência metodológica** (ver regra crítica abaixo) | Referência p/ **TASKS 027/030/031** (custos/reconciliação/Motor Logístico) — **nunca** como tarifa/checkout |
| 5 | [`Briefing_Auditoria_Arquitetural_Governanca_Logistica.txt`](fontes/Briefing_Auditoria_Arquitetural_Governanca_Logistica.txt) | `Texto colado.txt` | Texto (11 KB) | — | **Briefing/contexto**: pede auditoria arquitetural unificada dos itens 2/3 + Diretrizes V3.0 antes de qualquer código. Descreve visão de Motor de Decisão 🟢🟡🔴, Guardian, Decision Log, Sell-out/Trade, Gerador de Diretrizes, RBAC | Contexto de arquitetura; alimenta o planejamento das TASKS 032/033 e 022–031 |

## Regra CRÍTICA — Planilha Total Express (#4)
A planilha é **BENCHMARK / referência metodológica**. **NÃO é**: tabela contratual vigente da COFICO · preço de checkout · tabela para cobrar cliente · transportadora homologada · tarifa válida a partir de Várzea Paulista · fonte oficial para cálculo automático de frete.
- **Origem operacional COFICO = CD Várzea Paulista/SP.** A origem "São Paulo/SP" contida na planilha **não** deve ser copiada como origem operacional.
- Serve para **estudar** como uma operação profissional trata CEP/região, faixas de peso, kg adicional, cubagem, pedágio, GRIS, seguro, taxas, agendamento, palletização, risco, prazo etc. A inteligência própria da COFICO será construída com **dados reais da operação COFICO**.
- Status de transportadora (Total Express/Jadlog/Rodonaves/outras) como **Carrier Provider operacional** só existe com contrato/homologação/API próprios — a planilha **não** concede esse status.

## Regras de tratamento (do próprio complemento)
- **Diretrizes V3.0:** fonte de regras comerciais vigentes. Texto de diretriz **não** vira código automaticamente — só passa por implementação na **TASK de Governança Comercial (032)**.
- **Motor Logístico:** evolução **futura** do módulo existente **RepCo → COFICO Entregas**. Não criar segundo sistema logístico. Não implementar agora.
- **Motor de Governança:** estende o RepCo e consome as estruturas canônicas da Master Task List. Não implementar agora — **TASKS 032/033**.
- **Não criar sistemas paralelos** / não duplicar cadastro de empresa, produto, cliente, pedido, preço ou usuário (COFICO Entregas, RepCo, Studio, Ai.Bot, E-CoHub já existem/foram especificados).

## Discrepâncias registradas (NÃO resolvidas silenciosamente)
1. **Material "consolidado/unificado" não localizado como arquivo distinto.** O complemento lista um "documento consolidado/unificado de Governança + Logística" (material #4 da mensagem), mas os anexos recebidos são os **dois Motores separados** (#2 e #3) + o **briefing** (#5). → **Confirmar** se existe um 3º documento consolidado a enviar, ou se "consolidado" = os dois Motores tratados em conjunto. Nada foi escolhido/assumido.
2. **Renome de arquivos (documentado):** `Texto colado.txt` → `Briefing_Auditoria_Arquitetural_Governanca_Logistica.txt` (o nome original é artefato de colagem, sem significado); `TABELA_COMERCIAL_TEX_SP(2).xlsx` → `TABELA_COMERCIAL_TEX_SP.xlsx` (o `(2)` é artefato de download). Conteúdo intacto.
3. **Razão social no Motor de Governança:** o doc declara `Proprietário: COFICO BRASIL LTDA`, enquanto a entidade legal COFICO usada no site é **V. Medeiros de Santi Ltda** (CNPJ 66.006.929/0001-36 — marca "COFICO Brasil"). Provável nuance marca × razão social; registrar para conferência na TASK de Governança.
4. **`PRE_CLAUDE` no Motor Logístico V1.1:** sufixo indica rascunho **pré-revisão**. Tratar como entrada a ser auditada, não como especificação final homologada.

## Não-ações (limites deste addendum)
- ❌ Não implementar Motor Logístico, Motor de Governança nem derivados.
- ❌ Não transformar Diretrizes em código.
- ❌ Não reabrir C1/C2.
- ❌ Não interromper o Site Sprint (002–008) por causa destes anexos.
- ✅ Somente: inventariar, preservar, registrar origem/status, apontar conflitos.
