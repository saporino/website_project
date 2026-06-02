-- Bloco 7 (Pedido auditável): observações append-only por pedido (log de auditoria).
-- Append-only (sem update/delete p/ não-admin) => rastreável. RLS: rep só nos pedidos dele; admin tudo.

CREATE TABLE IF NOT EXISTS public.representative_order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.representative_orders(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_name text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ron_order_idx ON public.representative_order_notes(order_id);

ALTER TABLE public.representative_order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ron_select ON public.representative_order_notes;
CREATE POLICY ron_select ON public.representative_order_notes FOR SELECT
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.representative_orders o
    WHERE o.id = order_id AND o.representative_id = public.my_rep_id()));

DROP POLICY IF EXISTS ron_insert ON public.representative_order_notes;
CREATE POLICY ron_insert ON public.representative_order_notes FOR INSERT
  WITH CHECK (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.representative_orders o
    WHERE o.id = order_id AND o.representative_id = public.my_rep_id()));

GRANT SELECT, INSERT ON public.representative_order_notes TO authenticated;
