-- 2A. Adiciona data/hora agendada em route_stops
ALTER TABLE public.route_stops
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 2B. Adiciona controle de alerta de inatividade em representative_clients
ALTER TABLE public.representative_clients
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inactivity_snoozed_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inactivity_alert_dismissed BOOLEAN DEFAULT FALSE;

-- 2C. Função e trigger: atualiza last_order_at automaticamente
CREATE OR REPLACE FUNCTION update_client_last_order()
RETURNS TRIGGER AS $func$
BEGIN
  UPDATE public.representative_clients
  SET last_order_at = NOW(),
      inactivity_alert_dismissed = FALSE,
      inactivity_snoozed_until = NULL
  WHERE id = NEW.representative_client_id;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_client_last_order ON public.representative_orders;
CREATE TRIGGER trigger_update_client_last_order
  AFTER INSERT ON public.representative_orders
  FOR EACH ROW
  WHEN (NEW.representative_client_id IS NOT NULL)
  EXECUTE FUNCTION update_client_last_order();

-- 2D. Índices
CREATE INDEX IF NOT EXISTS idx_clients_last_order_at ON public.representative_clients(last_order_at);
CREATE INDEX IF NOT EXISTS idx_route_stops_scheduled_at ON public.route_stops(scheduled_at);
