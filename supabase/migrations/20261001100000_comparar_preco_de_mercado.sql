-- Posicionamento do nosso preço dentro do mercado do segmento.
--
-- Pedido do Vlademir (01/10/2026): na tabela global, ao lado do preço de cada café, mostrar
-- onde ele fica em relação ao mercado daquele segmento (Atacado → Atacadão, Hortifruti →
-- Oba Hortifruti…). Café que não vendemos naquele canal não precisa comparar: liga/desliga
-- por café, ao lado do Salvar. Nasce LIGADO (decisão dele), e ele desliga o que não serve.
--
-- Fica em `price_lists` porque é uma decisão POR SEGMENTO: o mesmo café pode ser comparado
-- no atacado e não fazer sentido no hortifruti.

alter table public.price_lists
  add column if not exists comparar_mercado boolean not null default true;

comment on column public.price_lists.comparar_mercado is
  'Mostra o posicionamento deste produto no mercado do segmento (tabela global). Desligar so esconde a comparacao; nao muda preco.';
