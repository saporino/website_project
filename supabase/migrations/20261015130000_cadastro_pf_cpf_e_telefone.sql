-- =====================================================================
-- Cadastro PF: o CPF passa a existir e o telefone para de se perder (15/10/2026)
--
-- Dois defeitos silenciosos, os dois confirmados com dado real:
--
-- 1. `user_profiles` em produção tem só id, full_name, phone, is_admin,
--    created_at. NÃO EXISTE coluna cpf — mas UserProfile.tsx mostra um campo
--    "CPF" lendo `profile.cpf`. Campo fantasma: compila, passa no build, e não
--    aparece nada. (As migrations de 2025 que adicionam cpf nunca foram
--    aplicadas; são da era Bolt.)
--
-- 2. O formulário pede o celular, o signUp manda em raw_user_meta_data, e o
--    gatilho handle_new_user grava SÓ o nome. Provado em bancada:
--      criar usuário com phone '11999990000' → user_profiles.phone = null
--
-- Nada aqui cria desconto, mexe em preço ou altera promoção.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. As colunas que faltavam
-- ---------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists cpf text,
  add column if not exists account_type text,
  add column if not exists cpf_conferido_em timestamptz;

-- CPF é único: duas contas com o mesmo CPF é o caminho mais curto para conta
-- duplicada pegando desconto duas vezes. Índice parcial para não brigar com as
-- contas que ainda não têm CPF.
create unique index if not exists user_profiles_cpf_uidx
  on public.user_profiles (cpf) where cpf is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_account_type_check') then
    alter table public.user_profiles
      add constraint user_profiles_account_type_check
      check (account_type is null or account_type in ('PF', 'PJ'));
  end if;
end $$;

comment on column public.user_profiles.cpf is
  'CPF só dígitos, único. Conferido por dígito verificador (cpf_valido), NÃO por consulta a base oficial — nenhum serviço pago foi contratado.';
comment on column public.user_profiles.cpf_conferido_em is
  'Quando o CPF passou na conferência de dígitos. Se um dia houver consulta a base oficial, é aqui que a distinção vive.';

-- ---------------------------------------------------------------------
-- 2. Conferência de CPF no banco
-- ---------------------------------------------------------------------
-- Espelha src/lib/cpf.ts. Validar no navegador é cortesia; validar aqui é o que
-- vale, porque é daqui que sai a autorização do que for exclusivo de cadastrado.
--
-- ATENÇÃO AO QUE ISTO É: confere os dois dígitos verificadores. Pega erro de
-- digitação e CPF inventado na hora. NÃO diz se o CPF existe na Receita nem se
-- é da pessoa — para isso só uma consulta oficial, que é paga e não foi
-- contratada. A tela precisa dizer "CPF válido", nunca "CPF verificado".
create or replace function public.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
as $$
declare d text; soma int; resto int; i int; dig1 int; dig2 int;
begin
  d := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if length(d) <> 11 then return false; end if;
  -- 11111111111 e afins passam na conta dos dígitos, mas não são CPF.
  if d ~ '^(\d)\1{10}$' then return false; end if;

  soma := 0;
  for i in 1..9 loop soma := soma + substr(d, i, 1)::int * (11 - i); end loop;
  resto := (soma * 10) % 11;
  dig1 := case when resto = 10 then 0 else resto end;
  if dig1 <> substr(d, 10, 1)::int then return false; end if;

  soma := 0;
  for i in 1..10 loop soma := soma + substr(d, i, 1)::int * (12 - i); end loop;
  resto := (soma * 10) % 11;
  dig2 := case when resto = 10 then 0 else resto end;
  return dig2 = substr(d, 11, 1)::int;
end;
$$;

comment on function public.cpf_valido is
  'Dígitos verificadores do CPF. Pega erro de digitação; NÃO confirma existência na Receita.';

-- ---------------------------------------------------------------------
-- 3. O gatilho para de jogar o celular fora
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, full_name, phone, is_admin)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    -- Era isto que se perdia: o formulário manda, e ninguém gravava.
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user is
  'Cria o perfil ao nascer a conta, gravando nome E celular. Até 15/10/2026 o celular era descartado em silêncio.';

-- ---------------------------------------------------------------------
-- 4. Cadastro completo — a pergunta que o desconto vai fazer
-- ---------------------------------------------------------------------
-- No banco, não no navegador: é ela que vai autorizar o preço exclusivo quando
-- você definir o percentual. Nasce pronta e inerte — nenhum desconto existe
-- ainda, e nenhum foi criado nesta migration.
create or replace function public.cadastro_pf_completo(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.user_profiles up
      join auth.users u on u.id = up.id
     where up.id = p_user
       and coalesce(btrim(up.full_name), '') <> ''
       and coalesce(btrim(u.email), '') <> ''
       and coalesce(btrim(up.phone), '') <> ''
       and public.cpf_valido(up.cpf)
  );
$$;

comment on function public.cadastro_pf_completo is
  'Nome + e-mail + celular + CPF válido. Conta vazia não é cadastro completo — é esta a trava contra criar conta só para pegar desconto.';
