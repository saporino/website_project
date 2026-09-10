-- Vários ativos de referência por geração (10/09/2026)
--
-- A embalagem sozinha diz o que é o produto. Junto com uma referência de
-- cenário ou de luz, diz o que a peça deve VIRAR — que é como se troca ideia
-- de conceito. A API da OpenAI aceita múltiplas referências; limitar a uma
-- era limitação nossa.
--
-- `reference_path` continua como o primeiro ativo, para não quebrar o que já
-- lê essa coluna.
alter table public.studio_generations
  add column if not exists reference_paths text[];

comment on column public.studio_generations.reference_paths is
  'Todos os ativos de referencia da geracao, na ordem enviada. reference_path guarda o primeiro, por compatibilidade.';
