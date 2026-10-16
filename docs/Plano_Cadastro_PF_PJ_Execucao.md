# Cadastro PF e PJ — plano de execução, migrations e testes

> 15/10/2026. **Nada implementado. Nada em produção. Nada na `main`.**
> WhatsApp não tocado · preços e promoções não alterados · nenhum serviço pago contratado ·
> nenhum dado excluído · nenhum gerador novo criado.
>
> Substitui o plano do §4 de [`Portal_PJ_Diagnostico_e_Plano.md`](docs/Portal_PJ_Diagnostico_e_Plano.md),
> incorporando suas duas decisões: convite para PJ / aberto para PF, e **COFICO como porta
> central com escolha de marca pelo próprio cliente**.

---

## 0. 🚨 Achado crítico — muda a ordem de tudo

**Qualquer pessoa cadastrada pode se tornar administrador do sistema inteiro, sozinha.**

Isto não é teoria. Provei em staging, com login real e JWT de verdade, sem chave de serviço:

```
— A PERGUNTA: ele consegue se promover a admin? —
  FALHA  o banco RECUSA o cliente virar admin — ESCALADA DE PRIVILEGIO CONFIRMADA
  >>> um cliente comum acabou de virar ADMIN do sistema inteiro.
  >>> a partir daqui is_admin() devolve true para ele em TODA policy.
  >>> ja consegue listar representative_clients: 12 ficha(s).
  >>> desfeito na hora (is_admin volta a false).
```

Bancada: [`scripts/auditoria-escalada-de-privilegio.mjs`](scripts/auditoria-escalada-de-privilegio.mjs)

### A causa, em duas linhas

```sql
-- is_admin() lê a coluna do próprio perfil do usuário:
SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true);

-- e a policy deixa o usuário escrever na própria linha, sem restringir a coluna:
policy "Users fully manage profile"  FOR ALL  USING (auth.uid() = id)   -- WITH CHECK: nenhum
```

Em Postgres, policy `FOR ALL` sem `WITH CHECK` usa o `USING` como verificação de escrita.
Como o `USING` só pergunta *"é a sua linha?"*, e não *"que coluna você está mexendo?"*, o
`update user_profiles set is_admin = true where id = auth.uid()` é aceito.

### Por que isso trava o seu item 6 (cadastro PF aberto)

Hoje há **6 contas** no banco, todas conhecidas. O risco existe, mas é contido.

Você pediu **cadastro PF aberto ao público, sem convite** — que é a decisão comercial certa.
Mas no desenho atual **cada cadastro novo é uma pessoa com o poder de virar admin** e
alcançar ficha de cliente, custo de produto, margem, comissão e dados de representante.

**Abrir o cadastro antes de fechar isso seria entregar a chave junto com a porta.**

Por isso proponho uma alteração à sua ordem do item 7: a correção da escalada vira **Etapa 0**,
antes da RLS dos convites. Leva menos tempo que a dos convites e protege muito mais.

### Como corrigir (duas camadas, porque uma só não basta)

1. **Fechar a policy** — o usuário continua editando o próprio perfil, mas não pode alterar
   `is_admin`. Em Postgres isso se faz com `WITH CHECK` comparando a coluna com o valor já
   gravado, porque policy não restringe coluna por si só.
2. **Tirar `is_admin()` de `user_profiles`** — a verdade sobre papéis já mora em `user_roles`
   (que tem RLS própria e o usuário não escreve). `is_admin()` passa a ler de lá. Mesmo que
   a camada 1 falhasse um dia, a coluna deixaria de valer alguma coisa.

A camada 2 é a que resolve de verdade; a 1 é o cinto de segurança. E ela pede atenção:
`is_admin()` é usada por dezenas de policies. A migration precisa manter **exatamente** o
mesmo resultado para quem já é admin hoje — por isso o teste do §4 compara antes e depois,
admin por admin.

**Produção segue exposta até você autorizar.** O número de contas é pequeno e todas são
conhecidas, mas é importante que você saiba o estado real.

---

## 1. Segundo achado confirmado — o telefone some

Na mesma bancada:

```
— o telefone do cadastro e mesmo perdido? —
  FALHA  o celular informado no cadastro chega ao perfil — gravado: {"full_name":"Teste Fone","phone":null}
```

O formulário pede, o `signUp` envia, e o gatilho grava só o nome. Confirmado com dado real,
não por leitura de código.

---

## 2. A estrutura de marcas — preciso corrigir uma premissa sua

Você escreveu: *"Café Saporino"* e *"Tropeiro Paulista"* como as duas opções de marca.

**Olhando o banco, elas não são duas empresas — são a mesma.** Tropeiro Paulista é uma
**linha de produto** da Café Saporino Ltda:

```
products.product_line:
  Tropeiro Paulista Tradicional    7 produtos
  Tropeiro Paulista Extra Forte    1 produto
  Saporino Clássico                1 produto
```

As pessoas jurídicas que faturam são outras coisas (`companies`): **Café Saporino Ltda**
(CNPJ 61.109.694/0001-94, prefixo `CS`) e **Café Fazendinha Ltda** (CNPJ 37.856.623/0001-70).
E há ainda `distributed_brands` — as marcas que a COFICO distribui: Café Saporino, Café
Fazendinha, Café Canaan (inativa).

**Isto não invalida o que você pediu — confirma.** Sua própria regra 3 diz *"não confundir
marca comercial com pessoa jurídica responsável pelo faturamento"*, e é exatamente o caso:
se o cliente escolher "Tropeiro Paulista", **quem fatura continua sendo Café Saporino Ltda**.
A escolha registra **relacionamento comercial**, não rota de faturamento.

É a mesma lição do incidente do Studio (peça da Capital saiu como Saporino): marca é
etiqueta, CNPJ é quem emite a nota. Precisam viver em campos diferentes, e vão.

**Decisão sua (§6-a):** a lista de marcas deve ser **as linhas de produto** (Saporino
Clássico, Tropeiro Paulista…) ou **as marcas distribuídas** (Saporino, Fazendinha)? São
perguntas diferentes para o cliente, e a resposta muda a tabela.

---

## 3. Migrations necessárias

Todas em **staging primeiro**, via `node scripts/coffeelivre-staging.mjs migrar`. Nenhuma
toca em preço, promoção, pedido existente ou dado de cliente.

### Etapa 0 — segurança (sem isto, nada mais sobe)

**`fechar_escalada_de_privilegio.sql`**
- `WITH CHECK` na policy de `user_profiles` impedindo alteração de `is_admin`
- `is_admin()` passa a ler de `user_roles` (`role_code='admin' and is_active`)
- **Antes**: garantir que todo admin atual de `user_profiles` tem linha em `user_roles`
  (hoje: 3 papéis em uso — admin, promotor, representante). Um admin que ficasse de fora
  perderia o acesso — é o risco desta migration, e o teste do §4 existe para pegá-lo.

**`rls_convites_por_papel.sql`** — a falha que você já conhecia
- Trocar as duas policies `ALL` (`gerente_comercial`, `supervisor`) por permissão restrita
- **Verifiquei: nenhuma funcionalidade usa essas policies.** Todas as RPCs
  (`repco_generate_invite`, `promoter_generate_invite`, `repco_list_invites`,
  `promoter_list_invites`, `repco_delete_invite`, `repco_revoke_invite`) são
  `SECURITY DEFINER` e exigem `is_admin()`. A Edge Function `promoter-signup` usa service
  role. **Nada legítimo se perde** — era permissão sem uso, aberta por acidente.
- **`CHECK` em `role_code`** — hoje **não existe nenhum** (confirmado em `pg_constraint`:
  só PK, UNIQUE em `code` e FK de `company_id`). Qualquer string entra. Adicionar
  `check (role_code in ('representante','promotor','cliente_pj'))` é o que impede,
  estruturalmente, um convite PJ conceder papel administrativo — seu item 5.

### Etapa 1 — persistência do cadastro PF

**`cadastro_pf_cpf_e_telefone.sql`**
- `user_profiles`: `cpf text` (único, só dígitos), `account_type`, `cpf_conferido_em`
- Corrigir `handle_new_user()` para gravar o celular que já é coletado
- Função `cadastro_completo(uuid)` **no banco** — nome + e-mail + celular + CPF válido.
  No banco, não no navegador, porque é ela que vai autorizar o desconto
- Validação de CPF em PL/pgSQL (dígitos verificadores), espelhando `src/lib/cpf.ts`
- **Sem serviço pago**, como você determinou. A tela dirá "CPF válido", não "CPF verificado"

### Etapa 2 — convite e cadastro PJ pela COFICO

**`convite_cliente_pj.sql`**
- `role_code = 'cliente_pj'` no `CHECK` acima
- RPC `repco_generate_invite_pj(p_note, p_email, p_company)` — no molde da do promotor,
  **preso ao e-mail** e guardando **hash** do código (padrão do Coffee LiVRE)
- Validade configurável, padrão **7 dias** (24 h é pouco para o comprador reunir CNPJ e IE)
- `created_by` já existe → **o vínculo com quem convidou já está resolvido** (seu item 1)
- RPC `repco_validate_invite_pj` filtrando `role_code='cliente_pj'` — não serve para entrar
  como representante nem promotor, do mesmo jeito que os outros não servem entre si

**`cliente_pj_dono_da_ficha.sql`**
- `representative_clients.user_id` — **a lacuna central**: hoje a ficha PJ não tem dono
- `representative_id` passa a ser opcional (cliente sem rep é legítimo)
- `origem` (`representante` | `autocadastro`), `status_cadastro`
  (`rascunho`→`em_analise`→`aprovado`|`recusado`)
- Papel `cliente_pj` em `user_roles`
- RLS: o cliente lê e edita **só a própria ficha**, e só enquanto `rascunho`
- **Crédito, prazo e limite ficam de fora do que o cliente edita** (seu item 1 e 3):
  `limite_credito`, `credito_score`, `forma_pagamento` e `prazo_pagamento` continuam
  exclusivos do admin. O cadastro não concede nada automaticamente

**`marca_escolhida_pelo_cliente.sql`** — seu item 2
- `cliente_marcas`: `cliente_id`, `marca_id`, `escolhida_em`, `escolhida_por`, `ativa`
  — tabela de ligação, porque você pediu **múltipla escolha**
- Histórico preservado: trocar de marca não apaga a anterior, desativa (seu item 2:
  *"poderá ser atualizada posteriormente"*, e seu item 5 pede *"histórico de relacionamento"*)
- **Marca ≠ faturamento:** `seller_company_id` do pedido continua decidido pela empresa
  vendedora, **nunca** pela marca escolhida. São colunas diferentes de propósito

### Etapa 3 — desconto exclusivo (não altera preço nenhum)

**`preco_exclusivo_cadastrado.sql`**
- Coluna de preço exclusivo **fora** da view `products_com_disponibilidade`, que tem
  `grant select to anon` e é literalmente a API pública que sua regra proíbe de expor
- Autorização dentro de `priceCheckout()` — **o único lugar que decide preço**, por onde
  carrinho e checkout já passam
- **Nenhum percentual definido, nenhum desconto ativado.** A estrutura nasce vazia e inerte
  até você autorizar o número (§6-c)
- As 4 promoções públicas atuais **não são tocadas**

### Etapa 4 — consentimento (seu item 6)

**`consentimentos.sql`**
- Tabela de eventos (concessão e revogação são eventos, não um booleano sobrescrito)
- `tipo` (`termos` | `whatsapp_promocional`), `versao_texto`, `concedido_em`, `revogado_em`,
  `origem`
- WhatsApp promocional **separado, desmarcado por padrão, revogável**, e **nunca** condição
  para cadastrar, comprar ou ter desconto

> Esta etapa não toca na integração WhatsApp pausada. É registro de consentimento no banco,
> outra coisa.

---

## 4. Testes de segurança

Bancadas que vão junto com as migrations, no padrão que já usamos (usuário real, JWT real,
nunca service role para provar permissão).

### Já existe e já rodou

| Bancada | Prova |
|---|---|
| [`auditoria-escalada-de-privilegio.mjs`](scripts/auditoria-escalada-de-privilegio.mjs) | cliente comum não vira admin · celular chega ao perfil · **hoje falha nos dois** |

### A construir

**`auditoria-convites-por-papel.mjs`**
- gerente e supervisor **não** inserem convite direto na tabela
- nenhum papel fora da lista entra em `role_code` (o `CHECK` recusa)
- convite `cliente_pj` **não** serve para entrar como representante nem promotor
- convite de representante **não** serve para entrar como cliente
- admin continua gerando os três normalmente *(não quebrar o que funciona)*
- código usado uma vez não serve de novo · código expirado não serve

**`auditoria-cliente-pj.mjs`**
- cliente PJ **não** vê ficha de outro cliente
- cliente PJ **não** vê custo de produto, margem, comissão ou dado de representante
- cliente PJ **não** entra no RepCo nem no Admin
- cliente PJ **não** escreve `limite_credito`, `credito_score`, `forma_pagamento`,
  `prazo_pagamento` — nem na própria ficha
- cliente PJ **não** muda o `seller_company_id` de um pedido escolhendo marca
- o representante continua enxergando os clientes dele exatamente como hoje

**`auditoria-preco-exclusivo.mjs`** *(quando a Etapa 3 for autorizada)*
- `anon` não alcança o preço exclusivo: na view, na API REST, no HTML e no checkout
- visitante não autenticado paga o preço normal mesmo forjando o valor no navegador
- cadastro incompleto **não** libera o desconto
- os quatro caminhos, como foi feito na auditoria de acesso público do RepCo

**`auditoria-papeis-antes-e-depois.mjs`** — o teste que protege a Etapa 0
- lista quem é admin **antes** da migration de `is_admin()`
- roda a migration
- confirma que **exatamente as mesmas pessoas** continuam admin — nem uma a mais, nem uma
  a menos

---

## 5. Plano de implementação em staging

| Passo | O que acontece | Reversível? |
|---|---|---|
| 1 | Bancada do §4 roda **antes**, em staging, registrando o estado atual | — |
| 2 | Etapa 0 (escalada + convites + CHECK) | sim |
| 3 | Bancadas de segurança: escalada e convites passam | — |
| 4 | Etapa 1 (CPF e telefone) | sim |
| 5 | Etapa 2 (convite PJ + dono da ficha + marcas) | sim |
| 6 | `auditoria-cliente-pj` passa inteira | — |
| 7 | Telas: cadastro PJ na COFICO, perfil, quarto botão no gerador | sim |
| 8 | Verificação **na tela**, com dev server de staging, rastreando banco→query→estado→componente | — |
| 9 | Etapas 3 e 4, **se autorizadas** | sim |
| 10 | Relatório para você decidir sobre produção | — |

**Produção só depois da sua autorização explícita, item a item.** A Etapa 0 é a única que
eu recomendo acelerar, pelo motivo do §0.

---

## 6. O que depende da sua autorização

### 🔴 Precisa de decisão para a Etapa 0 começar

**a) Autoriza a correção da escalada de privilégio?** É a Etapa 0, e enquanto não for feita
o cadastro PF aberto não deveria subir. Posso fazer em staging hoje e te mostrar a bancada
passando — e aí você decide produção com a prova na mão.

### 🟠 Precisa de decisão para o plano ficar correto

**b) A lista de marcas é linha de produto ou marca distribuída?** (§2) Hoje "Tropeiro
Paulista" é linha da Saporino, não empresa. Minha recomendação: **linha de produto**, que é
o que o comprador reconhece na embalagem — e o faturamento continua decidido pelo
`seller_company_id`, intacto.

**c) O percentual do desconto exclusivo.** Sem ele a Etapa 3 nasce inerte, como você pediu.

**d) Validade do convite PJ.** Recomendo 7 dias. Você decide.

**e) Links oficiais do Mercado Livre**, por produto. Preciso que venham de você — não vou
inventar URL de anúncio.

**f) O cliente PJ aprovado por quem?** Admin, gerente comercial, ou automático se o CNPJ
estiver ativo na Receita? (A consulta de CNPJ já existe e é gratuita.)

### 🟡 Pode esperar

**g) Quais documentos o cliente PJ vê** no portal. Ponto de partida que sugiro: cartão CNPJ,
IE e certidões públicas. **Nunca** CPF de sócio, contrato social com dados pessoais ou
dados bancários completos. Padrão: **restrito** — documento nasce fechado.

**h) Retenção da visita identificada.** Sugiro 12 meses, depois agregar.

---

## 7. O que eu faria agora

**A Etapa 0, em staging, hoje.** É pequena, é reversível, e é a única coisa aqui que já
está exposta em produção neste momento.

Depois te mostro a bancada passando e você decide o resto com a prova na mão, em vez de
decidir pela minha descrição.

Aguardando sua autorização.
