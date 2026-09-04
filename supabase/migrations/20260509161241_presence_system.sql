-- 1A. Adiciona colunas de presença e localização
ALTER TABLE public.representatives
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_lat NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS last_lng NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS current_tab TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- 1B. Realtime (tabelas já adicionadas anteriormente - IF NOT EXISTS não existe para publicação, ignorar erros de duplicata)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.representatives;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1C. Função que marca reps offline após 3 minutos sem heartbeat
CREATE OR REPLACE FUNCTION mark_inactive_reps()
RETURNS VOID AS $$
BEGIN
  UPDATE public.representatives
  SET is_online = FALSE
  WHERE is_online = TRUE
  AND last_seen_at < NOW() - INTERVAL '3 minutes';
END;
$$ LANGUAGE plpgsql;

-- 1D. pg_cron (requer extensão habilitada no Dashboard → Database → Extensions → pg_cron)
SELECT cron.schedule(
  'mark-inactive-reps',
  '* * * * *',
  'SELECT mark_inactive_reps()'
);

-- 1E. RLS: rep só atualiza o próprio registro
DO $$ BEGIN
  CREATE POLICY "Rep updates own presence"
    ON public.representatives
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1F. Índices de performance
CREATE INDEX IF NOT EXISTS idx_representatives_online
  ON public.representatives(is_online, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_representatives_coords
  ON public.representatives(last_lat, last_lng)
  WHERE last_lat IS NOT NULL AND last_lng IS NOT NULL;
