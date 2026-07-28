# TARGET_ARCHITECTURE — RepCo C.I.E.
Princípio: **a solução mais simples que preserve evolução.** Sem Neo4j/microserviços no MVP — PostgreSQL + arquitetura modular atendem. Aditivo e atrás de feature flag; preservar tudo que já funciona.

## Fluxo (do relatório §19.1)
```
Conectores/Uploads
  → Validação de direitos e origem
  → Raw Data Store (com hash + data)
  → Normalização + Redação de PII
  → Transcrição / Visão / NLP (Whisper + Claude)
  → Taxonomia + Embeddings (pgvector) + Entidades
  → Evidence Graph (tabela de edges)
  → Hypothesis Engine
  → Experiment Engine
  → Ações e Campanhas (Studio, já existe)
  → Resultados de negócio (e-commerce/RepCo)
  → Market Memory
```

## Componentes (reusar o que existe)
| Camada | Decisão |
|---|---|
| Front | **Manter** React/Vite/Tailwind. C.I.E. vive nas abas **Studio** + **Inteligência** (já no nav admin). Novos painéis atrás de feature flag. |
| API/IA | Edge Functions (Deno) para orquestração leve; considerar serviço Python/FastAPI **só se** a ingestão pesada justificar (decisão do dono). |
| Banco | PostgreSQL/Supabase. |
| Vetores | **pgvector** (habilitar) — embeddings de comentários/insights. |
| Objetos | Supabase Storage (já). |
| Fila | Estado de job idempotente em tabela + pg_cron; Redis/BullMQ só se volume exigir. |
| Transcrição | Whisper (já). |
| LLM | Claude com **prompts versionados**; modelo menor para classificação simples, Claude avançado p/ síntese. |
| Grafo | **Tabela de edges** (`evidence_edges`) no MVP; Neo4j só quando a complexidade justificar. |
| Scheduler | pg_cron (já, 6 jobs). |
| Observabilidade | `model_runs` + logs estruturados + custo por job + alertas. |
| Segredos | Supabase Secrets + `supabase_vault` (já disponível). |
| Multi-tenant | `tenant_id` (hoje `company_id`) em todas as entidades + políticas RLS de isolamento. |
| Feature flags | tabela `feature_flags` por tenant. |
| Human review | fila de aprovação antes de qualquer ação externa. |

## Orquestração de modelos (registrar por run)
provider · modelo · versão · prompt · schema · temperatura · data · custo · latência · input hash · output · revisão humana · decisão final → tabela `model_runs`.

## Controles de custo
limites por tenant · amostragem · cache · modelos menores p/ classificação · lote · orçamento por job · alertas · retry limitado · deduplicação.

## Encaixe no produto atual
- **Studio** = Ingestão + Transcrição + Visão + Análise + Campanhas (já existe; estender com comentários/taxonomia).
- **Inteligência** = Evidence Graph + Hypothesis/Experiment + Market Memory + dashboards.
- **RepCo** = execução (vendas/trade/promotores) + Customer Return Engine (recompra).
