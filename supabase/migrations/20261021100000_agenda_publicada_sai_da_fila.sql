-- =====================================================================
-- O que publicou sai da fila, mas não some do calendário (21/10/2026)
--
-- O QUE ELE DESCREVEU, em duas frases que parecem opostas e não são:
--
--   "o que vai postando vai sumindo — hoje o que estava agendado para as 8
--    posta e sai de cena"
--   "manter o controle sem perder o posicionamento de onde o que precisa ir,
--    aí eu vejo o que já está e mudo o estilo de foto"
--
-- Lido junto: publicada para de ocupar a FILA DE APROVAÇÃO, e continua
-- visível NO HORÁRIO DELA. É o que permite olhar a semana e decidir o estilo
-- do que vem — "segunda 08:00 foi essa, terça 08:00 foi aquela".
--
-- O DEFEITO DE HOJE. Não existe estado "publicada": os estados são sugerida,
-- aprovada, rejeitada, revisar e obsoleta. O robô `publish-scheduled` publica
-- a CAMPANHA e ninguém volta para marcar a sugestão. Ela fica `aprovada` para
-- sempre e segue na fila. Agora mesmo: 23 aprovadas, 1 já publicada de fato,
-- e essa 1 continua pedindo atenção que não precisa mais.
--
-- É o entulho de ontem com outra roupa: em vez de sugestão vencida, campanha
-- cumprida. O conserto é o mesmo em espírito — o sistema fecha o ciclo em vez
-- de deixar a sobra para a pessoa varrer.
-- =====================================================================

-- 1. O estado novo. Não é "obsoleta": obsoleta é o que perdeu o sentido;
--    publicada é o que CUMPRIU. Distinguir importa para ele conseguir olhar
--    para trás e ver o que de fato saiu.
alter table public.studio_sugestoes drop constraint if exists studio_sugestoes_status_check;
alter table public.studio_sugestoes add constraint studio_sugestoes_status_check
  check (status in ('sugerida', 'aprovada', 'rejeitada', 'revisar', 'obsoleta', 'publicada'));

-- 2. Quando a campanha publica, a sugestão correspondente fecha o ciclo.
create or replace function public.studio_sugestao_publicada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só no momento em que `published_at` deixa de ser nulo. Sem isto, qualquer
  -- update na campanha mexeria na sugestão de novo.
  if new.published_at is null or (old.published_at is not null) then
    return new;
  end if;

  update public.studio_sugestoes s
     set status = 'publicada'
   where s.video_id = new.video_id
     and s.brand_id is not distinct from new.brand_id
     and s.status = 'aprovada';

  return new;
end $$;

drop trigger if exists trg_studio_sugestao_publicada on public.studio_campaigns;
create trigger trg_studio_sugestao_publicada
  after update of published_at on public.studio_campaigns
  for each row execute function public.studio_sugestao_publicada();

comment on function public.studio_sugestao_publicada is
  'Fecha o ciclo: campanha publicada marca a sugestão como publicada, para ela sair da fila de aprovação sem sumir do calendário.';

-- 3. O que já publicou antes deste gatilho existir.
--    Atualiza só o que tem campanha publicada de verdade — nada é adivinhado.
update public.studio_sugestoes s
   set status = 'publicada'
 where s.status = 'aprovada'
   and exists (
     select 1 from public.studio_campaigns c
      where c.video_id = s.video_id
        and c.brand_id is not distinct from s.brand_id
        and c.published_at is not null
   );

-- 4. Os índices únicos de ontem continuam valendo só para o que está ATIVO.
--    Publicada não ocupa janela: o horário fica livre para o futuro, e o
--    registro fica no histórico. Sem isto, uma semana publicada impediria
--    agendar a semana seguinte no mesmo horário.
drop index if exists public.uq_studio_sugestoes_janela;
create unique index uq_studio_sugestoes_janela
  on public.studio_sugestoes (brand_id, sugerido_para)
  where status in ('sugerida', 'aprovada');

drop index if exists public.uq_studio_sugestoes_arte_ativa;
create unique index uq_studio_sugestoes_arte_ativa
  on public.studio_sugestoes (brand_id, video_id)
  where status in ('sugerida', 'aprovada');
