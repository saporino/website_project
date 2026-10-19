-- =====================================================================
-- Agendador: duas correções que a verificação na tela encontrou (19/10/2026)
--
-- As duas só apareceram porque fui conferir no banco o que a aprovação tinha
-- gravado. Nenhuma delas apareceria na tela — e é esse o ponto.
--
-- 1. A VIEW NÃO ENTREGAVA O CAMINHO DA MÍDIA.
--    O robô `publish-scheduled` filtra por `.not("media_path", "is", null)`.
--    Sem esse campo, a campanha aprovada nascia com `media_path` nulo e o robô
--    simplesmente a ignorava: ficava "agendada" para sempre, sem publicar e
--    sem erro. Falha silenciosa, que é a pior espécie.
--
-- 2. O FUSO (corrigido no TypeScript, registrado aqui pelo contexto).
--    `08:00` sem fuso vira 08:00 UTC = 05h da manhã em São Paulo. O primeiro
--    agendamento de teste saiu três horas cedo. Agora o horário vai com
--    `-03:00` explícito.
-- =====================================================================

drop view if exists public.vw_studio_artes_disponiveis;

create view public.vw_studio_artes_disponiveis as
  select v.id            as video_id,
         v.brand_id,
         b.name          as marca,
         b.tipo          as tipo_marca,
         v.filename      as titulo,
         v.thumbnail_path,
         -- o que faltava: sem isto a campanha aprovada nunca publica
         v.storage_path,
         v.media_type,
         v.created_at,
         a.agendamento,
         a.competitor_text as texto_da_arte,
         a.resumo,
         (select max(c.published_at) from public.studio_campaigns c
           where c.video_id = v.id and c.published_at is not null) as publicada_em,
         exists (select 1 from public.studio_sugestoes s
                  where s.video_id = v.id and s.status in ('sugerida', 'aprovada')) as na_fila
    from public.studio_videos v
    join public.studio_brand_profiles b on b.id = v.brand_id
    left join public.studio_analyses a on a.video_id = v.id
   where v.status = 'completed';

comment on view public.vw_studio_artes_disponiveis is
  'Artes analisadas, com o que a IA entendeu sobre quando devem sair. Inclui storage_path: sem ele a campanha aprovada nasce sem mídia e o robô a ignora em silêncio.';

grant select on public.vw_studio_artes_disponiveis to authenticated;
