-- Listar os convites de cliente PJ ainda válidos, no mesmo formato das outras
-- duas listas (a tela junta as três e ordena por data).
create or replace function public.repco_list_invites_pj()
returns table(code text, note text, created_at timestamptz, expires_at timestamptz, used_by uuid, used_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select code, note, created_at, expires_at, used_by, used_at
    from public.repco_invite_codes
   where public.is_admin()
     and role_code = 'cliente_pj'
     and used_by is null
     and expires_at > now()
   order by created_at desc
   limit 40;
$$;

comment on function public.repco_list_invites_pj is
  'Convites de cliente PJ ainda válidos. Só admin, como as outras listas.';
