-- Bloco 5: Trava de cliente por boleto vencido.
-- Cliente fica bloqueado (não pode receber pedido novo) quando tem parcela de boleto
-- vencida e ainda não paga. Destrava automaticamente quando o comprovante é anexado
-- (parcela vira 'paid' -> sai desta view). security_invoker p/ respeitar RLS.

CREATE OR REPLACE VIEW public.vw_repco_clientes_bloqueados
WITH (security_invoker = true) AS
SELECT o.representative_client_id AS client_id,
       min(i.due_date) AS vencido_em,
       count(*) AS parcelas_vencidas
FROM public.representative_order_installments i
JOIN public.representative_orders o ON o.id = i.order_id
WHERE i.status <> 'paid'
  AND i.due_date IS NOT NULL
  AND i.due_date < current_date
GROUP BY o.representative_client_id;

GRANT SELECT ON public.vw_repco_clientes_bloqueados TO authenticated;
