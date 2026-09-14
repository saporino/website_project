-- Pagamento aprovado que chega DEPOIS de o pedido ser cancelado (ex.: expirou o
-- prazo e o comprador pagou em seguida).
--
-- Antes: a função tentava levar o pagamento de "cancelado" para "aprovado", e a
-- máquina de estados recusava (corretamente), perdendo o registro.
-- Agora: o pagamento continua "cancelado" (transição absurda segue proibida), e o
-- fato fica em três lugares: o evento idempotente em lv_payment_events, um
-- reembolso PENDENTE do valor e o evento "reembolso_solicitado" no histórico.
-- O estoque não é baixado: o pedido já não existe para o vendedor.

create or replace function public.lv_pagamento_processar(
  p_provedor text, p_chave text, p_order uuid, p_status text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_evento uuid;
  v_pag public.lv_payments;
  v_ord public.lv_orders;
  v_sub record;
begin
  if p_status not in ('aprovado', 'recusado', 'cancelado') then
    raise exception 'Status de pagamento não suportado: %.', p_status using errcode = 'P0001', hint = 'PAGAMENTO_INVALIDO';
  end if;
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  select * into v_pag from public.lv_payments where order_id = p_order for update;

  insert into public.lv_payment_events (provedor, idempotency_key, payment_id, order_id, status, payload)
  values (p_provedor, p_chave, v_pag.id, p_order, p_status, coalesce(p_payload, '{}'::jsonb))
  on conflict (provedor, idempotency_key) do nothing
  returning id into v_evento;

  if v_evento is null then
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_evento_duplicado', 'pagamento',
      jsonb_build_object('provedor', p_provedor, 'chave', p_chave, 'status', p_status));
    return jsonb_build_object('duplicado', true, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status);
  end if;

  if p_status = 'aprovado' then
    if v_pag.status = 'aprovado' then
      return jsonb_build_object('duplicado', false, 'sem_efeito', true, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status);
    end if;
    if v_ord.status = 'cancelado' then
      insert into public.lv_refunds (order_id, tipo, valor_cents, motivo)
      values (p_order, 'total', v_pag.valor_cents, 'pagamento aprovado depois do cancelamento do pedido');
      perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_apos_cancelamento', 'pagamento',
        jsonb_build_object('provedor', p_provedor, 'valor_cents', v_pag.valor_cents));
      perform public.lv_registrar_evento_pedido(p_order, null, 'reembolso_solicitado', 'sistema',
        jsonb_build_object('motivo', 'pagamento após cancelamento', 'valor_cents', v_pag.valor_cents, 'status', 'pendente'));
      return jsonb_build_object('duplicado', false, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status,
        'reembolso', 'pendente');
    end if;
    update public.lv_payments set status = 'aprovado' where id = v_pag.id;
    perform public.lv_confirmar_reservas(p_order);
    update public.lv_orders set status = 'pago', pago_em = now(), pagamento_status = 'aprovado' where id = p_order;
    update public.lv_seller_orders set status = 'confirmado' where order_id = p_order and status = 'aguardando_pagamento';
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_aprovado', 'pagamento',
      jsonb_build_object('provedor', p_provedor, 'valor_cents', v_pag.valor_cents));
    for v_sub in select id, loja_nome from public.lv_seller_orders where order_id = p_order and status = 'confirmado' loop
      perform public.lv_registrar_evento_pedido(p_order, v_sub.id, 'seller_notificado', 'sistema',
        jsonb_build_object('loja', v_sub.loja_nome, 'canal', 'seller_central'));
    end loop;
  elsif p_status = 'recusado' then
    if v_pag.status in ('aguardando_pagamento', 'pendente') then
      update public.lv_payments set status = 'recusado' where id = v_pag.id;
    end if;
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_recusado', 'pagamento', jsonb_build_object('provedor', p_provedor));
  end if;

  update public.lv_orders set pagamento_status = (select status from public.lv_payments where id = v_pag.id)
   where id = p_order and pagamento_status is distinct from (select status from public.lv_payments where id = v_pag.id);

  select * into v_ord from public.lv_orders where id = p_order;
  return jsonb_build_object('duplicado', false, 'status_pedido', v_ord.status,
    'status_pagamento', (select status from public.lv_payments where id = v_pag.id));
end $$;

revoke all on function public.lv_pagamento_processar(text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.lv_pagamento_processar(text, text, uuid, text, jsonb) to service_role;
