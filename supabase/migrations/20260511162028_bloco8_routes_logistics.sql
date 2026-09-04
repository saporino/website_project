-- ============================================
-- BLOCO 8: ETAPA 1 — Rotas e Logística
-- ============================================

-- 1A. Adiciona colunas em route_stops
ALTER TABLE public.route_stops
ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
ADD COLUMN IF NOT EXISTS proof_photo_lat NUMERIC,
ADD COLUMN IF NOT EXISTS proof_photo_lng NUMERIC,
ADD COLUMN IF NOT EXISTS proof_photo_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS arrival_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS departure_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS geofence_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS distance_from_stop NUMERIC,
ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'visit',
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 0;

-- 1B. Adiciona colunas em representative_routes
ALTER TABLE public.representative_routes
ADD COLUMN IF NOT EXISTS route_type TEXT DEFAULT 'visit',
ADD COLUMN IF NOT EXISTS max_weight_kg NUMERIC DEFAULT 800,
ADD COLUMN IF NOT EXISTS total_weight_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS segment_filter TEXT,
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS report_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS learned_order JSONB;

-- 1C. Cria bucket para fotos de visita
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 1D. RLS para bucket visit-photos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Reps upload visit photos' AND tablename = 'objects') THEN
    CREATE POLICY "Reps upload visit photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'visit-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Visit photos public read' AND tablename = 'objects') THEN
    CREATE POLICY "Visit photos public read"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'visit-photos');
  END IF;
END $$;

-- 1E. Índices
CREATE INDEX IF NOT EXISTS idx_route_stops_geofence
  ON public.route_stops(geofence_triggered)
  WHERE geofence_triggered = TRUE;
CREATE INDEX IF NOT EXISTS idx_route_stops_type
  ON public.route_stops(stop_type);
CREATE INDEX IF NOT EXISTS idx_routes_type
  ON public.representative_routes(route_type);
CREATE INDEX IF NOT EXISTS idx_routes_region
  ON public.representative_routes(region);
