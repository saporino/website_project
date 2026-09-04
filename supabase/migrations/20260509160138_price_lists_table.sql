CREATE TABLE IF NOT EXISTS public.price_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  segment         TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  volume_discount NUMERIC(5,2) DEFAULT 0,
  volume_min_qty  INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, segment)
);

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price_lists" ON public.price_lists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Reps read price_lists"
  ON public.price_lists
  FOR SELECT
  USING (TRUE);

ALTER PUBLICATION supabase_realtime ADD TABLE public.price_lists;
