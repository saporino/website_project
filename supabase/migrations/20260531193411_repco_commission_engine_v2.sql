CREATE OR REPLACE FUNCTION public.calculate_repco_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_rep          public.representatives%ROWTYPE;
  v_base_rate    DECIMAL := 5.00;
  v_pix_bonus    DECIMAL := 0;
  v_del_bonus    DECIMAL := 0;
  v_total_rate   DECIMAL;
  v_amount       DECIMAL;
  v_sale_date    DATE;
  v_close_friday DATE;
  v_cycle_start  DATE;
  v_cycle_end    DATE;
  v_scheduled    DATE;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rep FROM public.representatives WHERE id = NEW.representative_id;

  v_base_rate := COALESCE(v_rep.commission_rate, 5.00);

  IF NEW.payment_method = 'pix' THEN
    v_pix_bonus := 0.50;
  END IF;

  IF NEW.is_personal_delivery AND COALESCE(v_rep.has_personal_delivery, false) THEN
    v_del_bonus := 2.50;
  END IF;

  v_total_rate := LEAST(v_base_rate + v_pix_bonus + v_del_bonus, 8.00);
  v_amount := ROUND((NEW.total_amount * v_total_rate / 100), 2);

  v_sale_date    := NEW.created_at::date;
  v_close_friday := v_sale_date + ((5 - EXTRACT(DOW FROM v_sale_date)::int + 7) % 7);

  IF NEW.payment_method = 'pix' THEN
    v_cycle_start := v_close_friday - 6;
    v_cycle_end   := v_close_friday;
    v_scheduled   := v_close_friday + 10;
  ELSE
    v_cycle_start := NULL;
    v_cycle_end   := NULL;
    v_scheduled   := NULL;
  END IF;

  INSERT INTO public.representative_commissions (
    representative_id, order_id, order_amount,
    base_rate, pix_bonus, delivery_bonus,
    total_rate, commission_amount, status,
    payment_method, payment_cycle_start, payment_cycle_end, scheduled_payment_date
  ) VALUES (
    NEW.representative_id, NEW.id, NEW.total_amount,
    v_base_rate, v_pix_bonus, v_del_bonus,
    v_total_rate, v_amount, 'pending',
    NEW.payment_method, v_cycle_start, v_cycle_end, v_scheduled
  )
  ON CONFLICT DO NOTHING;

  NEW.completed_at := now();
  RETURN NEW;
END;
$func$;
