-- Saporino Studio — Passo 2: tabelas + RLS + bucket de storage.
-- Aplicado em produção via exec_migration (registro para rastreabilidade).
-- Studio é ADMIN-ONLY (igual à aba no admin); filtro por empresa é no frontend (activeCompanyId).

CREATE TABLE IF NOT EXISTS public.studio_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  created_by UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',            -- pending | processing | completed | error
  duration REAL, language TEXT, brand_detected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), processed_at TIMESTAMPTZ, error_text TEXT
);
CREATE TABLE IF NOT EXISTS public.studio_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.studio_videos(id) ON DELETE CASCADE,
  full_text TEXT, segments JSONB, srt_content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.studio_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.studio_videos(id) ON DELETE CASCADE,
  resumo TEXT, objetivo TEXT, publico_alvo TEXT, gancho TEXT, estrategia TEXT,
  gatilhos JSONB, pontos_fortes JSONB, pontos_fracos JSONB,
  como_reproduzir TEXT, como_melhorar TEXT, como_vender TEXT, workflow TEXT,
  nivel_dificuldade TEXT, analise_visual JSONB, prompts JSONB, legendas JSONB, hashtags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.studio_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.studio_videos(id),
  company_id UUID REFERENCES public.companies(id),
  title TEXT NOT NULL, platform TEXT NOT NULL,   -- instagram | tiktok | facebook | youtube | ecommerce
  content TEXT, prompt_used TEXT, status TEXT DEFAULT 'draft',  -- draft | scheduled | published
  scheduled_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (admin-only)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['studio_videos','studio_transcriptions','studio_analyses','studio_campaigns'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t||'_admin_all', t);
  END LOOP;
END $$;

-- Bucket privado (criado via exec_migration)
INSERT INTO storage.buckets (id, name, public) VALUES ('studio-videos','studio-videos', false) ON CONFLICT (id) DO NOTHING;

-- ATENÇÃO: as políticas de storage.objects NÃO podem ser criadas por exec_migration
-- (a tabela storage.objects é de outro dono → erro "must be owner of table objects").
-- Criar no painel Supabase → Storage → studio-videos → Policies, para role "authenticated":
--   INSERT/SELECT/UPDATE/DELETE  WITH CHECK/USING: bucket_id = 'studio-videos'
