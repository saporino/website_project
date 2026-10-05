-- Realtime em studio_campaigns: a lista de peças precisa saber quando uma campanha nasce,
-- é agendada ou publicada.
--
-- Sem isto, criar ou publicar uma campanha não mexia na tela de Vídeos: o card só mostrava
-- "Agendado para..." depois de um F5. studio_videos já estava na publicação desde o começo;
-- faltava a irmã.
do $$
begin
  alter publication supabase_realtime add table public.studio_campaigns;
exception
  when duplicate_object then null;   -- já estava publicada, segue o jogo
end $$;
