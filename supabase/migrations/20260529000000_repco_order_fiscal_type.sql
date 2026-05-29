ALTER TABLE public.representative_orders
  ADD COLUMN IF NOT EXISTS fiscal_order_type TEXT;

ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS default_fiscal_order_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.representative_orders'::regclass
      AND conname = 'representative_orders_fiscal_order_type_check'
  ) THEN
    ALTER TABLE public.representative_orders
      ADD CONSTRAINT representative_orders_fiscal_order_type_check
      CHECK (
        fiscal_order_type IS NULL
        OR fiscal_order_type IN ('resale', 'taxpayer_consumer', 'non_taxpayer_consumer')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.representative_clients'::regclass
      AND conname = 'representative_clients_default_fiscal_order_type_check'
  ) THEN
    ALTER TABLE public.representative_clients
      ADD CONSTRAINT representative_clients_default_fiscal_order_type_check
      CHECK (
        default_fiscal_order_type IS NULL
        OR default_fiscal_order_type IN ('resale', 'taxpayer_consumer', 'non_taxpayer_consumer')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_repco_client_default_fiscal_order_type(
  p_client_id UUID,
  p_fiscal_order_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep_id UUID;
BEGIN
  IF p_fiscal_order_type NOT IN ('resale', 'taxpayer_consumer', 'non_taxpayer_consumer') THEN
    RAISE EXCEPTION 'Invalid fiscal order type';
  END IF;

  SELECT id INTO v_rep_id
  FROM public.representatives
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_rep_id IS NULL THEN
    RAISE EXCEPTION 'Representative not found';
  END IF;

  UPDATE public.representative_clients
  SET
    default_fiscal_order_type = p_fiscal_order_type,
    updated_at = now()
  WHERE id = p_client_id
    AND representative_id = v_rep_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found for current representative';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_repco_client_default_fiscal_order_type(UUID, TEXT) TO authenticated;
