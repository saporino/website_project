-- ============================================
-- Ajuste 1: Numeração de pedidos por canal
-- ============================================

CREATE OR REPLACE FUNCTION generate_order_number(p_order_type TEXT DEFAULT 'PF')
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_number TEXT;
  counter INTEGER := 0;
BEGIN
  prefix := CASE p_order_type
    WHEN 'PJ' THEN 'PJ'
    WHEN 'RC' THEN 'RC'
    WHEN 'ML' THEN 'ML'
    WHEN 'SH' THEN 'SH'
    WHEN 'AZ' THEN 'AZ'
    WHEN 'TK' THEN 'TK'
    ELSE 'PF'
  END;

  LOOP
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO seq_num
    FROM public.orders
    WHERE order_number LIKE prefix || '%';

    new_number := prefix || LPAD(seq_num::TEXT, 6, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders WHERE order_number = new_number
    );

    counter := counter + 1;
    IF counter > 100 THEN
      new_number := prefix || LPAD((FLOOR(RANDOM() * 999999 + 1))::TEXT, 6, '0');
      EXIT;
    END IF;
  END LOOP;

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
DECLARE
  order_type TEXT;
BEGIN
  IF NEW.order_number IS NOT NULL AND NEW.order_number != '' THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN up.is_admin = TRUE THEN 'PF'
    WHEN EXISTS (
      SELECT 1 FROM public.representatives r WHERE r.user_id = NEW.user_id
    ) THEN 'RC'
    WHEN NEW.order_type = 'PJ' THEN 'PJ'
    ELSE 'PF'
  END INTO order_type
  FROM public.user_profiles up
  WHERE up.id = NEW.user_id;

  NEW.order_number := generate_order_number(COALESCE(order_type, 'PF'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();
