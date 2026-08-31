-- TASK INTEL-1 — RepCo Discovery Intelligence (camada de descoberta)
-- ADITIVO: não altera prospect_leads/prospect_lists/ProspectionManager/mapa.
-- Discovery ≠ Lead. Resultados TIPADOS; só viram lead após aprovação humana quando o tipo permitir.

-- 1) Biblioteca de keywords EDITÁVEL (migra prospectKeywords.ts para o banco; seed em migration separada)
CREATE TABLE IF NOT EXISTS public.discovery_keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term        text NOT NULL,
  group_name  text,                         -- REPRESENTANTES/AFILIADOS/CAFÉ/VAREJO/FOOD SERVICE/REGIONAL/(categorias existentes)
  segment     text,                         -- segmento provisório (do prospectKeywords), nullable
  sources     text[] NOT NULL DEFAULT '{}', -- {whatsapp_group}, {google_places}, {web}
  active      boolean NOT NULL DEFAULT true,
  company_id  uuid,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_name, term)
);

-- 2) Campanhas de descoberta
CREATE TABLE IF NOT EXISTS public.discovery_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  country       text NOT NULL DEFAULT 'BR',
  region_state  text,                        -- ex.: SP
  region_city   text,                        -- opcional
  sources       text[] NOT NULL DEFAULT '{}',
  keywords      text[] NOT NULL DEFAULT '{}',-- keywords desta campanha (denormalizado)
  company_id    uuid,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 3) Extensão de prospect_runs (aditivo, multi-provider/discovery)
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS source_type    text;   -- google_places|whatsapp_group|whatsapp_channel
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS provider       text;   -- apify
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS actor_id       text;
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS actor_version  text;
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS result_count   integer;
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS campaign_id    uuid REFERENCES public.discovery_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS country        text;
ALTER TABLE public.prospect_runs ADD COLUMN IF NOT EXISTS cost_actual_usd numeric(10,4);

-- 4) Resultados de descoberta (TIPADOS, ≠ leads)
CREATE TABLE IF NOT EXISTS public.discovery_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid REFERENCES public.discovery_campaigns(id) ON DELETE SET NULL,
  run_id        uuid REFERENCES public.prospect_runs(id) ON DELETE SET NULL,
  source        text NOT NULL,                 -- whatsapp_group|whatsapp_channel|google_places
  result_type   text NOT NULL,                 -- PUBLIC_WHATSAPP_GROUP|PUBLIC_WHATSAPP_CHANNEL|COMMUNITY|BUSINESS|OTHER
  title         text,
  description   text,
  public_url    text,
  keyword       text,
  country       text,
  state         text,
  city          text,
  external_id   text,
  canonical_url text,                           -- URL normalizada p/ dedupe
  member_count  integer,
  provider      text,                           -- apify
  actor_id      text,
  raw_payload   jsonb,
  score         integer,                        -- 0-100
  score_factors jsonb,
  status        text NOT NULL DEFAULT 'new',    -- new|reviewing|approved|dismissed|duplicate|stale
  converted_prospect_lead_id uuid REFERENCES public.prospect_leads(id) ON DELETE SET NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  company_id    uuid,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Dedupe: por canonical_url e por provider+external_id (nunca só por nome)
CREATE UNIQUE INDEX IF NOT EXISTS uq_discovery_canonical ON public.discovery_results (company_id, canonical_url) WHERE canonical_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_discovery_extid     ON public.discovery_results (company_id, provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discovery_status   ON public.discovery_results (status);
CREATE INDEX IF NOT EXISTS idx_discovery_campaign ON public.discovery_results (campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovery_run      ON public.discovery_results (run_id);

-- RLS: admin-only (mesmo padrão da prospecção)
ALTER TABLE public.discovery_keywords  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_results   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disc_kw_admin   ON public.discovery_keywords;
DROP POLICY IF EXISTS disc_camp_admin ON public.discovery_campaigns;
DROP POLICY IF EXISTS disc_res_admin  ON public.discovery_results;
CREATE POLICY disc_kw_admin   ON public.discovery_keywords  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY disc_camp_admin ON public.discovery_campaigns FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY disc_res_admin  ON public.discovery_results   FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
