# RISK_REGISTER — RepCo C.I.E.
P=probabilidade, I=impacto (B/M/A). Mitigação obrigatória antes de escalar.

| # | Risco | P | I | Mitigação |
|---|---|---|---|---|
|1|Apresentar hipótese como fato causal|A|A|Taxonomia de verdade + Evidence Ladder + confiança calculada; painel mostra nível|
|2|Vazamento entre tenants (multi-tenant não isolado)|M|A|`tenant_id` + RLS de isolamento antes de vender SaaS; hoje uso só interno Saporino|
|3|PII de comentários sem redação (LGPD)|A|A|Redação obrigatória + armazenar hash+redigido; análise agregada; revisão jurídica|
|4|Números Gemini/Grok tratados como verdade|A|M|`SOURCE_CLAIM_UNVERIFIED` por padrão; fila de validação; fontes oficiais 1º|
|5|Ação irreversível (publicar/mensagem) sem aprovação|M|A|Fila de revisão humana; confirmação; nada automático por padrão|
|6|Raspagem contra termos de plataforma|M|A|Só APIs oficiais/uso permitido; sem lista de seguidores; sem CAPTCHA/limite|
|7|Custo de IA descontrolado|M|M|Limite por tenant, lote, cache, modelo menor, `model_runs` com custo|
|8|Quebrar o que já funciona (Studio/RepCo)|M|A|Aditivo + feature flag + branch + testes + rollback|
|9|Token IG/TikTok expira e trava publicação|M|M|Auto-refresh IG (feito); TikTok pendente de aprovação|
|10|Sem observabilidade → erro silencioso|A|M|Logs estruturados + alertas + `model_runs`|
|11|Segredo em Git/Markdown|B|A|Supabase Secrets/`supabase_vault`; nunca no repo|
|12|Overengineering (Neo4j/microserviços cedo)|M|M|PostgreSQL + edges no MVP; complexidade só quando justificada|
|13|"Zero amargor"/claims sensoriais sem prova|M|A|`brand_rules` proíbe; linguagem "perfil mais suave" só se confirmado|
|14|Baixa representatividade (comentários ≠ mercado)|A|M|Bias & Representation map por insight; combinar com pesquisa/venda|
|15|Falta de testes → regressão|A|M|Introduzir Vitest no Lote A; gate de merge|
