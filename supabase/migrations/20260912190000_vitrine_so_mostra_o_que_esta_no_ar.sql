-- =====================================================================
-- Coffee LiVRE — a vitrine só mostra o que está no ar (12/09/2026) — U6
--
-- DEFEITO QUE A UNIDADE 6 CRIARIA, pego antes de ir para a tela.
--
-- `vw_lv_vitrine` é security_invoker: mostra o que a RLS deixa QUEM ESTÁ
-- OLHANDO ver. Para o visitante anônimo isso era "só produto ativo". Mas a
-- Unidade 6 deu ao vendedor uma policy para ler os PRÓPRIOS produtos em
-- qualquer status — e o admin sempre leu todos. Resultado: um vendedor
-- logado navegando pela home veria os próprios rascunhos misturados à
-- vitrine, como se estivessem publicados. O admin já via os de todo mundo.
--
-- "Estar na vitrine" é regra de NEGÓCIO, não de permissão. Então ela vai
-- escrita na view: produto ativo em loja ativa, para qualquer pessoa. A
-- RLS continua valendo por baixo; isto é uma condição a mais, não a menos.
-- =====================================================================

drop function if exists public.lv_buscar_produtos(text);
drop view if exists public.vw_lv_vitrine;

create view public.vw_lv_vitrine
with (security_invoker = on) as
select
  p.id, p.slug, p.titulo, p.marca, p.descricao,
  p.preco_cents, p.preco_de_cents, p.peso_g,
  p.destaque, p.ordem, p.is_demo,
  p.venda_por_quantidade,
  p.category_id,
  c.slug as categoria_slug, c.nome as categoria_nome, c.icone as categoria_icone,
  raiz.slug as categoria_raiz_slug,
  p.store_id,
  s.slug as loja_slug, s.nome as loja_nome, s.cidade as loja_cidade,
  s.uf as loja_uf, s.cor as loja_cor, s.iniciais as loja_iniciais,
  public.lv_nivel_do_passport(p.id) as nivel_passport,
  (select pa.valor
     from public.lv_product_attributes pa
     join public.lv_attributes a on a.id = pa.attribute_id
    where pa.product_id = p.id and a.chave = 'pontuacao'
    limit 1) as pontuacao
  from public.lv_products p
  join public.lv_stores s on s.id = p.store_id
  left join public.lv_categories c on c.id = p.category_id
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id)
 -- A regra de vitrine, escrita. Vale para anônimo, vendedor e admin.
 where p.status = 'ativo'
   and s.ativa;

comment on view public.vw_lv_vitrine is
  'Vitrine publica: produto ATIVO em loja ATIVA, para qualquer pessoa. A condicao esta na view de proposito — vendedor e admin leem mais pela RLS, e nao podem ver rascunho misturado na vitrine.';

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

revoke all on function public.lv_buscar_produtos(text) from public;
grant execute on function public.lv_buscar_produtos(text) to anon, authenticated, service_role;
