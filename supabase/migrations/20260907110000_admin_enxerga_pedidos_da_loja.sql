-- =====================================================================
-- O administrador precisa enxergar os pedidos da loja (07/09/2026)
--
-- Descoberto com um pedido REAL já pago: a aba Pedidos do painel mostrava
-- "Nenhum pedido encontrado" enquanto existiam 11 pedidos no banco, um deles
-- aprovado e cobrado no cartão da cliente.
--
-- Causa: `orders` só tinha UMA política de leitura, "ver os próprios pedidos"
-- (auth.uid() = user_id). O administrador não é o dono de nenhum pedido, então
-- não via nada. Pior: os 11 pedidos estão com user_id nulo, porque o checkout
-- cria o pedido pelo servidor e nunca gravou o comprador.
--
-- Efeito prático: venda paga, café separado para retirada, e ninguém do lado da
-- empresa consegue ver que existe um pedido para atender.
-- =====================================================================

-- Administrador enxerga e opera todos os pedidos.
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O comprador continua vendo o que é dele. Passa a valer também para os pedidos
-- que forem gravados com o usuário logado daqui em diante.
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
