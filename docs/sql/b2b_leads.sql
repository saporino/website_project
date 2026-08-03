-- Leads B2B (formulário "Para Seu Negócio"). Aditivo.
-- Público pode INSERIR (é um formulário de contato); admin lê/gerencia.
CREATE TABLE IF NOT EXISTS public.b2b_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text, empresa text, telefone text, email text, site text, redes_sociais text,
  cidade text, uf text,
  descricao text,
  tipos_cafe text[],          -- Tradicional | Extra Forte | 100% Arábica | Café de Combate | Grão Expresso Gourmet
  formato text,               -- moido | grao
  torras text[],              -- Média Clara | Média | Média Escura | Escura
  grao_tipo text,             -- arabica | conilon (quando grão)
  volume_valor numeric,
  volume_unidade text,        -- kg | ton
  embalagens text[],          -- Fardo 5kg/10kg/20kg | Pacote 250g/500g/1kg/5kg | Outra
  consent_lgpd boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'novo',   -- novo | em_contato | em_negociacao | ativo | perdido
  converted_client_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_status ON public.b2b_leads(status, created_at DESC);

ALTER TABLE public.b2b_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS b2b_insert_public ON public.b2b_leads;
CREATE POLICY b2b_insert_public ON public.b2b_leads FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS b2b_admin_all ON public.b2b_leads;
CREATE POLICY b2b_admin_all ON public.b2b_leads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
