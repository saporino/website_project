# Roteamento de pagamento por empresa faturadora

**Data:** 06/09/2026
**Projeto Supabase:** `rsvoazrkxtdrcjnatzcm`
**Regra que passa a valer:** quem recebe o dinheiro é a **empresa que vende e fatura**, nunca a marca do produto.

---

## 1. Regra final: canal → empresa faturadora

| Canal | Empresa faturadora | CNPJ | Conta que recebe |
|---|---|---|---|
| `cafesaporino.com.br` | Café Saporino Ltda | 61.109.694/0001-94 | Mercado Pago Saporino (`2920329655`) |
| `coficobrasil.com.br` (Casa Cofico) | V. Medeiros de Santi Ltda | 66.006.929/0001-36 | Mercado Pago COFICO (`3644982719`) |
| `localhost`, preview da Vercel | Café Saporino Ltda | — | Saporino (decisão explícita de desenvolvimento) |
| qualquer outro domínio | **nenhuma** | — | pedido recusado |

**A marca não entra nessa conta.** Tropeiro Paulista e Café Serrão são marcas da Saporino, não empresas. Casa Cofico é canal da COFICO, não empresa. Café Fazendinha é empresa separada, mas quando a COFICO vende Fazendinha nos canais dela, quem fatura e recebe é a COFICO.

O mesmo produto muda de recebedor conforme onde é vendido:

| Produto | Vendido em | Recebe |
|---|---|---|
| Café Saporino | site da Saporino | Saporino |
| Café Saporino | Casa Cofico | COFICO |
| Tropeiro Paulista | site da Saporino | Saporino |
| Tropeiro Paulista | Casa Cofico | COFICO |
| Café Fazendinha | Casa Cofico | COFICO |

## 2. Fonte da verdade no pedido

`orders.seller_company_id` → referência para `companies.id`.

O domínio decide **uma vez**, na criação do pedido, a partir do header `Origin` posto pelo navegador. Depois disso nenhum passo volta a olhar o domínio: `create-payment` lê a empresa gravada no pedido. O corpo da requisição não escolhe a empresa, porque o corpo é controlado pelo cliente.

Duas colunas de auditoria guardam para onde o dinheiro foi roteado:

- `orders.mp_account_key` — conjunto de credenciais usado.
- `orders.mp_collector_id` — `collector_id` devolvido pelo Mercado Pago, prova de qual conta recebeu.

E `orders.channel` passou a registrar `site-saporino` ou `casa-cofico`, para leitura humana. Ele **não** tem autoridade sobre o recebedor.

## 3. Mapa empresa → credencial

O elo é `companies.payment_account`, um nome de conjunto. O valor do segredo nunca fica no banco.

| Empresa | `payment_account` | Access token | Segredo de webhook | Pode receber |
|---|---|---|---|---|
| Café Saporino Ltda | `saporino` | `MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN`, hoje ainda `MERCADO_PAGO_ACCESS_TOKEN` | `MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET`, hoje ainda `MERCADO_PAGO_WEBHOOK_SECRET` | sim |
| V. Medeiros de Santi (COFICO) | `cofico` | `MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN` | `MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET` | sim |
| Café Fazendinha Ltda | `NULL` | — | — | **não** |

Fazendinha fica sem credencial de propósito: hoje quem vende Fazendinha é a COFICO. Se um dia a própria Fazendinha faturar direto, ela ganha credencial e o campo é preenchido.

**Não existe conta padrão.** O comportamento antigo, em que a ausência de informação caía em Saporino, foi removido.

## 4. Public key por domínio

O checkout usa o **Wallet por redirecionamento**. Nesse fluxo a chave pública **não decide o recebedor**: quem decide é a preferência, criada com a credencial da empresa faturadora. Isso foi verificado na prática, renderizando o Wallet com a chave publicada e preferências das duas contas: as duas renderizaram.

Ainda assim a configuração correta por domínio foi implementada, porque no dia em que o checkout usar campos de cartão na própria página, chave e preferência de contas diferentes passam a quebrar o pagamento.

`src/lib/sellerCompany.ts` resolve a chave pelo domínio, nesta ordem:

1. `VITE_MERCADO_PAGO_PUBLIC_KEY_COFICO` no domínio da COFICO
2. `VITE_MERCADO_PAGO_PUBLIC_KEY_SAPORINO` no domínio da Saporino
3. `VITE_MERCADO_PAGO_PUBLIC_KEY` como valor de transição

**Estado atual, para ser claro:** só a variável antiga existe na Vercel, então hoje os dois domínios carregam a mesma chave. Isso não desvia dinheiro, pelo motivo acima, mas é dívida. Para encerrar, criar na Vercel as duas variáveis por empresa e remover a antiga.

---

## Provas executadas, sem dinheiro real

Cada cenário criou um pedido pelo `create-checkout-order` com o `Origin` do domínio correspondente, chamou `create-payment` e conferiu o `collector_id` devolvido pelo Mercado Pago.

### 5 a 8. Roteamento correto

| Cenário | Empresa gravada | Collector | Confere |
|---|---|---|---|
| Café Saporino no site da Saporino | Café Saporino Ltda (CS) | `2920329655` | sim |
| Tropeiro Paulista no site da Saporino | Café Saporino Ltda (CS) | `2920329655` | sim |
| Café Saporino na Casa Cofico | V. Medeiros de Santi (CO) | `3644982719` | sim |
| Café Fazendinha na Casa Cofico | V. Medeiros de Santi (CO) | `3644982719` | sim |

Como o catálogo só tinha um produto ativo, os cenários de marca foram refeitos ativando temporariamente o Tropeiro Paulista e criando um Café Fazendinha de teste, **ambos ocultos da vitrine**, com reversão exata ao final. Isso tornou a prova de independência da marca real:

| Cenário cruzado | Collector |
|---|---|
| Tropeiro Paulista no site da Saporino | Saporino |
| Tropeiro Paulista na Casa Cofico | COFICO |
| Café Fazendinha na Casa Cofico | COFICO |
| Café Fazendinha no site da Saporino | Saporino |

A mesma marca em canais diferentes cai em contas diferentes. É exatamente a regra pedida.

### 9. Fail closed sem empresa

Pedido gravado com `seller_company_id` nulo:

```
HTTP 422 · code NO_SELLER_COMPANY
"Pedido sem empresa faturadora definida."
nenhuma preferência criada
```

### 10. Fail closed sem credencial

Pedido faturado pela Café Fazendinha, que não tem `payment_account`:

```
HTTP 503 · code SELLER_WITHOUT_CREDENTIAL
"A empresa Café Fazendinha Ltda nao tem meio de recebimento configurado.
 O pagamento nao foi roteado para outra empresa."
nenhuma preferência criada
```

### Extra: domínio desconhecido

```
HTTP 400 · code UNKNOWN_SALES_CHANNEL
```

O pedido nem chega a nascer. Melhor recusar do que gravar a empresa errada e faturar no CNPJ errado.

### Webhook

Endpoint único mantido. A assinatura é conferida contra **cada** segredo configurado, e a conta que assinou é a que manda no resto do processamento. HMAC não foi enfraquecido:

| Cenário | COFICO | Saporino |
|---|---|---|
| Assinatura válida | 200 | 200 |
| Assinatura inválida | 401 | 401 |
| Sem assinatura | 401 | 401 |

---

## 11. Arquivos alterados

**Criados**
- `supabase/migrations/20260906100000_pedido_empresa_faturadora.sql`
- `src/lib/sellerCompany.ts`
- este documento

**Alterados**
- `supabase/functions/_shared/mpCredentials.ts` — resolve credencial por conjunto da empresa; `empresaPorDominio` decide só na criação; sem conta padrão
- `supabase/functions/create-payment/index.ts` — lê a empresa do pedido, fail closed nos dois casos, grava conta e collector
- `supabase/functions/create-checkout-order/index.ts` — grava empresa faturadora e canal a partir do `Origin`
- `src/lib/mercadopago.ts` — chave pública por domínio
- `src/components/SubscriptionCheckout.tsx` — o pedido de assinatura passa a nascer com empresa faturadora

## 12. Deploys

`create-checkout-order`, `create-payment` e `mercadopago-webhook` (sempre com `--no-verify-jwt`). Migration aplicada pelo processo oficial do CLI. Frontend publicado por push em `main`.

## 13. Testes

| Bloco | Resultado |
|---|---|
| Roteamento e fail closed | 8 de 8 |
| Independência de marca | 5 de 5, com reversão do catálogo confirmada |
| Unidade (`vitest`) | 35 de 35 |
| `typecheck` e `build` | limpos |

Ao final, zero pedidos no banco e catálogo idêntico ao estado anterior. Nenhuma cobrança foi feita.

## 14. Riscos remanescentes

1. **Uma única chave pública na Vercel.** Os dois domínios carregam a mesma. Não desvia dinheiro no fluxo de redirecionamento, mas precisa ser separado antes de qualquer checkout com cartão na própria página.
2. **Secrets da Saporino ainda com nome genérico.** `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` são reconhecidos como Saporino por convenção do código. Renomear exige quem tem o valor, porque o CLI não lê segredo.
3. **`seller_company_id` é anulável no banco.** A obrigatoriedade está nos dois únicos caminhos que criam pedido e no `create-payment`. Deixei anulável para manter o fail closed testável. Vale tornar obrigatório depois dos primeiros pedidos reais.
4. **Casa Cofico ainda não tem checkout.** O roteamento está pronto e provado, mas nenhuma tela vende lá hoje.
5. **Numeração do B2C usa maior número mais um.** Um número liberado por exclusão é reaproveitado. A restrição de unicidade impede duplicata, mas não é uma sequência de verdade.
6. **A grafia do manifest do webhook segue aceitando duas formas.** Só um pagamento real dirá qual é a correta.

---

*Nada de pagamento real, split, Coffee Network payments, marketplace financeiro ou Slice 002 foi iniciado neste ciclo.*
