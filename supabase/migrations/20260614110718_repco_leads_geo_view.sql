-- Camada 2 — view de LEADS geolocalizados (prospect_leads) para o mapa de cobertura.
-- security_invoker = true -> respeita a RLS de prospect_leads (admin ve tudo; rep ve os seus).
-- NAO altera a Prospeccao existente (ProspectionManager) nem o fluxo do rep.

CREATE OR REPLACE VIEW public.vw_repco_leads_geo
WITH (security_invoker = true) AS
SELECT le.id, le.company_name, le.trade_name, le.cnpj,
       le.city AS municipio, le.state, le.lat, le.lng, le.status,
       le.prospect_list_id,
       COALESCE(le.representative_id, pl.assigned_representative_id) AS rep_id,
       r.full_name AS rep_nome
FROM public.prospect_leads le
JOIN public.prospect_lists pl ON pl.id = le.prospect_list_id
LEFT JOIN public.representatives r ON r.id = COALESCE(le.representative_id, pl.assigned_representative_id)
WHERE le.lat IS NOT NULL AND le.lng IS NOT NULL;

GRANT SELECT ON public.vw_repco_leads_geo TO authenticated;
