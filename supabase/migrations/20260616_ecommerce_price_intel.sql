-- Inteligencia de Precos E-commerce (append-only). Cada coleta = lote novo (captured_at).
-- Multi-marketplace orientado a dados: ecommerce_sources guarda actor+input por marketplace.

create table if not exists public.ecommerce_price_snapshots (
  id              bigint generated always as identity primary key,
  company_id      uuid not null,
  captured_at     timestamptz not null default now(),
  marketplace     text not null default 'mercadolivre',
  search_term     text,
  listing_sku     text not null,
  title           text not null,
  thumb_url       text,
  url             text,
  domain_id       text,
  price           numeric(12,2) not null,
  price_before    numeric(12,2),
  discount_pct    integer,
  currency        text default 'BRL',
  search_position integer,
  is_sponsored    boolean default false,
  weight_g        numeric(10,2),
  unit_type       text,
  is_arabica      boolean default false,
  price_per_kg    numeric(12,2),
  is_suspect      boolean default false,
  raw             jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_eps_lookup on public.ecommerce_price_snapshots (company_id, marketplace, listing_sku, captured_at desc);
create index if not exists idx_eps_batch  on public.ecommerce_price_snapshots (company_id, marketplace, captured_at desc);

-- config por marketplace (actor Apify + input do run validado). Adicionar marketplace = 1 linha.
create table if not exists public.ecommerce_sources (
  marketplace   text primary key,
  label         text not null,
  actor_id      text,
  default_input jsonb,
  enabled       boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- lote mais recente por (company, marketplace)
create or replace view public.vw_ecommerce_latest
with (security_invoker = true) as
select * from public.ecommerce_price_snapshots e
where e.captured_at = (
  select max(captured_at) from public.ecommerce_price_snapshots
  where company_id = e.company_id and marketplace = e.marketplace
);
