-- =====================================================================
-- Organizações do COFICO Studio — o tenant do produto (10/09/2026)
--
-- Até aqui o Studio era ferramenta interna: as sete tabelas `studio_*` têm
-- uma policy cada, `USING (is_admin())`, e `company_id` nunca foi usado para
-- isolar nada. Isso é correto para uso da casa e inaceitável para produto.
--
-- POR QUE NÃO REUSAR `companies`: ela é a empresa FATURADORA do ecossistema —
-- carrega order_prefix, payment_account, commission_model, e aparece em
-- orders.seller_company_id, no seletor do RepCo e no roteamento do Mercado
-- Pago. Uma torrefação cliente ali passaria a existir dentro do núcleo
-- comercial. O tenant do Studio é outro conceito e merece tabela própria.
--
-- HIERARQUIA (uma organização pode ter VÁRIAS marcas):
--
--   studio_organizations          "Torrefação XYZ Ltda"  ← assinatura vive aqui
--     ├── studio_members          quem entra e com que papel
--     └── studio_brand_profiles   Marca A, Marca B, Marca C
--           ├── studio_videos / analyses / transcriptions
--           ├── studio_campaigns
--           ├── studio_generations
--           └── ai_usage_events
--
-- O MVP limita comercialmente a 1 marca por assinatura, mas nada aqui impede
-- várias — o limite é regra de plano, não de esquema.
--
-- `studio_brand_profiles` é REUTILIZADA como a entidade "marca": ela já tem
-- nome, cores, tom, público, logo, produtos e guardrails. Criar uma tabela
-- nova ao lado seria duplicar o conceito que a auditoria manda evitar.
--
-- Tudo aditivo: `company_id` permanece em todas as tabelas, e a policy antiga
-- de admin continua valendo em paralelo. Nada existente para de funcionar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A organização
-- ---------------------------------------------------------------------
create table if not exists public.studio_organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,

  -- Ponte OPCIONAL para uma empresa do grupo. A Saporino e a COFICO são
  -- clientes internos e apontam para `companies`; cliente externo deixa nulo
  -- e nunca toca no núcleo comercial.
  company_id  uuid references public.companies(id) on delete set null,

  plan        text not null default 'beta',
  status      text not null default 'ativa',   -- ativa | trial | suspensa | cancelada
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.studio_organizations is
  'Tenant do COFICO Studio. Uma organizacao tem varias marcas (studio_brand_profiles) e UMA assinatura. company_id so e preenchido para cliente interno (Saporino, COFICO).';

-- ---------------------------------------------------------------------
-- Quem pertence a qual organização
-- ---------------------------------------------------------------------
create table if not exists public.studio_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.studio_organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member',   -- owner | member
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists studio_members_por_usuario on public.studio_members (user_id);

comment on table public.studio_members is
  'Vinculo usuario <-> organizacao. owner administra e cuida da assinatura; member cria e aprova.';

-- ---------------------------------------------------------------------
-- A função que toda policy vai usar
-- ---------------------------------------------------------------------
-- SECURITY DEFINER pelo mesmo motivo de `my_rep_id()`: a policy de
-- studio_members não pode depender de ler studio_members, senão a checagem
-- recursiona.
create or replace function public.my_studio_orgs()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(organization_id), '{}')
    from public.studio_members
   where user_id = auth.uid();
$$;

comment on function public.my_studio_orgs is
  'Organizacoes do usuario atual. Base de todo isolamento do COFICO Studio: organizacao A jamais enxerga dado da B.';

revoke all on function public.my_studio_orgs() from public;
grant execute on function public.my_studio_orgs() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- organization_id nas tabelas do Studio
-- ---------------------------------------------------------------------
-- `studio_analyses` e `studio_transcriptions` não tinham NENHUMA coluna de
-- tenant — só `video_id`. Isolar por join seria frágil e caro em toda leitura.
alter table public.studio_brand_profiles     add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_videos             add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_analyses           add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_transcriptions     add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_campaigns          add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_social_connections add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.studio_generations        add column if not exists organization_id uuid references public.studio_organizations(id) on delete cascade;
alter table public.ai_usage_events           add column if not exists organization_id uuid references public.studio_organizations(id) on delete set null;

-- A marca precisa saber a que organização pertence, e a geração precisa saber
-- de que marca é — sem isso, "quantos conteúdos esta marca fez" não responde.
alter table public.studio_generations add column if not exists brand_id uuid references public.studio_brand_profiles(id) on delete set null;

create index if not exists studio_brands_por_org  on public.studio_brand_profiles (organization_id);
create index if not exists studio_videos_por_org  on public.studio_videos (organization_id);
create index if not exists studio_gen_por_org     on public.studio_generations (organization_id);
create index if not exists ai_usage_por_org       on public.ai_usage_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Backfill: Saporino e COFICO viram as duas primeiras organizações
-- ---------------------------------------------------------------------
-- O Saporino Studio passa a ser, literalmente, o primeiro cliente do COFICO
-- Studio — que é como o produto foi descrito desde o começo.
insert into public.studio_organizations (name, slug, company_id, plan, status)
select c.name,
       lower(regexp_replace(c.name, '[^a-zA-Z0-9]+', '-', 'g')),
       c.id,
       'interno',
       'ativa'
  from public.companies c
 where c.studio_enabled = true
   and not exists (select 1 from public.studio_organizations o where o.company_id = c.id);

-- Liga cada registro existente à organização da sua empresa.
update public.studio_brand_profiles p
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = p.company_id and p.organization_id is null;

update public.studio_videos v
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = v.company_id and v.organization_id is null;

update public.studio_campaigns c
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = c.company_id and c.organization_id is null;

update public.studio_social_connections s
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = s.company_id and s.organization_id is null;

update public.studio_generations g
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = g.company_id and g.organization_id is null;

update public.ai_usage_events e
   set organization_id = o.id
  from public.studio_organizations o
 where o.company_id = e.company_id and e.organization_id is null;

-- Análise e transcrição herdam do vídeo, que é a única ligação que tinham.
update public.studio_analyses a
   set organization_id = v.organization_id
  from public.studio_videos v
 where v.id = a.video_id and a.organization_id is null;

update public.studio_transcriptions t
   set organization_id = v.organization_id
  from public.studio_videos v
 where v.id = t.video_id and t.organization_id is null;

-- Os administradores atuais entram como donos das organizações internas, para
-- que ninguém perca acesso ao que já usava.
insert into public.studio_members (organization_id, user_id, role)
select o.id, p.id, 'owner'
  from public.studio_organizations o
 cross join public.user_profiles p
 where o.company_id is not null
   and p.is_admin = true
   and not exists (
     select 1 from public.studio_members m
      where m.organization_id = o.id and m.user_id = p.id
   );

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.studio_organizations enable row level security;
alter table public.studio_members       enable row level security;

drop policy if exists studio_org_membro on public.studio_organizations;
create policy studio_org_membro on public.studio_organizations
  for all to authenticated
  using (public.is_admin() or id = any(public.my_studio_orgs()))
  with check (public.is_admin() or id = any(public.my_studio_orgs()));

-- Membro enxerga a própria lista de colegas; só o admin da plataforma escreve
-- por aqui (convite de membro passará por função dedicada).
drop policy if exists studio_membros_leitura on public.studio_members;
create policy studio_membros_leitura on public.studio_members
  for select to authenticated
  using (public.is_admin() or organization_id = any(public.my_studio_orgs()));

drop policy if exists studio_membros_admin on public.studio_members;
create policy studio_membros_admin on public.studio_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- As policies das tabelas do Studio passam a aceitar DOIS caminhos: o
-- administrador da plataforma (que opera tudo) e o membro da organização dona
-- do registro. Organização A nunca alcança dado da B porque
-- `my_studio_orgs()` só devolve as organizações do próprio usuário.
do $$
declare t text;
begin
  foreach t in array array[
    'studio_brand_profiles','studio_videos','studio_analyses','studio_transcriptions',
    'studio_campaigns','studio_social_connections','studio_generations'
  ] loop
    execute format('drop policy if exists %I_tenant on public.%I', t, t);
    execute format($f$
      create policy %I_tenant on public.%I
        for all to authenticated
        using (public.is_admin() or organization_id = any(public.my_studio_orgs()))
        with check (public.is_admin() or organization_id = any(public.my_studio_orgs()))
    $f$, t, t);
  end loop;
end $$;

-- ai_usage_events guarda CUSTO. O cliente pode ver o próprio consumo, mas o
-- custo em dólar é dado financeiro nosso — por isso a leitura do cliente vai
-- por uma view, e a tabela continua admin-only.
-- (a policy ai_usage_admin criada em 20260909180000 permanece como está)

comment on table public.studio_generations is
  'Cada tentativa de geracao, aprovada ou nao. organization_id isola por cliente; brand_id diz de qual marca. parent_id liga as tentativas do mesmo pedido.';
