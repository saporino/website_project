# COST_ESTIMATE — RepCo C.I.E.
Estimativas de ordem de grandeza (confirmar preços atuais dos provedores antes de acionar). Nada pago é ligado sem aprovação.

## Custos variáveis (por uso)
| Item | Preço aprox. | Observação |
|---|---|---|
| Whisper (transcrição) | ~US$0,006/min de áudio | só vídeos |
| Claude (análise/classificação) | ~US$0,05-0,10 por análise rica | usar modelo menor p/ classificar comentário em lote reduz muito |
| Classificação de comentários (lote) | ~US$0,001-0,01 por comentário | depende do modelo/tamanho |
| Apify (raspagem IG) | ~US$1,5 / 1.000 results | preview ~1 centavo; scan 60 posts ~US$0,09 |
| YouTube Data API | **US$0** (quota 10k/dia) | comentários públicos grátis |
| Instagram/Meta API | US$0 | conta própria |
| Supabase | plano atual | pgvector não adiciona custo de licença |

## Exemplos de cenário (mensal, Saporino piloto)
| Cenário | Estimativa/mês |
|---|---|
| Comentários: 5 vídeos YouTube × ~500 comentários, classificados | ~US$5-25 (Claude) + US$0 (YouTube) |
| Monitoramento IG: 5 perfis, verificação diária | ~5×30×US$0,01 ≈ **US$1,5** |
| Análises de conteúdo Studio: 30 vídeos | ~US$1,5-3 (Claude) + Whisper |
| **Total piloto (ordem)** | **dezenas de dólares/mês**, não centenas — se com controles de custo |

## Controles obrigatórios (§19.4)
limite por tenant · amostragem · cache · modelo menor p/ tarefa simples · lote · orçamento por job · alertas · retry limitado · deduplicação.

## Custos NÃO monetários
- Tempo de revisão humana (fila de aprovação).
- Revisão jurídica LGPD (uma vez).
- Verificação/validação de dados de mercado (esforço recorrente).

> Regra: cada `cie_model_runs` grava o custo real → dá pra medir e cortar onde não paga.
