-- =====================================================================
-- Coffee LiVRE — Seller Central (12/09/2026) — Unidade 6
--
-- O vendedor passa a operar a própria presença sem depender de admin ou
-- de migration. Isso abre a primeira porta de ESCRITA do Coffee LiVRE
-- para alguém que não é da casa, e por isso esta migration é quase toda
-- segurança.
--
-- TRÊS BARREIRAS, e nenhuma delas é a interface:
--
-- 1. RLS POR VÍNCULO. `lv_seller_users` liga o usuário do Supabase Auth ao
--    vendedor. Toda policy nova pergunta "este registro é de um vendedor
--    ao qual eu pertenço?". Vendedor A não lê nem escreve nada do B.
--
-- 2. TRIGGERS DE GUARDA. RLS decide QUAIS LINHAS alguém toca; não decide
--    QUAIS COLUNAS. Um vendedor pode editar a própria loja, mas não pode
--    ativá-la; pode editar o próprio produto, mas não pode se dar destaque
--    na vitrine nem trocar o slug que já foi para uma embalagem. Isso é
--    coluna, e coluna se guarda com trigger.
--
-- 3. MODERAÇÃO NO BANCO. Regra da seção 4.3 do RAIO-X: produto novo, ou
--    editado em campo sensível (título, categoria, queda de preço acima de
--    50%), entra em `em_moderacao`. Se o vendedor pedir "ativo" sem
--    aprovação vigente, o próprio banco converte o pedido em moderação.
--    Não existe caminho pela API que pule a fila.
--
-- O QUE FOI DECIDIDO E NÃO ESTÁ NA LETRA DO RAIO-X (registrado na 17):
--   • Estoque > 0 NÃO é exigido para aparecer na vitrine nesta fase. A
--     seção 5.10 exige; ligar agora apagaria a demonstração inteira, que
--     não tem fluxo de recebimento no CD. Liga quando o CD existir.
--   • Mercado Pago conectado também não é exigido (pagamento é fase 2).
--   • Estoque por PRODUTO, não por variante: variantes seguem pendentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quem pertence a qual vendedor
-- ---------------------------------------------------------------------
create table if not exists public.lv_seller_users (
  seller_id  uuid not null references public.lv_sellers(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- seller_owner | seller_staff (seção 10.2)
  papel      text not null default 'seller_owner',
  created_at timestamptz not null default now(),
  primary key (seller_id, user_id),
  constraint lv_seller_users_papel_valido check (papel in ('seller_owner','seller_staff'))
);

comment on table public.lv_seller_users is
  'Vinculo usuario do Supabase Auth <-> vendedor. Base de todo isolamento da Seller Central: vendedor A nunca alcanca dado do B.';

create index if not exists lv_seller_users_por_usuario on public.lv_seller_users (user_id);

-- SECURITY DEFINER pelo mesmo motivo de `my_studio_orgs()`: a policy de
-- lv_seller_users não pode depender de ler lv_seller_users, senão recursiona.
create or replace function public.lv_meus_vendedores()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(seller_id), '{}')
    from public.lv_seller_users
   where user_id = auth.uid();
$$;

comment on function public.lv_meus_vendedores is
  'Vendedores do usuario atual. Toda policy de vendedor passa por aqui.';

revoke all on function public.lv_meus_vendedores() from public;
grant execute on function public.lv_meus_vendedores() to authenticated, service_role;

alter table public.lv_seller_users enable row level security;

drop policy if exists lv_seller_users_admin on public.lv_seller_users;
create policy lv_seller_users_admin on public.lv_seller_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O vendedor vê o próprio vínculo e mais nada. Criar vínculo é do admin:
-- ninguém se adiciona à loja de outro.
drop policy if exists lv_seller_users_proprio on public.lv_seller_users;
create policy lv_seller_users_proprio on public.lv_seller_users
  for select to authenticated using (user_id = auth.uid());

-- Quem opera a plataforma ou roda migration não passa pelas guardas.
-- auth.uid() nulo cobre a execução de migration; o anônimo também tem uid
-- nulo, mas ele não tem nenhuma policy de escrita para chegar até aqui.
create or replace function public.lv_chamada_privilegiada()
returns boolean
language sql
stable
as $$
  select public.is_admin()
      or coalesce(auth.role(), '') = 'service_role'
      or auth.uid() is null;
$$;

-- ---------------------------------------------------------------------
-- 2. Colunas novas do produto
-- ---------------------------------------------------------------------
alter table public.lv_products
  add column if not exists sku text,
  -- Quando a moderação aprovou pela última vez. Edição sensível zera.
  -- É o que permite ao vendedor pausar e reativar sem voltar para a fila.
  add column if not exists aprovado_em timestamptz,
  add column if not exists nota_moderacao text;

comment on column public.lv_products.aprovado_em is
  'Ultima aprovacao da moderacao. Edicao sensivel (titulo, categoria, queda de preco > 50%) zera. Sem aprovacao vigente, pedir "ativo" vira "em_moderacao".';

-- Os produtos que já estão no ar foram aprovados de fato.
update public.lv_products set aprovado_em = created_at
 where status = 'ativo' and aprovado_em is null;

-- ---------------------------------------------------------------------
-- 3. Guarda do produto
-- ---------------------------------------------------------------------
create or replace function public.lv_guarda_produto()
returns trigger
language plpgsql
as $$
begin
  if public.lv_chamada_privilegiada() then
    -- A moderação aprovando carimba a aprovação.
    if new.status = 'ativo' and (tg_op = 'INSERT' or old.status is distinct from 'ativo') then
      new.aprovado_em := coalesce(new.aprovado_em, now());
      new.nota_moderacao := null;
    end if;
    return new;
  end if;

  -- ---- Vendedor criando ----
  if tg_op = 'INSERT' then
    new.is_demo := false;
    new.destaque := false;
    new.ordem := 0;
    new.aprovado_em := null;
    new.nota_moderacao := null;
    if new.status not in ('rascunho', 'em_moderacao') then
      new.status := 'rascunho';
    end if;
    return new;
  end if;

  -- ---- Vendedor editando ----
  -- Estas colunas são da plataforma, não do vendedor. Voltam ao que eram
  -- em silêncio: a interface nem oferece, e quem forçar pela API não
  -- consegue.
  new.is_demo        := old.is_demo;
  new.destaque       := old.destaque;
  new.ordem          := old.ordem;
  new.seller_id      := old.seller_id;
  new.store_id       := old.store_id;
  new.nota_moderacao := old.nota_moderacao;
  -- O slug pode estar impresso numa embalagem via QR. Embalagem não se
  -- recolhe.
  new.slug           := old.slug;

  -- Edição sensível derruba a aprovação (seção 4.3 do RAIO-X).
  if new.titulo is distinct from old.titulo
     or new.category_id is distinct from old.category_id
     or (coalesce(old.preco_cents, 0) > 0 and coalesce(new.preco_cents, 0) < old.preco_cents / 2) then
    new.aprovado_em := null;
  else
    new.aprovado_em := old.aprovado_em;
  end if;

  -- Recusar é da moderação.
  if new.status = 'recusado' and old.status is distinct from 'recusado' then
    raise exception 'Somente a moderação recusa um produto.';
  end if;

  -- Recusado não salta direto para o ar: volta pela fila.
  if old.status = 'recusado' and new.status not in ('recusado', 'rascunho', 'em_moderacao', 'arquivado') then
    raise exception 'Produto recusado precisa ser corrigido e reenviado para moderação.';
  end if;

  -- Pediu "ativo" sem aprovação vigente, ou estava no ar e mudou campo
  -- sensível: vai para a fila. O banco decide, não a tela.
  if new.status = 'ativo' and new.aprovado_em is null then
    new.status := 'em_moderacao';
  end if;

  return new;
end;
$$;

drop trigger if exists lv_guarda_produto on public.lv_products;
create trigger lv_guarda_produto
  before insert or update on public.lv_products
  for each row execute function public.lv_guarda_produto();

-- ---------------------------------------------------------------------
-- 4. Guarda da loja
-- ---------------------------------------------------------------------
-- Separar DADOS da loja de APROVAÇÃO da loja. O vendedor edita nome,
-- história e cidade; ativar a vitrine é decisão da plataforma.
create or replace function public.lv_guarda_loja()
returns trigger
language plpgsql
as $$
begin
  if public.lv_chamada_privilegiada() then
    return new;
  end if;
  new.ativa     := old.ativa;
  new.slug      := old.slug;
  new.seller_id := old.seller_id;
  new.is_demo   := old.is_demo;
  new.destaque  := old.destaque;
  new.ordem     := old.ordem;
  return new;
end;
$$;

drop trigger if exists lv_guarda_loja on public.lv_stores;
create trigger lv_guarda_loja
  before update on public.lv_stores
  for each row execute function public.lv_guarda_loja();

-- ---------------------------------------------------------------------
-- 5. Estoque — primeira versão, lida pelo vendedor
-- ---------------------------------------------------------------------
-- Estoque no CD é o que a COFICO recebeu e conferiu (seção 5.9). O
-- vendedor LÊ; quem escreve é a operação. Deixar o vendedor digitar o
-- próprio estoque seria deixar ele vender o que não entregou.
create table if not exists public.lv_inventory_lots (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.lv_products(id) on delete cascade,
  seller_id       uuid not null references public.lv_sellers(id) on delete cascade,
  lote            text,
  validade        date,
  entrada_em      date,
  qtd_disponivel  integer not null default 0,
  qtd_reservada   integer not null default 0,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint lv_inventory_lots_qtd_valida check (qtd_disponivel >= 0 and qtd_reservada >= 0)
);

comment on table public.lv_inventory_lots is
  'Estoque por lote, por PRODUTO (variantes pendentes). O vendedor so le. Data de torra, idade do estoque, FEFO e alerta de giro ficam para quando o recebimento no CD existir.';

create index if not exists lv_inventory_lots_por_produto on public.lv_inventory_lots (product_id);
create index if not exists lv_inventory_lots_por_vendedor on public.lv_inventory_lots (seller_id);

alter table public.lv_inventory_lots enable row level security;

drop policy if exists lv_inventory_lots_admin on public.lv_inventory_lots;
create policy lv_inventory_lots_admin on public.lv_inventory_lots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists lv_inventory_lots_vendedor on public.lv_inventory_lots;
create policy lv_inventory_lots_vendedor on public.lv_inventory_lots
  for select to authenticated using (seller_id = any(public.lv_meus_vendedores()));

-- ---------------------------------------------------------------------
-- 6. Policies do vendedor nas tabelas existentes (aditivas)
-- ---------------------------------------------------------------------
-- As policies de admin e de leitura pública continuam como estão. Estas
-- somam o terceiro caminho: o dono do registro.

drop policy if exists lv_sellers_vendedor on public.lv_sellers;
create policy lv_sellers_vendedor on public.lv_sellers
  for select to authenticated using (id = any(public.lv_meus_vendedores()));

-- A loja inativa não é pública, mas o dono precisa enxergá-la para editar.
drop policy if exists lv_stores_vendedor_le on public.lv_stores;
create policy lv_stores_vendedor_le on public.lv_stores
  for select to authenticated using (seller_id = any(public.lv_meus_vendedores()));

drop policy if exists lv_stores_vendedor_edita on public.lv_stores;
create policy lv_stores_vendedor_edita on public.lv_stores
  for update to authenticated
  using (seller_id = any(public.lv_meus_vendedores()))
  with check (seller_id = any(public.lv_meus_vendedores()));

drop policy if exists lv_products_vendedor_le on public.lv_products;
create policy lv_products_vendedor_le on public.lv_products
  for select to authenticated using (seller_id = any(public.lv_meus_vendedores()));

-- Criar exige que a LOJA também seja do mesmo vendedor: sem isto, um
-- vendedor poderia pendurar produto na loja de outro passando os dois ids.
drop policy if exists lv_products_vendedor_cria on public.lv_products;
create policy lv_products_vendedor_cria on public.lv_products
  for insert to authenticated
  with check (
    seller_id = any(public.lv_meus_vendedores())
    and exists (select 1 from public.lv_stores s where s.id = store_id and s.seller_id = lv_products.seller_id)
  );

drop policy if exists lv_products_vendedor_edita on public.lv_products;
create policy lv_products_vendedor_edita on public.lv_products
  for update to authenticated
  using (seller_id = any(public.lv_meus_vendedores()))
  with check (seller_id = any(public.lv_meus_vendedores()));

-- Apagar só rascunho. O que já passou pela vitrine se arquiva, não some.
drop policy if exists lv_products_vendedor_apaga on public.lv_products;
create policy lv_products_vendedor_apaga on public.lv_products
  for delete to authenticated
  using (seller_id = any(public.lv_meus_vendedores()) and status = 'rascunho');

-- Atributo, faixa e imagem seguem o dono do produto.
do $$
declare t text;
begin
  foreach t in array array['lv_product_attributes', 'lv_price_tiers', 'lv_product_images'] loop
    execute format('drop policy if exists %I_vendedor on public.%I', t, t);
    execute format($f$
      create policy %I_vendedor on public.%I
        for all to authenticated
        using (exists (select 1 from public.lv_products p
                        where p.id = product_id and p.seller_id = any(public.lv_meus_vendedores())))
        with check (exists (select 1 from public.lv_products p
                             where p.id = product_id and p.seller_id = any(public.lv_meus_vendedores())))
    $f$, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Salvar produto numa transação só
-- ---------------------------------------------------------------------
-- SECURITY INVOKER de propósito: roda com a identidade de quem chama,
-- então RLS e triggers valem por inteiro. O que esta função dá é
-- ATOMICIDADE — produto, atributos e faixas mudam juntos ou nada muda.
-- Salvar em três chamadas soltas deixaria, numa falha no meio, um produto
-- com as faixas apagadas e as novas não gravadas.
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
begin
  if length(v_titulo) < 3 then
    raise exception 'O nome do produto precisa de pelo menos 3 letras.';
  end if;

  select seller_id into v_seller from public.lv_stores where id = v_store;
  if v_seller is null then
    raise exception 'Loja não encontrada.';
  end if;

  if v_id is null then
    -- Slug gerado no servidor, com sufixo curto: dois cafés com o mesmo
    -- nome em lojas diferentes não podem disputar a mesma URL.
    v_slug := left(btrim(regexp_replace(lower(translate(v_titulo,
                'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'), '-'), 60)
              || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

    insert into public.lv_products (
      store_id, seller_id, category_id, slug, titulo, marca, descricao, sku,
      preco_cents, peso_g, preco_minimo_cents, venda_por_quantidade, status
    ) values (
      v_store, v_seller, v_categoria, v_slug, v_titulo,
      nullif(btrim(p->>'marca'), ''), nullif(btrim(p->>'descricao'), ''), nullif(btrim(p->>'sku'), ''),
      nullif(p->>'preco_cents', '')::bigint, nullif(p->>'peso_g', '')::int,
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
      sku                  = nullif(btrim(p->>'sku'), ''),
      preco_cents          = nullif(p->>'preco_cents', '')::bigint,
      peso_g               = nullif(p->>'peso_g', '')::int,
      preco_minimo_cents   = nullif(p->>'preco_minimo_cents', '')::bigint,
      venda_por_quantidade = coalesce((p->>'venda_por_quantidade')::boolean, false),
      updated_at           = now()
    where id = v_id;
    -- Mesma resposta para "não existe" e "é de outro vendedor": confirmar
    -- a existência de um id alheio já é informação demais.
    if not found then
      raise exception 'Produto não encontrado.';
    end if;
  end if;

  -- Atributos: SÓ os que a categoria declara. Um moedor que chegue com
  -- "pontuacao" no payload simplesmente não grava pontuação.
  delete from public.lv_product_attributes where product_id = v_id;
  insert into public.lv_product_attributes (product_id, attribute_id, valor)
  select v_id, a.id, btrim(x.value)
    from jsonb_each_text(coalesce(p->'atributos', '{}'::jsonb)) x
    join public.lv_attributes a on a.chave = x.key
    join public.lv_category_attributes ca on ca.attribute_id = a.id and ca.category_id = v_categoria
   where btrim(x.value) <> '';

  -- Faixas: substituídas por inteiro. Guardadas mesmo com a venda por
  -- quantidade desligada, para o vendedor religar sem refazer.
  delete from public.lv_price_tiers where product_id = v_id;
  insert into public.lv_price_tiers (product_id, min_qty, tipo, valor)
  select v_id, (t->>'min_qty')::int, t->>'tipo', (t->>'valor')::int
    from jsonb_array_elements(coalesce(p->'faixas', '[]'::jsonb)) t
   where coalesce((t->>'valor')::int, 0) > 0;

  select status into v_status from public.lv_products where id = v_id;
  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

comment on function public.lv_salvar_produto is
  'Grava produto, atributos da categoria e faixas numa transacao. SECURITY INVOKER: RLS e triggers de guarda valem por inteiro.';

revoke all on function public.lv_salvar_produto(jsonb) from public;
grant execute on function public.lv_salvar_produto(jsonb) to authenticated, service_role;

-- Publicar e despublicar. O vendedor pede; a guarda decide se vai para o
-- ar ou para a fila. A resposta devolve o que de fato aconteceu, para a
-- tela dizer "publicado" ou "enviado para moderação" sem adivinhar.
create or replace function public.lv_publicar_produto(p_id uuid, p_publicar boolean)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare v_status text;
begin
  update public.lv_products
     set status = case when p_publicar then 'ativo' else 'pausado' end,
         updated_at = now()
   where id = p_id
  returning status into v_status;
  if v_status is null then
    raise exception 'Produto não encontrado.';
  end if;
  return v_status;
end;
$$;

revoke all on function public.lv_publicar_produto(uuid, boolean) from public;
grant execute on function public.lv_publicar_produto(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Classificação do café e selo ABIC
-- ---------------------------------------------------------------------
-- Pedido explícito do Vlademir: Tradicional, Extra Forte, Gourmet,
-- Especial. São as categorias do Programa de Qualidade do Café da ABIC,
-- não invenção de tela, e é o primeiro campo que um comprador de café
-- tradicional procura.
insert into public.lv_attributes (chave, rotulo, tipo, opcoes, no_passport, filtravel, ordem)
values ('classificacao', 'Classificação', 'opcao',
        '["Tradicional","Extra Forte","Superior","Gourmet","Especial"]'::jsonb, true, true, 0)
on conflict (chave) do nothing;

update public.lv_attributes
   set opcoes = '["Orgânico","ABIC","Rainforest","Fair Trade","UTZ","Denominação de origem"]'::jsonb
 where chave = 'certificacoes' and not (opcoes @> '["ABIC"]'::jsonb);

insert into public.lv_category_attributes (category_id, attribute_id, ordem)
select c.id, a.id, 0
  from public.lv_categories c
  join public.lv_attributes a on a.chave = 'classificacao'
 where c.slug in ('cafe-em-graos', 'cafe-torrado-moido', 'cafes-especiais', 'capsulas', 'drip-coffee')
on conflict do nothing;

-- Classificação dos produtos de demonstração.
insert into public.lv_product_attributes (product_id, attribute_id, valor)
select p.id, a.id, v.classe
  from (values
    ('alto-horizonte-bourbon-amarelo-250g', 'Especial'),
    ('alto-horizonte-catuai-vermelho-250g', 'Gourmet'),
    ('serra-clara-especial-graos-250g', 'Especial'),
    ('serra-clara-gourmet-graos-1kg', 'Gourmet'),
    ('serra-clara-tradicional-moido-500g', 'Tradicional'),
    ('grao-norte-robusta-amazonico-250g', 'Especial'),
    ('grao-norte-capsulas-intensidade-9', 'Extra Forte'),
    ('torra-viva-drip-frutado-10-saches', 'Especial'),
    ('torra-viva-descafeinado-moido-250g', 'Tradicional')
  ) as v(slug, classe)
  join public.lv_products p on p.slug = v.slug
  join public.lv_attributes a on a.chave = 'classificacao'
on conflict (product_id, attribute_id) do nothing;

-- ---------------------------------------------------------------------
-- 9. Estoque de demonstração
-- ---------------------------------------------------------------------
-- Um lote por produto de demonstração, para a tela de estoque não abrir
-- vazia na apresentação. Marcado is_demo. Sem data de torra: ela ainda
-- não pertence ao modelo, e inventá-la seria exatamente o que o Passport
-- proíbe.
insert into public.lv_inventory_lots (product_id, seller_id, lote, validade, entrada_em, qtd_disponivel, is_demo)
select p.id, p.seller_id,
       'L' || to_char(date '2026-09-01', 'YYMM') || '-' || upper(substr(md5(p.slug), 1, 3)),
       case when c.slug in ('cafeteiras', 'moedores', 'filtros-coadores', 'acessorios') then null
            else date '2027-03-01' end,
       date '2026-09-01',
       20 + (abs(hashtext(p.slug)) % 100),
       true
  from public.lv_products p
  left join public.lv_categories c on c.id = p.category_id
 where p.is_demo
   and not exists (select 1 from public.lv_inventory_lots l where l.product_id = p.id);
