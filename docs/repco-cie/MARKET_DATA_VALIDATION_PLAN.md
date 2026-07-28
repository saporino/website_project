# MARKET_DATA_VALIDATION_PLAN — RepCo C.I.E.
Fila de validação das afirmações de Gemini/Grok e de todo dado de mercado. **Nada entra como fato sem prova.**

## Regra
Toda afirmação recebe status: `VERIFIED_PRIMARY` · `VERIFIED_SECONDARY` · `SOURCE_CLAIM_UNVERIFIED` · `HYPOTHESIS` · `PROPOSAL` · `REJECTED`. Não sobrescrever silenciosamente; preservar histórico.

## Prioridade de validação (do relatório §6-7, §27)
1. Instagram de marcas (seguidores/ER) — hoje `VERIFIED_SECONDARY` no máximo.
2. Reels dos últimos 90 dias (views/URL/data) — hoje sem prova → `SOURCE_CLAIM_UNVERIFIED`.
3. TikTok Brasil (top perfis/vídeos/hashtags) — `SOURCE_CLAIM_UNVERIFIED`.
4. YouTube (canais/inscritos) — `VERIFIED_PRIMARY_PLATFORM` quando confirmado na plataforma.
5. 20 influenciadores do Grok (§27) — **todos** `SOURCE_CLAIM_UNVERIFIED` até validação individual.
6. Amazon / Mercado Livre (líder de categoria) — `SOURCE_CLAIM_UNVERIFIED`.
7. Preços e reviews de concorrentes.

## Conflitos já mapeados (não resolver por chute)
- "Maior marca IG": Gemini=3 Corações~1,17M × Grok=Nescafé~1,2M → snapshot sustenta **3 Corações 1.170.988**; Nescafé sem prova equivalente.
- Melitta: Grok ~750K × snapshot ~209,9K → 750K **não** sustentado.
- "Reels mais vistos" e "hashtags com bilhões" → sem URL/captura → **REJECTED como fato**, mantidos como hipótese.

## Fórmulas oficiais do projeto (usar mediana, não só média)
- `ER_follower = mediana((likes+comentários)/seguidores)`
- `ER_view = mediana((likes+comentários)/views)`
- `Viralidade = views/seguidores na data`
- `Crescimento_30d = (fim-início)/início`
- Shares/saves: só em dados próprios ou fornecedor autorizado.

## Coleta programada (o que o RepCo deve capturar por marca)
lista fixa de marcas · data/hora · seguidores · posts 90d · views · likes · comentários · frequência · duração · tema · collab · mídia paga · screenshot · URL · fonte · metodologia.

## Fontes oficiais primeiro (§28)
ABIC (indicadores, hábitos 2025, sumário Conab 2026), APIs oficiais Meta/YouTube/TikTok, ANPD (LGPD). Snapshots de terceiros (HypeAuditor/Imginn) só como secundária com data.

## Status atual do que já temos no produto
`studio_profile_snapshots` já coleta seguidores/posts com `captured_at` por perfil → primeiro passo da coleta programada (falta: screenshot/hash, ER, views por post agregadas).
