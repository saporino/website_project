# REPCO / COFICO — PÓS-SLICE 001 · MERCADO PAGO · PILOTO · CHECKPOINT

**Data:** 05/09/2026
**Baseline:** `REPCO_COFICO_COFFEE_NETWORK_VERTICAL_SLICE_001_CHECKPOINT.md`
**Projeto Supabase:** `rsvoazrkxtdrcjnatzcm` · **Branch:** `cofico-brasil` → `main`

Classificação: **DONE REAL** (feito e provado), **PARTIAL**, **BLOCKED**, **HUMAN ACTION REQUIRED**, **NOT STARTED**.

Nada é marcado como pronto sem evidência executável. Onde a prova é uma resposta HTTP, ela está transcrita.

---

## Placar

| # | Item | Situação |
|---|---|---|
| 1 | Saneamento `company_order_counters` | **DONE REAL** |
| 2 | Saneamento `invoices` | **DONE REAL** |
| 3 | Saneamento `chat-media` | **DONE REAL** |
| 4 | Arquivos órfãos | **DONE REAL** (detecção; remoção é ato deliberado) |
| 5 | Dados TESTE VS001 | **DONE REAL** |
| 6 | Secrets Mercado Pago encontrados | **DONE REAL** |
| 7 | Secrets antigos | **BLOCKED** — são a credencial viva da Saporino |
| 8 | Secrets novos COFICO | **HUMAN ACTION REQUIRED** |
| 9 | Edge Functions afetadas | **DONE REAL** |
| 10 | Webhook | **DONE REAL** |
| 11 | HMAC | **DONE REAL** — defeito real corrigido |
| 12 | Testes sem dinheiro | **DONE REAL** |
| 13 | Secrets removidos | **NOT STARTED** — depende do item 8 |
| 14 | Secrets preservados | **DONE REAL** |
| 15 | Pendência de teste real | **HUMAN ACTION REQUIRED** |
| 16 | Piloto real pronto? | **DONE REAL** |
| 17 | Checklist do produtor | **DONE REAL** |
| 18 | Checklist do comprador | **DONE REAL** |
| 19 | Case Log | **DONE REAL** |
| 20 | Métricas | **DONE REAL** |
| 21 | Arquivos alterados | **DONE REAL** |
| 22 | Migrations | **DONE REAL** |
| 23 | Deploys | **DONE REAL** |
| 24 | Testes | **DONE REAL** |
| 25 | Riscos remanescentes | registrados |
| 26 | Próximo gate recomendado | definido |

---

## 1. `company_order_counters` — DONE REAL

Era a única tabela do schema sem RLS, e `anon` e `authenticated` tinham **todos** os privilégios, inclusive `DELETE` e `TRUNCATE`. Zerar essa tabela faz a numeração de pedido voltar do 1 e repetir número já emitido. Isso é problema fiscal, não estético.

A escrita legítima vem de um lugar só: o trigger `generate_repco_order_number`. Ele era `SECURITY INVOKER`, logo rodaria com o papel do representante e seria barrado pela RLS. Passou a `SECURITY DEFINER`.

**Provas.** Numeração, com rollback garantido dentro da transação:

```
numero gerado = CS-00004 · contador antes = 3 · contador depois = 4
apos o rollback: contador = 3 · pedidos = 3
```

Escrita direta, com JWT real de um usuário não administrador:

| Operação | Resultado |
|---|---|
| `SELECT` como não-admin | 0 linhas (admin vê 2) |
| `UPDATE` | HTTP 403 |
| `DELETE` | HTTP 403 |
| `INSERT` | HTTP 403 |

**GATE A1: verde.**

## 2. `invoices` — DONE REAL

Qualquer autenticado lia qualquer documento fiscal. Uma regra por prefixo de caminho seria frágil, porque os caminhos são heterogêneos: `nf/`, `boleto/`, `comprovante/`, `canhoto/`, `commissions/`, `serasa/` e `<order_id>/`.

A regra adotada é outra e vale para qualquer prefixo, hoje e no futuro: **você lê o arquivo se ele estiver referenciado numa linha que já é sua**. A função `public.can_access_invoice_file(name)` cobre pedidos do representante, parcelas, comissões, repasses, o PDF de Serasa do cliente e o pedido B2C do próprio usuário, comparando por sufixo, porque o banco às vezes guarda o caminho e às vezes a URL antiga.

**Provas**, com um arquivo vinculado a um cliente de um representante que **não** é administrador:

| Quem | `can_access_invoice_file` | Signed URL |
|---|---|---|
| Representante dono | `true` | HTTP 200 |
| Terceiro autenticado | `false` | HTTP 400 |
| Administrador | `true` | HTTP 200 |
| Arquivo órfão, representante | — | HTTP 400 |
| Arquivo órfão, administrador | — | HTTP 200 |

**GATE A2: verde.** O usuário A não lê a nota do B.

## 3. `chat-media` — DONE REAL

O bucket já era privado, mas qualquer autenticado abria a mídia de qualquer conversa, porque o caminho era `<user_id>/<arquivo>` e não dizia a que conversa o arquivo pertencia.

O caminho passou a ser `<conversation_id>/<user_id>/<arquivo>`. Com a conversa no caminho, a policy usa `public.is_chat_member`. Os dois anexos antigos foram movidos e as mensagens atualizadas. A função `chat-upload` passou a exigir `conversation_id` e a validar a participação antes de gravar.

**Provas:**

| Quem | Signed URL da mídia |
|---|---|
| Participante da conversa | HTTP 200 |
| Terceiro autenticado | HTTP 400 |
| Administrador | HTTP 200 |

Terceiro tentando enviar anexo para conversa alheia: `HTTP 403 {"error":"voce nao participa desta conversa"}`.

**GATE A3: verde.**

## 4. Arquivos órfãos — DONE REAL (detecção)

Apagar pedido, cliente ou visita remove as linhas, mas não os arquivos: `ON DELETE CASCADE` não alcança o Storage.

Construído: a view `vw_storage_references` com todas as colunas que apontam para arquivo, as funções `storage_orphans()` e `storage_orphans_summary()`, a tabela `storage_cleanup_log` e a edge `storage-cleanup`, que **exige administrador**, roda em **dry-run por padrão**, ignora arquivo recente, limita o lote e registra até a simulação.

**A simulação pegou dois erros meus antes de qualquer exclusão.** Primeiro, a lista de referências estava incompleta: faltavam `studio_videos.storage_path`, `audio_path`, `thumbnail_path` e outras, e 19 vídeos em uso apareceram como órfãos. Segundo, a comparação era só num sentido, e caminhos gravados de forma parcial não casavam. Corrigidos os dois. É exatamente por isso que a limpeza nasce em dry-run.

**Estado atual:** 42 candidatos reais. Nenhum arquivo foi apagado — o Storage tinha 86 objetos antes e depois; hoje tem 85, e a diferença é a mídia do teste, removida no item 5.

| Bucket | Órfãos | Total |
|---|---|---|
| `product-images` | 20 | 45 |
| `studio-videos` | 12 | 19 |
| `invoices` | 8 | 8 |
| `carrier-logos` | 1 | 5 |
| `representative-docs` | 1 | 2 |
| demais | 0 | — |

Não-admin chamando a limpeza: `HTTP 403 {"error":"apenas administrador pode rodar a limpeza"}`.

**GATE A4: verde.** Existe mecanismo auditável para detectar e remover órfãos sem apagar arquivo válido. A remoção continua sendo ato deliberado, com `dry_run:false`.

## 5. Dados TESTE VS001 — DONE REAL

Inventário antes de apagar: 2 participantes, 3 papéis, 1 propriedade, 2 relações comerciais, 1 oferta, 1 foto, 1 solicitação, 1 match, 1 arquivo de mídia.

Tudo removido. Resíduo zero:

```
fotos 0 · midia 0 · papeis 0 · matches 0 · ofertas 0
relacoes 0 · entidades 0 · propriedades 0 · solicitacoes 0
```

**Uma exceção deliberada:** os 11 eventos de `network_audit_log` foram **preservados**. São o registro histórico do que aconteceu, não dado de teste, e apagar trilha de auditoria é um mau precedente. A evidência do slice está no checkpoint anterior.

---

## 6. Secrets Mercado Pago encontrados — DONE REAL

| Secret | Onde é lido | Origem provada | Situação |
|---|---|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | `create-payment`, `mercadopago-webhook` | **Conta PJ da Café Saporino** | ativo |
| `MERCADO_PAGO_WEBHOOK_SECRET` | `mercadopago-webhook` | par do token acima | ativo |
| `MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET` | passou a ser lido nesta fase | COFICO | ativo, sem par |
| `VITE_MERCADO_PAGO_PUBLIC_KEY` | frontend, build | Saporino | ativo |

Havia uma **quarta** origem possível: `admin_settings.mercado_pago_access_token`, no banco, com precedência sobre o secret. Estava nula, mas era um caminho que sobreporia a credencial sem ninguém perceber. **Removida do código.**

## 7. Secrets antigos — BLOCKED

**A suposição do briefing estava errada, e isso muda a conclusão.** O `MERCADO_PAGO_ACCESS_TOKEN` não é de conta pessoal. Consultando `users/me` de dentro da edge, sem expor o valor:

| Campo | Valor |
|---|---|
| Ambiente | produção (`APP_USR-`) |
| Válido | sim |
| Conta | `2920329655` |
| Tipo de pessoa | **CNPJ** |
| Documento mascarado | `61***94` |

O CNPJ da Café Saporino é 61.109.694/0001-94. O da COFICO, V. Medeiros de Santi, é 66.006.929/0001-36, que mascararia como `66***36`. Ou seja: **a credencial em uso é da conta PJ da Saporino**, não pessoal e não da COFICO.

Os dois segredos de webhook foram comparados **por hash** e são **valores diferentes**: um por conta.

Consequência prática: esses secrets **não podem ser removidos**. São a credencial viva da loja da Saporino. E não podem ser renomeados por mim, porque o CLI não lê o valor de um secret — só grava. Renomear exige quem tem o valor.

## 8. Secrets novos COFICO — HUMAN ACTION REQUIRED

Faltam, e sem eles a COFICO não cobra:

- `MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN`
- `MERCADO_PAGO_COFICO_PROD_PUBLIC_KEY`

O segredo de webhook da COFICO já está configurado. Ver o bloco de ação humana no fim deste documento.

## 9. Edge Functions afetadas — DONE REAL

| Função | Mudança |
|---|---|
| `mercadopago-webhook` | valida contra todas as contas, usa o token da conta que assinou, aceita as duas grafias do manifest |
| `create-payment` | escolhe a conta pela empresa do pedido; leitura de credencial no banco removida |
| `chat-upload` | exige `conversation_id` e valida participação |
| `storage-cleanup` | nova; detecção e limpeza de órfãos |
| `mp-audit` | nova, **temporária**; auditoria de credenciais e autoteste do webhook |

Novo módulo compartilhado `_shared/mpCredentials.ts`: resolve token e segredo **por conta**, e o campo `source` diz de qual secret veio, o que vai para o log. Enquanto os secrets nomeados da Saporino não existirem, o par legado é aceito **como credencial da Saporino** — transitório e declarado, não fallback silencioso.

## 10. Webhook — DONE REAL

Um endpoint, várias contas. A assinatura é conferida contra **cada** segredo configurado; a conta que assinou é registrada e é a dona do resto do processamento. Continua fail closed: sem segredo configurado, ou sem assinatura que bata, é rejeição.

**Autoteste assinado com o segredo real, nas duas contas:**

| Cenário | COFICO | Saporino |
|---|---|---|
| Assinatura válida | HTTP 200 | HTTP 200 |
| Assinatura inválida | HTTP 401 | HTTP 401 |
| Sem assinatura | HTTP 401 | HTTP 401 |

**Uma regressão minha, encontrada e corrigida.** O primeiro redeploy do webhook reativou a verificação de JWT, e o Mercado Pago não envia token do Supabase: o endpoint passou a responder `Missing authorization header`. Corrigido com redeploy usando `--no-verify-jwt`. **Esse flag é obrigatório sempre que essa função for publicada.**

## 11. HMAC — DONE REAL, com defeito real corrigido

O manifesto da assinatura era montado como `id:X;request-id:Y;ts:Z`, **sem** ponto e vírgula final, enquanto a documentação do Mercado Pago usa `id:%s;request-id:%s;ts:%s;`. Um caractere de diferença muda o HMAC inteiro: **toda notificação legítima seria recusada com 401 no primeiro pagamento real.**

Como não há como confirmar o formato sem uma notificação verdadeira, a verificação passou a aceitar as duas grafias (`manifestVariants`), com teste unitário. Continua fail closed: assinatura que não bate em nenhuma variante é rejeitada.

Foi o autoteste que revelou isso. Só um pagamento real teria revelado depois, e com prejuízo.

## 12. Testes sem dinheiro — DONE REAL

- **Webhook:** autoteste assinado nas duas contas, com os três cenários acima.
- **`create-payment` de ponta a ponta:** pedido de teste criado, preferência gerada na conta da Saporino (`2920329655-3478c472-...`), preferência gravada no pedido, segunda chamada **idempotente** (`{"idempotent":true}`), pedido de teste removido.
- **Idempotência de status:** coberta por `decideOrderUpdate`, com teste unitário de não regressão (pedido aprovado não volta para pendente).
- **35 testes de unidade** passando.

Nenhum centavo se moveu. Uma preferência de checkout não é cobrança.

## 13. Secrets removidos — NOT STARTED

Nada foi removido, e não deveria ser: os secrets legados são a credencial viva da Saporino. A remoção só faz sentido depois que os secrets nomeados existirem (item 8).

## 14. Secrets preservados — DONE REAL

Preservados e em uso: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_COFICO_PROD_WEBHOOK_SECRET`, `VITE_MERCADO_PAGO_PUBLIC_KEY`. Nenhum valor foi lido, exibido, copiado ou registrado em log em nenhum momento deste ciclo.

## 15. Pendência de teste real — HUMAN ACTION REQUIRED

Ver o bloco final.

---

## 16. Piloto real pronto? — DONE REAL

Sim, para operação assistida. Os 13 passos do fluxo foram executados de ponta a ponta com JWT de administrador e depois removidos:

| # | Passo | Resultado |
|---|---|---|
| 1 | Cadastrar participante | HTTP 201 |
| 2 | Atribuir papel | HTTP 201 |
| 3 | Cadastrar propriedade | HTTP 201 |
| 4 | Cadastrar oferta | nasce `draft` |
| 5 | Enviar foto | upload 200, foto `pending` |
| 6 | Moderar oferta e foto | `approved` / `approved` |
| 7 | Publicar | `active` com janela de 24 h |
| 8 | Cadastrar solicitação | HTTP 201, `active` |
| 9 | Rodar match | 1 match, score 91 |
| 10 | Explicar o score | 7 fatores gravados |
| 11 | Proteger contato | identidade visível a terceiro = 0, via shield = 1 |
| 12 | Registrar observações | HTTP 200 |
| 13 | Converter em cliente | 1 identidade, 1 relação |

Mais o registro do caso e a leitura das métricas. **15 de 15 verificados**, e o ensaio foi apagado ao final.

## 17 e 18. Checklists do produtor e do comprador — DONE REAL

Em `docs/governanca/CHECKLIST_PILOTO_COFFEE_NETWORK.md`, escrito para a equipe usar durante a ligação. Cobre identidade, contato, documento, município e UF, propriedade, dados do café, preço, disponibilidade, fotos, laudo e amostra do lado do produtor; e identidade empresarial, CNPJ, contato, destino, volume, espécie, bebida, peneira, processo, faixa de preço, janela, frete e amostra do lado do comprador.

O checklist termina com o que **não** existe ainda, para ninguém prometer pagamento pela plataforma, frete, WhatsApp ou assistente de IA.

## 19. Case Log — DONE REAL

Tabela `coffee_pilot_cases`, só administrador, com aba **Casos piloto** no painel. Registra código do caso, data, produtor, comprador, oferta, solicitação, match e score, tempos, se pediram amostra, se houve proposta e negociação, se fechou, motivo da perda, volume, valor potencial, resultado, campos que faltaram, campos que sobraram, feedback das duas pontas e o aprendizado.

Traz também `autoriza_divulgacao` e `divulgacao_anonimizada`, que são o gate do item 26.

## 20. Métricas — DONE REAL

View `vw_coffee_pilot_metrics`, exibida no topo da aba: casos, fechados, perdidos, em andamento, com amostra, com proposta, média de minutos até a oferta ativa, média até o primeiro match, score médio, minutos médios da equipe COFICO, sacas envolvidas e valor fechado.

Provado com um caso de ensaio: `casos=1, score medio=91, min ate match=3`.

---

## 21. Arquivos alterados

**Criados**
- `supabase/functions/_shared/mpCredentials.ts`
- `supabase/functions/storage-cleanup/index.ts`
- `supabase/functions/mp-audit/index.ts` (temporária)
- `docs/governanca/CHECKLIST_PILOTO_COFFEE_NETWORK.md`
- este checkpoint

**Alterados**
- `supabase/functions/mercadopago-webhook/index.ts`, `create-payment/index.ts`, `chat-upload/index.ts`
- `supabase/functions/_shared/mpWebhook.ts` e seu teste
- `src/lib/chat.ts`, `src/lib/storageUrl.ts`, `src/components/chat/Messenger.tsx`
- `src/components/admin/CoffeeNetworkAdmin.tsx` (aba Casos piloto e formulário)
- `src/components/admin/RepCoCommissionsManager.tsx`, `RepCoPayoutBlocks.tsx`, `src/components/repco/RepCoProfile.tsx` — três pontos que gravavam URL pública para bucket privado e nunca abririam

## 22. Migrations

| Versão | O que faz |
|---|---|
| `20260905100000_saneamento_pos_slice_001` | RLS do contador, `invoices` por dono, `chat-media` por participante |
| `20260905110000_storage_orfaos_deteccao` | referências, `storage_orphans`, log de limpeza |
| `20260905111000_storage_referencias_completas` | colunas que faltavam |
| `20260905112000_storage_orfaos_match_bidirecional` | casamento nos dois sentidos |
| `20260905120000_coffee_pilot_cases` | casos e métricas do piloto |

Todas pelo processo oficial do CLI. Histórico com **81 versões**, zero pendências.

## 23. Deploys

`mercadopago-webhook` (com `--no-verify-jwt`), `create-payment`, `chat-upload`, `storage-cleanup` e `mp-audit`. Total de 28 funções ativas no projeto.

## 24. Testes

| Bloco | Resultado |
|---|---|
| Fase A, com JWT real | 8 de 8 |
| Fase C, os 13 passos do piloto | 15 de 15 |
| Autoteste do webhook | 3 cenários, 2 contas |
| `create-payment` ponta a ponta | preferência + idempotência |
| Unidade (`vitest`) | 35 de 35 |
| `typecheck` e `build` | limpos |

---

## 25. Riscos remanescentes

1. **A COFICO ainda não cobra.** Sem access token e public key da conta PJ.
2. **Secrets legados sem nome de conta.** `MERCADO_PAGO_*` só é reconhecido como Saporino por convenção do código. Renomear exige quem tem o valor.
3. **O manifesto do webhook aceita duas grafias.** É proteção, não certeza. O primeiro pagamento real dirá qual é a correta, e aí a outra pode sair.
4. **`create-checkout-order` segue deployado e inerte.** Nada no site o chama. Ligar sem revisar coloca checkout em operação sem a conta certa.
5. **42 arquivos órfãos continuam no Storage.** Detectados e não removidos, de propósito.
6. **`invoices` permite gravação por qualquer autenticado.** A leitura já é por dono; a gravação continua aberta porque o arquivo sobe antes da linha que o referencia.
7. **`mp-audit` está publicada.** É restrita a administrador e nunca devolve segredo, mas é ferramenta de migração e deve sair quando a migração fechar.
8. **Isolamento multi-tenant do RepCo legado continua aberto.** As tabelas novas nascem isoladas; as antigas, não.
9. **Retenção legal segue indefinida.** Nada expira sozinho.
10. **Ficha de café de escolha não existe.** Conilon e Robusta ficam fora do fluxo do piloto.

## 26. Próximo gate recomendado

**Rodar o piloto com um produtor e um comprador reais**, pelo checklist, registrando o caso. É o único caminho que não depende de terceiro e é o que gera a primeira prova comercial de verdade.

Em paralelo, quando as credenciais da COFICO chegarem: um pagamento real de valor mínimo, para fechar o item 15 e confirmar de uma vez qual é a grafia correta do manifesto.

Depois disso, e só depois, faz sentido discutir Slice 002.

---

# AÇÃO HUMANA NECESSÁRIA — MERCADO PAGO COFICO

São três coisas, e todas dependem de você. Reuni tudo em um bloco só.

### 1. Credenciais de produção da COFICO

**O que obter.** Na conta **PJ da COFICO** (V. Medeiros de Santi, CNPJ 66.006.929/0001-36), no Mercado Pago Developers, abra a sua aplicação e vá em **Credenciais de produção**. Copie dois valores: o **Access Token** (começa com `APP_USR-`) e a **Public Key**.

**Onde colar.** No painel do Supabase, em Project Settings → Edge Functions → Secrets, crie:

```
MERCADO_PAGO_COFICO_PROD_ACCESS_TOKEN
MERCADO_PAGO_COFICO_PROD_PUBLIC_KEY
```

**Por que é necessário.** O segredo de webhook da COFICO você já configurou, e o código já o usa. Falta o token: sem ele, a COFICO não cria cobrança nem consulta pagamento. Não cole esses valores aqui no chat.

### 2. Nomear a credencial da Saporino (opcional, recomendado)

A credencial hoje chamada `MERCADO_PAGO_ACCESS_TOKEN` é da **Café Saporino**, e a loja `cafesaporino.com.br` deve continuar recebendo nela. Só que o nome não diz isso. Se quiser deixar explícito, crie com os mesmos valores:

```
MERCADO_PAGO_SAPORINO_PROD_ACCESS_TOKEN
MERCADO_PAGO_SAPORINO_PROD_WEBHOOK_SECRET
```

O código já prefere esses nomes. Depois disso, os dois antigos podem ser apagados.

**Decisão de negócio que é sua:** confirmar que a loja da Saporino continua recebendo na conta da Saporino, e que a COFICO só entra nas operações dela. É o que o código assume hoje.

### 3. Teste com dinheiro real

**Quando fazer.** Depois do item 1.

**Como.** Uma compra de **R$ 1,00** na loja, por PIX, do começo ao fim.

**O que esperar.**
- O pagamento aparece na conta do Mercado Pago da empresa correta.
- O pedido muda para `approved` no painel, com `paid_at` preenchido.
- O webhook recebe a notificação e responde 200.

**Onde conferir.** No Mercado Pago, em Atividade. No RepCo, na aba Pedidos. E, se quiser o detalhe técnico, nos logs da função `mercadopago-webhook` no painel do Supabase.

**O que faço depois, automaticamente:** confirmo qual grafia do manifesto o Mercado Pago usou de verdade, removo a variante que sobrou, valido a credencial da COFICO pela auditoria, removo a função temporária `mp-audit` e atualizo este checkpoint.

---

*Ciclo executado em 05/09/2026. Não iniciei Ai.Bot, WhatsApp, negociação autônoma, pagamento protegido, split, logística, frete, KYC, anúncios, Coffee News, Search Demand Intelligence nem o Slice 002.*
