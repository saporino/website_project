-- Camada 3 — ATIVAÇÃO da RLS multi-tenant (escopo por company_id).
-- ⚠️ Este arquivo cria APENAS o helper my_company_id() (inócuo: não muda acesso).
-- O bloco de POLICIES está COMENTADO de propósito: aplicar SOMENTE no go-live / ao
-- onboardar a 2ª empresa, COM o Vlademir vendo o login logo após (policy errada tranca
-- o acesso de todos, e via RPC isso bate na PRODUÇÃO na hora). Com 1 só empresa hoje,
-- ligar o escopo não traz benefício e só adiciona risco.

-- Helper: company_id do usuário logado (rep via representatives; admin pode não ter rep).
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT company_id FROM public.representatives WHERE user_id = auth.uid() LIMIT 1;
$$;

/*  ====== APLICAR NO GO-LIVE (descomentar, rodar, e testar login imediatamente) ======
    Padrão: cada tabela ganha uma policy RESTRICTIVE de empresa, que SEMPRE libera admin
    (is_admin) p/ não trancar o painel. Replicar para as 11 tabelas core.

    Exemplo para representative_orders:

    ALTER TABLE public.representative_orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS company_scope ON public.representative_orders;
    CREATE POLICY company_scope ON public.representative_orders
      AS RESTRICTIVE FOR ALL
      USING (public.is_admin() OR company_id = public.my_company_id())
      WITH CHECK (public.is_admin() OR company_id = public.my_company_id());

    -- Repetir para: representatives, representative_clients, representative_order_items,
    -- representative_commissions, representative_commission_payouts,
    -- representative_order_installments, products, price_lists, prospect_leads, prospect_lists.
    -- ATENÇÃO: garantir que todo usuário tenha company_id resolvível (senão lockout).
    ============================================================================== */
