-- COFICO Entregas — Bloco 1b: frete + transportadora no pedido do RepCo. Aditivo/idempotente.
-- Frete fica no pedido (0 se não houver). Transportadora pode ser COFICO (cai na fila COFICO)
-- ou externa (cobrança vem da transportadora; Saporino/Fazendinha paga direto, fora da COFICO).

-- transportadora "própria" (COFICO) marcada com is_own
ALTER TABLE public.shipping_carriers ADD COLUMN IF NOT EXISTS is_own boolean NOT NULL DEFAULT false;

INSERT INTO public.shipping_carriers (name, code, is_active, is_own, price_per_kg, fixed_price, delivery_time_days)
SELECT 'COFICO', 'cofico', true, true, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_carriers WHERE code = 'cofico');

-- frete + transportadora no pedido
ALTER TABLE public.representative_orders ADD COLUMN IF NOT EXISTS freight_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.representative_orders ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.shipping_carriers(id);
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON public.representative_orders(carrier_id);

-- NOTA INTERNA (não é coluna): a margem COFICO da Fazendinha (R$1,50/kg + 2% NF) é cálculo
-- ADMIN-ONLY na nota de serviço (Bloco 5). NUNCA aparece no pedido do representante.
