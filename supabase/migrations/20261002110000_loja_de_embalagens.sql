-- LOJA DE EMBALAGENS da COFICO (site público) — preço, desconto por volume, pedido e avaliação.
--
-- Decisões do Vlademir (02/10/2026):
--   • hoje só vendemos de 1.000 em 1.000. As quantidades pequenas (50/100/250/500) ficam
--     prontas no banco mas DESLIGADAS, para ligar quando passarmos a atender pedido menor;
--   • preço à vista. O parcelamento fica construído e desligado;
--   • comprar NÃO cobra no site: gera pedido no painel, a COFICO confirma e combina pagamento
--     e frete. Preço de embalagem muda sem aviso — tem que passar por gente antes de cobrar;
--   • avaliação é aberta a qualquer visitante, mas nasce PENDENTE e só aparece depois de aprovada.
--
-- A ficha do produto (foto, medida, FAQ) continua no código, em embalagens.ts. Aqui fica só o
-- que o admin liga, desliga e muda de preço sem deploy.

-- ---------------------------------------------------------------- oferta (preço e chaves)
create table if not exists public.embalagem_ofertas (
  id                      uuid primary key default gen_random_uuid(),
  sku                     text not null unique,        -- casa com EmbalagemItem.codigo
  nome                    text not null,
  preco_milheiro          numeric(12,2) not null,      -- R$ por 1.000 unidades, à vista
  ativo                   boolean not null default true,
  avaliacoes_ativas       boolean not null default true,
  parcelamento_ativo      boolean not null default false,
  parcelas_max            smallint not null default 1 check (parcelas_max between 1 and 12),
  quantidades_pequenas    boolean not null default false,
  company_id              uuid references public.companies(id) on delete set null,
  atualizado_em           timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
comment on table public.embalagem_ofertas is
  'Preco e chaves de liga/desliga da embalagem no site da COFICO. A ficha do produto fica no codigo.';

-- ------------------------------------------------------- desconto por volume (escada)
-- "comprou 2.000 ganha desconto, 3.000 ganha mais" — a escada é do admin, não do código.
create table if not exists public.embalagem_descontos (
  id            uuid primary key default gen_random_uuid(),
  oferta_id     uuid not null references public.embalagem_ofertas(id) on delete cascade,
  a_partir_de   integer not null check (a_partir_de >= 1),   -- em milheiros
  desconto_pct  numeric(5,2) not null check (desconto_pct > 0 and desconto_pct <= 50),
  ativo         boolean not null default true,
  unique (oferta_id, a_partir_de)
);
comment on column public.embalagem_descontos.a_partir_de is 'Quantidade em milheiros (2 = 2.000 unidades).';

-- ---------------------------------------------------------------------- avaliações
create table if not exists public.embalagem_avaliacoes (
  id          uuid primary key default gen_random_uuid(),
  oferta_id   uuid not null references public.embalagem_ofertas(id) on delete cascade,
  nome        text not null,
  empresa     text,
  nota        smallint not null check (nota between 1 and 5),
  comentario  text not null,
  status      text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  resposta    text,                      -- resposta pública da COFICO
  criado_em   timestamptz not null default now(),
  moderado_em timestamptz,
  moderado_por uuid references auth.users(id) on delete set null
);
create index if not exists embalagem_avaliacoes_fila on public.embalagem_avaliacoes (status, criado_em desc);

-- ------------------------------------------------------------------------- pedidos
create sequence if not exists public.embalagem_pedido_seq;
create table if not exists public.embalagem_pedidos (
  id             uuid primary key default gen_random_uuid(),
  numero         text unique,
  oferta_id      uuid not null references public.embalagem_ofertas(id) on delete restrict,
  milheiros      integer not null check (milheiros >= 1),
  preco_milheiro numeric(12,2) not null,   -- congelado no momento do pedido
  desconto_pct   numeric(5,2) not null default 0,
  total          numeric(12,2) not null,
  nome           text not null,
  empresa        text,
  documento      text,                     -- CNPJ ou CPF, como o cliente digitou
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

create or replace function public.gerar_numero_pedido_embalagem()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := 'EMB-' || lpad(nextval('public.embalagem_pedido_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists embalagem_pedidos_numero on public.embalagem_pedidos;
create trigger embalagem_pedidos_numero before insert on public.embalagem_pedidos
  for each row execute function public.gerar_numero_pedido_embalagem();

-- ------------------------------------------------------------------------------ RLS
alter table public.embalagem_ofertas    enable row level security;
alter table public.embalagem_descontos  enable row level security;
alter table public.embalagem_avaliacoes enable row level security;
alter table public.embalagem_pedidos    enable row level security;

-- Vitrine: qualquer visitante lê oferta ativa e desconto ativo.
drop policy if exists embalagem_ofertas_publico on public.embalagem_ofertas;
create policy embalagem_ofertas_publico on public.embalagem_ofertas
  for select to anon, authenticated using (ativo);
drop policy if exists embalagem_descontos_publico on public.embalagem_descontos;
create policy embalagem_descontos_publico on public.embalagem_descontos
  for select to anon, authenticated using (ativo);

-- Avaliação: o visitante lê só as aprovadas e só consegue inserir como PENDENTE.
drop policy if exists embalagem_avaliacoes_publico on public.embalagem_avaliacoes;
create policy embalagem_avaliacoes_publico on public.embalagem_avaliacoes
  for select to anon, authenticated using (status = 'aprovada');
drop policy if exists embalagem_avaliacoes_envio on public.embalagem_avaliacoes;
create policy embalagem_avaliacoes_envio on public.embalagem_avaliacoes
  for insert to anon, authenticated
  with check (status = 'pendente' and resposta is null and moderado_em is null);

-- Pedido: o visitante só escreve o dele; ninguem de fora lê pedido de ninguem.
drop policy if exists embalagem_pedidos_envio on public.embalagem_pedidos;
create policy embalagem_pedidos_envio on public.embalagem_pedidos
  for insert to anon, authenticated with check (status = 'novo');

-- Admin manda em tudo.
do $$
declare t text;
begin
  foreach t in array array['embalagem_ofertas','embalagem_descontos','embalagem_avaliacoes','embalagem_pedidos'] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format(
      'create policy %I_admin on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- --------------------------------------------------------------------------- seed
-- Stand up pouch preto 50 g: R$ 474,78 por 1.000, à vista, sem escada de desconto ainda.
insert into public.embalagem_ofertas (sku, nome, preco_milheiro, company_id)
select 'SUPPF1014COFI-1000', 'Stand Up Pouch Preto para Café — 50 g', 474.78,
       (select id from public.companies where lower(name) like '%cofico%' limit 1)
 where not exists (select 1 from public.embalagem_ofertas where sku = 'SUPPF1014COFI-1000');
