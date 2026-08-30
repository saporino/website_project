# FASE 0 — RESULTADO (PAUSADA — migração Mercado Pago PF → PJ)

> **⏸ GO-LIVE PAUSADO** por decisão operacional: a empresa vai abrir uma nova conta Mercado Pago **PJ (COFICO)** e o go-live espera por ela. Ver seção "Migração Mercado Pago PF → PJ" no fim.
> Código validado localmente + RLS segura + migrations aplicadas. As 3 edge functions foram deployadas (rodada anterior, autorizada), **mas o site NÃO está vendendo por elas** (front não pushado + RLS bloqueia o checkout antigo → nenhuma venda nova entra na conta PF). **Sem commit, sem push, sem Fase 1, sem alterar secrets, sem tocar na conta PF.**
> Data: 27/08/2026 · Branch: cofico-brasil.

## Edge Functions deployadas
- `create-checkout-order` (novo), `create-payment` (atualizado), `mercadopago-webhook` (atualizado, `--no-verify-jwt`) — todas com os helpers `_shared` (pricing, rateLimit, log, mpWebhook). Deploy OK nas 3 (CLI autenticada, projeto linkado). sync-tracking/send-password-reset **não** deployadas (opcionais; Linketrack adiado).

## create-checkout-order runtime
- Payload vazio → 400 "Nome obrigatório". Produto inexistente → 400 PRODUCT_NOT_FOUND. Chamada válida → cria orders + order_items via service role, retorna `order_id + public_token + order_number (PF000001) + total`.

## create-payment runtime
- Sem order → 400. UUID aleatório → **404 "Pedido não encontrado"** (atacante não cria preferência para UUID arbitrário). Order válido → **preferência MP criada** (id retornado). 2ª chamada → **mesma preferência (idempotent=true)**.

## mercadopago-webhook runtime
- Sem assinatura → **401**. Assinatura inválida → **401**. (Aceitação de notificação legítima = ver "Webhook signature" abaixo.)

## Mercado Pago
- Ambiente do access token = **produção** (secret existente, não alterado). Preferência criada com sucesso (não cobra). Secrets nunca exibidos/copiados.

## Checkout anônimo E2E (server-side)
- Fluxo `create-checkout-order → order/order_items server-side → create-payment → preferência MP → idempotência` validado ao vivo. Front (visitante, sem login) validado por smoke test visual anterior (checkout renderiza, zero erro de console). **Falta a conclusão do pagamento (leg do MP) — ver Pendências.**

## Preço server-side
- Enviei `unit_price:1` adulterado no payload; pedido saiu com **R$ 75,80** (37,90×2, preço do banco); `order_items.unit_price = 37,90`. Preço do browser **ignorado**.

## Token público/hash
- `public_token` de 48 hex retornado; no banco só `order_public_token_hash` (SHA-256). **Sem coluna de token puro.**

## RLS
- Confirmada em runtime (rodada anterior + agora): ANON SELECT/UPDATE/INSERT em orders e order_items = **negado**; policies `OR true`/`true` = **removidas**; RLS ligada.

## Isolamento entre pedidos
- `get_order_public(token certo)` → dados mínimos; `(token errado)` → **null**; `(token de A em pedido B)` → **null**. Usuário autenticado (JWT real) vê **só o próprio** pedido.

## Webhook signature
- Rejeição de ausente/inválida = **401** (ao vivo). **Aceitação de notificação legítima ainda NÃO exercitada** (exige uma notificação genuinamente assinada pelo MP). Ver Pendências / PASSO do MP.

## Webhook idempotência
- Lógica coberta por testes unitários verdes (não rebaixa aprovado, não reescreve paid_at) + prova de no-regression em DB. Confirmação com evento real pendente da leg do MP.

## Rate limiting
- `check_rate_limit` validada em runtime (true,true,false). create-payment fail-closed (por design; tabela aplicada). create-checkout-order/send-password-reset fail-open.

## Observabilidade / edge_logs
- `edge_logs` recebeu os eventos das funções com `request_id`/status; **0 registros** contendo token/secret/access_token/mercado_pago (sem vazamento).

## Testes finais
- `npm run test` → **34/34**. `typecheck` OK. `build` OK.

## Regressão visual
- Smoke anterior: home, produtos, carrinho, checkout de visitante (sem login) renderizam, zero erro de console. Front não mudou desde então.

## Assinatura
- **Isolada/desabilitada** (aviso claro). Falta autoridade server-side de tier/desconto/preço/periodicidade. Não bloqueia o checkout avulso.

## Tracking
- **Adiado** (Linketrack). sync-tracking gated/não deployado. Não bloqueia o checkout.

## Bugs encontrados
- Nenhum novo nesta rodada. (Anteriores corrigidos: RLS insegura, throw-before-fallback, back_urls escreviam status, botão aniversário/assinatura.)

## Correções adicionais
- Nenhuma pendente de código.

## Riscos restantes
- **Webhook secret x MP:** o `MERCADO_PAGO_WEBHOOK_SECRET` (existente) precisa bater com a config atual do webhook no MP — confirmado só quando chegar uma notificação assinada. Se recusar → recopiar o secret do MP (não enfraquecer a validação).
- Pagamento real: token é de produção → concluir pagamento cobra de verdade; usar sandbox/test user, ou autorização explícita para um teste real.

## Commit
- **Não realizado.**

## Push
- **Não realizado** (dispara Vercel — só com sua autorização).

## Recomendação para Fase 1
- **Não liberar ainda.** Faltam 2 passos no painel do Mercado Pago (abaixo). Sem defeito de código.

## Pendências para fechar o E2E (ações no Mercado Pago — não é código)
1. **Confirmar a URL do webhook** no MP = `https://rsvoazrkxtdrcjnatzcm.supabase.co/functions/v1/mercadopago-webhook`, com eventos de **pagamento** habilitados.
2. **Disparar "Simular notificação"** (test) no painel do MP para essa URL → eu confirmo em `edge_logs` se foi **aceita (200)** ou **rejeitada (401 = secret dessincronizado)**. Isso valida a assinatura **sem pagamento**.
3. **Pagamento de teste:** sandbox/test user (sem dinheiro real) — ou sua autorização para 1 compra real controlada — para fechar o ciclo até `status` do pedido.

---

## Migração Mercado Pago PF → PJ (decisão 27/08/2026)

**Estado atual PF:** a conta Mercado Pago integrada hoje é **Pessoa Física (CPF do sócio)** e já processou vendas reais. Secrets atuais (`MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`) pertencem a essa integração PF.

**Decisão:** **não** converter a PF para PJ. Abrir uma **nova conta Mercado Pago PJ no CNPJ da COFICO** para novas vendas.
- **MP PF = LEGACY** (não apagar, não converter, não revogar token, não mudar titularidade, não desconectar ML pessoal). Mantida para: consultar pagamentos antigos, receber webhooks atrasados, conciliar, estornos/chargebacks de vendas antigas.
- **MP PJ COFICO = conta ativa oficial** para novas vendas (nova aplicação, novo access token, novo webhook secret, possivelmente nova URL de webhook, nova identidade de seller).

**Situação técnica atual (importante):** as edge functions de pagamento **já estão deployadas** (rodada anterior, autorizada) com credenciais PF, **mas o go-live não aconteceu**: o front novo não foi pushado e a RLS bloqueia o checkout antigo → **nenhuma venda nova entra pela PF hoje**. O go-live é o push do front, que **está pausado**.

**Estratégia de coexistência (blue/green) — PLANO, não implementado:**
- **Nomes de secrets (avaliar antes de trocar):** manter os antigos como `MERCADO_PAGO_PF_LEGACY_ACCESS_TOKEN` / `..._WEBHOOK_SECRET` e criar `MERCADO_PAGO_COFICO_ACCESS_TOKEN` / `..._WEBHOOK_SECRET` — para não perder capacidade de operar/refundar pagamentos antigos. **Não renomear/mover secrets ainda.**
- **Distinção de origem no banco (avaliar, sem nomes finais):** por pagamento/pedido registrar `payment_provider`, `payment_account` (`MP_PF_LEGACY` vs `MP_COFICO_PJ`), `payment_environment`, `provider_payment_id`, `provider_preference_id`. Objetivo: saber inequivocamente a qual conta cada pagamento pertence.
- **Webhooks:** pode coexistir webhook LEGACY PF + webhook novo PJ. **Não misturar secrets** — cada webhook valida contra o secret da sua conta. Identificar a origem de forma inequívoca (ex.: `user_id`/account no payload do MP, ou URLs/rotas distintas por conta). Não substituir o secret PF antes de garantir que não há pagamentos antigos pendentes.
- **Refunds/estornos:** pagamento criado na PF → consultar/refundar com credencial **PF**; pagamento PJ → credencial **PJ**. Não presumir que o token PJ administra pagamentos antigos da PF.
- **Pagamentos em voo:** pedidos/pagamentos criados **antes do corte** ficam associados à PF; não migrar IDs antigos para a nova conta.
- **Assinaturas/recorrência:** continuam **desabilitadas**. Inventariar qualquer assinatura real antiga ligada à PF antes de qualquer troca. Fase 0 valida só `order_type = single`.
- **Links antigos:** não criar novos links na PF; links existentes = LEGACY; não desativar automaticamente até revisar pagamentos em andamento.

**Data/hora de corte:** a definir quando a conta PJ estiver pronta. Antes do corte → PF legacy; depois do corte → PJ COFICO. (A registrar aqui quando decidida.)

**Antes do go-live PJ (checklist):** 1) confirmar conta PJ; 2) criar/confirmar aplicação PJ; 3) configurar credenciais PJ (secrets, direto no ambiente seguro pelo proprietário — nunca no chat/Git/Markdown/logs/admin_settings/front); 4) configurar webhook PJ; 5) testar sandbox/test user; 6) validar assinatura do webhook; 7) validar create-payment; 8) validar idempotência; 9) validar refund de teste quando possível; 10) só então definir corte. **O E2E final da Fase 0 usará a conta PJ da COFICO**, não o token PF.

**Riscos:** trocar secret PF cedo demais quebraria consulta/refund/webhook de vendas antigas; usar token PJ para pagamento antigo falha; go-live sem PJ pronta processaria venda na PF (evitado pela pausa do push).

**Próximos passos:** aguardar o Vlademir confirmar a conta PJ criada e pronta; então executar o checklist acima e definir o corte.

### Preparação das credenciais PJ — status (28/08/2026)
Via MCP oficial do Mercado Pago:
- App PJ **confirmada:** "COFICO - CASA COFICO E-COMMERCE", AppID `3313462574827587` (única aplicação).
- Credenciais de **TESTE (sandbox):** disponíveis (Public Key + Access Token). **Produção:** **NÃO ativada** (Access Token/Public Key/Client Secret de produção vazios) → precisa completar a ativação/homologação da app no painel MP (`.../developers/panel/app/3313462574827587`). **Bloqueia** a criação do `MERCADO_PAGO_COFICO_ACCESS_TOKEN` de produção.
- **Webhook PJ:** não configurado (save interrompido pelo Vlademir — decisão pendente de URL/abordagem; a função `mercadopago-webhook` hoje valida só o secret PF, então o blue/green de código precede o go-live PJ).
- **Secrets Supabase:** PF `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` = **intactos** (confirmado por nome/digest). `MERCADO_PAGO_COFICO_*` = **não criados** (aguardando produção ativada; e a gravação do secret é ação do Vlademir — Claude não insere secrets).
- Nada alterado: sem deploy, sem push, sem código, sem tocar na conta PF, sem test user criado.

---

FASE 0 PAUSADA — AGUARDANDO MIGRAÇÃO MERCADO PAGO PARA CONTA PJ DA COFICO

(Estado: código validado localmente + RLS segura + migrations aplicadas + funções deployadas porém SEM go-live (front não pushado, checkout antigo bloqueado pela RLS → nenhuma venda nova na PF). Deploy final/go-live pausado aguardando a nova conta PJ. Sem push, sem Fase 1, sem alterar secrets, sem tocar na conta PF.)

RETOMAR SOMENTE QUANDO O VLADEMIR INFORMAR QUE A NOVA CONTA MERCADO PAGO PJ DA COFICO ESTÁ CRIADA E PRONTA PARA CONFIGURAÇÃO.
