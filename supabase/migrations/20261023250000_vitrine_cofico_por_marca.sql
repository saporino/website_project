-- A VITRINE DA COFICO PASSA A AGRUPAR POR MARCA.
--
-- A view só devolvia `marca_empresa` — o nome da EMPRESA dona. A página agrupava
-- por ele, e o resultado era este:
--
--     CAFÉ SAPORINO   → Saporino Clássico, Tropeiro Paulista e os kits, juntos
--     COFICO BRASIL   → um Tropeiro Paulista
--
-- Nenhum dos dois títulos corresponde ao que está no pacote. O Tropeiro Paulista
-- é marca própria, não "um café Saporino"; e a COFICO distribui, não é marca de
-- café nenhum. Agora a view entrega `marca` (de `products.brand`) e a página
-- agrupa por ela: Café Saporino, Tropeiro Paulista, Café Serrão — cada uma com
-- os seus, e cada título dizendo o que o cliente vê na prateleira.
--
-- `marca_empresa` CONTINUA na view, de propósito: ela diz quem fatura, e é o que
-- o agrupamento antigo usava. Remover quebraria a página antes do deploy novo
-- subir, e a vitrine ficaria sem grupo nenhum no intervalo.
--
-- Sem marca cadastrada, cai na empresa — nenhum produto some da vitrine por
-- causa de um campo que ainda não foi preenchido.
create or replace view public.vw_cofico_vitrine as
  select p.id, p.name, p.description, p.image_url, p.additional_images, p.category, p.product_line,
         p.roast_type, p.flavor_notes, p.weight_grams, p.stock, p.display_order,
         coalesce(c.fantasia, c.name) as marca_empresa, p.company_id,
         (p.stock > 0) as disponivel,
         -- `marca` entra NO FIM da lista porque `create or replace view` só
         -- aceita colunas acrescentadas ao final: inserir no meio renomearia as
         -- seguintes e o Postgres recusa. A ordem das colunas de uma view não
         -- importa para quem consulta por nome, e evita um drop desnecessário
         -- de uma view que o site público está lendo agora.
         coalesce(nullif(btrim(p.brand), ''), c.fantasia, c.name) as marca
    from public.products p
    join public.companies c on c.id = p.company_id
   where p.is_active
     and not p.hidden_from_store
     and 'cofico' = any(p.sales_channels)
     and c.is_active
     and c.cofico_visivel;

grant select on public.vw_cofico_vitrine to anon, authenticated;

-- "Marcas que distribuímos", na home, pelo mesmo critério: MARCA, não empresa.
--
-- Antes listava empresas, então a COFICO aparecia como marca distribuída por
-- ela mesma, e o Tropeiro Paulista não aparecia em lugar nenhum. O logo ainda
-- vem da empresa dona — marca não tem logo próprio no banco; quando tiver, sai
-- daqui.
-- Aqui o drop é necessário: a view deixa de ser "uma linha por empresa" e passa
-- a ser "uma linha por marca", e os tipos das colunas mudam com o agrupamento.
drop view if exists public.vw_cofico_marcas;

create view public.vw_cofico_marcas as
  select
    min(c.id::text)::uuid as id,
    coalesce(nullif(btrim(p.brand), ''), c.fantasia, c.name) as marca,
    min(c.logo_url) as logo_url,
    min(c.sort_order) as sort_order,
    true as tem_produto
  from public.products p
  join public.companies c on c.id = p.company_id
 where p.is_active
   and not p.hidden_from_store
   and 'cofico' = any(p.sales_channels)
   and c.is_active
   and c.cofico_visivel
 group by coalesce(nullif(btrim(p.brand), ''), c.fantasia, c.name)
 order by min(c.sort_order), marca;

grant select on public.vw_cofico_marcas to anon, authenticated;
