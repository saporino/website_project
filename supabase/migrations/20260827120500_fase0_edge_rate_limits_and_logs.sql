/*
  Fase 0 / P0 — Base para rate limiting e observabilidade das edge functions.
  Sem serviço externo pago: tudo no próprio Postgres.

  - edge_rate_limits: contador por (key, janela). A RPC check_rate_limit faz o
    incremento atômico e devolve se a chamada está dentro do limite.
  - edge_logs: log estruturado buscável por SQL (função, request_id, nível, erro,
    duração), base para um painel de observabilidade no admin.

  As duas tabelas são acessadas pelas edge functions via SERVICE ROLE (bypass RLS).
  RLS habilitada e restrita a admin para leitura no painel.

  NÃO aplicar em produção sem revisão. Ver REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.md.
  Os helpers _shared/rateLimit.ts e _shared/log.ts já existem mas ainda NÃO estão
  ligados nas funções (isso é o passo de deploy, para poder testar em runtime).
*/

-- =====================================================
-- edge_rate_limits + RPC atômica
-- =====================================================
CREATE TABLE IF NOT EXISTS edge_rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE edge_rate_limits ENABLE ROW LEVEL SECURITY;
-- (sem policy para authenticated: só service role acessa)

-- Incremento atômico + verdadeiro/falso de "dentro do limite".
-- p_key: identificador (ex.: "create-payment:<ip>"), p_limit: nº máx na janela,
-- p_window_seconds: tamanho da janela.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  INSERT INTO edge_rate_limits (bucket_key, window_start, count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = edge_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Sem faxina inline (para a migration ser estritamente não-destrutiva).
  -- A limpeza de janelas antigas de edge_rate_limits será um job periódico futuro.

  RETURN v_count <= p_limit;
END;
$$;

-- =====================================================
-- edge_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS edge_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           timestamptz NOT NULL DEFAULT now(),
  function_name text       NOT NULL,
  request_id   text,
  level        text        NOT NULL DEFAULT 'info',
  status       integer,
  duration_ms  integer,
  error_text   text,
  meta         jsonb
);

CREATE INDEX IF NOT EXISTS edge_logs_ts_idx ON edge_logs (ts DESC);
CREATE INDEX IF NOT EXISTS edge_logs_fn_idx ON edge_logs (function_name, ts DESC);

ALTER TABLE edge_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read edge_logs" ON edge_logs;
CREATE POLICY "Admins can read edge_logs"
  ON edge_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true));
