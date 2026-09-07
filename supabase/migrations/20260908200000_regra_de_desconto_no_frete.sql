-- =====================================================================
-- Regra de desconto no frete (08/09/2026)
--
-- O desconto deixa de ser um número fixo por quilo e vira uma regra que o
-- dono liga e desliga: quanto, em que unidade, e a partir de quantos
-- pacotes vale.
--
-- O motivo é a conta que ele quer poder fazer: fardo com frete de R$ 18,20
-- e desconto de R$ 1,50 × 10 pacotes = R$ 15,00, então o cliente paga
-- R$ 3,20 de frete. Por quilo daria R$ 7,64 — metade. A unidade muda tudo,
-- e a decisão é comercial, não técnica.
--
-- O gatilho existe para campanha: esta semana só no fardo, na semana que
-- vem a partir de 3 pacotes. Sem redeploy.
-- =====================================================================

alter table public.companies
  add column if not exists shipping_discount_active    boolean not null default true,
  add column if not exists shipping_discount_unit      text    not null default 'kg',
  add column if not exists shipping_discount_min_packs integer not null default 1;

alter table public.companies
  drop constraint if exists companies_shipping_discount_unit_check;
alter table public.companies
  add constraint companies_shipping_discount_unit_check
  check (shipping_discount_unit in ('kg', 'pacote'));

comment on column public.companies.shipping_subsidy_per_kg is
  'Valor do desconto de envio que a loja banca. A unidade vem de shipping_discount_unit: por quilo ou por pacote.';
comment on column public.companies.shipping_discount_active is
  'Liga e desliga o desconto sem mexer no valor — serve de interruptor de campanha.';
comment on column public.companies.shipping_discount_unit is
  'kg = valor x peso bruto. pacote = valor x quantidade de pacotes. Muda bastante o resultado: 5 kg dao 5,095 x valor; 10 pacotes dao 10 x valor.';
comment on column public.companies.shipping_discount_min_packs is
  'A partir de quantos pacotes o desconto vale. 1 = sempre. 10 = so no fardo.';

-- ---------------------------------------------------------------------
-- Serviço de frete escolhido no pedido
-- ---------------------------------------------------------------------
-- Sem isto não há como emitir a etiqueta depois: o pedido saberia o preço
-- mas não QUAL transportadora e serviço o cliente escolheu.
alter table public.orders
  add column if not exists shipping_service_id   integer,
  add column if not exists shipping_service_name text;

comment on column public.orders.shipping_service_id is
  'Codigo do servico no agregador (1 PAC, 2 SEDEX, 3 Jadlog, 17 Mini Envios, 31 Loggi, 33 J&T). Nulo quando o frete veio da tabela propria ou e retirada.';
