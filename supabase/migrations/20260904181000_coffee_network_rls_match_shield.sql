-- =====================================================================
-- COFICO Coffee Network — RLS, motor de match e contact shield (04/09/2026)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funções de apoio
-- ---------------------------------------------------------------------

-- Identidades da rede ligadas ao usuário logado.
create or replace function public.my_network_entity_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from public.network_entities where user_id = auth.uid();
$$;

revoke execute on function public.my_network_entity_ids() from public;
grant execute on function public.my_network_entity_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. RLS — tudo fechado por padrão; leitura de terceiro só pelas views
-- ---------------------------------------------------------------------

alter table public.network_entities        enable row level security;
alter table public.network_roles           enable row level security;
alter table public.network_entity_roles    enable row level security;
alter table public.network_properties      enable row level security;
alter table public.commercial_accounts     enable row level security;
alter table public.coffee_bebida_scale     enable row level security;
alter table public.coffee_offers           enable row level security;
alter table public.coffee_offer_photos     enable row level security;
alter table public.coffee_purchase_requests enable row level security;
alter table public.coffee_matches          enable row level security;
alter table public.network_audit_log       enable row level security;

-- Vocabulários: leitura livre para autenticado, escrita só admin.
drop policy if exists cn_roles_read on public.network_roles;
create policy cn_roles_read on public.network_roles
  for select to authenticated using (true);
drop policy if exists cn_roles_admin on public.network_roles;
create policy cn_roles_admin on public.network_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists cn_bebida_read on public.coffee_bebida_scale;
create policy cn_bebida_read on public.coffee_bebida_scale
  for select to authenticated using (true);
drop policy if exists cn_bebida_admin on public.coffee_bebida_scale;
create policy cn_bebida_admin on public.coffee_bebida_scale
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- network_entities: admin vê tudo; participante vê só a própria identidade.
-- NINGUÉM mais lê a identidade de terceiro pela tabela — essa é a base do contact shield.
drop policy if exists cn_entities_admin on public.network_entities;
create policy cn_entities_admin on public.network_entities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_entities_self_read on public.network_entities;
create policy cn_entities_self_read on public.network_entities
  for select to authenticated using (user_id = auth.uid());
drop policy if exists cn_entities_self_update on public.network_entities;
create policy cn_entities_self_update on public.network_entities
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cn_entity_roles_admin on public.network_entity_roles;
create policy cn_entity_roles_admin on public.network_entity_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_entity_roles_self on public.network_entity_roles;
create policy cn_entity_roles_self on public.network_entity_roles
  for select to authenticated using (entity_id in (select public.my_network_entity_ids()));

drop policy if exists cn_properties_admin on public.network_properties;
create policy cn_properties_admin on public.network_properties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_properties_self on public.network_properties;
create policy cn_properties_self on public.network_properties
  for all to authenticated
  using (entity_id in (select public.my_network_entity_ids()))
  with check (entity_id in (select public.my_network_entity_ids()));

-- commercial_accounts: SOMENTE admin. Condição comercial de uma empresa não pode
-- vazar nem para o participante nem para outra empresa.
drop policy if exists cn_commercial_admin on public.commercial_accounts;
create policy cn_commercial_admin on public.commercial_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Ofertas: admin tudo; produtor só as próprias.
drop policy if exists cn_offers_admin on public.coffee_offers;
create policy cn_offers_admin on public.coffee_offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_offers_owner on public.coffee_offers;
create policy cn_offers_owner on public.coffee_offers
  for all to authenticated
  using (entity_id in (select public.my_network_entity_ids()))
  with check (entity_id in (select public.my_network_entity_ids()));

drop policy if exists cn_offer_photos_admin on public.coffee_offer_photos;
create policy cn_offer_photos_admin on public.coffee_offer_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_offer_photos_owner on public.coffee_offer_photos;
create policy cn_offer_photos_owner on public.coffee_offer_photos
  for all to authenticated
  using (offer_id in (select id from public.coffee_offers
                      where entity_id in (select public.my_network_entity_ids())))
  with check (offer_id in (select id from public.coffee_offers
                           where entity_id in (select public.my_network_entity_ids())));

-- Solicitações: admin tudo; comprador só as próprias.
drop policy if exists cn_requests_admin on public.coffee_purchase_requests;
create policy cn_requests_admin on public.coffee_purchase_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cn_requests_owner on public.coffee_purchase_requests;
create policy cn_requests_owner on public.coffee_purchase_requests
  for all to authenticated
  using (entity_id in (select public.my_network_entity_ids()))
  with check (entity_id in (select public.my_network_entity_ids()));

-- Matches: só a COFICO (admin) enxerga a tabela crua, que liga as duas pontas.
drop policy if exists cn_matches_admin on public.coffee_matches;
create policy cn_matches_admin on public.coffee_matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Auditoria: admin lê; qualquer autenticado grava o próprio rastro.
drop policy if exists cn_audit_admin_read on public.network_audit_log;
create policy cn_audit_admin_read on public.network_audit_log
  for select to authenticated using (public.is_admin());
drop policy if exists cn_audit_insert on public.network_audit_log;
create policy cn_audit_insert on public.network_audit_log
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- 3. MOTOR DE MATCH V1 — determinístico e auditável
-- ---------------------------------------------------------------------
--
-- Sem IA e sem caixa-preta. Pesos fixos somando 100:
--   espécie 20 · bebida 15 · peneira 15 · processo 15 · volume 15 · região 10 · preço 10
--
-- Critérios eliminatórios (não geram match): espécie diferente, safra diferente
-- quando exigida, SCA abaixo do mínimo exigido, certificação exigida ausente.
-- Cada fator devolvido em jsonb, para a tela poder mostrar o porquê do score.

create or replace function public.coffee_match_score(
  p_offer_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  o public.coffee_offers%rowtype;
  r public.coffee_purchase_requests%rowtype;
  o_bebida int; r_bebida int;
  score numeric := 0;
  factors jsonb := '[]'::jsonb;
  vol_ratio numeric;
  vol_points numeric;
  missing_certs text[];
begin
  select * into o from public.coffee_offers where id = p_offer_id;
  select * into r from public.coffee_purchase_requests where id = p_request_id;
  if o.id is null or r.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'oferta ou solicitacao inexistente');
  end if;

  -- ---- eliminatórios ----
  if o.species is distinct from r.species then
    return jsonb_build_object('eligible', false, 'reason', 'especie diferente');
  end if;

  if r.harvest_year is not null and o.harvest_year is not null
     and o.harvest_year <> r.harvest_year then
    return jsonb_build_object('eligible', false, 'reason', 'safra diferente da exigida');
  end if;

  if r.sca_min is not null and (o.sca_score is null or o.sca_score < r.sca_min) then
    return jsonb_build_object('eligible', false, 'reason', 'pontuacao SCA abaixo do minimo exigido');
  end if;

  if array_length(r.certifications_required, 1) is not null then
    select array_agg(c) into missing_certs
      from unnest(r.certifications_required) c
     where not (c = any(o.certifications));
    if missing_certs is not null then
      return jsonb_build_object('eligible', false, 'reason',
        'certificacao exigida ausente: ' || array_to_string(missing_certs, ', '));
    end if;
  end if;

  if r.moisture_max is not null and o.moisture_pct is not null
     and o.moisture_pct > r.moisture_max then
    return jsonb_build_object('eligible', false, 'reason', 'umidade acima do maximo aceito');
  end if;

  if r.defect_type_max is not null and o.defect_type is not null
     and o.defect_type > r.defect_type_max then
    return jsonb_build_object('eligible', false, 'reason', 'tipo/classificacao acima do maximo aceito');
  end if;

  -- ---- espécie (20) ----
  score := score + 20;
  factors := factors || jsonb_build_object('fator','especie','resultado','match','peso',20,'ganho',20);

  -- ---- bebida (15) ----
  select ordinal into o_bebida from public.coffee_bebida_scale where code = o.bebida;
  select ordinal into r_bebida from public.coffee_bebida_scale where code = r.bebida_min;
  if r_bebida is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','bebida','resultado','nao exigido','peso',15,'ganho',15);
  elsif o_bebida is null then
    factors := factors || jsonb_build_object('fator','bebida','resultado','oferta nao informou','peso',15,'ganho',0);
  elsif o_bebida >= r_bebida then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','bebida','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','bebida','resultado','abaixo do pedido','peso',15,'ganho',0);
  end if;

  -- ---- peneira (15) ----
  if r.screen_min is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','peneira','resultado','nao exigido','peso',15,'ganho',15);
  elsif o.screen_min is null then
    factors := factors || jsonb_build_object('fator','peneira','resultado','oferta nao informou','peso',15,'ganho',0);
  elsif o.screen_min >= r.screen_min then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','peneira','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','peneira','resultado','abaixo do pedido','peso',15,'ganho',0);
  end if;

  -- ---- processo (15) ----
  if array_length(r.process_accepted, 1) is null then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','processo','resultado','nao exigido','peso',15,'ganho',15);
  elsif o.process is not null and o.process = any(r.process_accepted) then
    score := score + 15;
    factors := factors || jsonb_build_object('fator','processo','resultado','match','peso',15,'ganho',15);
  else
    factors := factors || jsonb_build_object('fator','processo','resultado','fora da lista aceita','peso',15,'ganho',0);
  end if;

  -- ---- volume (15) — proporcional, gera "parcial" ----
  vol_ratio := least(o.quantity_bags / nullif(r.quantity_bags, 0), 1);
  vol_points := round(15 * coalesce(vol_ratio, 0), 2);
  score := score + vol_points;
  factors := factors || jsonb_build_object(
    'fator','volume',
    'resultado', case when coalesce(vol_ratio,0) >= 1 then 'match' else 'parcial' end,
    'peso',15,'ganho',vol_points,
    'detalhe', format('%s de %s sacas', o.quantity_bags, r.quantity_bags));

  -- ---- região (10) ----
  if r.origin_uf is null then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','regiao','resultado','nao exigida','peso',10,'ganho',10);
  elsif o.origin_uf is not null and o.origin_uf = r.origin_uf then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','regiao','resultado','match','peso',10,'ganho',10);
  else
    factors := factors || jsonb_build_object('fator','regiao','resultado','origem diferente','peso',10,'ganho',0);
  end if;

  -- ---- preço (10) ----
  if r.target_price_max is null or o.asking_price_brl_bag is null then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','preco','resultado','sem faixa definida','peso',10,'ganho',10);
  elsif o.asking_price_brl_bag <= r.target_price_max then
    score := score + 10;
    factors := factors || jsonb_build_object('fator','preco','resultado','dentro da faixa','peso',10,'ganho',10);
  else
    factors := factors || jsonb_build_object('fator','preco','resultado','acima da faixa','peso',10,'ganho',0);
  end if;

  return jsonb_build_object(
    'eligible', true,
    'score', round(score, 2),
    'fatores', factors,
    'calculado_em', now()
  );
end;
$$;

revoke execute on function public.coffee_match_score(uuid, uuid) from public;
grant execute on function public.coffee_match_score(uuid, uuid) to authenticated, service_role;

-- Recalcula os matches de uma solicitação contra todas as ofertas ativas.
create or replace function public.coffee_compute_matches(
  p_request_id uuid,
  p_min_score numeric default 50
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  rec record;
  res jsonb;
  n int := 0;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador pode recalcular matches';
  end if;

  for rec in
    select o.id from public.coffee_offers o
     where o.status = 'active'
       and (o.available_until is null or o.available_until >= current_date)
  loop
    res := public.coffee_match_score(rec.id, p_request_id);
    if (res->>'eligible')::boolean and (res->>'score')::numeric >= p_min_score then
      insert into public.coffee_matches (offer_id, request_id, score, factors, computed_at)
      values (rec.id, p_request_id, (res->>'score')::numeric, res->'fatores', now())
      on conflict (offer_id, request_id) do update
        set score = excluded.score,
            factors = excluded.factors,
            computed_at = now();
      n := n + 1;
    end if;
  end loop;

  insert into public.network_audit_log (action, entity_table, entity_id, new_state, reason)
  values ('match.compute', 'coffee_purchase_requests', p_request_id,
          jsonb_build_object('matches', n, 'min_score', p_min_score),
          'recalculo de matches');

  return n;
end;
$$;

revoke execute on function public.coffee_compute_matches(uuid, numeric) from public;
grant execute on function public.coffee_compute_matches(uuid, numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. CONTACT SHIELD (Fase F6)
-- ---------------------------------------------------------------------
--
-- As tabelas cruas já são invisíveis para terceiros pela RLS acima.
-- Estas views são a ÚNICA porta pela qual uma ponta enxerga a outra, e
-- carregam apenas o que é necessário para avaliar o negócio.
-- Rodam com os direitos do dono (security_invoker = off) de propósito:
-- é a view que faz a filtragem de colunas, não o chamador.
--
-- NÃO expõem: nome, razão social, CPF/CNPJ, telefone, WhatsApp, e-mail,
-- endereço exato, nome da fazenda, coordenadas.

drop view if exists public.vw_coffee_offers_shielded;
create view public.vw_coffee_offers_shielded
with (security_invoker = off) as
select
  o.id                     as offer_id,
  'Produtor verificado'::text as vendedor,
  (e.status = 'verified')  as produtor_verificado,
  o.species,
  o.harvest_year,
  o.quantity_bags,
  o.bag_weight_kg,
  o.bebida,
  b.label                  as bebida_label,
  o.screen_min,
  o.process,
  o.moisture_pct,
  o.defect_type,
  o.sca_score,
  o.certifications,
  o.sensory_notes,
  o.asking_price_brl_bag,
  -- Localização em nível de município/UF: suficiente para avaliar origem,
  -- insuficiente para chegar ao produtor por fora da COFICO.
  o.origin_municipio,
  o.origin_uf,
  o.region_label,
  o.available_from,
  o.available_until,
  o.exclusive_until,
  o.published_at,
  o.status
from public.coffee_offers o
join public.network_entities e on e.id = o.entity_id
left join public.coffee_bebida_scale b on b.code = o.bebida
where o.status = 'active';

comment on view public.vw_coffee_offers_shielded is
  'Contact shield: o que um comprador vê de uma oferta. Sem nome, documento, contato, endereco exato ou nome de fazenda.';

drop view if exists public.vw_coffee_requests_shielded;
create view public.vw_coffee_requests_shielded
with (security_invoker = off) as
select
  r.id                        as request_id,
  case when e.entity_type = 'organization'
       then 'Comprador empresarial verificado'
       else 'Comprador verificado' end::text as comprador,
  (e.status = 'verified')     as comprador_verificado,
  r.species,
  r.harvest_year,
  r.quantity_bags,
  r.bebida_min,
  b.label                     as bebida_min_label,
  r.screen_min,
  r.process_accepted,
  r.moisture_max,
  r.defect_type_max,
  r.sca_min,
  r.certifications_required,
  r.target_price_min,
  r.target_price_max,
  r.origin_uf                 as origem_desejada_uf,
  r.destination_uf            as destino_uf,
  r.delivery_window_start,
  r.delivery_window_end,
  r.freight_terms,
  r.sample_required,
  r.status
from public.coffee_purchase_requests r
join public.network_entities e on e.id = r.entity_id
left join public.coffee_bebida_scale b on b.code = r.bebida_min
where r.status = 'active';

comment on view public.vw_coffee_requests_shielded is
  'Contact shield: o que um produtor ve de uma solicitacao. Destino em nivel de UF; sem identidade nem contato do comprador.';

revoke all on public.vw_coffee_offers_shielded   from public, anon;
revoke all on public.vw_coffee_requests_shielded from public, anon;
grant select on public.vw_coffee_offers_shielded   to authenticated;
grant select on public.vw_coffee_requests_shielded to authenticated;

-- ---------------------------------------------------------------------
-- 5. CONVERTER EM CLIENTE (Fase F7) — sem duplicar cadastro
-- ---------------------------------------------------------------------

create or replace function public.network_convert_to_client(
  p_entity_id uuid,
  p_company_id uuid,
  p_relationship_type text default 'cliente',
  p_price_segment text default null,
  p_payment_method text default null,
  p_payment_term text default null,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_existing uuid;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador pode converter participante em cliente';
  end if;

  if not exists (select 1 from public.network_entities where id = p_entity_id) then
    raise exception 'participante inexistente';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'empresa inexistente';
  end if;

  select id into v_existing from public.commercial_accounts
   where entity_id = p_entity_id and company_id = p_company_id
     and relationship_type = p_relationship_type;
  if v_existing is not null then
    return v_existing;  -- idempotente: já existe relação com esta empresa
  end if;

  -- Cria SOMENTE a relação comercial. A identidade não é copiada:
  -- nome, documento, endereço e contato continuam em network_entities.
  -- Nenhuma condição comercial é herdada de outra empresa.
  insert into public.commercial_accounts (
    entity_id, company_id, relationship_type,
    price_segment, payment_method, payment_term
  ) values (
    p_entity_id, p_company_id, p_relationship_type,
    p_price_segment, p_payment_method, p_payment_term
  ) returning id into v_id;

  insert into public.network_audit_log (action, entity_table, entity_id, new_state, reason)
  values ('participante.convertido_em_cliente', 'commercial_accounts', v_id,
          jsonb_build_object('entity_id', p_entity_id, 'company_id', p_company_id,
                             'relationship_type', p_relationship_type),
          coalesce(p_reason, 'conversao manual pelo admin'));

  return v_id;
end;
$$;

revoke execute on function public.network_convert_to_client(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.network_convert_to_client(uuid, uuid, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. PUBLICAÇÃO DA OFERTA E JANELA DE 24H (Fase F3)
-- ---------------------------------------------------------------------

create or replace function public.coffee_offer_publish(
  p_offer_id uuid,
  p_hours int default 24
) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_prev jsonb;
  v_until timestamptz;
  v_status text;
begin
  select to_jsonb(o) , o.status into v_prev, v_status
    from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  if not (public.is_admin() or exists (
        select 1 from public.coffee_offers o
         where o.id = p_offer_id
           and o.entity_id in (select public.my_network_entity_ids()))) then
    raise exception 'sem permissao para publicar esta oferta';
  end if;

  if v_status <> 'approved' then
    raise exception 'oferta precisa estar aprovada pela COFICO antes de publicar (status atual: %)', v_status;
  end if;

  v_until := now() + make_interval(hours => p_hours);

  update public.coffee_offers
     set status = 'active', published_at = now(),
         exclusive_until = v_until, updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.publicada', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status','active','exclusive_until', v_until),
          format('janela de exclusividade de %s horas', p_hours));

  return v_until;
end;
$$;

revoke execute on function public.coffee_offer_publish(uuid, int) from public;
grant execute on function public.coffee_offer_publish(uuid, int) to authenticated, service_role;

-- Moderação da COFICO: aprovar, rejeitar ou pedir alteração.
create or replace function public.coffee_offer_moderate(
  p_offer_id uuid,
  p_decision text,          -- 'approve' | 'reject' | 'request_changes'
  p_note text default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_prev jsonb;
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'apenas a equipe COFICO pode moderar ofertas';
  end if;

  select to_jsonb(o) into v_prev from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  v_new_status := case p_decision
    when 'approve'         then 'approved'
    when 'reject'          then 'rejected'
    when 'request_changes' then 'draft'
    else null end;
  if v_new_status is null then
    raise exception 'decisao invalida: use approve, reject ou request_changes';
  end if;

  update public.coffee_offers
     set status = v_new_status, moderation_note = p_note,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.moderada', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status', v_new_status), p_note);

  return v_new_status;
end;
$$;

revoke execute on function public.coffee_offer_moderate(uuid, text, text) from public;
grant execute on function public.coffee_offer_moderate(uuid, text, text) to authenticated, service_role;

-- Baixa por venda externa: o produtor se comprometeu a avisar imediatamente.
-- Sem multa financeira neste ciclo; fica o registro para reputação futura.
create or replace function public.coffee_offer_mark_sold(
  p_offer_id uuid,
  p_externally boolean default true,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_prev jsonb;
begin
  select to_jsonb(o) into v_prev from public.coffee_offers o where o.id = p_offer_id;
  if v_prev is null then raise exception 'oferta inexistente'; end if;

  if not (public.is_admin() or exists (
        select 1 from public.coffee_offers o
         where o.id = p_offer_id
           and o.entity_id in (select public.my_network_entity_ids()))) then
    raise exception 'sem permissao para dar baixa nesta oferta';
  end if;

  update public.coffee_offers
     set status = 'sold', sold_externally = p_externally,
         sold_at = now(), sold_note = p_note, updated_at = now()
   where id = p_offer_id;

  insert into public.network_audit_log (action, entity_table, entity_id, previous_state, new_state, reason)
  values ('oferta.baixa', 'coffee_offers', p_offer_id, v_prev,
          jsonb_build_object('status','sold','sold_externally', p_externally), p_note);
end;
$$;

revoke execute on function public.coffee_offer_mark_sold(uuid, boolean, text) from public;
grant execute on function public.coffee_offer_mark_sold(uuid, boolean, text) to authenticated, service_role;
