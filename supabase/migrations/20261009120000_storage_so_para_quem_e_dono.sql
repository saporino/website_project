-- STORAGE: COMPROVANTE E FOTO DE CAMPO SÓ PARA QUEM É DONO.
--
-- Auditoria de 09/10/2026, provada em bancada com um cliente da loja recém-cadastrado:
--
--   delivery-pods  (canhoto de entrega)  → ele LISTOU, BAIXOU e SUBIU arquivo
--   visit-photos   (foto de visita)      → ele LISTOU, BAIXOU e SUBIU arquivo
--   invoices       (nota fiscal)         → não leu (ok), mas SUBIU arquivo
--
-- A política dizia só `bucket_id = '...'` para qualquer autenticado. Quem comprasse um café
-- na loja e criasse conta passava a enxergar canhoto assinado por cliente B2B, com endereço
-- e assinatura, e foto de dentro de loja de cliente. Isso é dado de terceiro, não nosso.
--
-- A trava segue a pasta, que é como o próprio código já organiza os arquivos:
--   visit-photos:  promoter/<promoter_id>/...   e  visits/<representative_id>/...
--   delivery-pods: enviado em campo por representante, motorista ou promotor
--   invoices:      nota e comprovante, enviados por admin ou representante
--
-- Leitura continua passando por link assinado, que é como as telas abrem o arquivo.

-- ------------------------------------------------------------------- visit-photos
drop policy if exists st_visit_photos_auth_read   on storage.objects;
drop policy if exists st_visit_photos_auth_insert on storage.objects;

create policy st_visit_photos_dono_read on storage.objects
  for select to authenticated using (
    bucket_id = 'visit-photos' and (
      public.is_admin()
      or (storage.foldername(name))[2] = coalesce(public.my_promoter_id()::text, '-')
      or (storage.foldername(name))[2] = coalesce(public.my_rep_id()::text, '-')
    )
  );

create policy st_visit_photos_campo_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'visit-photos' and (
      public.is_admin()
      or (storage.foldername(name))[2] = coalesce(public.my_promoter_id()::text, '-')
      or (storage.foldername(name))[2] = coalesce(public.my_rep_id()::text, '-')
    )
  );

-- ------------------------------------------------------------------ delivery-pods
-- Prova de entrega: quem está em campo envia, admin lê tudo. Cliente da loja não tem
-- nada a ver com isso — e era justamente quem conseguia baixar.
drop policy if exists st_delivery_pods_auth_read   on storage.objects;
drop policy if exists st_delivery_pods_auth_insert on storage.objects;

create policy st_delivery_pods_campo_read on storage.objects
  for select to authenticated using (
    bucket_id = 'delivery-pods' and (
      public.is_admin()
      or public.my_rep_id() is not null
      or public.my_driver_id() is not null
      or public.my_promoter_id() is not null
    )
  );

create policy st_delivery_pods_campo_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'delivery-pods' and (
      public.is_admin()
      or public.my_rep_id() is not null
      or public.my_driver_id() is not null
      or public.my_promoter_id() is not null
    )
  );

-- ----------------------------------------------------------------------- invoices
-- Leitura já era guardada por can_access_invoice_file(). O buraco era a escrita: qualquer
-- um com conta subia arquivo no bucket de nota fiscal.
drop policy if exists st_invoices_auth_insert on storage.objects;

create policy st_invoices_quem_fatura_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'invoices' and (
      public.is_admin()
      or public.my_rep_id() is not null
      or public.my_driver_id() is not null
    )
  );
