-- COFICO Entregas 3.1 — delivery_mode no pedido + empresa_contratante imutável após despacho + auditoria.
-- Aditivo. Não toca em estoque/comissão/numeração.

-- responsável pela entrega (própria | retirada | cofico | transportadora); NULL permitido (pedidos antigos)
ALTER TABLE public.representative_orders ADD COLUMN IF NOT EXISTS delivery_mode text
  CHECK (delivery_mode IN ('propria','retirada','cofico','transportadora'));
-- marca de despacho (setada na 3.2 ao despachar a rota); enquanto NULL, o pedido ainda é editável
ALTER TABLE public.representative_orders ADD COLUMN IF NOT EXISTS delivery_dispatched_at timestamptz;

-- auditoria de alteração de responsável/contratante
CREATE TABLE IF NOT EXISTS public.delivery_dispatch_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.representative_orders(id) ON DELETE CASCADE,
  changed_by uuid,
  field text,                       -- 'delivery_mode' | 'company_id' | 'dispatch'
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dda_order ON public.delivery_dispatch_audit(order_id);
ALTER TABLE public.delivery_dispatch_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dda_admin_sel ON public.delivery_dispatch_audit;
CREATE POLICY dda_admin_sel ON public.delivery_dispatch_audit FOR SELECT USING (public.is_admin());

-- guard: imutabilidade após despacho + auditoria (BEFORE UPDATE, não interfere em estoque/comissão)
CREATE OR REPLACE FUNCTION public.repco_orders_delivery_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF OLD.delivery_dispatched_at IS NOT NULL THEN
    IF NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode THEN
      RAISE EXCEPTION 'delivery_mode imutável após despacho (pedido %).', OLD.order_number;
    END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'empresa contratante imutável após despacho (pedido %).', OLD.order_number;
    END IF;
  END IF;
  IF NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode THEN
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, old_value, new_value)
      VALUES (OLD.id, auth.uid(), 'delivery_mode', OLD.delivery_mode, NEW.delivery_mode);
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    INSERT INTO public.delivery_dispatch_audit(order_id, changed_by, field, old_value, new_value)
      VALUES (OLD.id, auth.uid(), 'company_id', OLD.company_id::text, NEW.company_id::text);
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_repco_orders_delivery_guard ON public.representative_orders;
CREATE TRIGGER trg_repco_orders_delivery_guard
  BEFORE UPDATE ON public.representative_orders
  FOR EACH ROW EXECUTE FUNCTION public.repco_orders_delivery_guard();
