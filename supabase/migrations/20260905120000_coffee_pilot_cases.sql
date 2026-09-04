-- =====================================================================
-- Piloto real assistido — registro de caso e métricas (05/09/2026)
--
-- Serve para uma coisa só: transformar o primeiro produtor real e o primeiro
-- comprador real em prova e histórico, em vez de memória. Sem automação nova.
-- Tudo é preenchido à mão pela equipe COFICO enquanto conduz o caso.
-- =====================================================================

create table if not exists public.coffee_pilot_cases (
  id                      uuid primary key default gen_random_uuid(),
  codigo                  text unique,                  -- Pilot Case ID legível, ex.: PILOTO-001
  data_inicio             date not null default current_date,

  -- Quem está no caso. Aponta para a identidade da rede; nada é duplicado.
  produtor_entity_id      uuid references public.network_entities(id) on delete set null,
  comprador_entity_id     uuid references public.network_entities(id) on delete set null,
  offer_id                uuid references public.coffee_offers(id) on delete set null,
  request_id              uuid references public.coffee_purchase_requests(id) on delete set null,
  match_id                uuid references public.coffee_matches(id) on delete set null,
  match_score             numeric(5,2),

  -- Linha do tempo (métricas do piloto)
  cadastro_em             timestamptz,
  oferta_ativa_em         timestamptz,
  primeiro_match_em       timestamptz,
  minutos_ate_oferta_ativa int,
  minutos_ate_primeiro_match int,
  matches_gerados         int,
  tempo_cofico_minutos    int,                          -- esforço da equipe no caso

  -- O que aconteceu
  amostra_solicitada      boolean,
  proposta_feita          boolean,
  houve_negociacao        boolean,
  fechou                  boolean,
  motivo_perda            text,
  volume_sacas            numeric(10,2),
  valor_potencial_brl     numeric(14,2),
  resultado               text check (resultado is null or resultado in
                            ('em_andamento','fechado','perdido','desistiu','sem_match')),

  -- Aprendizado: é isto que corrige o produto
  ajuste_manual_necessario text,
  campos_que_faltaram      text,
  campos_que_sobraram      text,
  feedback_produtor        text,
  feedback_comprador       text,
  aprendizado              text,

  -- Uso futuro em vitrine de casos reais. Nada é publicado sem isto marcado.
  autoriza_divulgacao      boolean not null default false,
  divulgacao_anonimizada   boolean not null default true,

  observacoes_internas     text,
  created_by               uuid references auth.users(id) default auth.uid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists coffee_pilot_cases_resultado_idx on public.coffee_pilot_cases (resultado);

alter table public.coffee_pilot_cases enable row level security;

-- Caso de piloto é material interno da COFICO: só administrador.
drop policy if exists cpc_admin on public.coffee_pilot_cases;
create policy cpc_admin on public.coffee_pilot_cases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.coffee_pilot_cases is
  'Registro do piloto real assistido: quem, quanto tempo, o que faltou e por que fechou ou nao. Base para a vitrine futura de casos, sempre com autorizacao e anonimizacao.';

-- Visão de métricas agregadas do piloto. Números pequenos de propósito:
-- o piloto é sobre aprender, não sobre volume.
create or replace view public.vw_coffee_pilot_metrics as
select
  count(*)                                                        as casos,
  count(*) filter (where fechou)                                  as fechados,
  count(*) filter (where resultado = 'perdido')                   as perdidos,
  count(*) filter (where resultado = 'em_andamento')               as em_andamento,
  count(*) filter (where amostra_solicitada)                      as com_amostra,
  count(*) filter (where proposta_feita)                          as com_proposta,
  round(avg(minutos_ate_oferta_ativa)::numeric, 1)                as media_min_ate_oferta_ativa,
  round(avg(minutos_ate_primeiro_match)::numeric, 1)              as media_min_ate_primeiro_match,
  round(avg(match_score)::numeric, 1)                             as media_score,
  round(avg(tempo_cofico_minutos)::numeric, 1)                    as media_min_equipe_cofico,
  sum(volume_sacas)                                               as sacas_envolvidas,
  sum(valor_potencial_brl) filter (where fechou)                  as valor_fechado_brl
from public.coffee_pilot_cases;

revoke all on public.vw_coffee_pilot_metrics from public, anon;
grant select on public.vw_coffee_pilot_metrics to authenticated;
