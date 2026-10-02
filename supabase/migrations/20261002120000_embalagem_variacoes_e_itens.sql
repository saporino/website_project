-- VARIAÇÃO DE EMBALAGEM (cor × válvula) e pedido com vários itens.
--
-- Por que mudou tão rápido: a embalagem de 100 g tem 3 cores (branco, preto, kraft) e sai com
-- ou sem válvula, e cada combinação tem preço próprio — kraft custa mais que branco/preto, e
-- com válvula custa mais que sem. Alem disso o cliente pode FECHAR O MÍNIMO MISTURANDO: 500
-- com válvula + 500 sem, ou 500 de uma cor + 500 de outra, desde que o pedido feche 1.000.
--
-- Entao o preço nao e do produto, e da variação; e o mínimo nao e do item, e do pedido inteiro.
--
-- As tabelas de pedido criadas na migration anterior sao recriadas: nasceram ha minutos e
-- estao vazias, nenhum pedido real se perde.

-- ----------------------------------------------------------------- oferta (produto-pai)
alter table public.embalagem_ofertas
  add column if not exists minimo_unidades integer not null default 1000,
  add column if not exists passo_unidades  integer not null default 100,
  add column if not exists prazo_valvula_dias smallint;   -- confecção da versão valvulada
comment on column public.embalagem_ofertas.minimo_unidades is
  'Minimo do PEDIDO somando todas as variacoes, nao de cada variacao.';
comment on column public.embalagem_ofertas.passo_unidades is
  'De quanto em quanto o cliente escolhe dentro de cada variacao.';
-- O preco agora vive na variacao. A coluna antiga fica so para nao quebrar nada no caminho.
alter table public.embalagem_ofertas alter column preco_milheiro drop not null;

-- --------------------------------------------------------------------------- variações
create table if not exists public.embalagem_variacoes (
  id             uuid primary key default gen_random_uuid(),
  oferta_id      uuid not null references public.embalagem_ofertas(id) on delete cascade,
  sku            text not null unique,
  cor            text not null,                       -- 'preto', 'branco', 'kraft'
  valvula        boolean not null default false,
  preco_milheiro numeric(12,2) not null,              -- R$ por 1.000 unidades desta variacao
  ativo          boolean not null default true,
  ordem          smallint not null default 0,
  created_at     timestamptz not null default now(),
  unique (oferta_id, cor, valvula)
);
create index if not exists embalagem_variacoes_oferta on public.embalagem_variacoes (oferta_id, ordem);

-- ------------------------------------------------------------- pedido (recriado com itens)
drop table if exists public.embalagem_pedidos cascade;

create table public.embalagem_pedidos (
  id             uuid primary key default gen_random_uuid(),
  numero         text unique,
  unidades       integer not null check (unidades >= 1),   -- soma dos itens
  subtotal       numeric(12,2) not null,
  desconto_pct   numeric(5,2) not null default 0,
  total          numeric(12,2) not null,
  nome           text not null,
  empresa        text,
  documento      text,
  email          text not null,
  telefone       text not null,
  cep            text,
  endereco       text,
  observacao     text,
  status         text not null default 'novo' check (status in ('novo','em_contato','fechado','cancelado')),
  company_id     uuid references public.companies(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.embalagem_pedidos is
  'Pedido de embalagem vindo do site da COFICO. Nao cobra no site: a COFICO confirma preco e frete.';

create table public.embalagem_pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.embalagem_pedidos(id) on delete cascade,
  variacao_id    uuid not null references public.embalagem_variacoes(id) on delete restrict,
  descricao      text not null,                 -- congelada: "100 g · kraft · com valvula"
  unidades       integer not null check (unidades >= 1),
  preco_milheiro numeric(12,2) not null,        -- congelado no momento do pedido
  subtotal       numeric(12,2) not null
);
create index if not exists embalagem_pedido_itens_pedido on public.embalagem_pedido_itens (pedido_id);

drop trigger if exists embalagem_pedidos_numero on public.embalagem_pedidos;
create trigger embalagem_pedidos_numero before insert on public.embalagem_pedidos
  for each row execute function public.gerar_numero_pedido_embalagem();

-- -------------------------------------------------------------------------------- RLS
alter table public.embalagem_variacoes    enable row level security;
alter table public.embalagem_pedidos      enable row level security;
alter table public.embalagem_pedido_itens enable row level security;

drop policy if exists embalagem_variacoes_publico on public.embalagem_variacoes;
create policy embalagem_variacoes_publico on public.embalagem_variacoes
  for select to anon, authenticated using (ativo);

drop policy if exists embalagem_pedidos_envio on public.embalagem_pedidos;
create policy embalagem_pedidos_envio on public.embalagem_pedidos
  for insert to anon, authenticated with check (status = 'novo');
drop policy if exists embalagem_pedido_itens_envio on public.embalagem_pedido_itens;
create policy embalagem_pedido_itens_envio on public.embalagem_pedido_itens
  for insert to anon, authenticated with check (true);

do $$
declare t text;
begin
  foreach t in array array['embalagem_variacoes','embalagem_pedidos','embalagem_pedido_itens'] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format(
      'create policy %I_admin on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------------------- seed
-- 50 g preto: uma variacao so (sem valvula).
insert into public.embalagem_variacoes (oferta_id, sku, cor, valvula, preco_milheiro, ordem)
select o.id, 'SUPPF1014COFI-1000', 'preto', false, 474.78, 0
  from public.embalagem_ofertas o
 where o.sku = 'SUPPF1014COFI-1000'
   and not exists (select 1 from public.embalagem_variacoes v where v.sku = 'SUPPF1014COFI-1000');

-- 100 g (14 × 18,5 + 4 cm, 0,200 mm): 3 cores × com/sem valvula.
-- Branco e preto tem o mesmo preco; so o kraft muda. Valvulada leva 5 dias uteis de confeccao.
insert into public.embalagem_ofertas (sku, nome, prazo_valvula_dias, company_id)
select 'SUP1418COFI-1000', 'Stand Up Pouch para Café — 100 g', 5,
       (select id from public.companies where name ilike '%cofico%' limit 1)
 where not exists (select 1 from public.embalagem_ofertas where sku = 'SUP1418COFI-1000');

insert into public.embalagem_variacoes (oferta_id, sku, cor, valvula, preco_milheiro, ordem)
select o.id, t.sku, t.cor, t.valvula, t.preco, t.ordem
  from public.embalagem_ofertas o,
       (values
         ('SUPPV1418COFI-1000', 'preto',  true,  1532.78, 0),
         ('SUPPF1418COFI-1000', 'preto',  false,  882.78, 1),
         ('SUPBV1418COFI-1000', 'branco', true,  1532.78, 2),
         ('SUPBF1418COFI-1000', 'branco', false,  882.78, 3),
         ('SUPKV1418COFI-1000', 'kraft',  true,  1601.96, 4),
         ('SUPKF1418COFI-1000', 'kraft',  false,  951.96, 5)
       ) as t(sku, cor, valvula, preco, ordem)
 where o.sku = 'SUP1418COFI-1000'
   and not exists (select 1 from public.embalagem_variacoes v where v.sku = t.sku);
