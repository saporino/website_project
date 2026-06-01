CREATE OR REPLACE FUNCTION public.repco_delete_order(p_order_id uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
DECLARE
  v_paths text[] := '{}';
  it RECORD;
  v_ord public.representative_orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas admin pode excluir pedido';
  END IF;
  SELECT * INTO v_ord FROM public.representative_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN v_paths; END IF;

  FOR it IN SELECT product_id, quantity FROM public.representative_order_items WHERE order_id = p_order_id AND stock_applied = true LOOP
    UPDATE public.products SET stock = stock + it.quantity, in_stock = true WHERE id = it.product_id;
  END LOOP;

  v_paths := array_remove(ARRAY[
    v_ord.invoice_pdf_url, v_ord.invoice_xml_url, v_ord.payment_proof_url,
    v_ord.commission_paid_proof_url, v_ord.service_invoice_url
  ], NULL);

  v_paths := v_paths || COALESCE((
    SELECT array_agg(x) FROM (
      SELECT boleto_url AS x FROM public.representative_order_installments WHERE order_id = p_order_id AND boleto_url IS NOT NULL
      UNION ALL SELECT proof_url FROM public.representative_order_installments WHERE order_id = p_order_id AND proof_url IS NOT NULL
      UNION ALL SELECT proof_url FROM public.representative_commissions WHERE order_id = p_order_id AND proof_url IS NOT NULL
      UNION ALL SELECT pay.proof_url FROM public.representative_commission_payouts pay
                JOIN public.representative_commissions c ON c.id = pay.commission_id
                WHERE c.order_id = p_order_id AND pay.proof_url IS NOT NULL
    ) q
  ), '{}'::text[]);

  DELETE FROM public.representative_commissions WHERE order_id = p_order_id;
  DELETE FROM public.representative_orders WHERE id = p_order_id;
  RETURN v_paths;
END;
$f$;
