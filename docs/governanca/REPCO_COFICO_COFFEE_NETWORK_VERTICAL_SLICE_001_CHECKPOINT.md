# REPCO / COFICO — COFFEE NETWORK · VERTICAL SLICE 001 · CHECKPOINT

**Data:** 04/09/2026
**Baseline deste ciclo:** `REPCO_COFICO_PRE_COFFEE_NETWORK_TECHNICAL_CHECKPOINT.md`
**Projeto Supabase:** `rsvoazrkxtdrcjnatzcm` · **Branch:** `cofico-brasil` → `main`

Classificação usada: **DONE REAL** (feito e provado), **PARTIAL** (feito em parte, o que falta está dito), **BLOCKED** (depende de terceiro ou de ação humana), **NOT STARTED**.

Nada aqui é chamado de pronto sem evidência executável. Onde a evidência é uma resposta HTTP ou uma consulta, ela está transcrita.

---

## Placar

| # | Item | Situação |
|---|---|---|
| 1 | Segurança corrigida | **DONE REAL** |
| 2 | Migration baseline | **DONE REAL** |
| 3 | Estado de main | **DONE REAL** |
| 4 | Webhook e storage | **DONE REAL** |
| 5 | Modelo de identidade | **DONE REAL** |
| 6 | Network Participant | **DONE REAL** |
| 7 | Commercial Account / Converter em Cliente | **DONE REAL** |
| 8 | Oferta | **DONE REAL** |
| 9 | Moderação | **DONE REAL** |
| 10 | Purchase Request | **PARTIAL** — só o template de Arábica |
| 11 | Match Engine | **DONE REAL** |
| 12 | Contact Shield | **DONE REAL** |
| 13 | RLS | **DONE REAL** |
| 14 | Testes executados | **DONE REAL** — 15/15 |
| 15 | Evidências | **DONE REAL** |
| 16 | Arquivos criados/alterados | **DONE REAL** |
| 17 | Migrations | **DONE REAL** |
| 18 | Riscos remanescentes | registrados |
| 19 | Backlog registrado | **DONE REAL** |
| 20 | Próximo gate recomendado | definido |

---

## 1. Segurança corrigida — DONE REAL

`public.exec_migration(text)` e `public.exec_select(text)` executavam SQL arbitrário, eram SECURITY DEFINER com dono `postgres` (que tem `BYPASSRLS`), e o papel `anon` tinha `EXECUTE`. Como a chave `anon` vai no bundle servido ao navegador, qualquer visitante do site podia ler, alterar ou apagar qualquer dado do ecossistema, ignorando a RLS.

Estado revalidado antes de mexer, idêntico ao do baseline. Depois da revogação:

| Função | `anon` | `authenticated` | `PUBLIC` | `service_role` |
|---|---|---|---|---|
| `exec_migration(text)` | não | não | não | **sim** |
| `exec_select(text)` | não | não | não | **sim** |

Prova de ponta a ponta, chamando com a chave `anon` real:

```
ANON -> exec_select:    HTTP 401 {"code":"42501","message":"permission denied for function exec_select"}
ANON -> exec_migration: HTTP 401 {"code":"42501","message":"permission denied for function exec_migration"}
```

Nenhum código do produto usava esses RPCs (`grep` em `src` e `supabase/functions` = 0 ocorrências), então a revogação não quebrou nada. O caminho administrativo por `service_role` seguiu funcionando: todas as consultas deste ciclo passaram por ele.

**GATE A: verde.**

---

## 2. Migration baseline — DONE REAL

Produção não tinha histórico: `supabase_migrations.schema_migrations` não existia, e 19 dos 67 arquivos eram ignorados pelo CLI por nome inválido.

| Item | Antes | Depois |
|---|---|---|
| Arquivos com versão válida de 14 dígitos | 48 | **71** |
| Ignorados pelo CLI | 19 | **0** |
| Grupos de versão duplicada | 6 (25 arquivos) | **0** |
| Linhas em `schema_migrations` | tabela inexistente | **76** |
| Migrations pendentes | indeterminado | **0** |

Os 47 arquivos com nome inválido ou versão repetida foram renomeados com `git mv`, recebendo o timestamp do **primeiro commit do próprio arquivo no git**. Nenhum conteúdo SQL foi alterado. O histórico foi gravado com `migration repair --status applied`, que **registra sem executar** — nenhuma migration antiga foi reaplicada.

Prova do gate: criei a migration inócua `20260904160000_baseline_verification` (apenas um `COMMENT ON SCHEMA`) e rodei `supabase db push`. O CLI aplicou **somente ela**, o comentário mudou em produção, e a listagem voltou com zero pendências.

Procedimento oficial documentado em `docs/governanca/PROCEDIMENTO_OFICIAL_MIGRATIONS.md`. `exec_migration` deixa de ser rotina de deploy de schema.

**GATE B: verde.**

---

## 3. Estado de main — DONE REAL

A verdade sobre o que roda em produção foi obtida baixando o código com `supabase functions download`, não deduzindo de branch. Resultado da comparação byte a byte:

| Arquivo | `main` antes | `fase0-pagamento` |
|---|---|---|
| `create-checkout-order/index.ts` | **ausente** | idêntico ao deployado |
| `create-payment/index.ts` | **diferente** (265 linhas) | idêntico ao deployado |
| `mercadopago-webhook/index.ts` | **diferente** (426 linhas) | idêntico ao deployado |
| `_shared/mpWebhook.ts` · `pricing.ts` · `rateLimit.ts` · `log.ts` | **ausentes** | idênticos ao deployado |

Ou seja: produção rodava o código da branch parada, e `main` não descrevia o sistema. Os 7 arquivos foram trazidos e agora são **idênticos ao deployado**.

As 4 migrations da Fase 0 também foram trazidas, depois de eu confirmar que seus objetos já existem em produção (`admin_settings`, `user_addresses`, `edge_rate_limits`, `edge_logs`, `orders.order_public_token_hash`, `get_order_public`). Foram marcadas como aplicadas, sem reexecutar.

**Nenhuma cobrança foi ativada e nada exigiu a conta Mercado Pago PJ.** O frontend da `main` não chama `create-checkout-order` (`grep` = 0), então o checkout server-side continua inerte: a função está deployada e reconciliada, mas nada no site a aciona. É exatamente o "código reconciliado, funcionalidade desligada" pedido.

Branches arquivadas como tags anotadas: `archive/fase0-pagamento-20260904` e `archive/repco-cie-20260904`. A `repco-cie` era só documentação de planejamento, nunca implementada, e assim permanece.

Working tree limpo: o gitlink acidental `website_project` (clone perdido com um único commit) saiu do índice, com o conteúdo preservado e o `BRIEFING_CLAUDE_CODE.md` salvo em `docs/_legacy/`; os 15 arquivos de marca com espaço no nome saíram de `public/` para `_assets-originais/` (gitignored) depois de eu conferir por md5 que são duplicatas dos assets kebab-case já versionados.

**GATE C: verde.**

---

## 4. Webhook e storage — DONE REAL

### Webhook Mercado Pago

**Correção do baseline:** o achado "pula HMAC quando falta `x-signature`" descrevia a cópia desatualizada da `main`, **não** o que roda em produção. O código ativo já falha fechado. Provado contra o endpoint real:

```
sem x-signature      -> HTTP 401 {"error":"Invalid signature"}
x-signature invalida -> HTTP 401 {"error":"Invalid signature"}
```

Rejeita também quando `MERCADO_PAGO_WEBHOOK_SECRET` não está configurado. Nenhuma alteração foi necessária; a Fase C trouxe esse código para a `main`.

### Storage

Migration `20260904170000_fase_d_storage_hardening`.

| Bucket | Antes | Depois | Limite | MIME |
|---|---|---|---|---|
| `product-images` | público | **público** | 15 MB | 5 |
| `carrier-logos` | público | **público** | 5 MB | 4 |
| `batch-photos` | público | **público** | 10 MB | 3 |
| `chat-media` | **público** | **privado** | 25 MB | 13 |
| `visit-photos` | **público** | **privado** | 10 MB | 3 |
| `delivery-pods` | privado | privado | 10 MB | 3 |
| `invoices` | privado | privado | 20 MB | 6 |
| `lot-documents` | privado | privado (**só admin**) | 20 MB | 4 |
| `studio-videos` | privado | privado (**só admin**) | 500 MB | 3 |
| `representative-docs` | privado | privado | 10 MB | 4 |
| `offer-photos` (novo) | — | privado | 10 MB | 3 |

Antes, um único bucket em dez tinha limite de tamanho e lista de tipos. Agora todos têm. As 24 políticas genéricas foram substituídas por 28 explícitas, com escopo de bucket e de papel. `lot-documents` virou exclusivo de administrador: documento de custo do café verde nunca pode chegar ao representante.

Provas:

```
ANONIMO -> chat-media (agora privado):      HTTP 400 NoSuchBucket
ANONIMO -> product-images (segue publico):  HTTP 200
```

O código foi ajustado junto, senão a mudança quebraria telas: `src/lib/storageUrl.ts` e `src/components/PrivateImage.tsx` resolvem signed URL e aceitam tanto o caminho quanto a URL pública antiga, então as linhas já gravadas continuam funcionando **sem migração de dados**. `chat-upload` passou a devolver o caminho, e Messenger, PromotorRota, PromoterSupervisorPanel e RepCoRoutes passaram a exibir por signed URL.

Política e retenção em `docs/governanca/POLITICA_STORAGE.md`. Retenção legal continua **não definida** — depende de revisão jurídica e não foi implementada.

**GATE D: verde.** Nenhum documento sensível depende de bucket público.

---

## 5. Modelo de identidade — DONE REAL

A regra de negócio virou estrutura, não recomendação:

- `network_entities` é a identidade canônica na rede, pessoa ou organização.
- `commercial_accounts` é a relação comercial, **sempre por empresa**, e nunca criada automaticamente.
- `companies` continua sendo só as empresas internas do ecossistema. Participante externo nunca vira `company`.

Tropeiro Paulista e Café Serrão seguem como **marcas da Saporino**, sem empresa própria. Fazendinha e COFICO seguem como empresas separadas — a COFICO já está no banco como `is_operator = true`.

O schema não impede a operação futura em que a COFICO recebe café como pagamento e depois transfere para a Saporino: o lote pertenceria à entidade que recebeu, e a transferência seria outra operação. **Nada disso foi implementado**, apenas não foi bloqueado.

## 6. Network Participant — DONE REAL

`network_entities` (identidade, documento, contato, endereço, situação, vínculo opcional com login), `network_roles` (11 papéis como tabela, não enum, para crescer sem migration de tipo), `network_entity_roles` (acúmulo de papéis) e `network_properties` (fazenda/origem, com altitude e região).

Papéis semeados: produtor, propriedade, comprador, torrefação, comerciante, exportador, fornecedor, prestador, transportadora, anunciante, representante.

## 7. Commercial Account / Converter em Cliente — DONE REAL

`public.network_convert_to_client(entity, company, tipo, segmento, forma_pagto, prazo, motivo)`:

- exige administrador;
- **não copia cadastro** — a identidade continua só em `network_entities`;
- é idempotente: chamar de novo para a mesma empresa devolve a relação existente;
- grava auditoria.

Dados comerciais ficam na relação, por empresa: segmento de preço, forma e prazo de pagamento, limite e score de crédito, desconto, bonificação, comissão, representante designado, observações confidenciais, e uma ponte opcional para o cadastro legado `representative_clients`.

Provado que condição comercial não vaza entre empresas: o mesmo produtor virou fornecedor da COFICO **sem** condição comercial e fornecedor da Saporino **com** segmento `distribuidora` e pagamento `pix`. Duas relações, uma identidade.

No painel, o botão pergunta "Cliente de qual empresa?" e lista as empresas cadastradas.

## 8. Oferta — DONE REAL

`coffee_offers` com espécie, safra, quantidade em sacas, bebida, peneira, processo, umidade, tipo, SCA, certificações, notas sensoriais, preço pedido, origem (município/UF/região), disponibilidade, janela de exclusividade e moderação.

Estados auditáveis, como pedido: `draft`, `pending_review`, `approved`, `active`, `paused`, `matched`, `negotiating`, `sold`, `expired`, `rejected`.

A classificação de bebida é uma tabela com ordem (`coffee_bebida_scale`), não texto solto, para o match poder comparar "pelo menos mole".

**Janela de 24 horas:** `coffee_offer_publish` só aceita oferta já aprovada, marca `published_at` e grava `exclusive_until = agora + 24h`. Sem multa financeira, como determinado; fica o registro para reputação futura. `coffee_offer_mark_sold` registra a baixa por venda externa. O painel mostra o tempo restante e permite pausar, reativar, marcar vendida e renovar publicando de novo.

A UI é guiada e assistida pela COFICO, coerente com o fluxo "oferta assistida". O schema já está pronto para que, no futuro, Ai.Bot, foto ou voz preencham os mesmos campos — nada disso foi implementado.

## 9. Moderação — DONE REAL

Oferta **não** publica sozinha. `coffee_offer_moderate` aceita `approve`, `reject` ou `request_changes` (que devolve a oferta para rascunho), exige administrador e grava auditoria com estado anterior e novo.

Fotos têm gate humano próprio: entram como `pending`, ficam em bucket **privado**, e só a COFICO aprova ou reprova, com motivo. A COFICO pode reprovar e pedir substituição.

Fluxo de foto provado ponta a ponta:

```
1. upload da foto (admin):        HTTP 200
2. registro criado com status:    pending
3. anonimo via URL publica:       HTTP 400 NoSuchBucket
4. signed URL gerada e baixada:   HTTP 200
5. produtor tenta moderar:        HTTP 400 "apenas a equipe COFICO pode moderar fotos"
6. COFICO aprova:                 HTTP 200 "approved"
```

A arquitetura prevê detecção futura de telefone, e-mail, QR code e endereço na imagem. **Nenhuma visão computacional foi implementada.**

## 10. Purchase Request — PARTIAL

`coffee_purchase_requests` com espécie, safra, volume, bebida mínima, peneira mínima, processos aceitos (lista), umidade máxima, tipo máximo, SCA mínimo, certificações exigidas, faixa de preço, origem desejada, destino (UF/município), janela de entrega, condição de frete e exigência de amostra.

**Por que PARTIAL:** foi implementado somente o template de **Arábica comercial/especial**, como determinado. Os templates de **escolha Arábica** e **escolha Conilon/Robusta** não existem. A coluna `species` impede o match de cruzar espécies, mas não substitui a ficha própria de café de escolha. A ficha de Conilon/Robusta que existe hoje continua sendo referência de operação de escolha e **não** foi usada como template universal.

## 11. Match Engine V1 — DONE REAL

Determinístico e auditável, sem IA e sem caixa-preta. Pesos fixos somando 100:

| Fator | Peso |
|---|---|
| espécie | 20 |
| bebida | 15 |
| peneira | 15 |
| processo | 15 |
| volume | 15, proporcional |
| região | 10 |
| preço | 10 |

Critérios eliminatórios, que não geram match: espécie diferente, safra diferente quando exigida, SCA abaixo do mínimo, certificação exigida ausente, umidade acima do máximo, tipo acima do máximo.

Cada fator é gravado em `coffee_matches.factors`, com peso, ganho e detalhe, para a tela mostrar o porquê. Resultado real do teste:

```
91% compatível
especie: match (+20) | bebida: match (+15) | peneira: match (+15) | processo: match (+15)
volume: parcial (+6) — 80 de 200 sacas | regiao: match (+10) | preco: dentro da faixa (+10)
```

## 12. Contact Shield — DONE REAL

A COFICO conhece as duas identidades. As partes não.

As tabelas cruas já são invisíveis para terceiros pela RLS. A única porta entre as pontas são duas views que filtram colunas: `vw_coffee_offers_shielded` e `vw_coffee_requests_shielded`. Elas **não expõem** nome, razão social, CPF/CNPJ, telefone, WhatsApp, e-mail, endereço exato, nome da fazenda nem coordenadas.

O comprador vê: "Produtor verificado", município/UF, região, espécie, safra, sacas, bebida, peneira, processo, umidade, tipo, SCA, certificações, notas e preço pedido.
O produtor vê: "Comprador empresarial verificado", UF de destino, volume desejado, perfil solicitado e faixa de preço quando houver.

A localização fica em nível de município e UF: suficiente para avaliar origem, insuficiente para fechar por fora.

Além disso, a tabela `coffee_matches` — a única que liga as duas pontas — é visível **apenas** para a COFICO.

## 13. RLS — DONE REAL

Todas as 11 tabelas novas com RLS ligada e política explícita.

- Identidade: administrador vê tudo; o participante vê só a própria. Ninguém vê a de terceiro.
- Ofertas e solicitações: o dono vê e edita as suas; o administrador vê todas.
- `commercial_accounts`: **somente administrador**. Nem o participante enxerga a própria condição comercial, nem uma empresa enxerga a da outra.
- `coffee_matches`: somente administrador.
- Auditoria: administrador lê; qualquer autenticado grava o próprio rastro.

Também foi fechada a única tabela sem RLS apontada no baseline? **Não** — `company_order_counters` continua sem RLS. Ver riscos (§18).

## 14. Testes executados — DONE REAL

Os testes rodaram pelo **mesmo caminho da aplicação**: JWT real de cada usuário, emitido pela API admin (`generate_link` + `verify`, sem senha e sem envio de e-mail), batendo no PostgREST. Não foi simulação de papel dentro do banco, que aliás é proibida em função security-definer.

Dados controlados, como especificado:

- **Produtor A** — 80 sacas, Arábica, Patrocínio/MG, bebida mole, peneira 16+, cereja descascado, safra 2026, SCA 84,5, R$ 1.450/saca.
- **Torrefação B** — quer 200 sacas, Arábica, bebida mole, peneira 16+, CD ou lavado, destino SP, até R$ 1.500/saca.

| # | Prova | Resultado |
|---|---|---|
| 1 | Cadastro na rede não cria cliente | PASS — 0 relações comerciais |
| 2 | Oferta nasce em `draft` | PASS |
| 3 | Vai para revisão | PASS |
| 4 | COFICO aprova | PASS — HTTP 200 `"approved"` |
| 4b | Produtor **não** modera | PASS — HTTP 400 "apenas a equipe COFICO pode moderar ofertas" |
| 5 | Fica ativa com janela de 24h | PASS — `exclusive_until` = +24h |
| 6 | Solicitação criada e ativa | PASS |
| 7 | Match encontrado | PASS — 1 match, score 91 |
| 8 | Score e motivos registrados | PASS — 7 fatores gravados |
| 9 | Comprador não vê contato do produtor | PASS — identidade 0, tabela crua 0, shield 1, vazamentos 0 |
| 10 | Produtor não vê contato do comprador | PASS — identidade 0, tabela crua 0, shield 1, vazamentos 0 |
| 11 | Admin vê as duas identidades | PASS |
| 11b | Match é só da COFICO | PASS — 0 linhas para o comprador |
| 12 | Converter em cliente não duplica cadastro | PASS — 1 identidade, 1 relação |
| 12b | Condição comercial não vaza entre empresas | PASS — COFICO sem condição, Saporino com `distribuidora`/`pix` |
| 13 | Condição comercial invisível aos participantes | PASS — 0 linhas para ambos |
| 14 | Auditoria registrou as ações | PASS |
| 15 | Anônimo não alcança a rede | PASS — entidades `[]`, shield HTTP 401 |

**15 de 15 aprovadas.** Nenhum item foi marcado como passando sem a resposta correspondente.

Fora da lista pedida, também foi verificado ao vivo o **replay do vídeo do HERO** (a mudança que estava pendente desde ontem): não terminado, o vídeo pausa ao sair e **retoma** ao voltar (3,77s → 5,50s); terminado, ao sair e voltar ele **reinicia** e toca; `loop` desligado. É exatamente a opção B escolhida.

Qualidade: `typecheck` 0 erros, 34 testes de unidade passando, `build` OK.

## 15. Evidências

- Revogação: HTTP 401 `42501` para `anon` nas duas funções.
- Baseline: 76 versões em `schema_migrations`, 0 pendências, push aplicando só a migration nova.
- Reconciliação: os 7 arquivos de função idênticos ao `functions download`.
- Webhook: 401 nas duas tentativas contra o endpoint de produção.
- Storage: `NoSuchBucket` para chat privado, 200 para imagem pública de produto.
- Slice: 15/15 provas com JWT real, e o painel renderizando "91% compatível" com os chips de fator.
- Painel: o Produtor A aparece com duas relações comerciais distintas, e a Torrefação B com "só participante da rede — não é cliente de ninguém".

Estado do banco ao fim do ciclo:

| Objeto | Linhas |
|---|---|
| participantes | 2 |
| papéis atribuídos | 3 |
| propriedades | 1 |
| relações comerciais | 2 |
| ofertas | 1 |
| fotos de oferta | 1 |
| solicitações | 1 |
| matches | 1 |
| eventos de auditoria | 11 |
| migrations no histórico | 76 |

Os dados de teste têm prefixo `TESTE VS001` e podem ser removidos quando quiser.

## 16. Arquivos criados e alterados

**Criados**
- `src/components/admin/CoffeeNetworkAdmin.tsx` — painel da COFICO
- `src/lib/storageUrl.ts`, `src/components/PrivateImage.tsx` — consumo de bucket privado
- `docs/governanca/PROCEDIMENTO_OFICIAL_MIGRATIONS.md`
- `docs/governanca/POLITICA_STORAGE.md`
- `docs/_legacy/BRIEFING_CLAUDE_CODE.md` (resgatado do clone perdido)
- `vitest.config.ts` e três arquivos de teste

**Alterados**
- `src/pages/AdminDashboard.tsx` — aba Coffee Network
- `src/components/chat/Messenger.tsx`, `src/components/promotor/PromotorRota.tsx`, `src/components/admin/PromoterSupervisorPanel.tsx`, `src/components/repco/RepCoRoutes.tsx`, `src/lib/promoterVisit.ts` — signed URL
- `supabase/functions/chat-upload/index.ts` — devolve caminho (deployado)
- `supabase/functions/create-payment`, `mercadopago-webhook`, `create-checkout-order`, `_shared/*` — reconciliados com produção
- `src/components/HeroExperience.tsx` — replay opção B
- `package.json`, `.gitignore`
- 47 migrations renomeadas com `git mv`

## 17. Migrations

| Versão | O que faz |
|---|---|
| `20260904160000_baseline_verification` | prova do baseline (comentário no schema) |
| `20260904170000_fase_d_storage_hardening` | privacidade, limites, MIME e 28 políticas de storage |
| `20260904180000_coffee_network_core` | 11 tabelas do núcleo da rede |
| `20260904181000_coffee_network_rls_match_shield` | RLS, motor de match, contact shield, converter em cliente |
| `20260904182000_coffee_network_offer_photos_bucket` | bucket privado e moderação de fotos |

Mais as 4 da Fase 0 trazidas e marcadas como aplicadas. Todas pelo processo oficial; nenhuma por `exec_migration`.

## 18. Riscos remanescentes

1. **`company_order_counters` continua sem RLS.** É a tabela de contadores de numeração fiscal. Risco baixo de vazamento, mas escrita direta corromperia a sequência de pedidos.
2. **`invoices` permite leitura a qualquer autenticado.** O ideal seria por dono, mas o caminho dos arquivos não carrega o identificador do representante. Estreitar quando o caminho for normalizado.
3. **Arquivos órfãos no Storage.** Apagar pedido ou cliente ainda não remove os arquivos. Dívida antiga, não resolvida neste ciclo.
4. **Retenção legal indefinida.** Nada expira automaticamente. Definir por bucket e por tipo de dado, com revisão jurídica.
5. **`chat-media` é legível por qualquer autenticado.** Melhor que público, mas ainda não é por participante da conversa: o caminho do arquivo não carrega a conversa.
6. **Dados de teste em produção.** As duas entidades `TESTE VS001` e seus registros permanecem no banco como evidência.
7. **Isolamento multi-tenant do sistema antigo continua aberto.** As tabelas novas nascem isoladas; o RepCo legado segue com só 9 políticas olhando `company_id`.
8. **`create-checkout-order` está deployado e inerte.** Reconciliado, mas nada o chama. Se alguém ligar o frontend sem revisar, entra em operação sem Mercado Pago PJ.

## 19. Backlog registrado — não implementado neste ciclo

Registrado de propósito, para não se perder: IA lendo foto automaticamente; Ai.Bot; WhatsApp; áudio; OCR de laudo; negociação autônoma; ofertas e contraofertas automáticas; pagamento protegido; split; Mercado Pago do Coffee Network; frete; COFICO Entregas no fluxo da rede; check-in do representante no embarque; KYC facial; retenção legal de 24 meses; anúncios; Search Demand Intelligence; Coffee News; pagamento em café (barter); reputação completa; penalidades; inteligência de estoque de torrefação; módulos tipo Cropster; automação tipo OFI.

Somam-se os templates de **escolha Arábica** e **escolha Conilon/Robusta** (§10), e a interface de autoatendimento do produtor e do comprador — hoje o fluxo é assistido pela COFICO, por decisão de escopo.

## 20. Próximo gate recomendado

**Não iniciei nada além do Vertical Slice 001.** Pagamentos, WhatsApp, Ai.Bot, logística e o Slice 002 seguem fechados.

O próximo gate natural é **colocar um produtor e um comprador reais no fluxo assistido**, com a COFICO cadastrando, moderando e intermediando na mão. Isso testa a hipótese comercial com gente de verdade sem exigir nenhuma das peças travadas em terceiro: não depende de Mercado Pago PJ, nem de fatura Apify, nem de frete.

Antes de abrir a rede para autoatendimento, dois itens da §18 deveriam ser fechados: a leitura de `invoices` por dono e a rotina de limpeza de arquivos órfãos.
