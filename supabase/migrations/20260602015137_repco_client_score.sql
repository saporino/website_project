-- Bloco 4: Score do cliente (estilo Serasa interno, 0-1000).
-- Aditivo. Admin define score inicial + anexa PDF do print Serasa; evolui por boleto.

ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS credito_score integer,
  ADD COLUMN IF NOT EXISTS score_serasa_pdf_url text,
  ADD COLUMN IF NOT EXISTS score_serasa_pdf_filename text;

-- Evolução automática: ao confirmar pagamento de uma parcela de boleto,
-- ajusta o score conforme o atraso (regra CLAUDE.md §12). PIX/à vista não tem parcela => não afeta.
CREATE OR REPLACE FUNCTION public.repco_score_on_installment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
DECLARE
  v_client uuid;
  v_late   integer;
  v_delta  integer;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT representative_client_id INTO v_client
    FROM public.representative_orders WHERE id = NEW.order_id;
  IF v_client IS NULL OR NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_late := COALESCE(NEW.paid_at::date, CURRENT_DATE) - NEW.due_date;
  v_delta := CASE
    WHEN v_late <= 0 THEN 20      -- em dia (ou adiantado)
    WHEN v_late <= 3 THEN -30     -- 1-3 dias de atraso
    WHEN v_late <= 7 THEN -50     -- 4-7 dias
    ELSE -50                      -- pago com muito atraso
  END;

  UPDATE public.representative_clients
     SET credito_score = GREATEST(0, LEAST(1000, COALESCE(credito_score, 500) + v_delta))
   WHERE id = v_client;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trg_repco_score_on_installment ON public.representative_order_installments;
CREATE TRIGGER trg_repco_score_on_installment
  AFTER UPDATE ON public.representative_order_installments
  FOR EACH ROW EXECUTE FUNCTION public.repco_score_on_installment_paid();
