-- Realtime (supabase_realtime): TODAS as tabelas que o frontend escuta via postgres_changes
-- PRECISAM estar nesta publicação, senão a tela não atualiza sozinha (bug silencioso).
-- Auditado 27/07/2026 cruzando os `.on('postgres_changes', {table})` do código com a publicação.
-- Rodar cada linha 1x (re-adicionar tabela já publicada dá erro — é idempotente na prática por já existir).

ALTER PUBLICATION supabase_realtime ADD TABLE public.representative_orders;              -- sino admin, mapa ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.representative_order_installments;  -- sino admin (parcela paga)
ALTER PUBLICATION supabase_realtime ADD TABLE public.representatives;                    -- sino admin, mapa ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.promoters;                          -- sino admin (promotor aguardando)
ALTER PUBLICATION supabase_realtime ADD TABLE public.promoter_incidents;                -- rupturas (rep + admin)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;                     -- chat interno
ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_videos;                     -- status do Studio

-- Também já presentes (não escutados por postgres_changes hoje, mas publicados sem problema):
--   chat_conversations, price_lists, representative_clients, route_stops
