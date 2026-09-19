-- B2B Prospecção — histórico de importações por arquivo e relatório de divergências.
--
-- 1. Cada arquivo importado vira UMA linha em b2b_importacoes, com a impressão digital
--    do conteúdo (SHA-256). O site avisa quando o mesmo arquivo — mesmo renomeado — já
--    foi importado, e quando um arquivo com o mesmo nome chega com conteúdo diferente.
-- 2. Quando uma fonte nova traz um valor DIFERENTE do que a ficha já tem, nada é trocado
--    (a regra continua: completar, nunca sobrescrever), mas a diferença fica registrada
--    em b2b_divergencias para alguém decidir: manter o atual ou usar o novo.

-- =====================================================================
-- 1. Importação por arquivo
-- =====================================================================
alter table public.b2b_importacoes add column if not exists arquivo_hash text;
alter table public.b2b_importacoes add column if not exists arquivo_tamanho bigint;
alter table public.b2b_importacoes add column if not exists divergencias integer not null default 0;
alter table public.b2b_importacoes add column if not exists concluida_em timestamptz;
create index if not exists b2b_importacoes_hash_idx on public.b2b_importacoes (arquivo_hash);
create index if not exists b2b_importacoes_arquivo_idx on public.b2b_importacoes (arquivo);

-- Abre o registro da importação (uma por arquivo). Os lotes somam nele.
create or replace function public.b2b_importacao_iniciar(p_fonte text, p_arquivo text, p_hash text, p_tamanho bigint, p_linhas integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  insert into public.b2b_importacoes (fonte, arquivo, arquivo_hash, arquivo_tamanho, linhas, feita_por)
  values (p_fonte, p_arquivo, p_hash, p_tamanho, coalesce(p_linhas, 0), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.b2b_importacao_concluir(p_importacao uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.b2b_importacoes set concluida_em = now() where id = p_importacao;
end $$;

-- =====================================================================
-- 2. Divergências
-- =====================================================================
create table if not exists public.b2b_divergencias (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.b2b_empresas(id) on delete cascade,
  campo         text not null,
  valor_atual   text,
  valor_novo    text not null,
  fonte         text not null,
  importacao_id uuid references public.b2b_importacoes(id) on delete set null,
  status        text not null default 'aberta' check (status in ('aberta', 'mantido', 'trocado', 'virou_contato')),
  resolvida_em  timestamptz,
  created_at    timestamptz not null default now(),
  unique (empresa_id, campo, valor_novo)
);
create index if not exists b2b_divergencias_empresa_idx on public.b2b_divergencias (empresa_id) where status = 'aberta';

alter table public.b2b_empresas add column if not exists divergencias_abertas integer not null default 0;
create index if not exists b2b_empresas_divergencias_idx on public.b2b_empresas (divergencias_abertas) where divergencias_abertas > 0;

create or replace function public.b2b_contar_divergencias()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := coalesce(new.empresa_id, old.empresa_id);
begin
  update public.b2b_empresas
     set divergencias_abertas = (select count(*) from public.b2b_divergencias d where d.empresa_id = v_empresa and d.status = 'aberta')
   where id = v_empresa;
  return null;
end $$;
drop trigger if exists b2b_divergencias_contagem on public.b2b_divergencias;
create trigger b2b_divergencias_contagem after insert or update or delete on public.b2b_divergencias
  for each row execute function public.b2b_contar_divergencias();

-- Mesmo valor escrito de outro jeito ("Café Ltda." × "CAFE LTDA") não é divergência.
create or replace function public.b2b_forma_comparavel(v text)
returns text language sql immutable as $$
  select regexp_replace(lower(translate(coalesce(v, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9]', '', 'g');
$$;

-- =====================================================================
-- 3. Mescla: agora soma na importação do arquivo e registra divergências
-- =====================================================================
drop function if exists public.b2b_mesclar(text, jsonb, text);

create or replace function public.b2b_mesclar(p_fonte text, p_linhas jsonb, p_arquivo text default null, p_importacao uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  campos constant text[] := array[
    'razao_social', 'nome_fantasia', 'cnae_principal', 'cnae_descricao', 'inscricao_estadual', 'situacao_cadastral',
    'porte', 'data_abertura', 'uf', 'municipio', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'lat', 'lng',
    'telefone', 'whatsapp', 'email', 'site', 'instagram', 'facebook', 'abic_certificada', 'abic_detalhes', 'chave_nome'];
  -- Campos em que uma diferença merece decisão humana.
  comparaveis constant text[] := array[
    'razao_social', 'nome_fantasia', 'cnae_principal', 'inscricao_estadual', 'situacao_cadastral', 'porte', 'uf', 'municipio',
    'cep', 'logradouro', 'numero', 'bairro', 'telefone', 'whatsapp', 'email', 'site', 'instagram', 'facebook'];
  r jsonb; e public.b2b_empresas; atual jsonb; novo jsonb; prov jsonb; c text;
  v_cnpj text; v_chave text; v_n integer; v_div integer;
  n_novas integer := 0; n_completadas integer := 0; n_iguais integer := 0; n_invalidas integer := 0; n_div integer := 0;
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
        from jsonb_populate_record(null::public.b2b_empresas, r - 'cnpj' - 'id' - 'marcas' - 'fontes' - 'proveniencia' - 'ativo' - 'divergencias_abertas') x;
      n_novas := n_novas + 1;
      continue;
    end if;

    -- Existente: completa o vazio; diferença em campo preenchido vira divergência (nada é trocado).
    atual := to_jsonb(e);
    novo := '{}';
    prov := e.proveniencia;
    foreach c in array campos loop
      if nullif(atual ->> c, '') is null and nullif(r ->> c, '') is not null then
        novo := novo || jsonb_build_object(c, r -> c);
        prov := prov || jsonb_build_object(c, jsonb_build_object('fonte', p_fonte, 'em', agora));
      elsif c = any(comparaveis) and nullif(r ->> c, '') is not null
            and public.b2b_forma_comparavel(atual ->> c) <> public.b2b_forma_comparavel(r ->> c) then
        insert into public.b2b_divergencias (empresa_id, campo, valor_atual, valor_novo, fonte, importacao_id)
        values (e.id, c, atual ->> c, r ->> c, p_fonte, p_importacao)
        on conflict (empresa_id, campo, valor_novo) do nothing;
        get diagnostics v_div = row_count;
        n_div := n_div + v_div;
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

  if p_importacao is not null then
    update public.b2b_importacoes
       set novas = novas + n_novas, completadas = completadas + n_completadas, iguais = iguais + n_iguais,
           invalidas = invalidas + n_invalidas, divergencias = divergencias + n_div
     where id = p_importacao;
  else
    insert into public.b2b_importacoes (fonte, arquivo, linhas, novas, completadas, iguais, invalidas, divergencias, feita_por, concluida_em)
    values (p_fonte, p_arquivo, jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)), n_novas, n_completadas, n_iguais, n_invalidas, n_div, auth.uid(), now());
  end if;

  return jsonb_build_object('novas', n_novas, 'completadas', n_completadas, 'iguais', n_iguais, 'invalidas', n_invalidas, 'divergencias', n_div);
end $$;

-- =====================================================================
-- 4. Resolver uma divergência: manter, trocar ou (telefone/e-mail) virar contato
-- =====================================================================
create or replace function public.b2b_divergencia_resolver(p_divergencia uuid, p_acao text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.b2b_divergencias;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into d from public.b2b_divergencias where id = p_divergencia and status = 'aberta' for update;
  if d.id is null then raise exception 'Divergência já resolvida.'; end if;
  if p_acao = 'trocar' then
    execute format('update public.b2b_empresas set %I = $1, proveniencia = proveniencia || jsonb_build_object(%L, jsonb_build_object(''fonte'', $2, ''em'', to_char(now(), ''YYYY-MM-DD''))) where id = $3', d.campo, d.campo)
      using d.valor_novo, d.fonte, d.empresa_id;
  elsif p_acao = 'virou_contato' then
    if d.campo not in ('telefone', 'whatsapp', 'email') then raise exception 'Só telefone, WhatsApp ou e-mail viram contato.'; end if;
    insert into public.b2b_contatos (empresa_id, funcao, nome, telefone, whatsapp, email, observacao)
    values (d.empresa_id, 'outro', null,
            case when d.campo = 'telefone' then d.valor_novo end, case when d.campo = 'whatsapp' then d.valor_novo end,
            case when d.campo = 'email' then d.valor_novo end, 'veio de: ' || d.fonte);
  elsif p_acao <> 'mantido' then
    raise exception 'Ação inválida.';
  end if;
  update public.b2b_divergencias set status = case p_acao when 'trocar' then 'trocado' else p_acao end, resolvida_em = now() where id = d.id;
end $$;

-- =====================================================================
-- 5. Contagem por UF também filtra "com divergências"
-- =====================================================================
drop function if exists public.b2b_contagem(text, text, boolean, boolean, boolean);
create or replace function public.b2b_contagem(
  p_busca text default null, p_tipo text default null, p_ativo boolean default null,
  p_so_telefone boolean default false, p_nao_trabalhadas boolean default false, p_com_divergencias boolean default false)
returns table (uf text, n bigint) language sql stable security invoker set search_path = public as $$
  select coalesce(e.uf, '—'), count(*)
    from public.b2b_empresas e
   where (p_tipo is null or e.tipo = p_tipo)
     and (p_ativo is null or e.ativo = p_ativo)
     and (not p_so_telefone or e.telefone is not null)
     and (not p_nao_trabalhadas or not e.trabalhado)
     and (not p_com_divergencias or e.divergencias_abertas > 0)
     and (coalesce(p_busca, '') = '' or e.razao_social ilike '%' || p_busca || '%' or e.nome_fantasia ilike '%' || p_busca || '%'
          or e.municipio ilike '%' || p_busca || '%'
          -- Só busca por CNPJ quando há ao menos 4 dígitos; sem dígitos, `like '%'` casaria com tudo.
          or (length(regexp_replace(p_busca, '[^0-9]', '', 'g')) >= 4 and e.cnpj like regexp_replace(p_busca, '[^0-9]', '', 'g') || '%'))
   group by 1 order by 2 desc;
$$;
revoke all on function public.b2b_contagem(text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.b2b_contagem(text, text, boolean, boolean, boolean, boolean) to authenticated;

-- =====================================================================
-- 6. Acesso: só admin
-- =====================================================================
alter table public.b2b_divergencias enable row level security;
revoke all on public.b2b_divergencias from anon;
grant select on public.b2b_divergencias to authenticated;
drop policy if exists b2b_divergencias_admin on public.b2b_divergencias;
create policy b2b_divergencias_admin on public.b2b_divergencias for select to authenticated using (public.is_admin());

revoke all on function public.b2b_mesclar(text, jsonb, text, uuid) from public, anon;
grant execute on function public.b2b_mesclar(text, jsonb, text, uuid) to authenticated, service_role;
revoke all on function public.b2b_importacao_iniciar(text, text, text, bigint, integer) from public, anon;
grant execute on function public.b2b_importacao_iniciar(text, text, text, bigint, integer) to authenticated, service_role;
revoke all on function public.b2b_importacao_concluir(uuid) from public, anon;
grant execute on function public.b2b_importacao_concluir(uuid) to authenticated, service_role;
revoke all on function public.b2b_divergencia_resolver(uuid, text) from public, anon;
grant execute on function public.b2b_divergencia_resolver(uuid, text) to authenticated;
