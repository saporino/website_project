-- META DIÁRIA DE POSTAGEM, POR MARCA.
--
-- Pedido do Vlademir (09/10/2026): "quero um lembrete no topo de cada marca me lembrando que
-- tenho que fazer 3 postagens no dia — fiz 3, beleza, já tá tudo verde; fiz 2, falta uma".
--
-- Fica por marca (e não uma meta global) porque cada conta precisa alimentar o próprio
-- público: três posts somados não ajudam se uma conta ficou a semana toda muda. Nasce em 3
-- para todas e o admin ajusta onde o ritmo for outro.
alter table public.studio_brand_profiles
  add column if not exists meta_posts_dia smallint not null default 3
    check (meta_posts_dia between 0 and 20);

comment on column public.studio_brand_profiles.meta_posts_dia is
  'Quantas postagens por dia esta marca deve ter. 0 desliga a cobranca.';
