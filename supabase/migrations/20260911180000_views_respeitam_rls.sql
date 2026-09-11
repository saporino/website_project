-- =====================================================================
-- Coffee LiVRE — views passam a respeitar RLS (11/09/2026)
--
-- DEFEITO ENCONTRADO NA UNIDADE 3, criado por mim na unidade 2.
--
-- No Postgres, uma view roda com os privilegios de QUEM A CRIOU, nao de
-- quem a consulta. Como `vw_lv_coffee_passport` nasceu do superusuario,
-- ela atravessava a RLS de `lv_product_attributes`.
--
-- Efeito pratico, medido: um produto em rascunho devolvia ZERO atributos
-- pela tabela e QUATORZE pela view. O Coffee Passport de um cafe que o
-- vendedor ainda nao publicou estava legivel por qualquer visitante
-- anonimo.
--
-- `security_invoker = on` faz a view rodar com os privilegios de quem
-- consulta, e a RLS das tabelas de baixo volta a valer. Postgres 15+;
-- este projeto roda 17.6.
--
-- LICAO PARA AS PROXIMAS: toda view do Coffee LiVRE nasce com
-- security_invoker. Nao e detalhe de performance, e a diferenca entre a
-- RLS valer e nao valer.
-- =====================================================================

alter view public.vw_lv_coffee_passport set (security_invoker = on);

-- ---------------------------------------------------------------------
-- Vitrine: produto com loja, categoria e nível, numa consulta só
-- ---------------------------------------------------------------------
-- A home, a categoria e a busca precisam das mesmas informações juntas.
-- Sem esta view, cada cartão da vitrine viraria três consultas, e o nível
-- do passaporte viraria uma chamada de função por produto.
create or replace view public.vw_lv_vitrine
with (security_invoker = on) as
select
  p.id,
  p.slug,
  p.titulo,
  p.marca,
  p.descricao,
  p.preco,
  p.preco_de,
  p.peso_g,
  p.destaque,
  p.ordem,
  p.is_demo,
  p.category_id,
  c.slug        as categoria_slug,
  c.nome        as categoria_nome,
  c.icone       as categoria_icone,
  raiz.slug     as categoria_raiz_slug,
  p.store_id,
  s.slug        as loja_slug,
  s.nome        as loja_nome,
  s.cidade      as loja_cidade,
  s.uf          as loja_uf,
  s.cor         as loja_cor,
  s.iniciais    as loja_iniciais,
  public.lv_nivel_do_passport(p.id) as nivel_passport
  from public.lv_products p
  join public.lv_stores s     on s.id = p.store_id
  left join public.lv_categories c    on c.id = p.category_id
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id);

comment on view public.vw_lv_vitrine is
  'Produto publicado com loja, categoria e nivel do Passport. security_invoker: so aparece o que a RLS deixa a pessoa ver.';

-- ---------------------------------------------------------------------
-- Busca por texto
-- ---------------------------------------------------------------------
-- Busca simples e confiavel vale mais numa demonstracao que busca
-- sofisticada e incompleta. `unaccent` nao esta instalado, entao a
-- normalizacao de acento fica por conta do `translate` abaixo — direto e
-- previsivel.
create or replace function public.lv_buscar_produtos(termo text)
returns setof public.vw_lv_vitrine
language sql
stable
as $$
  select v.*
    from public.vw_lv_vitrine v
   where coalesce(btrim(termo), '') = ''
      or translate(lower(v.titulo || ' ' || coalesce(v.marca,'') || ' ' || coalesce(v.descricao,'')
                        || ' ' || coalesce(v.loja_nome,'') || ' ' || coalesce(v.categoria_nome,'')),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
         like '%' || translate(lower(btrim(termo)),
                   'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                   'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC') || '%'
   order by v.destaque desc, v.ordem;
$$;

comment on function public.lv_buscar_produtos is
  'Busca por texto em titulo, marca, descricao, loja e categoria, ignorando acento. Le pela vw_lv_vitrine, entao respeita RLS.';

revoke all on function public.lv_buscar_produtos(text) from public;
grant execute on function public.lv_buscar_produtos(text) to anon, authenticated, service_role;
