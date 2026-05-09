-- ============================================================
-- REPCO MODULE — Representante Comercial
-- Execute this entire script in Supabase SQL Editor
-- ============================================================

-- 1. REPRESENTATIVES TABLE
CREATE TABLE IF NOT EXISTS public.representatives (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  cpf                   TEXT,
  cnpj                  TEXT,
  email                 TEXT,
  phone                 TEXT,
  commission_rate       DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  has_personal_delivery BOOLEAN NOT NULL DEFAULT false,
  experience_start_date DATE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  approved_at           TIMESTAMPTZ,
  blocked_reason        TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. REPRESENTATIVE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.representative_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id   UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  doc_type            TEXT NOT NULL CHECK (doc_type IN ('cnh','cpf_doc','cnpj_doc','core','contrato')),
  file_url            TEXT NOT NULL,
  file_name           TEXT,
  file_size           BIGINT,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: no delete column — documents are permanent
);

-- 3. REPRESENTATIVE CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.representative_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id   UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  cnpj                TEXT NOT NULL,
  razao_social        TEXT,
  nome_fantasia       TEXT,
  situacao_receita    TEXT,
  endereco_completo   TEXT,
  email_comprador     TEXT,
  email_xml           TEXT,
  nome_comprador      TEXT,
  whatsapp_comprador  TEXT,
  prazo_pagamento     TEXT,
  forma_pagamento     TEXT CHECK (forma_pagamento IN ('boleto','pix','a_vista')),
  limite_credito      DECIMAL(12,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  -- NOTE: clients are NEVER deleted — only inactivated
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. REPRESENTATIVE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.representative_orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id         UUID NOT NULL REFERENCES public.representatives(id),
  representative_client_id  UUID REFERENCES public.representative_clients(id),
  order_number              TEXT UNIQUE NOT NULL,
  description               TEXT,
  total_amount              DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method            TEXT CHECK (payment_method IN ('boleto','pix','a_vista')),
  is_personal_delivery      BOOLEAN NOT NULL DEFAULT false,
  invoice_xml_url           TEXT,
  invoice_pdf_url           TEXT,
  invoice_key               TEXT,   -- chave XML NFe
  invoice_number            TEXT,
  status                    TEXT NOT NULL DEFAULT 'new'
                              CHECK (status IN ('new','pending','completed','cancelled')),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  created_by                UUID REFERENCES auth.users(id) -- admin who created it
);

-- 5. REPRESENTATIVE COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.representative_commissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id   UUID NOT NULL REFERENCES public.representatives(id),
  order_id            UUID NOT NULL REFERENCES public.representative_orders(id),
  order_amount        DECIMAL(12,2) NOT NULL,
  base_rate           DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  pix_bonus           DECIMAL(5,2) NOT NULL DEFAULT 0,    -- 0.5 if pix
  delivery_bonus      DECIMAL(5,2) NOT NULL DEFAULT 0,    -- 2.5 if personal delivery after 90d
  total_rate          DECIMAL(5,2) NOT NULL,
  commission_amount   DECIMAL(12,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at             TIMESTAMPTZ,
  paid_by             UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTO-INCREMENT ORDER NUMBER FOR REPCO ORDERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS repco_order_seq START 1;

CREATE OR REPLACE FUNCTION generate_repco_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'RC-' || LPAD(nextval('repco_order_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_repco_order_number
  BEFORE INSERT ON public.representative_orders
  FOR EACH ROW EXECUTE FUNCTION generate_repco_order_number();

-- ============================================================
-- AUTO-CALCULATE COMMISSION WHEN ORDER COMPLETED
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_repco_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_rep         public.representatives%ROWTYPE;
  v_base_rate   DECIMAL := 5.00;
  v_pix_bonus   DECIMAL := 0;
  v_del_bonus   DECIMAL := 0;
  v_total_rate  DECIMAL;
  v_amount      DECIMAL;
  v_days_exp    INTEGER;
BEGIN
  -- Only trigger when status changes TO 'completed'
  IF OLD.status = NEW.status OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get representative info
  SELECT * INTO v_rep FROM public.representatives WHERE id = NEW.representative_id;

  -- PIX bonus
  IF NEW.payment_method = 'pix' THEN
    v_pix_bonus := 0.50;
  END IF;

  -- Personal delivery bonus (only after 90 days experience)
  IF NEW.is_personal_delivery AND v_rep.experience_start_date IS NOT NULL THEN
    v_days_exp := (CURRENT_DATE - v_rep.experience_start_date);
    IF v_days_exp >= 90 THEN
      v_del_bonus := 2.50;
    END IF;
  END IF;

  -- Cap at 8%
  v_total_rate := LEAST(v_base_rate + v_pix_bonus + v_del_bonus, 8.00);
  v_amount := ROUND((NEW.total_amount * v_total_rate / 100), 2);

  -- Insert commission record
  INSERT INTO public.representative_commissions (
    representative_id, order_id, order_amount,
    base_rate, pix_bonus, delivery_bonus,
    total_rate, commission_amount, status
  ) VALUES (
    NEW.representative_id, NEW.id, NEW.total_amount,
    v_base_rate, v_pix_bonus, v_del_bonus,
    v_total_rate, v_amount, 'pending'
  )
  ON CONFLICT DO NOTHING;

  -- Set completed_at timestamp
  NEW.completed_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_repco_commission
  BEFORE UPDATE ON public.representative_orders
  FOR EACH ROW EXECUTE FUNCTION calculate_repco_commission();

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER representatives_updated_at
  BEFORE UPDATE ON public.representatives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER rep_clients_updated_at
  BEFORE UPDATE ON public.representative_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.representatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_clients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_commissions ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: get representative id for current user
CREATE OR REPLACE FUNCTION my_rep_id()
RETURNS UUID AS $$
  SELECT id FROM public.representatives WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- REPRESENTATIVES policies
CREATE POLICY "Admin can do everything on representatives"
  ON public.representatives FOR ALL USING (is_admin());

CREATE POLICY "RepCo can view own record"
  ON public.representatives FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "RepCo can update own record"
  ON public.representatives FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone authenticated can insert own registration"
  ON public.representatives FOR INSERT WITH CHECK (user_id = auth.uid());

-- REPRESENTATIVE DOCUMENTS policies
CREATE POLICY "Admin can do everything on rep_documents"
  ON public.representative_documents FOR ALL USING (is_admin());

CREATE POLICY "RepCo can view own documents"
  ON public.representative_documents FOR SELECT
  USING (representative_id = my_rep_id());

CREATE POLICY "RepCo can upload own documents"
  ON public.representative_documents FOR INSERT
  WITH CHECK (representative_id = my_rep_id());
  -- NOTE: no DELETE policy for RepCo — only admin can delete via admin bypass

-- REPRESENTATIVE CLIENTS policies
CREATE POLICY "Admin can do everything on rep_clients"
  ON public.representative_clients FOR ALL USING (is_admin());

CREATE POLICY "RepCo can view own clients"
  ON public.representative_clients FOR SELECT
  USING (representative_id = my_rep_id());

CREATE POLICY "RepCo can insert own clients"
  ON public.representative_clients FOR INSERT
  WITH CHECK (representative_id = my_rep_id());
  -- NOTE: no UPDATE/DELETE for RepCo — only admin can edit client data

-- REPRESENTATIVE ORDERS policies
CREATE POLICY "Admin can do everything on rep_orders"
  ON public.representative_orders FOR ALL USING (is_admin());

CREATE POLICY "RepCo can view own orders"
  ON public.representative_orders FOR SELECT
  USING (representative_id = my_rep_id());

-- REPRESENTATIVE COMMISSIONS policies
CREATE POLICY "Admin can do everything on rep_commissions"
  ON public.representative_commissions FOR ALL USING (is_admin());

CREATE POLICY "RepCo can view own commissions"
  ON public.representative_commissions FOR SELECT
  USING (representative_id = my_rep_id());

-- ============================================================
-- STORAGE BUCKET FOR REPRESENTATIVE DOCUMENTS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'representative-docs',
  'representative-docs',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admin can access all rep docs in storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'representative-docs' AND is_admin());

CREATE POLICY "RepCo can upload own docs to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'representative-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "RepCo can view own docs in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'representative-docs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_representatives_user_id ON public.representatives(user_id);
CREATE INDEX IF NOT EXISTS idx_representatives_status ON public.representatives(status);
CREATE INDEX IF NOT EXISTS idx_rep_docs_rep_id ON public.representative_documents(representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_clients_rep_id ON public.representative_clients(representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_clients_cnpj ON public.representative_clients(cnpj);
CREATE INDEX IF NOT EXISTS idx_rep_orders_rep_id ON public.representative_orders(representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_orders_status ON public.representative_orders(status);
CREATE INDEX IF NOT EXISTS idx_rep_commissions_rep_id ON public.representative_commissions(representative_id);
CREATE INDEX IF NOT EXISTS idx_rep_commissions_status ON public.representative_commissions(status);

-- ============================================================
-- DONE! All RepCo tables, triggers, RLS, and storage created.
-- ============================================================
