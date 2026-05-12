-- ============================================
-- BLOCO 9: INVENTÁRIO E CUSTOS
-- ============================================

-- 1A. Tabela principal de lotes
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  supplier_name TEXT,
  supplier_city TEXT,
  supplier_state TEXT,
  variety TEXT,
  altitude_meters INTEGER,
  supplier_certifications TEXT[],
  green_weight_kg NUMERIC NOT NULL DEFAULT 0,
  green_cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  green_total_cost NUMERIC GENERATED ALWAYS AS (green_weight_kg * green_cost_per_kg) STORED,
  roast_date DATE,
  roasted_by TEXT,
  roasted_weight_kg NUMERIC,
  roast_loss_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN green_weight_kg > 0 AND roasted_weight_kg IS NOT NULL
    THEN ROUND(((green_weight_kg - roasted_weight_kg) / green_weight_kg * 100)::NUMERIC, 2)
    ELSE 0 END
  ) STORED,
  roast_cost NUMERIC DEFAULT 0,
  roast_profile TEXT,
  roast_temperature NUMERIC,
  roast_duration_minutes INTEGER,
  pkg_cost_250g NUMERIC DEFAULT 0,
  pkg_cost_500g NUMERIC DEFAULT 0,
  pkg_cost_1kg NUMERIC DEFAULT 0,
  pkg_cost_fardo5kg NUMERIC DEFAULT 0,
  label_cost_per_unit NUMERIC DEFAULT 0,
  plastic_wrap_cost_per_unit NUMERIC DEFAULT 0,
  fuel_cost NUMERIC DEFAULT 0,
  toll_cost NUMERIC DEFAULT 0,
  hotel_cost NUMERIC DEFAULT 0,
  food_cost NUMERIC DEFAULT 0,
  other_costs JSONB DEFAULT '[]',
  samples_given_units INTEGER DEFAULT 0,
  samples_unit_size_g INTEGER DEFAULT 500,
  bonus_given_units INTEGER DEFAULT 0,
  bonus_unit_size_g INTEGER DEFAULT 500,
  total_variable_cost NUMERIC DEFAULT 0,
  total_bonus_cost NUMERIC DEFAULT 0,
  cost_per_100g NUMERIC DEFAULT 0,
  cost_per_250g NUMERIC DEFAULT 0,
  cost_per_500g NUMERIC DEFAULT 0,
  cost_per_1kg NUMERIC DEFAULT 0,
  cost_per_fardo5kg NUMERIC DEFAULT 0,
  units_produced_250g INTEGER DEFAULT 0,
  units_produced_500g INTEGER DEFAULT 0,
  units_produced_1kg INTEGER DEFAULT 0,
  units_produced_fardo5kg INTEGER DEFAULT 0,
  production_date DATE,
  expiry_date DATE,
  nf_purchase_url TEXT,
  supplier_certificate_url TEXT,
  quality_report_url TEXT,
  sensory_notes TEXT,
  sca_score NUMERIC,
  photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 1B. Tabela de fotos dos lotes
CREATE TABLE IF NOT EXISTS public.batch_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'general',
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- 1C. Bucket para fotos de lotes
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-photos', 'batch-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin upload batch photos' AND tablename = 'objects') THEN
    CREATE POLICY "Admin upload batch photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'batch-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Batch photos public read' AND tablename = 'objects') THEN
    CREATE POLICY "Batch photos public read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'batch-photos');
  END IF;
END $$;

-- 1D. Função para calcular custos reais do lote
CREATE OR REPLACE FUNCTION calculate_batch_costs(p_batch_id UUID)
RETURNS VOID AS $$
DECLARE
  b RECORD;
  total_var NUMERIC;
  roasted_kg NUMERIC;
  cost_per_100g_calc NUMERIC;
  other_costs_total NUMERIC;
BEGIN
  SELECT * INTO b FROM public.product_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RETURN; END IF;

  roasted_kg := COALESCE(b.roasted_weight_kg, b.green_weight_kg * 0.82);

  SELECT COALESCE(SUM((item->>'value')::NUMERIC), 0)
  INTO other_costs_total
  FROM jsonb_array_elements(COALESCE(b.other_costs, '[]'::jsonb)) AS item;

  total_var := COALESCE(b.green_total_cost, 0)
    + COALESCE(b.roast_cost, 0)
    + COALESCE(b.fuel_cost, 0)
    + COALESCE(b.toll_cost, 0)
    + COALESCE(b.hotel_cost, 0)
    + COALESCE(b.food_cost, 0)
    + other_costs_total;

  IF roasted_kg > 0 THEN
    cost_per_100g_calc := total_var / (roasted_kg * 10);
  ELSE
    cost_per_100g_calc := 0;
  END IF;

  IF roasted_kg > 0 THEN
    DECLARE
      bonus_kg NUMERIC;
      remaining_kg NUMERIC;
      total_cost_with_bonus NUMERIC;
    BEGIN
      bonus_kg := (
        COALESCE(b.samples_given_units, 0) * COALESCE(b.samples_unit_size_g, 500) +
        COALESCE(b.bonus_given_units, 0) * COALESCE(b.bonus_unit_size_g, 500)
      ) / 1000.0;
      remaining_kg := roasted_kg - bonus_kg;
      IF remaining_kg > 0 AND bonus_kg > 0 THEN
        total_cost_with_bonus := total_var + (bonus_kg * cost_per_100g_calc * 10);
        cost_per_100g_calc := total_cost_with_bonus / (remaining_kg * 10);
      END IF;
    END;
  END IF;

  UPDATE public.product_batches SET
    total_variable_cost = total_var,
    cost_per_100g = ROUND(cost_per_100g_calc, 4),
    cost_per_250g = ROUND(cost_per_100g_calc * 2.5 + COALESCE(b.pkg_cost_250g, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_500g = ROUND(cost_per_100g_calc * 5 + COALESCE(b.pkg_cost_500g, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_1kg = ROUND(cost_per_100g_calc * 10 + COALESCE(b.pkg_cost_1kg, 0) + COALESCE(b.label_cost_per_unit, 0) + COALESCE(b.plastic_wrap_cost_per_unit, 0), 2),
    cost_per_fardo5kg = ROUND(cost_per_100g_calc * 50 + COALESCE(b.pkg_cost_fardo5kg, 0) + COALESCE(b.label_cost_per_unit, 0) * 10 + COALESCE(b.plastic_wrap_cost_per_unit, 0) * 10, 2),
    updated_at = NOW()
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 1E. Trigger para recalcular custos automaticamente
CREATE OR REPLACE FUNCTION trigger_recalculate_batch_costs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_batch_costs(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_costs ON public.product_batches;
CREATE TRIGGER trigger_batch_costs
  AFTER INSERT OR UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_batch_costs();

-- 1F. Função para gerar número de lote automático
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.batch_number IS NOT NULL AND NEW.batch_number != '' THEN
    RETURN NEW;
  END IF;
  year_str := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM public.product_batches
  WHERE batch_number LIKE year_str || '-%';
  NEW.batch_number := year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_number ON public.product_batches;
CREATE TRIGGER trigger_batch_number
  BEFORE INSERT ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION generate_batch_number();

-- 1G. RLS
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages batches"
ON public.product_batches FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Admin manages batch photos"
ON public.batch_photos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- 1H. Índices
CREATE INDEX IF NOT EXISTS idx_batches_product ON public.product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.product_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batch_photos_batch ON public.batch_photos(batch_id);
