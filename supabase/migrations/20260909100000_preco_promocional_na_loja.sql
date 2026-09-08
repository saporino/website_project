-- =====================================================================
-- Preço promocional que a loja realmente usa (09/09/2026)
--
-- O campo `promotional_price` existe desde sempre e o painel até mostra o
-- desconto na lista de produtos. Mas a LOJA nunca leu esse campo: a vitrine
-- e a página do produto mostram `price`, e o servidor cobra `price`.
--
-- Ou seja: preencher o preço promocional não fazia absolutamente nada para
-- quem compra. Aqui a visão passa a devolver o preço que vale, e o que foi
-- riscado.
-- =====================================================================

-- `p.*` mudou de forma desde que a visão nasceu (entrou has_custom_image), e o
-- Postgres não deixa trocar colunas de uma visão no lugar. Recriar é seguro:
-- ninguém depende dela além da loja.
drop view if exists public.products_com_disponibilidade;

create view public.products_com_disponibilidade as
  select p.*,
         case
           when p.kit_of_product_id is null then coalesce(p.stock, 0)
           else floor(coalesce(b.stock, 0)::numeric / greatest(p.kit_quantity, 1))::int
         end as disponivel,
         b.stock as estoque_do_cafe,

         -- Promoção só vale se for MENOR que o preço cheio. Promocional maior
         -- que o normal é erro de digitação, e não pode virar aumento.
         case
           when coalesce(p.promotional_price, 0) > 0 and p.promotional_price < p.price
             then p.promotional_price
           else p.price
         end as preco_final,

         (coalesce(p.promotional_price, 0) > 0 and p.promotional_price < p.price) as em_promocao
    from public.products p
    left join public.products b on b.id = p.kit_of_product_id;

comment on view public.products_com_disponibilidade is
  'Produtos com `disponivel` (kit = estoque do cafe dividido pelo tamanho), `preco_final` (promocional quando menor que o cheio) e `em_promocao`.';

grant select on public.products_com_disponibilidade to anon, authenticated;

-- ---------------------------------------------------------------------
-- Pesos que os kits usam
-- ---------------------------------------------------------------------
-- Nada a migrar; fica registrado por que a tela precisa de mais opções:
-- os kits nascem com 1000, 1500, 2000 e 5000 g, e a tela do produto só
-- oferecia 250, 500 e 1000 — então um fardo aberto para edição não tinha
-- botão correspondente ao próprio peso.
