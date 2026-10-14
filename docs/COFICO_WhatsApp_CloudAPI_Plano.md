# WhatsApp Cloud API × RepCo — auditoria e plano

> 13/10/2026. **Nada foi ativado.** Nenhuma mensagem enviada ou recebida, nenhum número
> registrado ou migrado, nenhum segredo criado, nenhum serviço contratado, nenhum deploy.
> O número comercial **+55 11 93810-0909 não foi tocado**.

---

## Etapa 1 — Auditoria

### O que já existe e serve (não reconstruir)

A plataforma já resolveu, em produção, quatro dos cinco problemas difíceis desta integração.

| Peça | Onde | Por que serve aqui |
|---|---|---|
| **Credencial por empresa** | `_shared/mpCredentials.ts` | `companies.payment_account` aponta para um *conjunto* de secrets (`cofico`, `saporino`). O valor **nunca** fica no banco, **não existe conta padrão**, e empresa sem credencial **falha fechado**. É exatamente o modelo para a WABA por empresa. |
| **Webhook com assinatura** | `_shared/mpWebhook.ts` + `mercadopago-webhook` | Verificação HMAC, idempotência com regra de não-regressão, `--no-verify-jwt` para URL pública. O padrão já passou por um susto real: um ponto e vírgula no manifest teria recusado todo pagamento legítimo. |
| **RBAC multi-tenant** | `has_role(papel, company_id)` + `user_roles.company_id` | Já existe e **já está em uso** nas 9 tabelas do módulo promotor — o único módulo com isolamento por empresa. É o molde a seguir desde a primeira migration. |
| **Consentimento e opt-out** | tabela `marketing_contacts` | Já tem `phone_e164`, `consent`, `consent_at`, `opted_out_at`, `company_id`, `source`. **O registro de consentimento não precisa ser criado** — precisa ser ligado. Hoje: 4 contatos, 4 com consentimento, 0 opt-out. |
| **Tempo real** | publicação `supabase_realtime` | `chat_messages` já é publicada; a caixa de entrada ao vivo é padrão conhecido no projeto. |
| **Mídia privada** | bucket `chat-media` (privado, 25 MB) + função `chat-upload` | Serve para guardar imagem e documento que o cliente mandar. |
| **Alerta e limite** | `_shared/telegram.ts`, `_shared/rateLimit.ts`, `_shared/log.ts` | Aviso de mensagem nova e proteção do webhook. |

### O que existe e **não** serve

**As tabelas `chat_*` são de conversa interna, não de atendimento.** `chat_participants.user_id`
aponta para `auth.users`: todo participante precisa ser um usuário cadastrado. **Um contato de
WhatsApp não é usuário do sistema** e nunca será. Além disso `chat_messages` não tem `company_id`
— o isolamento ficaria frouxo justamente na tabela que mais cresce.

Conclusão: a caixa de entrada precisa de tabelas próprias. O Messenger interno continua como está.

### Segurança, permissões e isolamento

O que já está garantido: RLS ligada em todas as tabelas; `is_admin()`, `has_role(papel)`,
`has_role(papel, empresa)`, `my_company_id()`, `my_rep_id()` prontas; segredos fora do banco.

O que **precisa** ser decidido desde o início, e não depois:

- **O `phone_number_id` do evento é quem diz de qual empresa é a mensagem.** A Meta manda esse
  campo em `value.metadata.phone_number_id`. Ele é a chave de entrada do isolamento: número →
  empresa → credencial. Sem isso, mensagem da COFICO poderia cair na caixa da Saporino.
- **Isolamento por `company_id` desde a primeira migration**, no molde do módulo promotor. É o
  único jeito de não repetir a dívida que hoje existe no resto do sistema — e a política de
  privacidade publicada já diz, em §8.2, que o controle hoje é por papel e não separação técnica
  completa. Este módulo nasce do lado certo dessa frase.
- **Quem lê a caixa de entrada** é papel novo (`atendimento`), com `company_id`. Representante
  **não** vê conversa de cliente de outro; admin vê tudo da empresa ativa.

### Custos

| Item | Situação |
|---|---|
| **Ambiente de teste da Meta** | Gratuito. Número de teste fornecido pela Meta, com lista curta de destinatários autorizados. É onde tudo abaixo pode rodar **sem custo e sem tocar no número comercial**. |
| **Conversa iniciada pelo cliente** | Na política atual da Meta, atendimento dentro da janela de 24 h não é cobrado. **Confirmar no painel antes de ativar** — a Meta mudou essa tabela mais de uma vez. |
| **Mensagem fora da janela (template)** | **É cobrada**, por categoria (utilidade, marketing, autenticação). Por isso a janela de 24 h entra no código e na tela, não só na cabeça do atendente. |
| **Supabase** | Edge Functions e banco já contratados; o volume desta integração é irrelevante perto do que já roda. Sem custo novo. |
| **Cartão / serviço pago** | **Nenhum.** Nada aqui exige contratação. |

### Dependências da Meta (o que não depende de nós)

1. **Verificação do negócio** no Business Manager — necessária para sair do ambiente de teste.
2. **App review** das permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
3. **Coexistência** — a modalidade que mantém o aplicativo WhatsApp Business funcionando no
   celular *e* a Cloud API no mesmo número. **É a condição que você definiu, e nada de produção
   começa antes de ela estar confirmada pela Meta.** A migração comum desativa o aplicativo no
   aparelho; é exatamente o que não se quer.
4. **URL do webhook + token de verificação** cadastrados no app — depende de um deploy, que
   depende da sua aprovação.

Nada em 1–4 bloqueia o ambiente de **teste**.

---

## Etapa 2 — Plano

### Desenho

```
Cliente no WhatsApp
      │
      ▼
   Meta Cloud API
      │  POST assinado (X-Hub-Signature-256)
      ▼
 edge function  whatsapp-webhook          [pública, --no-verify-jwt]
      │  1. confere a assinatura com o App Secret        → recusa se não bater
      │  2. grava o evento CRU em wa_eventos             → idempotência e auditoria
      │  3. phone_number_id → empresa → credencial       → decide o dono da mensagem
      │  4. normaliza e grava em wa_contatos/conversas/mensagens
      │  5. "SAIR" sozinho → marca opted_out_at em marketing_contacts
      ▼
   Postgres (RLS por company_id desde a 1ª migration)
      │  realtime
      ▼
 RepCo › Mensagens      ← atendente humano responde
      │
      ▼
 edge function  whatsapp-enviar           [autenticada, exige papel + empresa]
      │  recusa texto livre fora da janela de 24 h
      ▼
   Meta Cloud API
```

### Tabelas

- **`wa_numeros`** — o elo número ↔ empresa. `phone_number_id`, `waba_id`, `company_id`,
  `conjunto_credencial` (igual ao `payment_account`), `ambiente` (teste/producao), `ativo`.
  É esta tabela que impede mensagem de uma marca cair na caixa da outra.
- **`wa_contatos`** — `telefone_e164`, `nome_perfil`, `company_id`, vínculo opcional com
  `representative_clients`. Chave única por (empresa, telefone).
- **`wa_conversas`** — uma por contato e número. Guarda `ultima_entrada_em` (a conta da janela
  de 24 h), `status` (aberta/fechada), `responsavel_id` (quem assumiu o atendimento).
- **`wa_mensagens`** — `id_externo` (wamid, **único**, é a idempotência), direção, tipo, texto,
  mídia, estado de entrega, erro, `company_id`.
- **`wa_eventos`** — o JSON cru que a Meta mandou, com o `wamid` e o resultado do processamento.
  Serve para reprocessar sem pedir nada à Meta e para explicar qualquer número depois.

Todas com RLS: `is_admin()`, `has_role('atendimento', company_id)`, e nada de representante.

### Segredos (nenhum valor no banco, nenhum no código)

```
WHATSAPP_COFICO_APP_SECRET        verificação da assinatura dos eventos
WHATSAPP_COFICO_VERIFY_TOKEN      o desafio GET da Meta
WHATSAPP_COFICO_TOKEN             token de envio
```

Mesmo formato dos secrets do Mercado Pago, com o dono explícito no nome. Sem nome genérico —
foi assim que se descobriu, em setembro, que o "token genérico" era da Saporino.

### Tela — RepCo › Mensagens

Lista de conversas à esquerda, conversa à direita, no padrão que o RepCo já usa. Três coisas
que a tela precisa mostrar e que normalmente ficam de fora:

1. **Quanto falta da janela de 24 h**, por conversa. Quando fecha, o campo de texto livre
   desabilita e explica por quê — em vez de deixar escrever uma resposta que a Meta vai recusar.
2. **Estado de cada mensagem enviada** (enviada / entregue / lida / falhou **com o código**).
   O código do erro é o que permite procurar a causa; ele vem como número no evento, e o leitor
   já trata isso.
3. **Quem assumiu o atendimento**, para duas pessoas não responderem a mesma conversa.

Automação fica preparada, não ligada: o webhook já separa o que é pedido de descadastramento, e
o lugar de encaixar resposta automática está isolado em uma função só.

---

## Etapa 3 — O que já foi feito agora (reversível, sem ativar nada)

**`supabase/functions/_shared/whatsapp.ts`** — lógica pura, sem rede e sem banco:

- verificação do desafio GET (**fail closed**: sem token configurado, ninguém entra);
- leitura da assinatura `sha256=…` e comparação **em tempo constante**;
- leitura do evento (`entry → changes → value`), com mensagens, status de entrega e erros;
- telefone brasileiro para E.164;
- **janela de 24 h** e quanto falta, em minutos;
- reconhecimento de pedido de descadastramento.

**`src/lib/whatsapp.test.ts` — 27 testes**, todos sobre o formato documentado da Cloud API.
Nenhuma mensagem real foi enviada ou recebida.

Dois comportamentos que os testes fixaram, e que seriam falhas caras:

- **Lixo no payload não derruba o webhook.** Se a função lança exceção, a Meta reenvia o lote
  inteiro e, depois de muitas falhas, **desativa a inscrição** — o atendimento pararia sozinho.
  Campo desconhecido vira contagem de "ignorados".
- **O código do erro da Meta vem como número, não texto.** O primeiro leitor que escrevi o
  descartava, e o atendente veria "Re-engagement message" sem o `131047` que permite procurar a
  causa. O teste pegou antes de existir qualquer mensagem.

E uma decisão explícita: `'1 800 555 0199'` é indistinguível de um celular brasileiro de 11
dígitos. A função assume Brasil, de propósito, porque é a operação inteira da COFICO — está
escrito no teste para ninguém "corrigir" isso por engano.

---

## O que falta, em ordem

| # | Passo | Depende de |
|---|---|---|
| 1 | Migration das 5 tabelas, com RLS por empresa | sua aprovação |
| 2 | Edge function `whatsapp-webhook` (GET + POST) | 1 |
| 3 | Cadastrar segredos e a URL do webhook no app da Meta | 2 + deploy |
| 4 | Testar ponta a ponta **no número de teste** da Meta | 3 |
| 5 | Tela RepCo › Mensagens | 1 |
| 6 | Edge function `whatsapp-enviar`, com a trava da janela | 1 |
| 7 | **Produção** | **confirmação da Coexistência pela Meta** |

Os passos 1 a 6 são gratuitos e cabem inteiros no ambiente de teste. O passo 7 não começa antes
da Coexistência estar confirmada.

## Próximo passo técnico

**A migration das 5 tabelas com RLS por empresa** — é a fundação de tudo e a única peça que, se
nascer errada, obriga a refazer o resto. Pode ser aplicada primeiro no **staging** (`mzfn…`),
que existe justamente para isso, sem tocar em produção.
