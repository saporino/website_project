-- Camada 2 (RepCo — prospeccao B2B com dado publico de CNPJ).
-- Migracao ADITIVA e idempotente. NAO altera tela /repco/inteligencia, views vw_repco_*, cadastro,
-- nem prospect_lists/prospect_leads. Cria o "universo raw" de PDVs e a tabela de centroides IBGE.

-- 1) Centroides de municipio (IBGE) — geocodificacao do universo por municipio (offline).
CREATE TABLE IF NOT EXISTS public.ibge_municipios (
  codigo_ibge text PRIMARY KEY,
  uf          text NOT NULL,
  nome        text NOT NULL,
  nome_norm   text NOT NULL,
  lat         double precision,
  lng         double precision
);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_uf_nome ON public.ibge_municipios (uf, nome_norm);

-- 2) Universo de PDVs (prospects brutos da base publica). So inteligencia/cobertura (admin).
CREATE TABLE IF NOT EXISTS public.prospects_b2b (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  text NOT NULL,
  cnpj_basico           text,
  razao_social          text,
  nome_fantasia         text,
  cnae_principal        text,
  cnae_descricao        text,
  situacao_cadastral    text,
  data_inicio_atividade date,
  tipo_logradouro       text,
  logradouro            text,
  numero                text,
  complemento           text,
  bairro                text,
  municipio_rf_code     text,
  municipio             text,
  uf                    text,
  cep                   text,
  telefone              text,
  email                 text,
  lat                   double precision,
  lng                   double precision,
  geocode_status        text NOT NULL DEFAULT 'pending'
                          CHECK (geocode_status IN ('pending','municipio','endereco','cep','manual','failed')),
  is_client             boolean NOT NULL DEFAULT false,
  fonte                 text NOT NULL DEFAULT 'rf_dados_abertos',
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  company_id            uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_b2b_cnpj ON public.prospects_b2b (cnpj);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_uf        ON public.prospects_b2b (uf);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_cnae      ON public.prospects_b2b (cnae_principal);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_municipio ON public.prospects_b2b (uf, municipio);
CREATE INDEX IF NOT EXISTS idx_prospects_b2b_coords    ON public.prospects_b2b (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 3) RLS — so admin enxerga o universo (inteligencia interna; rep nao ve o mercado todo).
ALTER TABLE public.prospects_b2b   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibge_municipios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all on prospects_b2b" ON public.prospects_b2b;
CREATE POLICY "Admin all on prospects_b2b" ON public.prospects_b2b
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin read ibge_municipios" ON public.ibge_municipios;
CREATE POLICY "Admin read ibge_municipios" ON public.ibge_municipios
  FOR SELECT TO authenticated USING (is_admin());
