-- =====================================================================
-- Cupons de desconto (08/09/2026)
--
-- Faltava no site desde sempre, e agora tem um uso concreto: recuperar
-- carrinho abandonado oferecendo desconto na primeira compra.
--
-- A trava por CPF é o que faz a mecânica funcionar. Cupom de "primeira
-- compra" que não checa nada vira desconto permanente — o cliente aprende
-- a abandonar o carrinho de propósito para ganhar desconto toda vez.
-- =====================================================================

create table if not exists public.coupons (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  code         text not null,
  description  text,
  -- percent: % sobre os produtos · valor: R$ fixo · frete_gratis: zera o frete
  kind         text not null default 'percent'
                 check (kind in ('percent', 'valor', 'frete_gratis')),
  amount       numeric(10,2) not null default 0,
  min_subtotal numeric(10,2) not null default 0,
  -- Só vale para quem nunca comprou. É a checagem por CPF.
  first_purchase_only boolean not null default true,
  max_uses     integer,
  uses         integer not null default 0,
  starts_at    timestamptz,
  expires_at   timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (company_id, code)
);

comment on table public.coupons is
  'Cupons de desconto. first_purchase_only usa o CPF para saber se a pessoa ja comprou — sem isso o cupom de recuperacao vira desconto permanente.';

-- Uso do cupom, para auditar e para contar. Um pedido usa no máximo um cupom.
create table if not exists public.coupon_redemptions (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  cpf        text,
  amount     numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists coupon_redemptions_cpf_idx on public.coupon_redemptions (cpf);

alter table public.orders
  add column if not exists coupon_code     text,
  add column if not exists discount_amount numeric(10,2) not null default 0;

comment on column public.orders.discount_amount is
  'Desconto do cupom, ja aplicado no total_amount. Guardado a parte para a nota e para o relatorio.';

alter table public.coupons             enable row level security;
alter table public.coupon_redemptions  enable row level security;

-- A loja precisa ler o cupom para validar antes de cobrar, e o checkout é
-- público. Nada aqui é segredo — o código o cliente já tem.
drop policy if exists cp_leitura on public.coupons;
create policy cp_leitura on public.coupons for select to anon, authenticated using (is_active);

drop policy if exists cp_admin on public.coupons;
create policy cp_admin on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists cr_admin on public.coupon_redemptions;
create policy cr_admin on public.coupon_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Validação: o cupom vale para este CPF, neste carrinho?
-- ---------------------------------------------------------------------
-- Fica no banco porque quem cobra é o servidor. A tela usa a mesma função
-- só para mostrar o valor antes — mas quem decide é esta função, chamada de
-- novo na hora de criar o pedido.
create or replace function public.validar_cupom(
  p_codigo    text,
  p_cpf       text,
  p_subtotal  numeric,
  p_frete     numeric default 0,
  p_empresa   text default 'CS'
)
returns table (valido boolean, motivo text, desconto numeric, zera_frete boolean, descricao text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c        record;
  v_cpf    text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_ja     integer;
begin
  select cu.* into c
    from coupons cu
    join companies co on co.id = cu.company_id
   where upper(cu.code) = upper(trim(coalesce(p_codigo, '')))
     and co.order_prefix = p_empresa
     and cu.is_active
   limit 1;

  if not found then
    return query select false, 'Cupom não encontrado.', 0::numeric, false, null::text;
    return;
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return query select false, 'Este cupom ainda não começou a valer.', 0::numeric, false, c.description;
    return;
  end if;

  if c.expires_at is not null and now() > c.expires_at then
    return query select false, 'Este cupom já expirou.', 0::numeric, false, c.description;
    return;
  end if;

  if c.max_uses is not null and c.uses >= c.max_uses then
    return query select false, 'Este cupom já foi todo utilizado.', 0::numeric, false, c.description;
    return;
  end if;

  if coalesce(p_subtotal, 0) < c.min_subtotal then
    return query select false,
      format('Este cupom vale a partir de R$ %s em produtos.', to_char(c.min_subtotal, 'FM999G990D00')),
      0::numeric, false, c.description;
    return;
  end if;

  -- A trava que faz a mecânica funcionar: já comprou antes, não ganha de novo.
  if c.first_purchase_only then
    if v_cpf is null then
      return query select false, 'Informe o CPF para usar este cupom.', 0::numeric, false, c.description;
      return;
    end if;
    select count(*)::int into v_ja from orders o
      where o.customer_cpf = v_cpf and o.status = 'approved';
    if v_ja > 0 then
      return query select false, 'Este cupom é só para a primeira compra.', 0::numeric, false, c.description;
      return;
    end if;
  end if;

  if c.kind = 'frete_gratis' then
    return query select true, null::text, round(coalesce(p_frete, 0), 2), true, c.description;
  elsif c.kind = 'valor' then
    return query select true, null::text, round(least(c.amount, coalesce(p_subtotal, 0)), 2), false, c.description;
  else
    return query select true, null::text,
      round(coalesce(p_subtotal, 0) * c.amount / 100.0, 2), false, c.description;
  end if;
end $$;

comment on function public.validar_cupom is
  'Diz se o cupom vale e quanto desconta. Chamada pela tela para mostrar, e DE NOVO pelo servidor na hora de cobrar.';

revoke all on function public.validar_cupom(text, text, numeric, numeric, text) from public;
grant execute on function public.validar_cupom(text, text, numeric, numeric, text) to anon, authenticated, service_role;
