-- B2B Prospecção — cadastro único das empresas do mundo do café (Leads › B2B Prospecção).
--
-- Uma ficha por empresa, com o CNPJ como chave: a mesma empresa nunca duplica,
-- venha da Receita, da ABIC, do Google (Apify), do formulário do site ou de uma
-- planilha. Uma fonte nova COMPLETA o que está vazio e nunca apaga o que já existe;
-- cada campo guarda de qual fonte veio (proveniencia).
--
-- A empresa nunca sai daqui. O que muda são os VÍNCULOS com os nossos negócios
-- (cliente de uma empresa do grupo, Coffee LiVRE, marketplaces da CASA COFICO,
-- fornecedor). Havendo algum vínculo ativo, a empresa aparece em "Ativos".
--
-- Acesso: só admin (is_admin()). Nada disto é público.

-- =====================================================================
-- 1. Tabelas
-- =====================================================================
create table if not exists public.b2b_empresas (
  id                 uuid primary key default gen_random_uuid(),
  cnpj               text unique check (cnpj ~ '^[0-9]{14}$'),
  chave_nome         text,                    -- nome normalizado | município | UF (junta quem vem sem CNPJ)
  razao_social       text,
  nome_fantasia      text,
  tipo               text not null default 'outro' check (tipo in (
                       'torrefacao', 'produtor', 'cooperativa', 'industria', 'distribuidor', 'atacado',
                       'supermercado', 'varejo', 'cafeteria', 'food_service', 'fornecedor', 'outro')),
  cnae_principal     text,
  cnae_descricao     text,
  inscricao_estadual text,
  situacao_cadastral text,
  porte              text,
  data_abertura      date,
  pessoa_fisica      boolean not null default false,   -- MEI / nome de pessoa na razão social (LGPD)
  uf                 text check (uf is null or uf ~ '^[A-Z]{2}$'),
  municipio          text,
  cep                text,
  logradouro         text,
  numero             text,
  complemento        text,
  bairro             text,
  lat                double precision,
  lng                double precision,
  telefone           text,
  whatsapp           text,
  email              text,
  site               text,
  instagram          text,
  facebook           text,
  marcas             text[] not null default '{}',
  abic_certificada   boolean,
  abic_detalhes      jsonb,
  notas              text,
  trabalhado         boolean not null default false,
  ativo              boolean not null default false,   -- mantido pelo gatilho dos vínculos
  fontes             text[] not null default '{}',
  proveniencia       jsonb not null default '{}',      -- campo → {fonte, em}
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.b2b_empresas is
  'B2B Prospecção: uma ficha por empresa (CNPJ). Fontes completam, nunca sobrescrevem. ativo = algum vínculo ativo.';

create index if not exists b2b_empresas_uf_idx on public.b2b_empresas (uf);
create index if not exists b2b_empresas_tipo_idx on public.b2b_empresas (tipo);
create index if not exists b2b_empresas_ativo_idx on public.b2b_empresas (ativo);
create index if not exists b2b_empresas_chave_nome_idx on public.b2b_empresas (chave_nome);

create table if not exists public.b2b_contatos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.b2b_empresas(id) on delete cascade,
  funcao      text not null default 'outro' check (funcao in (
                'comprador', 'comercial', 'gerente_comercial', 'vendedor', 'administrativo',
                'financeiro', 'contabilidade', 'proprietario', 'outro')),
  nome        text,
  cargo       text,
  email       text,
  telefone    text,
  whatsapp    text,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists b2b_contatos_empresa_idx on public.b2b_contatos (empresa_id);

create table if not exists public.b2b_vinculos (
  id                        uuid primary key default gen_random_uuid(),
  empresa_id                uuid not null references public.b2b_empresas(id) on delete cascade,
  destino                   text not null check (destino in (
                              'cliente_empresa',          -- cliente de uma empresa do grupo (Saporino, Fazendinha, COFICO)
                              'coffeelivre_comprador',    -- compra no Coffee LiVRE
                              'coffeelivre_vendedor',     -- vende no Coffee LiVRE
                              'casa_cofico_marketplace',  -- vendido pela COFICO nos marketplaces da CASA COFICO
                              'fornecedor')),
  company_id                uuid references public.companies(id),
  etapa                     text not null default 'prospeccao' check (etapa in (
                              'prospeccao', 'contato', 'negociacao', 'ativo', 'inativo', 'perdido')),
  representative_client_id  uuid references public.representative_clients(id) on delete set null,
  lv_seller_id              uuid references public.lv_sellers(id) on delete set null,
  responsavel               text,
  proxima_acao              text,
  proxima_acao_em           date,
  observacao                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique nulls not distinct (empresa_id, destino, company_id)
);
create index if not exists b2b_vinculos_empresa_idx on public.b2b_vinculos (empresa_id);

create table if not exists public.b2b_importacoes (
  id           uuid primary key default gen_random_uuid(),
  fonte        text not null,
  arquivo      text,
  linhas       integer not null default 0,
  novas        integer not null default 0,
  completadas  integer not null default 0,
  iguais       integer not null default 0,
  invalidas    integer not null default 0,
  feita_por    uuid,
  detalhes     jsonb,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- 2. Ativo = algum vínculo ativo
-- =====================================================================
create or replace function public.b2b_recalcular_ativo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := coalesce(new.empresa_id, old.empresa_id);
begin
  update public.b2b_empresas e
     set ativo = exists (select 1 from public.b2b_vinculos v where v.empresa_id = v_empresa and v.etapa = 'ativo'),
         updated_at = now()
   where e.id = v_empresa;
  if tg_op = 'UPDATE' and old.empresa_id is distinct from new.empresa_id then
    update public.b2b_empresas e
       set ativo = exists (select 1 from public.b2b_vinculos v where v.empresa_id = old.empresa_id and v.etapa = 'ativo')
     where e.id = old.empresa_id;
  end if;
  return null;
end $$;

drop trigger if exists b2b_vinculos_ativo on public.b2b_vinculos;
create trigger b2b_vinculos_ativo after insert or update or delete on public.b2b_vinculos
  for each row execute function public.b2b_recalcular_ativo();

create or replace function public.b2b_tocar_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists b2b_empresas_updated on public.b2b_empresas;
create trigger b2b_empresas_updated before update on public.b2b_empresas for each row execute function public.b2b_tocar_updated_at();
drop trigger if exists b2b_contatos_updated on public.b2b_contatos;
create trigger b2b_contatos_updated before update on public.b2b_contatos for each row execute function public.b2b_tocar_updated_at();
drop trigger if exists b2b_vinculos_updated on public.b2b_vinculos;
create trigger b2b_vinculos_updated before update on public.b2b_vinculos for each row execute function public.b2b_tocar_updated_at();

-- =====================================================================
-- 3. Mescla por CNPJ (completa, nunca sobrescreve)
-- =====================================================================
-- p_linhas: array de objetos já normalizados pelo site/script (src/lib/b2b/normalizar.ts).
-- Sem CNPJ, a linha só entra se tiver chave_nome; se houver EXATAMENTE uma empresa com a
-- mesma chave_nome, ela é completada; senão vira ficha nova sem CNPJ.
create or replace function public.b2b_mesclar(p_fonte text, p_linhas jsonb, p_arquivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  campos constant text[] := array[
    'razao_social', 'nome_fantasia', 'cnae_principal', 'cnae_descricao', 'inscricao_estadual', 'situacao_cadastral',
    'porte', 'data_abertura', 'uf', 'municipio', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'lat', 'lng',
    'telefone', 'whatsapp', 'email', 'site', 'instagram', 'facebook', 'abic_certificada', 'abic_detalhes', 'chave_nome'];
  r jsonb; e public.b2b_empresas; atual jsonb; novo jsonb; prov jsonb; c text;
  v_cnpj text; v_chave text; v_id uuid; v_n integer;
  n_novas integer := 0; n_completadas integer := 0; n_iguais integer := 0; n_invalidas integer := 0;
  agora text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if coalesce(trim(p_fonte), '') = '' then raise exception 'Informe a fonte.'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_cnpj := nullif(regexp_replace(coalesce(r ->> 'cnpj', ''), '[^0-9]', '', 'g'), '');
    v_chave := nullif(trim(coalesce(r ->> 'chave_nome', '')), '');
    if (v_cnpj is not null and length(v_cnpj) <> 14) or (v_cnpj is null and v_chave is null) then
      n_invalidas := n_invalidas + 1; continue;
    end if;

    e := null;
    if v_cnpj is not null then
      select * into e from public.b2b_empresas where cnpj = v_cnpj for update;
    else
      select count(*) into v_n from public.b2b_empresas where chave_nome = v_chave;
      if v_n = 1 then select * into e from public.b2b_empresas where chave_nome = v_chave for update; end if;
    end if;

    if e.id is null then
      prov := '{}';
      foreach c in array campos loop
        if nullif(r ->> c, '') is not null then prov := prov || jsonb_build_object(c, jsonb_build_object('fonte', p_fonte, 'em', agora)); end if;
      end loop;
      insert into public.b2b_empresas as t (
        cnpj, chave_nome, razao_social, nome_fantasia, tipo, cnae_principal, cnae_descricao, inscricao_estadual,
        situacao_cadastral, porte, data_abertura, pessoa_fisica, uf, municipio, cep, logradouro, numero, complemento,
        bairro, lat, lng, telefone, whatsapp, email, site, instagram, facebook, marcas, abic_certificada, abic_detalhes,
        notas, fontes, proveniencia)
      select v_cnpj, v_chave, x.razao_social, x.nome_fantasia, coalesce(nullif(r ->> 'tipo', ''), 'outro'), x.cnae_principal,
             x.cnae_descricao, x.inscricao_estadual, x.situacao_cadastral, x.porte, x.data_abertura,
             coalesce((r ->> 'pessoa_fisica')::boolean, false), x.uf, x.municipio, x.cep, x.logradouro, x.numero,
             x.complemento, x.bairro, x.lat, x.lng, x.telefone, x.whatsapp, x.email, x.site, x.instagram, x.facebook,
             coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'marcas', '[]'::jsonb))), '{}'),
             x.abic_certificada, x.abic_detalhes, nullif(r ->> 'notas', ''), array[p_fonte], prov
        from jsonb_populate_record(null::public.b2b_empresas, r - 'cnpj' - 'id' - 'marcas' - 'fontes' - 'proveniencia' - 'ativo') x;
      n_novas := n_novas + 1;
      continue;
    end if;

    -- Existente: só completa o vazio.
    atual := to_jsonb(e);
    novo := '{}';
    prov := e.proveniencia;
    foreach c in array campos loop
      if nullif(atual ->> c, '') is null and nullif(r ->> c, '') is not null then
        novo := novo || jsonb_build_object(c, r -> c);
        prov := prov || jsonb_build_object(c, jsonb_build_object('fonte', p_fonte, 'em', agora));
      end if;
    end loop;
    if e.tipo = 'outro' and coalesce(r ->> 'tipo', 'outro') <> 'outro' then novo := novo || jsonb_build_object('tipo', r ->> 'tipo'); end if;
    if v_cnpj is not null and e.cnpj is null then novo := novo || jsonb_build_object('cnpj', v_cnpj); end if;

    update public.b2b_empresas t set
      cnpj = coalesce(t.cnpj, x.cnpj), chave_nome = x.chave_nome, razao_social = x.razao_social, nome_fantasia = x.nome_fantasia,
      tipo = x.tipo, cnae_principal = x.cnae_principal, cnae_descricao = x.cnae_descricao, inscricao_estadual = x.inscricao_estadual,
      situacao_cadastral = x.situacao_cadastral, porte = x.porte, data_abertura = x.data_abertura,
      pessoa_fisica = t.pessoa_fisica or coalesce((r ->> 'pessoa_fisica')::boolean, false),
      uf = x.uf, municipio = x.municipio, cep = x.cep, logradouro = x.logradouro, numero = x.numero, complemento = x.complemento,
      bairro = x.bairro, lat = x.lat, lng = x.lng, telefone = x.telefone, whatsapp = x.whatsapp, email = x.email, site = x.site,
      instagram = x.instagram, facebook = x.facebook, abic_certificada = x.abic_certificada, abic_detalhes = x.abic_detalhes,
      marcas = array(select distinct m from unnest(t.marcas || coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'marcas', '[]'::jsonb))), '{}')) m where m <> ''),
      notas = case when nullif(r ->> 'notas', '') is null or coalesce(t.notas, '') like '%' || (r ->> 'notas') || '%' then t.notas
                   else concat_ws(E'\n', t.notas, r ->> 'notas') end,
      fontes = case when p_fonte = any(t.fontes) then t.fontes else t.fontes || p_fonte end,
      proveniencia = prov
    from jsonb_populate_record(null::public.b2b_empresas, atual || novo) x
    where t.id = e.id;

    if novo = '{}'::jsonb then n_iguais := n_iguais + 1; else n_completadas := n_completadas + 1; end if;
  end loop;

  insert into public.b2b_importacoes (fonte, arquivo, linhas, novas, completadas, iguais, invalidas, feita_por)
  values (p_fonte, p_arquivo, jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)), n_novas, n_completadas, n_iguais, n_invalidas, auth.uid());

  return jsonb_build_object('novas', n_novas, 'completadas', n_completadas, 'iguais', n_iguais, 'invalidas', n_invalidas);
end $$;

-- Prévia do importador: quais destes CNPJs já existem.
create or replace function public.b2b_cnpjs_existentes(p_cnpjs text[])
returns text[] language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce(array_agg(cnpj), '{}') else '{}' end
    from public.b2b_empresas where cnpj = any(p_cnpjs);
$$;

-- Contagem por UF e totais com os mesmos filtros da tela (chips de estado).
create or replace function public.b2b_contagem(
  p_busca text default null, p_tipo text default null, p_ativo boolean default null,
  p_so_telefone boolean default false, p_nao_trabalhadas boolean default false)
returns table (uf text, n bigint) language sql stable security invoker set search_path = public as $$
  select coalesce(e.uf, '—'), count(*)
    from public.b2b_empresas e
   where (p_tipo is null or e.tipo = p_tipo)
     and (p_ativo is null or e.ativo = p_ativo)
     and (not p_so_telefone or coalesce(e.telefone, e.whatsapp) is not null)
     and (not p_nao_trabalhadas or not e.trabalhado)
     and (coalesce(p_busca, '') = '' or e.razao_social ilike '%' || p_busca || '%' or e.nome_fantasia ilike '%' || p_busca || '%'
          or e.municipio ilike '%' || p_busca || '%' or e.cnpj like regexp_replace(p_busca, '[^0-9]', '', 'g') || '%'
          or array_to_string(e.marcas, ' ') ilike '%' || p_busca || '%')
   group by 1 order by 2 desc;
$$;

-- =====================================================================
-- 4. RLS: só admin
-- =====================================================================
alter table public.b2b_empresas enable row level security;
alter table public.b2b_contatos enable row level security;
alter table public.b2b_vinculos enable row level security;
alter table public.b2b_importacoes enable row level security;

revoke all on public.b2b_empresas, public.b2b_contatos, public.b2b_vinculos, public.b2b_importacoes from anon;
grant select, insert, update, delete on public.b2b_empresas, public.b2b_contatos, public.b2b_vinculos to authenticated;
grant select on public.b2b_importacoes to authenticated;

drop policy if exists b2b_empresas_admin on public.b2b_empresas;
create policy b2b_empresas_admin on public.b2b_empresas for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists b2b_contatos_admin on public.b2b_contatos;
create policy b2b_contatos_admin on public.b2b_contatos for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists b2b_vinculos_admin on public.b2b_vinculos;
create policy b2b_vinculos_admin on public.b2b_vinculos for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists b2b_importacoes_admin on public.b2b_importacoes;
create policy b2b_importacoes_admin on public.b2b_importacoes for select to authenticated using (public.is_admin());

revoke all on function public.b2b_mesclar(text, jsonb, text) from public, anon;
grant execute on function public.b2b_mesclar(text, jsonb, text) to authenticated, service_role;
revoke all on function public.b2b_cnpjs_existentes(text[]) from public, anon;
grant execute on function public.b2b_cnpjs_existentes(text[]) to authenticated;
revoke all on function public.b2b_contagem(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.b2b_contagem(text, text, boolean, boolean, boolean) to authenticated;
