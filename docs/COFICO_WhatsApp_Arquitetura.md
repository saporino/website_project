# WhatsApp Business da COFICO — auditoria e plano

**23/10/2026.** Auditoria do que existe e arquitetura do que falta.
**Nenhuma mensagem foi enviada. Nenhum custo novo foi gerado.**

---

## O achado que muda o plano

**O WhatsApp já está construído e está a uma migration de distância da
produção.**

| | |
|---|---|
| Migrations | **5**, todas na `main` |
| Tabelas em **staging** | `wa_contatos`, `wa_conversas`, `wa_mensagens`, `wa_numeros`, `wa_eventos` |
| Tabelas em **produção** | **nenhuma** |
| Edge Functions | `whatsapp-enviar`, `whatsapp-webhook` — na `main` |
| Tela | Central de WhatsApp no RepCo |
| Branch `wip-whatsapp` | **20 commits ATRÁS** da `main` — é resto velho, não trabalho pendente |

> O raio-X de 20/10 dizia "22 commits de WhatsApp fora da `main`". **Isso está
> superado:** o código foi incorporado. A branch sobrou para trás e pode ser
> apagada — guardá-la só cria a dúvida de "será que tem algo lá?".

---

## O que FALTAVA, e foi feito hoje

**Não existia nenhum registro de consentimento.** Nem coluna, nem tabela.

Isso não impede responder quem escreve — atendimento não precisa de
autorização prévia. **Impede mandar oferta**, que é o objetivo comercial dele:
a LGPD exige base legal e a Meta exige opt-in com origem e momento
registrados. Sem isso, a conta pode ser restringida pela própria Meta.

Criado em **staging**, testado, **não aplicado em produção**:

- `wa_consentimentos` — quem autorizou **o quê**, desde quando, por qual canal,
  e **com qual texto exato**
- `wa_consentimento_eventos` — toda mudança de estado vira registro; revogação
  não apaga linha
- `wa_pode_enviar(empresa, telefone, finalidade)` — **fail closed**: sem
  registro concedido, devolve `false`

### Por que três finalidades, e não um "aceita sim/não"

```
transacional  — confirmação de pedido, rastreio
marketing     — oferta, campanha
atendimento   — resposta a quem escreveu
```

Quem aceitou receber a confirmação do pedido **não** aceitou receber promoção.
Tratar as duas como a mesma coisa é o que gera denúncia — e é o erro mais
comum em operação de WhatsApp.

### O teste (staging, 23/10)

```
1. telefone desconhecido              -> false
2. pediu mas não confirmou            -> false
3. confirmou                          -> true
4. aceitou marketing, e transacional? -> false
5. descadastrou                       -> false
histórico: novo -> pendente | pendente -> concedido | concedido -> revogado
```

---

## Onde já captamos contato (e nenhum guarda consentimento)

| Tabela | Registros | Tem telefone | Tem consentimento |
|---|---|---|---|
| `representative_clients` | 7 | sim (contatos) | **não** |
| `user_profiles` | 6 | sim | **não** |
| `marketing_contacts` | 4 | não | **não** |
| `b2b_contatos` | 2 | sim | **não** |
| `b2b_leads` | 1 | sim | **não** |
| `cliente_contatos` | 0 | sim | — |
| `candidaturas_representante` | 0 | sim | — |

**Nenhum desses contatos pode receber oferta hoje**, e isso não é limitação do
sistema: é a lei. Eles foram cadastrados para comprar, para vender, para
trabalhar — não para receber campanha. Transformar cadastro em lista de
marketing sem pedir é exatamente o que a LGPD proíbe.

> ⚠️ **Não importe esses contatos para campanha.** O caminho certo é pedir o
> aceite — no site, no rodapé, no checkout, ou na primeira conversa.

---

## O plano, em cinco etapas

### Etapa 1 — pôr no ar o que já existe *(depende só de autorização)*
Aplicar as 5 migrations de WhatsApp + a de consentimento em produção.
Nada envia mensagem: é a caixa de entrada passando a existir.
**Aceite:** as 6 tabelas em produção e a Central abrindo sem erro.

### Etapa 2 — captar consentimento *(1-2 dias)*
Caixa de aceite no rodapé do site da COFICO, no cadastro PJ e no checkout,
**desmarcada por padrão**, com o texto gravado junto. Página de descadastro
por link, sem login.
**Aceite:** aceitar grava origem, texto, IP e momento; descadastrar grava a
revogação e `wa_pode_enviar` passa a devolver `false`.

### Etapa 3 — receber de verdade *(depende da Meta)*
Confirmar o webhook no painel da Meta e trocar a primeira mensagem real.
**Pendência conhecida e registrada:** nunca migrar o número 11 93810-0909 —
migração mata o WhatsApp Business do celular. É **Coexistência**.
**Aceite:** mensagem enviada do celular aparece na Central.

### Etapa 4 — modelos aprovados *(depende da Meta)*
Toda mensagem iniciada por nós fora da janela de 24h exige modelo aprovado.
Cadastrar: confirmação de pedido, rastreio, recuperação de carrinho, oferta.
**Aceite:** modelo aprovado pela Meta e registrado no sistema, com o custo por
categoria à vista antes do envio.

### Etapa 5 — envio comercial *(só depois de 2, 3 e 4)*
Disparo em lote, **sempre** passando por `wa_pode_enviar`, com limite diário e
registro de custo por mensagem.
**Aceite:** tentativa de envio a quem não consentiu é recusada e registrada.

---

## O que depende dele, não de código

1. **Aplicar as migrations em produção** — autorização
2. **Confirmar o webhook no painel da Meta** — acesso
3. **Cadastrar os modelos** — aprovação da Meta leva dias
4. **Decidir o texto do aceite** — é promessa ao cliente, não decisão técnica
5. **Aprovar o custo** — mensagem iniciada por nós é paga, por categoria

---

## O que eu NÃO fiz, de propósito

- Não enviei mensagem nenhuma
- Não importei contato para campanha
- Não apliquei nada em produção
- Não mexi na conta Meta
- Não ativei cobrança

E não apaguei a branch `wip-whatsapp`, embora esteja obsoleta: apagar ramo é
irreversível sem o reflog, e a decisão é dele.
