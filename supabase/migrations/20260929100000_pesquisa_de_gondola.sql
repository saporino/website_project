-- PESQUISA DE GÔNDOLA — o preço que está na prateleira da loja, fotografado na visita.
--
-- Pedido do Vlademir (29/09/2026): "vou a uma rede, anexo 20 fotos (ou um PDF de outra
-- fonte) e sai o mesmo PDF da inteligência de preços". A IA lê a etiqueta; ele confere
-- item por item antes de gerar. Fica guardado por rede e loja, para comparar visitas.
--
-- Por que tabela própria e não `ecommerce_price_snapshots`: aquela é coleta automática de
-- anúncio na internet (tem SKU, URL, patrocinado). Esta é levantamento visual de loja
-- física, com foto, endereço e conferência humana. Misturar as duas estragaria as duas.

create table if not exists public.gondola_pesquisas (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete set null,
  rede          text not null,                      -- "Supermercado Lopes"
  loja          text,                               -- "Cipava"
  cidade        text,
  uf            text,
  data_visita   date not null default current_date,
  observacao    text,
  criado_por    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.gondola_pesquisas is
  'Levantamento visual de preco de gondola em loja fisica (foto na visita). Uma linha por visita a uma loja.';

create table if not exists public.gondola_itens (
  id                 uuid primary key default gen_random_uuid(),
  pesquisa_id        uuid not null references public.gondola_pesquisas(id) on delete cascade,
  foto_path          text,                          -- bucket `gondola` (privado)
  produto            text,                          -- "Pilão Tradicional"
  marca              text,
  peso_g             integer,
  preco              numeric(10,2),                 -- preço de prateleira (o que vale)
  preco_regular      numeric(10,2),                 -- quando a etiqueta tem promo + normal
  em_promocao        boolean not null default false,
  -- a IA nunca inventa: quando não consegue ler, deixa null e marca o motivo
  lido_pela_ia       boolean not null default false,
  nao_li             text,
  confianca          text check (confianca in ('alta','media','baixa')),
  revisado           boolean not null default false, -- conferido por gente
  ordem              integer not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists gondola_itens_por_pesquisa on public.gondola_itens (pesquisa_id, ordem);
comment on column public.gondola_itens.preco is 'Preco de prateleira conferido. So entra no PDF depois de revisado.';

-- R$/kg é conta, não dado digitado: fica derivado.
create or replace view public.vw_gondola_itens as
  select i.*,
         case when i.peso_g > 0 and i.preco is not null
              then round((i.preco / (i.peso_g::numeric / 1000))::numeric, 2) end as preco_por_kg
    from public.gondola_itens i;

alter table public.gondola_pesquisas enable row level security;
alter table public.gondola_itens     enable row level security;

drop policy if exists gondola_pesquisas_admin on public.gondola_pesquisas;
create policy gondola_pesquisas_admin on public.gondola_pesquisas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists gondola_itens_admin on public.gondola_itens;
create policy gondola_itens_admin on public.gondola_itens
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.vw_gondola_itens to authenticated;

-- Fotos da visita: bucket PRIVADO (é foto de loja de terceiro; o PDF usa link assinado).
insert into storage.buckets (id, name, public)
select 'gondola', 'gondola', false
 where not exists (select 1 from storage.buckets where id = 'gondola');

drop policy if exists st_gondola_admin_read on storage.objects;
create policy st_gondola_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'gondola' and public.is_admin());

drop policy if exists st_gondola_admin_write on storage.objects;
create policy st_gondola_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'gondola' and public.is_admin());

drop policy if exists st_gondola_admin_update on storage.objects;
create policy st_gondola_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'gondola' and public.is_admin());

drop policy if exists st_gondola_admin_delete on storage.objects;
create policy st_gondola_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'gondola' and public.is_admin());
