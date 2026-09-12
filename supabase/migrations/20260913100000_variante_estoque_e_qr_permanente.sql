-- =====================================================================
-- Coffee LiVRE — produto, variante, lote e QR permanente (13/09/2026)
-- Fechamento estrutural da Unidade 6, decidido pelo Vlademir.
--
-- RESPONSABILIDADES, UMA POR NÍVEL:
--
--   PRODUTO   identidade permanente e LiVRE Passport.
--             "Café Serra Clara Tradicional".
--   VARIANTE  o que vai fisicamente para a prateleira: gramatura, moagem,
--             embalagem, SKU/EAN, preço próprio quando houver, ESTOQUE.
--             "500 g · Média". 250 g e 1 kg são estoques diferentes, e
--             por isso estoque NUNCA mais fica no produto.
--   LOTE      a partida física de uma variante: número, data de torra,
--             validade, safra. Futuro Lot Passport.
--
-- QR PERMANENTE: o QR impresso não carrega slug. Carrega um código curto
-- que nunca muda (`/coffeelivre/q/ABC23456`) e que o banco resolve para
-- produto, variante e, no futuro, lote. Slug pode ser corrigido amanhã sem
-- recolher nenhuma embalagem.
--
-- RECEBIMENTO DO VENDEDOR: status próprio (não iniciado → pendente →
-- verificado → bloqueado). Nada de Mercado Pago agora; só o modelo parar de
-- supor que todo vendedor já pode receber.
--
-- ESTOQUE DE DEMONSTRAÇÃO continua separado do real: um lote marcado
-- is_demo só existe em produto de demonstração, e vice-versa. O banco
-- recusa a mistura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Variante
-- ---------------------------------------------------------------------
create table if not exists public.lv_product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.lv_products(id) on delete cascade,
  nome         text not null,
  gramatura_g  integer,
  moagem       text,
  embalagem    text,
  sku          text,
  ean          text,
  -- Nulo = vale o preço do produto. Preenchido quando o 1 kg custa
  -- diferente do 250 g. A escada de quantidade continua no produto.
  preco_cents  bigint,
  -- A variante que o cartão da vitrine vende com um clique.
  padrao       boolean not null default false,
  ativa        boolean not null default true,
  ordem        integer not null default 0,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lv_product_variants_gramatura_valida check (gramatura_g is null or gramatura_g > 0),
  constraint lv_product_variants_preco_valido check (preco_cents is null or preco_cents >= 0),
  constraint lv_product_variants_ean_valido check (ean is null or ean ~ '^([0-9]{8}|[0-9]{12,14})$')
);

comment on table public.lv_product_variants is
  'Variante fisica de um produto (gramatura, moagem, embalagem, SKU/EAN). O ESTOQUE e da variante, nunca do produto. Todo produto tem exatamente uma variante padrao.';

create unique index if not exists lv_product_variants_uma_padrao
  on public.lv_product_variants (product_id) where padrao;
create unique index if not exists lv_product_variants_sku_unico
  on public.lv_product_variants (product_id, lower(sku)) where sku is not null;
create index if not exists lv_product_variants_por_produto
  on public.lv_product_variants (product_id, ordem);

-- Nome legível montado dos campos, para ninguém digitar "500g moido" de
-- cinco jeitos diferentes.
create or replace function public.lv_nome_da_variante(p_gramatura integer, p_moagem text, p_embalagem text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(concat_ws(' · ',
           case when p_gramatura is null then null
                when p_gramatura >= 1000 and p_gramatura % 1000 = 0 then (p_gramatura / 1000) || ' kg'
                else p_gramatura || ' g' end,
           nullif(btrim(p_moagem), ''),
           nullif(btrim(p_embalagem), '')), ''), 'Padrão');
$$;

-- A variante herda a marcação de demonstração do produto e não troca de
-- produto depois de criada. Vale para todo mundo, inclusive admin: é
-- coerência, não permissão.
create or replace function public.lv_guarda_variante()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.product_id := old.product_id;
  end if;
  select p.is_demo into new.is_demo from public.lv_products p where p.id = new.product_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lv_guarda_variante on public.lv_product_variants;
create trigger lv_guarda_variante
  before insert or update on public.lv_product_variants
  for each row execute function public.lv_guarda_variante();

alter table public.lv_product_variants enable row level security;

drop policy if exists lv_product_variants_admin on public.lv_product_variants;
create policy lv_product_variants_admin on public.lv_product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pública como o preço: variante ativa de produto no ar, em loja no ar.
drop policy if exists lv_product_variants_publicas on public.lv_product_variants;
create policy lv_product_variants_publicas on public.lv_product_variants
  for select to anon, authenticated using (
    ativa and exists (
      select 1 from public.lv_products p join public.lv_stores s on s.id = p.store_id
       where p.id = product_id and p.status = 'ativo' and s.ativa)
  );

drop policy if exists lv_product_variants_vendedor on public.lv_product_variants;
create policy lv_product_variants_vendedor on public.lv_product_variants
  for all to authenticated
  using (exists (select 1 from public.lv_products p
                  where p.id = product_id and p.seller_id = any(public.lv_meus_vendedores())))
  with check (exists (select 1 from public.lv_products p
                       where p.id = product_id and p.seller_id = any(public.lv_meus_vendedores())));

-- Todo produto existente ganha a variante padrão, montada do que ele já
-- declara: peso, moagem e SKU.
insert into public.lv_product_variants (product_id, nome, gramatura_g, moagem, sku, padrao, ordem)
select p.id,
       public.lv_nome_da_variante(p.peso_g, m.valor, null),
       p.peso_g, m.valor, p.sku, true, 0
  from public.lv_products p
  left join lateral (
    select pa.valor from public.lv_product_attributes pa
      join public.lv_attributes a on a.id = pa.attribute_id
     where pa.product_id = p.id and a.chave = 'moagem' limit 1
  ) m on true
 where not exists (select 1 from public.lv_product_variants v where v.product_id = p.id);

-- ---------------------------------------------------------------------
-- 2. QR permanente
-- ---------------------------------------------------------------------
-- Oito caracteres sem 0/O/1/I/L: lido em voz alta num balcão, ou digitado
-- de uma embalagem amassada, não confunde. 31^8 combinações (~850 bilhões).
create table if not exists public.lv_qr_codes (
  codigo     text primary key,
  product_id uuid not null references public.lv_products(id) on delete cascade,
  variant_id uuid references public.lv_product_variants(id) on delete cascade,
  -- Futuro Lot Passport. A coluna existe para o contrato do QR não mudar.
  lot_id     uuid,
  ativo      boolean not null default true,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  constraint lv_qr_codes_formato check (codigo ~ '^[A-HJKMNP-Z2-9]{8}$')
);

comment on table public.lv_qr_codes is
  'Identificador PERMANENTE impresso em QR. Nunca carrega slug: resolve para produto, variante e (futuro) lote. Codigo nao muda nem se reaproveita.';

create index if not exists lv_qr_codes_por_produto on public.lv_qr_codes (product_id);

create or replace function public.lv_gerar_codigo_qr()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  saida text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    saida := '';
    for i in 0..7 loop
      saida := saida || substr(alfabeto, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.lv_qr_codes where codigo = saida);
  end loop;
  return saida;
end;
$$;

-- Coerência: variante do QR pertence ao produto do QR; marcação de demo
-- vem do produto; o código e o destino não se reescrevem depois.
create or replace function public.lv_guarda_qr()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.codigo := old.codigo;
    new.product_id := old.product_id;
    new.variant_id := old.variant_id;
  end if;
  if new.variant_id is not null and not exists (
       select 1 from public.lv_product_variants v where v.id = new.variant_id and v.product_id = new.product_id) then
    raise exception 'A variante do QR precisa ser do mesmo produto.';
  end if;
  select p.is_demo into new.is_demo from public.lv_products p where p.id = new.product_id;
  return new;
end;
$$;

drop trigger if exists lv_guarda_qr on public.lv_qr_codes;
create trigger lv_guarda_qr
  before insert or update on public.lv_qr_codes
  for each row execute function public.lv_guarda_qr();

alter table public.lv_qr_codes enable row level security;

drop policy if exists lv_qr_codes_admin on public.lv_qr_codes;
create policy lv_qr_codes_admin on public.lv_qr_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O vendedor lê os códigos dos próprios produtos. Não cria nem edita: o
-- código nasce com o produto, pelo banco.
drop policy if exists lv_qr_codes_vendedor on public.lv_qr_codes;
create policy lv_qr_codes_vendedor on public.lv_qr_codes
  for select to authenticated using (exists (
    select 1 from public.lv_products p where p.id = product_id and p.seller_id = any(public.lv_meus_vendedores())));

-- Código impresso não é segredo: é público enquanto o produto estiver no ar.
drop policy if exists lv_qr_codes_publicos on public.lv_qr_codes;
create policy lv_qr_codes_publicos on public.lv_qr_codes
  for select to anon, authenticated using (
    ativo and exists (
      select 1 from public.lv_products p join public.lv_stores s on s.id = p.store_id
       where p.id = product_id and p.status = 'ativo' and s.ativa)
  );

-- Um código por produto existente, apontando para o produto (sem variante:
-- abre a página na variante padrão).
insert into public.lv_qr_codes (codigo, product_id)
select public.lv_gerar_codigo_qr(), p.id
  from public.lv_products p
 where not exists (select 1 from public.lv_qr_codes q where q.product_id = p.id and q.variant_id is null);

-- Produto novo nasce com variante padrão e código permanente. SECURITY
-- DEFINER porque o vendedor não tem policy de escrita em QR — e não deve
-- ter: quem cria o código é o banco.
create or replace function public.lv_nasce_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lv_product_variants (product_id, nome, gramatura_g, sku, padrao)
  values (new.id, public.lv_nome_da_variante(new.peso_g, null, null), new.peso_g, new.sku, true);
  insert into public.lv_qr_codes (codigo, product_id) values (public.lv_gerar_codigo_qr(), new.id);
  return new;
end;
$$;

revoke all on function public.lv_nasce_produto() from public;

drop trigger if exists lv_nasce_produto on public.lv_products;
create trigger lv_nasce_produto
  after insert on public.lv_products
  for each row execute function public.lv_nasce_produto();

-- Resolve o código. Devolve para onde ir, e nada além.
--   null                          código não existe
--   {"disponivel": false}         existe, mas o produto não está no ar
--   {"disponivel": true, slug, variante_id, lote_id}
create or replace function public.lv_resolver_qr(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r record;
begin
  select q.product_id, q.variant_id, q.lot_id, q.ativo, p.slug, p.status, s.ativa as loja_ativa
    into r
    from public.lv_qr_codes q
    join public.lv_products p on p.id = q.product_id
    join public.lv_stores s on s.id = p.store_id
   where q.codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then
    return null;
  end if;
  if not r.ativo or r.status <> 'ativo' or not r.loja_ativa then
    return jsonb_build_object('disponivel', false);
  end if;
  return jsonb_build_object('disponivel', true, 'slug', r.slug, 'variante_id', r.variant_id, 'lote_id', r.lot_id);
end;
$$;

revoke all on function public.lv_resolver_qr(text) from public;
grant execute on function public.lv_resolver_qr(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Lote pertence à variante
-- ---------------------------------------------------------------------
alter table public.lv_inventory_lots
  add column if not exists variant_id uuid references public.lv_product_variants(id) on delete cascade,
  add column if not exists data_torra date,
  add column if not exists safra text;

update public.lv_inventory_lots l
   set variant_id = v.id
  from public.lv_product_variants v
 where v.product_id = l.product_id and v.padrao and l.variant_id is null;

alter table public.lv_inventory_lots alter column variant_id set not null;

create index if not exists lv_inventory_lots_por_variante on public.lv_inventory_lots (variant_id);

comment on table public.lv_inventory_lots is
  'Lote fisico de uma VARIANTE no CD. qtd_disponivel ja e o vendavel; qtd_reservada fica a parte. Lote vencido nao conta. Lote demo so existe em produto demo. O vendedor so le.';
comment on column public.lv_inventory_lots.product_id is
  'Derivado da variante pelo banco. Mantido para consulta e RLS; nunca informado a mao.';

-- Produto e vendedor saem da variante: não há como gravar um lote cujo
-- produto contradiga a variante. Quem chama só com product_id (código
-- antigo) cai na variante padrão.
create or replace function public.lv_guarda_lote()
returns trigger
language plpgsql
as $$
declare v_demo boolean;
begin
  if new.variant_id is null and new.product_id is not null then
    select v.id into new.variant_id from public.lv_product_variants v
     where v.product_id = new.product_id and v.padrao;
  end if;
  if new.variant_id is null then
    raise exception 'Lote precisa de uma variante.';
  end if;
  select v.product_id, p.seller_id, p.is_demo
    into new.product_id, new.seller_id, v_demo
    from public.lv_product_variants v join public.lv_products p on p.id = v.product_id
   where v.id = new.variant_id;
  if new.is_demo is distinct from v_demo then
    raise exception 'Estoque de demonstração e estoque real não se misturam: o lote precisa ter a mesma marcação do produto.';
  end if;
  return new;
end;
$$;

drop trigger if exists lv_guarda_lote on public.lv_inventory_lots;
create trigger lv_guarda_lote
  before insert or update on public.lv_inventory_lots
  for each row execute function public.lv_guarda_lote();

-- ---------------------------------------------------------------------
-- 4. Quanto dá para vender
-- ---------------------------------------------------------------------
-- Vendável = soma do disponível dos lotes não vencidos da variante.
-- SECURITY DEFINER porque o comprador não lê lote — e não precisa: recebe
-- um número, e só para o que está na vitrine.
create or replace function public.lv_vendavel_da_variante(p_variant uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.qtd_disponivel), 0)::int
    from public.lv_inventory_lots l
    join public.lv_product_variants v on v.id = l.variant_id
    join public.lv_products p on p.id = v.product_id
    join public.lv_stores s on s.id = p.store_id
   where l.variant_id = p_variant
     and v.ativa and p.status = 'ativo' and s.ativa
     and l.is_demo = p.is_demo
     and (l.validade is null or l.validade >= current_date);
$$;

revoke all on function public.lv_vendavel_da_variante(uuid) from public;
grant execute on function public.lv_vendavel_da_variante(uuid) to anon, authenticated, service_role;

-- Variantes à venda de um produto, com o preço efetivo e o vendável.
create or replace function public.lv_variantes_a_venda(p_product uuid)
returns table (
  id uuid, nome text, gramatura_g integer, moagem text, embalagem text,
  preco_cents bigint, padrao boolean, ordem integer, disponivel integer
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.nome, v.gramatura_g, v.moagem, v.embalagem,
         coalesce(v.preco_cents, p.preco_cents), v.padrao, v.ordem,
         public.lv_vendavel_da_variante(v.id)
    from public.lv_product_variants v
    join public.lv_products p on p.id = v.product_id
    join public.lv_stores s on s.id = p.store_id
   where v.product_id = p_product and v.ativa and p.status = 'ativo' and s.ativa
   order by v.padrao desc, v.ordem, v.gramatura_g nulls last;
$$;

revoke all on function public.lv_variantes_a_venda(uuid) from public;
grant execute on function public.lv_variantes_a_venda(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Vitrine sabe o vendável, a variante padrão e o código permanente
-- ---------------------------------------------------------------------
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
    limit 1) as pontuacao,
  vp.id as variante_padrao_id,
  -- Vendável da variante padrão: é o que o botão do cartão vende.
  coalesce(public.lv_vendavel_da_variante(vp.id), 0) as disponivel,
  (select q.codigo from public.lv_qr_codes q
    where q.product_id = p.id and q.variant_id is null and q.ativo
    order by q.created_at limit 1) as qr_codigo
  from public.lv_products p
  join public.lv_stores s on s.id = p.store_id
  left join public.lv_categories c on c.id = p.category_id
  left join public.lv_categories raiz on raiz.id = coalesce(c.parent_id, c.id)
  left join public.lv_product_variants vp on vp.product_id = p.id and vp.padrao
 where p.status = 'ativo'
   and s.ativa;

comment on view public.vw_lv_vitrine is
  'Vitrine publica: produto ATIVO em loja ATIVA. Traz a variante padrao, o vendavel dela (esgotado continua visivel, sem compra) e o codigo permanente do QR.';

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
-- 6. Salvar produto mantém a variante padrão em dia
-- ---------------------------------------------------------------------
-- O cadastro guiado ainda edita UMA variante (a padrão) pelos campos do
-- produto: peso, moagem e SKU. A edição de várias variantes é tela futura;
-- o modelo já está pronto para ela.
create or replace function public.lv_salvar_produto(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id       uuid := nullif(p->>'id', '')::uuid;
  v_store    uuid := nullif(p->>'store_id', '')::uuid;
  v_seller   uuid;
  v_categoria uuid := nullif(p->>'category_id', '')::uuid;
  v_titulo   text := btrim(coalesce(p->>'titulo', ''));
  v_slug     text;
  v_status   text;
  v_peso     int := nullif(p->>'peso_g', '')::int;
  v_sku      text := nullif(btrim(p->>'sku'), '');
  v_moagem   text := nullif(btrim(coalesce(p->'atributos'->>'moagem', '')), '');
begin
  if length(v_titulo) < 3 then
    raise exception 'O nome do produto precisa de pelo menos 3 letras.';
  end if;

  select seller_id into v_seller from public.lv_stores where id = v_store;
  if v_seller is null then
    raise exception 'Loja não encontrada.';
  end if;

  if v_id is null then
    v_slug := left(btrim(regexp_replace(lower(translate(v_titulo,
                'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'), '-'), 60)
              || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

    insert into public.lv_products (
      store_id, seller_id, category_id, slug, titulo, marca, descricao, sku,
      preco_cents, peso_g, preco_minimo_cents, venda_por_quantidade, status
    ) values (
      v_store, v_seller, v_categoria, v_slug, v_titulo,
      nullif(btrim(p->>'marca'), ''), nullif(btrim(p->>'descricao'), ''), v_sku,
      nullif(p->>'preco_cents', '')::bigint, v_peso,
      nullif(p->>'preco_minimo_cents', '')::bigint,
      coalesce((p->>'venda_por_quantidade')::boolean, false),
      'rascunho'
    )
    returning id into v_id;
  else
    update public.lv_products set
      category_id          = v_categoria,
      titulo               = v_titulo,
      marca                = nullif(btrim(p->>'marca'), ''),
      descricao            = nullif(btrim(p->>'descricao'), ''),
      sku                  = v_sku,
      preco_cents          = nullif(p->>'preco_cents', '')::bigint,
      peso_g               = v_peso,
      preco_minimo_cents   = nullif(p->>'preco_minimo_cents', '')::bigint,
      venda_por_quantidade = coalesce((p->>'venda_por_quantidade')::boolean, false),
      updated_at           = now()
    where id = v_id;
    if not found then
      raise exception 'Produto não encontrado.';
    end if;
  end if;

  delete from public.lv_product_attributes where product_id = v_id;
  insert into public.lv_product_attributes (product_id, attribute_id, valor)
  select v_id, a.id, btrim(x.value)
    from jsonb_each_text(coalesce(p->'atributos', '{}'::jsonb)) x
    join public.lv_attributes a on a.chave = x.key
    join public.lv_category_attributes ca on ca.attribute_id = a.id and ca.category_id = v_categoria
   where btrim(x.value) <> '';

  -- Moagem só vale se a categoria a admite (um moedor não tem moagem).
  if not exists (select 1 from public.lv_category_attributes ca join public.lv_attributes a on a.id = ca.attribute_id
                  where ca.category_id = v_categoria and a.chave = 'moagem') then
    v_moagem := null;
  end if;

  update public.lv_product_variants set
    gramatura_g = v_peso,
    moagem      = v_moagem,
    sku         = v_sku,
    ean         = nullif(regexp_replace(coalesce(p->>'ean', ''), '\D', '', 'g'), ''),
    nome        = public.lv_nome_da_variante(v_peso, v_moagem, embalagem)
  where product_id = v_id and padrao;

  delete from public.lv_price_tiers where product_id = v_id;
  insert into public.lv_price_tiers (product_id, min_qty, tipo, valor)
  select v_id, (t->>'min_qty')::int, t->>'tipo', (t->>'valor')::int
    from jsonb_array_elements(coalesce(p->'faixas', '[]'::jsonb)) t
   where coalesce((t->>'valor')::int, 0) > 0;

  select status into v_status from public.lv_products where id = v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

revoke all on function public.lv_salvar_produto(jsonb) from public;
grant execute on function public.lv_salvar_produto(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Recebimento do vendedor (sem Mercado Pago agora)
-- ---------------------------------------------------------------------
alter table public.lv_sellers
  add column if not exists pagamento_status text not null default 'nao_iniciado',
  add column if not exists pagamento_atualizado_em timestamptz;

alter table public.lv_sellers drop constraint if exists lv_sellers_pagamento_status_valido;
alter table public.lv_sellers add constraint lv_sellers_pagamento_status_valido
  check (pagamento_status in ('nao_iniciado', 'pendente', 'verificado', 'bloqueado'));

comment on column public.lv_sellers.pagamento_status is
  'Habilitacao para RECEBER vendas: nao_iniciado, pendente, verificado, bloqueado. So "verificado" recebe. O vendedor le e nao altera (sem policy de escrita). Venda real exige verificado.';

-- A pergunta que o checkout futuro vai fazer, num lugar só.
create or replace function public.lv_vendedor_pode_receber(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select pagamento_status = 'verificado' from public.lv_sellers where id = p_seller), false);
$$;

revoke all on function public.lv_vendedor_pode_receber(uuid) from public;
grant execute on function public.lv_vendedor_pode_receber(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Estoque de demonstração com casos que provam a regra
-- ---------------------------------------------------------------------
-- Três produtos com números escolhidos, não sorteados:
--   7 unidades  → escada 1-4 inteira, mas o total no carrinho para em 7
--   2 unidades  → faixas de 3 e 4 ficam indisponíveis, sem apagar a faixa
--   0 unidades  → esgotado, visível e sem compra
update public.lv_inventory_lots l set qtd_disponivel = v.qtd
  from public.lv_products p, (values
    ('serra-clara-tradicional-moido-500g', 7),
    ('serra-clara-especial-graos-250g', 2),
    ('torra-viva-descafeinado-moido-250g', 0)
  ) as v(slug, qtd)
 where p.slug = v.slug and l.product_id = p.id and l.is_demo;

-- Uma segunda variante de demonstração, para a página mostrar a escolha:
-- o mesmo Catuaí, moído, com estoque próprio.
insert into public.lv_product_variants (product_id, nome, gramatura_g, moagem, padrao, ordem)
select p.id, public.lv_nome_da_variante(250, 'Média', null), 250, 'Média', false, 1
  from public.lv_products p
 where p.slug = 'alto-horizonte-catuai-vermelho-250g'
   and not exists (select 1 from public.lv_product_variants v where v.product_id = p.id and not v.padrao);

insert into public.lv_inventory_lots (variant_id, lote, validade, entrada_em, qtd_disponivel, is_demo)
select v.id, 'L2609-MOI', date '2027-03-01', date '2026-09-01', 12, true
  from public.lv_product_variants v
  join public.lv_products p on p.id = v.product_id
 where p.slug = 'alto-horizonte-catuai-vermelho-250g' and not v.padrao
   and not exists (select 1 from public.lv_inventory_lots l where l.variant_id = v.id);
