-- =====================================================================
-- Canal "repco" e a operadora como empresa vendedora (06/09/2026)
--
-- O modelo do Vlademir, na frase dele: cadastra a empresa, coloca o inventário e
-- diz QUEM VENDE. Um café da Fazendinha pode ser vendido pelos representantes do
-- portal RepCo e, ao mesmo tempo, pela COFICO e Casa Cofico, que cuidam do
-- e-commerce. Isso vale para qualquer marca de terceiro que peça para vendermos.
--
-- Faltava o canal dos representantes. Sem ele não dá para dizer "esse café os
-- representantes vendem, aquele não".
-- =====================================================================

alter table public.products
  drop constraint if exists products_sales_channels_validos;
alter table public.products
  add constraint products_sales_channels_validos
  check (sales_channels <@ array['saporino','repco','cofico','marketplaces']::text[]);

comment on column public.products.sales_channels is
  'Quem pode vender este produto: saporino (loja B2C), repco (representantes do portal), cofico (Casa Cofico e e-commerce), marketplaces. NAO confundir com company_id, que diz de quem e a marca.';

-- Os representantes já vendem tudo que existe hoje. Incluir o canal mantém o
-- comportamento atual; deixar de fora tiraria produto do portal sem ninguém pedir.
update public.products
   set sales_channels = array_append(sales_channels, 'repco')
 where not ('repco' = any (sales_channels));

-- A operadora passa a poder vender. Isso a coloca no seletor de empresa do painel,
-- que é onde se cadastra inventário e se diz quem vende. Ela continua marcada como
-- operadora logística: os dois papéis convivem.
comment on column public.companies.is_operator is
  'Empresa que opera logistica (COFICO). NAO impede de vender: desde 06/09/2026 a operadora tambem aparece no seletor de empresa do painel.';

-- Vitrine do portal RepCo: o que os representantes podem vender, por empresa.
create or replace view public.vw_repco_vitrine as
  select p.id, p.name, p.image_url, p.stock, p.in_stock, p.company_id,
         p.product_line, p.category, p.weight_grams
    from public.products p
   where p.is_active
     and 'repco' = any (p.sales_channels)
   order by p.name;

revoke all on public.vw_repco_vitrine from public, anon;
grant select on public.vw_repco_vitrine to authenticated;
