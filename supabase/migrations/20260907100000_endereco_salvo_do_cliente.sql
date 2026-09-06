-- =====================================================================
-- Endereço salvo do cliente (07/09/2026)
--
-- A Rosineide comprou pelo celular e, a cada tentativa, teve que digitar tudo de
-- novo: nome, telefone, CEP, rua, número, complemento, bairro. Mesmo logada.
-- O checkout nunca leu o perfil nem endereço salvo, e nunca gravou nada.
--
-- A tabela user_addresses já existia, mas com campos achatados (address_line1/2)
-- e sem nenhuma tela lendo ou escrevendo nela. Aqui ela passa a guardar o
-- endereço no MESMO formato que o checkout usa, para não haver perda na ida e
-- na volta.
-- =====================================================================

alter table public.user_addresses
  add column if not exists street         text,
  add column if not exists number         text,
  add column if not exists complement     text,
  add column if not exists neighborhood   text,
  add column if not exists recipient_name text,
  add column if not exists phone          text;

comment on table public.user_addresses is
  'Endereco de entrega salvo do cliente. Preenche o checkout na compra seguinte para ninguem redigitar tudo.';

-- Um endereço padrão por pessoa: é o que o checkout carrega sozinho.
create unique index if not exists user_addresses_um_padrao_por_usuario
  on public.user_addresses (user_id)
  where is_default;

alter table public.user_addresses enable row level security;

-- Endereço é dado pessoal: cada um enxerga e mexe apenas no próprio.
drop policy if exists ua_own_select on public.user_addresses;
create policy ua_own_select on public.user_addresses
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists ua_own_insert on public.user_addresses;
create policy ua_own_insert on public.user_addresses
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists ua_own_update on public.user_addresses;
create policy ua_own_update on public.user_addresses
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ua_own_delete on public.user_addresses;
create policy ua_own_delete on public.user_addresses
  for delete to authenticated using (auth.uid() = user_id);
