# TEST_PLAN — RepCo C.I.E.
Hoje o app tem **0 testes**. O C.I.E. exige reprodutibilidade. Introduzir testes junto com o Lote A.

## Camadas
1. **Unit** (Vitest) — funções puras: cálculo de crescimento, redação de PII, cálculo de confiança, normalização de comentário.
2. **Integração (edge)** — cada function com fixtures: entrada conhecida → saída estruturada esperada; casos de erro (fonte sem permissão, JSON vazio, token expirado).
3. **Contrato de IA** — dado um input hash, validar que o JSON respeita o schema (não testar o texto do LLM, e sim o **formato** e campos obrigatórios).
4. **Dados/RLS** — um tenant não enxerga dado de outro (`tenant_id`).
5. **E2E manual** — roteiro no dev server (fluxo comentário→evidência→hipótese).

## Casos-chave
- Comentário com PII → armazenado **redigido** (nunca cru).
- Fonte sem permissão → **rejeitada** (não processa).
- Classificação → toda label tem `evidence_span` + `confidence` + `taxonomy_version`.
- Confiança → nunca só o número do LLM; recalcula com fatores.
- Idempotência → reprocessar o mesmo item não duplica.
- Retry → falha de API não corrompe estado.
- Nenhuma ação externa (publicar/mensagem) sem passar por revisão.

## Métricas de qualidade do modelo (§24)
precisão por categoria, acordo humano, falsos positivos, calibração, taxa de "não sei", custo por análise, latência.

## Gate de merge
`typecheck` + `build` + testes verdes antes de qualquer merge do branch `repco-cie` → `main`.
