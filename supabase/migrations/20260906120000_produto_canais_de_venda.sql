-- =====================================================================
-- Canais de venda por produto (06/09/2026)
--
-- Duas coisas diferentes que estavam misturadas:
--   - `products.company_id` = de quem é a MARCA (Saporino, Fazendinha, ...)
--   - canais de venda        = ONDE aquele café pode ser vendido
--
-- É por isso que o site da COFICO não refletia o painel: ele nem lia a tabela de
-- produtos, e mesmo que lesse, não havia como dizer "este café a COFICO vende".
--
-- Regra do negócio:
--   café de marca Saporino  -> site da Saporino + COFICO + marketplaces
--   qualquer outra marca    -> COFICO + marketplaces (a Saporino não vende marca
--                              de terceiro na própria loja)
-- =====================================================================

alter table public.products
  add column if not exists sales_channels text[] not null default '{}';

comment on column public.products.sales_channels is
  'Onde este produto pode ser vendido: saporino (loja da Saporino), cofico (Casa Cofico), marketplaces. NAO confundir com company_id, que diz de quem e a marca.';

-- Backfill pela regra acima, sem sobrescrever quem já tiver canal definido.
update public.products p
   set sales_channels = case
         when c.order_prefix = 'CS' then array['saporino','cofico','marketplaces']
         else array['cofico','marketplaces']
       end
  from public.companies c
 where c.id = p.company_id
   and coalesce(array_length(p.sales_channels, 1), 0) = 0;

-- Produto sem empresa: fica só na COFICO até alguém decidir.
update public.products
   set sales_channels = array['cofico']
 where company_id is null
   and coalesce(array_length(sales_channels, 1), 0) = 0;

alter table public.products
  drop constraint if exists products_sales_channels_validos;
alter table public.products
  add constraint products_sales_channels_validos
  check (sales_channels <@ array['saporino','cofico','marketplaces']::text[]);

create index if not exists products_sales_channels_idx on public.products using gin (sales_channels);

-- ---------------------------------------------------------------------
-- Vitrine pública da COFICO
-- ---------------------------------------------------------------------
-- O site da COFICO passa a ler daqui, e não de uma lista fixa no código.
-- Mostra o que está ativo, não escondido e marcado para a COFICO vender,
-- de qualquer marca — que é exatamente o papel dela.
create or replace view public.vw_cofico_vitrine as
  select p.id,
         p.name,
         p.description,
         p.image_url,
         p.additional_images,
         p.category,
         p.product_line,
         p.roast_type,
         p.flavor_notes,
         p.weight_grams,
         p.stock,
         p.display_order,
         c.name  as marca_empresa,
         c.id    as company_id,
         (p.stock > 0) as disponivel
    from public.products p
    left join public.companies c on c.id = p.company_id
   where p.is_active
     and not coalesce(p.hidden_from_store, false)
     and 'cofico' = any (p.sales_channels)
   order by p.display_order nulls last, p.name;

-- A vitrine é pública de propósito: é o catálogo do site.
grant select on public.vw_cofico_vitrine to anon, authenticated;
