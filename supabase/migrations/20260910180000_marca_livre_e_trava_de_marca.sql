-- =====================================================================
-- Marca livre, trava de marca e unicidade entre clientes (10/09/2026)
--
-- ORIGEM: a geração d57486b7 entrou com a embalagem Café Capital anexada
-- como ativo OFICIAL e saiu com uma embalagem Saporino vermelha. O modelo
-- não trocou nada — o prompt mandava, em inglês e por escrito, "place the
-- official Saporino Clássico Tradicional coffee package". A marca vinha do
-- seletor de EMPRESA do topo do admin; o anexo não tinha marca nenhuma.
-- Duas verdades contraditórias, e só uma delas tinha nome.
--
-- Três buracos, três correções:
--
-- 1. A marca da peça vinha da empresa faturadora selecionada no topo.
--    → studio_generations passa a registrar brand_mode e brand_name, e a
--      marca vira escolha explícita do Studio.
--
-- 2. O ativo anexado não pertencia a marca nenhuma, então não havia o que
--    conferir.
--    → studio_reference_assets amarra cada arquivo à marca que o enviou.
--
-- 3. Nenhuma peça sabia o que outras peças já tinham dito.
--    → studio_content_fingerprints guarda só o HASH da frase e da estrutura.
--      Dá para saber que uma frase já existe sem saber de quem ela era.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A marca da peça, explícita no registro
-- ---------------------------------------------------------------------
alter table public.studio_generations
  add column if not exists brand_mode text not null default 'perfil',
  add column if not exists brand_name text,
  add column if not exists batch_id   uuid,
  add column if not exists batch_index int;

comment on column public.studio_generations.brand_mode is
  'perfil = marca cadastrada manda; livre = a embalagem anexada e o pedido escrito mandam, e NENHUM DNA e carregado.';
comment on column public.studio_generations.brand_name is
  'Nome da marca que valeu para ESTA peca. Em modo livre e o que o cliente digitou. Guardado sempre, para auditar de quem era a peca sem depender de join.';
comment on column public.studio_generations.batch_id is
  'Levas: "gere 7 bom dias" nasce como 7 linhas com o mesmo batch_id e batch_index 1..7.';

create index if not exists studio_gen_por_lote on public.studio_generations (batch_id, batch_index);

-- Backfill: as peças existentes eram todas de perfil cadastrado.
update public.studio_generations g
   set brand_name = p.name
  from public.studio_brand_profiles p
 where p.id = g.brand_id and g.brand_name is null;

-- ---------------------------------------------------------------------
-- 2. O ativo passa a ter dono
-- ---------------------------------------------------------------------
-- Antes disto, a única checagem era o prefixo do caminho, que é o
-- company_id. Uma organização com duas marcas passava reto: a embalagem da
-- marca A servia de "ativo oficial" na peça da marca B sem nenhum aviso.
create table if not exists public.studio_reference_assets (
  id              uuid primary key default gen_random_uuid(),
  path            text not null unique,
  company_id      uuid not null references public.companies(id) on delete cascade,
  organization_id uuid references public.studio_organizations(id) on delete cascade,
  brand_id        uuid references public.studio_brand_profiles(id) on delete set null,
  brand_mode      text not null default 'perfil',
  brand_name      text,
  filename        text,
  mime            text,
  size_bytes      bigint,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.studio_reference_assets is
  'Cada arquivo anexado como ativo, com a marca que o enviou. Existe para uma pergunta so: este ativo e desta marca? Ativo registrado em OUTRA marca bloqueia a geracao.';

create index if not exists studio_ref_assets_por_marca on public.studio_reference_assets (brand_id);
create index if not exists studio_ref_assets_por_org   on public.studio_reference_assets (organization_id);

alter table public.studio_reference_assets enable row level security;

drop policy if exists studio_ref_assets_tenant on public.studio_reference_assets;
create policy studio_ref_assets_tenant on public.studio_reference_assets
  for all to authenticated
  using (public.is_admin() or organization_id = any(public.my_studio_orgs()))
  with check (public.is_admin() or organization_id = any(public.my_studio_orgs()));

-- ---------------------------------------------------------------------
-- 3. Unicidade que atravessa clientes
-- ---------------------------------------------------------------------
-- "A peça criada para o cliente A não pode ser criada para o cliente B."
-- Isso exige memória ENTRE organizações, o que normalmente seria vazamento.
-- Por isso a tabela guarda hash, e só hash: dá para responder "esta frase já
-- existe" sem conseguir ler a frase nem saber de quem ela era.
--
-- organization_id fica para podermos apagar o rastro de um cliente que sair,
-- e é legível apenas pelo administrador da plataforma.
create table if not exists public.studio_content_fingerprints (
  id              uuid primary key default gen_random_uuid(),
  headline_hash   text not null,
  structure_hash  text,
  organization_id uuid references public.studio_organizations(id) on delete cascade,
  generation_id   uuid references public.studio_generations(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table public.studio_content_fingerprints is
  'Hash das frases e estruturas ja entregues, em TODOS os clientes. Guarda hash e nunca o texto: responde "isto ja existe" sem revelar o que e nem de quem era.';

-- É o índice que faz a regra existir: a mesma frase não entra duas vezes,
-- nem no mesmo cliente nem em outro.
create unique index if not exists studio_fingerprint_headline_unica
  on public.studio_content_fingerprints (headline_hash);

alter table public.studio_content_fingerprints enable row level security;

-- Cross-tenant por natureza: só a plataforma lê. O cliente nunca precisa
-- ver esta tabela — ele só sente o efeito, que é nunca receber repetido.
drop policy if exists studio_fingerprints_admin on public.studio_content_fingerprints;
create policy studio_fingerprints_admin on public.studio_content_fingerprints
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
