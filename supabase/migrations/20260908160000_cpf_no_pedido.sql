-- =====================================================================
-- CPF do comprador no pedido (08/09/2026)
--
-- A compra passou a ser liberada sem cadastro, então os dados que a nota
-- fiscal exige precisam vir do próprio formulário. Faltava o CPF: sem ele
-- não há como emitir NF para pessoa física.
-- =====================================================================

alter table public.orders
  add column if not exists customer_cpf text;

comment on column public.orders.customer_cpf is
  'CPF do comprador, so digitos. Obrigatorio para emitir nota fiscal de pessoa fisica. Guardado no pedido porque compra de visitante nao tem cadastro de onde puxar.';

-- Índice para o admin achar o histórico de um cliente que comprou sem conta.
create index if not exists orders_customer_cpf_idx on public.orders (customer_cpf)
  where customer_cpf is not null;
