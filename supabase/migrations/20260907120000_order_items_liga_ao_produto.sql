-- =====================================================================
-- Liga o item do pedido ao produto (07/09/2026)
--
-- A aba Pedidos do painel mostrava "Nenhum pedido encontrado" mesmo com pedidos
-- reais no banco, um deles pago. A tela pede o produto dentro do item:
--
--   order_items(quantity, unit_price, product_id, products(name, weight_grams))
--
-- e o PostgREST recusava a consulta INTEIRA com erro 400:
--   "Could not find a relationship between 'order_items' and 'products'"
--
-- Motivo: `order_items.product_id` nunca teve chave estrangeira para `products`.
-- Sem a chave, o PostgREST não sabe como juntar as duas tabelas e nega tudo. A
-- tela engolia o erro e mostrava a lista vazia — parecia que não havia pedido,
-- quando na verdade a consulta nem rodava. Falhava para qualquer usuário, sempre.
--
-- Conferido antes de criar: 11 itens, nenhum sem produto e nenhum apontando para
-- produto inexistente. A chave entra sem quebrar nada.
--
-- ON DELETE RESTRICT de propósito: apagar um produto que já foi vendido apagaria
-- a história da venda. Produto que saiu de linha deve ser desativado, não apagado.
-- =====================================================================

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete restrict;

create index if not exists order_items_product_idx on public.order_items (product_id);
