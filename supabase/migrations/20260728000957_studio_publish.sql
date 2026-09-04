-- ITEM 1 do MASTER_BRIEFING — Publicar no Instagram (aplicado em produção via exec_migration em 28/07/2026)
-- Colunas de mídia/publicação na campanha:
ALTER TABLE public.studio_campaigns
  ADD COLUMN IF NOT EXISTS media_path TEXT,        -- caminho da ARTE FINAL da Saporino no bucket studio-videos (campaigns/<company>/<ts>.<ext>)
  ADD COLUMN IF NOT EXISTS media_type TEXT,         -- 'video' (Reels) | 'image'
  ADD COLUMN IF NOT EXISTS platform_post_id TEXT;   -- id do post retornado pela plataforma (ig media_id)

-- Agendador: cron a cada 5 min chama a edge function publish-scheduled com header x-internal-secret = service role.
-- (O comando real embute a service role key; criado por script fora do repo — ver scratchpad/cron.mjs.)
-- select cron.schedule('studio-publish-scheduled','*/5 * * * *',
--   $$ select net.http_post(url:='https://<ref>.supabase.co/functions/v1/publish-scheduled',
--        headers:=jsonb_build_object('Content-Type','application/json','x-internal-secret','<SERVICE_ROLE_KEY>'),
--        body:='{}'::jsonb); $$);

-- Publicação usa Instagram API with Instagram Login (graph.instagram.com), pois o token salvo é IGAA... (não Facebook Graph).
-- Edge functions: publish-instagram (1 campanha, admin OU x-internal-secret) e publish-scheduled (cron).
