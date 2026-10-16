-- =====================================================================
-- Fechar a escalada de privilégio em user_profiles (15/10/2026)
--
-- O PROBLEMA, provado em staging com login real:
--
--   is_admin()  →  SELECT ... FROM user_profiles WHERE id = auth.uid() AND is_admin
--   policy      →  "Users fully manage profile" FOR ALL USING (auth.uid() = id)
--                  ...sem WITH CHECK.
--
-- Em Postgres, policy FOR ALL sem WITH CHECK usa o USING como verificação de
-- ESCRITA. O USING só pergunta "é a sua linha?", nunca "que coluna você está
-- mexendo?". Resultado:
--
--   update user_profiles set is_admin = true where id = auth.uid();   -- aceito
--
-- Qualquer pessoa cadastrada virava administrador do sistema inteiro. Com o
-- cadastro PF aberto ao público isso deixaria de ser risco contido e passaria a
-- ser porta aberta.
--
-- A CORREÇÃO, em duas camadas (uma só não basta):
--
--   1. WITH CHECK na policy: o usuário segue editando o próprio perfil, mas o
--      valor de is_admin que ele grava tem de ser IGUAL ao que já está lá.
--   2. is_admin() deixa de ler user_profiles e passa a ler user_roles — tabela
--      que o usuário não escreve. Mesmo que a camada 1 falhasse, a coluna
--      deixaria de valer alguma coisa.
--
-- A camada 2 é a que resolve; a 1 é o cinto de segurança.
--
-- RISCO DESTA MIGRATION: is_admin() é usada por dezenas de policies. Se alguém
-- for admin por `user_profiles.is_admin` mas não tiver linha em `user_roles`,
-- perde o acesso ao trocar a fonte. Em staging esse caso EXISTE (o admin tem a
-- flag e não tem o papel). Por isso o backfill vem ANTES, e é idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Backfill: todo admin de hoje vira admin em user_roles
-- ---------------------------------------------------------------------
-- Sem isto, trocar a fonte do is_admin() tranca o próprio dono do sistema para
-- fora. Roda antes de qualquer outra coisa, de propósito.
insert into public.user_roles (user_id, role_code, is_active, granted_at)
select up.id, 'admin', true, now()
  from public.user_profiles up
 where up.is_admin = true
   and not exists (
     select 1 from public.user_roles ur
      where ur.user_id = up.id and ur.role_code = 'admin'
   );

-- Quem já tinha a linha mas desativada volta a valer — mesmo critério de antes.
update public.user_roles ur
   set is_active = true
  from public.user_profiles up
 where ur.user_id = up.id
   and ur.role_code = 'admin'
   and up.is_admin = true
   and ur.is_active = false;

-- Trava de segurança: se o backfill não cobriu todo mundo, a migration PARA.
-- Melhor abortar aqui do que descobrir o problema com o admin trancado do lado
-- de fora.
do $$
declare faltam int;
begin
  select count(*) into faltam
    from public.user_profiles up
   where up.is_admin = true
     and not exists (select 1 from public.user_roles ur
                      where ur.user_id = up.id and ur.role_code = 'admin' and ur.is_active);
  if faltam > 0 then
    raise exception 'Backfill incompleto: % admin(s) ficariam sem papel. Abortado.', faltam;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. is_admin() passa a ler a tabela que o usuário NÃO escreve
-- ---------------------------------------------------------------------
-- Mesma assinatura e mesmo resultado para quem já é admin — o backfill acima
-- garante isso. O que muda é de onde vem a verdade.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role_code = 'admin'
       and ur.is_active
  );
$$;

comment on function public.is_admin() is
  'Admin pelo papel em user_roles (que o usuário não escreve). Antes lia user_profiles.is_admin, que o próprio usuário podia alterar — escalada de privilégio fechada em 15/10/2026.';

-- ---------------------------------------------------------------------
-- 3. O usuário não altera mais o próprio is_admin
-- ---------------------------------------------------------------------
-- Policy não restringe coluna por si só. O jeito de impedir a alteração de UMA
-- coluna é comparar, no WITH CHECK, o valor novo com o que já está gravado.
drop policy if exists "Users fully manage profile" on public.user_profiles;

create policy "perfil_proprio_leitura"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "perfil_proprio_insercao"
  on public.user_profiles for insert
  with check (auth.uid() = id and coalesce(is_admin, false) = false);

create policy "perfil_proprio_edicao"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- is_admin precisa continuar valendo o que já valia. Promover a si mesmo,
    -- ou a outro, deixa de ser possível por esta porta.
    and coalesce(is_admin, false)
        = coalesce((select up.is_admin from public.user_profiles up where up.id = auth.uid()), false)
  );

-- Apagar o próprio perfil continua impedido (não havia policy de delete para o
-- usuário antes desta migration, e continua não havendo).

-- A policy de admin (user_profiles_admin_all) não é tocada: o admin continua
-- gerenciando perfis normalmente.

comment on table public.user_profiles is
  'Perfil do usuário. A coluna is_admin é LEGADO e não decide mais permissão — quem decide é user_roles. Mantida para telas antigas; não confiar nela.';
