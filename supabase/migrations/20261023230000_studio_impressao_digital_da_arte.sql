-- "JÁ ESTÁ CARREGADA" — a impressão digital da arte.
--
-- Pedido dele: ao subir uma foto que já foi subida, o Studio avisar em vez de
-- aceitar calado. Hoje aceita, e a mesma peça entra duas vezes na fila — com
-- nomes diferentes ninguém percebe, e ela acaba agendada duas vezes.
--
-- Comparar por NOME DE ARQUIVO não serve: a mesma arte baixada de novo vira
-- "foto (1).png", e duas artes diferentes podem se chamar "post.png". O que
-- identifica o conteúdo é o conteúdo: SHA-256 dos bytes. Mesmo byte, mesmo
-- hash, e nenhum nome engana.
--
-- O hash é calculado NO NAVEGADOR, antes do upload (`crypto.subtle.digest`),
-- então a repetição é descoberta antes de gastar banda e armazenamento.

alter table public.studio_videos
  add column if not exists content_hash text;

comment on column public.studio_videos.content_hash is
  'SHA-256 do arquivo, em hex, calculado no navegador antes do upload. Serve para reconhecer a mesma arte subida de novo, mesmo com outro nome.';

-- Índice por MARCA, não global: a mesma arte pode legitimamente servir a duas
-- marcas, e avisar "já carregada" num caso desses seria falso alarme. Repetir
-- dentro da MESMA marca é que é o descuido.
create index if not exists studio_videos_hash_idx
  on public.studio_videos (brand_id, content_hash)
  where content_hash is not null;

-- É um AVISO, não uma trava. Nada de unique: pode haver motivo para subir a
-- mesma peça duas vezes, e o sistema não decide isso por ele — apenas conta o
-- que encontrou e deixa ele escolher. Transformar em erro bloquearia um caso
-- legítimo para evitar um descuido.
