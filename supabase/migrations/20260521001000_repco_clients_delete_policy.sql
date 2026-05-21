-- Permite ao representante excluir apenas clientes proprios sem pedidos vinculados.
-- Usado para desfazer conversoes de prospeccao em fase operacional/teste.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'representative_clients'
      AND policyname = 'RepCo can delete own clients without orders'
  ) THEN
    CREATE POLICY "RepCo can delete own clients without orders"
      ON public.representative_clients
      FOR DELETE
      TO authenticated
      USING (
        representative_id = my_rep_id()
        AND NOT EXISTS (
          SELECT 1
          FROM public.representative_orders ro
          WHERE ro.representative_client_id = representative_clients.id
        )
      );
  END IF;
END $$;
