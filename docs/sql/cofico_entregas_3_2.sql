-- COFICO Entregas 3.2 — fila de entregas (view) + despacho transacional (RPC). Aditivo.

-- Fila: pedidos com delivery_mode='cofico' ainda não despachados. security_invoker => respeita RLS
-- de representative_orders (admin vê tudo; rep não acessa esta tela).
CREATE OR REPLACE VIEW public.vw_cofico_delivery_queue
WITH (security_invoker = true) AS
SELECT
  o.id AS order_id, o.order_number, o.company_id, co.fantasia AS company_name,
  o.representative_id, o.representative_client_id,
  cl.razao_social AS client_name, cl.nome_fantasia AS client_fantasia,
  cl.endereco_completo AS address, cl.bairro, cl.uf, cl.lat, cl.lng,
  o.total_amount, o.freight_amount, o.status, o.created_at,
  COALESCE(w.weight_kg, 0)::numeric(12,2) AS weight_kg
FROM public.representative_orders o
JOIN public.companies co ON co.id = o.company_id
LEFT JOIN public.representative_clients cl ON cl.id = o.representative_client_id
LEFT JOIN LATERAL (
  SELECT sum(CASE i.unit
    WHEN 'kg'    THEN i.quantity
    WHEN 'fardo' THEN i.quantity * 10 * COALESCE(p.weight_grams,0)/1000.0
    ELSE              i.quantity *      COALESCE(p.weight_grams,0)/1000.0
  END) AS weight_kg
  FROM public.representative_order_items i
  JOIN public.products p ON p.id = i.product_id
  WHERE i.order_id = o.id AND COALESCE(i.is_bonus,false) = false
) w ON true
WHERE o.delivery_mode = 'cofico' AND o.delivery_dispatched_at IS NULL;

GRANT SELECT ON public.vw_cofico_delivery_queue TO authenticated;

-- Despacho transacional: cria rota + paradas (1 pedido = 1 parada, na ordem passada),
-- congela company_id na parada, marca os pedidos como despachados e audita.
CREATE OR REPLACE FUNCTION public.cofico_dispatch_route(
  p_driver_id uuid,
  p_scheduled_date date,
  p_order_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_route_id uuid;
  v_order record;
  v_seq int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas admin pode despachar rota.'; END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um pedido.';
  END IF;

  INSERT INTO public.delivery_routes(driver_id, scheduled_date, status, planned_by, planned_at, dispatched_at)
    VALUES (p_driver_id, p_scheduled_date, 'dispatched', auth.uid(), now(), now())
    RETURNING id INTO v_route_id;

  FOR v_order IN
    SELECT o.id, o.company_id, cl.razao_social, cl.endereco_completo, cl.bairro, cl.lat, cl.lng
    FROM public.representative_orders o
    LEFT JOIN public.representative_clients cl ON cl.id = o.representative_client_id
    WHERE o.id = ANY(p_order_ids) AND o.delivery_mode = 'cofico' AND o.delivery_dispatched_at IS NULL
    ORDER BY array_position(p_order_ids, o.id)
  LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.delivery_stops(route_id, order_id, company_id, stop_order, client_name, address, zone, lat, lng, status)
      VALUES (v_route_id, v_order.id, v_order.company_id, v_seq, v_order.razao_social, v_order.endereco_completo, v_order.bairro, v_order.lat, v_order.lng, 'pending');
    UPDATE public.representative_orders SET delivery_dispatched_at = now() WHERE id = v_order.id;
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, new_value, note)
      VALUES (v_order.id, auth.uid(), 'dispatch', v_route_id::text, 'despachado na rota');
  END LOOP;

  IF v_seq = 0 THEN
    DELETE FROM public.delivery_routes WHERE id = v_route_id;  -- nada elegível
    RAISE EXCEPTION 'Nenhum pedido elegível (já despachado ou não é COFICO).';
  END IF;

  UPDATE public.delivery_routes SET total_stops = v_seq WHERE id = v_route_id;
  RETURN v_route_id;
END $fn$;

GRANT EXECUTE ON FUNCTION public.cofico_dispatch_route(uuid, date, uuid[]) TO authenticated;
