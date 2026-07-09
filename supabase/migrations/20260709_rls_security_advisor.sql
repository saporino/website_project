-- Fecha os alertas do Supabase Security Advisor (09/07/2026):
--  - rls_disabled_in_public: companies, invoices, shipments, shipping_carriers estavam SEM RLS.
--  - sensitive_columns_exposed: shipping_carriers.api_password acessível pelo anon.
-- Políticas preservam o comportamento atual do app (checkout lê transportadoras;
-- rastreamento público lê shipments; admin gerencia tudo).

-- companies (1 registro; dados de marca/CNPJ público): leitura pública, escrita só admin.
alter table public.companies enable row level security;
drop policy if exists "public read companies" on public.companies;
create policy "public read companies" on public.companies for select using (true);
drop policy if exists "admin all companies" on public.companies;
create policy "admin all companies" on public.companies for all using (is_admin()) with check (is_admin());

-- shipping_carriers: checkout público lê (cotação); admin gerencia.
alter table public.shipping_carriers enable row level security;
drop policy if exists "public read carriers" on public.shipping_carriers;
create policy "public read carriers" on public.shipping_carriers for select using (true);
drop policy if exists "admin all carriers" on public.shipping_carriers;
create policy "admin all carriers" on public.shipping_carriers for all using (is_admin()) with check (is_admin());
-- credencial NUNCA no acesso público (anon). REVOKE de coluna sozinho não basta (o GRANT
-- de tabela padrão do Supabase o anula), então: revoga a tabela e concede só as colunas
-- não-sensíveis. Admin (authenticated) mantém acesso total para gerenciar a credencial.
revoke select on public.shipping_carriers from anon;
grant select (id, name, code, price_per_kg, fixed_price, delivery_time_days, is_active,
  logo_url, api_type, api_endpoint, api_key, api_username, integration_notes, created_at)
  on public.shipping_carriers to anon;

-- shipments: rastreamento público lê por tracking_code; admin gerencia.
alter table public.shipments enable row level security;
drop policy if exists "public read shipments" on public.shipments;
create policy "public read shipments" on public.shipments for select using (true);
drop policy if exists "admin all shipments" on public.shipments;
create policy "admin all shipments" on public.shipments for all using (is_admin()) with check (is_admin());

-- invoices (NF/comprovantes): só admin (nenhuma leitura pública no app).
alter table public.invoices enable row level security;
drop policy if exists "admin all invoices" on public.invoices;
create policy "admin all invoices" on public.invoices for all using (is_admin()) with check (is_admin());
