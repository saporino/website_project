-- Heatmap geográfico: adiciona lat/lng (média das coords dos clientes) à view de vendas por área.
-- lat/lng vêm de representative_clients.lat/lng, preenchidos por geocodificação (Nominatim/OSM)
-- do município/UF do cliente. Permite plotar pinos no mapa do painel de inteligência.

CREATE OR REPLACE VIEW public.vw_repco_vendas_por_area
WITH (security_invoker = true) AS
SELECT date_trunc('month', o.created_at)::date AS mes,
       c.uf, c.municipio,
       count(*) AS pedidos,
       sum(o.total_amount) AS faturamento,
       avg(c.lat) AS lat, avg(c.lng) AS lng
FROM public.representative_orders o
JOIN public.representative_clients c ON c.id = o.representative_client_id
WHERE o.status = 'completed'
GROUP BY 1, 2, 3;
