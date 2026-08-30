# BASELINE STATUS — TASK 001
**Data:** 29/08/2026 · **Objetivo:** congelar o estado conhecido, versionar governança e isolar a Fase 0/pagamento (pausada) do Site Sprint.

## Branches (histórico limpo/auditável)
| Branch | Papel | Deploy (Vercel) |
|---|---|---|
| `main` | produção institucional (site COFICO + docs) | **SIM** (auto-deploy no push) |
| `cofico-brasil` | trabalho institucional / Site Sprint (empurra p/ `main`) | via `main` |
| `fase0-pagamento` | **Fase 0/checkout/pagamento — PAUSADA** (não mergear até MP PJ) | **NÃO** |

## O que está em `fase0-pagamento` (isolado, não deployado)
Commit único de isolamento (25 arquivos):
- **Edge functions:** `create-checkout-order` (novo), `create-payment` (preço server-side + idempotência), `mercadopago-webhook` (assinatura obrigatória + idempotência), `sync-tracking` (gate + creds→env), `send-password-reset` (rate-limit).
- **Shared:** `_shared/pricing.ts`, `_shared/mpWebhook.ts`, `_shared/log.ts`, `_shared/rateLimit.ts` (+ testes `pricing.test`, `mpWebhook.test`, `leadMatch.test`).
- **Front:** `App.tsx` (checkout anônimo via create-checkout-order), `PaymentPages.tsx` (read-only), `SubscriptionCheckout.tsx` (assinatura desabilitada), `CustomersManagement.tsx` (botão aniversário neutralizado), `RepCoNewOrder.tsx` (remoção de código morto).
- **Infra de teste:** `vitest.config.ts`, `package.json`/`package-lock.json` (vitest), `tsconfig.app.json` (exclui testes).
- **Migrations (4):** `20260827120000` admin_settings+user_addresses · `20260827120500` edge_rate_limits+check_rate_limit+edge_logs · `20260827121000` order_public_token_hash+get_order_public · `20260827121500` orders RLS lockdown.

## ⚠️ Divergência schema-em-produção × fonte (resolvida no versionamento, NÃO revertida)
As **4 migrations acima JÁ ESTÃO APLICADAS no banco de PRODUÇÃO** (via exec_migration, confirmadas em runtime). Agora estão **versionadas** em `fase0-pagamento`. **Não foram revertidas** — o banco permanece exatamente como está; apenas o rastro/fonte passou a existir no git. Ao finalizar a Fase 0 (merge de `fase0-pagamento`), essas migrations entram em `main` e o schema fica 100% documentado.

## Estado de produção (Mercado Pago / checkout)
- Edge functions **novas deployadas** (via CLI) na conta Supabase; **front NÃO deployado** (não está em `main`) → **nenhuma venda B2C flui** no site (checkout antigo bloqueado pela RLS). **Sem go-live.**
- MP: PF legacy intacta; **PJ COFICO (app 3313462574827587) com produção NÃO ativada**; secrets `MERCADO_PAGO_COFICO_*` não criados. **Fase 0 permanece PAUSADA** até isso.

## Decisões de arquitetura vigentes (C1/C2 — RESOLVIDAS)
- **C1:** **RepCo = System of Record** do núcleo (CUSTOMER_IDENTITY, COMMERCIAL_ACCOUNT, catálogo mestre, PRODUCT/VARIANT/SKU, Inventory Core/Ledger, reservas, disponibilidade, registro consolidado de pedidos, inteligência operacional). **E-CoHub = orquestrador de e-commerce** (marketplaces/Bling/eventos) que **escreve os fatos de volta no RepCo**. → o mapa de propriedade do Plano V2.2 é atualizado para refletir isso.
- **C2:** modelo de cliente = **CUSTOMER_IDENTITY (por CNPJ/CPF) + COMMERCIAL_ACCOUNT (por empresa)**, superando o `customers` simples do V2.2. Mesmo CNPJ pode ter contas Fazendinha/Saporino/COFICO separadas (crédito/preço/prazo/comissão/pedidos/faturamento isolados); só dados cadastrais seguros são reaproveitáveis.

## Documentos versionados nesta baseline
- `docs/governanca/PLANO_MESTRE_UNIFICADO_V2.2.md`
- `docs/governanca/REPCO_COFICO_FULL_SYSTEM_XRAY_BEFORE_GOVERNANCE_LOGISTICS.md`
- `docs/governanca/MASTER_TASK_LIST_REPCO_COFICO_V1.md`
- `docs/governanca/MASTER_TASK_LIST_VALIDATION_REPORT_V1.md`
- `docs/specs/E-COHUB_MASTER_SPEC_CLAUDE_V4.md`
- `docs/specs/SAPORINO_AI_BOT_MASTER_SPEC_COMPLETO_V4.md`
- `docs/REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.md` (relatório da Fase 0)

## Regra de segurança do baseline
Antes de qualquer operação **destrutiva/merge/perda de trabalho**: PARAR. Não reverter migrations aplicadas só para limpar git. Fase 0 só sai da branch com aprovação (após MP PJ + E2E).
