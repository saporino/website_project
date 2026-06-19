-- Indicador de café cru (CEPEA/ESALQ) — série manual + automática.
create table if not exists public.coffee_market_index (
  id         bigint generated always as identity primary key,
  ref_date   date not null unique,
  arabica    numeric(10,2),
  conilon    numeric(10,2),
  source     text default 'cepea_manual',   -- cepea_manual | cepea_auto
  note       text,
  created_at timestamptz not null default now()
);
alter table public.coffee_market_index enable row level security;
drop policy if exists "Admin all coffee_index" on public.coffee_market_index;
create policy "Admin all coffee_index" on public.coffee_market_index
  for all to authenticated using (is_admin()) with check (is_admin());

-- ATUALIZACAO AUTOMATICA:
-- O CEPEA bloqueia bots (403). A Edge Function `cepea-cafe` busca o indicador no
-- Noticias Agricolas (que republica o CEPEA) e da upsert aqui.
-- Agendamento diario (19h BRT, seg-sex) via pg_cron (aplicado direto no banco; a
-- chamada usa a service_role key no header, por isso NAO fica versionada aqui):
--   select cron.schedule('cepea-cafe-daily', '0 22 * * 1-5',
--     'select net.http_post(url:=''.../functions/v1/cepea-cafe'', body:=''{}''::jsonb,
--        headers:=''{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}''::jsonb);');
