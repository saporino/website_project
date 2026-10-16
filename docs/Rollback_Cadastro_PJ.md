# Recuperação — cadastro PJ (16/10/2026)

> Procedimento de volta, caso algo dê errado em produção. **Ler antes de executar.**
> Backup do estado anterior em `backups/producao-antes-cadastro-pj-2026-10-16-01-33-10.json`
> (fora do git: contém dados pessoais).

---

## Primeiro: não há o que desfazer na maior parte

Das 6 migrations, **5 só acrescentam**. Elas não apagam, não renomeiam e não alteram dado
existente:

| Migration | O que faz | Desfazer? |
|---|---|---|
| `...110000_convites_por_papel` | troca 2 policies + adiciona CHECK | sim, abaixo |
| `...120000_cliente_pj_cadastro` | colunas, tabela e funções novas | não precisa |
| `...130000_cadastro_pf_cpf_e_telefone` | colunas novas + 2 funções | parcial, abaixo |
| `...140000_listar_convites_pj` | 1 função nova | não precisa |
| `...150000_papel_cliente_pj` | 1 linha em `roles` | não precisa |
| `...100000_fechar_escalada_de_privilegio` | **muda `is_admin()` e policies** | sim, abaixo |

Colunas e tabelas novas não atrapalham quem não as usa. Deixar `cliente_marcas` ou
`representative_clients.user_id` no banco é inofensivo — e apagá-las é que seria
destrutivo. **Não reverter o que não precisa ser revertido.**

---

## Se o problema for perda de acesso de admin

**Sintoma:** alguém que era admin recebe "Acesso Negado" no `/admin`.

**Causa provável:** `is_admin()` agora lê `user_roles`, e a pessoa não tem a linha. O
backfill cobriu todo mundo (e o pré-voo confirmou que as duas fontes já concordavam, com
1 admin), mas se faltar alguém:

```sql
-- Conserto pontual, sem reverter nada. Esta é a PRIMEIRA opção.
insert into public.user_roles (user_id, role_code, is_active, granted_at)
select id, 'admin', true, now() from public.user_profiles
 where is_admin = true
   and not exists (select 1 from public.user_roles ur
                    where ur.user_id = user_profiles.id and ur.role_code = 'admin' and ur.is_active);
```

Isso resolve sem tocar em nada mais. Só se falhar é que se pensa em reverter.

---

## Reverter `is_admin()` para a fonte antiga

⚠️ **Isto reabre a escalada de privilégio.** Qualquer pessoa cadastrada volta a conseguir
se tornar administrador. Só usar se o site estiver inoperante e por tempo curto.

```sql
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (select 1 from public.user_profiles
                  where id = auth.uid() and is_admin = true);
$$;
```

A definição exata de antes está no backup, em `is_admin_antigo[0].def`.

---

## Reverter as policies de `user_profiles`

⚠️ Mesma ressalva: devolve ao usuário o poder de escrever `is_admin` na própria linha.

```sql
drop policy if exists "perfil_proprio_leitura"  on public.user_profiles;
drop policy if exists "perfil_proprio_insercao" on public.user_profiles;
drop policy if exists "perfil_proprio_edicao"   on public.user_profiles;

create policy "Users fully manage profile" on public.user_profiles
  for all using (auth.uid() = id);
```

---

## Reverter as policies de convites

Sem ressalva de segurança: devolve a gerente e supervisor a escrita direta que eles tinham
(e que nenhuma funcionalidade usava).

```sql
drop policy if exists repco_invite_codes_leitura_gestao on public.repco_invite_codes;
alter table public.repco_invite_codes drop constraint if exists repco_invite_codes_role_code_check;

create policy repco_invite_codes_ger_all on public.repco_invite_codes
  for all using (public.has_role('gerente_comercial'));
create policy repco_invite_codes_sup_all on public.repco_invite_codes
  for all using (public.has_role('supervisor'));
```

---

## Reverter o gatilho do cadastro

Só se gravar o celular causar algum problema inesperado — o que seria estranho, porque a
coluna já existia e estava vazia.

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, full_name, is_admin)
  values (new.id, new.raw_user_meta_data->>'full_name', false);
  return new;
end; $$;
```

---

## Tirar a página do ar sem mexer no banco

O caminho mais rápido e mais seguro de todos: **reverter o commit do site**. As rotas
`/cadastro` e `/minha-empresa` deixam de existir e ninguém mais entra, enquanto o banco
fica intacto e nenhum cadastro se perde.

```bash
git revert <commit> && git push origin main
```

Esta é a reversão a tentar **primeiro** em quase todo cenário: desliga a porta sem tocar
nos dados nem na segurança.

---

## Conferência depois de qualquer reversão

Contagens de antes da publicação — têm de bater:

```
perfis: 6 · clientes: 7 · pedidos_repco: 3 · pedidos_loja: 4 · papeis_ativos: 4 · representantes: 2
```

```sql
select (select count(*) from user_profiles)::int perfis,
       (select count(*) from representative_clients)::int clientes,
       (select count(*) from representative_orders)::int pedidos_repco,
       (select count(*) from orders)::int pedidos_loja,
       (select count(*) from user_roles where is_active)::int papeis_ativos,
       (select count(*) from representatives)::int representantes;
```

**Clientes PJ que se cadastrarem depois da publicação entram nessa conta** — `clientes`
maior que 7 é cadastro novo, não erro.
