-- ============================================================
-- REPCO PROSPECTION BASE
-- Adds prospect lists, prospect leads, and route_stops linkage.
-- Additive only: no existing data is changed.
-- ============================================================

-- 1. Prospect lists
CREATE TABLE IF NOT EXISTS public.prospect_lists (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  description                TEXT,
  segment                    TEXT,
  source_type                TEXT NOT NULL DEFAULT 'csv'
                               CHECK (source_type IN ('csv', 'scraper', 'manual')),
  source_name                TEXT,
  status                     TEXT NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'imported', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_representative_id UUID REFERENCES public.representatives(id) ON DELETE SET NULL,
  total_count                INTEGER NOT NULL DEFAULT 0,
  pending_count              INTEGER NOT NULL DEFAULT 0,
  converted_count            INTEGER NOT NULL DEFAULT 0,
  rejected_count             INTEGER NOT NULL DEFAULT 0,
  duplicate_count            INTEGER NOT NULL DEFAULT 0,
  invalid_count              INTEGER NOT NULL DEFAULT 0,
  created_by                 UUID REFERENCES auth.users(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at               TIMESTAMPTZ
);

-- 2. Prospect leads
CREATE TABLE IF NOT EXISTS public.prospect_leads (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_list_id           UUID NOT NULL REFERENCES public.prospect_lists(id) ON DELETE CASCADE,
  representative_id          UUID REFERENCES public.representatives(id) ON DELETE SET NULL,
  representative_client_id   UUID REFERENCES public.representative_clients(id) ON DELETE SET NULL,

  company_name               TEXT NOT NULL,
  trade_name                 TEXT,
  cnpj                       TEXT,
  cpf                        TEXT,
  segment                    TEXT,
  category                   TEXT,
  source                     TEXT,

  address                    TEXT,
  number                     TEXT,
  complement                 TEXT,
  district                   TEXT,
  city                       TEXT,
  state                      TEXT,
  zip_code                   TEXT,
  lat                        NUMERIC(10,7),
  lng                        NUMERIC(10,7),
  geocode_status             TEXT NOT NULL DEFAULT 'pending'
                               CHECK (geocode_status IN ('pending', 'success', 'failed', 'manual')),
  geocode_source             TEXT,
  geocoded_at                TIMESTAMPTZ,

  contact_name               TEXT,
  phone                      TEXT,
  whatsapp                   TEXT,
  email                      TEXT,
  website                    TEXT,

  raw_data                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                     TEXT NOT NULL DEFAULT 'new'
                               CHECK (status IN (
                                 'new',
                                 'assigned',
                                 'pending_visit',
                                 'in_progress',
                                 'visited',
                                 'qualified',
                                 'converted',
                                 'rejected',
                                 'duplicate',
                                 'invalid'
                               )),
  audit_notes                TEXT,
  rejection_reason           TEXT,
  visited_at                 TIMESTAMPTZ,
  qualified_at               TIMESTAMPTZ,
  converted_at               TIMESTAMPTZ,
  duplicate_of_lead_id       UUID REFERENCES public.prospect_leads(id) ON DELETE SET NULL,
  duplicate_of_client_id     UUID REFERENCES public.representative_clients(id) ON DELETE SET NULL,

  created_by                 UUID REFERENCES auth.users(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Link route stops to prospect leads
ALTER TABLE public.route_stops
ADD COLUMN IF NOT EXISTS prospect_lead_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'route_stops_prospect_lead_id_fkey'
  ) THEN
    ALTER TABLE public.route_stops
    ADD CONSTRAINT route_stops_prospect_lead_id_fkey
    FOREIGN KEY (prospect_lead_id)
    REFERENCES public.prospect_leads(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_prospect_lists_status
  ON public.prospect_lists(status);

CREATE INDEX IF NOT EXISTS idx_prospect_lists_assigned_rep
  ON public.prospect_lists(assigned_representative_id);

CREATE INDEX IF NOT EXISTS idx_prospect_lists_segment
  ON public.prospect_lists(segment);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_list_id
  ON public.prospect_leads(prospect_list_id);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_rep_id
  ON public.prospect_leads(representative_id);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_client_id
  ON public.prospect_leads(representative_client_id);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_status
  ON public.prospect_leads(status);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_cnpj
  ON public.prospect_leads(cnpj)
  WHERE cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_leads_coords
  ON public.prospect_leads(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_leads_duplicate_lead
  ON public.prospect_leads(duplicate_of_lead_id)
  WHERE duplicate_of_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_leads_duplicate_client
  ON public.prospect_leads(duplicate_of_client_id)
  WHERE duplicate_of_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_stops_prospect_lead_id
  ON public.route_stops(prospect_lead_id);

-- 5. Updated-at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prospect_lists_updated_at'
  ) THEN
    CREATE TRIGGER prospect_lists_updated_at
      BEFORE UPDATE ON public.prospect_lists
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prospect_leads_updated_at'
  ) THEN
    CREATE TRIGGER prospect_leads_updated_at
      BEFORE UPDATE ON public.prospect_leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 6. Row Level Security
ALTER TABLE public.prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

-- Admin policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospect_lists'
      AND policyname = 'Admin can do everything on prospect_lists'
  ) THEN
    CREATE POLICY "Admin can do everything on prospect_lists"
      ON public.prospect_lists
      FOR ALL TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospect_leads'
      AND policyname = 'Admin can do everything on prospect_leads'
  ) THEN
    CREATE POLICY "Admin can do everything on prospect_leads"
      ON public.prospect_leads
      FOR ALL TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

-- Representative policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospect_lists'
      AND policyname = 'RepCo can view assigned prospect_lists'
  ) THEN
    CREATE POLICY "RepCo can view assigned prospect_lists"
      ON public.prospect_lists
      FOR SELECT TO authenticated
      USING (assigned_representative_id = my_rep_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospect_leads'
      AND policyname = 'RepCo can view assigned prospect_leads'
  ) THEN
    CREATE POLICY "RepCo can view assigned prospect_leads"
      ON public.prospect_leads
      FOR SELECT TO authenticated
      USING (
        representative_id = my_rep_id()
        OR prospect_list_id IN (
          SELECT id
          FROM public.prospect_lists
          WHERE assigned_representative_id = my_rep_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospect_leads'
      AND policyname = 'RepCo can update assigned prospect_leads'
  ) THEN
    CREATE POLICY "RepCo can update assigned prospect_leads"
      ON public.prospect_leads
      FOR UPDATE TO authenticated
      USING (
        representative_id = my_rep_id()
        OR prospect_list_id IN (
          SELECT id
          FROM public.prospect_lists
          WHERE assigned_representative_id = my_rep_id()
        )
      )
      WITH CHECK (
        representative_id = my_rep_id()
        OR prospect_list_id IN (
          SELECT id
          FROM public.prospect_lists
          WHERE assigned_representative_id = my_rep_id()
        )
      );
  END IF;
END $$;
