-- Liga/desliga de uma empresa no SITE da COFICO.
--
-- Pedido do Vlademir (26/09/2026): "quero desligar uma empresa e ela sumir da COFICO até
-- eu ligar de novo, e aí volta tudo para o devido lugar". É diferente de `is_active`
-- (que tira a empresa do seletor do painel inteiro) e de `hidden_from_store` (que é por
-- produto): aqui a marca inteira sai da vitrine pública da COFICO, sem perder nada.
--
-- Desligar NÃO apaga nem altera produto, estoque, pedido ou preço. Só deixa de mostrar.

alter table public.companies add column if not exists cofico_visivel boolean not null default true;
comment on column public.companies.cofico_visivel is
  'Marca aparece no site da COFICO (vitrine e "Marcas que distribuimos"). Desligar so esconde; nao mexe em produto, estoque nem pedido.';

-- A vitrine pública da COFICO passa a respeitar o liga/desliga.
create or replace view public.vw_cofico_vitrine as
  select p.id, p.name, p.description, p.image_url, p.additional_images, p.category, p.product_line,
         p.roast_type, p.flavor_notes, p.weight_grams, p.stock, p.display_order,
         coalesce(c.fantasia, c.name) as marca_empresa, p.company_id,
         (p.stock > 0) as disponivel
    from public.products p
    join public.companies c on c.id = p.company_id
   where p.is_active
     and not p.hidden_from_store
     and 'cofico' = any(p.sales_channels)
     and c.is_active
     and c.cofico_visivel;

grant select on public.vw_cofico_vitrine to anon, authenticated;

-- As marcas que a home da COFICO mostra em "Marcas que distribuímos".
-- View própria (e não leitura da tabela companies) porque o visitante não pode ver
-- CNPJ, endereço, comissão nem as empresas desligadas.
create or replace view public.vw_cofico_marcas as
  select c.id, coalesce(c.fantasia, c.name) as marca, c.logo_url, c.sort_order,
         exists (
           select 1 from public.products p
            where p.company_id = c.id and p.is_active and not p.hidden_from_store
              and 'cofico' = any(p.sales_channels)
         ) as tem_produto
    from public.companies c
   where c.is_active and c.cofico_visivel
   order by c.sort_order, marca;

grant select on public.vw_cofico_marcas to anon, authenticated;
