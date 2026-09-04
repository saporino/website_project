-- =====================================================================
-- A4 — Detecção de arquivos órfãos no Storage (05/09/2026)
--
-- Problema: apagar um pedido, cliente ou visita remove as linhas, mas o arquivo
-- continua no bucket. ON DELETE CASCADE não alcança o Storage. Resultado: lixo
-- permanente e risco de retenção indevida de documento que deveria ter sumido.
--
-- Princípio desta migration: DETECTAR, não apagar. Nada é removido aqui.
-- A remoção é feita pela edge function storage-cleanup, que exige administrador,
-- roda em dry-run por padrão e registra tudo em storage_cleanup_log.
-- =====================================================================

-- Todas as colunas do banco que apontam para arquivo no Storage.
-- Quando uma coluna nova aparecer, ela entra aqui — é a lista que define
-- o que conta como "referenciado".
create or replace view public.vw_storage_references as
  select 'representative_orders'::text as origem, unnest(array[
           invoice_pdf_url, invoice_xml_url, payment_proof_url,
           commission_paid_proof_url, service_invoice_url, delivery_proof_url]) as ref
    from public.representative_orders
  union all select 'representative_order_installments', unnest(array[boleto_url, proof_url])
    from public.representative_order_installments
  union all select 'representative_commissions', proof_url from public.representative_commissions
  union all select 'representative_commission_payouts', proof_url from public.representative_commission_payouts
  union all select 'representative_clients', score_serasa_pdf_url from public.representative_clients
  union all select 'representative_documents', file_url from public.representative_documents
  union all select 'representative_routes', report_pdf_url from public.representative_routes
  union all select 'invoices', unnest(array[invoice_pdf_url, invoice_xml_url]) from public.invoices
  union all select 'chat_messages', attachment_url from public.chat_messages
  union all select 'chat_conversations', avatar_url from public.chat_conversations
  union all select 'promoter_visit_photos', photo_url from public.promoter_visit_photos
  union all select 'route_stops', proof_photo_url from public.route_stops
  union all select 'delivery_stops', unnest(array[pickup_photo_url, delivery_photo_url, canhoto_photo_url])
    from public.delivery_stops
  union all select 'coffee_offer_photos', storage_path from public.coffee_offer_photos
  union all select 'batch_photos', photo_url from public.batch_photos
  union all select 'lot_documents', storage_path from public.lot_documents
  union all select 'green_coffee_lots', unnest(array[nf_purchase_url, nf_url, supplier_certificate_url, quality_report_url])
    from public.green_coffee_lots
  union all select 'products', image_url from public.products
  union all select 'promo_banners', unnest(array[image_url, overlay_image_url]) from public.promo_banners
  union all select 'popup_settings', unnest(array[image_url, logo_url]) from public.popup_settings
  union all select 'companies', logo_url from public.companies
  union all select 'shipping_carriers', logo_url from public.shipping_carriers
  union all select 'studio_videos', source_url from public.studio_videos
  union all select 'studio_brand_profiles', logo_url from public.studio_brand_profiles
  union all select 'orders', label_url from public.orders
  union all select 'shipments', label_url from public.shipments;

revoke all on public.vw_storage_references from public, anon, authenticated;

-- Candidatos a órfão: objeto no Storage que nenhuma linha referencia.
-- A comparação é por sufixo porque o banco guarda ora o caminho, ora a URL antiga.
-- p_min_age_days evita apagar arquivo recém-enviado que ainda não foi vinculado
-- (o upload acontece ANTES do insert da linha que o referencia).
create or replace function public.storage_orphans(
  p_bucket text default null,
  p_min_age_days int default 7
) returns table (
  bucket_id text,
  name text,
  size_bytes bigint,
  created_at timestamptz,
  age_days int
)
language sql stable security definer set search_path = public, storage
as $$
  select o.bucket_id,
         o.name,
         coalesce((o.metadata->>'size')::bigint, 0),
         o.created_at,
         extract(day from now() - o.created_at)::int
    from storage.objects o
   where (p_bucket is null or o.bucket_id = p_bucket)
     and o.created_at < now() - make_interval(days => p_min_age_days)
     and not exists (
       select 1 from public.vw_storage_references r
        where r.ref is not null and r.ref <> '' and r.ref like '%' || o.name
     )
   order by o.bucket_id, o.created_at;
$$;

revoke execute on function public.storage_orphans(text, int) from public, anon;
grant execute on function public.storage_orphans(text, int) to authenticated, service_role;

-- Resumo por bucket, para a decisão de limpeza ser tomada com número na mão.
create or replace function public.storage_orphans_summary(p_min_age_days int default 7)
returns table (bucket_id text, orfaos bigint, total bigint, bytes bigint)
language sql stable security definer set search_path = public, storage
as $$
  select b.id,
         (select count(*) from public.storage_orphans(b.id, p_min_age_days)),
         (select count(*) from storage.objects o where o.bucket_id = b.id),
         coalesce((select sum(size_bytes) from public.storage_orphans(b.id, p_min_age_days)), 0)
    from storage.buckets b
   order by 2 desc, 1;
$$;

revoke execute on function public.storage_orphans_summary(int) from public, anon;
grant execute on function public.storage_orphans_summary(int) to authenticated, service_role;

-- Registro de toda execução de limpeza, inclusive dry-run.
create table if not exists public.storage_cleanup_log (
  id           uuid primary key default gen_random_uuid(),
  executed_by  uuid references auth.users(id),
  bucket_id    text,
  dry_run      boolean not null default true,
  min_age_days int,
  candidates   int not null default 0,
  deleted      int not null default 0,
  objects      jsonb,
  error        text,
  created_at   timestamptz not null default now()
);

alter table public.storage_cleanup_log enable row level security;

drop policy if exists scl_admin on public.storage_cleanup_log;
create policy scl_admin on public.storage_cleanup_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.storage_cleanup_log is
  'Histórico de detecção e limpeza de arquivos órfãos. Toda execução fica registrada, inclusive as simulações (dry_run).';
