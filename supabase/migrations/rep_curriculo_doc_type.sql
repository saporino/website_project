-- Tarefa 3 — adiciona 'curriculo' aos tipos de documento do representante.
-- Aplicado em produção via exec_migration (05/08/2026). Idempotente.
ALTER TABLE public.representative_documents
  DROP CONSTRAINT IF EXISTS representative_documents_doc_type_check;
ALTER TABLE public.representative_documents
  ADD CONSTRAINT representative_documents_doc_type_check
  CHECK (doc_type IN ('cnh','cpf_doc','cnpj_doc','core','contrato','curriculo'));
