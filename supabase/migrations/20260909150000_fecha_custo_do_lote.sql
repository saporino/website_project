-- =====================================================================
-- MOVIMENTO 1 — Fechar o custo do lote (09/09/2026)
--
-- Achado da auditoria de 09/09: `lot_transfers` guarda a cadeia de custo do
-- café (unit_cost_brl, value_amount_brl, kg_amount) e estava com as quatro
-- operações liberadas para QUALQUER usuário autenticado:
--
--   authenticated_read    SELECT  USING (true)
--   authenticated_insert  INSERT  WITH CHECK (true)
--   authenticated_update  UPDATE  USING (true)
--   authenticated_delete  DELETE  USING (true)
--
-- Sem is_admin(), sem company_id. Representante, promotor, motorista e
-- cliente B2C com conta podiam LER a margem e — pior — ALTERAR e APAGAR a
-- base de custo que alimenta calculate_batch_costs.
--
-- A tabela irmã `green_coffee_lots` sempre esteve correta, protegida por
-- is_admin(). Foi a tabela de transferências que ficou aberta.
--
-- `lot_documents` entra junto: guarda os documentos de compra do verde, nota
-- fiscal, pagamento de torra e de embalagem — a mesma família de custo, com
-- SELECT, INSERT e DELETE igualmente abertos. O bucket é privado, então o
-- caminho sozinho não abre o arquivo; mas o DELETE aberto permitia apagar o
-- registro de qualquer documento de custo.
--
-- `superfrete_settings` expunha markup_pct para `anon`: nossa margem sobre o
-- frete, legível por qualquer visitante do site. Ninguém no navegador precisa
-- dela — a cotação roda em superfrete-quote com service role.
--
-- Uso verificado antes de fechar: lot_transfers só em BatchManagement.tsx,
-- lot_documents só em DocumentUploadButton.tsx e superfrete_settings só em
-- SuperFreteSettings.tsx. As três são telas de administrador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- lot_transfers — custo de transferência entre lotes
-- ---------------------------------------------------------------------
drop policy if exists authenticated_read   on public.lot_transfers;
drop policy if exists authenticated_insert on public.lot_transfers;
drop policy if exists authenticated_update on public.lot_transfers;
drop policy if exists authenticated_delete on public.lot_transfers;

create policy lot_transfers_admin on public.lot_transfers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.lot_transfers is
  'Transferencias entre lotes com custo unitario. ADMIN-ONLY: contem custo e margem. Nunca reabrir para authenticated sem is_admin().';

-- ---------------------------------------------------------------------
-- lot_documents — documentos de custo do lote
-- ---------------------------------------------------------------------
drop policy if exists lot_docs_select on public.lot_documents;
drop policy if exists lot_docs_insert on public.lot_documents;
drop policy if exists lot_docs_delete on public.lot_documents;

create policy lot_documents_admin on public.lot_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.lot_documents is
  'Documentos de custo do lote (compra do verde, NF, pagamento de torra e embalagem). ADMIN-ONLY.';

-- ---------------------------------------------------------------------
-- superfrete_settings — markup da loja sobre o frete
-- ---------------------------------------------------------------------
-- A leitura anonima existia de quando a cotacao era montada no navegador. Ela
-- passou para a edge function superfrete-quote, que usa service role e ignora
-- RLS — entao fechar aqui nao tira nada de ninguem.
-- A tabela ja tinha uma policy `sf_admin` correta para o administrador; o
-- problema era so a leitura anonima convivendo com ela. Basta remover a
-- leitura — criar outra policy de admin seria duplicata inofensiva e confusa.
drop policy if exists sf_leitura on public.superfrete_settings;

comment on table public.superfrete_settings is
  'Origem, servicos e MARKUP da loja sobre o frete. ADMIN-ONLY: markup e margem. A cotacao publica roda em superfrete-quote com service role.';
