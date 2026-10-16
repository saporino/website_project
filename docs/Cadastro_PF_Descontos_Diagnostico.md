# Cadastro PF, desconto para cadastrados e captação — diagnóstico

> 15/10/2026. **Nada implementado.** Diagnóstico para sua aprovação.
> Produção intocada, nada publicado, nada na `main`, WhatsApp comercial e central RepCo
> não tocados, nenhum desconto criado, nenhuma conta ou dado excluído.

**Divisão confirmada:** **CPF = conta PF** (loja Saporino) · **CNPJ = cliente PJ** (COFICO).
São dois cadastros separados, como você pediu na regra 12. O PJ está em
[`Portal_PJ_Diagnostico_e_Plano.md`](docs/Portal_PJ_Diagnostico_e_Plano.md).

---

## 1. A boa notícia: a parte difícil já está pronta

A regra 5 — *não expor desconto em API pública e validar a autorização no backend,
inclusive no carrinho e no checkout* — é normalmente o trabalho mais pesado e arriscado.
**Aqui ela já está resolvida na arquitetura**, e não foi por acaso: tem comentário no
código dizendo exatamente isso.

```
supabase/functions/_shared/pricing.ts
  "O frontend NUNCA é fonte de verdade do preço."
  priceCheckout() ignora qualquer preço enviado pelo cliente e recalcula do banco.

supabase/functions/create-checkout-order/index.ts:100
  busca price e promotional_price do banco e refaz a conta.
  Cupom: "A tela mostra; o servidor decide."
```

O pedido **nasce no servidor**. Quem adulterar o preço no navegador não muda nada. Então o
desconto de cadastrado não precisa de uma trava nova — precisa **entrar nessa trava que já
existe**, num único lugar.

### O que mais já existe

| Peça | Onde | Estado |
|---|---|---|
| **Preço server-side** | `_shared/pricing.ts` + `create-checkout-order` | ✅ pronto |
| **Cupons de desconto** | `coupons`, `coupon_redemptions`, RPC `validar_cupom` | ✅ **pronto** (1 cupom ativo) — tipos: percentual, valor fixo, frete grátis, mínimo de subtotal, primeira compra, limite de usos, validade |
| **Preço promocional** | `products.promotional_price` → view `products_com_disponibilidade` | ✅ funciona (4 de 15 produtos em promoção) |
| **Validação de CPF** | [`src/lib/cpf.ts`](src/lib/cpf.ts) | ✅ máscara + dígitos verificadores, com testes |
| **Consulta de CNPJ** | [`src/lib/cnpjLookup.ts`](src/lib/cnpjLookup.ts) — BrasilAPI, grátis | ✅ pronto (serve ao PJ) |
| **Login / cadastro** | `AuthModal` + `AuthContext` | ✅ funciona |
| **Minha Conta** | `UserProfile` | ⚠️ só histórico de pedidos |
| **E-mail transacional** | Resend + Workspace | ✅ no ar |

> **Dois itens do CLAUDE.md estão desatualizados** e vale corrigir: o §8 lista
> *"cupons/código de desconto no checkout (ausente)"* — **existe e funciona, com RPC de
> validação no servidor**. E lista a numeração `PF-`/`PJ-` como de e-commerce, o que
> segue correto.

---

## 2. Os problemas reais que encontrei

### 🔴 1. O cadastro não guarda CPF. A coluna não existe.

Em **produção**, `user_profiles` tem exatamente cinco colunas:

```
id · full_name · phone · is_admin · created_at
```

Não há `cpf`, não há `account_type`, não há `email`. Existem migrations antigas
(`20251116100000_add_user_profile_fields.sql`) que adicionam `cpf`, `account_type`,
`birth_date`, `cnpj`, `email_xml` — **mas nunca foram aplicadas em produção**. O banco de
verdade não as tem. Confirmei consultando a produção, não só lendo o código.

**Consequência que já está na tela:** [`UserProfile.tsx:115`](src/pages/UserProfile.tsx:115)
mostra um campo "CPF" lendo `profile.cpf`, e [`CustomersManagement.tsx`](src/components/admin/CustomersManagement.tsx)
lista `customer.email`. **Nenhum dos dois existe.** São campos fantasma: o código compila,
passa no build, e simplesmente não aparece nada. É o caso exato que o CLAUDE.md descreve —
*"uma coluna que ficou fora do select compila e passa, mas não funciona"*.

Isto é a fundação da regra 4. Sem a coluna, não há cadastro completo.

### 🔴 2. O celular que o cliente digita no cadastro é jogado fora

O formulário pede o telefone, o `signUp` manda em `raw_user_meta_data`
([`AuthContext.tsx:114`](src/contexts/AuthContext.tsx:114))… e o gatilho que cria o perfil
em produção grava **só o nome**:

```sql
-- handle_new_user(), como está no banco hoje
INSERT INTO public.user_profiles (id, full_name, is_admin)
VALUES (new.id, new.raw_user_meta_data->>'full_name', false);
```

Existe uma versão mais nova do gatilho numa migration de 2025 que também grava `phone` —
**não é a que está rodando**. Hoje: 6 perfis, e o celular se perde no caminho.

### 🟠 3. Não existe nenhum link de Mercado Livre no sistema (regra 6)

Procurei em todo o código e em todas as migrations. As únicas menções a Mercado Livre são
o simulador de tarifas do Coffee LiVRE e o segmento `ML` do B2B. **Não há coluna de link de
produto no marketplace.** Precisa ser criada, e **os links têm de vir de você** — não vou
inventar URL de anúncio, como você pediu.

### 🟠 4. Não há aceite de termos nem opt-in de WhatsApp (regras 8 e 9)

O cadastro tem quatro campos e nenhum checkbox. Não existe registro de consentimento, nem
data, nem versão de texto, nem canal de revogação. Para a regra 9 (data + versão do texto +
revogação) é tabela nova — e é o tipo de coisa que, se nascer errada, não tem como refazer
depois, porque não se pode inventar um consentimento retroativo.

### 🟠 5. Não há como o cliente pedir exclusão da conta (regra 7)

A página `/exclusao-de-dados` existe, mas é da **COFICO** e pede e-mail. A loja Saporino
não tem nem a página nem o mecanismo dentro da conta. Você pediu para **avaliar** se cabe
um mecanismo na própria conta: cabe, e é o caminho melhor — a LGPD não exige botão, mas o
pedido por e-mail depende de alguém ler e agir no prazo, e um botão que abre o pedido
registrado some com esse risco.

**Ponto de atenção fiscal:** nota emitida não pode ser apagada. O desenho correto é
**anonimizar o perfil e preservar o documento fiscal** — o titular exerce o direito, e a
obrigação legal (art. 16, I) continua cumprida. Nunca `delete` em cascata num pedido pago.

### 🟡 6. `site_visits` não sabe quem é o visitante (regra 11)

As colunas são `city, region, country, lat, lng, path, created_at`. 1.007 visitas, **sem
`user_id`**. Para identificar visita de autenticado é uma coluna nova — e aí entra a
minimização que você mesmo pediu: guardar o `user_id` e **não** o IP junto, com prazo de
descarte definido.

---

## 3. O CPF verdadeiro — e aqui eu preciso ser direto

Você pediu que o CPF seja **puxado de base real**, para o cliente não inventar. Faz todo
sentido, e é diferente do que existe hoje: `cpfValido()` só confere os dígitos
verificadores. `529.982.247-25` passa na conta e pode não ser de ninguém.

**O problema:** não existe consulta pública e gratuita de CPF no Brasil. Para CNPJ existe
(você já usa a BrasilAPI de graça) porque **dado de empresa é público**. CPF é dado
pessoal — a Receita não abre, e qualquer serviço que ofereça isso de graça está operando
base vazada. Não vou integrar nada disso.

**Os caminhos legítimos, e nenhum é gratuito:**

| Opção | O que devolve | Observação |
|---|---|---|
| **SERPRO — Consulta CPF** | nome, nascimento, situação | A fonte oficial da Receita. Por consulta, com contrato. |
| **SERPRO — Datavalid** | só **"confere / não confere"** | **A melhor para LGPD:** você manda CPF + nome + nascimento e recebe sim ou não. Nenhum dado pessoal novo entra no seu banco. É o que banco usa. |
| **Bureaus** (Serasa, BigDataCorp, Infosimples) | pacote de dados | Mais barato e mais fácil de contratar; traz mais dado do que você precisa, o que é um passivo, não um ganho. |

**Minha recomendação: Datavalid, modo verificação.** Porque responde exatamente à sua
preocupação — impede dado falso — sem puxar para dentro do seu banco informação que você
não precisa guardar. Confirmar que o CPF é daquela pessoa é suficiente; ter a base dela
não é.

**Três coisas antes de contratar qualquer uma:**

1. **Você não autorizou serviço pago, e eu não vou contratar.** Preciso da sua decisão e,
   provavelmente, do contrato via contador (Leonardo).
2. **Consulta a base de terceiro exige base legal específica.** É o mesmo ponto que já
   levantamos na política da COFICO sobre o score Serasa: autorização genérica de "aceito
   os termos" **não** cobre consulta a bureau. Precisa de aviso próprio e específico no
   cadastro.
3. **Enquanto não houver contrato**, o caminho sem custo e honesto é: `cpfValido()` (que já
   existe) + CPF **único** no banco + conferência no primeiro pedido, quando a nota é
   emitida e a Receita recusa CPF inválido de verdade. Isso não impede fraude deliberada,
   mas impede o caso comum, que é erro de digitação e CPF inventado na hora.

**Não vou dizer que validei o CPF se só conferi os dígitos.** A tela precisa dizer a
verdade sobre o que foi verificado.

---

## 4. Conflito de regra que preciso que você resolva

A regra 3 diz que o preço promocional **só aparece depois do cadastro completo**. Mas hoje
já existem **4 produtos com `promotional_price`**, visíveis para todo mundo, inclusive para
quem nunca se cadastrou.

Então há duas coisas diferentes com o mesmo nome:

- **promoção da loja** — vale para todos, aparece com o preço riscado (existe hoje);
- **preço de cadastrado** — exclusivo, só depois do cadastro completo (não existe).

**Não posso simplesmente transformar a promoção atual em exclusiva**: isso tiraria desconto
de quem compra hoje sem estar cadastrado, e seria mudar preço ao público sem você pedir.
Precisa ser um **segundo** conceito, convivendo com o primeiro.

**E o preço de cadastrado fica fora da view pública.** A `products_com_disponibilidade` tem
`grant select ... to anon` — é literalmente a API pública que a regra 5 proíbe de expor
desconto. O desconto de cadastrado não pode morar ali.

---

## 5. Plano de implementação

Na ordem em que eu faria. As duas primeiras etapas são pré-requisito de tudo.

### Etapa 1 — consertar a fundação do cadastro (sem isto, nada funciona)

- `user_profiles`: adicionar `cpf` (único), `account_type`, `cpf_verificado_em`
- Corrigir `handle_new_user()` para gravar o celular que já é coletado
- Fazer `UserProfile` e `CustomersManagement` lerem campos que existem (hoje leem fantasmas)
- Conceito de **cadastro completo**: nome + e-mail + celular + CPF válido, calculado **no
  banco**, nunca no navegador

### Etapa 2 — consentimento, antes de qualquer captação (regras 8 e 9)

- Aceite dos Termos + ciência da Privacidade: obrigatório, **registrado com data e versão
  do texto**
- WhatsApp promocional: checkbox **separado, desmarcado por padrão**, e **nunca** condição
  para cadastrar, comprar ou ter desconto
- Tabela de consentimentos com histórico — concessão e revogação são eventos, não um
  booleano que se sobrescreve
- Revogação acessível na própria conta

> Isto vem **antes** da captação de propósito. Captar primeiro e registrar depois é o erro
> que não se conserta.

### Etapa 3 — o desconto de cadastrado, protegido (regras 1, 2, 3 e 5)

- Campo de preço de cadastrado **fora** da view pública `anon`
- A autorização entra em **`priceCheckout()`**, que já é o único lugar que decide preço —
  carrinho e checkout passam os dois por ali, então cobrir um cobre os dois
- Vitrine para não autenticado: preço normal + **"Cadastre-se e compre com desconto."**
- Preço exclusivo só renderiza para sessão autenticada **e** cadastro completo
- **Bancada obrigatória:** provar que `anon` não alcança o preço exclusivo — na view, na
  API REST, no HTML e no checkout. Os quatro, como foi feito na auditoria de acesso público
  do RepCo

### Etapa 4 — alternativa Mercado Livre (regra 6)

- Coluna de link do anúncio por produto, preenchida no admin
- Botão só aparece para quem **não** está autenticado, e só em produto que tem link
- **Os links vêm de você.** Produto sem link não mostra botão

### Etapa 5 — direitos do titular (regra 7)

- Pedido de exclusão dentro da conta + página pública da Saporino
- Confirmação de identidade por e-mail
- Anonimização preservando nota fiscal
- Prazo de resposta de 15 dias, o mesmo que já assumimos nas páginas da COFICO

### Etapa 6 — visibilidade comercial (regras 10 e 11)

- E-mail do cliente no admin, lido de `auth.users` por RPC `SECURITY DEFINER` com
  `is_admin()` — nunca expondo a tabela
- `site_visits.user_id`, com minimização e prazo de descarte
- Verificação de CPF em base real, **se e quando** você contratar (§3)

---

## 6. Decisões que dependem de você

**a) O desconto de cadastrado é quanto?** Percentual único, por produto, ou por faixa de
pedido? *Não vou criar desconto nenhum sem sua autorização* — então sem este número a
Etapa 3 não começa.

**b) A promoção atual continua pública?** Minha recomendação: sim, continua, e o preço de
cadastrado é um segundo degrau. Mudar o que já está no ar é decisão sua. (§4)

**c) Verificação de CPF: contrata ou não?** Se sim, minha indicação é Datavalid em modo
"confere / não confere". Se não, seguimos com dígito verificador + CPF único, e **a tela
diz a verdade** sobre o que foi conferido. (§3)

**d) CPF é obrigatório para se cadastrar, ou só para fechar o pedido?** Pedir CPF na
primeira tela derruba cadastro; pedir no checkout é natural, porque é para a nota. Dá para
liberar o desconto só quando o cadastro estiver completo, **sem** travar a criação da conta.
Minha recomendação é essa.

**e) Quais produtos têm link no Mercado Livre?** Preciso dos links reais, de você.

**f) O desconto vale junto com cupom?** Hoje o cupom sai do subtotal. Desconto de
cadastrado + cupom pode empilhar. Minha recomendação: empilha, com piso de margem definido
por você.

**g) Retenção da visita identificada:** quanto tempo guardar? Sugiro 12 meses e depois
agregar.

---

## 7. O que eu faria primeiro

**Etapas 1 e 2, nessa ordem, antes de qualquer captação.**

A 1 porque hoje a tela mostra CPF de um campo que não existe e joga fora o celular que o
cliente digitou — é cadastro quebrado em silêncio, e tudo o mais se apoia nele.

A 2 porque consentimento não é retroativo. Se a loja começar a captar antes de existir o
registro de aceite com data e versão, cada cadastro novo é um que não tem como regularizar
depois.

A Etapa 3 é a que você quer de verdade — mas ela não funciona sem as duas primeiras, e é a
única que mexe em preço ao público.

Aguardando sua aprovação e as respostas do §6.
