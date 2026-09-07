-- =====================================================================
-- Carrinhos abandonados (08/09/2026)
--
-- Todo checkout iniciado cria um pedido, porque o preço tem que ser
-- calculado no servidor antes de cobrar. Quem desiste na tela do cartão
-- deixa um pedido "Criado" para trás.
--
-- Hoje a aba Pedidos mostra 10 desses contra 1 pago: 90% de ruído. Quem
-- opera perde o pedido de verdade no meio da lista.
--
-- A função abaixo apaga os abandonados, com duas travas:
--   - só mexe em pedido SEM pagamento registrado no Mercado Pago;
--   - só depois de um tempo mínimo, porque pedido criado há dez minutos
--     pode estar com o cliente digitando o cartão neste instante.
-- =====================================================================

create or replace function public.limpar_carrinhos_abandonados(
  p_horas   integer default 24,
  p_aplicar boolean default false
)
returns table (pedidos integer, itens integer, mais_antigo timestamptz, aplicado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids  uuid[];
  v_qtd  integer;
  v_itens integer;
  v_velho timestamptz;
begin
  if not public.is_admin() then
    raise exception 'apenas administrador';
  end if;

  -- Nunca menos de uma hora: abaixo disso o risco de apagar uma compra em
  -- andamento é real.
  p_horas := greatest(coalesce(p_horas, 24), 1);

  select array_agg(o.id), count(*)::int, min(o.created_at)
    into v_ids, v_qtd, v_velho
  from public.orders o
  where o.status = 'pending'
    and o.mercadopago_payment_id is null
    and o.paid_at is null
    and o.created_at < now() - make_interval(hours => p_horas);

  v_qtd := coalesce(v_qtd, 0);
  if v_qtd = 0 then
    return query select 0, 0, null::timestamptz, p_aplicar;
    return;
  end if;

  select count(*)::int into v_itens from public.order_items where order_id = any(v_ids);

  -- Sem aplicar, só conta. Ninguém apaga o que não viu antes.
  if not p_aplicar then
    return query select v_qtd, v_itens, v_velho, false;
    return;
  end if;

  delete from public.order_items where order_id = any(v_ids);
  delete from public.orders     where id = any(v_ids);

  return query select v_qtd, v_itens, v_velho, true;
end $$;

comment on function public.limpar_carrinhos_abandonados is
  'Apaga pedidos pendentes sem pagamento, mais antigos que N horas. Sem p_aplicar=true apenas conta. Nunca toca em pedido com pagamento registrado.';

revoke all on function public.limpar_carrinhos_abandonados(integer, boolean) from public;
grant execute on function public.limpar_carrinhos_abandonados(integer, boolean) to authenticated;
