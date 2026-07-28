# MVP_IMPLEMENTATION_PLAN — RepCo C.I.E.
Aditivo, atrás de feature flag, em lotes pequenos e testáveis. **Nada publica automaticamente.** Cada lote: branch → validar → aprovação.

## Objetivo do MVP (§6, §22 Fase 1)
Provar o ciclo: **1 vídeo próprio + comentários importados → Arqueologia Emocional → evidência com limitações → hipótese → plano de experimento → revisão humana → Market Memory.**

## Lotes propostos (ordem)
### Lote A — Fundação de dados (sem UI nova visível)
- Habilitar `pgvector` (decisão do dono).
- Criar tabelas `cie_*` (DATA_MODEL) com `tenant_id` + RLS.
- Feature flag `cie_enabled` por empresa.
- `cie_model_runs` (registrar toda chamada de IA: modelo/prompt/custo).

### Lote B — Comentários (núcleo da Arqueologia Emocional)
- **Fonte 1: YouTube Data API** (grátis) — importar comentários de um vídeo por URL.
- **Fonte 2: CSV** (IG/TikTok exportado) + colar texto manual.
- Normalização + **redação de PII** → `cie_comments` (hash + texto redigido).
- Classificação multi-label `coffee_br_v1` (Claude) → `cie_comment_labels`.

### Lote C — Evidência + painel
- Agregar labels → `cie_evidence_items`/`edges` com confiança calculada.
- Painel na aba **Inteligência**: clusters, evidências, **representatividade/vieses**, Evidence Ladder.
- Botão "gerar hipótese" → `cie_hypotheses`.

### Lote D — Experimento + Market Memory
- Do insight → plano de experimento (variantes/métrica/controle) → `cie_experiments`.
- Envio para **revisão humana** (fila) antes de virar campanha no Studio.
- Registro de aprendizado em `cie_market_memory`.

## Reuso direto
Whisper/Claude/`studio_*`/campanhas/`studio_profile_snapshots` já prontos. O MVP **adiciona** comentários→taxonomia→evidência→experimento.

## Critérios de pronto (§25)
rejeição de fonte sem permissão · provenance · PII removida · taxonomia versionada · resultado estruturado com evidência+limitação · hipótese ≠ fato · fila de revisão · logs · retry seguro · custo registrado · nada publica automático · teste reprodutível · Market Memory · isolamento por tenant.
