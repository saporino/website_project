-- =====================================================================
-- Coffee LiVRE — a pontuação volta ao cartão (11/09/2026)
--
-- O verificador de fidelidade pegou: a classe `pont` existia no HTML
-- aprovado e sumiu do cartão quando ele passou a ler do banco. É o selo
-- "Pontuação SCA 86", e ele não é enfeite — é o que diferencia um café
-- especial num scroll rápido.
--
-- A pontuação sobe para a vitrine em vez de virar uma consulta por
-- cartão: dez produtos na tela seriam dez chamadas só para mostrar um
-- número de duas casas.
-- =====================================================================

drop function if exists public.lv_buscar_produtos(text);
drop view if exists public.vw_lv_vitrine;

create view public.vw_lv_vitrine
with (security_invoker = on) as
select
  p.id, p.slug, p.titulo, p.marca, p.descricao,
  p.preco_cents, p.preco_de_cents, p.peso_g,
  p.destaque, p.ordem, p.is_demo,
  p.category_id,
  c.slug as categoria_slug, c.nome as categoria_nome, c.icone as categoria_icone,
  raiz.slug as categoria_raiz_slug,
  p.store_id,
  s.slug as loja_slug, s.nome as loja_nome, s.cidade as loja_cidade,
  s.uf as loja_uf, s.cor as loja_cor, s.iniciais as loja_iniciais,
  public.lv_nivel_do_passport(p.id) as nivel_passport,
  -- Nulo quando o vendedor não informou, e aí o selo não aparece.
  (select pa.valor
     from public.lv_product_attributes pa
     join public.lv_attributes a on a.id = pa.attribute_id
    where pa.product_id = p.id and a.chave = 'pontuacao'
    limit 1) as pontuacao
  from public.lv_products p
  join public.lv_stores s on s.id = p.store_id
  left join public.lv_categories c on c.id = p.category_id
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id);

comment on view public.vw_lv_vitrine is
  'Produto ativo com loja, categoria, nivel do Passport e pontuacao. security_invoker: so aparece o que a RLS deixa a pessoa ver.';

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
