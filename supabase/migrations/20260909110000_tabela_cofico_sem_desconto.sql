-- =====================================================================
-- A tabela COFICO não entra no desconto de envio (09/09/2026)
--
-- O desconto de R$ 1,50 por quilo existe para tornar a compra maior atraente
-- no B2C, e é bancado pela loja em cima do preço de uma transportadora
-- terceira. Na COFICO, que é entrega própria, ele não faz sentido: o preço da
-- tabela JÁ é o nosso preço. Descontar ali é descontar de nós mesmos duas
-- vezes.
--
-- A regra passa a ser da TABELA, não da empresa: cada tabela de frete diz se
-- aceita o desconto. A COFICO nasce com `false`. Quando entrarem as tabelas
-- reais das outras transportadoras (BBM, Jadlog, Rodonaves), cada uma decide.
-- =====================================================================

alter table public.shipping_rate_tables
  add column if not exists allow_discount boolean not null default false;

comment on column public.shipping_rate_tables.allow_discount is
  'Se o desconto de envio da empresa (shipping_subsidy_per_kg) pode ser aplicado sobre esta tabela. A tabela da COFICO e entrega propria: o preco dela ja e o nosso preco, entao nao aceita desconto.';

-- Explícito, para não depender só do default numa tabela que já existia.
update public.shipping_rate_tables set allow_discount = false;

comment on table public.shipping_rate_tables is
  'Tabela de frete da COFICO: faixas de peso por zona, mais seguro e GRIS sobre o valor da mercadoria. Comecou como referencia de uma tabela comercial fracionada com origem em SP e vai sendo atualizada conforme chegam cotacoes reais.';
