-- =====================================================================
-- Checkout B2C: telefone estruturado, consentimento de WhatsApp e retirada
-- (06/09/2026)
--
-- Três coisas ao mesmo tempo, porque nascem da mesma tela:
--   1. o telefone passa a ser guardado de forma estruturada (+55 DDD número),
--      sabendo se é celular ou fixo;
--   2. quem aceitar receber promoções entra numa lista própria, com consentimento
--      registrado — é o que permite disparar campanha depois sem adivinhar;
--   3. o pedido passa a poder ser retirado no local, sem frete.
-- =====================================================================

alter table public.orders
  add column if not exists phone_e164 text,
  add column if not exists phone_is_mobile boolean,
  add column if not exists accepts_whatsapp_promos boolean not null default false,
  add column if not exists is_pickup boolean not null default false;

comment on column public.orders.phone_e164 is
  'Telefone em formato internacional (+55DDDNUMERO). O campo customer_phone continua com o texto digitado.';
comment on column public.orders.accepts_whatsapp_promos is
  'Consentimento explicito para receber promocoes por WhatsApp. Falso por padrao: opt-in, nunca opt-out.';
comment on column public.orders.is_pickup is
  'Pedido retirado no local, sem transportadora e sem frete.';

-- ---------------------------------------------------------------------
-- Lista de contatos para campanha
-- ---------------------------------------------------------------------
-- Só entra quem marcou que aceita. Guarda quando aceitou e de onde veio, porque
-- consentimento sem data e sem origem não serve como prova (LGPD).
--
-- O segmento separa B2C de B2B desde já: a campanha de consumidor final não é a
-- mesma da campanha de PJ, e misturar as duas listas é o tipo de erro que só
-- aparece depois do primeiro disparo.
create table if not exists public.marketing_contacts (
  id                uuid primary key default gen_random_uuid(),
  phone_e164        text not null,
  ddd               text,
  numero            text,
  is_mobile         boolean not null default true,
  name              text,
  email             text,
  segment           text not null default 'b2c' check (segment in ('b2c', 'b2b')),
  company_id        uuid references public.companies(id),   -- empresa que captou
  source            text,                                   -- ex.: checkout-b2c
  consent           boolean not null default true,
  consent_at        timestamptz not null default now(),
  opted_out_at      timestamptz,
  last_order_at     timestamptz,
  orders_count      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (phone_e164, segment, company_id)
);

create index if not exists marketing_contacts_ativos_idx
  on public.marketing_contacts (segment, company_id)
  where consent and opted_out_at is null and is_mobile;

alter table public.marketing_contacts enable row level security;

-- Lista de marketing é dado pessoal: só administrador.
drop policy if exists mc_admin on public.marketing_contacts;
create policy mc_admin on public.marketing_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.marketing_contacts is
  'Celulares que autorizaram receber promocoes, por segmento (b2c/b2b) e empresa. Base para as campanhas. Opt-in explicito, com data e origem.';

-- Quem pode receber campanha agora: aceitou, não descadastrou e é celular.
create or replace view public.vw_campanha_whatsapp as
  select mc.id, mc.phone_e164, mc.name, mc.segment,
         c.name as empresa, mc.consent_at, mc.last_order_at, mc.orders_count
    from public.marketing_contacts mc
    left join public.companies c on c.id = mc.company_id
   where mc.consent and mc.opted_out_at is null and mc.is_mobile
   order by mc.consent_at desc;

revoke all on public.vw_campanha_whatsapp from public, anon;
grant select on public.vw_campanha_whatsapp to authenticated;
