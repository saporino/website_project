-- =====================================================================
-- Coffee LiVRE — catálogo (11/09/2026) — Unidade 2
--
-- Núcleo de dados que sustenta HOME → CATEGORIA → PRODUTO → PASSPORT →
-- LOJA. Nada de pedido, pagamento, fulfillment ou fiscal: esta unidade
-- para na vitrine.
--
-- DUAS DECISÕES ESTRUTURAIS, e o porquê de cada uma:
--
-- 1. VENDEDOR e LOJA são tabelas separadas, mesmo com um para um hoje.
--    Vendedor é quem responde pelo negócio (CNPJ, tipo, situação); loja é
--    a presença pública (slug, capa, história). Separar depois, com
--    produto e URL já apontando para a entidade errada, é caro. Separar
--    agora custa uma tabela.
--
-- 2. ATRIBUTO DEPENDE DA CATEGORIA, e não do produto. O Coffee LiVRE não
--    é marketplace de pacotes de café: é do ecossistema do café, e
--    moedor, coador e cafeteira não têm variedade, processo nem
--    pontuação. Por isso os atributos vivem num catálogo próprio, são
--    ligados a categorias, e o produto guarda só os valores que lhe
--    cabem. Uma coluna `variedade` em `lv_products` obrigaria todo
--    moedor a ter uma.
--
-- O QUE NÃO FOI CONGELADO DE PROPÓSITO: a separação Produto × Oferta ×
-- Lote. Hoje produto carrega preço e estoque. Quando existir mais de um
-- vendedor para o mesmo item, ou quando o lote virar entidade, a saída é
-- aditiva — ver o comentário sobre Lot Passport no fim deste arquivo.
--
-- ISOLAMENTO: prefixo lv_, RLS em todas, zero referência a tabela de
-- Saporino, RepCo, Coffee Network ou COFICO Last Mile.
-- =====================================================================

-- ---------------------------------------------------------------------
-- VENDEDOR — quem responde pelo negócio
-- ---------------------------------------------------------------------
create table if not exists public.lv_sellers (
  id            uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social  text,
  cnpj          text,
  -- Lista inicial de trabalho, NÃO regra jurídica: produtor, fazenda,
  -- cooperativa, torrefacao, industria, marca, distribuidor, acessorios.
  -- Texto e não enum porque ainda vamos aprender os recortes reais.
  tipo          text not null default 'torrefacao',
  cidade        text,
  uf            char(2),
  responsavel   text,
  email         text,
  telefone      text,
  -- rascunho | analise | aprovado | suspenso
  status        text not null default 'rascunho',
  -- Dado de demonstração NUNCA pode ser confundido com parceiro real.
  -- Marcado na origem, não por convenção de nome.
  is_demo       boolean not null default false,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.lv_sellers is
  'Vendedor do Coffee LiVRE: a entidade que responde pelo negocio. A presenca publica dele e a loja (lv_stores). is_demo=true marca dado de demonstracao.';

create index if not exists lv_sellers_status on public.lv_sellers (status);

-- ---------------------------------------------------------------------
-- LOJA — a presença pública do vendedor
-- ---------------------------------------------------------------------
create table if not exists public.lv_stores (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.lv_sellers(id) on delete cascade,
  -- O slug entra na URL e pode ir para material impresso. Trocar depois
  -- quebra link publicado: trate como permanente.
  slug        text not null unique,
  nome        text not null,
  chamada     text,
  historia    text,
  especialidade text,
  cidade      text,
  uf          char(2),
  logo_url    text,
  capa_url    text,
  -- Cor de apoio da vitrine da loja, no tom da marca dela.
  cor         text,
  -- Iniciais mostradas quando ainda nao ha logo.
  iniciais    text,
  ativa       boolean not null default true,
  destaque    boolean not null default false,
  ordem       integer not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.lv_stores is
  'Vitrine publica de um vendedor. Um vendedor tem uma loja hoje; o esquema ja aceita varias. slug e permanente: vai para URL e pode ir para embalagem.';

create index if not exists lv_stores_por_vendedor on public.lv_stores (seller_id);
create index if not exists lv_stores_ativas on public.lv_stores (ativa, ordem) where ativa;

-- ---------------------------------------------------------------------
-- CATEGORIAS — árvore
-- ---------------------------------------------------------------------
create table if not exists public.lv_categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.lv_categories(id) on delete set null,
  slug       text not null unique,
  nome       text not null,
  -- Chave do ícone desenhado no front (grao, moido, caps, maquina...).
  icone      text,
  ordem      integer not null default 0,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.lv_categories is
  'Arvore de categorias do Coffee LiVRE. Cobre cafe E o ecossistema ao redor: equipamentos, acessorios e insumos.';

create index if not exists lv_categories_pai on public.lv_categories (parent_id, ordem);

-- ---------------------------------------------------------------------
-- ATRIBUTOS — o catálogo de campos possíveis
-- ---------------------------------------------------------------------
-- Cada atributo existe uma vez e é reaproveitado por quantas categorias
-- fizerem sentido. É o que permite filtrar "torra média" em grãos e em
-- moído sem duplicar definição.
create table if not exists public.lv_attributes (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null unique,
  rotulo    text not null,
  -- texto | numero | opcao | multiopcao | data
  tipo      text not null default 'texto',
  unidade   text,
  -- Valores aceitos, para tipo opcao/multiopcao. Vazio = texto livre.
  opcoes    jsonb not null default '[]'::jsonb,
  -- Entra no Coffee Passport quando o produto tiver valor para ele.
  no_passport boolean not null default false,
  -- Vira filtro na listagem de categoria.
  filtravel boolean not null default false,
  ordem     integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.lv_attributes is
  'Catalogo de atributos possiveis. no_passport=true significa que o campo aparece no Coffee Passport quando houver valor — e so quando houver.';

-- Quais atributos valem para qual categoria. Sem esta ponte, todo produto
-- herdaria todos os campos, e moedor voltaria a ter pontuação SCA.
create table if not exists public.lv_category_attributes (
  category_id  uuid not null references public.lv_categories(id) on delete cascade,
  attribute_id uuid not null references public.lv_attributes(id) on delete cascade,
  obrigatorio  boolean not null default false,
  ordem        integer not null default 0,
  primary key (category_id, attribute_id)
);

comment on table public.lv_category_attributes is
  'Quais atributos fazem sentido em cada categoria. E o que impede um moedor de ter variedade e pontuacao.';

-- ---------------------------------------------------------------------
-- PRODUTO
-- ---------------------------------------------------------------------
create table if not exists public.lv_products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.lv_stores(id) on delete cascade,
  seller_id   uuid not null references public.lv_sellers(id) on delete cascade,
  category_id uuid references public.lv_categories(id) on delete set null,
  -- O slug é a URL permanente do café. Um QR impresso em embalagem aponta
  -- para ele, e embalagem não se recolhe: NUNCA troque o slug de um
  -- produto que já circulou.
  slug        text not null unique,
  titulo      text not null,
  marca       text,
  descricao   text,
  -- Valores DEMO nesta fase. Nenhuma operação financeira real existe.
  preco       numeric(10,2),
  preco_de    numeric(10,2),
  peso_g      integer,
  -- rascunho | publicado | pausado
  status      text not null default 'rascunho',
  destaque    boolean not null default false,
  ordem       integer not null default 0,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint lv_products_preco_positivo check (preco is null or preco >= 0)
);

comment on table public.lv_products is
  'Produto do catalogo. slug e PERMANENTE: e a URL do Coffee Passport e o destino de um eventual QR impresso na embalagem. preco e DEMO nesta fase.';

create index if not exists lv_products_por_loja on public.lv_products (store_id);
create index if not exists lv_products_publicados on public.lv_products (status, ordem) where status = 'publicado';
create index if not exists lv_products_por_categoria on public.lv_products (category_id);

-- Valores dos atributos. Um produto guarda só o que lhe cabe; ausência de
-- linha significa ausência de informação, e ausência de informação não
-- vira texto inventado na tela.
create table if not exists public.lv_product_attributes (
  product_id   uuid not null references public.lv_products(id) on delete cascade,
  attribute_id uuid not null references public.lv_attributes(id) on delete cascade,
  valor        text not null,
  primary key (product_id, attribute_id)
);

comment on table public.lv_product_attributes is
  'Valores de atributo por produto. Linha ausente = informacao ausente, e a tela nao mostra nada no lugar.';

create table if not exists public.lv_product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.lv_products(id) on delete cascade,
  url        text not null,
  alt        text,
  ordem      integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lv_product_images_por_produto on public.lv_product_images (product_id, ordem);

-- ---------------------------------------------------------------------
-- COFFEE PASSPORT — projeção, não tabela
-- ---------------------------------------------------------------------
-- O Passport NÃO ganha tabela própria de propósito. Ele é a leitura dos
-- atributos marcados com no_passport que o produto realmente tem. Assim:
--   • campo sem valor simplesmente não existe na saída;
--   • acrescentar um campo novo ao Passport é uma linha em lv_attributes,
--     não uma migration de coluna;
--   • café comercial e microlote usam a mesma estrutura e mostram coisas
--     diferentes, porque preencheram coisas diferentes.
create or replace view public.vw_lv_coffee_passport as
select
  p.id            as product_id,
  p.slug          as product_slug,
  a.chave,
  a.rotulo,
  a.tipo,
  a.unidade,
  a.ordem,
  pa.valor
  from public.lv_products p
  join public.lv_product_attributes pa on pa.product_id = p.id
  join public.lv_attributes a          on a.id = pa.attribute_id
 where a.no_passport
   and btrim(pa.valor) <> '';

comment on view public.vw_lv_coffee_passport is
  'Coffee Passport de cada produto: so os campos de passaporte que TEM valor. Nao existe linha para campo vazio, e por isso a tela nunca inventa.';

-- Quanto o café se identifica. Deriva do que foi preenchido, nunca de
-- uma escolha manual: ninguem marca "especial" numa caixa de seleção.
create or replace function public.lv_nivel_do_passport(p_product_id uuid)
returns text
language sql
stable
as $$
  with campos as (
    select a.chave, pa.valor
      from public.lv_product_attributes pa
      join public.lv_attributes a on a.id = pa.attribute_id
     where pa.product_id = p_product_id
       and btrim(pa.valor) <> ''
  )
  select case
    when exists (select 1 from campos where chave = 'pontuacao'
                   and coalesce(nullif(regexp_replace(valor, '[^0-9.]', '', 'g'), ''), '0')::numeric >= 80)
      then 'especial'
    when exists (select 1 from campos where chave in ('fazenda', 'produtor', 'regiao', 'variedade'))
      then 'origem_identificada'
    when exists (select 1 from campos where chave in ('torra', 'moagem', 'especie'))
      then 'comercial'
    else null
  end;
$$;

comment on function public.lv_nivel_do_passport is
  'comercial | origem_identificada | especial. Derivado do que o vendedor preencheu — cafe tradicional nao e obrigado a ter dado de microlote.';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
-- Leitura pública do que está publicado, escrita só do administrador.
-- A vitrine precisa ser legível pelo visitante anônimo: o portão da
-- demonstração vive no navegador e não autentica ninguém no banco.
alter table public.lv_sellers            enable row level security;
alter table public.lv_stores             enable row level security;
alter table public.lv_categories         enable row level security;
alter table public.lv_attributes         enable row level security;
alter table public.lv_category_attributes enable row level security;
alter table public.lv_products           enable row level security;
alter table public.lv_product_attributes enable row level security;
alter table public.lv_product_images     enable row level security;

do $$
declare t text;
begin
  -- Escrita: administrador da plataforma, em todas.
  foreach t in array array[
    'lv_sellers','lv_stores','lv_categories','lv_attributes',
    'lv_category_attributes','lv_products','lv_product_attributes','lv_product_images'
  ] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format($f$
      create policy %I_admin on public.%I
        for all to authenticated
        using (public.is_admin()) with check (public.is_admin())
    $f$, t, t);
  end loop;
end $$;

-- Leitura pública, cada uma com o seu recorte de "está no ar".
drop policy if exists lv_stores_publicas on public.lv_stores;
create policy lv_stores_publicas on public.lv_stores
  for select to anon, authenticated using (ativa);

drop policy if exists lv_categories_publicas on public.lv_categories;
create policy lv_categories_publicas on public.lv_categories
  for select to anon, authenticated using (ativa);

-- Definição de atributo não é dado sensível: é vocabulário do catálogo.
drop policy if exists lv_attributes_publicos on public.lv_attributes;
create policy lv_attributes_publicos on public.lv_attributes
  for select to anon, authenticated using (true);

drop policy if exists lv_category_attributes_publicos on public.lv_category_attributes;
create policy lv_category_attributes_publicos on public.lv_category_attributes
  for select to anon, authenticated using (true);

drop policy if exists lv_products_publicados on public.lv_products;
create policy lv_products_publicados on public.lv_products
  for select to anon, authenticated using (status = 'publicado');

-- Atributo e imagem seguem o produto: se ele não está publicado, eles não
-- aparecem. Sem esta amarra, rascunho vazaria pelos atributos.
drop policy if exists lv_product_attributes_publicos on public.lv_product_attributes;
create policy lv_product_attributes_publicos on public.lv_product_attributes
  for select to anon, authenticated using (
    exists (select 1 from public.lv_products p where p.id = product_id and p.status = 'publicado')
  );

drop policy if exists lv_product_images_publicas on public.lv_product_images;
create policy lv_product_images_publicas on public.lv_product_images
  for select to anon, authenticated using (
    exists (select 1 from public.lv_products p where p.id = product_id and p.status = 'publicado')
  );

-- O VENDEDOR não é público. A loja é a cara; CNPJ, e-mail e telefone do
-- responsável ficam com o administrador.
-- (a policy lv_sellers_admin criada acima é a única)

-- ---------------------------------------------------------------------
-- Extensibilidade registrada, não implementada
-- ---------------------------------------------------------------------
-- LOT PASSPORT (fase futura, NÃO criar agora):
--   Coffee Passport = identidade permanente do café.
--   Lot Passport    = identidade de uma safra/lote daquele café.
-- O caminho é aditivo e não exige mexer no que está aqui: uma tabela
-- `lv_lots` (product_id, safra, codigo, colheita) mais uma
-- `lv_lot_attributes` com a MESMA forma de lv_product_attributes,
-- reaproveitando o mesmo catalogo lv_attributes. O produto ganha um
-- `current_lot_id` opcional, e o Passport passa a ler o lote quando
-- existir e o produto quando nao existir.
--
-- PRODUTO × OFERTA (fase futura): hoje preco e estoque moram no produto
-- porque ha um vendedor por item. Quando houver concorrencia pelo mesmo
-- item, nasce `lv_offers` (product_id, seller_id, preco, estoque) e o
-- produto perde as colunas de preco — migracao de dados, nao de conceito.
