-- TASK INTEL-1 — Discovery Intelligence HUB (multi-source foundation). ADITIVO.
-- Prepara discovery_results/campaigns para fontes SOCIAL/CREATOR (TikTok/Instagram/creators/afiliados)
-- SEM ativar nenhum adapter novo agora. Só garante que futuros normalizers populem colunas já existentes
-- (evita migration/rebuild depois). Creator/Affiliate são result_types próprios — NÃO viram lead automaticamente.

ALTER TABLE public.discovery_results ADD COLUMN IF NOT EXISTS follower_count   integer;      -- perfis/creators (público)
ALTER TABLE public.discovery_results ADD COLUMN IF NOT EXISTS engagement_rate  numeric(6,3); -- quando publicamente disponível
ALTER TABLE public.discovery_results ADD COLUMN IF NOT EXISTS niche            text;         -- café/receitas/lifestyle/varejo...
ALTER TABLE public.discovery_results ADD COLUMN IF NOT EXISTS confidence       integer;      -- 0-100, qualidade/aderência da descoberta

-- Campanha de descoberta: objetivos (tipos de parceiro desejados) + produto/orçamento (foundation p/ Sales Campaign futura)
ALTER TABLE public.discovery_campaigns ADD COLUMN IF NOT EXISTS objectives   text[] NOT NULL DEFAULT '{}'; -- reps/sellers/affiliates/creators/business/community...
ALTER TABLE public.discovery_campaigns ADD COLUMN IF NOT EXISTS product_ref  text;                          -- produto/linha alvo (livre por enquanto)
ALTER TABLE public.discovery_campaigns ADD COLUMN IF NOT EXISTS budget_usd   numeric(10,2);                 -- teto de discovery (opcional)

COMMENT ON COLUMN public.discovery_results.result_type IS
  'Vocabulário aberto: BUSINESS|B2B_LEAD|SALES_REP_CANDIDATE|INDEPENDENT_SELLER|AFFILIATE|CREATOR|UGC_CREATOR|INFLUENCER|DISTRIBUTOR|PUBLIC_WHATSAPP_GROUP|PUBLIC_WHATSAPP_CHANNEL|COMMUNITY|PUBLIC_SOCIAL_PROFILE|PUBLIC_SOCIAL_POST|OTHER';
