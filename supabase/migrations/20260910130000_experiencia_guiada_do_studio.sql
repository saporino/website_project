-- =====================================================================
-- Experiência guiada: o cliente aponta, não descreve (10/09/2026)
--
-- Dono de torrefação sabe dizer "mais premium" e não sabe descrever luz
-- direcional, espaço negativo e tipografia sóbria. A tela passa a oferecer
-- escolhas; a tradução para decisão criativa acontece no servidor.
--
-- E a distinção que faltava: EMBALAGEM OFICIAL e IMAGEM DE INSPIRAÇÃO
-- recebem instruções OPOSTAS — uma se preserva, a outra se lê e se abandona.
-- Mandar as duas pelo mesmo caminho era pedir para o modelo copiar a
-- referência, que é exatamente o que a disciplina do Studio proíbe.
-- =====================================================================

alter table public.studio_generations
  add column if not exists reference_roles text[],
  add column if not exists style           text,
  add column if not exists text_mode       text,
  add column if not exists handle          text;

comment on column public.studio_generations.reference_roles is
  'Papel de cada anexo, na mesma ordem de reference_paths: oficial | inspiracao. Oficial se preserva; inspiracao se interpreta e se abandona.';
comment on column public.studio_generations.style is
  'fotografico | post_pronto | comercial | premium | moderno. Escolha do cliente que define o modo de saida e o acabamento.';
comment on column public.studio_generations.text_mode is
  'automatico | com_frase | sem_texto. Quem decide se a peca leva texto na arte.';
comment on column public.studio_generations.handle is
  '@ do Instagram da marca, para virar assinatura discreta. Nunca traduzido.';
