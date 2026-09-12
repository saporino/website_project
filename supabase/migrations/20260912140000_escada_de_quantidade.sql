-- =====================================================================
-- Coffee LiVRE — escada de quantidade (12/09/2026) — Unidade 5
--
-- UM produto, UM estoque unitário. Comprar quatro pacotes não cria um SKU
-- de kit: cria uma linha de pedido com quantidade quatro, e o estoque cai
-- quatro. Kit como produto separado duplica catálogo, duplica foto,
-- duplica avaliação e desalinha estoque no primeiro mês.
--
-- O QUE A ESCADA É: faixas de quantidade com desconto, presas ao produto.
-- Duas formas, porque torrefação pensa das duas:
--   percentual -> "2 unidades, 2% off"
--   reais      -> "2 unidades, R$ 1,00 a menos por pacote"
-- A segunda é a que aparece em conversa de balcão, e não dava para
-- exprimir só com percentual sem arredondar feio.
--
-- O SISTEMA NÃO DECIDE PREÇO. O vendedor configura, o sistema calcula e
-- avisa quando a faixa fura o piso dele. Algoritmo automático de preço
-- fica fora desta unidade de propósito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- No produto: a chave da escada e o piso do vendedor
-- ---------------------------------------------------------------------
alter table public.lv_products
  add column if not exists venda_por_quantidade boolean not null default false,
  -- Piso LÍQUIDO por unidade, definido pelo vendedor. Opcional: quem não
  -- informa não recebe alerta. Em centavos, como todo dinheiro aqui.
  add column if not exists preco_minimo_cents bigint;

comment on column public.lv_products.venda_por_quantidade is
  'Liga a escada de quantidade na pagina do produto. Sem isto, a PDP mostra so o preco unitario.';
comment on column public.lv_products.preco_minimo_cents is
  'Piso por unidade que o vendedor nao quer furar. NAO bloqueia a venda: serve para o sistema ALERTAR quando uma faixa cai abaixo. Nulo = sem piso.';

-- ---------------------------------------------------------------------
-- As faixas
-- ---------------------------------------------------------------------
create table if not exists public.lv_price_tiers (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.lv_products(id) on delete cascade,
  -- A partir de quantas unidades esta faixa vale.
  min_qty    integer not null,
  -- percentual | reais
  tipo       text not null default 'percentual',
  -- percentual: pontos-base (200 = 2%). reais: centavos POR UNIDADE.
  -- Pontos-base pelo mesmo motivo da comissao: percentual decimal em
  -- dinheiro e' onde o arredondamento sangra.
  valor      integer not null,
  created_at timestamptz not null default now(),
  unique (product_id, min_qty),
  constraint lv_price_tiers_qty_valida  check (min_qty >= 2),
  constraint lv_price_tiers_tipo_valido check (tipo in ('percentual','reais')),
  constraint lv_price_tiers_valor_positivo check (valor >= 0)
);

comment on table public.lv_price_tiers is
  'Faixas de desconto por quantidade de UM produto. min_qty >= 2 porque a faixa de 1 unidade e o proprio preco do produto. NAO representa SKU: o estoque continua unitario.';

create index if not exists lv_price_tiers_por_produto on public.lv_price_tiers (product_id, min_qty);

alter table public.lv_price_tiers enable row level security;

-- A faixa é preço: é pública como o preço, e some junto com o produto que
-- sai do ar.
drop policy if exists lv_price_tiers_publicas on public.lv_price_tiers;
create policy lv_price_tiers_publicas on public.lv_price_tiers
  for select to anon, authenticated using (
    exists (select 1 from public.lv_products p where p.id = product_id and p.status = 'ativo')
  );

drop policy if exists lv_price_tiers_admin on public.lv_price_tiers;
create policy lv_price_tiers_admin on public.lv_price_tiers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- A vitrine sabe quem tem escada
-- ---------------------------------------------------------------------
-- Um campo só, para o cartão poder dizer "leve mais por menos" sem uma
-- consulta por produto na listagem.
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
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id);

comment on view public.vw_lv_vitrine is
  'Produto ativo com loja, categoria, nivel do Passport, pontuacao e se tem escada de quantidade. security_invoker: so aparece o que a RLS deixa a pessoa ver.';

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

-- ---------------------------------------------------------------------
-- Escada nos produtos de demonstração
-- ---------------------------------------------------------------------
-- Dois produtos com as duas formas, para a PDP mostrar os dois caminhos
-- desde o primeiro dia: o tradicional com desconto em reais (que e como
-- torrefacao fala) e o especial com percentual.
update public.lv_products
   set venda_por_quantidade = true, preco_minimo_cents = 2000
 where slug = 'serra-clara-tradicional-moido-500g';

insert into public.lv_price_tiers (product_id, min_qty, tipo, valor)
select p.id, v.q, 'reais', v.centavos
  from public.lv_products p,
       (values (2, 100), (3, 150), (4, 200)) as v(q, centavos)
 where p.slug = 'serra-clara-tradicional-moido-500g'
on conflict (product_id, min_qty) do nothing;

update public.lv_products
   set venda_por_quantidade = true, preco_minimo_cents = 4500
 where slug = 'serra-clara-especial-graos-250g';

insert into public.lv_price_tiers (product_id, min_qty, tipo, valor)
select p.id, v.q, 'percentual', v.bps
  from public.lv_products p,
       (values (2, 200), (3, 400), (4, 600)) as v(q, bps)
 where p.slug = 'serra-clara-especial-graos-250g'
on conflict (product_id, min_qty) do nothing;
