-- Camada 1.2 do blueprint: views de agregação (fonte única no banco).
-- security_invoker = true -> a view RESPEITA a RLS das tabelas base:
--   rep enxerga só o próprio dado; admin (is_admin) enxerga tudo. Sem vazamento entre reps.
-- Apenas pedidos concluídos. Agrupadas por mês p/ permitir filtro de período no front.

CREATE OR REPLACE VIEW public.vw_repco_vendas_por_area
WITH (security_invoker = true) AS
SELECT date_trunc('month', o.created_at)::date AS mes,
       c.uf, c.municipio,
       count(*) AS pedidos,
       sum(o.total_amount) AS faturamento
FROM public.representative_orders o
JOIN public.representative_clients c ON c.id = o.representative_client_id
WHERE o.status = 'completed'
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW public.vw_repco_vendas_por_linha
WITH (security_invoker = true) AS
SELECT date_trunc('month', o.created_at)::date AS mes,
       COALESCE(p.product_line, 'Sem linha') AS product_line,
       sum(i.quantity) AS itens,
       sum(i.quantity * i.unit_price) AS faturamento
FROM public.representative_orders o
JOIN public.representative_order_items i ON i.order_id = o.id
JOIN public.products p ON p.id = i.product_id
WHERE o.status = 'completed'
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_repco_vendas_por_canal
WITH (security_invoker = true) AS
SELECT date_trunc('month', o.created_at)::date AS mes,
       COALESCE(o.channel, 'repco') AS canal,
       count(*) AS pedidos,
       sum(o.total_amount) AS faturamento
FROM public.representative_orders o
WHERE o.status = 'completed'
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_repco_vendas_por_rep
WITH (security_invoker = true) AS
SELECT o.representative_id,
       r.full_name AS rep_nome,
       count(*) AS pedidos,
       sum(o.total_amount) AS faturamento,
       round(avg(o.total_amount), 2) AS ticket_medio,
       count(DISTINCT o.representative_client_id) AS clientes_com_pedido
FROM public.representative_orders o
LEFT JOIN public.representatives r ON r.id = o.representative_id
WHERE o.status = 'completed'
GROUP BY o.representative_id, r.full_name;

CREATE OR REPLACE VIEW public.vw_repco_preco_praticado
WITH (security_invoker = true) AS
SELECT COALESCE(p.product_line, 'Sem linha') AS product_line,
       c.uf,
       round(avg(i.unit_price), 2) AS preco_medio,
       sum(i.quantity) AS itens
FROM public.representative_orders o
JOIN public.representative_order_items i ON i.order_id = o.id
JOIN public.products p ON p.id = i.product_id
JOIN public.representative_clients c ON c.id = o.representative_client_id
WHERE o.status = 'completed'
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.vw_repco_clientes_ativos_por_area
WITH (security_invoker = true) AS
SELECT c.uf, c.municipio,
       count(*) FILTER (WHERE c.status = 'active') AS clientes_ativos,
       count(*) AS clientes_total
FROM public.representative_clients c
GROUP BY c.uf, c.municipio;

GRANT SELECT ON
  public.vw_repco_vendas_por_area,
  public.vw_repco_vendas_por_linha,
  public.vw_repco_vendas_por_canal,
  public.vw_repco_vendas_por_rep,
  public.vw_repco_preco_praticado,
  public.vw_repco_clientes_ativos_por_area
TO authenticated;
