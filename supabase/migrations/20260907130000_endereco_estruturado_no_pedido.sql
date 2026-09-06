-- =====================================================================
-- Endereço estruturado no pedido + estorno registrado (07/09/2026)
--
-- O painel mostrava o endereço em branco num pedido real em que a cliente
-- preencheu tudo. Duas causas somadas:
--   1. a tela lia address_street / address_city / cep — nomes que NUNCA
--      existiram na tabela;
--   2. o checkout gravava só `shipping_address`, o endereço inteiro em texto,
--      e faltava a rua como campo próprio.
-- =====================================================================

alter table public.orders
  add column if not exists shipping_street text;

comment on column public.orders.shipping_street is
  'Logradouro. Os demais campos (numero, complemento, bairro, cidade, uf, cep) ja existiam; shipping_address guarda o endereco completo em texto.';

-- ---------------------------------------------------------------------
-- Estorno feito pelo painel
-- ---------------------------------------------------------------------
-- Estorno mexe com dinheiro de cliente. Fica registrado quem pediu, quando,
-- quanto e o que o Mercado Pago respondeu — sem isso não há como auditar
-- depois quem devolveu o quê.
create table if not exists public.payment_refunds (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  mp_payment_id     text not null,
  mp_refund_id      text,
  amount            numeric(12,2),
  is_partial        boolean not null default false,
  status            text not null default 'solicitado'
                      check (status in ('solicitado','concluido','falhou')),
  mp_response       jsonb,
  error_text        text,
  requested_by      uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

create index if not exists payment_refunds_order_idx on public.payment_refunds (order_id, created_at desc);

alter table public.payment_refunds enable row level security;

drop policy if exists pr_admin on public.payment_refunds;
create policy pr_admin on public.payment_refunds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.payment_refunds is
  'Historico de estornos pedidos pelo painel: quem pediu, quanto, e o que o Mercado Pago respondeu.';
