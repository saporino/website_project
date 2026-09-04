-- RBAC — papéis de console + RLS por papel + view de ruptura acionável
-- Aplicado em produção em 21/07/2026 via exec_migration (registro para rastreabilidade).
-- Modelo: "um console, abas por papel". Admin vê tudo; cada papel de console vê só o seu.
-- Estas policies são ADITIVAS (permissive, OR) — não alteram as policies existentes de admin/rep/promotor.

-- 1) Papéis novos (supervisor já existia)
INSERT INTO public.roles (code, label, description) VALUES
  ('gerente_comercial', 'Gerente Comercial', 'Acesso aos representantes do RepCo, pedidos, prospecção e painel de clientes')
  ON CONFLICT (code) DO NOTHING;
INSERT INTO public.roles (code, label, description) VALUES
  ('contabilidade', 'Contabilidade', 'Vê e paga comissões, anexa comprovantes de pagamento')
  ON CONFLICT (code) DO NOTHING;

-- 2) View acionável de rupturas em aberto (admin/supervisor) — join incidente+cliente+produto+rep+promotor+aging
CREATE OR REPLACE VIEW public.vw_ruptura_open WITH (security_barrier=true) AS
SELECT i.id, i.company_id, i.category, i.priority, i.description, i.status,
       COALESCE(i.opened_at, i.created_at) AS aberta_em,
       GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(i.opened_at, i.created_at)))/3600.0) AS horas_aberta,
       c.id AS client_id, COALESCE(c.nome_fantasia, c.razao_social) AS loja,
       c.municipio, c.uf, c.whatsapp_comprador,
       p.name AS produto, r.full_name AS representante, pr.full_name AS promotor
FROM public.promoter_incidents i
LEFT JOIN public.representative_clients c ON c.id = i.representative_client_id
LEFT JOIN public.products p ON p.id = i.product_id
LEFT JOIN public.representatives r ON r.id = i.assigned_representative_id
LEFT JOIN public.promoters pr ON pr.id = i.promoter_id
WHERE i.status NOT IN ('resolvida','cancelada');
GRANT SELECT ON public.vw_ruptura_open TO authenticated, anon, service_role;

-- 3) RLS por papel (has_role checa user_roles pelo auth.uid()). Padrão de nome: <tabela>_<sfx>_<all|sel>.
--    SUPERVISOR (gerencia promotores; lê apoio)
DROP POLICY IF EXISTS promoters_sup_all ON public.promoters;
CREATE POLICY promoters_sup_all ON public.promoters FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_clients_sup_all ON public.promoter_clients;
CREATE POLICY promoter_clients_sup_all ON public.promoter_clients FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_routes_sup_all ON public.promoter_routes;
CREATE POLICY promoter_routes_sup_all ON public.promoter_routes FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_visits_sup_all ON public.promoter_visits;
CREATE POLICY promoter_visits_sup_all ON public.promoter_visits FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_client_mix_sup_all ON public.promoter_client_mix;
CREATE POLICY promoter_client_mix_sup_all ON public.promoter_client_mix FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_visit_audits_sup_sel ON public.promoter_visit_audits;
CREATE POLICY promoter_visit_audits_sup_sel ON public.promoter_visit_audits FOR SELECT TO authenticated USING (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_visit_photos_sup_sel ON public.promoter_visit_photos;
CREATE POLICY promoter_visit_photos_sup_sel ON public.promoter_visit_photos FOR SELECT TO authenticated USING (public.has_role('supervisor'));
DROP POLICY IF EXISTS promoter_incidents_sup_all ON public.promoter_incidents;
CREATE POLICY promoter_incidents_sup_all ON public.promoter_incidents FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS repco_invite_codes_sup_all ON public.repco_invite_codes;
CREATE POLICY repco_invite_codes_sup_all ON public.repco_invite_codes FOR ALL TO authenticated USING (public.has_role('supervisor')) WITH CHECK (public.has_role('supervisor'));
DROP POLICY IF EXISTS representative_clients_sup_sel ON public.representative_clients;
CREATE POLICY representative_clients_sup_sel ON public.representative_clients FOR SELECT TO authenticated USING (public.has_role('supervisor'));
DROP POLICY IF EXISTS representatives_sup_sel ON public.representatives;
CREATE POLICY representatives_sup_sel ON public.representatives FOR SELECT TO authenticated USING (public.has_role('supervisor'));

--    GERENTE COMERCIAL (reps, clientes, pedidos, prospecção; vê comissão)
DROP POLICY IF EXISTS representatives_ger_all ON public.representatives;
CREATE POLICY representatives_ger_all ON public.representatives FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS representative_clients_ger_all ON public.representative_clients;
CREATE POLICY representative_clients_ger_all ON public.representative_clients FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS representative_orders_ger_all ON public.representative_orders;
CREATE POLICY representative_orders_ger_all ON public.representative_orders FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS representative_order_items_ger_all ON public.representative_order_items;
CREATE POLICY representative_order_items_ger_all ON public.representative_order_items FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS representative_order_installments_ger_sel ON public.representative_order_installments;
CREATE POLICY representative_order_installments_ger_sel ON public.representative_order_installments FOR SELECT TO authenticated USING (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS representative_commissions_ger_sel ON public.representative_commissions;
CREATE POLICY representative_commissions_ger_sel ON public.representative_commissions FOR SELECT TO authenticated USING (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS prospect_leads_ger_all ON public.prospect_leads;
CREATE POLICY prospect_leads_ger_all ON public.prospect_leads FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS prospect_lists_ger_all ON public.prospect_lists;
CREATE POLICY prospect_lists_ger_all ON public.prospect_lists FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS price_lists_ger_sel ON public.price_lists;
CREATE POLICY price_lists_ger_sel ON public.price_lists FOR SELECT TO authenticated USING (public.has_role('gerente_comercial'));
DROP POLICY IF EXISTS repco_invite_codes_ger_all ON public.repco_invite_codes;
CREATE POLICY repco_invite_codes_ger_all ON public.repco_invite_codes FOR ALL TO authenticated USING (public.has_role('gerente_comercial')) WITH CHECK (public.has_role('gerente_comercial'));

--    CONTABILIDADE (comissões, pagamentos, comprovantes; lê apoio)
DROP POLICY IF EXISTS representative_commissions_cont_all ON public.representative_commissions;
CREATE POLICY representative_commissions_cont_all ON public.representative_commissions FOR ALL TO authenticated USING (public.has_role('contabilidade')) WITH CHECK (public.has_role('contabilidade'));
DROP POLICY IF EXISTS representative_commission_payouts_cont_all ON public.representative_commission_payouts;
CREATE POLICY representative_commission_payouts_cont_all ON public.representative_commission_payouts FOR ALL TO authenticated USING (public.has_role('contabilidade')) WITH CHECK (public.has_role('contabilidade'));
DROP POLICY IF EXISTS representative_order_installments_cont_all ON public.representative_order_installments;
CREATE POLICY representative_order_installments_cont_all ON public.representative_order_installments FOR ALL TO authenticated USING (public.has_role('contabilidade')) WITH CHECK (public.has_role('contabilidade'));
DROP POLICY IF EXISTS representatives_cont_sel ON public.representatives;
CREATE POLICY representatives_cont_sel ON public.representatives FOR SELECT TO authenticated USING (public.has_role('contabilidade'));
DROP POLICY IF EXISTS representative_clients_cont_sel ON public.representative_clients;
CREATE POLICY representative_clients_cont_sel ON public.representative_clients FOR SELECT TO authenticated USING (public.has_role('contabilidade'));
DROP POLICY IF EXISTS representative_orders_cont_sel ON public.representative_orders;
CREATE POLICY representative_orders_cont_sel ON public.representative_orders FOR SELECT TO authenticated USING (public.has_role('contabilidade'));
