-- =====================================================================
-- Decomposição dos tokens de entrada (10/09/2026)
--
-- A primeira geração real ($ 0,05307, 1.092 tokens de entrada) tinha entrada
-- só de texto, então o total bastava. No teste com embalagem vai entrar uma
-- imagem de referência — e imagem de entrada custa $8/1M contra $5/1M do
-- texto. Sem separar, o custo total continua certo, mas fica impossível
-- responder "quanto a embalagem acrescentou".
--
-- A API devolve essa separação em `usage.input_tokens_details`. Ela já era
-- usada no CÁLCULO (custoDaImagemUSD lê text_tokens e image_tokens); o que
-- faltava era GRAVAR.
--
-- Nullable de propósito: nem toda chamada tem imagem de entrada, e a API nem
-- sempre manda o detalhamento. Nulo aqui significa "a API não informou" — não
-- significa zero. `input_tokens` continua sendo o total autoritativo.
--
-- Registros antigos ficam como estão: a primeira geração fica com os dois
-- campos nulos, que é a verdade sobre ela — não foi medida assim.
-- =====================================================================

alter table public.ai_usage_events
  add column if not exists input_text_tokens  integer,
  add column if not exists input_image_tokens integer;

comment on column public.ai_usage_events.input_text_tokens is
  'Parte dos input_tokens que veio de TEXTO, quando a API informa em input_tokens_details. Nulo = nao informado, nao zero.';
comment on column public.ai_usage_events.input_image_tokens is
  'Parte dos input_tokens que veio de IMAGEM de referencia. Custa mais que texto ($8/1M contra $5/1M), e e o que responde quanto a embalagem acrescentou ao custo. Nulo = nao informado, nao zero.';
