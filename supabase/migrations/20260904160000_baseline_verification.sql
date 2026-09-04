-- Fase B — verificação do baseline de migrações (04/09/2026).
-- Migration deliberadamente inócua e reversível: apenas registra um comentário no schema.
-- Objetivo: provar que o Supabase CLI reconhece o baseline normalizado e aplica
-- somente esta migration, sem tentar reaplicar o schema histórico.
COMMENT ON SCHEMA public IS 'RepCo/COFICO — baseline de migracoes normalizado em 2026-09-04 (Fase B). Historico oficial em supabase_migrations.schema_migrations.';
