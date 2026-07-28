# TOOLS_AND_INTEGRATIONS — RepCo C.I.E.
Verificado, não presumido. Custos são estimativas a confirmar.

| Ferramenta | Existe? | Propósito | Ess/Opc | Grátis/Pago | Custo estim. | Credencial | Risco | Alternativa | Fase |
|---|---|---|---|---|---|---|---|---|---|
| Git/GitHub | ✅ | Versionamento | Ess | Grátis | — | — | — | — | 0 |
| Deno (Edge) / Node | ✅ | Runtime funções/scripts | Ess | Grátis | — | — | — | — | 0 |
| PostgreSQL (Supabase) | ✅ | Banco relacional | Ess | Plano atual | já pago | service key | vendor lock-in leve | — | 0 |
| Supabase Storage | ✅ | Objetos/mídia | Ess | incluso | — | — | — | S3 | 0 |
| pg_cron / pg_net | ✅ | Scheduler/HTTP | Ess | incluso | — | — | key em job | — | 0 |
| **pgvector** | ❌ | Embeddings/busca semântica | Ess (C.I.E.) | Grátis (extensão) | — | — | migração de infra | Qdrant/externo | 2 |
| Whisper (OpenAI) | ✅ | Transcrição | Ess | Pago | ~US$0,006/min | `OPENAI_API_KEY` | custo por volume | Whisper local | 1 |
| Claude API | ✅ | Análise/síntese multimodal | Ess | Pago | ~US$0,05-0,10/análise | `ANTHROPIC_API_KEY` | custo/latência | modelo menor p/ classificar | 1 |
| Meta/Instagram API | ✅ (conectado) | Publicar + insights próprios | Ess | Grátis (API) | — | token IGAA | expira; revisão do app | — | 1-2 |
| **YouTube Data API** | ❌ | Vídeos+comentários públicos | Ess (comentários) | Grátis c/ quota | US$0 (quota 10k/dia) | `YOUTUBE_API_KEY` | quota; comentários off em alguns vídeos | — | 2 |
| TikTok Content Posting | ✅ código, ❌ conexão | Publicar | Opc | Grátis | — | client key/secret | auditoria/sandbox | Creative Center | 3 |
| TikTok Research API | ❌ | Dados públicos em massa | Opc | Condicionada | — | aprovação | não é API comercial aberta | fornecedor licenciado | 4+ |
| WhatsApp Cloud API | ❌ | Atendimento/campanha consentida | Opc | Pago por conversa | variável | Meta Business | templates/consentimento | Resend (e-mail) | 4 |
| Amazon SP-API (conta própria) | ❌ | Vendas próprias | Opc | Grátis | — | conta seller | escopo | — | 4 |
| Mercado Livre API (própria) | ❌ | Vendas próprias | Opc | Grátis | — | conta ML | escopo | — | 4 |
| Apify | ✅ | Raspagem IG (posts/seguidores) | Opc | Pago | ~US$1,5/1k results | `APIFY_TOKEN` | termos de plataforma | fornecedor licenciado | 1-2 |
| Resend (e-mail) | Parcial (senha) | E-mail transacional | Opc | Pago/free tier | baixo | `RESEND_API_KEY` | domínio/Workspace | — | 4 |
| Mercado Pago | ✅ | Pagamento B2C | Ess (loja) | % por venda | — | chaves MP | webhook | — | — |
| Analytics/UTM | ❌ | Medição de conversão | Ess (experimentos) | Grátis | — | — | privacidade | GA4/Meta Pixel | 3 |
| Meta Pixel | ❌ (MASTER ITEM 4) | Rastreio de conversão | Opc | Grátis | — | `VITE_META_PIXEL_ID` | consentimento cookies | — | 3 |
| CRM/e-commerce próprio | ✅ parcial | Compra/recompra | Ess (return engine) | incluso | — | — | consentimento | — | 4-5 |
| Feature flags | ❌ | Ligar módulos | Ess | Grátis (tabela) | — | — | — | — | 1 |
| Secrets manager | Parcial | Segredos | Ess | `supabase_vault` já existe | — | — | — | — | 1 |
| Observabilidade/log | ❌ | Trace/custo/erros | Ess | Grátis-baixo | — | — | — | Logflare/Sentry | 2 |
| Backups | Supabase automático | Recuperação | Ess | incluso | — | — | testar restore | — | 0 |

**Regra:** nada pago novo é acionado sem aprovação explícita do proprietário. YouTube Data API é a **melhor 1ª fonte pública** (grátis, comentários) para provar a Arqueologia Emocional.
