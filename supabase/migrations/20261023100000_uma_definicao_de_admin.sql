-- =====================================================================
-- Uma definição de "admin", não duas (23/10/2026)
--
-- O raio-X de 20/10 encontrou isto e classificou como MÉDIO, latente. A
-- varredura de hoje achou mais duas do que a de lá: são ONZE, não nove —
-- `admin_settings` e `edge_logs` tinham passado.
--
-- O PROBLEMA. `is_admin()` foi corrigida e hoje lê `user_roles`. Mas estas
-- onze policies não a chamam: comparam `user_profiles.is_admin` direto, por
-- dentro de um EXISTS. São uma segunda definição de "quem é administrador",
-- vivendo em paralelo.
--
-- POR QUE IMPORTA, mesmo não sendo escalada de privilégio. Tirar o papel de
-- admin em `user_roles` NÃO tira o acesso a estas onze tabelas — entre elas
-- `products` e `price_lists`, que são PREÇO. A revogação fica pela metade, em
-- silêncio. O inverso também vale: conceder admin por `user_roles` não dá
-- acesso a elas.
--
-- Hoje as duas definições coincidem porque há UM administrador. No dia em que
-- houver dois, ou em que alguém for desligado, a diferença aparece — e vai
-- aparecer no pior momento possível.
--
-- Esta migration foi GERADA A PARTIR DO BANCO, lendo `pg_policies`, e não
-- escrita à mão: onze nomes digitados de memória é onde se esquece um.
--
-- Nenhuma mudança de comportamento enquanto as duas definições concordarem —
-- que é exatamente por que vale fazer agora, e não depois.
-- =====================================================================

-- admin_settings :: Admins can update settings
drop policy if exists "Admins can update settings" on public.admin_settings;
create policy "Admins can update settings" on public.admin_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- admin_settings :: Admins can view settings
drop policy if exists "Admins can view settings" on public.admin_settings;
create policy "Admins can view settings" on public.admin_settings
  for select using (public.is_admin());

-- batch_photos :: Admin manages batch photos
drop policy if exists "Admin manages batch photos" on public.batch_photos;
create policy "Admin manages batch photos" on public.batch_photos
  for all using (public.is_admin()) with check (public.is_admin());

-- edge_logs :: Admins can read edge_logs
drop policy if exists "Admins can read edge_logs" on public.edge_logs;
create policy "Admins can read edge_logs" on public.edge_logs
  for select using (public.is_admin());

-- green_coffee_lots :: Admin manages batches
drop policy if exists "Admin manages batches" on public.green_coffee_lots;
create policy "Admin manages batches" on public.green_coffee_lots
  for all using (public.is_admin()) with check (public.is_admin());

-- price_lists :: Admins manage price_lists
drop policy if exists "Admins manage price_lists" on public.price_lists;
create policy "Admins manage price_lists" on public.price_lists
  for all using (public.is_admin()) with check (public.is_admin());

-- products :: Admin full access
drop policy if exists "Admin full access" on public.products;
create policy "Admin full access" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- representative_routes :: Admin full access on routes
drop policy if exists "Admin full access on routes" on public.representative_routes;
create policy "Admin full access on routes" on public.representative_routes
  for all using (public.is_admin()) with check (public.is_admin());

-- roasting_companies :: Admin roasting_companies
drop policy if exists "Admin roasting_companies" on public.roasting_companies;
create policy "Admin roasting_companies" on public.roasting_companies
  for all using (public.is_admin()) with check (public.is_admin());

-- roasting_company_contacts :: Admin contacts
drop policy if exists "Admin contacts" on public.roasting_company_contacts;
create policy "Admin contacts" on public.roasting_company_contacts
  for all using (public.is_admin()) with check (public.is_admin());

-- route_stops :: Admin full access on route_stops
drop policy if exists "Admin full access on route_stops" on public.route_stops;
create policy "Admin full access on route_stops" on public.route_stops
  for all using (public.is_admin()) with check (public.is_admin());
