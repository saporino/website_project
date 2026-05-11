-- Fix RepCo order number format: RC-00001 → RC000001 (6 digits, no hyphen)
CREATE OR REPLACE FUNCTION set_rep_order_number()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'RC' || LPAD(nextval('repco_order_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Update existing orders to new format
UPDATE public.representative_orders
SET order_number = 'RC' || LPAD(REGEXP_REPLACE(order_number, '[^0-9]', '', 'g'), 6, '0')
WHERE order_number LIKE 'RC-%';
