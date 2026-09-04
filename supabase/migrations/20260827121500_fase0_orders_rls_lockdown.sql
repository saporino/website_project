/*
  Fase 0 / Segurança CRÍTICA — Lockdown de RLS de orders + order_items.

  Corrige exposição real: hoje qualquer um (anon) pode LER todos os pedidos
  (SELECT com `OR true`) e ALTERAR qualquer pedido (UPDATE `true` público),
  além de INSERT público direto.

  Modelo alvo:
   - anon: NENHUM acesso direto (sem SELECT/INSERT/UPDATE/DELETE).
   - authenticated: SELECT apenas dos próprios pedidos; sem UPDATE financeiro.
   - service role (backend/edge functions/webhook): opera via bypass de RLS.
   - consulta pública anônima: só via RPC get_order_public(order_id, token).

  NÃO destrutivo a dados (só troca policies). RLS permanece habilitada.

  ROLLBACK (recria as policies originais):
    CREATE POLICY "Anyone can insert orders" ON orders FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY "Users and system can view orders" ON orders FOR SELECT TO public USING ((auth.uid() = user_id) OR (user_id IS NULL) OR true);
    CREATE POLICY "System can update all orders" ON orders FOR UPDATE TO public USING (true);
    CREATE POLICY "Users can update their own orders" ON orders FOR UPDATE TO public USING (auth.uid() = user_id);
    CREATE POLICY "Anyone can insert order items" ON order_items FOR INSERT TO public WITH CHECK (true);
    CREATE POLICY "Users can view items from their own orders" ON order_items FOR SELECT TO public USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
*/

-- orders
DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;
DROP POLICY IF EXISTS "Users and system can view orders" ON orders;
DROP POLICY IF EXISTS "System can update all orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;

DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- (sem policy de INSERT/UPDATE/DELETE: negado a anon+authenticated; service role faz bypass)

-- order_items
DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;
DROP POLICY IF EXISTS "Users can view items from their own orders" ON order_items;

DROP POLICY IF EXISTS "order_items_select_own" ON order_items;
CREATE POLICY "order_items_select_own" ON order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  ));
