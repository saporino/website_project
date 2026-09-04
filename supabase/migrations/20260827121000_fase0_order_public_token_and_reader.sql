/*
  Fase 0 / Segurança — Token público de pedido (armazenado como HASH) +
  função de consulta pública mínima. Base do checkout anônimo seguro.

  - orders.order_public_token_hash: SHA-256 (hex) do token público. O token puro
    NUNCA é gravado; só o hash. Gerado pela edge function create-checkout-order.
  - get_order_public(order_id, token): SECURITY DEFINER; retorna SOMENTE campos
    não sensíveis do pedido, e apenas se o hash do token bater. Não vaza
    e-mail/telefone/endereço/CPF. Resposta genérica quando não casa (anti-enumeração).

  Aditivo e não-destrutivo. NÃO aplicar sem revisão.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_public_token_hash text;
CREATE INDEX IF NOT EXISTS orders_public_token_hash_idx ON orders (order_public_token_hash);

CREATE OR REPLACE FUNCTION public.get_order_public(p_order_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_order orders%ROWTYPE;
  v_items jsonb;
BEGIN
  IF p_order_id IS NULL OR p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND order_public_token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN NULL; -- genérico: não revela se o pedido existe
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_name', oi.product_name,
           'quantity', oi.quantity
         )), '[]'::jsonb)
  INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order.id;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'total_amount', v_order.total_amount,
    'created_at', v_order.created_at,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_public(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_public(uuid, text) TO anon, authenticated;
