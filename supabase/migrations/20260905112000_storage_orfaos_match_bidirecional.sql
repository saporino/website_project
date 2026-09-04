-- A4 (correção 2) — casamento bidirecional entre referência e objeto (05/09/2026)
--
-- A primeira versão só perguntava "a referência TERMINA com o nome do objeto?".
-- Isso funciona quando o banco guarda a URL inteira, mas falha quando guarda um
-- caminho PARCIAL. Caso real: studio_campaigns.media_path guarda
-- "<empresa>/<arquivo>.png" enquanto o objeto se chama "campaigns/<empresa>/<arquivo>.png".
-- A referência é mais curta que o nome, então nunca casava, e 12 arquivos em uso
-- apareciam como órfãos.
--
-- Agora o teste é nos dois sentidos. Na dúvida, o arquivo é considerado EM USO:
-- para uma ferramenta de limpeza, o erro barato é preservar demais.
-- O piso de 12 caracteres evita que uma referência curta case com o bucket inteiro.

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
        where r.ref is not null
          and length(r.ref) >= 12
          and (r.ref like '%' || o.name or o.name like '%' || r.ref)
     )
   order by o.bucket_id, o.created_at;
$$;

revoke execute on function public.storage_orphans(text, int) from public, anon;
grant execute on function public.storage_orphans(text, int) to authenticated, service_role;
