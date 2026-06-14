-- Camada 2 — match RF x scraper (pool -> atribuicao). Aditivo.
-- RF (prospects_b2b) so enriquece/dedup/sinaliza; quem o rep trabalha e o lead do scraper.

-- 1) RF "coberta": quando um lead do scraper casa em alta confianca, o registro RF some dos faltantes.
ALTER TABLE public.prospects_b2b
  ADD COLUMN IF NOT EXISTS covered_at timestamptz,
  ADD COLUMN IF NOT EXISTS covered_by_lead_id uuid;
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_covered ON public.prospects_b2b (covered_at) WHERE covered_at IS NULL;

-- 2) Enriquecimento da RF no lead do scraper (CNPJ/razao) + status do match.
ALTER TABLE public.prospect_leads
  ADD COLUMN IF NOT EXISTS rf_cnpj text,
  ADD COLUMN IF NOT EXISTS rf_razao text,
  ADD COLUMN IF NOT EXISTS rf_match_status text NOT NULL DEFAULT 'none'
    CHECK (rf_match_status IN ('none','confirmed','pending'));

-- 3) Fila de match AMBIGUO (nome forte sem bairro, ou nome medio): admin confirma/rejeita.
CREATE TABLE IF NOT EXISTS public.lead_rf_candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.prospect_leads(id) ON DELETE CASCADE,
  rf_cnpj       text NOT NULL,
  rf_razao      text,
  rf_fantasia   text,
  rf_bairro     text,
  rf_municipio  text,
  rf_uf         text,
  score         numeric(4,3),
  reason        text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lead_rf_candidates_status ON public.lead_rf_candidates (status);
CREATE INDEX IF NOT EXISTS idx_lead_rf_candidates_lead ON public.lead_rf_candidates (lead_id);

ALTER TABLE public.lead_rf_candidates ENABLE ROW LEVEL SECURITY;
