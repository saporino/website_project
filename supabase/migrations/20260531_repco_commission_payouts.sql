-- 1) Helper: calcula a janela e a data de pagamento
CREATE OR REPLACE FUNCTION public.repco_commission_cycle(p_date date, p_method text)
RETURNS TABLE(cycle_start date, cycle_end date, scheduled date)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT cf - 6, cf, CASE WHEN p_method = 'pix' THEN cf + 10 ELSE cf + 3 END
  FROM (SELECT p_date + ((5 - EXTRACT(DOW FROM p_date)::int + 7) % 7) AS cf) s;
$$;

-- 2) Tabela livro-caixa
CREATE TABLE IF NOT EXISTS public.representative_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.representative_commissions(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.representative_order_installments(id) ON DELETE CASCADE,
  representative_id uuid NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  cycle_start date,
  cycle_end date,
  scheduled_payment_date date,
  status text NOT NULL DEFAULT 'scheduled',
  paid_at timestamptz,
  proof_url text,
  proof_filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rcp_uniq_installment ON public.representative_commission_payouts (installment_id) WHERE installment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rcp_uniq_pix ON public.representative_commission_payouts (commission_id) WHERE installment_id IS NULL;
CREATE INDEX IF NOT EXISTS rcp_rep_idx ON public.representative_commission_payouts (representative_id);
CREATE INDEX IF NOT EXISTS rcp_sched_idx ON public.representative_commission_payouts (scheduled_payment_date);

-- 3) RLS: admin tudo, rep ve so os seus
ALTER TABLE public.representative_commission_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rcp_admin_all ON public.representative_commission_payouts;
CREATE POLICY rcp_admin_all ON public.representative_commission_payouts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS rcp_rep_select ON public.representative_commission_payouts;
CREATE POLICY rcp_rep_select ON public.representative_commission_payouts FOR SELECT USING (representative_id = public.my_rep_id());

-- 4) Gatilho PIX: ao nascer a comissao PIX, cria o payout
CREATE OR REPLACE FUNCTION public.create_pix_commission_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
BEGIN
  IF NEW.payment_method = 'pix' THEN
    INSERT INTO public.representative_commission_payouts (
      commission_id, installment_id, representative_id, amount, payment_method,
      cycle_start, cycle_end, scheduled_payment_date, status
    ) VALUES (
      NEW.id, NULL, NEW.representative_id, NEW.commission_amount, 'pix',
      NEW.payment_cycle_start, NEW.payment_cycle_end, NEW.scheduled_payment_date, 'scheduled'
    )
    ON CONFLICT (commission_id) WHERE installment_id IS NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS trg_pix_commission_payout ON public.representative_commissions;
CREATE TRIGGER trg_pix_commission_payout AFTER INSERT ON public.representative_commissions
  FOR EACH ROW EXECUTE FUNCTION public.create_pix_commission_payout();

-- 5) Gatilho BOLETO: ao confirmar a parcela paga, cria o payout proporcional
CREATE OR REPLACE FUNCTION public.create_boleto_commission_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
DECLARE
  v_comm     public.representative_commissions%ROWTYPE;
  v_cyc      RECORD;
  v_date     date;
  v_slice    numeric;
  v_already  numeric;
  v_all_paid boolean;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_comm FROM public.representative_commissions WHERE order_id = NEW.order_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_date := COALESCE(NEW.paid_at::date, CURRENT_DATE);
  SELECT * INTO v_cyc FROM public.repco_commission_cycle(v_date, 'boleto');

  v_all_paid := NOT EXISTS (
    SELECT 1 FROM public.representative_order_installments
    WHERE order_id = NEW.order_id AND status <> 'paid'
  );

  IF v_all_paid THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_already
      FROM public.representative_commission_payouts WHERE commission_id = v_comm.id;
    v_slice := v_comm.commission_amount - v_already;
  ELSE
    v_slice := ROUND(v_comm.commission_amount * NEW.amount / NULLIF(v_comm.order_amount, 0), 2);
  END IF;

  INSERT INTO public.representative_commission_payouts (
    commission_id, installment_id, representative_id, amount, payment_method,
    cycle_start, cycle_end, scheduled_payment_date, status
  ) VALUES (
    v_comm.id, NEW.id, v_comm.representative_id, v_slice, 'boleto',
    v_cyc.cycle_start, v_cyc.cycle_end, v_cyc.scheduled, 'scheduled'
  )
  ON CONFLICT (installment_id) WHERE installment_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS trg_boleto_commission_payout ON public.representative_order_installments;
CREATE TRIGGER trg_boleto_commission_payout AFTER UPDATE ON public.representative_order_installments
  FOR EACH ROW EXECUTE FUNCTION public.create_boleto_commission_payout();
