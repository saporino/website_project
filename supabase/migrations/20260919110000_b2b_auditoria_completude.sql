-- B2B Prospecção — "auditada" e "ficha completa", para saber em quais fichas já mexemos.
--
-- auditada: alguém revisou a ficha PELA TELA (salvar ficha, contatos, divergência). Importação
--           não conta: ela completa dados, não revisa.
-- completa: tem o básico para trabalhar a empresa — CNPJ, razão social, tipo definido, UF,
--           município, endereço, telefone e e-mail. Coluna calculada pelo banco (filtrável).

alter table public.b2b_empresas add column if not exists auditado_em timestamptz;
alter table public.b2b_empresas add column if not exists auditado_por uuid references auth.users(id) on delete set null;
alter table public.b2b_empresas add column if not exists completa boolean generated always as (
  cnpj is not null and nullif(razao_social, '') is not null and tipo <> 'outro' and uf is not null
  and nullif(municipio, '') is not null and nullif(logradouro, '') is not null
  and telefone is not null and nullif(email, '') is not null
) stored;
-- O que a empresa vende e o que compra (tipos de café) e em que embalagens; volume por mês.
alter table public.b2b_empresas add column if not exists produtos_vende text[] not null default '{}';
alter table public.b2b_empresas add column if not exists produtos_compra text[] not null default '{}';
alter table public.b2b_empresas add column if not exists embalagens text[] not null default '{}';
alter table public.b2b_empresas add column if not exists volume_mensal text;
create index if not exists b2b_empresas_vende_idx on public.b2b_empresas using gin (produtos_vende);
create index if not exists b2b_empresas_compra_idx on public.b2b_empresas using gin (produtos_compra);

create index if not exists b2b_empresas_auditado_idx on public.b2b_empresas (auditado_em);
create index if not exists b2b_empresas_completa_idx on public.b2b_empresas (completa);

-- Contagem por UF com os mesmos filtros da tela (inclui os dois novos).
drop function if exists public.b2b_contagem(text, text, boolean, boolean, boolean, boolean);
create or replace function public.b2b_contagem(
  p_busca text default null, p_tipo text default null, p_ativo boolean default null,
  p_so_telefone boolean default false, p_nao_trabalhadas boolean default false, p_com_divergencias boolean default false,
  p_nao_auditadas boolean default false, p_incompletas boolean default false)
returns table (uf text, n bigint) language sql stable security invoker set search_path = public as $$
  select coalesce(e.uf, '—'), count(*)
    from public.b2b_empresas e
   where (p_tipo is null or e.tipo = p_tipo)
     and (p_ativo is null or e.ativo = p_ativo)
     and (not p_so_telefone or e.telefone is not null)
     and (not p_nao_trabalhadas or not e.trabalhado)
     and (not p_com_divergencias or e.divergencias_abertas > 0)
     and (not p_nao_auditadas or e.auditado_em is null)
     and (not p_incompletas or not e.completa)
     and (coalesce(p_busca, '') = '' or e.razao_social ilike '%' || p_busca || '%' or e.nome_fantasia ilike '%' || p_busca || '%'
          or e.municipio ilike '%' || p_busca || '%'
          or (length(regexp_replace(p_busca, '[^0-9]', '', 'g')) >= 4 and e.cnpj like regexp_replace(p_busca, '[^0-9]', '', 'g') || '%'))
   group by 1 order by 2 desc;
$$;
revoke all on function public.b2b_contagem(text, text, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.b2b_contagem(text, text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Resolver divergência também é auditoria.
create or replace function public.b2b_marcar_auditada(p_empresa uuid)
returns void language sql security definer set search_path = public as $$
  update public.b2b_empresas set auditado_em = now(), auditado_por = auth.uid()
   where id = p_empresa and public.is_admin();
$$;
revoke all on function public.b2b_marcar_auditada(uuid) from public, anon;
grant execute on function public.b2b_marcar_auditada(uuid) to authenticated;
