# DATA_SOURCE_REGISTRY — RepCo C.I.E.
Registro de fontes. Toda fonte precisa de: uso permitido, limitação, base legal, caminho MVP, status.

## Fontes próprias (base legal mais forte)
| Fonte | Uso | Limitação | Caminho | Status |
|---|---|---|---|---|
| Instagram próprio (@cafesaporino) | mídia, insights, comentários, publicação | conta profissional + permissões | Meta/IG API (conectado) | ATIVO |
| E-commerce/CRM próprio | compra, recompra, churn | consentimento + segurança | integração direta (Supabase) | PARCIAL |
| Comentários em post próprio | análise + resposta permitida | não autoriza spam contínuo | webhook + opt-in | A FAZER |
| WhatsApp próprio | atendimento/campanha | templates + consentimento + janela | Cloud API | A FAZER |
| Amazon/ML próprios | vendas próprias | escopo da conta | SP-API / ML API | A FAZER |

## Fontes públicas (uso conforme termos)
| Fonte | Uso | Limitação | Caminho | Status |
|---|---|---|---|---|
| YouTube público | vídeos, canais, estatísticas, comentários | quota; comentários off em alguns | YouTube Data API | RECOMENDADO 1º |
| Instagram concorrente | metadados básicos, material público/manual | sem acesso a lista de seguidores | importação/captura autorizada/Apify | ATIVO (Apify) |
| Marketplace concorrente | páginas públicas | ranking dinâmico + termos | snapshots com compliance | A FAZER |
| TikTok público em massa | pesquisa | Research API condicionada | Creative Center/fornecedor | ADIAR |

## Fontes secundárias (só como referência, nunca fato)
HypeAuditor, Imginn, etc. → sempre `VERIFIED_SECONDARY` no máximo, com data e screenshot/hash. Não comparar ER de fornecedores diferentes.

## Proibições (do relatório §17.2)
- Raspar lista de seguidores para DM.
- Contornar CAPTCHA/limites.
- Comprar base.
- Dossiê individual sobre seguidor de concorrente.
- Publicar/gastar sem autorização.

## Campos mínimos por registro de mercado
`entity, platform, metric, value, unit, geography, period_start, period_end, captured_at, source_url, source_type, methodology, status, confidence, screenshot_hash, notes`.

## Já implementado
`studio_profile_snapshots` grava (handle, followers, posts_count, captured_at) por empresa a cada Verificar/Buscar — semente do `social_profile_snapshots` do modelo de dados.
