CREATE OR REPLACE FUNCTION handle_client_snooze()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inactivity_snoozed_until IS DISTINCT FROM OLD.inactivity_snoozed_until
    AND NEW.inactivity_snoozed_until IS NOT NULL THEN
    NEW.snooze_count := COALESCE(OLD.snooze_count, 0) + 1;
    IF NEW.snooze_count >= 2 THEN
      NEW.snooze_admin_alert := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_snooze ON public.representative_clients;
CREATE TRIGGER trigger_client_snooze
  BEFORE UPDATE ON public.representative_clients
  FOR EACH ROW EXECUTE FUNCTION handle_client_snooze();

CREATE OR REPLACE FUNCTION reset_client_snooze_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.representative_client_id IS NOT NULL THEN
    UPDATE public.representative_clients
    SET snooze_count = 0,
        snooze_admin_alert = FALSE,
        inactivity_snoozed_until = NULL,
        inactivity_alert_dismissed = FALSE,
        last_order_at = NOW()
    WHERE id = NEW.representative_client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_snooze_on_order ON public.representative_orders;
CREATE TRIGGER trigger_reset_snooze_on_order
  AFTER INSERT ON public.representative_orders
  FOR EACH ROW EXECUTE FUNCTION reset_client_snooze_on_order();

CREATE INDEX IF NOT EXISTS idx_clients_snooze_alert
  ON public.representative_clients(snooze_admin_alert)
  WHERE snooze_admin_alert = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_is_active
  ON public.representative_clients(is_active_client);
CREATE INDEX IF NOT EXISTS idx_rep_orders_client_id
  ON public.representative_orders(representative_client_id);
