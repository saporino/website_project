-- Camada 3 (fundação multi-tenant): tabela companies + company_id nas tabelas core + backfill.
-- ADITIVO e seguro: NÃO altera policies (o app segue funcionando). A ATIVAÇÃO do escopo
-- por company_id nas policies RLS é passo de go-live e exige teste do Vlademir (pode travar acesso).

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.companies (name, cnpj)
SELECT 'Café Saporino Ltda', '61109694000194'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

DO $$
DECLARE
  v_company uuid;
  v_table   text;
  v_tables  text[] := ARRAY[
    'representatives','representative_clients','representative_orders','representative_order_items',
    'representative_commissions','representative_commission_payouts','representative_order_installments',
    'products','price_lists','prospect_leads','prospect_lists'
  ];
BEGIN
  SELECT id INTO v_company FROM public.companies ORDER BY created_at LIMIT 1;
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id)', v_table);
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', v_table, v_company);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)', v_table||'_company_idx', v_table);
  END LOOP;
END $$;
