-- =====================================================================
-- Reconciliação única do estoque anterior à regra de lote (06/09/2026)
--
-- Antes da baixa por lote, a venda do representante descontava de products.stock
-- sem tocar no lote. O resultado real no banco: o lote 750-001 marcava 1500
-- pacotes e o produto 1376 — 124 já tinham saído do galpão e o lote não sabia.
-- Como products.stock é recalculado somando os lotes, esses 124 voltariam a
-- aparecer no próximo toque em qualquer lote.
--
-- Esta migration acerta o passado UMA vez: leva ao lote a quantidade que já foi
-- vendida e registra cada saída no livro-razão, atribuída ao pedido que a gerou.
-- Não é ajuste cego: cada linha aponta para o pedido de origem.
-- =====================================================================

do $$
declare
  v_item record;
  v_res  jsonb;
  v_total int := 0;
begin
  -- Só roda se o livro-razão ainda estiver vazio: reexecutar não pode descontar
  -- duas vezes a mesma venda.
  if exists (select 1 from public.stock_movements limit 1) then
    raise notice 'Livro-razao ja tem movimentos — reconciliacao ignorada.';
    return;
  end if;

  for v_item in
    select i.product_id, i.quantity, i.order_id, o.company_id
      from public.representative_order_items i
      join public.representative_orders o on o.id = i.order_id
     where coalesce(o.status, '') <> 'cancelled'
       and i.product_id is not null
       and i.quantity > 0
     order by o.created_at
  loop
    v_res := public.consume_stock_fifo(
      v_item.product_id, v_item.quantity, 'repco',
      'representative_order', v_item.order_id, v_item.company_id, 'venda'
    );
    v_total := v_total + v_item.quantity;
  end loop;

  raise notice 'Reconciliacao concluida: % pacotes levados ao lote.', v_total;
end $$;
