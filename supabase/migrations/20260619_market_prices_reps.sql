-- Supermercados SP + visibilidade dos preços de mercado para o representante (app).
-- Estende ecommerce_sources: tipo de fonte (marketplace | supermercado_sp), liga/desliga
-- por fonte do que o REP enxerga no celular, e ordenação dos chips.

alter table public.ecommerce_sources add column if not exists kind text not null default 'marketplace';
alter table public.ecommerce_sources add column if not exists visible_to_reps boolean not null default false;
alter table public.ecommerce_sources add column if not exists sort_order int not null default 0;

-- Redes de supermercado de SP (chaves estáveis). Coleta desligada por padrão (entram quando
-- o scraper VTEX/Google Shopping de cada uma estiver pronto). ON CONFLICT preserva config existente.
insert into public.ecommerce_sources (marketplace,label,kind,enabled,visible_to_reps,sort_order) values
 ('super_pao','Pão de Açúcar','supermercado_sp',false,false,1),
 ('super_carrefour','Carrefour','supermercado_sp',false,false,2),
 ('super_extra','Extra','supermercado_sp',false,false,3),
 ('super_assai','Assaí','supermercado_sp',false,false,4),
 ('super_atacadao','Atacadão','supermercado_sp',false,false,5),
 ('super_tenda','Tenda Atacado','supermercado_sp',false,false,6),
 ('super_dia','Dia','supermercado_sp',false,false,7),
 ('super_stmarche','St Marche','supermercado_sp',false,false,8)
on conflict (marketplace) do nothing;

-- REP (app) lê só as fontes que o admin ligou e os preços (lote) dessas fontes.
drop policy if exists "Reps read visible sources" on public.ecommerce_sources;
create policy "Reps read visible sources" on public.ecommerce_sources
  for select to authenticated using (visible_to_reps);

drop policy if exists "Reps read visible snapshots" on public.ecommerce_price_snapshots;
create policy "Reps read visible snapshots" on public.ecommerce_price_snapshots
  for select to authenticated
  using (marketplace in (select marketplace from public.ecommerce_sources where visible_to_reps));
