-- Status do Diretor Criativo na geração (10/09/2026)
--
-- Cinco direções criativas rodaram, custaram e foram jogadas fora sem que
-- ninguém percebesse: `max_tokens: 2000` truncava o JSON, o parse falhava e
-- o catch era silencioso. A imagem saía com o prompt de regra e o registro
-- não dizia nada.
--
-- Saber se a peça nasceu de direção criativa ou de regra é a diferença entre
-- avaliar o Diretor e avaliar o vazio.
alter table public.studio_generations
  add column if not exists creative_director_status text;

comment on column public.studio_generations.creative_director_status is
  'success = a peca nasceu do briefing do Diretor. fallback = o Diretor falhou e valeu o prompt montado por regra.';
