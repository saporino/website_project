-- Bloco C: Rota de Entrega. Campos de entrega no pedido + RPC segura para o rep.
-- Pedidos com is_personal_delivery=true entram na "tabela de entregas" do rep.

ALTER TABLE public.representative_orders
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS delivery_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_proof_url text,
  ADD COLUMN IF NOT EXISTS delivery_proof_filename text,
  ADD COLUMN IF NOT EXISTS delivery_proof_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_proof_lng double precision;

-- Rep atualiza SÓ a entrega dos PRÓPRIOS pedidos de entrega pessoal (sem policy ampla).
CREATE OR REPLACE FUNCTION public.repco_update_delivery(
  p_order_id uuid, p_status text,
  p_proof_url text DEFAULT NULL, p_proof_filename text DEFAULT NULL,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.representative_orders o
     SET delivery_status = COALESCE(p_status, o.delivery_status),
         delivery_accepted_at = CASE WHEN p_status = 'em_rota' AND o.delivery_accepted_at IS NULL THEN now() ELSE o.delivery_accepted_at END,
         delivered_at = CASE WHEN p_status = 'entregue' THEN now() ELSE o.delivered_at END,
         delivery_proof_url = COALESCE(p_proof_url, o.delivery_proof_url),
         delivery_proof_filename = COALESCE(p_proof_filename, o.delivery_proof_filename),
         delivery_proof_lat = COALESCE(p_lat, o.delivery_proof_lat),
         delivery_proof_lng = COALESCE(p_lng, o.delivery_proof_lng)
   WHERE o.id = p_order_id
     AND o.representative_id = public.my_rep_id()
     AND o.is_personal_delivery = true;
END; $$;
GRANT EXECUTE ON FUNCTION public.repco_update_delivery(uuid, text, text, text, double precision, double precision) TO authenticated;
