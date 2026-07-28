# GAP_ANALYSIS — RepCo C.I.E.
O que o relatório mestre exige × o que já existe. Prioridade: 🔴 crítico · 🟠 alto · 🟡 médio.

| # | Capacidade exigida | Existe hoje? | Gap | Prio |
|---|---|---|---|---|
|1|Ingestão de conteúdo próprio/autorizado (vídeo/foto/áudio)|Parcial (upload Studio)|Falta validação de direitos/origem + hash do original|🟠|
|2|Transcrição (Whisper)|✅|—|—|
|3|Análise multimodal (Claude)|✅|Falta versionamento de prompt/modelo por run|🟠|
|4|Perfil de marca persistente|✅ `studio_brand_profiles`|Falta `brand_rules` (regras duras: não dizer "zero amargor")|🟡|
|5|Importação de comentários|❌|Puxar comentários (YouTube API / IG próprio / CSV) — **núcleo da Arqueologia Emocional**|🔴|
|6|Taxonomia multi-label versionada|❌|Criar `taxonomy_labels` + `comment_labels` (coffee_br_v1)|🔴|
|7|Redação de PII|❌|Pseudonimização + remoção de identificadores antes de armazenar|🔴 (LGPD)|
|8|Evidence Graph / Knowledge Graph|❌|Tabela de edges (`evidence_edges`) no MVP|🟠|
|9|Embeddings / busca semântica|❌|Habilitar `pgvector`|🟠|
|10|Confidence Engine calibrado|❌|Score por fonte/amostra/frescor (não "peça 0-100 ao LLM")|🟠|
|11|Bias & Representation map|❌|Marcar quem está representado/ausente por insight|🟡|
|12|Hypothesis & Experiment Engine|❌|`hypotheses`/`experiments`/`variants`/`results`|🟠|
|13|Market Memory|❌|Registro de aprendizados com validade temporal|🟠|
|14|Customer Return Engine (recompra/churn)|❌ (RepCo tem pedidos)|Repurchase clock + churn + next best action|🟡|
|15|Provenance / taxonomia de verdade|❌|Status `VERIFIED_*`/`HYPOTHESIS`… em todo dado de mercado|🔴|
|16|Snapshots de perfil social|✅ `studio_profile_snapshots`|Ampliar p/ marketplace/influencer snapshots|🟡|
|17|Multi-tenant isolado|Parcial (`company_id`)|RLS cross-tenant por `tenant_id`|🔴 (só p/ vender SaaS)|
|18|Fila + idempotência + retry|❌ (fetch fire-and-forget)|Fila/estado de job idempotente|🟠|
|19|Observabilidade (logs/tracing/custo)|❌|`model_runs` + logs estruturados + custo por job|🟠|
|20|Human review / fila de aprovação|Parcial (publicar tem confirmação)|Fila formal de revisão antes de ação|🟠|
|21|Audit log|❌|`audit_logs` de ações e decisões de IA|🟠|
|22|Consentimento / base legal|❌|`consents` + base legal por tratamento|🔴 (LGPD)|
|23|Feature flags|❌|Ligar módulos C.I.E. gradualmente|🟡|
|24|Secrets manager|Parcial (Supabase Secrets)|`supabase_vault` disponível, não usado p/ isso|🟡|
|25|Calendário editorial estruturado|❌ (definido só no relatório)|Tabela de calendário + papéis por dia|🟡|

## Conclusão
O **motor de conteúdo** (Studio) está maduro. Os gaps concentram-se em **(a) comentários→taxonomia→evidência**, **(b) verdade/proveniência**, **(c) LGPD/PII**, **(d) experimentação/memória** e **(e) infra de qualidade** (fila, observabilidade, vetores). O caminho de menor risco é o MVP do relatório: **1 vídeo próprio + comentários importados → Arqueologia Emocional → evidência → hipótese → revisão humana**, tudo aditivo e atrás de flag.
