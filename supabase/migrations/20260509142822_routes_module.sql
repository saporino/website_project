CREATE TABLE IF NOT EXISTS public.representative_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.representative_routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  segment TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  visit_status TEXT NOT NULL DEFAULT 'pending',
  visit_notes TEXT,
  visited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.representative_routes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='representative_routes' AND policyname='Admin full access on routes') THEN
    CREATE POLICY "Admin full access on routes" ON public.representative_routes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='representative_routes' AND policyname='RepCo reads own routes') THEN
    CREATE POLICY "RepCo reads own routes" ON public.representative_routes FOR SELECT TO authenticated
    USING (representative_id IN (SELECT id FROM public.representatives WHERE user_id = auth.uid()));
  END IF;
END $$;

ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='route_stops' AND policyname='Admin full access on route_stops') THEN
    CREATE POLICY "Admin full access on route_stops" ON public.route_stops FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='route_stops' AND policyname='RepCo reads and updates own route stops') THEN
    CREATE POLICY "RepCo reads and updates own route stops" ON public.route_stops FOR ALL TO authenticated
    USING (route_id IN (
      SELECT r.id FROM public.representative_routes r
      JOIN public.representatives rep ON rep.id = r.representative_id
      WHERE rep.user_id = auth.uid()
    ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='routes_updated_at') THEN
    CREATE TRIGGER routes_updated_at BEFORE UPDATE ON public.representative_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='route_stops_updated_at') THEN
    CREATE TRIGGER route_stops_updated_at BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routes_representative_id ON public.representative_routes(representative_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON public.route_stops(visit_status);
