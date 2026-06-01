CREATE TABLE IF NOT EXISTS public.representative_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.representative_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  unit text NOT NULL DEFAULT 'pacote',
  unit_price numeric,
  stock_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roi_items_order_idx ON public.representative_order_items (order_id);
CREATE INDEX IF NOT EXISTS roi_items_product_idx ON public.representative_order_items (product_id);
CREATE INDEX IF NOT EXISTS roi_items_rep_idx ON public.representative_order_items (representative_id);

ALTER TABLE public.representative_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roi_items_admin_all ON public.representative_order_items;
CREATE POLICY roi_items_admin_all ON public.representative_order_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS roi_items_rep_select ON public.representative_order_items;
CREATE POLICY roi_items_rep_select ON public.representative_order_items FOR SELECT USING (representative_id = public.my_rep_id());
DROP POLICY IF EXISTS roi_items_rep_insert ON public.representative_order_items;
CREATE POLICY roi_items_rep_insert ON public.representative_order_items FOR INSERT WITH CHECK (representative_id = public.my_rep_id());

CREATE OR REPLACE FUNCTION public.repco_apply_stock_on_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity),
      in_stock = CASE WHEN GREATEST(0, stock - NEW.quantity) > 0 THEN true ELSE false END
  WHERE id = NEW.product_id;
  NEW.stock_applied := true;
  RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS trg_repco_apply_stock ON public.representative_order_items;
CREATE TRIGGER trg_repco_apply_stock BEFORE INSERT ON public.representative_order_items
  FOR EACH ROW EXECUTE FUNCTION public.repco_apply_stock_on_item();

CREATE OR REPLACE FUNCTION public.repco_return_stock_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
DECLARE it RECORD;
BEGIN
  IF NEW.status IN ('cancelled','rejected') AND OLD.status NOT IN ('cancelled','rejected') THEN
    FOR it IN SELECT product_id, quantity FROM public.representative_order_items WHERE order_id = NEW.id AND stock_applied = true LOOP
      UPDATE public.products SET stock = stock + it.quantity, in_stock = true WHERE id = it.product_id;
    END LOOP;
    UPDATE public.representative_order_items SET stock_applied = false WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS trg_repco_return_stock ON public.representative_orders;
CREATE TRIGGER trg_repco_return_stock AFTER UPDATE ON public.representative_orders
  FOR EACH ROW EXECUTE FUNCTION public.repco_return_stock_on_cancel();
