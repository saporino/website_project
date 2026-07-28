# DATA_MODEL — RepCo C.I.E.
Modelo inicial (do relatório §20), mapeado ao que **já existe** vs **a criar**. Prefixo sugerido `cie_` para novas tabelas, `tenant_id` em todas.

## Já existe (reusar/renomear conceitualmente)
| Relatório | Tabela atual |
|---|---|
| `brand_profiles` | `studio_brand_profiles` |
| `products` | `products` |
| `campaigns` | `studio_campaigns` |
| `media_assets`/`posts` | `studio_videos` (+source_url, media_type) |
| `transcripts` | `studio_transcriptions` |
| `content_analyses` | `studio_analyses` |
| `social_profile_snapshots` | `studio_profile_snapshots` |
| `customers`/`orders` | `representative_clients`/`representative_orders` (B2B) |
| tenants | `companies` (`company_id`) — falta isolamento RLS |

## A criar (MVP — mínimo viável)
```
cie_sources(id, tenant_id, type, url, permission_status, captured_at, hash)
cie_comments(id, tenant_id, source_id, platform, lang, redacted_text, comment_hash,
             pii_removed, created_at)               -- nunca texto cru identificável
cie_taxonomy_labels(id, version, category, description)   -- coffee_br_v1
cie_comment_labels(id, comment_id, category, confidence, evidence_span,
                   model_version, taxonomy_version, human_review)
cie_evidence_items(id, tenant_id, claim, entity, metric, value, unit, geography,
                   period_start, period_end, captured_at, source_url, source_type,
                   methodology, status, confidence, screenshot_hash, notes)
cie_evidence_edges(id, from_node, to_node, relation, strength, confidence,
                   sources_count, period, segments_present, segments_absent,
                   contrary_evidence, taxonomy_version, human_review)
cie_hypotheses(id, tenant_id, statement, base, alt_explanations, status)
cie_experiments(id, hypothesis_id, variant_a, variant_b, audience, metric,
                window, success_criteria, stop_criteria, result, learning)
cie_market_memory(id, tenant_id, context, variant, metrics, result, cost,
                  channel, region, product, confidence, valid_until, learning)
cie_model_runs(id, tenant_id, provider, model, version, prompt_hash, schema,
               temperature, input_hash, output, cost, latency_ms, human_review,
               created_at)
cie_consents(id, tenant_id, subject_ref, purpose, legal_basis, granted_at, revoked_at)
cie_audit_logs(id, tenant_id, actor, action, target, before, after, created_at)
feature_flags(tenant_id, flag, enabled)
```

## Campos mínimos de um dado de mercado (padrão-ouro §20.2)
```json
{"entity":"3 Corações","platform":"instagram","metric":"followers","value":1170988,
 "unit":"accounts","geography":"Brazil","period_start":"2026-07-09","period_end":"2026-07-27",
 "captured_at":"2026-07-28T00:00:00-03:00","source_url":"...","source_type":"third_party_analytics",
 "methodology":"declared by provider","status":"VERIFIED_SECONDARY","confidence":0.72,
 "screenshot_hash":"...","notes":"não comparar ER entre fornecedores"}
```

## Regras
- `tenant_id` obrigatório + RLS de isolamento.
- Comentário guarda **hash + texto redigido**, não PII crua.
- Todo insight referencia `evidence_items`/`edges` (proveniência).
- Nada de `HYPOTHESIS` apresentado como `VERIFIED_*`.
