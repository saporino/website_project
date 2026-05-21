-- Permite clientes RepCo com CNPJ (PJ) ou CPF (PF), sem CNPJ ficticio.
-- Migration aditiva/segura: nao altera dados existentes e aplica a regra para novas escritas.

ALTER TABLE public.representative_clients
  ALTER COLUMN cnpj DROP NOT NULL;

ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS cpf TEXT;

ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS nome_completo TEXT;

DO $$
DECLARE
  constraint_definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO constraint_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.representative_clients'::regclass
    AND c.conname = 'representative_clients_document_required';

  IF constraint_definition IS NOT NULL
     AND (
       constraint_definition NOT ILIKE '%cnpj%'
       OR constraint_definition NOT ILIKE '%cpf%'
     ) THEN
    ALTER TABLE public.representative_clients
      DROP CONSTRAINT representative_clients_document_required;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.representative_clients'::regclass
      AND conname = 'representative_clients_document_required'
  ) THEN
    ALTER TABLE public.representative_clients
      ADD CONSTRAINT representative_clients_document_required
      CHECK (
        NULLIF(BTRIM(cnpj), '') IS NOT NULL
        OR NULLIF(BTRIM(cpf), '') IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rep_clients_cpf
  ON public.representative_clients(cpf)
  WHERE cpf IS NOT NULL AND BTRIM(cpf) <> '';
