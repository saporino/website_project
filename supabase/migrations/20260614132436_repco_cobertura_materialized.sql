-- Camada 2 — PERFORMANCE do mapa de cobertura em escala (SP inteiro = ~759k PDVs).
-- A agregacao por municipio ao vivo (vw_repco_cobertura sobre prospects_b2b) estourava o
-- statement timeout (~8s) no volume completo. Materializamos a parte pesada (prospects por
-- municipio) e mantemos os clientes ao vivo (tabela pequena).
--
-- IMPORTANTE: apos cada carga de ETL (scripts/etl_cnpj.py) rodar:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_repco_prospects_muni;

SET statement_timeout TO '180s';

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_repco_prospects_muni AS
SELECT uf,
       translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') AS muni_key,
       max(municipio) AS municipio,
       count(*) AS prospects,
       count(*) FILTER (WHERE is_client = false) AS prospects_nao_clientes,
       avg(lat) AS lat, avg(lng) AS lng
FROM public.prospects_b2b
WHERE municipio IS NOT NULL
GROUP BY uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn');

-- unique index -> permite REFRESH ... CONCURRENTLY (nao bloqueia leitura do mapa)
CREATE UNIQUE INDEX IF NOT EXISTS mv_repco_prospects_muni_key ON public.mv_repco_prospects_muni (uf, muni_key);
GRANT SELECT ON public.mv_repco_prospects_muni TO authenticated;

-- vw_repco_cobertura agora le da MV (rapido) + clientes ao vivo; gate is_admin().
CREATE OR REPLACE VIEW public.vw_repco_cobertura
WITH (security_invoker = true) AS
WITH cl AS (
  SELECT uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') AS muni_key,
         max(municipio) AS municipio, count(*) AS clientes
  FROM public.representative_clients
  WHERE status = 'active' AND municipio IS NOT NULL
  GROUP BY uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')
)
SELECT COALESCE(pr.uf, cl.uf) AS uf,
       COALESCE(pr.municipio, cl.municipio) AS municipio,
       COALESCE(cl.clientes, 0) AS clientes,
       COALESCE(pr.prospects, 0) AS prospects,
       COALESCE(pr.prospects_nao_clientes, 0) AS prospects_nao_clientes,
       pr.lat, pr.lng
FROM public.mv_repco_prospects_muni pr
FULL JOIN cl ON cl.uf = pr.uf AND cl.muni_key = pr.muni_key
WHERE public.is_admin();
