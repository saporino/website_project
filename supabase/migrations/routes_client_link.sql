-- 1A. Adiciona coluna representative_client_id em route_stops
ALTER TABLE public.route_stops
ADD COLUMN IF NOT EXISTS representative_client_id UUID
  REFERENCES public.representative_clients(id) ON DELETE SET NULL;

-- 1B. Migra status antigos
UPDATE public.route_stops SET visit_status = 'completed' WHERE visit_status = 'closed';
UPDATE public.route_stops SET visit_status = 'completed' WHERE visit_status = 'visited';

-- 1C. Remove constraint antiga e cria nova com 4 status
ALTER TABLE public.route_stops
DROP CONSTRAINT IF EXISTS route_stops_visit_status_check;

ALTER TABLE public.route_stops
ADD CONSTRAINT route_stops_visit_status_check
CHECK (visit_status IN ('pending', 'in_progress', 'completed', 'not_attended'));

-- 1D. Função para decremento de estoque (uso futuro com representative_order_items)
CREATE OR REPLACE FUNCTION decrement_stock_on_repco_order()
RETURNS TRIGGER AS $func$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    FOR item IN
      SELECT product_id, quantity
      FROM representative_order_items
      WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
      SET stock = GREATEST(0, stock - item.quantity),
          in_stock = CASE WHEN GREATEST(0, stock - item.quantity) > 0 THEN true ELSE false END
      WHERE id = item.product_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- 1E. Índice para nova coluna
CREATE INDEX IF NOT EXISTS idx_route_stops_client_id
  ON public.route_stops(representative_client_id);
