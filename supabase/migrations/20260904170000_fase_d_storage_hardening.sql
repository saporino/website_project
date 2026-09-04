-- Fase D — endurecimento do Storage (04/09/2026)
--
-- Problemas corrigidos:
--   1. chat-media e visit-photos eram buckets PUBLICOS. Conversa interna e fotos de
--      visita em ponto de venda ficavam acessiveis por URL a qualquer pessoa com o link.
--   2. 9 dos 10 buckets nao tinham limite de tamanho nem lista de MIME permitidos.
--   3. Politicas genericas ("Public Access", "Authenticated Insert"...) sem escopo claro,
--      e buckets sensiveis (invoices, lot-documents, studio-videos) liberados para
--      qualquer usuario autenticado.
--
-- Principio aplicado: publico apenas o que precisa ser exibido no site aberto.
-- Todo o resto vira privado e e servido por signed URL de curta duracao.

-- ---------------------------------------------------------------------------
-- 1. Privacidade, limite de tamanho e MIME por bucket
-- ---------------------------------------------------------------------------

-- Publicos por finalidade (aparecem no site aberto)
update storage.buckets set public = true,  file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','image/gif']
  where id = 'product-images';

update storage.buckets set public = true,  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/svg+xml']
  where id = 'carrier-logos';

-- batch-photos permanece publico: e a base da pagina publica de rastreabilidade do lote.
update storage.buckets set public = true,  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'batch-photos';

-- Privados (passam a exigir signed URL)
update storage.buckets set public = false, file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav',
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  where id = 'chat-media';

update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'visit-photos';

update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'delivery-pods';

update storage.buckets set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf','application/xml','text/xml','image/jpeg','image/png','image/webp']
  where id = 'invoices';

update storage.buckets set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
  where id = 'lot-documents';

update storage.buckets set public = false, file_size_limit = 524288000,
  allowed_mime_types = array['video/mp4','video/quicktime','video/webm']
  where id = 'studio-videos';

-- representative-docs ja tinha limite e MIME corretos; mantido como esta.

-- ---------------------------------------------------------------------------
-- 2. Politicas explicitas por bucket
-- ---------------------------------------------------------------------------

-- Remove as politicas genericas/soltas
drop policy if exists "Public Access"                on storage.objects;
drop policy if exists "Authenticated Insert"         on storage.objects;
drop policy if exists "Authenticated Update"         on storage.objects;
drop policy if exists "Authenticated Delete"         on storage.objects;
drop policy if exists "Public Access carrier-logos"  on storage.objects;
drop policy if exists "Auth Upload carrier-logos"    on storage.objects;
drop policy if exists "Auth Update carrier-logos"    on storage.objects;
drop policy if exists "Auth Delete carrier-logos"    on storage.objects;
drop policy if exists "Batch photos public read"     on storage.objects;
drop policy if exists "Admin upload batch photos"    on storage.objects;
drop policy if exists "Visit photos public read"     on storage.objects;
drop policy if exists "Reps upload visit photos"     on storage.objects;
drop policy if exists "invoices_auth_select"         on storage.objects;
drop policy if exists "invoices_auth_insert"         on storage.objects;
drop policy if exists "invoices_auth_update"         on storage.objects;
drop policy if exists "invoices_auth_delete"         on storage.objects;
drop policy if exists "lot_docs_auth_select"         on storage.objects;
drop policy if exists "lot_docs_auth_insert"         on storage.objects;
drop policy if exists "lot_docs_auth_delete"         on storage.objects;
drop policy if exists "studio_videos_authenticated 4qf1gv_0" on storage.objects;
drop policy if exists "studio_videos_authenticated 4qf1gv_1" on storage.objects;
drop policy if exists "studio_videos_authenticated 4qf1gv_2" on storage.objects;
drop policy if exists "studio_videos_authenticated 4qf1gv_3" on storage.objects;

-- product-images: leitura publica, escrita so admin
create policy "st_product_images_public_read" on storage.objects
  for select to public using (bucket_id = 'product-images');
create policy "st_product_images_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "st_product_images_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "st_product_images_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- carrier-logos: leitura publica, escrita so admin
create policy "st_carrier_logos_public_read" on storage.objects
  for select to public using (bucket_id = 'carrier-logos');
create policy "st_carrier_logos_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'carrier-logos' and public.is_admin());
create policy "st_carrier_logos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'carrier-logos' and public.is_admin());
create policy "st_carrier_logos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'carrier-logos' and public.is_admin());

-- batch-photos: leitura publica (rastreabilidade), escrita so admin
create policy "st_batch_photos_public_read" on storage.objects
  for select to public using (bucket_id = 'batch-photos');
create policy "st_batch_photos_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'batch-photos' and public.is_admin());
create policy "st_batch_photos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'batch-photos' and public.is_admin());
create policy "st_batch_photos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'batch-photos' and public.is_admin());

-- chat-media: privado. Leitura por autenticado (necessaria para gerar signed URL);
-- gravacao apenas na pasta do proprio usuario; exclusao pelo dono ou admin.
create policy "st_chat_media_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'chat-media');
create policy "st_chat_media_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "st_chat_media_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- visit-photos: privado. Autenticado le e envia; admin altera/exclui.
create policy "st_visit_photos_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'visit-photos');
create policy "st_visit_photos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'visit-photos');
create policy "st_visit_photos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'visit-photos' and public.is_admin());
create policy "st_visit_photos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'visit-photos' and public.is_admin());

-- delivery-pods: privado. Prova de entrega enviada em campo, excluida so por admin.
create policy "st_delivery_pods_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'delivery-pods');
create policy "st_delivery_pods_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'delivery-pods');
create policy "st_delivery_pods_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'delivery-pods' and public.is_admin());

-- invoices: privado. Leitura/gravacao por autenticado (rep precisa ver a NF do proprio
-- pedido); exclusao so admin. RISCO RESIDUAL REGISTRADO: a leitura ainda nao e por dono,
-- porque o caminho dos arquivos nao carrega o id do representante. Estreitar quando o
-- caminho for normalizado.
create policy "st_invoices_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'invoices');
create policy "st_invoices_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'invoices');
create policy "st_invoices_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'invoices');
create policy "st_invoices_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'invoices' and public.is_admin());

-- lot-documents: privado e SO ADMIN. Sao documentos de custo de compra do cafe verde;
-- representante nunca pode ver custo/margem.
create policy "st_lot_documents_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'lot-documents' and public.is_admin())
  with check (bucket_id = 'lot-documents' and public.is_admin());

-- studio-videos: privado e so admin (o Studio e modulo administrativo).
create policy "st_studio_videos_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'studio-videos' and public.is_admin())
  with check (bucket_id = 'studio-videos' and public.is_admin());

-- representative-docs: politicas de dono + admin ja existiam e sao mantidas.
