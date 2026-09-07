-- =====================================================================
-- Teto do desconto de envio (08/09/2026)
--
-- A regra "R$ 1,50 por quilo a partir de 1 fardo" funciona bem até uns
-- 20 kg. Em 100 kg ela vira R$ 136,50 de desconto sobre um frete de
-- R$ 136,50 — o cliente paga zero e a loja banca o transporte inteiro.
--
-- O teto corta isso sem mexer na regra. R$ 30,00 cobre integralmente até
-- 4 fardos (20 kg), que é o limite das transportadoras, e segura o
-- prejuízo nas cargas grandes que a COFICO leva.
-- =====================================================================

alter table public.companies
  add column if not exists shipping_discount_max numeric(10,2) not null default 0;

comment on column public.companies.shipping_discount_max is
  'Teto do desconto de envio, em reais. 0 = sem teto. Existe porque a regra por quilo, em carga grande, chega a zerar o frete e a loja acaba bancando o transporte inteiro.';

update public.companies set shipping_discount_max = 30.00
 where order_prefix in ('CS', 'CO') and shipping_discount_max = 0;
