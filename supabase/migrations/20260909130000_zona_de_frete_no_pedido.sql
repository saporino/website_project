-- =====================================================================
-- A zona de frete fica gravada no pedido (09/09/2026)
--
-- Até aqui a zona era só um número de tela: aparecia no checkout, ajudava a
-- explicar o preço, e morria ali. O pedido guardava transportadora e valor,
-- mas não PARA ONDE, na linguagem da operação.
--
-- Ela precisa sobreviver ao checkout por dois motivos:
--
--  1. Separação. Quem separa precisa saber a zona junto com o endereço, para
--     agrupar o que vai para o mesmo destino. Sem isso, cada caixa é um
--     destino solto.
--  2. Acúmulo. É assim que a COFICO decide quando uma região justifica rota
--     própria: pedidos por zona ao longo do tempo. Só dá para contar o que
--     ficou gravado — zona que não foi salva não vira estatística depois.
--
-- Vale também para o B2C da Saporino entregue pela COFICO: o pedido nasce na
-- loja e entra na mesma contagem por zona.
-- =====================================================================

alter table public.orders
  add column if not exists shipping_zone      text,
  add column if not exists shipping_zone_days integer;

comment on column public.orders.shipping_zone is
  'Zona comercial de frete do destino (SPC, SPG, SP1...), da tabela COFICO. Acompanha o pedido ate a separacao e alimenta a contagem de pedidos por regiao.';
comment on column public.orders.shipping_zone_days is
  'Prazo em dias que a tabela promete para essa zona, congelado no momento do pedido.';

-- Contagem por zona: quantos pedidos e quanto de frete cada região gerou.
-- É a leitura que diz quando uma zona justifica rota própria da COFICO.
create index if not exists orders_zona_de_frete on public.orders (shipping_zone)
  where shipping_zone is not null;
