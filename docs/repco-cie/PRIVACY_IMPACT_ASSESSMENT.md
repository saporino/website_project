# PRIVACY_IMPACT_ASSESSMENT (PIA/LGPD) — RepCo C.I.E.

## 1. Papéis
- **Controlador:** Café Saporino Ltda (e, no SaaS, cada tenant sobre seus dados).
- **Operadores:** Supabase, OpenAI (Whisper), Anthropic (Claude), Apify, Meta, Google (YouTube) — exigem contrato/DPA.

## 2. Dados tratados
- **Conteúdo público** (posts/comentários) — pode conter PII (nomes, @, opiniões).
- **Clientes próprios** (pedidos, contato) — PII direta.
- **Snapshots agregados** (seguidores/posts) — não-PII.

## 3. Bases legais (por tratamento)
| Tratamento | Base legal candidata |
|---|---|
| Análise agregada de comentários públicos próprios | legítimo interesse (com teste de balanceamento) |
| Resposta privada a quem comentou | execução/legítimo interesse + expectativa legítima |
| Campanhas WhatsApp/e-mail | **consentimento** (opt-in) |
| Dados de cliente (compra/recompra) | execução de contrato |
| Comentários de terceiros (concorrente) | só agregado; **nunca** dossiê individual |

## 4. Princípios aplicados (§18)
finalidade · adequação · **necessidade/minimização** · transparência · segurança · não discriminação · prestação de contas.

## 5. Requisitos técnicos obrigatórios
- **Redação de PII** antes de armazenar comentário (guardar `redacted_text` + `comment_id_hash`, não o texto cru identificável).
- Análise **preferencialmente agregada** (temas/contagens/percentuais/exemplos redigidos).
- Política de **retenção** + procedimento de **exclusão** (`deletion_requests`).
- Criptografia, controle de acesso, logs, resposta a incidente (`incidents`).
- **Proibição de inferência sensível** (saúde, religião, política, etc.).
- Registro de modelos/prompts (`model_runs`) para prestação de contas.

## 6. Proibições
- Não capturar lista de seguidores para abordagem.
- Não criar dossiê individual de seguidor de concorrente.
- Não armazenar PII sem necessidade.
- Não enviar mensagem sem base legal/consentimento.

## 7. Pendências para decisão do proprietário
- Revisão jurídica (advogado) do teste de legítimo interesse.
- Definição de prazo de retenção do texto original de comentários.
- Texto de consentimento (WhatsApp/e-mail) e política de privacidade atualizada.
