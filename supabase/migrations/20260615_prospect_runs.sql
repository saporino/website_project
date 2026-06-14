-- Camada 2 — auditoria e orcamento dos runs do Apify (Google Maps Scraper).
-- Aditivo. NAO altera prospect_lists/prospect_leads, mapa, views ou ProspectionManager.

CREATE TABLE IF NOT EXISTS public.prospect_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by       uuid REFERENCES auth.users(id),
  uf                 text,
  municipio          text,
  bairro             text,
  category           text,
  keywords           text[] NOT NULL DEFAULT '{}',
  max_places         integer NOT NULL DEFAULT 100,
  keyword_count      integer NOT NULL DEFAULT 0,
  places_estimate    integer NOT NULL DEFAULT 0,
  cost_estimate_usd  numeric(10,2) NOT NULL DEFAULT 0,
  apify_run_id       text,
  apify_dataset_id   text,
  status             text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued','running','done','failed','no_credit')),
  places_returned    integer,
  leads_created      integer,
  leads_duplicated   integer,
  error_message      text,
  prospect_list_id   uuid REFERENCES public.prospect_lists(id) ON DELETE SET NULL,
  representative_id  uuid REFERENCES public.representatives(id) ON DELETE SET NULL,
  company_id         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_prospect_runs_status  ON public.prospect_runs (status);
CREATE INDEX IF NOT EXISTS idx_prospect_runs_created ON public.prospect_runs (created_at);

ALTER TABLE public.prospect_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all on prospect_runs" ON public.prospect_runs;
CREATE POLICY "Admin all on prospect_runs" ON public.prospect_runs
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
