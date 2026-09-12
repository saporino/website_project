-- =====================================================================
-- Coffee LiVRE — planos e entrada do vendedor (12/09/2026) — Unidade 4
--
-- Duas tabelas e nenhuma cobrança. O plano existe como ESTRUTURA e como
-- vitrine comercial; cobrar de verdade é fase 2 e não pode atrasar a
-- demonstração.
--
-- POR QUE O PLANO É TABELA E NÃO CONSTANTE NO CÓDIGO: os valores são de
-- estudo e vão mudar antes do lançamento. Preço em código vira deploy a
-- cada conversa de diretoria, e vira também o risco de o site mostrar um
-- número e a proposta mostrar outro.
--
-- A CANDIDATURA NÃO APROVA NINGUÉM. Ela nasce como "interessado" e só um
-- administrador a move adiante. A jornada da seção 5 do RAIO-X tem
-- análise humana, e é ela que protege o marketplace de vendedor que não
-- entrega.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PLANOS
-- ---------------------------------------------------------------------
create table if not exists public.lv_plans (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  nome          text not null,
  chamada       text,
  -- Em CENTAVOS, como todo dinheiro da plataforma (seção 10 do RAIO-X).
  mensalidade_cents bigint not null default 0,
  -- Comissão em pontos-base: 1200 = 12%. Evita decimal em percentual, que
  -- é onde arredondamento de comissão costuma sangrar.
  comissao_bps  integer,
  destaques     jsonb not null default '[]'::jsonb,
  limite_produtos integer,
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  -- Valores de ESTUDO até a diretoria aprovar (decisão D2 do RAIO-X).
  -- A tela diz isso ao visitante em vez de fingir tabela fechada.
  em_estudo     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.lv_plans is
  'Planos do vendedor. Valores em ESTUDO ate a decisao D2. Nenhuma cobranca real nesta fase: a tabela existe para a vitrine comercial e para a arquitetura.';

alter table public.lv_plans enable row level security;

drop policy if exists lv_plans_publicos on public.lv_plans;
create policy lv_plans_publicos on public.lv_plans
  for select to anon, authenticated using (ativo);

drop policy if exists lv_plans_admin on public.lv_plans;
create policy lv_plans_admin on public.lv_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- CANDIDATURA DO VENDEDOR
-- ---------------------------------------------------------------------
create table if not exists public.lv_seller_applications (
  id              uuid primary key default gen_random_uuid(),
  -- Identificação do negócio
  cnpj            text,
  razao_social    text,
  nome_marca      text not null,
  -- produtor | torrefacao | empacotador | marca | cooperativa | distribuidor
  tipo            text not null default 'torrefacao',
  -- Quem responde
  responsavel     text not null,
  email           text not null,
  telefone        text,
  cidade          text,
  uf              char(2),
  -- Operação
  tipos_de_cafe   text,
  volume_mensal   text,
  prazo_expedicao text,
  emite_nfe       boolean,
  mensagem        text,
  plan_id         uuid references public.lv_plans(id) on delete set null,
  -- interessado | em_analise | aprovado | recusado
  -- Nasce SEMPRE em "interessado". A RLS abaixo garante isso.
  status          text not null default 'interessado',
  nota_interna    text,
  -- Preenchido quando o administrador aprova e o vendedor passa a existir.
  seller_id       uuid references public.lv_sellers(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint lv_seller_applications_status_valido
    check (status in ('interessado','em_analise','aprovado','recusado'))
);

comment on table public.lv_seller_applications is
  'Pedido de entrada de um vendedor. NUNCA aprova sozinho: nasce em "interessado" e so o administrador move adiante.';

create index if not exists lv_seller_applications_por_status
  on public.lv_seller_applications (status, created_at desc);

alter table public.lv_seller_applications enable row level security;

-- Qualquer visitante pode se candidatar — é um formulário público.
-- O `with check` trava o status: ninguém se aprova pelo próprio pedido.
drop policy if exists lv_seller_applications_envio on public.lv_seller_applications;
create policy lv_seller_applications_envio on public.lv_seller_applications
  for insert to anon, authenticated
  with check (status = 'interessado' and seller_id is null);

-- Ler e mover, só administrador. A candidatura tem CNPJ, e-mail e
-- telefone de quem se ofereceu: não é dado público.
drop policy if exists lv_seller_applications_admin on public.lv_seller_applications;
create policy lv_seller_applications_admin on public.lv_seller_applications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Os quatro planos
-- ---------------------------------------------------------------------
-- Valores de estudo enviados pelo Vlademir em 12/09/2026. A comissão por
-- plano ainda não foi definida e fica nula de propósito: número inventado
-- numa tela de preço vira promessa.
insert into public.lv_plans (slug, nome, chamada, mensalidade_cents, limite_produtos, ordem, destaques)
select v.slug, v.nome, v.chamada, v.mensal, v.limite, v.ordem, v.destaques::jsonb
  from (values
    ('zero', 'LiVRE Zero', 'Para começar a vender sem custo fixo', 0, 5, 1,
     '["Até 5 produtos","Loja própria no marketplace","LiVRE Passport","Comissão por venda"]'),
    ('livre', 'LiVRE', 'Para quem já vende todo mês', 6990, 50, 2,
     '["Até 50 produtos","Desconto por quantidade","Destaque na categoria","Seller Central completo"]'),
    ('plus', 'LiVRE+ Plus', 'Para crescer com dados e vitrine', 12990, null, 3,
     '["Produtos ilimitados","Comparação de mercado","LiVRE Copiloto","Prioridade na vitrine"]'),
    ('oficial', 'LiVRE Oficial', 'Para marcas com operação consolidada', 18990, null, 4,
     '["Tudo do Plus","Selo de Loja Oficial","Página de marca","Atendimento dedicado"]')
  ) as v(slug, nome, chamada, mensal, limite, ordem, destaques)
 where not exists (select 1 from public.lv_plans p where p.slug = v.slug);
