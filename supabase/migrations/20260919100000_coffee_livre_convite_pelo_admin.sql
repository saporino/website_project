-- Coffee LiVRE — convite de USO ÚNICO que vira conta própria.
--
-- Fluxo:
--   1. Admin (RepCo › Convites) convida nome + empresa + e-mail. Nasce um código,
--      enviado por e-mail (e mostrado na tela, para mandar por WhatsApp se quiser).
--   2. A pessoa digita o código (rodapé da COFICO ou /coffeelivre), preenche o perfil e
--      cria a senha. A conta nasce COM O E-MAIL DO CONVITE e o código é consumido.
--   3. Dali em diante: e-mail + senha. Perdeu o código antes do cadastro? "Perdi meu
--      código" gera um NOVO para o e-mail do convite e cancela o anterior.
--
-- Por que resolve o repasse: o código morre no cadastro; a conta é pessoal e pode ser
-- bloqueada sozinha. O banco guarda só o HASH do código (nem o admin relê um código).
-- Escrita só pela Edge Function lv-convite (service role) e pelo admin.
--
-- Os códigos antigos de lv_demo_access (multiuso, por script) continuam valendo até
-- serem desativados — ninguém que já usa perde o acesso de surpresa.

create table if not exists public.lv_convites (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  empresa         text,
  email           text not null check (email = lower(btrim(email)) and email like '%_@_%._%'),
  code_hash       text not null unique,
  status          text not null default 'pendente' check (status in ('pendente', 'usado', 'cancelado', 'substituido')),
  expires_at      timestamptz not null,
  enviado_em      timestamptz,
  envios          integer not null default 0,
  envio_erro      text,
  usado_em        timestamptz,
  user_id         uuid references auth.users(id) on delete set null,
  substituido_por uuid references public.lv_convites(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
comment on table public.lv_convites is
  'Convites do Coffee LiVRE: um código de USO ÚNICO por pessoa, guardado como hash. Vira conta no cadastro.';
create index if not exists lv_convites_email_idx on public.lv_convites (email);
create index if not exists lv_convites_pendentes_idx on public.lv_convites (status) where status = 'pendente';

create table if not exists public.lv_convidados (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  convite_id     uuid references public.lv_convites(id) on delete set null,
  nome           text not null,
  empresa        text,
  email          text not null,
  telefone       text,
  cargo          text,
  bloqueado      boolean not null default false,
  bloqueado_em   timestamptz,
  ultimo_acesso  timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.lv_convidados is
  'Convidados com conta própria no Coffee LiVRE (fase de apresentação). Bloquear aqui tira o acesso só desta pessoa.';

-- ---------------------------------------------------------------------
-- Quem passa pelo portão do Coffee LiVRE (usuário logado)
-- ---------------------------------------------------------------------
-- Convidado não bloqueado, admin ou usuário de vendedor. Registra o último acesso.
create or replace function public.lv_acesso_da_conta()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); c public.lv_convidados;
begin
  if v is null then return jsonb_build_object('liberado', false, 'motivo', 'sem_sessao'); end if;
  if public.is_admin() then return jsonb_build_object('liberado', true, 'papel', 'admin'); end if;
  select * into c from public.lv_convidados where user_id = v;
  if c.user_id is not null then
    if c.bloqueado then return jsonb_build_object('liberado', false, 'motivo', 'bloqueado'); end if;
    update public.lv_convidados set ultimo_acesso = now() where user_id = v;
    return jsonb_build_object('liberado', true, 'papel', 'convidado', 'nome', c.nome);
  end if;
  if exists (select 1 from public.lv_seller_users where user_id = v) then
    return jsonb_build_object('liberado', true, 'papel', 'vendedor');
  end if;
  return jsonb_build_object('liberado', false, 'motivo', 'sem_convite');
end $$;
revoke all on function public.lv_acesso_da_conta() from public, anon;
grant execute on function public.lv_acesso_da_conta() to authenticated;

-- Só o servidor (Edge Function) pergunta se um e-mail já tem conta: o visitante não pode
-- usar isto para descobrir quem é cliente.
create or replace function public.lv_email_tem_conta(p_email text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
$$;
revoke all on function public.lv_email_tem_conta(text) from public, anon, authenticated;
grant execute on function public.lv_email_tem_conta(text) to service_role;

-- ---------------------------------------------------------------------
-- RLS: só admin lê/altera; a Edge Function usa service role.
-- ---------------------------------------------------------------------
alter table public.lv_convites enable row level security;
alter table public.lv_convidados enable row level security;
revoke all on public.lv_convites, public.lv_convidados from anon;
grant select, update on public.lv_convites, public.lv_convidados to authenticated;

drop policy if exists lv_convites_admin on public.lv_convites;
create policy lv_convites_admin on public.lv_convites for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists lv_convidados_admin on public.lv_convidados;
create policy lv_convidados_admin on public.lv_convidados for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists lv_convidados_proprio on public.lv_convidados;
create policy lv_convidados_proprio on public.lv_convidados for select to authenticated using (user_id = auth.uid());
