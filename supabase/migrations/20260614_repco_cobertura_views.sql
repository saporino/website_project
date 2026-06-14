-- Camada 2 — views de COBERTURA (mapa cliente x prospect). NAO tocam nas vw_repco_vendas_*.
-- Diferenca-chave: NAO filtram por pedido 'completed' (cobertura mostra clientes e prospects
-- independente de venda fechada).

-- security_invoker = true -> as views RESPEITAM a RLS das tabelas base (admin-only em prospects_b2b).

-- Clientes ativos com coordenada (qualquer cliente, com ou sem venda).
CREATE OR REPLACE VIEW public.vw_repco_clientes_geo
WITH (security_invoker = true) AS
SELECT c.id,
       COALESCE(c.nome_fantasia, c.razao_social, c.nome_completo) AS nome,
       c.municipio, c.uf, c.lat, c.lng, c.cnpj
FROM public.representative_clients c
WHERE c.status = 'active' AND c.lat IS NOT NULL AND c.lng IS NOT NULL;

-- Cobertura agregada por municipio: nº de clientes ativos x nº de prospects no universo.
-- Chave de join normalizada (minusculo SEM acento) para casar "Jundiaí" (cliente) com "JUNDIAI" (RF).
CREATE OR REPLACE VIEW public.vw_repco_cobertura
WITH (security_invoker = true) AS
WITH cl AS (
  SELECT uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') AS muni_key,
         max(municipio) AS municipio, count(*) AS clientes
  FROM public.representative_clients
  WHERE status = 'active' AND municipio IS NOT NULL
  GROUP BY uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')
),
pr AS (
  SELECT uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') AS muni_key,
         max(municipio) AS municipio,
         count(*) AS prospects,
         count(*) FILTER (WHERE is_client = false) AS prospects_nao_clientes,
         avg(lat) AS lat, avg(lng) AS lng
  FROM public.prospects_b2b
  WHERE municipio IS NOT NULL
  GROUP BY uf, translate(lower(municipio),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')
)
SELECT COALESCE(cl.uf, pr.uf) AS uf,
       COALESCE(pr.municipio, cl.municipio) AS municipio,
       COALESCE(cl.clientes, 0) AS clientes,
       COALESCE(pr.prospects, 0) AS prospects,
       COALESCE(pr.prospects_nao_clientes, 0) AS prospects_nao_clientes,
       pr.lat, pr.lng
FROM cl FULL OUTER JOIN pr ON cl.uf = pr.uf AND cl.muni_key = pr.muni_key;

GRANT SELECT ON public.vw_repco_clientes_geo, public.vw_repco_cobertura TO authenticated;
