-- Camada 1 (RepCo inteligência geográfica): rastreio da geocodificação do cliente.
-- Migração ADITIVA e idempotente. Não altera a tela /repco/inteligencia nem as views vw_repco_*.
-- lat/lng já existem (20260602_repco_camada1_dimensoes.sql); aqui só adicionamos o status/auditoria.

ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS geocode_status text NOT NULL DEFAULT 'pending'
    CHECK (geocode_status IN ('pending','success','failed','manual')),
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- Quem já tem coordenada (ex.: backfill manual anterior) entra como 'success'.
UPDATE public.representative_clients
   SET geocode_status = 'success', geocoded_at = COALESCE(geocoded_at, now())
 WHERE lat IS NOT NULL AND lng IS NOT NULL AND geocode_status <> 'success';
