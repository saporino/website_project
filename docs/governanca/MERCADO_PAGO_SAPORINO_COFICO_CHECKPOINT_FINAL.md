# Mercado Pago — Saporino + COFICO · checkpoint final

**Data:** 05/09/2026 · **Projeto:** `rsvoazrkxtdrcjnatzcm`
**Sem pagamento real neste ciclo.**

---

## Placar

| # | Item | Situação |
|---|---|---|
| 1 | Conta Saporino validada | **SIM** |
| 2 | Conta COFICO validada | **SIM** |
| 3 | Secrets Saporino corretos | **SIM** |
| 4 | Secrets COFICO corretos | **SIM** |
| 5 | Public Key Saporino correta | **SIM** |
| 6 | Public Key COFICO correta | **SIM** |
| 7 | Roteamento de produto | **SIM** |
| 8 | Roteamento de serviço | **SIM** |
| 9 | Assinaturas | **infraestrutura pronta, recorrência não implementada** |
| 10 | Webhook nas duas contas | **SIM** |
| 11 | Nomes genéricos | **REMOVIDOS** |
| 12 | Bloqueio humano | **nenhum** |
| 13 | Teste real | **necessário, e é o único passo que falta** |

---

## 1 e 2. Identidade das duas contas

Provado por `users/me`, sem expor valor:

| | Saporino | COFICO |
|---|---|---|
| Conta | `2920329655` | `3644982719` |
| Apelido | `CAFESAPORINO` | `CASACOFICO` |
| Documento | CNPJ `61***94` | CNPJ `66***36` |
| Ambiente | produção | produção |
| Situação | ativa | ativa |

Bate com Café Saporino Ltda (61.109.694/0001-94) e V. Medeiros de Santi Ltda (66.006.929/0001-36).

## 3 e 4. Secrets

Restam exatamente quatro, todos com dono no nome:

```
MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN
MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET
MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN
MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET
```

**Ficou provado que os nomes genéricos eram da Saporino.** O `MERCADO_PAGO_ACCESS_TOKEN` apontava para a mesma conta `2920329655` do token nomeado, e o `MERCADO_PAGO_WEBHOOK_SECRET` tinha a **mesma impressão de hash** do segredo nomeado da Saporino, ou seja, o mesmo valor. Nenhuma credencial se perdeu na troca de nome.

## 5 e 6. Public keys

O bundle publicado carrega as duas, escolhidas por domínio em tempo de execução:

| Variável | Chave | Domínio |
|---|---|---|
| `VITE_MERCADO_PAGO_PUBLIC_KEY_SAPORINO` | `APP_USR-9aa999fe…` | `cafesaporino.com.br` |
| `VITE_MERCADO_PAGO_PUBLIC_KEY_COFICO` | `APP_USR-051b1f01…` | `coficobrasil.com.br` |

A variável única `VITE_MERCADO_PAGO_PUBLIC_KEY` não aparece mais no bundle e o código não a lê. Domínio desconhecido fica sem chave.

Registrado de propósito: no fluxo atual, com Wallet por redirecionamento, a chave pública **não** define o recebedor. Quem define é a preferência. A separação por domínio existe para o dia em que o checkout tiver campos de cartão na própria página.

## 7 e 8. Roteamento de produto e serviço

Todos criaram pedido pelo `create-checkout-order` com o `Origin` do domínio, chamaram `create-payment` e conferiram o `collector_id` devolvido pelo Mercado Pago.

| Teste | Faturadora gravada | Collector |
|---|---|---|
| A · produto no site da Saporino | Café Saporino Ltda | `2920329655` |
| B · produto na Casa Cofico | V. Medeiros de Santi | `3644982719` |
| C · serviço no site da Saporino | Café Saporino Ltda | `2920329655` |
| D · serviço na Casa Cofico | V. Medeiros de Santi | `3644982719` |
| E · assinatura no site da Saporino | Café Saporino Ltda | `2920329655` |
| F · assinatura na Casa Cofico | V. Medeiros de Santi | `3644982719` |
| G · pedido sem empresa | — | **422**, sem preferência |
| H · empresa sem credencial | Café Fazendinha | **503**, sem preferência |

O serviço foi um produto temporário oculto da vitrine, removido ao final. Não existe entidade "serviço" separada no sistema: serviço percorre o mesmo caminho de pedido, e por isso obedece à mesma regra.

## 9. Assinaturas

**Infraestrutura de conta pronta; fluxo de recorrência não implementado.**

O que existe: pedido com `order_type = 'subscription'`, criado pelo checkout de assinatura, com empresa faturadora gravada e cobrança do primeiro ciclo roteada para a conta certa. Provado nos testes E e F.

O que **não** existe: cobrança recorrente automática. Não há integração com `preapproval` do Mercado Pago, nem webhook de planos, nem ciclo de renovação. Uma assinatura hoje cobra uma vez.

## 10. Webhook

Endpoint único, com a assinatura conferida contra cada segredo configurado e a conta que assinou registrada.

| | Saporino | COFICO |
|---|---|---|
| Assinatura válida | 200 | 200 |
| Assinatura inválida | 401 | 401 |
| Sem assinatura | 401 | 401 |

**Uma regressão minha foi encontrada e corrigida neste ciclo.** Ao reescrever o resolvedor de credenciais por empresa, renomeei o campo `account` para `accountKey` e o webhook continuou lendo `s.account`. O efeito: a assinatura batia, o valor lido era `undefined`, e a notificação era recusada com 401. **Toda notificação legítima teria sido rejeitada** desde aquele deploy. Corrigido e reprovado nas duas contas.

## 11. Limpeza

Removidos:

- secret `MERCADO_PAGO_ACCESS_TOKEN`
- secret `MERCADO_PAGO_WEBHOOK_SECRET`
- função temporária `mp-audit`, do Supabase e do repositório

Depois da remoção, a bateria foi reexecutada inteira: **10 de 10**, com o webhook ainda fail closed verificado de fora. As funções ativas caíram de 28 para 27.

A variável `VITE_MERCADO_PAGO_PUBLIC_KEY` já não é injetada no build. Se ela ainda aparecer no painel da Vercel, pode ser apagada com segurança.

## 12. Bloqueio humano

Nenhum. Tudo que dependia de você já está configurado.

## 13. Teste real

É o único passo que falta, e ele ainda importa por dois motivos concretos. Confirma qual grafia do manifesto o Mercado Pago realmente usa, já que a verificação hoje aceita as duas por segurança. E confirma o caminho completo até o pedido virar `approved`, que nenhum teste sem dinheiro alcança.

---

# MERCADO PAGO SAPORINO + COFICO = READY FOR REAL TEST

**Passo a passo, quando você quiser:**

1. Abra `cafesaporino.com.br` numa aba anônima e coloque um produto no carrinho.
2. Finalize o checkout com nome, e-mail e endereço.
3. Pague por **PIX**.
4. Confira no Mercado Pago da **Saporino**, em Atividade, que o valor entrou.
5. Confira no painel, em Pedidos, que o pedido está `approved` com data de pagamento.

Para provar a COFICO pelo mesmo caminho é preciso um checkout na Casa Cofico, que ainda não existe. O roteamento dela já está provado tecnicamente.

**O que faço depois, automaticamente:** confirmo a grafia do manifesto usada de verdade, removo a variante que sobrar, e registro o resultado.

---

## Riscos remanescentes

1. **Casa Cofico não tem checkout.** O roteamento está pronto e provado, mas nenhuma tela vende lá.
2. **Recorrência de assinatura não existe.** Ver item 9.
3. **`seller_company_id` é anulável no banco.** A obrigatoriedade está nos dois caminhos que criam pedido e no `create-payment`. Vale tornar obrigatório depois dos primeiros pedidos reais.
4. **Numeração do B2C usa maior número mais um.** Número liberado por exclusão é reaproveitado; a unicidade impede duplicata, mas não é uma sequência.
5. **A grafia do manifesto segue com duas variantes aceitas** até o primeiro pagamento real.
6. **A função de autoteste do webhook foi removida.** Se precisar dela de novo, está no histórico do git.
