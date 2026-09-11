-- =====================================================================
-- Coffee LiVRE — alinhamento do catálogo ao RAIO-X oficial (11/09/2026)
--
-- O RAIO-X operacional integral chegou depois da unidade 2. A seção 10
-- fixa duas convenções que a minha implementação não seguia, e as duas
-- são baratas agora e caras depois:
--
-- 1. DINHEIRO EM CENTAVOS (bigint). Eu tinha usado numeric(10,2).
--    Converter com onze produtos e zero pedidos custa esta migration.
--    Converter depois de existir pedido, pagamento, comissão e repasse
--    custa uma auditoria de arredondamento em cada uma dessas tabelas.
--
-- 2. VOCABULÁRIO DE STATUS: rascunho, em_moderacao, ativo, pausado,
--    recusado, arquivado. Eu usava "publicado", que não existe no
--    documento. Moderação é parte da jornada do vendedor (seção 5) e
--    precisa do estado intermediário.
--
-- O QUE NÃO FOI ALINHADO, e está registrado na seção 17.1 do RAIO-X:
-- a separação vendedor/loja (instrução posterior do Vlademir), os
-- atributos normalizados (superconjunto do previsto) e as variantes de
-- produto (decisão pendente, porque muda a URL permanente do QR).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. A vitrine sai da frente
-- ---------------------------------------------------------------------
-- Uma view depende das colunas que vao mudar de nome e de tipo. Postgres
-- recusa dropar a coluna enquanto a view existir, entao ela cai primeiro
-- e e recriada no fim, com as colunas novas.
drop function if exists public.lv_buscar_produtos(text);
drop view if exists public.vw_lv_vitrine;

-- ---------------------------------------------------------------------
-- 1. Dinheiro em centavos
-- ---------------------------------------------------------------------
alter table public.lv_products
  add column if not exists preco_cents    bigint,
  add column if not exists preco_de_cents bigint;

-- round() antes de cast: 52.90 * 100 em ponto flutuante pode virar
-- 5289.999..., e truncar aqui perderia um centavo por produto.
update public.lv_products
   set preco_cents    = round(preco * 100)::bigint,
       preco_de_cents = round(preco_de * 100)::bigint
 where preco_cents is null and preco is not null;

alter table public.lv_products drop constraint if exists lv_products_preco_positivo;
alter table public.lv_products drop column if exists preco;
alter table public.lv_products drop column if exists preco_de;

alter table public.lv_products
  add constraint lv_products_preco_positivo check (preco_cents is null or preco_cents >= 0);

comment on column public.lv_products.preco_cents is
  'Preco em CENTAVOS, conforme a secao 10 do RAIO-X. Valor DEMO na fase 1.';

-- ---------------------------------------------------------------------
-- 2. Vocabulário de status
-- ---------------------------------------------------------------------
-- 'publicado' vira 'ativo'. O check entra depois da conversão, senão a
-- própria migration viola a própria regra.
update public.lv_products set status = 'ativo' where status = 'publicado';

alter table public.lv_products drop constraint if exists lv_products_status_valido;
alter table public.lv_products
  add constraint lv_products_status_valido
  check (status in ('rascunho','em_moderacao','ativo','pausado','recusado','arquivado'));

comment on column public.lv_products.status is
  'rascunho | em_moderacao | ativo | pausado | recusado | arquivado — vocabulario da secao 10 do RAIO-X. So "ativo" aparece na vitrine.';

-- Vendedor segue a mesma disciplina: a jornada da seção 5 tem análise.
alter table public.lv_sellers drop constraint if exists lv_sellers_status_valido;
update public.lv_sellers set status = 'aprovado' where status not in
  ('rascunho','em_analise','aprovado','suspenso','recusado');
alter table public.lv_sellers
  add constraint lv_sellers_status_valido
  check (status in ('rascunho','em_analise','aprovado','suspenso','recusado'));

-- ---------------------------------------------------------------------
-- 3. As policies e views que falavam de 'publicado'
-- ---------------------------------------------------------------------
drop policy if exists lv_products_publicados on public.lv_products;
create policy lv_products_ativos on public.lv_products
  for select to anon, authenticated using (status = 'ativo');

drop policy if exists lv_product_attributes_publicos on public.lv_product_attributes;
create policy lv_product_attributes_publicos on public.lv_product_attributes
  for select to anon, authenticated using (
    exists (select 1 from public.lv_products p where p.id = product_id and p.status = 'ativo')
  );

drop policy if exists lv_product_images_publicas on public.lv_product_images;
create policy lv_product_images_publicas on public.lv_product_images
  for select to anon, authenticated using (
    exists (select 1 from public.lv_products p where p.id = product_id and p.status = 'ativo')
  );

drop index if exists lv_products_publicados;
create index if not exists lv_products_ativos on public.lv_products (status, ordem) where status = 'ativo';

-- A vitrine volta, agora com as colunas em centavos.
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
  public.lv_nivel_do_passport(p.id) as nivel_passport
  from public.lv_products p
  join public.lv_stores s on s.id = p.store_id
  left join public.lv_categories c on c.id = p.category_id
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id);

comment on view public.vw_lv_vitrine is
  'Produto ativo com loja, categoria e nivel do Passport. security_invoker: so aparece o que a RLS deixa a pessoa ver.';

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
