-- Coffee LiVRE — Unidade 8: carrinho multiloja, checkout, pedido e reserva de estoque.
--
-- MODELO
--   carrinho (lv_carts, lv_cart_items)            o que o comprador escolheu
--   checkout (lv_checkouts)                       a tentativa de compra, com reserva por tempo limitado
--   pedido pai (lv_orders)                        a compra do comprador: 1 número, 1 total, 1 pagamento
--   subpedido (lv_seller_orders)                  a parte de cada vendedor: itens, frete, repasse
--   item (lv_order_items)                         SNAPSHOT do produto, preço, escada, política e piso
--   endereço (lv_order_addresses)                 cópia do endereço no momento da compra
--   reserva (lv_stock_reservations)               quanto de qual LOTE ficou separado, e até quando
--   pagamento (lv_payments, lv_payment_events)    estrutura e idempotência; nenhum dinheiro real
--   entrega (lv_shipments)                        uma por subpedido; nenhuma transportadora real
--   reembolso (lv_refunds)                        só modelagem
--   eventos (lv_order_events)                     histórico para suporte
--
-- REGRAS QUE O BANCO GARANTE (não o navegador)
--   • Ninguém escreve direto nessas tabelas. Comprador, vendedor e admin só LEEM
--     (RLS); toda escrita passa por função SECURITY DEFINER que confere quem chama.
--   • Estoque: reserva move qtd_disponivel → qtd_reservada no lote, com
--     SELECT … FOR UPDATE, em ordem FEFO (validade mais próxima primeiro; vencido
--     nunca). O CHECK >= 0 do lote torna overselling impossível.
--   • Preço: o banco recalcula a escada (lv_unitario_na_quantidade, a mesma regra
--     de escada.ts). Diferença entre o que o comprador viu e o preço atual volta
--     como divergência antes de confirmar; nunca muda em silêncio.
--   • Estados: transição inválida é recusada por trigger, para qualquer papel.
--   • Idempotência: confirmar o mesmo checkout devolve o mesmo pedido; o mesmo
--     evento de pagamento (provedor + chave) só produz efeito uma vez.
--   • Dinheiro sempre em centavos inteiros. Custo desconhecido fica NULO, nunca zero.

-- =====================================================================
-- 0. Configuração (editável sem migration)
-- =====================================================================
insert into public.lv_settings (key, value) values
  ('checkout', jsonb_build_object(
     'reserva_minutos', 15,          -- quanto o estoque fica separado enquanto o comprador preenche o checkout
     'pagamento_minutos', 30,        -- quanto o pedido espera pagamento antes de cancelar e devolver o estoque
     'carrinho_dias', 7,             -- depois disso o carrinho aberto é considerado abandonado
     'plano_padrao', 'zero',         -- plano usado na política comercial de vendedor sem plano definido
     'quantidade_maxima_por_item', 99)),
  ('frete_demo', jsonb_build_object(
     'provedor', 'demo',
     'observacao', 'Tabela FICTÍCIA de demonstração. Não é cotação de transportadora real.',
     'opcoes', jsonb_build_array(
       jsonb_build_object('codigo', 'demo_economico', 'transportadora', 'Transportadora Demonstração A', 'servico', 'Econômico', 'base_cents', 1290, 'por_kg_cents', 250, 'prazo_dias', 8),
       jsonb_build_object('codigo', 'demo_padrao',    'transportadora', 'Transportadora Demonstração C', 'servico', 'Padrão',    'base_cents', 1590, 'por_kg_cents', 180, 'prazo_dias', 5),
       jsonb_build_object('codigo', 'demo_expresso',  'transportadora', 'Transportadora Demonstração B', 'servico', 'Expresso',  'base_cents', 2190, 'por_kg_cents', 450, 'prazo_dias', 3))))
on conflict (key) do nothing;

-- Plano do vendedor: define a comissão congelada em cada pedido. Só admin muda
-- (o vendedor tem apenas SELECT em lv_sellers).
alter table public.lv_sellers add column if not exists plan_id uuid references public.lv_plans(id) on delete set null;
comment on column public.lv_sellers.plan_id is
  'Plano comercial do vendedor. Nulo = plano_padrao de lv_settings.checkout. O pedido congela a politica no momento da compra.';

create sequence if not exists public.lv_pedido_numero_seq start 1001;

-- =====================================================================
-- 1. Tabelas
-- =====================================================================
create table if not exists public.lv_carts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  status         text not null default 'aberto'
                 check (status in ('aberto', 'em_checkout', 'convertido', 'abandonado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expira_em      timestamptz,
  convertido_em  timestamptz,
  order_id       uuid
);
create index if not exists lv_carts_por_usuario on public.lv_carts (user_id, status);

create table if not exists public.lv_cart_items (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid not null references public.lv_carts(id) on delete cascade,
  variant_id         uuid not null references public.lv_product_variants(id) on delete cascade,
  quantidade         integer not null check (quantidade between 1 and 999),
  -- O que o comprador viu na tela, e o que o banco calculou ao abrir o checkout.
  unitario_visto_cents bigint,
  unitario_cents     bigint not null check (unitario_cents >= 0),
  created_at         timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table if not exists public.lv_checkouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cart_id     uuid not null references public.lv_carts(id) on delete cascade,
  chave       text not null check (length(chave) between 8 and 80),
  status      text not null default 'aberto' check (status in ('aberto', 'convertido', 'expirado', 'cancelado')),
  expira_em   timestamptz not null,
  divergencias jsonb not null default '[]'::jsonb,
  order_id    uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, chave)
);
create index if not exists lv_checkouts_abertos on public.lv_checkouts (status, expira_em);

create table if not exists public.lv_orders (
  id                        uuid primary key default gen_random_uuid(),
  numero                    text not null unique,
  user_id                   uuid references auth.users(id) on delete set null,
  checkout_id               uuid unique references public.lv_checkouts(id) on delete set null,
  status                    text not null default 'aguardando_pagamento'
                            check (status in ('aguardando_pagamento', 'pago', 'em_processamento', 'parcialmente_enviado',
                                              'enviado', 'entregue', 'cancelado', 'reembolsado')),
  pagamento_status          text not null default 'aguardando_pagamento',
  pagamento_metodo          text not null check (pagamento_metodo in ('pix', 'cartao', 'boleto')),
  comprador_nome            text not null,
  comprador_email           text not null,
  comprador_telefone        text,
  comprador_cpf             text check (comprador_cpf is null or comprador_cpf ~ '^\d{11}$'),
  subtotal_produtos_cents   bigint not null check (subtotal_produtos_cents >= 0),
  desconto_produtos_cents   bigint not null default 0 check (desconto_produtos_cents >= 0),
  frete_cents               bigint not null default 0 check (frete_cents >= 0),
  desconto_frete_cents      bigint not null default 0 check (desconto_frete_cents >= 0),
  total_cents               bigint not null check (total_cents >= 0),
  -- Nulo = custo não disponível na política (nunca vira zero).
  comissao_plataforma_cents bigint,
  tarifa_operacional_cents  bigint,
  taxa_pagamento_cents      bigint,
  repasse_sellers_cents     bigint,
  reembolsado_cents         bigint not null default 0 check (reembolsado_cents >= 0),
  outros_cents              bigint not null default 0,
  fiscal                    jsonb not null default '{}'::jsonb,
  is_demo                   boolean not null default false,
  pago_em                   timestamptz,
  cancelado_em              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint lv_orders_total_confere
    check (total_cents = subtotal_produtos_cents - desconto_produtos_cents + frete_cents - desconto_frete_cents)
);
create index if not exists lv_orders_por_usuario on public.lv_orders (user_id, created_at desc);
comment on table public.lv_orders is
  'Pedido PAI: a compra do comprador (um numero, um total, um pagamento). Cada vendedor opera o seu lv_seller_orders.';

alter table public.lv_carts drop constraint if exists lv_carts_order_fk;
alter table public.lv_carts add constraint lv_carts_order_fk foreign key (order_id) references public.lv_orders(id) on delete set null;
alter table public.lv_checkouts drop constraint if exists lv_checkouts_order_fk;
alter table public.lv_checkouts add constraint lv_checkouts_order_fk foreign key (order_id) references public.lv_orders(id) on delete set null;

create table if not exists public.lv_seller_orders (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.lv_orders(id) on delete cascade,
  numero                    text not null unique,
  seller_id                 uuid references public.lv_sellers(id) on delete set null,
  store_id                  uuid references public.lv_stores(id) on delete set null,
  seller_nome               text not null,
  loja_nome                 text not null,
  loja_slug                 text,
  status                    text not null default 'aguardando_pagamento'
                            check (status in ('aguardando_pagamento', 'confirmado', 'separacao', 'pronto_para_envio',
                                              'enviado', 'entregue', 'cancelado')),
  subtotal_produtos_cents   bigint not null check (subtotal_produtos_cents >= 0),
  desconto_produtos_cents   bigint not null default 0,
  frete_cents               bigint not null default 0,
  desconto_frete_cents      bigint not null default 0,
  total_cents               bigint not null,
  comissao_plataforma_cents bigint,
  tarifa_operacional_cents  bigint,
  taxa_pagamento_cents      bigint,
  repasse_seller_cents      bigint,
  reembolsado_cents         bigint not null default 0,
  politica_comercial        jsonb not null,
  politica_completa         boolean not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint lv_seller_orders_total_confere
    check (total_cents = subtotal_produtos_cents - desconto_produtos_cents + frete_cents - desconto_frete_cents)
);
create index if not exists lv_seller_orders_por_pedido on public.lv_seller_orders (order_id);
create index if not exists lv_seller_orders_por_vendedor on public.lv_seller_orders (seller_id, created_at desc);
comment on table public.lv_seller_orders is
  'Subpedido de UM vendedor dentro do pedido pai. O vendedor ve so os seus e so muda status operacional.';

create table if not exists public.lv_order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.lv_orders(id) on delete cascade,
  seller_order_id           uuid not null references public.lv_seller_orders(id) on delete cascade,
  seller_id                 uuid references public.lv_sellers(id) on delete set null,
  product_id                uuid references public.lv_products(id) on delete set null,
  variant_id                uuid references public.lv_product_variants(id) on delete set null,
  -- Snapshot: o pedido não depende de o catálogo continuar igual.
  titulo                    text not null,
  marca                     text,
  variante_nome             text,
  gramatura_g               integer,
  sku                       text,
  ean                       text,
  loja_nome                 text not null,
  quantidade                integer not null check (quantidade > 0),
  preco_cheio_cents         bigint not null check (preco_cheio_cents >= 0),
  unitario_cents            bigint not null check (unitario_cents >= 0),
  desconto_cents            bigint not null default 0 check (desconto_cents >= 0),
  total_cents               bigint not null check (total_cents >= 0),
  faixa_min_qty             integer,
  comissao_bps              integer,
  comissao_cents            bigint,
  tarifa_unidade_cents      bigint,
  tarifa_operacional_cents  bigint,
  pagamento_bps             integer,
  taxa_pagamento_cents      bigint,
  liquido_estimado_cents    bigint,
  piso_cents                bigint,
  distancia_piso_cents      bigint,
  lotes                     jsonb not null default '[]'::jsonb,
  fiscal                    jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  constraint lv_order_items_total_confere check (total_cents = unitario_cents * quantidade),
  constraint lv_order_items_desconto_confere check (desconto_cents = (preco_cheio_cents - unitario_cents) * quantidade)
);
create index if not exists lv_order_items_por_subpedido on public.lv_order_items (seller_order_id);
create index if not exists lv_order_items_por_pedido on public.lv_order_items (order_id);

create table if not exists public.lv_order_addresses (
  order_id      uuid primary key references public.lv_orders(id) on delete cascade,
  destinatario  text not null,
  cep           text not null check (cep ~ '^\d{8}$'),
  logradouro    text not null,
  numero        text not null,
  complemento   text,
  bairro        text not null,
  cidade        text not null,
  uf            text not null check (uf ~ '^[A-Z]{2}$'),
  referencia    text,
  created_at    timestamptz not null default now()
);

create table if not exists public.lv_stock_reservations (
  id               uuid primary key default gen_random_uuid(),
  checkout_id      uuid references public.lv_checkouts(id) on delete set null,
  order_id         uuid references public.lv_orders(id) on delete cascade,
  seller_order_id  uuid references public.lv_seller_orders(id) on delete set null,
  order_item_id    uuid references public.lv_order_items(id) on delete set null,
  seller_id        uuid references public.lv_sellers(id) on delete set null,
  variant_id       uuid references public.lv_product_variants(id) on delete set null,
  lot_id           uuid references public.lv_inventory_lots(id) on delete set null,
  lote             text,
  validade         date,
  quantidade       integer not null check (quantidade > 0),
  status           text not null default 'ativa'
                   check (status in ('ativa', 'confirmada', 'liberada', 'expirada', 'devolvida')),
  expira_em        timestamptz not null,
  motivo           text,
  created_at       timestamptz not null default now(),
  encerrada_em     timestamptz
);
create index if not exists lv_stock_reservations_ativas on public.lv_stock_reservations (status, expira_em);
create index if not exists lv_stock_reservations_por_checkout on public.lv_stock_reservations (checkout_id);
create index if not exists lv_stock_reservations_por_pedido on public.lv_stock_reservations (order_id);

create table if not exists public.lv_payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null unique references public.lv_orders(id) on delete cascade,
  provedor              text not null default 'simulado',
  metodo                text not null check (metodo in ('pix', 'cartao', 'boleto')),
  status                text not null default 'aguardando_pagamento'
                        check (status in ('pendente', 'aguardando_pagamento', 'aprovado', 'recusado', 'cancelado',
                                          'reembolsado', 'parcialmente_reembolsado')),
  valor_cents           bigint not null check (valor_cents >= 0),
  valor_reembolsado_cents bigint not null default 0,
  external_payment_id   text,
  preference_id         text,
  split                 jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Idempotência de eventos de pagamento: o mesmo aviso do provedor (webhook
-- repetido) é gravado uma vez e só produz efeito uma vez.
create table if not exists public.lv_payment_events (
  id               uuid primary key default gen_random_uuid(),
  provedor         text not null,
  idempotency_key  text not null,
  payment_id       uuid references public.lv_payments(id) on delete cascade,
  order_id         uuid references public.lv_orders(id) on delete cascade,
  status           text not null,
  payload          jsonb not null default '{}'::jsonb,
  recebido_em      timestamptz not null default now(),
  unique (provedor, idempotency_key)
);

create table if not exists public.lv_shipments (
  id               uuid primary key default gen_random_uuid(),
  seller_order_id  uuid not null unique references public.lv_seller_orders(id) on delete cascade,
  order_id         uuid not null references public.lv_orders(id) on delete cascade,
  provedor         text not null,
  codigo_servico   text not null,
  transportadora   text not null,
  servico          text not null,
  prazo_dias       integer,
  peso_g           integer,
  frete_cents      bigint not null check (frete_cents >= 0),
  origem           text not null default 'CD Coffee LiVRE',
  status           text not null default 'pendente'
                   check (status in ('pendente', 'em_preparo', 'enviado', 'entregue', 'cancelado')),
  codigo_rastreio  text,
  cotacao          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.lv_refunds (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.lv_orders(id) on delete cascade,
  seller_order_id  uuid references public.lv_seller_orders(id) on delete set null,
  tipo             text not null check (tipo in ('total', 'parcial')),
  valor_cents      bigint not null check (valor_cents >= 0),
  motivo           text not null,
  status           text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'concluido')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.lv_order_events (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.lv_orders(id) on delete cascade,
  seller_order_id  uuid references public.lv_seller_orders(id) on delete cascade,
  tipo             text not null,
  origem           text not null check (origem in ('comprador', 'vendedor', 'admin', 'sistema', 'pagamento')),
  user_id          uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists lv_order_events_por_pedido on public.lv_order_events (order_id, created_at);

-- =====================================================================
-- 2. Máquina de estados (mesma tabela de checkout/estados.ts)
-- =====================================================================
create or replace function public.lv_transicao_pedido_valida(p_de text, p_para text)
returns boolean language sql immutable as $$
  select (p_de, p_para) in (
    ('aguardando_pagamento', 'pago'), ('aguardando_pagamento', 'cancelado'),
    ('pago', 'em_processamento'), ('pago', 'cancelado'),
    ('em_processamento', 'parcialmente_enviado'), ('em_processamento', 'enviado'), ('em_processamento', 'cancelado'),
    ('parcialmente_enviado', 'enviado'), ('parcialmente_enviado', 'entregue'),
    ('enviado', 'entregue'),
    ('entregue', 'reembolsado'), ('cancelado', 'reembolsado'));
$$;

create or replace function public.lv_transicao_subpedido_valida(p_de text, p_para text)
returns boolean language sql immutable as $$
  select (p_de, p_para) in (
    ('aguardando_pagamento', 'confirmado'), ('aguardando_pagamento', 'cancelado'),
    ('confirmado', 'separacao'), ('confirmado', 'cancelado'),
    ('separacao', 'pronto_para_envio'), ('separacao', 'cancelado'),
    ('pronto_para_envio', 'enviado'), ('pronto_para_envio', 'cancelado'),
    ('enviado', 'entregue'));
$$;

create or replace function public.lv_transicao_pagamento_valida(p_de text, p_para text)
returns boolean language sql immutable as $$
  select (p_de, p_para) in (
    ('pendente', 'aguardando_pagamento'), ('pendente', 'cancelado'),
    ('aguardando_pagamento', 'aprovado'), ('aguardando_pagamento', 'recusado'), ('aguardando_pagamento', 'cancelado'),
    ('recusado', 'aguardando_pagamento'), ('recusado', 'aprovado'), ('recusado', 'cancelado'),
    ('aprovado', 'parcialmente_reembolsado'), ('aprovado', 'reembolsado'),
    ('parcialmente_reembolsado', 'reembolsado'));
$$;

create or replace function public.lv_guarda_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if (tg_table_name = 'lv_orders' and not public.lv_transicao_pedido_valida(old.status, new.status))
       or (tg_table_name = 'lv_seller_orders' and not public.lv_transicao_subpedido_valida(old.status, new.status))
       or (tg_table_name = 'lv_payments' and not public.lv_transicao_pagamento_valida(old.status, new.status)) then
      raise exception 'Mudança de status inválida: % → %.', old.status, new.status
        using errcode = 'P0001', hint = 'STATUS_INVALIDO';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lv_guarda_status on public.lv_orders;
create trigger lv_guarda_status before update on public.lv_orders for each row execute function public.lv_guarda_status();
drop trigger if exists lv_guarda_status on public.lv_seller_orders;
create trigger lv_guarda_status before update on public.lv_seller_orders for each row execute function public.lv_guarda_status();
drop trigger if exists lv_guarda_status on public.lv_payments;
create trigger lv_guarda_status before update on public.lv_payments for each row execute function public.lv_guarda_status();

-- Dinheiro congelado: depois de criado, nenhum valor financeiro do pedido muda
-- por UPDATE comum. Reembolso futuro altera reembolsado_cents por função própria.
create or replace function public.lv_guarda_financeiro()
returns trigger language plpgsql as $$
begin
  if (new.subtotal_produtos_cents, new.desconto_produtos_cents, new.frete_cents, new.desconto_frete_cents, new.total_cents,
      new.comissao_plataforma_cents, new.tarifa_operacional_cents, new.taxa_pagamento_cents)
     is distinct from
     (old.subtotal_produtos_cents, old.desconto_produtos_cents, old.frete_cents, old.desconto_frete_cents, old.total_cents,
      old.comissao_plataforma_cents, old.tarifa_operacional_cents, old.taxa_pagamento_cents) then
    raise exception 'Valores do pedido são congelados na compra e não podem ser alterados.'
      using errcode = 'P0001', hint = 'FINANCEIRO_CONGELADO';
  end if;
  return new;
end $$;

drop trigger if exists lv_guarda_financeiro on public.lv_orders;
create trigger lv_guarda_financeiro before update on public.lv_orders for each row execute function public.lv_guarda_financeiro();
drop trigger if exists lv_guarda_financeiro on public.lv_seller_orders;
create trigger lv_guarda_financeiro before update on public.lv_seller_orders for each row execute function public.lv_guarda_financeiro();

-- =====================================================================
-- 3. Cálculo: escada, política comercial, frete
-- =====================================================================
-- Mesma regra de escada.ts (unitarioNaQuantidade): vale a maior faixa alcançada;
-- percentual arredonda meio-para-cima; nunca abaixo de zero nem acima do cheio.
create or replace function public.lv_unitario_na_quantidade(p_preco bigint, p_product uuid, p_qtd integer)
returns table (unitario_cents bigint, faixa_min_qty integer)
language sql stable security definer set search_path = public as $$
  with faixa as (
    select t.min_qty, t.tipo, t.valor
      from public.lv_price_tiers t join public.lv_products p on p.id = t.product_id
     where t.product_id = p_product and p.venda_por_quantidade and t.min_qty <= p_qtd
     order by t.min_qty desc limit 1)
  select coalesce((select greatest(0, least(p_preco,
                     case when f.tipo = 'percentual' then p_preco - round((p_preco * f.valor)::numeric / 10000)::bigint
                          else p_preco - f.valor end)) from faixa f), p_preco),
         (select f.min_qty from faixa f);
$$;

create or replace function public.lv_aplicar_bps(p_cents bigint, p_bps integer)
returns bigint language sql immutable as $$
  select case when p_bps is null then null else (p_cents * p_bps + 5000) / 10000 end;
$$;

-- Mesma escolha de regra da Calculadora (economia.ts / calcularPedido): plataforma
-- coffeelivre, regra da modalidade vence a geral, faixa de preço sobre a venda,
-- peso com mínimo exclusivo e máximo inclusivo.
create or replace function public.lv_regra_livre(
  p_modalidade text, p_componente text, p_cenario text, p_venda bigint, p_gramatura integer, p_peso_envio integer)
returns table (id uuid, percentual_bps integer, valor_cents bigint, minimo_cents bigint, rotulo text, natureza text)
language sql stable security definer set search_path = public as $$
  select t.id, t.percentual_bps, t.valor_cents, t.minimo_cents, t.rotulo, t.natureza
    from public.lv_tarifas_simulacao t
   where t.plataforma = 'coffeelivre' and t.ativo
     and (t.modalidade is null or t.modalidade = p_modalidade)
     and t.componente = p_componente
     and (t.cenario is null or t.cenario = p_cenario)
     and (t.preco_min_cents is null or p_venda >= t.preco_min_cents)
     and (t.preco_max_cents is null or p_venda <= t.preco_max_cents)
     and (t.peso_sobre is null or (
           (t.peso_min_g is null or (case when t.peso_sobre = 'envio' then p_peso_envio else p_gramatura end) > t.peso_min_g)
       and (t.peso_max_g is null or (case when t.peso_sobre = 'envio' then p_peso_envio else p_gramatura end) <= t.peso_max_g)))
   order by (t.modalidade is not null) desc, t.ordem
   limit 1;
$$;

create or replace function public.lv_config_checkout()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.lv_settings where key = 'checkout'), '{}'::jsonb);
$$;

create or replace function public.lv_eh_staging()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ambiente_do_banco where id = 1 and nome = 'staging');
$$;

-- Calcula TUDO de um checkout: itens com snapshot, subpedidos por vendedor, frete
-- da opção escolhida, política comercial e totais. É a única conta: o resumo da
-- tela e a criação do pedido usam esta mesma função.
create or replace function public.lv_calcular_checkout(p_checkout uuid, p_frete text, p_pagamento text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ck        public.lv_checkouts;
  v_cfg       jsonb := public.lv_config_checkout();
  v_frete_cfg jsonb := coalesce((select value from public.lv_settings where key = 'frete_demo'), '{}'::jsonb);
  v_opcao     jsonb;
  v_embalagem integer := coalesce((select valor from public.lv_simulacao_premissas where chave = 'peso_embalagem_g'), 14)::int;
  r           record;
  v_itens     jsonb := '[]'::jsonb;
  v_vend      jsonb := '{}'::jsonb;
  v_div       jsonb := '[]'::jsonb;
  v_sub       jsonb;
  v_lista     jsonb := '[]'::jsonb;
  v_chave     text;
  v_atual     record;
  v_regra_com record;
  v_regra_tar record;
  v_regra_pag record;
  v_cheio     bigint;
  v_total     bigint;
  v_com       bigint;
  v_tar       bigint;
  v_taxa      bigint;
  v_peso      integer;
  v_plano     text;
  v_kg        integer;
  v_frete_v   bigint;
  t_sub bigint := 0; t_desc bigint := 0; t_frete bigint := 0; t_com bigint := 0; t_tar bigint := 0; t_taxa bigint := 0; t_rep bigint := 0;
  t_com_ok boolean := true; t_tar_ok boolean := true; t_taxa_ok boolean := true;
begin
  select * into v_ck from public.lv_checkouts where id = p_checkout;
  if v_ck.id is null then
    raise exception 'Checkout não encontrado.' using errcode = 'P0001', hint = 'CHECKOUT_INEXISTENTE';
  end if;
  if p_frete is not null then
    select o into v_opcao from jsonb_array_elements(v_frete_cfg->'opcoes') o where o->>'codigo' = p_frete;
    if v_opcao is null then
      raise exception 'Opção de entrega inválida.' using errcode = 'P0001', hint = 'FRETE_INVALIDO';
    end if;
  end if;

  for r in
    select ci.id as cart_item_id, ci.quantidade, ci.unitario_cents as unitario_ck, ci.unitario_visto_cents,
           v.id as variant_id, v.nome as variante_nome, v.padrao, v.gramatura_g, v.sku as v_sku, v.ean,
           coalesce(v.preco_cents, p.preco_cents) as preco_atual,
           p.id as product_id, p.titulo, p.marca, p.sku as p_sku, p.peso_g, p.preco_minimo_cents, p.is_demo,
           s.id as store_id, s.nome as loja_nome, s.slug as loja_slug,
           se.id as seller_id, se.nome_fantasia as seller_nome,
           coalesce((select pl.slug from public.lv_plans pl where pl.id = se.plan_id), v_cfg->>'plano_padrao', 'zero') as plano
      from public.lv_cart_items ci
      join public.lv_product_variants v on v.id = ci.variant_id
      join public.lv_products p on p.id = v.product_id
      join public.lv_stores s on s.id = p.store_id
      join public.lv_sellers se on se.id = p.seller_id
     where ci.cart_id = v_ck.cart_id
     order by s.nome, p.titulo, v.ordem
  loop
    select * into v_atual from public.lv_unitario_na_quantidade(r.preco_atual, r.product_id, r.quantidade);
    if v_atual.unitario_cents <> r.unitario_ck then
      v_div := v_div || jsonb_build_object('variant_id', r.variant_id, 'titulo', r.titulo,
        'unitario_cents', r.unitario_ck, 'unitario_atual_cents', v_atual.unitario_cents);
    end if;

    v_cheio := r.preco_atual;
    v_total := r.unitario_ck * r.quantidade;
    v_peso  := r.quantidade * (coalesce(r.gramatura_g, r.peso_g, 500) + v_embalagem);

    select * into v_regra_com from public.lv_regra_livre(r.plano, 'comissao', null, v_total, coalesce(r.gramatura_g, r.peso_g, 500), v_peso);
    select * into v_regra_tar from public.lv_regra_livre(r.plano, 'tarifa_unidade', null, v_total, coalesce(r.gramatura_g, r.peso_g, 500), v_peso);
    select * into v_regra_pag from public.lv_regra_livre(r.plano, 'pagamento', p_pagamento, v_total, coalesce(r.gramatura_g, r.peso_g, 500), v_peso);

    v_com  := case when v_regra_com.percentual_bps is null then null
                   else greatest(public.lv_aplicar_bps(v_total, v_regra_com.percentual_bps), coalesce(v_regra_com.minimo_cents, 0)) end;
    v_tar  := case when v_regra_tar.valor_cents is null then null else v_regra_tar.valor_cents * r.quantidade end;
    v_taxa := case when p_pagamento is null or v_regra_pag.percentual_bps is null then null
                   else public.lv_aplicar_bps(v_total, v_regra_pag.percentual_bps) end;

    -- Preço de catálogo guardado é o cheio ATUAL; se divergiu, a confirmação recusa antes.
    v_itens := v_itens || jsonb_build_object(
      'cart_item_id', r.cart_item_id, 'variant_id', r.variant_id, 'product_id', r.product_id,
      'seller_id', r.seller_id, 'store_id', r.store_id, 'loja_nome', r.loja_nome, 'loja_slug', r.loja_slug,
      'seller_nome', r.seller_nome, 'titulo', r.titulo, 'marca', r.marca,
      'variante_nome', case when r.padrao then null else r.variante_nome end,
      'gramatura_g', coalesce(r.gramatura_g, r.peso_g), 'sku', coalesce(r.v_sku, r.p_sku), 'ean', r.ean,
      'quantidade', r.quantidade, 'preco_cheio_cents', v_cheio, 'unitario_cents', r.unitario_ck,
      'unitario_visto_cents', r.unitario_visto_cents,
      'desconto_cents', greatest(0, (v_cheio - r.unitario_ck) * r.quantidade), 'total_cents', v_total,
      'faixa_min_qty', v_atual.faixa_min_qty,
      'plano', r.plano, 'comissao_bps', v_regra_com.percentual_bps, 'comissao_cents', v_com,
      'tarifa_unidade_cents', v_regra_tar.valor_cents, 'tarifa_operacional_cents', v_tar,
      'pagamento_bps', v_regra_pag.percentual_bps, 'taxa_pagamento_cents', v_taxa,
      'liquido_estimado_cents', case when v_com is null or v_tar is null or v_taxa is null then null
                                     else r.unitario_ck - ((v_com + v_tar + v_taxa) + r.quantidade / 2) / r.quantidade end,
      'piso_cents', r.preco_minimo_cents,
      'distancia_piso_cents', case when r.preco_minimo_cents is null then null else r.unitario_ck - r.preco_minimo_cents end,
      'peso_envio_g', v_peso, 'is_demo', r.is_demo,
      'regras', jsonb_build_object('comissao', v_regra_com.id, 'tarifa_unidade', v_regra_tar.id, 'pagamento', v_regra_pag.id));

    v_chave := r.seller_id::text;
    v_sub := coalesce(v_vend->v_chave, jsonb_build_object(
      'seller_id', r.seller_id, 'store_id', r.store_id, 'seller_nome', r.seller_nome,
      'loja_nome', r.loja_nome, 'loja_slug', r.loja_slug, 'plano', r.plano,
      'subtotal_produtos_cents', 0, 'desconto_produtos_cents', 0, 'unidades', 0, 'peso_g', 0,
      'comissao_plataforma_cents', 0, 'tarifa_operacional_cents', 0, 'taxa_pagamento_cents', 0,
      'comissao_ok', true, 'tarifa_ok', true, 'taxa_ok', true, 'is_demo', true,
      'comissao_bps', v_regra_com.percentual_bps, 'pagamento_bps', v_regra_pag.percentual_bps));
    v_sub := v_sub
      || jsonb_build_object(
        'subtotal_produtos_cents', (v_sub->>'subtotal_produtos_cents')::bigint + v_cheio * r.quantidade,
        'desconto_produtos_cents', (v_sub->>'desconto_produtos_cents')::bigint + greatest(0, (v_cheio - r.unitario_ck) * r.quantidade),
        'unidades', (v_sub->>'unidades')::int + r.quantidade,
        'peso_g', (v_sub->>'peso_g')::int + v_peso,
        'comissao_plataforma_cents', (v_sub->>'comissao_plataforma_cents')::bigint + coalesce(v_com, 0),
        'tarifa_operacional_cents', (v_sub->>'tarifa_operacional_cents')::bigint + coalesce(v_tar, 0),
        'taxa_pagamento_cents', (v_sub->>'taxa_pagamento_cents')::bigint + coalesce(v_taxa, 0),
        'comissao_ok', (v_sub->>'comissao_ok')::boolean and v_com is not null,
        'tarifa_ok', (v_sub->>'tarifa_ok')::boolean and v_tar is not null,
        'taxa_ok', (v_sub->>'taxa_ok')::boolean and v_taxa is not null,
        'is_demo', (v_sub->>'is_demo')::boolean and r.is_demo);
    v_vend := jsonb_set(v_vend, array[v_chave], v_sub);
  end loop;

  if jsonb_array_length(v_itens) = 0 then
    raise exception 'O checkout não tem itens.' using errcode = 'P0001', hint = 'CHECKOUT_VAZIO';
  end if;

  -- Subpedidos: frete por vendedor (cada um despacha o seu), repasse e política.
  for v_sub in select value from jsonb_each(v_vend) order by value->>'loja_nome' loop
    v_kg := greatest(1, ceil((v_sub->>'peso_g')::numeric / 1000))::int;
    v_frete_v := case when v_opcao is null then 0
                      else (v_opcao->>'base_cents')::bigint + (v_opcao->>'por_kg_cents')::bigint * v_kg end;
    v_sub := v_sub || jsonb_build_object(
      'frete_cents', v_frete_v,
      'frete', case when v_opcao is null then null else jsonb_build_object(
        'provedor', coalesce(v_frete_cfg->>'provedor', 'demo'), 'codigo', v_opcao->>'codigo',
        'transportadora', v_opcao->>'transportadora', 'servico', v_opcao->>'servico',
        'prazo_dias', (v_opcao->>'prazo_dias')::int, 'peso_g', (v_sub->>'peso_g')::int, 'kg_cobrados', v_kg) end,
      'desconto_frete_cents', 0,
      'total_cents', (v_sub->>'subtotal_produtos_cents')::bigint - (v_sub->>'desconto_produtos_cents')::bigint + v_frete_v,
      'politica_completa', (v_sub->>'comissao_ok')::boolean and (v_sub->>'tarifa_ok')::boolean and (v_sub->>'taxa_ok')::boolean,
      'repasse_seller_cents', case when (v_sub->>'comissao_ok')::boolean and (v_sub->>'tarifa_ok')::boolean and (v_sub->>'taxa_ok')::boolean
        then (v_sub->>'subtotal_produtos_cents')::bigint - (v_sub->>'desconto_produtos_cents')::bigint
             - (v_sub->>'comissao_plataforma_cents')::bigint - (v_sub->>'tarifa_operacional_cents')::bigint
             - (v_sub->>'taxa_pagamento_cents')::bigint
        else null end);
    v_lista := v_lista || v_sub;
    t_sub := t_sub + (v_sub->>'subtotal_produtos_cents')::bigint;
    t_desc := t_desc + (v_sub->>'desconto_produtos_cents')::bigint;
    t_frete := t_frete + v_frete_v;
    t_com := t_com + (v_sub->>'comissao_plataforma_cents')::bigint;
    t_tar := t_tar + (v_sub->>'tarifa_operacional_cents')::bigint;
    t_taxa := t_taxa + (v_sub->>'taxa_pagamento_cents')::bigint;
    t_com_ok := t_com_ok and (v_sub->>'comissao_ok')::boolean;
    t_tar_ok := t_tar_ok and (v_sub->>'tarifa_ok')::boolean;
    t_taxa_ok := t_taxa_ok and (v_sub->>'taxa_ok')::boolean;
    t_rep := t_rep + coalesce((v_sub->>'repasse_seller_cents')::bigint, 0);
  end loop;

  return jsonb_build_object(
    'checkout_id', v_ck.id, 'status', v_ck.status, 'expira_em', v_ck.expira_em,
    'frete_codigo', p_frete, 'pagamento_metodo', p_pagamento,
    'itens', v_itens, 'vendedores', v_lista, 'divergencias', v_div,
    'totais', jsonb_build_object(
      'subtotal_produtos_cents', t_sub, 'desconto_produtos_cents', t_desc,
      'frete_cents', t_frete, 'desconto_frete_cents', 0,
      'total_cents', t_sub - t_desc + t_frete,
      'frete_definido', v_opcao is not null,
      'comissao_plataforma_cents', case when t_com_ok then t_com end,
      'tarifa_operacional_cents', case when t_tar_ok then t_tar end,
      'taxa_pagamento_cents', case when t_taxa_ok then t_taxa end,
      'repasse_sellers_cents', case when t_com_ok and t_tar_ok and t_taxa_ok then t_rep end));
end $$;

-- Cotação de frete de DEMONSTRAÇÃO: uma entrega por vendedor, tabela fictícia em
-- lv_settings.frete_demo. O provedor real (Unidade 10) substitui esta função sem
-- mudar a forma da resposta.
create or replace function public.lv_frete_cotar(p_checkout uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ck public.lv_checkouts;
  v_cfg jsonb := coalesce((select value from public.lv_settings where key = 'frete_demo'), '{}'::jsonb);
  v_op jsonb;
  v_calc jsonb;
  v_res jsonb := '[]'::jsonb;
begin
  select * into v_ck from public.lv_checkouts where id = p_checkout;
  if v_ck.id is null or (v_ck.user_id is distinct from auth.uid() and not public.lv_chamada_privilegiada()) then
    raise exception 'Checkout não encontrado.' using errcode = 'P0001', hint = 'CHECKOUT_INEXISTENTE';
  end if;
  for v_op in select o from jsonb_array_elements(v_cfg->'opcoes') o loop
    v_calc := public.lv_calcular_checkout(p_checkout, v_op->>'codigo', null);
    v_res := v_res || jsonb_build_object(
      'provedor', coalesce(v_cfg->>'provedor', 'demo'), 'codigo', v_op->>'codigo',
      'transportadora', v_op->>'transportadora', 'servico', v_op->>'servico',
      'prazo_dias', (v_op->>'prazo_dias')::int,
      'total_cents', (v_calc->'totais'->>'frete_cents')::bigint,
      'entregas', (select coalesce(jsonb_agg(jsonb_build_object('seller_id', s->'seller_id', 'loja_nome', s->'loja_nome',
                    'frete_cents', s->'frete_cents', 'peso_g', s->'peso_g')), '[]'::jsonb)
                     from jsonb_array_elements(v_calc->'vendedores') s));
  end loop;
  return v_res;
end $$;

-- =====================================================================
-- 4. Estoque: reservar, liberar, confirmar, devolver
-- =====================================================================
create or replace function public.lv_registrar_evento_pedido(
  p_order uuid, p_seller_order uuid, p_tipo text, p_origem text, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.lv_order_events (order_id, seller_order_id, tipo, origem, user_id, metadata)
  values (p_order, p_seller_order, p_tipo, p_origem, auth.uid(), coalesce(p_metadata, '{}'::jsonb));
$$;

-- FEFO sob trava. Devolve quanto FALTOU (0 = reservou tudo). Não levanta erro:
-- quem chama junta as faltas e desfaz a transação inteira.
create or replace function public.lv_reservar_variante(
  p_checkout uuid, p_cart_item uuid, p_variant uuid, p_qtd integer, p_expira timestamptz)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_falta integer := p_qtd;
  v_tira integer;
begin
  for r in
    select l.id, l.qtd_disponivel, l.lote, l.validade, l.seller_id
      from public.lv_inventory_lots l
      join public.lv_product_variants v on v.id = l.variant_id
      join public.lv_products p on p.id = v.product_id
      join public.lv_stores s on s.id = p.store_id
     where l.variant_id = p_variant
       and v.ativa and p.status = 'ativo' and s.ativa
       and l.is_demo = p.is_demo
       and l.qtd_disponivel > 0
       and (l.validade is null or l.validade >= current_date)
     order by l.validade asc nulls last, l.entrada_em asc nulls last, l.created_at, l.id
     for update of l
  loop
    exit when v_falta = 0;
    v_tira := least(v_falta, r.qtd_disponivel);
    update public.lv_inventory_lots
       set qtd_disponivel = qtd_disponivel - v_tira, qtd_reservada = qtd_reservada + v_tira
     where id = r.id;
    insert into public.lv_stock_reservations (checkout_id, seller_id, variant_id, lot_id, lote, validade, quantidade, expira_em)
    values (p_checkout, r.seller_id, p_variant, r.id, r.lote, r.validade, v_tira, p_expira);
    v_falta := v_falta - v_tira;
  end loop;
  return v_falta;
end $$;

-- Encerra reservas ativas, devolvendo ao disponível do lote.
create or replace function public.lv_liberar_reservas(p_checkout uuid, p_order uuid, p_seller_order uuid, p_status text, p_motivo text)
returns integer
language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in
    select id, lot_id, quantidade from public.lv_stock_reservations
     where status = 'ativa'
       and ((p_checkout is not null and checkout_id = p_checkout)
         or (p_order is not null and order_id = p_order and (p_seller_order is null or seller_order_id = p_seller_order)))
     order by lot_id
     for update
  loop
    if r.lot_id is not null then
      update public.lv_inventory_lots
         set qtd_disponivel = qtd_disponivel + r.quantidade,
             qtd_reservada = greatest(0, qtd_reservada - r.quantidade)
       where id = r.lot_id;
    end if;
    update public.lv_stock_reservations set status = p_status, motivo = p_motivo, encerrada_em = now() where id = r.id;
    v_n := v_n + r.quantidade;
  end loop;
  return v_n;
end $$;

-- Pagamento aprovado: a reserva vira baixa definitiva (sai do reservado).
create or replace function public.lv_confirmar_reservas(p_order uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in select id, lot_id, quantidade from public.lv_stock_reservations
            where order_id = p_order and status = 'ativa' order by lot_id for update loop
    if r.lot_id is not null then
      update public.lv_inventory_lots set qtd_reservada = greatest(0, qtd_reservada - r.quantidade) where id = r.lot_id;
    end if;
    update public.lv_stock_reservations set status = 'confirmada', encerrada_em = now() where id = r.id;
    v_n := v_n + r.quantidade;
  end loop;
  return v_n;
end $$;

-- Cancelamento depois do pagamento e antes do envio: devolve ao lote o que já tinha baixado.
create or replace function public.lv_devolver_estoque(p_order uuid, p_seller_order uuid, p_motivo text)
returns integer
language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in select id, lot_id, quantidade from public.lv_stock_reservations
            where order_id = p_order and status = 'confirmada'
              and (p_seller_order is null or seller_order_id = p_seller_order)
            order by lot_id for update loop
    if r.lot_id is not null then
      update public.lv_inventory_lots set qtd_disponivel = qtd_disponivel + r.quantidade where id = r.lot_id;
    end if;
    update public.lv_stock_reservations set status = 'devolvida', motivo = p_motivo, encerrada_em = now() where id = r.id;
    v_n := v_n + r.quantidade;
  end loop;
  return v_n;
end $$;

-- =====================================================================
-- 5. Expiração (job e chamada oportunista)
-- =====================================================================
create or replace function public.lv_checkout_expirar()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_checkouts integer := 0;
  v_pedidos integer := 0;
  v_unidades integer := 0;
  v_cfg jsonb := public.lv_config_checkout();
begin
  -- Checkouts sem pedido cujo prazo acabou.
  for r in select id, cart_id from public.lv_checkouts
            where status = 'aberto' and expira_em < now() for update skip locked loop
    v_unidades := v_unidades + public.lv_liberar_reservas(r.id, null, null, 'expirada', 'checkout expirado');
    update public.lv_checkouts set status = 'expirado', updated_at = now() where id = r.id;
    update public.lv_carts set status = 'aberto', updated_at = now() where id = r.cart_id and status = 'em_checkout';
    v_checkouts := v_checkouts + 1;
  end loop;

  -- Pedidos aguardando pagamento cuja reserva venceu: cancela e devolve.
  for r in select o.id from public.lv_orders o
            where o.status = 'aguardando_pagamento'
              and exists (select 1 from public.lv_stock_reservations sr
                           where sr.order_id = o.id and sr.status = 'ativa' and sr.expira_em < now())
            for update skip locked loop
    v_unidades := v_unidades + public.lv_liberar_reservas(null, r.id, null, 'expirada', 'pagamento não confirmado no prazo');
    update public.lv_seller_orders set status = 'cancelado' where order_id = r.id and status = 'aguardando_pagamento';
    update public.lv_payments set status = 'cancelado' where order_id = r.id and status in ('pendente', 'aguardando_pagamento', 'recusado');
    update public.lv_orders set status = 'cancelado', cancelado_em = now() where id = r.id;
    update public.lv_shipments set status = 'cancelado', updated_at = now() where order_id = r.id;
    perform public.lv_registrar_evento_pedido(r.id, null, 'cancelado', 'sistema', jsonb_build_object('motivo', 'pagamento não confirmado no prazo'));
    perform public.lv_registrar_evento_pedido(r.id, null, 'estoque_liberado', 'sistema', '{}'::jsonb);
    v_pedidos := v_pedidos + 1;
  end loop;

  -- Carrinho aberto parado há mais de carrinho_dias: abandonado (sem marketing).
  update public.lv_carts set status = 'abandonado', updated_at = now()
   where status = 'aberto'
     and updated_at < now() - make_interval(days => coalesce((v_cfg->>'carrinho_dias')::int, 7));

  return jsonb_build_object('checkouts_expirados', v_checkouts, 'pedidos_cancelados', v_pedidos, 'unidades_liberadas', v_unidades);
end $$;

-- =====================================================================
-- 6. Checkout
-- =====================================================================
-- Abre o checkout: grava o carrinho no servidor, recalcula o preço, reserva o
-- estoque (tudo ou nada) e devolve o cálculo com as divergências de preço.
create or replace function public.lv_checkout_iniciar(p_itens jsonb, p_chave text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_cfg jsonb := public.lv_config_checkout();
  v_max integer := coalesce((v_cfg->>'quantidade_maxima_por_item')::int, 99);
  v_expira timestamptz := now() + make_interval(mins => coalesce((v_cfg->>'reserva_minutos')::int, 15));
  v_existente public.lv_checkouts;
  v_cart uuid;
  v_ck uuid;
  r record;
  v_item uuid;
  v_falta integer;
  v_faltas jsonb := '[]'::jsonb;
  v_unit record;
  v_calc jsonb;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para fechar o pedido.' using errcode = 'P0001', hint = 'NAO_AUTENTICADO';
  end if;
  if p_chave is null or length(p_chave) < 8 then
    raise exception 'Chave do checkout inválida.' using errcode = 'P0001', hint = 'CHAVE_INVALIDA';
  end if;

  -- Idempotente: a mesma chave devolve o mesmo checkout, sem reservar de novo.
  select * into v_existente from public.lv_checkouts where user_id = v_user and chave = p_chave;
  if v_existente.id is not null then
    return public.lv_calcular_checkout(v_existente.id, null, null) || jsonb_build_object('repetido', true);
  end if;

  perform public.lv_checkout_expirar();

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O carrinho está vazio.' using errcode = 'P0001', hint = 'CHECKOUT_VAZIO';
  end if;

  -- Um checkout aberto por comprador: abrir outro solta o anterior.
  for r in select id, cart_id from public.lv_checkouts where user_id = v_user and status = 'aberto' for update loop
    perform public.lv_liberar_reservas(r.id, null, null, 'liberada', 'substituído por novo checkout');
    update public.lv_checkouts set status = 'cancelado', updated_at = now() where id = r.id;
    update public.lv_carts set status = 'abandonado', updated_at = now() where id = r.cart_id;
  end loop;

  insert into public.lv_carts (user_id, status, expira_em)
  values (v_user, 'em_checkout', now() + make_interval(days => coalesce((v_cfg->>'carrinho_dias')::int, 7)))
  returning id into v_cart;
  insert into public.lv_checkouts (user_id, cart_id, chave, expira_em) values (v_user, v_cart, p_chave, v_expira)
  returning id into v_ck;

  -- Ordem por variante: dois checkouts concorrentes travam os lotes na mesma ordem.
  for r in
    select (e->>'variant_id')::uuid as variant_id,
           sum((e->>'quantidade')::int)::int as quantidade,
           max(nullif(e->>'unitario_cents', '')::bigint) as visto
      from jsonb_array_elements(p_itens) e
     group by 1 order by 1
  loop
    if r.quantidade is null or r.quantidade < 1 or r.quantidade > v_max then
      raise exception 'Quantidade inválida.' using errcode = 'P0001', hint = 'QUANTIDADE_INVALIDA';
    end if;
    select vv.* into v_unit
      from public.lv_product_variants v
      join public.lv_products p on p.id = v.product_id
      join public.lv_stores s on s.id = p.store_id
      cross join lateral public.lv_unitario_na_quantidade(coalesce(v.preco_cents, p.preco_cents), p.id, r.quantidade) vv
     where v.id = r.variant_id and v.ativa and p.status = 'ativo' and s.ativa;
    if v_unit.unitario_cents is null then
      v_faltas := v_faltas || jsonb_build_object('variant_id', r.variant_id, 'pedida', r.quantidade, 'disponivel', 0, 'motivo', 'fora_do_ar');
      continue;
    end if;
    insert into public.lv_cart_items (cart_id, variant_id, quantidade, unitario_visto_cents, unitario_cents)
    values (v_cart, r.variant_id, r.quantidade, r.visto, v_unit.unitario_cents)
    returning id into v_item;
    v_falta := public.lv_reservar_variante(v_ck, v_item, r.variant_id, r.quantidade, v_expira);
    if v_falta > 0 then
      v_faltas := v_faltas || jsonb_build_object('variant_id', r.variant_id, 'pedida', r.quantidade,
                                                 'disponivel', r.quantidade - v_falta, 'motivo', 'estoque');
    end if;
  end loop;

  if jsonb_array_length(v_faltas) > 0 then
    -- Desfaz tudo (carrinho, checkout e reservas parciais) e diz o que faltou.
    raise exception 'Não há estoque para parte do carrinho.'
      using errcode = 'P0001', hint = 'ESTOQUE_INSUFICIENTE', detail = v_faltas::text;
  end if;

  v_calc := public.lv_calcular_checkout(v_ck, null, null);
  -- Divergência = o que a tela mostrou × o que o banco calcula agora.
  update public.lv_checkouts
     set divergencias = (select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', i->'variant_id', 'titulo', i->'titulo',
           'unitario_visto_cents', i->'unitario_visto_cents', 'unitario_cents', i->'unitario_cents')), '[]'::jsonb)
           from jsonb_array_elements(v_calc->'itens') i
          where i->'unitario_visto_cents' <> 'null'::jsonb and (i->>'unitario_visto_cents')::bigint <> (i->>'unitario_cents')::bigint)
   where id = v_ck;
  return v_calc || jsonb_build_object('divergencias_de_tela', (select divergencias from public.lv_checkouts where id = v_ck), 'repetido', false);
end $$;

create or replace function public.lv_checkout_resumo(p_checkout uuid, p_frete text, p_pagamento text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.lv_checkouts where id = p_checkout and (user_id = auth.uid() or public.lv_chamada_privilegiada())) then
    raise exception 'Checkout não encontrado.' using errcode = 'P0001', hint = 'CHECKOUT_INEXISTENTE';
  end if;
  return public.lv_calcular_checkout(p_checkout, p_frete, p_pagamento);
end $$;

-- Confirma: cria pedido pai, subpedidos, itens (snapshot), endereço, entrega,
-- pagamento e eventos, a partir do MESMO cálculo do resumo. Idempotente.
create or replace function public.lv_checkout_confirmar(
  p_checkout uuid, p_comprador jsonb, p_endereco jsonb, p_frete text, p_pagamento text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ck public.lv_checkouts;
  v_cfg jsonb := public.lv_config_checkout();
  v_calc jsonb;
  v_order uuid;
  v_numero text;
  v_sub jsonb;
  v_sub_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_n integer := 0;
  v_cep text := regexp_replace(coalesce(p_endereco->>'cep', ''), '\D', '', 'g');
  v_cpf text := nullif(regexp_replace(coalesce(p_comprador->>'cpf', ''), '\D', '', 'g'), '');
  v_uf text := upper(btrim(coalesce(p_endereco->>'uf', '')));
  v_email text;
  v_pag_expira timestamptz := now() + make_interval(mins => coalesce((v_cfg->>'pagamento_minutos')::int, 30));
  v_demo boolean;
begin
  if v_user is null then
    raise exception 'Entre na sua conta para fechar o pedido.' using errcode = 'P0001', hint = 'NAO_AUTENTICADO';
  end if;
  select * into v_ck from public.lv_checkouts where id = p_checkout and user_id = v_user for update;
  if v_ck.id is null then
    raise exception 'Checkout não encontrado.' using errcode = 'P0001', hint = 'CHECKOUT_INEXISTENTE';
  end if;
  -- Idempotência: confirmar de novo devolve o mesmo pedido.
  if v_ck.order_id is not null then
    return jsonb_build_object('order_id', v_ck.order_id,
      'numero', (select numero from public.lv_orders where id = v_ck.order_id), 'repetido', true);
  end if;
  if v_ck.status <> 'aberto' or v_ck.expira_em < now() then
    raise exception 'O tempo para fechar este pedido acabou e o estoque foi liberado. Abra o checkout de novo.'
      using errcode = 'P0001', hint = 'CHECKOUT_EXPIRADO';
  end if;

  if length(btrim(coalesce(p_comprador->>'nome', ''))) < 3 then
    raise exception 'Informe seu nome completo.' using errcode = 'P0001', hint = 'DADOS_INVALIDOS';
  end if;
  if v_cpf is not null and v_cpf !~ '^\d{11}$' then
    raise exception 'CPF inválido.' using errcode = 'P0001', hint = 'DADOS_INVALIDOS';
  end if;
  if v_cep !~ '^\d{8}$' or length(btrim(coalesce(p_endereco->>'logradouro', ''))) < 3
     or length(btrim(coalesce(p_endereco->>'numero', ''))) < 1 or length(btrim(coalesce(p_endereco->>'bairro', ''))) < 2
     or length(btrim(coalesce(p_endereco->>'cidade', ''))) < 2
     or v_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
    raise exception 'Endereço incompleto: confira CEP, rua, número, bairro, cidade e UF.' using errcode = 'P0001', hint = 'ENDERECO_INVALIDO';
  end if;
  if p_pagamento not in ('pix', 'cartao') then
    raise exception 'Forma de pagamento indisponível.' using errcode = 'P0001', hint = 'PAGAMENTO_INVALIDO';
  end if;
  if p_frete is null then
    raise exception 'Escolha a entrega.' using errcode = 'P0001', hint = 'FRETE_INVALIDO';
  end if;

  v_calc := public.lv_calcular_checkout(p_checkout, p_frete, p_pagamento);
  if jsonb_array_length(v_calc->'divergencias') > 0 then
    raise exception 'O preço de um item mudou desde que você abriu o checkout. Revise antes de confirmar.'
      using errcode = 'P0001', hint = 'PRECO_MUDOU', detail = (v_calc->'divergencias')::text;
  end if;

  select email into v_email from auth.users where id = v_user;
  v_numero := 'LV-' || lpad(nextval('public.lv_pedido_numero_seq')::text, 6, '0');
  v_demo := not exists (select 1 from jsonb_array_elements(v_calc->'itens') i where not (i->>'is_demo')::boolean);

  insert into public.lv_orders (
    numero, user_id, checkout_id, pagamento_metodo, comprador_nome, comprador_email, comprador_telefone, comprador_cpf,
    subtotal_produtos_cents, desconto_produtos_cents, frete_cents, desconto_frete_cents, total_cents,
    comissao_plataforma_cents, tarifa_operacional_cents, taxa_pagamento_cents, repasse_sellers_cents, is_demo)
  values (
    v_numero, v_user, v_ck.id, p_pagamento, btrim(p_comprador->>'nome'), coalesce(v_email, p_comprador->>'email'),
    nullif(btrim(coalesce(p_comprador->>'telefone', '')), ''), v_cpf,
    (v_calc->'totais'->>'subtotal_produtos_cents')::bigint, (v_calc->'totais'->>'desconto_produtos_cents')::bigint,
    (v_calc->'totais'->>'frete_cents')::bigint, 0, (v_calc->'totais'->>'total_cents')::bigint,
    (v_calc->'totais'->>'comissao_plataforma_cents')::bigint, (v_calc->'totais'->>'tarifa_operacional_cents')::bigint,
    (v_calc->'totais'->>'taxa_pagamento_cents')::bigint, (v_calc->'totais'->>'repasse_sellers_cents')::bigint, v_demo)
  returning id into v_order;

  insert into public.lv_order_addresses (order_id, destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia)
  values (v_order, coalesce(nullif(btrim(p_endereco->>'destinatario'), ''), btrim(p_comprador->>'nome')), v_cep,
          btrim(p_endereco->>'logradouro'), btrim(p_endereco->>'numero'), nullif(btrim(coalesce(p_endereco->>'complemento', '')), ''),
          btrim(p_endereco->>'bairro'), btrim(p_endereco->>'cidade'), v_uf, nullif(btrim(coalesce(p_endereco->>'referencia', '')), ''));

  for v_sub in select value from jsonb_array_elements(v_calc->'vendedores') loop
    v_n := v_n + 1;
    insert into public.lv_seller_orders (
      order_id, numero, seller_id, store_id, seller_nome, loja_nome, loja_slug,
      subtotal_produtos_cents, desconto_produtos_cents, frete_cents, desconto_frete_cents, total_cents,
      comissao_plataforma_cents, tarifa_operacional_cents, taxa_pagamento_cents, repasse_seller_cents,
      politica_comercial, politica_completa)
    values (
      v_order, v_numero || '-' || v_n, (v_sub->>'seller_id')::uuid, (v_sub->>'store_id')::uuid,
      v_sub->>'seller_nome', v_sub->>'loja_nome', v_sub->>'loja_slug',
      (v_sub->>'subtotal_produtos_cents')::bigint, (v_sub->>'desconto_produtos_cents')::bigint,
      (v_sub->>'frete_cents')::bigint, 0, (v_sub->>'total_cents')::bigint,
      case when (v_sub->>'comissao_ok')::boolean then (v_sub->>'comissao_plataforma_cents')::bigint end,
      case when (v_sub->>'tarifa_ok')::boolean then (v_sub->>'tarifa_operacional_cents')::bigint end,
      case when (v_sub->>'taxa_ok')::boolean then (v_sub->>'taxa_pagamento_cents')::bigint end,
      (v_sub->>'repasse_seller_cents')::bigint,
      jsonb_build_object('plano', v_sub->>'plano', 'comissao_bps', v_sub->'comissao_bps', 'pagamento_metodo', p_pagamento,
        'pagamento_bps', v_sub->'pagamento_bps', 'mensalidade', 'não entra por pedido',
        'natureza', 'hipotese_livre', 'congelada_em', now()),
      (v_sub->>'politica_completa')::boolean)
    returning id into v_sub_id;

    insert into public.lv_shipments (seller_order_id, order_id, provedor, codigo_servico, transportadora, servico, prazo_dias, peso_g, frete_cents, cotacao)
    values (v_sub_id, v_order, v_sub->'frete'->>'provedor', v_sub->'frete'->>'codigo', v_sub->'frete'->>'transportadora',
            v_sub->'frete'->>'servico', (v_sub->'frete'->>'prazo_dias')::int, (v_sub->>'peso_g')::int,
            (v_sub->>'frete_cents')::bigint, v_sub->'frete');

    for v_item in select value from jsonb_array_elements(v_calc->'itens') where value->>'seller_id' = v_sub->>'seller_id' loop
      insert into public.lv_order_items (
        order_id, seller_order_id, seller_id, product_id, variant_id, titulo, marca, variante_nome, gramatura_g, sku, ean,
        loja_nome, quantidade, preco_cheio_cents, unitario_cents, desconto_cents, total_cents, faixa_min_qty,
        comissao_bps, comissao_cents, tarifa_unidade_cents, tarifa_operacional_cents, pagamento_bps, taxa_pagamento_cents,
        liquido_estimado_cents, piso_cents, distancia_piso_cents)
      values (
        v_order, v_sub_id, (v_item->>'seller_id')::uuid, (v_item->>'product_id')::uuid, (v_item->>'variant_id')::uuid,
        v_item->>'titulo', v_item->>'marca', v_item->>'variante_nome', (v_item->>'gramatura_g')::int, v_item->>'sku', v_item->>'ean',
        v_item->>'loja_nome', (v_item->>'quantidade')::int, (v_item->>'preco_cheio_cents')::bigint, (v_item->>'unitario_cents')::bigint,
        (v_item->>'desconto_cents')::bigint, (v_item->>'total_cents')::bigint, (v_item->>'faixa_min_qty')::int,
        (v_item->>'comissao_bps')::int, (v_item->>'comissao_cents')::bigint, (v_item->>'tarifa_unidade_cents')::bigint,
        (v_item->>'tarifa_operacional_cents')::bigint, (v_item->>'pagamento_bps')::int, (v_item->>'taxa_pagamento_cents')::bigint,
        (v_item->>'liquido_estimado_cents')::bigint, (v_item->>'piso_cents')::bigint, (v_item->>'distancia_piso_cents')::bigint)
      returning id into v_item_id;

      -- A reserva do checkout passa a pertencer ao item e ganha o prazo do pagamento.
      update public.lv_stock_reservations sr
         set order_id = v_order, seller_order_id = v_sub_id, order_item_id = v_item_id, expira_em = v_pag_expira
       where sr.checkout_id = v_ck.id and sr.status = 'ativa' and sr.variant_id = (v_item->>'variant_id')::uuid;

      update public.lv_order_items oi
         set lotes = (select coalesce(jsonb_agg(jsonb_build_object('lot_id', sr.lot_id, 'lote', sr.lote, 'validade', sr.validade,
                        'quantidade', sr.quantidade) order by sr.validade nulls last), '[]'::jsonb)
                        from public.lv_stock_reservations sr where sr.order_item_id = v_item_id)
       where oi.id = v_item_id;
    end loop;

    perform public.lv_registrar_evento_pedido(v_order, v_sub_id, 'subpedido_criado', 'sistema',
      jsonb_build_object('numero', v_numero || '-' || v_n, 'loja', v_sub->>'loja_nome'));
  end loop;

  insert into public.lv_payments (order_id, provedor, metodo, status, valor_cents, split)
  values (v_order, 'simulado', p_pagamento, 'aguardando_pagamento', (v_calc->'totais'->>'total_cents')::bigint,
          (select coalesce(jsonb_agg(jsonb_build_object('seller_order_id', so.id, 'seller_id', so.seller_id,
                  'total_cents', so.total_cents, 'repasse_seller_cents', so.repasse_seller_cents,
                  'comissao_plataforma_cents', so.comissao_plataforma_cents, 'frete_cents', so.frete_cents)), '[]'::jsonb)
             from public.lv_seller_orders so where so.order_id = v_order));

  update public.lv_checkouts set status = 'convertido', order_id = v_order, updated_at = now() where id = v_ck.id;
  update public.lv_carts set status = 'convertido', convertido_em = now(), order_id = v_order, updated_at = now() where id = v_ck.cart_id;

  perform public.lv_registrar_evento_pedido(v_order, null, 'pedido_criado', 'comprador',
    jsonb_build_object('numero', v_numero, 'total_cents', (v_calc->'totais'->>'total_cents')::bigint, 'subpedidos', v_n));
  perform public.lv_registrar_evento_pedido(v_order, null, 'estoque_reservado', 'sistema',
    jsonb_build_object('expira_em', v_pag_expira,
      'lotes', (select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'lote', lote, 'quantidade', quantidade))
                  from public.lv_stock_reservations where order_id = v_order)));
  perform public.lv_registrar_evento_pedido(v_order, null, 'pagamento_pendente', 'sistema',
    jsonb_build_object('metodo', p_pagamento, 'provedor', 'simulado'));

  return jsonb_build_object('order_id', v_order, 'numero', v_numero, 'repetido', false);
end $$;

-- =====================================================================
-- 7. Pagamento (estrutura; nenhuma cobrança real)
-- =====================================================================
-- Recebe um evento de pagamento. É o ponto de entrada do webhook futuro: só a
-- service role chama. (provedor, chave) repetido não produz efeito nenhum.
create or replace function public.lv_pagamento_processar(
  p_provedor text, p_chave text, p_order uuid, p_status text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_evento uuid;
  v_pag public.lv_payments;
  v_ord public.lv_orders;
  v_sub record;
begin
  if p_status not in ('aprovado', 'recusado', 'cancelado') then
    raise exception 'Status de pagamento não suportado: %.', p_status using errcode = 'P0001', hint = 'PAGAMENTO_INVALIDO';
  end if;
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  select * into v_pag from public.lv_payments where order_id = p_order for update;

  insert into public.lv_payment_events (provedor, idempotency_key, payment_id, order_id, status, payload)
  values (p_provedor, p_chave, v_pag.id, p_order, p_status, coalesce(p_payload, '{}'::jsonb))
  on conflict (provedor, idempotency_key) do nothing
  returning id into v_evento;

  if v_evento is null then
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_evento_duplicado', 'pagamento',
      jsonb_build_object('provedor', p_provedor, 'chave', p_chave, 'status', p_status));
    return jsonb_build_object('duplicado', true, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status);
  end if;

  if p_status = 'aprovado' then
    if v_pag.status = 'aprovado' then
      return jsonb_build_object('duplicado', false, 'sem_efeito', true, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status);
    end if;
    update public.lv_payments set status = 'aprovado' where id = v_pag.id;
    if v_ord.status = 'cancelado' then
      -- Pagou depois de o pedido expirar: o dinheiro precisa voltar.
      insert into public.lv_refunds (order_id, tipo, valor_cents, motivo)
      values (p_order, 'total', v_pag.valor_cents, 'pagamento aprovado depois do cancelamento do pedido');
      perform public.lv_registrar_evento_pedido(p_order, null, 'reembolso_solicitado', 'sistema',
        jsonb_build_object('motivo', 'pagamento após cancelamento', 'valor_cents', v_pag.valor_cents));
    else
      perform public.lv_confirmar_reservas(p_order);
      update public.lv_orders set status = 'pago', pago_em = now(), pagamento_status = 'aprovado' where id = p_order;
      update public.lv_seller_orders set status = 'confirmado' where order_id = p_order and status = 'aguardando_pagamento';
      perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_aprovado', 'pagamento',
        jsonb_build_object('provedor', p_provedor, 'valor_cents', v_pag.valor_cents));
      for v_sub in select id, loja_nome from public.lv_seller_orders where order_id = p_order and status = 'confirmado' loop
        perform public.lv_registrar_evento_pedido(p_order, v_sub.id, 'seller_notificado', 'sistema',
          jsonb_build_object('loja', v_sub.loja_nome, 'canal', 'seller_central'));
      end loop;
    end if;
  elsif p_status = 'recusado' then
    if v_pag.status in ('aguardando_pagamento', 'pendente') then
      update public.lv_payments set status = 'recusado' where id = v_pag.id;
    end if;
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_recusado', 'pagamento', jsonb_build_object('provedor', p_provedor));
  end if;

  update public.lv_orders set pagamento_status = (select status from public.lv_payments where id = v_pag.id)
   where id = p_order and pagamento_status is distinct from (select status from public.lv_payments where id = v_pag.id);

  select * into v_ord from public.lv_orders where id = p_order;
  return jsonb_build_object('duplicado', false, 'status_pedido', v_ord.status,
    'status_pagamento', (select status from public.lv_payments where id = v_pag.id));
end $$;

-- Pagamento SIMULADO: só existe num banco marcado como staging (ambiente_do_banco).
-- Em produção a função recusa, para qualquer papel: ninguém "paga" um pedido real
-- apertando um botão.
create or replace function public.lv_pagamento_simular(p_order uuid, p_resultado text, p_chave text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.lv_eh_staging() then
    raise exception 'Pagamento simulado só existe no ambiente de testes.' using errcode = 'P0001', hint = 'SIMULACAO_BLOQUEADA';
  end if;
  if not exists (select 1 from public.lv_orders where id = p_order and (user_id = auth.uid() or public.is_admin())) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  return public.lv_pagamento_processar('simulado', p_chave, p_order, p_resultado,
    jsonb_build_object('simulado', true, 'por', auth.uid()));
end $$;

-- =====================================================================
-- 8. Status operacional e cancelamento
-- =====================================================================
create or replace function public.lv_derivar_status_pedido(p_order uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_atual text;
  v_novo text;
  v_ativos integer; v_entregues integer; v_saidos integer; v_processo integer;
begin
  select status into v_atual from public.lv_orders where id = p_order for update;
  select count(*) filter (where status <> 'cancelado'),
         count(*) filter (where status = 'entregue'),
         count(*) filter (where status in ('enviado', 'entregue')),
         count(*) filter (where status in ('separacao', 'pronto_para_envio'))
    into v_ativos, v_entregues, v_saidos, v_processo
    from public.lv_seller_orders where order_id = p_order;

  v_novo := case
    when v_ativos = 0 then 'cancelado'
    when v_entregues = v_ativos then 'entregue'
    when v_saidos = v_ativos then 'enviado'
    when v_saidos > 0 then 'parcialmente_enviado'
    when v_processo > 0 then 'em_processamento'
    else v_atual end;

  -- Degraus que o pai pula quando os filhos andam juntos (ex.: pago → enviado).
  while v_novo <> v_atual and not public.lv_transicao_pedido_valida(v_atual, v_novo) loop
    v_atual := case v_atual
      when 'pago' then 'em_processamento'
      when 'em_processamento' then case when v_novo = 'entregue' then 'enviado' else v_novo end
      when 'parcialmente_enviado' then 'enviado'
      else v_novo end;
    update public.lv_orders set status = v_atual where id = p_order;
  end loop;
  if v_novo <> (select status from public.lv_orders where id = p_order) then
    update public.lv_orders set status = v_novo, cancelado_em = case when v_novo = 'cancelado' then now() else cancelado_em end
     where id = p_order;
  end if;
end $$;

-- O vendedor move o PRÓPRIO subpedido pelos passos operacionais. Não mexe em
-- dinheiro, pagamento nem cancelamento (esses são da operação).
create or replace function public.lv_subpedido_mudar_status(p_seller_order uuid, p_status text, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_so public.lv_seller_orders;
  v_admin boolean := public.is_admin();
  v_origem text;
  v_tipo text;
begin
  select * into v_so from public.lv_seller_orders where id = p_seller_order for update;
  if v_so.id is null or not (v_admin or v_so.seller_id = any(public.lv_meus_vendedores())) then
    raise exception 'Subpedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  if p_status not in ('separacao', 'pronto_para_envio', 'enviado', 'entregue') then
    raise exception 'Esta mudança não é feita por aqui.' using errcode = 'P0001', hint = 'STATUS_NAO_PERMITIDO';
  end if;
  -- A trigger recusa pulo ou volta (ex.: entregue → separacao).
  update public.lv_seller_orders set status = p_status where id = v_so.id;
  update public.lv_shipments
     set status = case p_status when 'separacao' then 'em_preparo' when 'pronto_para_envio' then 'em_preparo' else p_status end,
         updated_at = now()
   where seller_order_id = v_so.id;
  v_origem := case when v_admin and not (v_so.seller_id = any(public.lv_meus_vendedores())) then 'admin' else 'vendedor' end;
  v_tipo := case p_status when 'separacao' then 'em_separacao' else p_status end;
  perform public.lv_registrar_evento_pedido(v_so.order_id, v_so.id, v_tipo, v_origem,
    jsonb_build_object('de', v_so.status, 'para', p_status, 'nota', p_nota));
  perform public.lv_derivar_status_pedido(v_so.order_id);
  return jsonb_build_object('status', p_status,
    'status_pedido', (select status from public.lv_orders where id = v_so.order_id));
end $$;

-- Cancelamento. Comprador: só antes do pagamento. Admin: antes do envio; depois do
-- pagamento o estoque volta ao lote e nasce um reembolso PENDENTE (sem dinheiro).
create or replace function public.lv_pedido_cancelar(p_order uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ord public.lv_orders;
  v_admin boolean := public.is_admin();
  v_origem text;
  v_unidades integer := 0;
begin
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null or not (v_admin or v_ord.user_id = auth.uid()) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  v_origem := case when v_ord.user_id = auth.uid() and not v_admin then 'comprador' else 'admin' end;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001', hint = 'DADOS_INVALIDOS';
  end if;

  if v_ord.status = 'aguardando_pagamento' then
    v_unidades := public.lv_liberar_reservas(null, p_order, null, 'liberada', 'pedido cancelado');
    update public.lv_payments set status = 'cancelado' where order_id = p_order and status in ('pendente', 'aguardando_pagamento', 'recusado');
  elsif v_admin and v_ord.status in ('pago', 'em_processamento')
        and not exists (select 1 from public.lv_seller_orders where order_id = p_order and status in ('enviado', 'entregue')) then
    v_unidades := public.lv_devolver_estoque(p_order, null, 'pedido cancelado depois do pagamento');
    insert into public.lv_refunds (order_id, tipo, valor_cents, motivo) values (p_order, 'total', v_ord.total_cents, p_motivo);
    perform public.lv_registrar_evento_pedido(p_order, null, 'reembolso_solicitado', v_origem,
      jsonb_build_object('valor_cents', v_ord.total_cents, 'status', 'pendente'));
  else
    raise exception 'Este pedido não pode mais ser cancelado por aqui.' using errcode = 'P0001', hint = 'CANCELAMENTO_NAO_PERMITIDO';
  end if;

  update public.lv_seller_orders set status = 'cancelado' where order_id = p_order and status <> 'cancelado';
  update public.lv_shipments set status = 'cancelado', updated_at = now() where order_id = p_order;
  update public.lv_orders set status = 'cancelado', cancelado_em = now() where id = p_order;
  perform public.lv_registrar_evento_pedido(p_order, null, 'cancelado', v_origem, jsonb_build_object('motivo', p_motivo));
  perform public.lv_registrar_evento_pedido(p_order, null, 'estoque_liberado', 'sistema', jsonb_build_object('unidades', v_unidades));
  return jsonb_build_object('status', 'cancelado', 'unidades_liberadas', v_unidades);
end $$;

-- =====================================================================
-- 9. RLS: comprador vê os seus; vendedor vê só os subpedidos dele; admin vê tudo
-- =====================================================================
alter table public.lv_carts enable row level security;
alter table public.lv_cart_items enable row level security;
alter table public.lv_checkouts enable row level security;
alter table public.lv_orders enable row level security;
alter table public.lv_seller_orders enable row level security;
alter table public.lv_order_items enable row level security;
alter table public.lv_order_addresses enable row level security;
alter table public.lv_stock_reservations enable row level security;
alter table public.lv_payments enable row level security;
alter table public.lv_payment_events enable row level security;
alter table public.lv_shipments enable row level security;
alter table public.lv_refunds enable row level security;
alter table public.lv_order_events enable row level security;

-- Nenhuma tabela aceita escrita direta de anon/authenticated: só SELECT.
revoke all on public.lv_carts, public.lv_cart_items, public.lv_checkouts, public.lv_orders, public.lv_seller_orders,
              public.lv_order_items, public.lv_order_addresses, public.lv_stock_reservations, public.lv_payments,
              public.lv_payment_events, public.lv_shipments, public.lv_refunds, public.lv_order_events
  from anon, authenticated, public;
grant select on public.lv_carts, public.lv_cart_items, public.lv_checkouts, public.lv_orders, public.lv_seller_orders,
               public.lv_order_items, public.lv_order_addresses, public.lv_stock_reservations, public.lv_payments,
               public.lv_payment_events, public.lv_shipments, public.lv_refunds, public.lv_order_events
  to authenticated;
revoke all on sequence public.lv_pedido_numero_seq from anon, authenticated, public;

-- Pedido do comprador (definer: evita recursão entre as policies).
create or replace function public.lv_meus_pedidos()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.lv_orders where user_id = auth.uid();
$$;
-- Pedidos em que o vendedor atual tem subpedido JÁ PAGO (antes disso, endereço não é dele).
create or replace function public.lv_pedidos_do_vendedor_pagos()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct order_id), '{}') from public.lv_seller_orders
   where seller_id = any(public.lv_meus_vendedores()) and status not in ('aguardando_pagamento', 'cancelado');
$$;

drop policy if exists lv_carts_leitura on public.lv_carts;
create policy lv_carts_leitura on public.lv_carts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists lv_cart_items_leitura on public.lv_cart_items;
create policy lv_cart_items_leitura on public.lv_cart_items for select to authenticated
  using (public.is_admin() or exists (select 1 from public.lv_carts c where c.id = cart_id and c.user_id = auth.uid()));
drop policy if exists lv_checkouts_leitura on public.lv_checkouts;
create policy lv_checkouts_leitura on public.lv_checkouts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists lv_orders_leitura on public.lv_orders;
create policy lv_orders_leitura on public.lv_orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists lv_seller_orders_leitura on public.lv_seller_orders;
create policy lv_seller_orders_leitura on public.lv_seller_orders for select to authenticated
  using (public.is_admin() or seller_id = any(public.lv_meus_vendedores()) or order_id = any(public.lv_meus_pedidos()));

drop policy if exists lv_order_items_leitura on public.lv_order_items;
create policy lv_order_items_leitura on public.lv_order_items for select to authenticated
  using (public.is_admin() or seller_id = any(public.lv_meus_vendedores()) or order_id = any(public.lv_meus_pedidos()));

drop policy if exists lv_order_addresses_leitura on public.lv_order_addresses;
create policy lv_order_addresses_leitura on public.lv_order_addresses for select to authenticated
  using (public.is_admin() or order_id = any(public.lv_meus_pedidos()) or order_id = any(public.lv_pedidos_do_vendedor_pagos()));

drop policy if exists lv_stock_reservations_leitura on public.lv_stock_reservations;
create policy lv_stock_reservations_leitura on public.lv_stock_reservations for select to authenticated
  using (public.is_admin() or seller_id = any(public.lv_meus_vendedores()));

drop policy if exists lv_payments_leitura on public.lv_payments;
create policy lv_payments_leitura on public.lv_payments for select to authenticated
  using (public.is_admin() or order_id = any(public.lv_meus_pedidos()));

drop policy if exists lv_payment_events_leitura on public.lv_payment_events;
create policy lv_payment_events_leitura on public.lv_payment_events for select to authenticated
  using (public.is_admin());

drop policy if exists lv_shipments_leitura on public.lv_shipments;
create policy lv_shipments_leitura on public.lv_shipments for select to authenticated
  using (public.is_admin() or order_id = any(public.lv_meus_pedidos())
      or exists (select 1 from public.lv_seller_orders so where so.id = seller_order_id and so.seller_id = any(public.lv_meus_vendedores())));

drop policy if exists lv_refunds_leitura on public.lv_refunds;
create policy lv_refunds_leitura on public.lv_refunds for select to authenticated
  using (public.is_admin() or order_id = any(public.lv_meus_pedidos())
      or exists (select 1 from public.lv_seller_orders so where so.id = seller_order_id and so.seller_id = any(public.lv_meus_vendedores())));

-- Vendedor vê só eventos do subpedido dele; eventos do pedido pai são do comprador e do admin.
drop policy if exists lv_order_events_leitura on public.lv_order_events;
create policy lv_order_events_leitura on public.lv_order_events for select to authenticated
  using (public.is_admin() or order_id = any(public.lv_meus_pedidos())
      or exists (select 1 from public.lv_seller_orders so where so.id = seller_order_id and so.seller_id = any(public.lv_meus_vendedores())));

-- =====================================================================
-- 10. Quem executa o quê
-- =====================================================================
do $$
declare f text;
begin
  foreach f in array array[
    'lv_transicao_pedido_valida(text,text)', 'lv_transicao_subpedido_valida(text,text)', 'lv_transicao_pagamento_valida(text,text)',
    'lv_unitario_na_quantidade(bigint,uuid,integer)', 'lv_aplicar_bps(bigint,integer)',
    'lv_regra_livre(text,text,text,bigint,integer,integer)', 'lv_config_checkout()', 'lv_eh_staging()',
    'lv_calcular_checkout(uuid,text,text)', 'lv_frete_cotar(uuid)', 'lv_registrar_evento_pedido(uuid,uuid,text,text,jsonb)',
    'lv_reservar_variante(uuid,uuid,uuid,integer,timestamptz)', 'lv_liberar_reservas(uuid,uuid,uuid,text,text)',
    'lv_confirmar_reservas(uuid)', 'lv_devolver_estoque(uuid,uuid,text)', 'lv_checkout_expirar()',
    'lv_checkout_iniciar(jsonb,text)', 'lv_checkout_resumo(uuid,text,text)',
    'lv_checkout_confirmar(uuid,jsonb,jsonb,text,text)', 'lv_pagamento_processar(text,text,uuid,text,jsonb)',
    'lv_pagamento_simular(uuid,text,text)', 'lv_derivar_status_pedido(uuid)',
    'lv_subpedido_mudar_status(uuid,text,text)', 'lv_pedido_cancelar(uuid,text)',
    'lv_meus_pedidos()', 'lv_pedidos_do_vendedor_pagos()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- O que a tela chama (cada função confere quem é o usuário por dentro).
grant execute on function public.lv_checkout_iniciar(jsonb, text) to authenticated;
grant execute on function public.lv_checkout_resumo(uuid, text, text) to authenticated;
grant execute on function public.lv_frete_cotar(uuid) to authenticated;
grant execute on function public.lv_checkout_confirmar(uuid, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.lv_pagamento_simular(uuid, text, text) to authenticated;
grant execute on function public.lv_subpedido_mudar_status(uuid, text, text) to authenticated;
grant execute on function public.lv_pedido_cancelar(uuid, text) to authenticated;
grant execute on function public.lv_checkout_expirar() to authenticated;
-- Usadas dentro das policies e das regras públicas.
grant execute on function public.lv_meus_pedidos() to authenticated;
grant execute on function public.lv_pedidos_do_vendedor_pagos() to authenticated;
grant execute on function public.lv_transicao_pedido_valida(text, text) to authenticated;
grant execute on function public.lv_transicao_subpedido_valida(text, text) to authenticated;
grant execute on function public.lv_transicao_pagamento_valida(text, text) to authenticated;
-- lv_pagamento_processar fica SÓ com service_role: é a porta do webhook futuro.

-- =====================================================================
-- 11. Job de expiração (quando o pg_cron existe no banco)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'coffeelivre-expirar-checkouts';
    perform cron.schedule('coffeelivre-expirar-checkouts', '* * * * *', 'select public.lv_checkout_expirar()');
  end if;
end $$;
