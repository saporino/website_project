-- =====================================================================
-- Agendador inteligente do Studio (17/10/2026)
--
-- A IA já lê o texto da arte — isso existe e roda há tempos, guardado em
-- `studio_analyses.competitor_text`. O que faltava era transformar essa leitura
-- em algo que o calendário consiga PERGUNTAR: "me dê as artes de terça".
--
-- Três peças, e só:
--   1. `agendamento` em studio_analyses — o que a arte diz sobre QUANDO sair;
--   2. `studio_janelas` — em que horários cada marca publica;
--   3. `studio_sugestoes` — a fila do que a IA propôs, esperando aprovação.
--
-- O QUE NÃO MUDA, de propósito:
--   · `studio_campaigns` não ganha nem perde coluna;
--   · o robô `publish-scheduled` não é tocado — ele continua lendo campanhas
--     agendadas do mesmo jeito. Aprovar uma sugestão CRIA uma campanha igual
--     às que o Vlademir cria à mão hoje;
--   · as 45 publicações e os agendamentos existentes ficam intactos.
--
-- Desligar é só parar de gerar sugestões: sem linha em `studio_sugestoes`,
-- tudo volta a ser exatamente o que era.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O que a arte diz sobre quando sair
-- ---------------------------------------------------------------------
alter table public.studio_analyses
  add column if not exists agendamento jsonb;

comment on column public.studio_analyses.agendamento is
  'O que a arte exige de dia/horário: {dia_da_semana, periodo, temporalidade, tema, data_especifica, confianca, justificativa}. Derivado do texto que a análise JÁ extraiu — não é chamada de IA nova.';

-- Índice para "me dê as artes de terça" sair rápido quando a biblioteca crescer.
create index if not exists studio_analyses_agendamento_idx
  on public.studio_analyses using gin (agendamento);

-- ---------------------------------------------------------------------
-- 2. Em que horários cada marca publica
-- ---------------------------------------------------------------------
-- Hipótese inicial do Vlademir: 08h, 15h e 19h (fuso de São Paulo). São LIMITE,
-- não meta: se só houver uma arte adequada, agenda uma e deixa as outras vazias.
create table if not exists public.studio_janelas (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.studio_brand_profiles(id) on delete cascade,
  -- 0=domingo … 6=sábado. NULO = vale todos os dias.
  dia_semana  smallint,
  hora        text not null,
  periodo     text not null,
  plataforma  text not null default 'instagram',
  ativa       boolean not null default true,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'studio_janelas_periodo_check') then
    alter table public.studio_janelas add constraint studio_janelas_periodo_check
      check (periodo in ('manha', 'tarde', 'noite'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'studio_janelas_dia_check') then
    alter table public.studio_janelas add constraint studio_janelas_dia_check
      check (dia_semana is null or (dia_semana between 0 and 6));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'studio_janelas_hora_check') then
    alter table public.studio_janelas add constraint studio_janelas_hora_check
      check (hora ~ '^[0-2][0-9]:[0-5][0-9]$');
  end if;
end $$;

create unique index if not exists studio_janelas_unica_idx
  on public.studio_janelas (brand_id, plataforma, coalesce(dia_semana, -1), hora);

comment on table public.studio_janelas is
  'Horários em que cada marca publica. Fuso de São Paulo. É LIMITE, não meta: horário sem arte adequada fica vazio.';

alter table public.studio_janelas enable row level security;

create policy studio_janelas_equipe
  on public.studio_janelas for select
  using (public.is_admin() or public.has_role('gerente_comercial') or public.has_role('supervisor'));

create policy studio_janelas_admin
  on public.studio_janelas for all
  using (public.is_admin()) with check (public.is_admin());

-- As três janelas iniciais, para cada marca ativa no Studio.
insert into public.studio_janelas (brand_id, dia_semana, hora, periodo, plataforma)
select b.id, null, h.hora, h.periodo, 'instagram'
  from public.studio_brand_profiles b
 cross join (values ('08:00', 'manha'), ('15:00', 'tarde'), ('19:00', 'noite')) as h(hora, periodo)
 where b.ativa_no_studio
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. A fila de sugestões
-- ---------------------------------------------------------------------
-- A IA escreve aqui. NADA sai daqui para o ar sem o Vlademir aprovar — e
-- aprovar é o que cria a campanha que o robô publica.
create table if not exists public.studio_sugestoes (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.studio_brand_profiles(id) on delete cascade,
  video_id      uuid not null references public.studio_videos(id) on delete cascade,
  plataforma    text not null default 'instagram',
  sugerido_para timestamptz not null,
  periodo       text not null,
  motivo        text not null,
  confianca     numeric(3,2) not null default 0,
  legenda       text,
  status        text not null default 'sugerida',
  -- O que foi aprovado, exatamente. Se arte, legenda, marca, plataforma ou
  -- horário mudarem depois do "aprovado", a assinatura muda e a aprovação cai.
  assinatura    text,
  aprovado_por  uuid references auth.users(id) on delete set null,
  aprovado_em   timestamptz,
  rejeitado_por uuid references auth.users(id) on delete set null,
  rejeitado_em  timestamptz,
  motivo_rejeicao text,
  -- A campanha criada quando foi aprovada. É o elo com o robô que já existe.
  campaign_id   uuid references public.studio_campaigns(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'studio_sugestoes_status_check') then
    alter table public.studio_sugestoes add constraint studio_sugestoes_status_check
      check (status in ('sugerida', 'aprovada', 'rejeitada', 'revisar', 'obsoleta'));
  end if;
end $$;

create index if not exists studio_sugestoes_fila_idx
  on public.studio_sugestoes (brand_id, sugerido_para) where status = 'sugerida';

comment on table public.studio_sugestoes is
  'O que a IA propôs, esperando aprovação humana. Nada publica a partir daqui: aprovar cria uma campanha em studio_campaigns, e é o robô de sempre que publica.';
comment on column public.studio_sugestoes.assinatura is
  'Identidade do que foi aprovado (arte|marca|plataforma|horário|legenda). Mudou qualquer um, a aprovação cai e precisa de outra.';
comment on column public.studio_sugestoes.status is
  'revisar = a IA não teve confiança suficiente e não agenda sozinha. obsoleta = algo mudou depois da aprovação.';

alter table public.studio_sugestoes enable row level security;

create policy studio_sugestoes_equipe
  on public.studio_sugestoes for select
  using (public.is_admin() or public.has_role('gerente_comercial') or public.has_role('supervisor'));

create policy studio_sugestoes_admin
  on public.studio_sugestoes for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. A arte nunca pode ir para a marca errada
-- ---------------------------------------------------------------------
-- Trava no banco, não só no código: uma sugestão só vale se a arte e a sugestão
-- forem da MESMA marca. Com conta de cliente no sistema, publicar no perfil
-- errado é dano no nome de outra pessoa.
create or replace function public.studio_sugestao_marca_confere()
returns trigger
language plpgsql
as $$
declare marca_da_arte uuid;
begin
  select brand_id into marca_da_arte from public.studio_videos where id = new.video_id;
  if marca_da_arte is not null and marca_da_arte <> new.brand_id then
    raise exception 'A arte pertence a outra marca. Sugestão recusada.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_studio_sugestao_marca on public.studio_sugestoes;
create trigger trg_studio_sugestao_marca
  before insert or update on public.studio_sugestoes
  for each row execute function public.studio_sugestao_marca_confere();

-- ---------------------------------------------------------------------
-- 5. A fila de artes disponíveis
-- ---------------------------------------------------------------------
-- As 6 artes analisadas e sem campanha que a auditoria encontrou aparecem aqui.
drop view if exists public.vw_studio_artes_disponiveis;
create view public.vw_studio_artes_disponiveis as
  select v.id            as video_id,
         v.brand_id,
         b.name          as marca,
         b.tipo          as tipo_marca,
         v.filename      as titulo,
         v.thumbnail_path,
         v.storage_path,
         v.media_type,
         v.created_at,
         a.agendamento,
         a.competitor_text as texto_da_arte,
         a.resumo,
         -- já foi publicada alguma vez?
         (select max(c.published_at) from public.studio_campaigns c
           where c.video_id = v.id and c.published_at is not null) as publicada_em,
         -- já está na fila de sugestões?
         exists (select 1 from public.studio_sugestoes s
                  where s.video_id = v.id and s.status in ('sugerida', 'aprovada')) as na_fila
    from public.studio_videos v
    join public.studio_brand_profiles b on b.id = v.brand_id
    left join public.studio_analyses a on a.video_id = v.id
   where v.status = 'completed';

comment on view public.vw_studio_artes_disponiveis is
  'Artes analisadas, com o que a IA entendeu sobre quando devem sair, se já foram publicadas e se já estão na fila.';

grant select on public.vw_studio_artes_disponiveis to authenticated;
