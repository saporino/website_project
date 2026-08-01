-- COFICO Entregas — Bloco 1 (Fundação). Aditivo e idempotente.
-- Aplicado em produção via exec_migration em 01/08/2026.

-- 1) COFICO como OPERADORA (não vende; fora do picker de venda; só o motorista a enxerga)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_operator boolean NOT NULL DEFAULT false;

INSERT INTO public.companies (name, fantasia, cnpj, uf, is_active, is_operator, commission_model, allow_cash, is_b2c, order_prefix, sort_order)
SELECT 'V. Medeiros de Santi Ltda', 'COFICO Brasil', '66006929000136', 'SP', true, true, 'none', false, false, 'CO', 3
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE cnpj = '66006929000136');

-- 2) MOTORISTA (molde de promoters/representatives)
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  cpf text,
  cnh text,
  cnh_categoria text,
  cnh_validade date,
  phone text,
  email text,
  company_id uuid REFERENCES public.companies(id),
  vehicle_desc text,
  vehicle_plate text,
  status text NOT NULL DEFAULT 'pending',
  blocked_reason text,
  approved_at timestamptz,
  notes text,
  last_seen_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  is_online boolean NOT NULL DEFAULT false,
  current_tab text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON public.drivers(company_id);

-- helper: id do motorista logado (espelha my_rep_id)
CREATE OR REPLACE FUNCTION public.my_driver_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$fn$;

-- 3) ROTAS DE ENTREGA (próprias — não misturam com visita de rep/promotora)
CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id),
  scheduled_date date,
  status text NOT NULL DEFAULT 'planned',      -- planned|dispatched|in_progress|done|canceled
  origin_label text NOT NULL DEFAULT 'CD Várzea Paulista',
  origin_lat double precision DEFAULT -23.21,
  origin_lng double precision DEFAULT -46.83,
  total_stops int DEFAULT 0,
  total_km numeric DEFAULT 0,
  total_weight_kg numeric DEFAULT 0,
  planned_by uuid,
  planned_at timestamptz,
  dispatched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_droutes_driver_date ON public.delivery_routes(driver_id, scheduled_date);

-- 4) PARADAS: 1 parada = 1 pedido. company_id da MARCA (nunca misturar no faturamento).
CREATE TABLE IF NOT EXISTS public.delivery_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.representative_orders(id),
  company_id uuid REFERENCES public.companies(id),
  stop_order int,
  client_name text,
  address text,
  city text,
  zone text,
  lat double precision,
  lng double precision,
  weight_kg numeric,
  distance_from_cd_km numeric,
  point_type text NOT NULL DEFAULT 'loja',     -- cd_agendado|loja|hortifruti|outro
  scheduled_window text,
  status text NOT NULL DEFAULT 'pending',        -- pending|en_route|arrived|delivered|failed
  pickup_photo_url text,
  delivery_photo_url text,
  canhoto_photo_url text,
  delivered_at timestamptz,
  delivered_lat double precision,
  delivered_lng double precision,
  arrival_at timestamptz,
  departure_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dstops_route ON public.delivery_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_dstops_order ON public.delivery_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_dstops_company ON public.delivery_stops(company_id);

-- 5) BUCKET privado dos comprovantes (coleta/entrega/canhoto):
--    criado pela API de Storage (service role) fora deste SQL. Upload/leitura via Edge Function
--    (service role) + signed URL — não usa policy de storage.objects (service role não é dono da tabela).

-- 6) RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drivers_admin ON public.drivers;
CREATE POLICY drivers_admin ON public.drivers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS drivers_self ON public.drivers;
CREATE POLICY drivers_self ON public.drivers FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS droutes_admin ON public.delivery_routes;
CREATE POLICY droutes_admin ON public.delivery_routes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS droutes_driver ON public.delivery_routes;
CREATE POLICY droutes_driver ON public.delivery_routes FOR SELECT USING (driver_id = public.my_driver_id());

DROP POLICY IF EXISTS dstops_admin ON public.delivery_stops;
CREATE POLICY dstops_admin ON public.delivery_stops FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS dstops_driver_sel ON public.delivery_stops;
CREATE POLICY dstops_driver_sel ON public.delivery_stops FOR SELECT
  USING (route_id IN (SELECT id FROM public.delivery_routes WHERE driver_id = public.my_driver_id()));
DROP POLICY IF EXISTS dstops_driver_upd ON public.delivery_stops;
CREATE POLICY dstops_driver_upd ON public.delivery_stops FOR UPDATE
  USING (route_id IN (SELECT id FROM public.delivery_routes WHERE driver_id = public.my_driver_id()))
  WITH CHECK (route_id IN (SELECT id FROM public.delivery_routes WHERE driver_id = public.my_driver_id()));
