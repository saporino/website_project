-- =====================================================================
-- Briefing do Diretor Criativo no registro da geração (10/09/2026)
--
-- O cliente escreve "faça um bom dia" e recebe uma imagem. Entre as duas
-- coisas existe uma decisão criativa — conceito, cena, luz, enquadramento —
-- que hoje se perderia. Guardar o briefing responde depois "por que esta
-- imagem ficou assim", e é o que permite comparar as direções que
-- funcionaram com as que não funcionaram.
-- =====================================================================

alter table public.studio_generations
  add column if not exists content_type text,
  add column if not exists briefing jsonb;

comment on column public.studio_generations.content_type is
  'bom_dia | boa_tarde | produto | oferta | institucional | educativo | representante | livre. Escolhido por atalho, nunca digitado pelo cliente.';
comment on column public.studio_generations.briefing is
  'Briefing estruturado do Diretor Criativo: conceito, cena, luz, composicao, fatos permitidos e o prompt final. Auditavel — diz por que a imagem ficou como ficou.';
