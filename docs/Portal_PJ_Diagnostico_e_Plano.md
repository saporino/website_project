# Portal de cadastro PJ — diagnóstico e plano

> 15/10/2026. **Nada implementado.** Diagnóstico e proposta para sua aprovação.
> Produção intocada, nada publicado, integração WhatsApp pausada como combinado.

---

## 1. O que já existe e serve

A plataforma já resolveu três das quatro peças difíceis. O trabalho é menor do que parece.

| Peça | Onde | Observação |
|---|---|---|
| **Convite de uso único** | **dois** geradores: `repco_invite_codes` (RepCo) e `lv_convites` (Coffee LiVRE) | Ambos operacionais. O primeiro **já é unificado por papel** e tem tela com seletor de função; o segundo é mais forte em segurança (hash + e-mail). Investigação completa no §8. |
| **Ficha cadastral PJ** | `representative_clients` | 54 campos: CNPJ, razão social, IE, endereço com geo, e-mail do comprador, e-mail do XML, WhatsApp, forma e prazo de pagamento, limite de crédito, segmento, `company_id`. |
| **Empresa que fatura** | `orders.seller_company_id` · `representative_orders.company_id` | A regra 2 do briefing — não confundir COFICO com Café Saporino Ltda. — **já está no banco**. |
| **Papéis e isolamento** | `user_roles` + `has_role(papel, company_id)` | Seis papéis cadastrados, RLS por empresa provada no módulo promotor. |
| **Rastreamento** | `/rastrear` (`TrackingPage`) | Existe e é público por código. |
| **Minha Conta** | `UserProfile` | Hoje mostra **só histórico de pedidos**. |
| **Documentos** | `representative_documents`, `invoices`, bucket `invoices` (privado) | Há estrutura de documentos por representante e de nota fiscal. |

---

## 2. A lacuna central — e é uma só

**A ficha PJ não tem dono.**

```
representative_clients.representative_id  →  pertence a um REPRESENTANTE
representative_clients.user_id            →  NÃO EXISTE
```

Hoje um cliente PJ é um registro que **um representante criou e enxerga**. Não há como o
próprio cliente entrar e ver a ficha dele, porque não existe ligação entre a empresa
cadastrada e uma conta de login.

Isso explica, de uma vez, por que ainda não há autocadastro: **não é tela que falta, é o
vínculo.** Tudo o mais já está no lugar.

A segunda consequência: `representative_id` é obrigatório hoje. Um cliente que se cadastra
sozinho não tem representante — e precisa poder existir assim, para depois ser atribuído a um.

---

## 3. Riscos da migração

### Risco alto — o menu que some antes da hora (regra 7)

Os atalhos de **Admin** e **RepCo** no site da Saporino estão em **quatro lugares** do
`App.tsx` (menu de desktop em duas variações e menu mobile). Tirar os atalhos **não** tira as
rotas — `/admin` e `/repco` continuam funcionando por URL direta, que é o que você pediu.

**O risco real é outro:** hoje é por esses botões que você e a equipe entram. Se sumirem antes
de a entrada pela COFICO existir e estar testada, vocês ficam sem porta visível. A ordem tem
de ser **criar a nova entrada, validar, e só então remover a antiga** — nunca o contrário.

### Risco alto — cliente PJ vendo o que não deve

Um cliente PJ autenticado é um tipo de usuário que **ainda não existe**. Quando existir, a RLS
precisa responder a uma pergunta nova: *"esta pessoa pode ver esta ficha?"*. Hoje a resposta é
sempre "só o representante dono ou o admin".

Mexer na RLS de `representative_clients` é mexer na tabela que o RepCo inteiro usa. **Isso
pede bancada antes e depois**, como foi feito no WhatsApp.

### Risco médio — documento público × restrito (regra 6)

A ficha da Café Saporino Ltda. contém **CPF dos sócios e dados bancários**. Isso não pode
cair numa área que o cliente baixa. Precisa de uma classificação explícita por documento, e
o padrão tem de ser **restrito** — documento novo nasce fechado, e alguém abre de propósito.

### Risco médio — duas marcas, uma venda

O cliente entra pela COFICO e compra Saporino. O pedido é da COFICO ou da Saporino? O briefing
diz que **cada pedido respeita a empresa vendedora efetiva**. O banco já suporta
(`seller_company_id`), mas **a regra de negócio é sua** — ver §6.

### Risco baixo — convite reaproveitado

`lv_convites` é do Coffee LiVRE. Usar a mesma tabela para dois produtos mistura propósitos.
Melhor: **mesma mecânica, tabela própria**, copiando o desenho que já provou funcionar.

---

## 4. Plano por etapas

A ordem prioriza o cadastro PJ, como você pediu, e deixa a mexida nos menus por último —
porque é a única irreversível no dia a dia de vocês.

### Etapa 1 — o vínculo (a fundação)

Sem isto nada mais existe.

- `representative_clients.user_id` → a conta que representa a empresa
- `representative_id` passa a ser **opcional** (cliente sem representante é legítimo)
- `origem` do cadastro: `representante` | `autocadastro`
- `status_cadastro`: `rascunho` → `em_analise` → `aprovado` | `recusado`
- RLS: o cliente PJ lê e edita **só a própria ficha**, e só enquanto `rascunho`
- Papel novo `cliente_pj`

**Bancada obrigatória:** cliente PJ não vê ficha de outro, não vê preço de custo, não entra
no RepCo, não vê pedido de terceiro. E o representante continua enxergando os dele como hoje.

### Etapa 2 — convite e primeiro acesso (regras 3 e 4)

**Correção do que eu havia proposto:** eu ia criar uma tabela `convites_pj` nova. Não é
preciso — e seria errado. A tabela `repco_invite_codes` **já é unificada por `role_code`**
(hoje `representante` e `promotor`), e a tela de Convites **já tem seletor de função**.
Entra um quarto valor, `cliente_pj`, na mecânica que já funciona. Ver §8.

- `role_code = 'cliente_pj'` em `repco_invite_codes` + uma RPC `repco_generate_invite_pj`
  no molde da do promotor (que já aceita `company_id`)
- A opção "Cliente PJ (COFICO)" entra no seletor que já existe
- Página pública `/cadastro` → valida o código → cria a conta → abre o formulário da empresa
- Acompanhamento do andamento pelo próprio cliente

**O que precisa ser adaptado** (detalhado no §8): prender o convite ao e-mail, guardar só o
hash, e consertar as duas policies de RLS que hoje deixam `gerente_comercial` e `supervisor`
gerarem código de **qualquer** papel.

### Etapa 3 — área do cliente PJ

- `/minha-empresa`: ficha, status, pedidos **da empresa**, documentos
- Rastreamento de pedido (regra 9) — reaproveita `/rastrear`

### Etapa 4 — documentos (regras 5 e 6)

- `documentos_empresa` com `visibilidade`: `publico` | `restrito` (**padrão restrito**)
- Download em PDF, exportação CSV, envio por e-mail (Resend já está no ar)
- Bucket privado com URL assinada de validade curta — nunca link público

### Etapa 5 — Minha Conta PF × PJ (regra 8)

- `UserProfile` passa a mostrar **só o que se aplica**: quem é PJ vê a empresa, quem é PF vê
  os pedidos dele. Hoje mostra só histórico de pedidos, para todo mundo.

### Etapa 6 — entrada por COFICO (regra 7) — **por último**

- Entrada de Admin e RepCo no site da COFICO
- Validar que todo mundo entra por lá
- **Só então** remover os quatro atalhos do site da Saporino
- Rotas e permissões intactas o tempo todo

---

## 5. O que dá para reaproveitar, em números

| | |
|---|---|
| Convite de uso único | **100%** — mecânica pronta, só copiar o desenho |
| Ficha cadastral PJ | **~90%** — faltam `user_id`, origem e status |
| Empresa que fatura | **100%** — já no banco |
| Papéis e RLS | **100%** — falta um papel novo |
| Rastreamento | **100%** |
| Envio de e-mail | **100%** — Resend no ar |
| Minha Conta | **~30%** — existe, mas só pedidos |
| Documentos do cliente | **~20%** — há estrutura por representante, não por cliente |

---

## 6. Decisões que dependem de você

Sem estas respostas eu construo chutando, e chute vira retrabalho.

**a) Quem fatura o quê.** Cliente entra pela COFICO e compra Saporino: o pedido é faturado
pela Saporino (a dona da marca) ou pela COFICO (que revende)? Isso muda nota, estoque e
comissão. O banco aceita os dois.

**b) O cadastro é aprovado por quem?** Autocadastro aprovado por admin, por gerente comercial,
ou automático se o CNPJ estiver ativo?

**c) Cliente sem representante pode comprar?** Ou todo PJ precisa ser atribuído a um rep antes
do primeiro pedido? Isso decide se a comissão tem dono.

**d) Qual tabela de preço ele vê** antes de ter segmento definido? Hoje o preço vem do
segmento (`distribuidora`, marketplaces). Um cliente novo não tem.

**e) Quais documentos são públicos** na área do cliente? Minha sugestão de ponto de partida:
cartão CNPJ, inscrição estadual e certidões **públicas**. **Nunca** CPF de sócio, contrato
social com dados pessoais, ou dados bancários completos.

**f) O convite é só por e-mail** ou também por WhatsApp? (O WhatsApp está pausado, mas o
desenho muda se a resposta for sim.)

---

## 7. O que eu faria primeiro

**A Etapa 1.** É a fundação, é onde mora o risco de segurança, e é a única que, nascendo
errada, obriga a refazer o resto.

E dentro dela, antes de qualquer tela: **a bancada de isolamento do cliente PJ**. O mesmo
caminho do WhatsApp — provar com usuários de verdade e JWT de verdade que um cliente não
alcança o que não é dele, *antes* de existir cliente de verdade.

Aguardando sua aprovação e as respostas do §6.

---

## 8. O gerador de códigos de acesso — investigação

> Você pediu para procurar antes de construir. **Você estava certo: existe.** E não é um,
> são **dois**, os dois operacionais. Nada foi alterado nesta investigação.

### Gerador A — Convites do RepCo (o principal)

**Existe, está operacional, e está visível no menu** — não foi escondido.

| | |
|---|---|
| **Onde fica** | `/admin` → aba **RepCo** → painel recolhível **"Convites (representante, promotor e Coffee LiVRE)"** |
| **Código** | [`RepCoInviteCodes.tsx`](src/components/admin/RepCoInviteCodes.tsx), montado em [`RepCoManagement.tsx:990`](src/components/admin/RepCoManagement.tsx:990) |
| **Tabela** | `repco_invite_codes` — `code, note, created_by, expires_at, used_by, used_at, role_code, company_id` |
| **Gera** | `repco_generate_invite` (representante) · `promoter_generate_invite` (promotor, aceita `company_id`) |
| **Valida/consome** | `repco_validate_invite` → `repco_register_representative` · `promoter_validate_invite` |
| **Lista / apaga** | `repco_list_invites`, `promoter_list_invites` · `repco_delete_invite`, `repco_revoke_invite` |

**Como funciona hoje:** o admin escolhe a função num seletor, escreve uma nota opcional
("para quem?"), e o banco gera um código de **6 caracteres** (`upper(substr(md5(random()),1,6))`),
em laço até não colidir. **Uso único** (`used_by` é preenchido no consumo, com `FOR UPDATE`
travando a linha) e **validade de 24 horas**. A tela mostra o código grande, com botão de
copiar, para enviar por WhatsApp. O representante digita em `/repco`; o promotor, em `/promotor`.

**Quem pode gerar:** as RPCs exigem `is_admin()` — `raise exception 'apenas admin'`.

**Estado real em produção:** 3 códigos, todos de **promotor** (2 usados, 0 válidos). Zero
códigos de representante já emitidos. Ou seja: o caminho do promotor foi usado de verdade;
o do representante está construído mas nunca rodou em produção.

### Gerador B — Convites do Coffee LiVRE

**Existe, operacional, nunca usado em produção** (0 convites, 0 convidados).

| | |
|---|---|
| **Onde fica** | mesma tela, terceiro botão do seletor: **"Coffee LiVRE (convidado)"** |
| **Código** | [`ConvitesCoffeeLivre.tsx`](src/components/admin/ConvitesCoffeeLivre.tsx) + Edge Function [`lv-convite`](supabase/functions/lv-convite/index.ts) |
| **Tabelas** | `lv_convites` (o convite) + `lv_convidados` (a conta que nasce dele) |
| **Resgate** | [`AccessGate.tsx`](src/pages/coffeelivre/AccessGate.tsx), no rodapé da COFICO e em `/coffeelivre` |

**É tecnicamente superior ao A**, em quatro pontos que importam para o PJ:
1. **Preso ao e-mail** — o convite nasce com nome, empresa e e-mail do convidado;
2. **Só o hash é guardado** — nem o admin relê um código já emitido;
3. **Escrita só pela Edge Function** (service role), não pelo navegador;
4. Tem **ciclo de vida completo**: `pendente → usado | cancelado | substituido`, com
   "perdi meu código" que gera um novo e cancela o anterior, e contador de reenvios.

### Respondendo exatamente o que você perguntou

| Pergunta | Resposta |
|---|---|
| O gerador existe? | **Sim, dois.** |
| Onde fica? | `/admin` → aba **RepCo** → painel "Convites". Os dois na mesma tela. |
| Qual rota/tela? | `/admin` (aba RepCo) para gerar. Resgate: `/repco`, `/promotor`, `/coffeelivre`. |
| Como funciona? | Código de 6 caracteres, uso único, 24 h, gerado no banco, só admin gera. O do LiVRE é preso ao e-mail e guardado como hash. |
| Dá para reaproveitar no PJ? | **Sim — e é o caminho certo.** `repco_invite_codes` já tem `role_code`, e a tela já tem seletor. Entra `cliente_pj`. |
| Está operacional, incompleto, desativado ou escondido? | **Operacional e visível.** Nada desativado, nada escondido. O caminho do representante nunca foi exercido em produção. |

### O que precisa ser corrigido antes de usar no PJ

**🔴 Falha de permissão — a mais importante.** As duas policies de RLS de
`repco_invite_codes` em produção são:

```
repco_invite_codes_ger_all  →  has_role('gerente_comercial')  →  ALL
repco_invite_codes_sup_all  →  has_role('supervisor')         →  ALL
```

`ALL`, sem restrição de `role_code`. Enquanto as RPCs (`SECURITY DEFINER`) exigem
`is_admin()`, **as policies permitem escrita direta na tabela** por gerente e supervisor —
e nada ali impede inserir uma linha com o `role_code` que a pessoa quiser. É exatamente o
"misturar permissões de clientes, representantes e administradores" que você pediu para
evitar. **Corrigir isto é pré-requisito**, e vale para os papéis que já existem, não só
para o PJ.

**🟠 O código vai no claro.** `repco_invite_codes.code` é texto legível. Quem lê a tabela
lê o código. O Coffee LiVRE já resolveu isso com hash — vale trazer o mesmo padrão.

**🟠 Não é preso a ninguém.** O código do RepCo vale para **quem o digitar primeiro**; a
nota "para quem?" é só lembrete. Para cliente PJ, o convite deve nascer preso ao e-mail,
como no LiVRE.

**🟡 24 h é curto para empresa.** Faz sentido para um rep que você está contratando agora;
é pouco para um comprador que precisa reunir CNPJ, IE e dados bancários. Sugiro validade
configurável, com padrão de 7 dias para PJ. **Sua decisão.**

### Recomendação

**Reaproveitar o A na estrutura, o B na segurança.** Ou seja: continuar na tabela
`repco_invite_codes` com `role_code = 'cliente_pj'` (uma tabela de convites, não três), mas
adotando do Coffee LiVRE o hash, o vínculo com o e-mail e a escrita só por Edge Function.
E consertar as duas policies antes de qualquer coisa.

**Não vou criar um terceiro gerador.**
