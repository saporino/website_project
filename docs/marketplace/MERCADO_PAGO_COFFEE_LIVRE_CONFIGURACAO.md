# Mercado Pago do Coffee LiVRE — configuração operacional

**Atualizado em:** 17/09/2026 (Unidade 9.2)
**Regra que vale:** a integração do Coffee LiVRE é **tecnicamente isolada**, mas vive **dentro da mesma conta empresarial** já existente. Nenhuma conta nova foi criada.

---

## 1. Identidade corporativa (fonte da verdade)

| | |
|---|---|
| Razão social | **V. MEDEIROS DE SANTI LTDA** — CNPJ 66.006.929/0001-36 |
| Nome fantasia / marca | **COFICO BRASIL** |
| CASA COFICO | nome da **operação/loja comercial** (canal `coficobrasil.com.br`). **Não** é razão social |
| Coffee LiVRE | **marketplace próprio** da COFICO, em `coficobrasil.com.br/coffeelivre` e, no futuro, `coffeelivre.com.br`. **Não** é loja dentro do Mercado Livre |
| COFICO Commerce Hub | aplicação da COFICO na **API oficial do Mercado Livre** (Client ID público `2640237926792746`). Nada a ver com Mercado Pago nem com o Coffee LiVRE |

## 2. Aplicações Mercado Pago da conta

| Aplicação | App ID | Para que serve | Status |
|---|---|---|---|
| **COFFEE LIVRE MARKETPLACE** | `1253195083115612` | marketplace do Coffee LiVRE (Split 1:1) | criada em 17/09/2026 |
| COFICO - CASA COFICO E-COMMERCE | `3313462574827587` | loja CASA COFICO | **não tocar** |

**Configuração da aplicação do Coffee LiVRE, confirmada no portal:** solução Pagamentos online · plataforma de e-commerce: não · produto Checkout Transparente · API de Pagamentos · **PKCE: sim** · escopos `read`, `write`, `offline_access` · Redirect URL `https://coficobrasil.com.br/coffeelivre/vendedor/mp/callback`.

Nenhuma credencial da CASA COFICO é reutilizada, e o código não tem fallback para `MERCADO_PAGO_COFICO_*`.

## 3. Rota de retorno do OAuth (canônica)

```
https://coficobrasil.com.br/coffeelivre/vendedor/mp/callback
```

- Tela: `src/pages/coffeelivre/vendedor/RetornoDoMercadoPago.tsx`, roteada pelo Seller Central.
- O servidor **recusa iniciar** a conexão se a Redirect URL configurada não for exatamente esse caminho (`REDIRECT_URI_INVALIDA`), porque o Mercado Pago exige `redirect_uri` idêntico ao cadastrado.
- Compatibilidade: se um link antigo voltar com `?code=&state=` em `vendedor/financeiro`, a tela antiga ainda conclui a conexão.

## 4. Segredos (nomes, nunca valores)

Namespace exclusivo do Coffee LiVRE, sem fallback:

| Segredo | Ambiente de teste | Produção |
|---|---|---|
| `LV_MP_TESTE_CLIENT_ID` / `LV_MP_PRODUCAO_CLIENT_ID` | App ID `1253195083115612` (valor público) | pendente |
| `LV_MP_TESTE_CLIENT_SECRET` / `LV_MP_PRODUCAO_CLIENT_SECRET` | **pendente** | pendente |
| `LV_MP_TESTE_REDIRECT_URI` / `LV_MP_PRODUCAO_REDIRECT_URI` | rota canônica acima | pendente |
| `LV_MP_TESTE_WEBHOOK_URL` / `LV_MP_PRODUCAO_WEBHOOK_URL` | `https://mzfnhljphcjpqtuesjci.supabase.co/functions/v1/lv-mp-webhook` | pendente |
| `LV_MP_TESTE_WEBHOOK_SECRET` / `LV_MP_PRODUCAO_WEBHOOK_SECRET` | **pendente** (gerada no portal) | pendente |
| `LV_MP_TESTE_PUBLIC_KEY` / `LV_MP_PRODUCAO_PUBLIC_KEY` | **pendente** | pendente |
| `LV_MP_AMBIENTE` | `teste` (já configurado no staging) | não configurar ainda |

Gravação (o valor é digitado no prompt do CLI, nunca no chat nem no Git):

```
npx supabase secrets set LV_MP_TESTE_CLIENT_SECRET --project-ref mzfnhljphcjpqtuesjci
```

Produção (`rsvoazrkxtdrcjnatzcm`) continua **sem nenhum segredo `LV_MP_*`**, sem funções `lv-mp-*` e com pagamento online desativado.

## 5. Webhook

- **URL definitiva (staging):** `https://mzfnhljphcjpqtuesjci.supabase.co/functions/v1/lv-mp-webhook`
- Publicada sempre com `--no-verify-jwt`, porque quem chama é o Mercado Pago, sem JWT do Supabase.
- **Validação:** cabeçalho `x-signature` (`ts` e `v1`), manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256 em hexadecimal, conferido contra `LV_MP_*_WEBHOOK_SECRET`. Aceita o manifest com e sem o `;` final e **recusa** (fail closed) quando não bate.
- Evento gravado em `lv_mp_webhook_eventos`, deduplicado por (provedor, `x-request-id`). O corpo não é fonte da verdade: o pagamento é consultado em `GET /v1/payments/{id}`.
- **Limitação oficial conhecida:** pagamentos criados com credencial de teste **não** geram notificação. Por isso o painel também consulta o pagamento a cada 5 s, e a reconciliação existe.

## 6. Ordem das próximas ações

1. Gerar **Client Secret** e **Public Key** da aplicação COFFEE LIVRE MARKETPLACE (credenciais de **teste**) e gravar como secrets.
2. Cadastrar a **URL de notificação** (webhook) na aplicação e gerar a **chave secreta** dele.
3. Trocar `provedor_staging` para `mercadopago` em `lv_pagamentos_config`.
4. Criar contas de teste (Vendedor, Comprador) para o fluxo multi-seller.
5. Só depois disso: decisão do PM sobre produção, KYC nível 6 e secrets `LV_MP_PRODUCAO_*`.
