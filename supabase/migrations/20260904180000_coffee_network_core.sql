-- =====================================================================
-- COFICO Coffee Network — núcleo do Vertical Slice 001 (04/09/2026)
--
-- Fase E: modelo de identidade da rede.
-- Fase F: oferta, moderação, solicitação de compra, match e contact shield.
-- Fase G: trilha de auditoria.
--
-- DECISÃO DE NEGÓCIO QUE ESTE SCHEMA IMPÕE:
--   Cadastro na rede NÃO é cadastro de cliente. A identidade na rede
--   (network_entities) é independente de qualquer relação comercial.
--   A relação comercial (commercial_accounts) é SEMPRE por empresa, e nunca
--   é criada automaticamente. Converter em cliente cria uma relação nova
--   apontando para a mesma identidade — não duplica o cadastro.
--
--   companies continua representando as empresas INTERNAS do ecossistema
--   (Saporino, Fazendinha, COFICO). Participante externo nunca vira company.
--   Tropeiro Paulista e Café Serrão são MARCAS da Saporino, não empresas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IDENTIDADE DA REDE
-- ---------------------------------------------------------------------

create table if not exists public.network_entities (
  id                uuid primary key default gen_random_uuid(),
  entity_type       text not null check (entity_type in ('person','organization')),
  legal_name        text not null,
  display_name      text,
  document_type     text check (document_type in ('cpf','cnpj')),
  document_number   text,
  email             text,
  phone             text,
  whatsapp          text,
  cep               text,
  logradouro        text,
  numero            text,
  complemento       text,
  bairro            text,
  municipio         text,
  uf                text check (uf is null or char_length(uf) = 2),
  lat               double precision,
  lng               double precision,
  -- Verificação é do cadastro (dado confere), NÃO é KYC. KYC não está neste ciclo.
  status            text not null default 'pending'
                    check (status in ('pending','verified','suspended','rejected')),
  verified_at       timestamptz,
  verified_by       uuid references auth.users(id),
  -- Preenchido quando o participante tem login no sistema. Pode ficar nulo:
  -- a COFICO cadastra participante que ainda não acessa nada.
  user_id           uuid references auth.users(id),
  internal_notes    text,
  created_by        uuid references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists network_entities_document_uidx
  on public.network_entities (document_type, document_number)
  where document_number is not null;
create index if not exists network_entities_user_idx on public.network_entities (user_id);
create index if not exists network_entities_uf_idx   on public.network_entities (uf);

comment on table public.network_entities is
  'Identidade canônica de um participante do Coffee Network (pessoa ou organização). Estar aqui NÃO significa ser cliente de nenhuma empresa.';

-- Vocabulário de papéis: tabela, não enum, para poder crescer sem migration de tipo.
create table if not exists public.network_roles (
  code        text primary key,
  label       text not null,
  description text,
  sort_order  int not null default 0
);

insert into public.network_roles (code, label, description, sort_order) values
  ('produtor',       'Produtor',       'Produz café na propriedade rural',                     10),
  ('propriedade',    'Propriedade',    'Fazenda ou sítio; origem física do café',              20),
  ('comprador',      'Comprador',      'Compra café verde para uso próprio ou revenda',        30),
  ('torrefacao',     'Torrefação',     'Torra café; compra verde e vende torrado',             40),
  ('comerciante',    'Comerciante',    'Intermedia compra e venda de café',                    50),
  ('exportador',     'Exportador',     'Exporta café',                                         60),
  ('fornecedor',     'Fornecedor',     'Fornece insumos, embalagem ou serviço à cadeia',       70),
  ('prestador',      'Prestador',      'Presta serviço (torra, armazenagem, classificação)',   80),
  ('transportadora', 'Transportadora', 'Transporta carga',                                     90),
  ('anunciante',     'Anunciante',     'Anuncia produto ou serviço na rede',                  100),
  ('representante',  'Representante',  'Representa comercialmente uma empresa do ecossistema',110)
on conflict (code) do nothing;

-- Um participante pode acumular papéis.
create table if not exists public.network_entity_roles (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.network_entities(id) on delete cascade,
  role_code   text not null references public.network_roles(code),
  status      text not null default 'active' check (status in ('active','suspended')),
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id) default auth.uid(),
  unique (entity_id, role_code)
);
create index if not exists network_entity_roles_entity_idx on public.network_entity_roles (entity_id);

-- Propriedade / origem física.
create table if not exists public.network_properties (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references public.network_entities(id) on delete cascade,
  name          text not null,
  municipio     text,
  uf            text check (uf is null or char_length(uf) = 2),
  region_label  text,
  lat           double precision,
  lng           double precision,
  altitude_m    int,
  area_ha       numeric(10,2),
  notes         text,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists network_properties_entity_idx on public.network_properties (entity_id);

-- ---------------------------------------------------------------------
-- 2. RELAÇÃO COMERCIAL (a "conversão em cliente")
-- ---------------------------------------------------------------------
--
-- Dados de identidade (nome, documento, endereço, contato) NÃO são copiados:
-- ficam em network_entities e são lidos por join.
-- Dados comerciais são SEMPRE por empresa e nunca herdados de outra empresa.

create table if not exists public.commercial_accounts (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references public.network_entities(id) on delete restrict,
  company_id          uuid not null references public.companies(id) on delete restrict,
  relationship_type   text not null default 'cliente'
                      check (relationship_type in ('cliente','fornecedor','prestador','transportadora')),
  status              text not null default 'active'
                      check (status in ('active','suspended','closed')),

  -- ---- dados comerciais: independentes por empresa ----
  price_segment       text,
  payment_method      text,
  payment_term        text,
  credit_limit        numeric(12,2),
  credit_score        int,
  discount_pct        numeric(5,2),
  bonificacao_padrao  numeric(12,2),
  commission_override_pct numeric(5,2),
  assigned_representative_id uuid references public.representatives(id),
  confidential_notes  text,

  -- Ponte opcional para o cadastro legado do RepCo, quando o mesmo participante
  -- já existia como cliente de representante. Não duplica: aponta.
  representative_client_id uuid references public.representative_clients(id),

  opened_at           timestamptz not null default now(),
  opened_by           uuid references auth.users(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (entity_id, company_id, relationship_type)
);
create index if not exists commercial_accounts_entity_idx  on public.commercial_accounts (entity_id);
create index if not exists commercial_accounts_company_idx on public.commercial_accounts (company_id);

comment on table public.commercial_accounts is
  'Relação comercial entre um participante da rede e UMA empresa interna. Condição comercial nunca é copiada de outra empresa.';

-- ---------------------------------------------------------------------
-- 3. OFERTA DE CAFÉ (Fase F1) + FOTOS (F2)
-- ---------------------------------------------------------------------

-- Classificação de bebida com ordem, para o match poder comparar "pelo menos mole".
create table if not exists public.coffee_bebida_scale (
  code     text primary key,
  label    text not null,
  ordinal  int  not null unique
);
insert into public.coffee_bebida_scale (code, label, ordinal) values
  ('estritamente_mole','Estritamente mole', 7),
  ('mole',             'Mole',              6),
  ('apenas_mole',      'Apenas mole',       5),
  ('duro',             'Duro',              4),
  ('riado',            'Riado',             3),
  ('rio',              'Rio',               2),
  ('rio_zona',         'Rio zona',          1)
on conflict (code) do nothing;

create table if not exists public.coffee_offers (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references public.network_entities(id) on delete restrict,
  property_id       uuid references public.network_properties(id) on delete set null,

  species           text not null check (species in ('arabica','conilon')),
  harvest_year      int,
  quantity_bags     numeric(10,2) not null check (quantity_bags > 0),
  bag_weight_kg     numeric(6,2) not null default 60,

  bebida            text references public.coffee_bebida_scale(code),
  screen_min        int,
  screen_note       text,
  process           text check (process in ('natural','cd','lavado','despolpado','semi_lavado')),
  moisture_pct      numeric(4,1),
  defect_type       int,
  sca_score         numeric(4,1),
  certifications    text[] not null default '{}',
  sensory_notes     text,

  asking_price_brl_bag numeric(12,2),
  price_note        text,

  origin_municipio  text,
  origin_uf         text check (origin_uf is null or char_length(origin_uf) = 2),
  region_label      text,

  available_from    date,
  available_until   date,

  status            text not null default 'draft' check (status in (
                      'draft','pending_review','approved','active','paused',
                      'matched','negotiating','sold','expired','rejected')),

  -- Janela de exclusividade de 24h (Fase F3). Sem multa: é compromisso e auditoria.
  exclusive_until   timestamptz,
  published_at      timestamptz,

  sold_externally   boolean not null default false,
  sold_at           timestamptz,
  sold_note         text,

  moderation_note   text,
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,

  created_by        uuid references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists coffee_offers_status_idx  on public.coffee_offers (status);
create index if not exists coffee_offers_entity_idx  on public.coffee_offers (entity_id);
create index if not exists coffee_offers_species_idx on public.coffee_offers (species, status);

create table if not exists public.coffee_offer_photos (
  id                uuid primary key default gen_random_uuid(),
  offer_id          uuid not null references public.coffee_offers(id) on delete cascade,
  storage_path      text not null,
  kind              text,
  -- Toda foto passa por gate humano da COFICO antes de aparecer para o comprador.
  -- A arquitetura já prevê detecção futura de telefone/e-mail/QR/endereço na imagem,
  -- mas NENHUMA visão computacional foi implementada neste ciclo.
  moderation_status text not null default 'pending'
                    check (moderation_status in ('pending','approved','rejected')),
  moderation_note   text,
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  uploaded_by       uuid references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now()
);
create index if not exists coffee_offer_photos_offer_idx on public.coffee_offer_photos (offer_id);

-- ---------------------------------------------------------------------
-- 4. SOLICITAÇÃO DE COMPRA (Fase F4)
-- ---------------------------------------------------------------------
-- Campos desenhados para ARÁBICA comercial/especial. Café de escolha
-- (Conilon/Robusta) tem ficha própria e NÃO usa este template — a coluna
-- species existe para o match não cruzar espécies, não para reaproveitar ficha.

create table if not exists public.coffee_purchase_requests (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references public.network_entities(id) on delete restrict,

  species               text not null default 'arabica' check (species in ('arabica','conilon')),
  harvest_year          int,
  quantity_bags         numeric(10,2) not null check (quantity_bags > 0),

  bebida_min            text references public.coffee_bebida_scale(code),
  screen_min            int,
  process_accepted      text[] not null default '{}',
  moisture_max          numeric(4,1),
  defect_type_max       int,
  sca_min               numeric(4,1),
  sensory_notes         text,
  certifications_required text[] not null default '{}',

  target_price_min      numeric(12,2),
  target_price_max      numeric(12,2),

  origin_uf             text check (origin_uf is null or char_length(origin_uf) = 2),
  origin_region_label   text,
  destination_uf        text check (destination_uf is null or char_length(destination_uf) = 2),
  destination_municipio text,

  delivery_window_start date,
  delivery_window_end   date,
  freight_terms         text check (freight_terms in ('cif','fob','a_combinar')),
  sample_required       boolean not null default false,

  notes                 text,
  status                text not null default 'draft'
                        check (status in ('draft','active','paused','matched','closed','expired')),

  created_by            uuid references auth.users(id) default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists coffee_requests_status_idx on public.coffee_purchase_requests (status);
create index if not exists coffee_requests_entity_idx on public.coffee_purchase_requests (entity_id);

-- ---------------------------------------------------------------------
-- 5. MATCH (Fase F5)
-- ---------------------------------------------------------------------

create table if not exists public.coffee_matches (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.coffee_offers(id) on delete cascade,
  request_id   uuid not null references public.coffee_purchase_requests(id) on delete cascade,
  score        numeric(5,2) not null,
  factors      jsonb not null default '{}'::jsonb,
  status       text not null default 'suggested'
               check (status in ('suggested','shortlisted','contacted','negotiating','closed','discarded')),
  computed_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (offer_id, request_id)
);
create index if not exists coffee_matches_request_idx on public.coffee_matches (request_id, score desc);
create index if not exists coffee_matches_offer_idx   on public.coffee_matches (offer_id, score desc);

-- ---------------------------------------------------------------------
-- 6. AUDITORIA (Fase G)
-- ---------------------------------------------------------------------

create table if not exists public.network_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references auth.users(id) default auth.uid(),
  action          text not null,
  entity_table    text not null,
  entity_id       uuid,
  previous_state  jsonb,
  new_state       jsonb,
  reason          text,
  created_at      timestamptz not null default now()
);
create index if not exists network_audit_entity_idx on public.network_audit_log (entity_table, entity_id, created_at desc);

comment on table public.network_audit_log is
  'Trilha de auditoria do Coffee Network: ator, ação, estado anterior e novo. Política de retenção legal ainda NÃO definida (depende de revisão jurídica).';
