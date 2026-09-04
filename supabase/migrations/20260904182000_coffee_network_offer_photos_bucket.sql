-- Coffee Network — bucket das fotos de oferta (04/09/2026)
--
-- Privado por decisão: a foto do lote passa por gate humano da COFICO antes de
-- circular. Bucket público tornaria a moderação decorativa, já que qualquer pessoa
-- com o link veria a foto reprovada. A exibição usa signed URL (src/lib/storageUrl.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-photos','offer-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "st_offer_photos_admin_all" on storage.objects;
create policy "st_offer_photos_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'offer-photos' and public.is_admin())
  with check (bucket_id = 'offer-photos' and public.is_admin());

-- O produtor envia e enxerga as fotos da PRÓPRIA oferta. O caminho é
-- offer-photos/<offer_id>/<arquivo>, então o primeiro segmento identifica a oferta.
drop policy if exists "st_offer_photos_owner_read" on storage.objects;
create policy "st_offer_photos_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'offer-photos'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.coffee_offers o
       where o.entity_id in (select public.my_network_entity_ids())
    )
  );

drop policy if exists "st_offer_photos_owner_insert" on storage.objects;
create policy "st_offer_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'offer-photos'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.coffee_offers o
       where o.entity_id in (select public.my_network_entity_ids())
    )
  );

-- Moderação de foto pela COFICO.
create or replace function public.coffee_offer_photo_moderate(
  p_photo_id uuid,
  p_decision text,          -- 'approve' | 'reject'
  p_note text default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare v_prev jsonb; v_status text;
begin
  if not public.is_admin() then
    raise exception 'apenas a equipe COFICO pode moderar fotos';
  end if;

  select to_jsonb(p) into v_prev from public.coffee_offer_photos p where p.id = p_photo_id;
  if v_prev is null then raise exception 'foto inexistente'; end if;

  v_status := case p_decision when 'approve' then 'approved'
                              when 'reject'  then 'rejected' else null end;
  if v_status is null then raise exception 'decisao invalida: use approve ou reject'; end if;

  update public.coffee_offer_photos
     set moderation_status = v_status, moderation_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_photo_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.foto_moderada','coffee_offer_photos', p_photo_id, v_prev,
          jsonb_build_object('moderation_status', v_status), p_note);

  return v_status;
end;
$$;

revoke execute on function public.coffee_offer_photo_moderate(uuid, text, text) from public;
grant execute on function public.coffee_offer_photo_moderate(uuid, text, text) to authenticated, service_role;
